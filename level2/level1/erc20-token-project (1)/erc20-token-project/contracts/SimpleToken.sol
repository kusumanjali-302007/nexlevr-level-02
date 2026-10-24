// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Campus Token (CAMP)
/// @notice A simple, fixed-supply ERC-20 token for learning.
/// @dev All logic (balances, transfers, allowances, events) comes from
///      OpenZeppelin's audited ERC20 contract. This file only adds:
///        1. the token name and symbol,
///        2. a one-time mint of the initial supply to the deployer.
///      There is no owner, no mint function and no burn function, so the
///      total supply can never change and nobody has special powers.
contract SimpleToken is ERC20 {
    /// 1,000,000 tokens. ERC-20 tokens have 18 decimals by default, so the
    /// smallest unit is 1e-18 CAMP and 1 CAMP is written as 1 * 10**18.
    /// "constant" = fixed at compile time (cheap and cannot be changed).
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    /// The constructor runs exactly ONCE, when the contract is deployed.
    /// ERC20("Campus Token", "CAMP") sets the name and symbol.
    constructor() ERC20("Campus Token", "CAMP") {
        // msg.sender is the wallet that deploys the contract.
        // _mint creates new tokens and gives them to that wallet.
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
