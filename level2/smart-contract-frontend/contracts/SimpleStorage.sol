// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimpleStorage
/// @notice Stores one unsigned integer on the blockchain and lets anyone read it back.
contract SimpleStorage {
    /// @dev The number kept in contract storage. Private: reads go through retrieve().
    uint256 private storedNumber;

    /// @notice Emitted every time a new number is saved.
    /// @param by The wallet address that sent the transaction.
    /// @param newValue The number that was saved.
    event NumberStored(address indexed by, uint256 newValue);

    /// @notice Saves a number. This changes blockchain state, so it costs gas.
    /// @param _number The number to save (0 up to 2^256 - 1).
    function store(uint256 _number) external {
        storedNumber = _number;
        emit NumberStored(msg.sender, _number);
    }

    /// @notice Returns the saved number. `view` means it only reads, so it is free to call.
    function retrieve() external view returns (uint256) {
        return storedNumber;
    }
}
