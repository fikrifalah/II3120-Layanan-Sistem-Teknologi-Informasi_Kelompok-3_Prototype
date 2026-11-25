// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SIMIDR
 * @notice Simulated IDR ERC-20 token for local Gigly escrow testing.
 */
contract SIMIDR is ERC20, Ownable {
    constructor() ERC20("Simulated IDR", "SIMIDR") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    /**
     * @notice Public faucet function to mint test SIMIDR tokens.
     * @param to Recipient address.
     * @param amount Amount of tokens (in wei/smallest unit) to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
