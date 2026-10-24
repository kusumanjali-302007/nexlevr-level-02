// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Crowdfunding
 * @notice Educational all-or-nothing crowdfunding contract. Many campaigns live
 *         in one contract, each identified by a unique ID (1, 2, 3, ...).
 *
 * Rules
 *  - Anyone can create a campaign with a goal (in wei) and a duration (seconds).
 *  - Anyone can contribute ETH until the deadline.
 *  - After the deadline:
 *      * goal reached  -> only the creator can withdraw the funds (once).
 *      * goal missed   -> every contributor can claim a refund (once).
 *
 * Security
 *  - Checks-Effects-Interactions pattern in every function that sends ETH.
 *  - Custom re-entrancy guard on withdraw/refund.
 *  - ETH is sent with `call` and the result is always checked.
 */
contract Crowdfunding {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Status {
        Active, // deadline not reached yet
        Successful, // deadline passed and goal reached
        Failed // deadline passed and goal NOT reached
    }

    struct Campaign {
        address creator;
        uint256 goal; // in wei
        uint256 deadline; // unix timestamp
        uint256 totalRaised; // in wei
        bool withdrawn; // true once the creator took the funds
    }

    // ------------------------------------------------------------------
    // Constants & storage
    // ------------------------------------------------------------------

    uint256 public constant MIN_DURATION = 1 minutes;
    uint256 public constant MAX_DURATION = 365 days;

    uint256 public campaignCount;

    mapping(uint256 => Campaign) private _campaigns;
    // campaignId => contributor => amount (wei)
    mapping(uint256 => mapping(address => uint256)) private _contributions;

    uint256 private _reentrancyStatus = 1; // 1 = not entered, 2 = entered

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal, uint256 deadline);
    event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount, uint256 totalRaised);
    event FundsWithdrawn(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event RefundClaimed(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    // ------------------------------------------------------------------
    // Custom errors
    // ------------------------------------------------------------------

    error InvalidGoal();
    error InvalidDuration();
    error CampaignDoesNotExist();
    error CampaignEnded();
    error CampaignNotEnded();
    error ZeroContribution();
    error NotCreator();
    error GoalNotReached();
    error GoalReached();
    error AlreadyWithdrawn();
    error NothingToRefund();
    error TransferFailed();
    error ReentrantCall();

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier campaignExists(uint256 campaignId) {
        if (campaignId == 0 || campaignId > campaignCount) revert CampaignDoesNotExist();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == 2) revert ReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    // ------------------------------------------------------------------
    // Write functions
    // ------------------------------------------------------------------

    /**
     * @notice Create a new campaign.
     * @param goal     Funding goal in wei (must be > 0).
     * @param duration Duration in seconds (MIN_DURATION..MAX_DURATION).
     * @return campaignId The unique ID of the new campaign.
     */
    function createCampaign(uint256 goal, uint256 duration) external returns (uint256 campaignId) {
        if (goal == 0) revert InvalidGoal();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();

        campaignId = ++campaignCount;
        uint256 deadline = block.timestamp + duration;

        _campaigns[campaignId] = Campaign({
            creator: msg.sender,
            goal: goal,
            deadline: deadline,
            totalRaised: 0,
            withdrawn: false
        });

        emit CampaignCreated(campaignId, msg.sender, goal, deadline);
    }

    /**
     * @notice Contribute ETH to an active campaign.
     */
    function contribute(uint256 campaignId) external payable campaignExists(campaignId) {
        Campaign storage c = _campaigns[campaignId];

        if (msg.value == 0) revert ZeroContribution();
        if (block.timestamp >= c.deadline) revert CampaignEnded();

        _contributions[campaignId][msg.sender] += msg.value;
        c.totalRaised += msg.value;

        emit ContributionReceived(campaignId, msg.sender, msg.value, c.totalRaised);
    }

    /**
     * @notice Creator withdraws the raised funds after a successful campaign.
     */
    function withdrawFunds(uint256 campaignId) external campaignExists(campaignId) nonReentrant {
        Campaign storage c = _campaigns[campaignId];

        // Checks
        if (msg.sender != c.creator) revert NotCreator();
        if (block.timestamp < c.deadline) revert CampaignNotEnded();
        if (c.totalRaised < c.goal) revert GoalNotReached();
        if (c.withdrawn) revert AlreadyWithdrawn();

        // Effects
        c.withdrawn = true;
        uint256 amount = c.totalRaised;

        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit FundsWithdrawn(campaignId, msg.sender, amount);
    }

    /**
     * @notice Contributor claims a refund after a failed campaign.
     */
    function claimRefund(uint256 campaignId) external campaignExists(campaignId) nonReentrant {
        Campaign storage c = _campaigns[campaignId];

        // Checks
        if (block.timestamp < c.deadline) revert CampaignNotEnded();
        if (c.totalRaised >= c.goal) revert GoalReached();

        uint256 amount = _contributions[campaignId][msg.sender];
        if (amount == 0) revert NothingToRefund();

        // Effects
        _contributions[campaignId][msg.sender] = 0;

        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit RefundClaimed(campaignId, msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // View functions
    // ------------------------------------------------------------------

    /**
     * @notice Full details of a campaign, including its computed status.
     */
    function getCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (
            address creator,
            uint256 goal,
            uint256 deadline,
            uint256 totalRaised,
            bool withdrawn,
            Status status
        )
    {
        Campaign storage c = _campaigns[campaignId];
        return (c.creator, c.goal, c.deadline, c.totalRaised, c.withdrawn, _statusOf(c));
    }

    /// @notice Amount (wei) a contributor currently has in a campaign (0 after refund).
    function getContribution(uint256 campaignId, address contributor)
        external
        view
        campaignExists(campaignId)
        returns (uint256)
    {
        return _contributions[campaignId][contributor];
    }

    /// @notice Active, Successful or Failed.
    function getStatus(uint256 campaignId) external view campaignExists(campaignId) returns (Status) {
        return _statusOf(_campaigns[campaignId]);
    }

    function _statusOf(Campaign storage c) private view returns (Status) {
        if (block.timestamp < c.deadline) return Status.Active;
        return c.totalRaised >= c.goal ? Status.Successful : Status.Failed;
    }
}
