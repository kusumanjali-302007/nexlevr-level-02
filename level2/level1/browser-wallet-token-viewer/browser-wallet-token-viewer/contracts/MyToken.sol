// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MyToken
/// @notice A simple ERC-20 token with a fixed supply. There is no mint function,
///         so the total supply can never grow after deployment.
contract MyToken is ERC20 {
    /// @param initialSupply Whole tokens to create (the contract multiplies by 10 ** decimals()).
    constructor(uint256 initialSupply) ERC20("My Token", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
