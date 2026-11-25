// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Escrow
 * @notice Multi-milestone smart contract escrow for Gigly using SIM-IDR (ERC-20).
 * @dev Implements hybrid storage (SHA-256 off-chain hash only), 5-day review auto-release,
 *      freelancer handover without unlocking escrow, 3-way arbiter verdict (RELEASE/REFUND/SPLIT),
 *      and immutable contract closure.
 */
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant REVIEW_TIMEOUT = 5 days;

    enum ContractStatus {
        ACTIVE,
        CLOSED
    }

    enum MilestoneStatus {
        LOCKED,
        SUBMITTED,
        RELEASED,
        DISPUTED,
        REFUNDED,
        SPLIT_SETTLED
    }

    enum VerdictAction {
        RELEASE,
        REFUND,
        SPLIT
    }

    struct Milestone {
        uint256 amount;
        address freelancer;
        MilestoneStatus status;
        uint256 submittedAt;
        bytes32 deliverableHash;
    }

    struct EscrowContract {
        bytes32 offchainContractHash;
        address client;
        address freelancer;
        address arbiter;
        uint256 totalLocked;
        uint256 totalReleased;
        uint256 milestoneCount;
        ContractStatus status;
    }

    IERC20 public immutable token;
    address public immutable defaultArbiter;
    uint256 public contractCount;

    mapping(uint256 => EscrowContract) public contracts;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;

    event EscrowCreatedAndLocked(
        uint256 indexed contractId,
        bytes32 indexed offchainContractHash,
        address indexed client,
        address freelancer,
        address arbiter,
        uint256 totalAmount,
        uint256 milestoneCount
    );
    event MilestoneSubmitted(
        uint256 indexed contractId,
        uint256 indexed milestoneIndex,
        address indexed freelancer,
        bytes32 deliverableHash,
        uint256 submittedAt
    );
    event MilestoneReleased(
        uint256 indexed contractId,
        uint256 indexed milestoneIndex,
        address indexed freelancer,
        uint256 amount,
        bool isAutoRelease
    );
    event MilestonesReassigned(
        uint256 indexed contractId,
        address indexed previousFreelancer,
        address indexed newFreelancer,
        uint256 reassignedCount
    );
    event DisputeRaised(
        uint256 indexed contractId,
        uint256 indexed milestoneIndex,
        address indexed raisedBy
    );
    event ArbiterVerdictExecuted(
        uint256 indexed contractId,
        uint256 indexed milestoneIndex,
        VerdictAction action,
        uint256 freelancerAmount,
        uint256 clientAmount
    );
    event ContractClosed(
        uint256 indexed contractId,
        address indexed closedBy
    );

    modifier contractExists(uint256 _contractId) {
        require(_contractId > 0 && _contractId <= contractCount, "Escrow: contract does not exist");
        _;
    }

    modifier contractActive(uint256 _contractId) {
        require(contracts[_contractId].status == ContractStatus.ACTIVE, "Escrow: contract is closed");
        _;
    }

    modifier onlyClient(uint256 _contractId) {
        require(msg.sender == contracts[_contractId].client, "Escrow: caller is not the client");
        _;
    }

    modifier onlyArbiter(uint256 _contractId) {
        require(msg.sender == contracts[_contractId].arbiter, "Escrow: caller is not the arbiter");
        _;
    }

    modifier milestoneExists(uint256 _contractId, uint256 _milestoneIndex) {
        require(
            _milestoneIndex < contracts[_contractId].milestoneCount,
            "Escrow: milestone does not exist"
        );
        _;
    }

    constructor(address _token, address _defaultArbiter) {
        require(_token != address(0), "Escrow: invalid token address");
        require(_defaultArbiter != address(0), "Escrow: invalid arbiter address");
        token = IERC20(_token);
        defaultArbiter = _defaultArbiter;
    }

    /**
     * @notice Creates a multi-milestone escrow contract and atomically locks total SIM-IDR upfront.
     * @dev Stores only the SHA-256 `offchainContractHash` on-chain (no PII or long KPI text).
     *      Client must approve this contract for the total milestone sum beforehand.
     */
    function createAndLockEscrow(
        bytes32 _offchainContractHash,
        address _freelancer,
        address _arbiter,
        uint256[] calldata _milestoneAmounts
    ) external nonReentrant returns (uint256 contractId) {
        require(_offchainContractHash != bytes32(0), "Escrow: invalid contract hash");
        require(_freelancer != address(0), "Escrow: invalid freelancer address");
        require(_freelancer != msg.sender, "Escrow: client and freelancer must differ");
        require(_milestoneAmounts.length > 0, "Escrow: at least one milestone required");

        address arbiterAddr = _arbiter == address(0) ? defaultArbiter : _arbiter;
        require(
            arbiterAddr != msg.sender && arbiterAddr != _freelancer,
            "Escrow: arbiter cannot be client or freelancer"
        );

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Escrow: milestone amount must be > 0");
            totalAmount += _milestoneAmounts[i];
        }

        contractId = ++contractCount;
        contracts[contractId] = EscrowContract({
            offchainContractHash: _offchainContractHash,
            client: msg.sender,
            freelancer: _freelancer,
            arbiter: arbiterAddr,
            totalLocked: totalAmount,
            totalReleased: 0,
            milestoneCount: _milestoneAmounts.length,
            status: ContractStatus.ACTIVE
        });

        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            milestones[contractId][i] = Milestone({
                amount: _milestoneAmounts[i],
                freelancer: _freelancer,
                status: MilestoneStatus.LOCKED,
                submittedAt: 0,
                deliverableHash: bytes32(0)
            });
        }

        // Interaction after all state updates (CEI)
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        emit EscrowCreatedAndLocked(
            contractId,
            _offchainContractHash,
            msg.sender,
            _freelancer,
            arbiterAddr,
            totalAmount,
            _milestoneAmounts.length
        );
    }

    /**
     * @notice Freelancer submits deliverable hash for a locked milestone, starting the 5-day review timer.
     */
    function submitMilestone(
        uint256 _contractId,
        uint256 _milestoneIndex,
        bytes32 _deliverableHash
    ) external contractExists(_contractId) contractActive(_contractId) milestoneExists(_contractId, _milestoneIndex) {
        Milestone storage m = milestones[_contractId][_milestoneIndex];
        require(msg.sender == m.freelancer, "Escrow: caller is not the milestone freelancer");
        require(m.status == MilestoneStatus.LOCKED, "Escrow: milestone is not locked");
        require(_deliverableHash != bytes32(0), "Escrow: invalid deliverable hash");

        m.status = MilestoneStatus.SUBMITTED;
        m.submittedAt = block.timestamp;
        m.deliverableHash = _deliverableHash;

        emit MilestoneSubmitted(_contractId, _milestoneIndex, msg.sender, _deliverableHash, block.timestamp);
    }

    /**
     * @notice Releases a milestone's funds to its assigned freelancer upon client approval
     *         OR automatically after the 5-day review timeout expires without dispute.
     */
    function releaseMilestonePayment(
        uint256 _contractId,
        uint256 _milestoneIndex
    )
        external
        nonReentrant
        contractExists(_contractId)
        contractActive(_contractId)
        milestoneExists(_contractId, _milestoneIndex)
    {
        EscrowContract storage c = contracts[_contractId];
        Milestone storage m = milestones[_contractId][_milestoneIndex];

        require(m.status != MilestoneStatus.DISPUTED, "Escrow: milestone is frozen due to dispute");
        require(
            m.status == MilestoneStatus.LOCKED || m.status == MilestoneStatus.SUBMITTED,
            "Escrow: milestone already settled"
        );

        bool isClientApproval = (msg.sender == c.client);
        bool isTimeoutReached = (
            m.status == MilestoneStatus.SUBMITTED &&
            m.submittedAt > 0 &&
            block.timestamp >= m.submittedAt + REVIEW_TIMEOUT
        );

        require(
            isClientApproval || isTimeoutReached,
            "Escrow: only client can release before review timeout"
        );

        bool isAutoRelease = !isClientApproval;

        // Effects before interaction
        m.status = MilestoneStatus.RELEASED;
        c.totalReleased += m.amount;

        // Interaction
        token.safeTransfer(m.freelancer, m.amount);

        emit MilestoneReleased(_contractId, _milestoneIndex, m.freelancer, m.amount, isAutoRelease);
    }

    /**
     * @notice Reassigns all remaining unsettled (non-disputed) milestones to a replacement freelancer
     *         without unlocking escrow funds. Completed milestones remain untouched.
     */
    function reassignRemainingMilestones(
        uint256 _contractId,
        address _newFreelancer
    ) external contractExists(_contractId) contractActive(_contractId) onlyClient(_contractId) {
        EscrowContract storage c = contracts[_contractId];
        require(_newFreelancer != address(0), "Escrow: invalid new freelancer address");
        require(_newFreelancer != c.client, "Escrow: new freelancer cannot be client");
        require(_newFreelancer != c.arbiter, "Escrow: new freelancer cannot be arbiter");
        require(_newFreelancer != c.freelancer, "Escrow: new freelancer must differ from current");

        uint256 reassignedCount = 0;
        for (uint256 i = 0; i < c.milestoneCount; i++) {
            Milestone storage m = milestones[_contractId][i];
            if (m.status == MilestoneStatus.LOCKED || m.status == MilestoneStatus.SUBMITTED) {
                m.freelancer = _newFreelancer;
                m.status = MilestoneStatus.LOCKED;
                m.submittedAt = 0;
                m.deliverableHash = bytes32(0);
                reassignedCount++;
            }
        }

        require(reassignedCount > 0, "Escrow: no remaining milestones to reassign");

        address previousFreelancer = c.freelancer;
        c.freelancer = _newFreelancer;

        emit MilestonesReassigned(_contractId, previousFreelancer, _newFreelancer, reassignedCount);
    }

    /**
     * @notice Freezes payout on a specific milestone by escalating it to DISPUTED state.
     */
    function raiseDispute(
        uint256 _contractId,
        uint256 _milestoneIndex
    ) external contractExists(_contractId) contractActive(_contractId) milestoneExists(_contractId, _milestoneIndex) {
        EscrowContract storage c = contracts[_contractId];
        Milestone storage m = milestones[_contractId][_milestoneIndex];

        require(
            msg.sender == c.client || msg.sender == m.freelancer,
            "Escrow: caller is not a contract participant"
        );
        require(
            m.status == MilestoneStatus.LOCKED || m.status == MilestoneStatus.SUBMITTED,
            "Escrow: milestone cannot be disputed"
        );

        m.status = MilestoneStatus.DISPUTED;

        emit DisputeRaised(_contractId, _milestoneIndex, msg.sender);
    }

    /**
     * @notice Binding arbiter verdict on a disputed milestone:
     *         - RELEASE: 100% to freelancer
     *         - REFUND:  100% to client
     *         - SPLIT:   _freelancerSharePercentage% (1..99) to freelancer, remainder to client
     */
    function executeArbiterVerdict(
        uint256 _contractId,
        uint256 _milestoneIndex,
        VerdictAction _action,
        uint8 _freelancerSharePercentage
    )
        external
        nonReentrant
        contractExists(_contractId)
        contractActive(_contractId)
        onlyArbiter(_contractId)
        milestoneExists(_contractId, _milestoneIndex)
    {
        EscrowContract storage c = contracts[_contractId];
        Milestone storage m = milestones[_contractId][_milestoneIndex];

        require(m.status == MilestoneStatus.DISPUTED, "Escrow: milestone is not disputed");

        uint256 freelancerAmount = 0;
        uint256 clientAmount = 0;

        if (_action == VerdictAction.RELEASE) {
            m.status = MilestoneStatus.RELEASED;
            freelancerAmount = m.amount;
        } else if (_action == VerdictAction.REFUND) {
            m.status = MilestoneStatus.REFUNDED;
            clientAmount = m.amount;
        } else {
            require(
                _freelancerSharePercentage > 0 && _freelancerSharePercentage < 100,
                "Escrow: split percentage must be between 1 and 99"
            );
            m.status = MilestoneStatus.SPLIT_SETTLED;
            freelancerAmount = (m.amount * _freelancerSharePercentage) / 100;
            clientAmount = m.amount - freelancerAmount;
        }

        c.totalReleased += m.amount;

        // Interactions after all state updates (CEI)
        if (freelancerAmount > 0) {
            token.safeTransfer(m.freelancer, freelancerAmount);
        }
        if (clientAmount > 0) {
            token.safeTransfer(c.client, clientAmount);
        }

        emit ArbiterVerdictExecuted(
            _contractId,
            _milestoneIndex,
            _action,
            freelancerAmount,
            clientAmount
        );
    }

    /**
     * @notice Permanently and immutably closes the contract once all milestones are settled.
     */
    function closeContract(
        uint256 _contractId
    ) external contractExists(_contractId) contractActive(_contractId) {
        EscrowContract storage c = contracts[_contractId];
        require(
            msg.sender == c.client || msg.sender == c.freelancer || msg.sender == c.arbiter,
            "Escrow: caller is not authorized to close contract"
        );

        for (uint256 i = 0; i < c.milestoneCount; i++) {
            MilestoneStatus st = milestones[_contractId][i].status;
            require(
                st == MilestoneStatus.RELEASED ||
                    st == MilestoneStatus.REFUNDED ||
                    st == MilestoneStatus.SPLIT_SETTLED,
                "Escrow: all milestones must be settled before closing"
            );
        }

        c.status = ContractStatus.CLOSED;

        emit ContractClosed(_contractId, msg.sender);
    }

    /**
     * @notice Helper view to inspect all milestones of a contract.
     */
    function getContractMilestones(
        uint256 _contractId
    ) external view contractExists(_contractId) returns (Milestone[] memory) {
        uint256 count = contracts[_contractId].milestoneCount;
        Milestone[] memory result = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = milestones[_contractId][i];
        }
        return result;
    }
}
