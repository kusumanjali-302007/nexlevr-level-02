// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Crowdfunding} from "../Crowdfunding.sol";

/// @dev TEST-ONLY contract with NO receive()/fallback, so it cannot accept ETH.
///      Used to test the TransferFailed path.
contract RejectEther {
    function createCampaign(Crowdfunding target, uint256 goal, uint256 duration) external returns (uint256) {
        return target.createCampaign(goal, duration);
    }

    function contribute(Crowdfunding target, uint256 id) external payable {
        target.contribute{value: msg.value}(id);
    }

    function withdraw(Crowdfunding target, uint256 id) external {
        target.withdrawFunds(id);
    }

    function refund(Crowdfunding target, uint256 id) external {
        target.claimRefund(id);
    }
}
