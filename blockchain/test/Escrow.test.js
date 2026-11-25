const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Gigly Smart Contract Escrow Audit & QA Suite (Deliverable 2 II3120)", function () {
  const M1 = ethers.parseUnits("2000000", 18); // 2,000,000 SIM-IDR
  const M2 = ethers.parseUnits("3000000", 18); // 3,000,000 SIM-IDR
  const M3 = ethers.parseUnits("5000000", 18); // 5,000,000 SIM-IDR
  const TOTAL = M1 + M2 + M3; // 10,000,000 SIM-IDR
  const FIVE_DAYS = 5 * 24 * 60 * 60;

  const CONTRACT_HASH = ethers.sha256(
    ethers.toUtf8Bytes("gigly-offchain-contract-v1-kpi-and-scope")
  );
  const DELIVERABLE_HASH_1 = ethers.sha256(ethers.toUtf8Bytes("deliverable-milestone-1.zip"));
  const DELIVERABLE_HASH_2 = ethers.sha256(ethers.toUtf8Bytes("deliverable-milestone-2.zip"));

  const ContractStatus = { ACTIVE: 0n, CLOSED: 1n };
  const MilestoneStatus = {
    LOCKED: 0n,
    SUBMITTED: 1n,
    RELEASED: 2n,
    DISPUTED: 3n,
    REFUNDED: 4n,
    SPLIT_SETTLED: 5n,
  };
  const VerdictAction = { RELEASE: 0, REFUND: 1, SPLIT: 2 };

  async function deployFixture() {
    const [deployer, arbiter, client, freelancerA, freelancerB, outsider] =
      await ethers.getSigners();

    const SIMIDR = await ethers.getContractFactory("SIMIDR");
    const simidr = await SIMIDR.deploy();
    await simidr.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(await simidr.getAddress(), arbiter.address);
    await escrow.waitForDeployment();

    // Fund client with test SIM-IDR via faucet
    await simidr.connect(client).mint(client.address, TOTAL * 3n);

    return {
      simidr,
      escrow,
      deployer,
      arbiter,
      client,
      freelancerA,
      freelancerB,
      outsider,
    };
  }

  async function createMultiMilestoneContract(fixture, amounts = [M1, M2, M3]) {
    const { simidr, escrow, arbiter, client, freelancerA } = fixture;
    const total = amounts.reduce((acc, v) => acc + v, 0n);

    await simidr.connect(client).approve(await escrow.getAddress(), total);
    const tx = await escrow
      .connect(client)
      .createAndLockEscrow(CONTRACT_HASH, freelancerA.address, arbiter.address, amounts);
    await tx.wait();
    return 1n;
  }

  describe("1. Deployment & Hybrid Storage (SIM-IDR + Escrow)", function () {
    it("deploys SIM-IDR with 1B initial supply and working faucet", async function () {
      const { simidr, deployer, outsider } = await deployFixture();

      expect(await simidr.name()).to.equal("Simulated IDR");
      expect(await simidr.symbol()).to.equal("SIMIDR");
      expect(await simidr.balanceOf(deployer.address)).to.equal(
        ethers.parseUnits("1000000000", 18)
      );

      const amt = ethers.parseUnits("50000", 18);
      await simidr.connect(outsider).mint(outsider.address, amt);
      expect(await simidr.balanceOf(outsider.address)).to.equal(amt);
    });

    it("locks multi-milestone escrow upfront and stores only SHA-256 offchain_contract_hash", async function () {
      const { simidr, escrow, arbiter, client, freelancerA } = await deployFixture();
      const escrowAddr = await escrow.getAddress();

      await simidr.connect(client).approve(escrowAddr, TOTAL);

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(CONTRACT_HASH, freelancerA.address, arbiter.address, [M1, M2, M3])
      )
        .to.emit(escrow, "EscrowCreatedAndLocked")
        .withArgs(1n, CONTRACT_HASH, client.address, freelancerA.address, arbiter.address, TOTAL, 3n);

      const c = await escrow.contracts(1);
      expect(c.offchainContractHash).to.equal(CONTRACT_HASH);
      expect(c.client).to.equal(client.address);
      expect(c.freelancer).to.equal(freelancerA.address);
      expect(c.arbiter).to.equal(arbiter.address);
      expect(c.totalLocked).to.equal(TOTAL);
      expect(c.milestoneCount).to.equal(3n);
      expect(c.status).to.equal(ContractStatus.ACTIVE);
      expect(await simidr.balanceOf(escrowAddr)).to.equal(TOTAL);

      const ms = await escrow.getContractMilestones(1);
      expect(ms.length).to.equal(3);
      expect(ms[0].amount).to.equal(M1);
      expect(ms[1].amount).to.equal(M2);
      expect(ms[2].amount).to.equal(M3);
    });

    it("rejects invalid createAndLockEscrow inputs (zero hash, empty milestones, self-dealing, conflict arbiter)", async function () {
      const { escrow, arbiter, client, freelancerA } = await deployFixture();

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(ethers.ZeroHash, freelancerA.address, arbiter.address, [M1])
      ).to.be.revertedWith("Escrow: invalid contract hash");

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(CONTRACT_HASH, client.address, arbiter.address, [M1])
      ).to.be.revertedWith("Escrow: client and freelancer must differ");

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(CONTRACT_HASH, freelancerA.address, client.address, [M1])
      ).to.be.revertedWith("Escrow: arbiter cannot be client or freelancer");

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(CONTRACT_HASH, freelancerA.address, arbiter.address, [])
      ).to.be.revertedWith("Escrow: at least one milestone required");

      await expect(
        escrow
          .connect(client)
          .createAndLockEscrow(CONTRACT_HASH, freelancerA.address, arbiter.address, [M1, 0n])
      ).to.be.revertedWith("Escrow: milestone amount must be > 0");
    });
  });

  describe("2. Milestone Release & 5-Day Auto-Release Timeout", function () {
    it("allows normal milestone release by client", async function () {
      const fixture = await deployFixture();
      const { simidr, escrow, client, freelancerA } = fixture;
      await createMultiMilestoneContract(fixture);

      await escrow.connect(freelancerA).submitMilestone(1, 0, DELIVERABLE_HASH_1);

      await expect(escrow.connect(client).releaseMilestonePayment(1, 0))
        .to.emit(escrow, "MilestoneReleased")
        .withArgs(1n, 0n, freelancerA.address, M1, false);

      expect(await simidr.balanceOf(freelancerA.address)).to.equal(M1);
      expect((await escrow.milestones(1, 0)).status).to.equal(MilestoneStatus.RELEASED);
    });

    it("blocks non-client release before 5-day timeout, then auto-releases after > 5 days (evm_increaseTime)", async function () {
      const fixture = await deployFixture();
      const { simidr, escrow, freelancerA, outsider } = fixture;
      await createMultiMilestoneContract(fixture);

      await escrow.connect(freelancerA).submitMilestone(1, 0, DELIVERABLE_HASH_1);

      // Advance 4 days -> still before timeout
      await network.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");

      await expect(
        escrow.connect(freelancerA).releaseMilestonePayment(1, 0)
      ).to.be.revertedWith("Escrow: only client can release before review timeout");

      // Advance 1 day + 60 seconds -> exceeds 5 days
      await network.provider.send("evm_increaseTime", [1 * 24 * 60 * 60 + 60]);
      await network.provider.send("evm_mine");

      await expect(escrow.connect(outsider).releaseMilestonePayment(1, 0))
        .to.emit(escrow, "MilestoneReleased")
        .withArgs(1n, 0n, freelancerA.address, M1, true);

      expect(await simidr.balanceOf(freelancerA.address)).to.equal(M1);
    });
  });

  describe("3. Freelancer Handover (reassignRemainingMilestones)", function () {
    it("keeps paid milestones intact and redirects remaining milestones to replacement freelancer without unlocking escrow", async function () {
      const fixture = await deployFixture();
      const { simidr, escrow, client, freelancerA, freelancerB } = fixture;
      const escrowAddr = await escrow.getAddress();
      await createMultiMilestoneContract(fixture);

      // Milestone 0 completed & paid to freelancerA
      await escrow.connect(freelancerA).submitMilestone(1, 0, DELIVERABLE_HASH_1);
      await escrow.connect(client).releaseMilestonePayment(1, 0);
      expect(await simidr.balanceOf(freelancerA.address)).to.equal(M1);

      const escrowBalanceBeforeHandover = await simidr.balanceOf(escrowAddr);
      expect(escrowBalanceBeforeHandover).to.equal(M2 + M3);

      // Handover remaining milestones (1 and 2) to freelancerB
      await expect(escrow.connect(client).reassignRemainingMilestones(1, freelancerB.address))
        .to.emit(escrow, "MilestonesReassigned")
        .withArgs(1n, freelancerA.address, freelancerB.address, 2n);

      // Escrow balance must remain untouched (no unlock)
      expect(await simidr.balanceOf(escrowAddr)).to.equal(M2 + M3);

      // Old freelancer cannot submit milestone 1 anymore
      await expect(
        escrow.connect(freelancerA).submitMilestone(1, 1, DELIVERABLE_HASH_2)
      ).to.be.revertedWith("Escrow: caller is not the milestone freelancer");

      // Replacement freelancer submits & receives payment for milestone 1
      await escrow.connect(freelancerB).submitMilestone(1, 1, DELIVERABLE_HASH_2);
      await escrow.connect(client).releaseMilestonePayment(1, 1);

      expect(await simidr.balanceOf(freelancerA.address)).to.equal(M1);
      expect(await simidr.balanceOf(freelancerB.address)).to.equal(M2);
    });

    it("reverts when non-client tries to reassign milestones", async function () {
      const fixture = await deployFixture();
      const { escrow, freelancerA, freelancerB, outsider } = fixture;
      await createMultiMilestoneContract(fixture);

      await expect(
        escrow.connect(outsider).reassignRemainingMilestones(1, freelancerB.address)
      ).to.be.revertedWith("Escrow: caller is not the client");

      await expect(
        escrow.connect(freelancerA).reassignRemainingMilestones(1, freelancerB.address)
      ).to.be.revertedWith("Escrow: caller is not the client");
    });
  });

  describe("4. Dispute Escalation & Arbiter Verdict (RELEASE / REFUND / SPLIT)", function () {
    it("freezes milestone payout (including auto-release) on raiseDispute and rejects non-arbiter verdict", async function () {
      const fixture = await deployFixture();
      const { escrow, client, freelancerA, outsider } = fixture;
      await createMultiMilestoneContract(fixture);

      await escrow.connect(freelancerA).submitMilestone(1, 0, DELIVERABLE_HASH_1);

      await expect(escrow.connect(client).raiseDispute(1, 0))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(1n, 0n, client.address);

      // Even after 5+ days, auto-release MUST remain frozen while disputed
      await network.provider.send("evm_increaseTime", [FIVE_DAYS + 3600]);
      await network.provider.send("evm_mine");

      await expect(
        escrow.connect(freelancerA).releaseMilestonePayment(1, 0)
      ).to.be.revertedWith("Escrow: milestone is frozen due to dispute");

      await expect(
        escrow.connect(client).releaseMilestonePayment(1, 0)
      ).to.be.revertedWith("Escrow: milestone is frozen due to dispute");

      // Non-arbiter cannot execute verdict
      await expect(
        escrow.connect(client).executeArbiterVerdict(1, 0, VerdictAction.REFUND, 0)
      ).to.be.revertedWith("Escrow: caller is not the arbiter");

      await expect(
        escrow.connect(outsider).executeArbiterVerdict(1, 0, VerdictAction.RELEASE, 100)
      ).to.be.revertedWith("Escrow: caller is not the arbiter");
    });

    it("executes all 3 binding arbiter verdicts: RELEASE (100%), REFUND (100%), and SPLIT (70:30)", async function () {
      const fixture = await deployFixture();
      const { simidr, escrow, arbiter, client, freelancerA } = fixture;
      await createMultiMilestoneContract(fixture);

      // Raise disputes on all 3 milestones
      await escrow.connect(freelancerA).raiseDispute(1, 0); // M1 = 2,000,000
      await escrow.connect(client).raiseDispute(1, 1);      // M2 = 3,000,000
      await escrow.connect(client).raiseDispute(1, 2);      // M3 = 5,000,000

      const clientBalBefore = await simidr.balanceOf(client.address);
      const freelancerBalBefore = await simidr.balanceOf(freelancerA.address);

      // 1) RELEASE on milestone 0 -> 100% M1 to freelancerA
      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 0, VerdictAction.RELEASE, 100)
      )
        .to.emit(escrow, "ArbiterVerdictExecuted")
        .withArgs(1n, 0n, VerdictAction.RELEASE, M1, 0n);

      // 2) REFUND on milestone 1 -> 100% M2 to client
      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 1, VerdictAction.REFUND, 0)
      )
        .to.emit(escrow, "ArbiterVerdictExecuted")
        .withArgs(1n, 1n, VerdictAction.REFUND, 0n, M2);

      // 3) SPLIT 70:30 on milestone 2 -> 70% M3 to freelancerA, 30% M3 to client
      const expectedFreelancerSplit = (M3 * 70n) / 100n;
      const expectedClientSplit = M3 - expectedFreelancerSplit;

      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 2, VerdictAction.SPLIT, 70)
      )
        .to.emit(escrow, "ArbiterVerdictExecuted")
        .withArgs(1n, 2n, VerdictAction.SPLIT, expectedFreelancerSplit, expectedClientSplit);

      expect(await simidr.balanceOf(freelancerA.address)).to.equal(
        freelancerBalBefore + M1 + expectedFreelancerSplit
      );
      expect(await simidr.balanceOf(client.address)).to.equal(
        clientBalBefore + M2 + expectedClientSplit
      );
      expect(await simidr.balanceOf(await escrow.getAddress())).to.equal(0n);
    });

    it("rejects invalid SPLIT percentages (0 or 100) and outsider dispute raising", async function () {
      const fixture = await deployFixture();
      const { escrow, arbiter, client, outsider } = fixture;
      await createMultiMilestoneContract(fixture, [M1]);

      await expect(escrow.connect(outsider).raiseDispute(1, 0)).to.be.revertedWith(
        "Escrow: caller is not a contract participant"
      );

      await escrow.connect(client).raiseDispute(1, 0);

      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 0, VerdictAction.SPLIT, 0)
      ).to.be.revertedWith("Escrow: split percentage must be between 1 and 99");

      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 0, VerdictAction.SPLIT, 100)
      ).to.be.revertedWith("Escrow: split percentage must be between 1 and 99");
    });
  });

  describe("5. Contract Closure (closeContract) & Immutability", function () {
    it("prevents closing while milestones are unsettled, then permanently locks contract after closeContract", async function () {
      const fixture = await deployFixture();
      const { escrow, arbiter, client, freelancerA, freelancerB } = fixture;
      await createMultiMilestoneContract(fixture, [M1, M2]);

      // Cannot close while milestones are still LOCKED
      await expect(escrow.connect(client).closeContract(1)).to.be.revertedWith(
        "Escrow: all milestones must be settled before closing"
      );

      // Settle both milestones
      await escrow.connect(client).releaseMilestonePayment(1, 0);
      await escrow.connect(client).releaseMilestonePayment(1, 1);

      // Close contract
      await expect(escrow.connect(client).closeContract(1))
        .to.emit(escrow, "ContractClosed")
        .withArgs(1n, client.address);

      expect((await escrow.contracts(1)).status).to.equal(ContractStatus.CLOSED);

      // All subsequent state-mutating calls must revert
      await expect(escrow.connect(client).closeContract(1)).to.be.revertedWith(
        "Escrow: contract is closed"
      );
      await expect(
        escrow.connect(client).releaseMilestonePayment(1, 0)
      ).to.be.revertedWith("Escrow: contract is closed");
      await expect(
        escrow.connect(client).reassignRemainingMilestones(1, freelancerB.address)
      ).to.be.revertedWith("Escrow: contract is closed");
      await expect(escrow.connect(freelancerA).raiseDispute(1, 0)).to.be.revertedWith(
        "Escrow: contract is closed"
      );
      await expect(
        escrow.connect(arbiter).executeArbiterVerdict(1, 0, VerdictAction.RELEASE, 100)
      ).to.be.revertedWith("Escrow: contract is closed");
    });
  });
});
