// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Crowdfunding} from "../Crowdfunding.sol";

/// @dev TEST-ONLY contract. Tries to re-enter claimRefund / withdrawFunds
///      from its receive() function. Never deploy outside of tests.
contract ReentrancyAttacker {
    Crowdfunding public immutable target;
    uint256 public campaignId;
    bool public attackWithdraw;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(address _target) {
        target = Crowdfunding(_target);
    }

    function createCampaign(uint256 goal, uint256 duration) external {
        campaignId = target.createCampaign(goal, duration);
    }

    function contribute(uint256 id) external payable {
        campaignId = id;
        target.contribute{value: msg.value}(id);
    }

    function attackRefund() external {
        attackWithdraw = false;
        target.claimRefund(campaignId);
    }

    function attackWithdrawFunds() external {
        attackWithdraw = true;
        target.withdrawFunds(campaignId);
    }

    receive() external payable {
        reentryAttempted = true;
        // Swallow the revert so the outer call can finish; we only record
        // whether the second (re-entrant) call worked.
        if (attackWithdraw) {
            try target.withdrawFunds(campaignId) {
                reentrySucceeded = true;
            } catch {}
        } else {
            try target.claimRefund(campaignId) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
