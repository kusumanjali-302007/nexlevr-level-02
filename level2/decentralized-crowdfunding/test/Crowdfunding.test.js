const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Enum mirror of Crowdfunding.Status
const Status = { Active: 0n, Successful: 1n, Failed: 2n };

const GOAL = ethers.parseEther("10");
const DURATION = 7 * 24 * 60 * 60; // 7 days

describe("Crowdfunding", function () {
  // ---------------------------------------------------------------
  // Fixtures (each test starts from a clean, identical blockchain state)
  // ---------------------------------------------------------------
  async function deployFixture() {
    const [creator, alice, bob, carol, stranger] = await ethers.getSigners();
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const crowdfunding = await Crowdfunding.deploy();
    await crowdfunding.waitForDeployment();
    return { crowdfunding, creator, alice, bob, carol, stranger };
  }

  // Campaign #1 already created by `creator`
  async function campaignFixture() {
    const base = await deployFixture();
    await base.crowdfunding.connect(base.creator).createCampaign(GOAL, DURATION);
    const c = await base.crowdfunding.getCampaign(1);
    return { ...base, campaignId: 1n, deadline: c.deadline };
  }

  // Campaign #1 that reached its goal; deadline NOT passed yet
  async function fundedFixture() {
    const base = await campaignFixture();
    await base.crowdfunding.connect(base.alice).contribute(1, { value: ethers.parseEther("6") });
    await base.crowdfunding.connect(base.bob).contribute(1, { value: ethers.parseEther("5") });
    return base;
  }

  // Campaign #1 that reached its goal AND whose deadline passed
  async function successfulFixture() {
    const base = await fundedFixture();
    await time.increaseTo(base.deadline);
    return base;
  }

  // Campaign #1 that missed its goal AND whose deadline passed
  async function failedFixture() {
    const base = await campaignFixture();
    await base.crowdfunding.connect(base.alice).contribute(1, { value: ethers.parseEther("2") });
    await base.crowdfunding.connect(base.bob).contribute(1, { value: ethers.parseEther("3") });
    await time.increaseTo(base.deadline);
    return base;
  }

  // ---------------------------------------------------------------
  describe("Deployment", function () {
    it("starts with zero campaigns and expected duration limits", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      expect(await crowdfunding.campaignCount()).to.equal(0n);
      expect(await crowdfunding.MIN_DURATION()).to.equal(60n);
      expect(await crowdfunding.MAX_DURATION()).to.equal(365n * 24n * 60n * 60n);
    });
  });

  // ---------------------------------------------------------------
  describe("Create campaign", function () {
    it("creates a campaign with the correct data", async function () {
      const { crowdfunding, creator } = await loadFixture(deployFixture);
      const tx = await crowdfunding.connect(creator).createCampaign(GOAL, DURATION);
      const block = await ethers.provider.getBlock(tx.blockNumber);
      const expectedDeadline = BigInt(block.timestamp + DURATION);

      const c = await crowdfunding.getCampaign(1);
      expect(c.creator).to.equal(creator.address);
      expect(c.goal).to.equal(GOAL);
      expect(c.deadline).to.equal(expectedDeadline);
      expect(c.totalRaised).to.equal(0n);
      expect(c.withdrawn).to.equal(false);
      expect(c.status).to.equal(Status.Active);
      expect(await crowdfunding.campaignCount()).to.equal(1n);
    });

    it("emits CampaignCreated", async function () {
      const { crowdfunding, creator } = await loadFixture(deployFixture);
      const nextTs = (await time.latest()) + 10;
      await time.setNextBlockTimestamp(nextTs);
      await expect(crowdfunding.connect(creator).createCampaign(GOAL, DURATION))
        .to.emit(crowdfunding, "CampaignCreated")
        .withArgs(1n, creator.address, GOAL, BigInt(nextTs + DURATION));
    });

    it("assigns unique, incrementing IDs to different creators", async function () {
      const { crowdfunding, creator, alice } = await loadFixture(deployFixture);
      await crowdfunding.connect(creator).createCampaign(GOAL, DURATION);
      await crowdfunding.connect(alice).createCampaign(GOAL * 2n, DURATION * 2);
      expect(await crowdfunding.campaignCount()).to.equal(2n);
      expect((await crowdfunding.getCampaign(1)).creator).to.equal(creator.address);
      expect((await crowdfunding.getCampaign(2)).creator).to.equal(alice.address);
      expect((await crowdfunding.getCampaign(2)).goal).to.equal(GOAL * 2n);
    });

    it("rejects a zero goal", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      await expect(crowdfunding.createCampaign(0, DURATION)).to.be.revertedWithCustomError(crowdfunding, "InvalidGoal");
    });

    it("rejects a duration that is too short", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      await expect(crowdfunding.createCampaign(GOAL, 0)).to.be.revertedWithCustomError(crowdfunding, "InvalidDuration");
      await expect(crowdfunding.createCampaign(GOAL, 59)).to.be.revertedWithCustomError(crowdfunding, "InvalidDuration");
    });

    it("rejects a duration that is too long", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      const tooLong = 365 * 24 * 60 * 60 + 1;
      await expect(crowdfunding.createCampaign(GOAL, tooLong)).to.be.revertedWithCustomError(crowdfunding, "InvalidDuration");
    });

    it("accepts the minimum and maximum durations", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      await crowdfunding.createCampaign(GOAL, 60);
      await crowdfunding.createCampaign(GOAL, 365 * 24 * 60 * 60);
      expect(await crowdfunding.campaignCount()).to.equal(2n);
    });
  });

  // ---------------------------------------------------------------
  describe("Contribute", function () {
    it("accepts a contribution and updates records, balance and event", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      const amount = ethers.parseEther("1");

      await expect(crowdfunding.connect(alice).contribute(1, { value: amount }))
        .to.emit(crowdfunding, "ContributionReceived")
        .withArgs(1n, alice.address, amount, amount);

      expect(await crowdfunding.getContribution(1, alice.address)).to.equal(amount);
      expect((await crowdfunding.getCampaign(1)).totalRaised).to.equal(amount);
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(amount);
    });

    it("changes the contributor and contract balances correctly", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      const amount = ethers.parseEther("2");
      await expect(crowdfunding.connect(alice).contribute(1, { value: amount })).to.changeEtherBalances(
        [alice, crowdfunding],
        [-amount, amount]
      );
    });

    it("accumulates multiple contributions from the same user", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("2.5") });
      expect(await crowdfunding.getContribution(1, alice.address)).to.equal(ethers.parseEther("3.5"));
      expect((await crowdfunding.getCampaign(1)).totalRaised).to.equal(ethers.parseEther("3.5"));
    });

    it("tracks contributions from different users separately", async function () {
      const { crowdfunding, alice, bob, carol } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await crowdfunding.connect(bob).contribute(1, { value: ethers.parseEther("2") });
      await crowdfunding.connect(carol).contribute(1, { value: ethers.parseEther("3") });

      expect(await crowdfunding.getContribution(1, alice.address)).to.equal(ethers.parseEther("1"));
      expect(await crowdfunding.getContribution(1, bob.address)).to.equal(ethers.parseEther("2"));
      expect(await crowdfunding.getContribution(1, carol.address)).to.equal(ethers.parseEther("3"));
      expect((await crowdfunding.getCampaign(1)).totalRaised).to.equal(ethers.parseEther("6"));
    });

    it("keeps contributions to different campaigns separate", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).createCampaign(GOAL, DURATION); // campaign 2
      await crowdfunding.connect(alice).contribute(1, { value: 100n });
      await crowdfunding.connect(alice).contribute(2, { value: 200n });
      expect(await crowdfunding.getContribution(1, alice.address)).to.equal(100n);
      expect(await crowdfunding.getContribution(2, alice.address)).to.equal(200n);
    });

    it("rejects zero-value contributions", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await expect(crowdfunding.connect(alice).contribute(1, { value: 0 })).to.be.revertedWithCustomError(
        crowdfunding,
        "ZeroContribution"
      );
    });

    it("rejects contributions after the deadline", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(alice).contribute(1, { value: 1n })).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignEnded"
      );
    });

    it("accepts contributions right before the deadline", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      await time.setNextBlockTimestamp(deadline - 1n);
      await expect(crowdfunding.connect(alice).contribute(1, { value: 1n })).to.not.be.reverted;
    });

    it("rejects contributions to non-existent campaigns", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await expect(crowdfunding.connect(alice).contribute(0, { value: 1n })).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignDoesNotExist"
      );
      await expect(crowdfunding.connect(alice).contribute(99, { value: 1n })).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignDoesNotExist"
      );
    });

    it("allows over-funding before the deadline", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: GOAL * 2n });
      expect((await crowdfunding.getCampaign(1)).totalRaised).to.equal(GOAL * 2n);
    });

    it("rejects plain ETH transfers (no receive/fallback)", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await expect(alice.sendTransaction({ to: await crowdfunding.getAddress(), value: 1n })).to.be.reverted;
    });
  });

  // ---------------------------------------------------------------
  describe("Campaign status", function () {
    it("is Active before the deadline (even when the goal is reached)", async function () {
      const { crowdfunding } = await loadFixture(fundedFixture);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Active);
    });

    it("is Successful after the deadline when the goal is reached", async function () {
      const { crowdfunding } = await loadFixture(successfulFixture);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Successful);
      expect((await crowdfunding.getCampaign(1)).status).to.equal(Status.Successful);
    });

    it("is Failed after the deadline when the goal is missed", async function () {
      const { crowdfunding } = await loadFixture(failedFixture);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Failed);
    });

    it("is Successful when raised exactly equals the goal", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: GOAL });
      await time.increaseTo(deadline);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Successful);
    });

    it("reverts view calls for unknown campaigns", async function () {
      const { crowdfunding } = await loadFixture(campaignFixture);
      await expect(crowdfunding.getCampaign(5)).to.be.revertedWithCustomError(crowdfunding, "CampaignDoesNotExist");
      await expect(crowdfunding.getStatus(5)).to.be.revertedWithCustomError(crowdfunding, "CampaignDoesNotExist");
      await expect(crowdfunding.getContribution(5, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignDoesNotExist"
      );
    });
  });

  // ---------------------------------------------------------------
  describe("Withdraw funds", function () {
    it("lets the creator withdraw after a successful campaign", async function () {
      const { crowdfunding, creator } = await loadFixture(successfulFixture);
      const total = ethers.parseEther("11");

      await expect(crowdfunding.connect(creator).withdrawFunds(1))
        .to.emit(crowdfunding, "FundsWithdrawn")
        .withArgs(1n, creator.address, total);

      expect((await crowdfunding.getCampaign(1)).withdrawn).to.equal(true);
    });

    it("moves the correct amount of ETH", async function () {
      const { crowdfunding, creator } = await loadFixture(successfulFixture);
      const total = ethers.parseEther("11");
      await expect(crowdfunding.connect(creator).withdrawFunds(1)).to.changeEtherBalances(
        [crowdfunding, creator],
        [-total, total]
      );
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(0n);
    });

    it("rejects withdrawal by a non-creator", async function () {
      const { crowdfunding, stranger, alice } = await loadFixture(successfulFixture);
      await expect(crowdfunding.connect(stranger).withdrawFunds(1)).to.be.revertedWithCustomError(crowdfunding, "NotCreator");
      await expect(crowdfunding.connect(alice).withdrawFunds(1)).to.be.revertedWithCustomError(crowdfunding, "NotCreator");
    });

    it("rejects withdrawal before the deadline even if the goal is reached", async function () {
      const { crowdfunding, creator } = await loadFixture(fundedFixture);
      await expect(crowdfunding.connect(creator).withdrawFunds(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignNotEnded"
      );
    });

    it("rejects withdrawal when the goal is not reached", async function () {
      const { crowdfunding, creator } = await loadFixture(failedFixture);
      await expect(crowdfunding.connect(creator).withdrawFunds(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "GoalNotReached"
      );
    });

    it("prevents duplicate withdrawals", async function () {
      const { crowdfunding, creator } = await loadFixture(successfulFixture);
      await crowdfunding.connect(creator).withdrawFunds(1);
      await expect(crowdfunding.connect(creator).withdrawFunds(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "AlreadyWithdrawn"
      );
    });

    it("does not let one campaign's withdrawal touch another campaign's funds", async function () {
      const { crowdfunding, creator, alice, bob, deadline } = await loadFixture(campaignFixture);
      await crowdfunding.connect(bob).createCampaign(GOAL, DURATION); // campaign 2 (never funded)
      await crowdfunding.connect(alice).contribute(1, { value: GOAL });
      await crowdfunding.connect(alice).contribute(2, { value: 1n });
      await time.increaseTo(deadline + 10n);
      await crowdfunding.connect(creator).withdrawFunds(1);
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(1n);
    });

    it("rejects withdrawal from a non-existent campaign", async function () {
      const { crowdfunding, creator } = await loadFixture(successfulFixture);
      await expect(crowdfunding.connect(creator).withdrawFunds(2)).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignDoesNotExist"
      );
    });

    it("blocks refunds once the campaign succeeded", async function () {
      const { crowdfunding, alice } = await loadFixture(successfulFixture);
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.be.revertedWithCustomError(crowdfunding, "GoalReached");
    });
  });

  // ---------------------------------------------------------------
  describe("Claim refund", function () {
    it("refunds a contributor after a failed campaign", async function () {
      const { crowdfunding, alice } = await loadFixture(failedFixture);
      const amount = ethers.parseEther("2");

      await expect(crowdfunding.connect(alice).claimRefund(1))
        .to.emit(crowdfunding, "RefundClaimed")
        .withArgs(1n, alice.address, amount);

      expect(await crowdfunding.getContribution(1, alice.address)).to.equal(0n);
    });

    it("moves the correct amount of ETH", async function () {
      const { crowdfunding, bob } = await loadFixture(failedFixture);
      const amount = ethers.parseEther("3");
      await expect(crowdfunding.connect(bob).claimRefund(1)).to.changeEtherBalances(
        [crowdfunding, bob],
        [-amount, amount]
      );
    });

    it("lets every contributor refund independently and empties the contract", async function () {
      const { crowdfunding, alice, bob } = await loadFixture(failedFixture);
      await crowdfunding.connect(alice).claimRefund(1);
      await crowdfunding.connect(bob).claimRefund(1);
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(0n);
    });

    it("refunds the SUM of multiple contributions", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1.5") });
      await time.increaseTo(deadline);
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.changeEtherBalance(alice, ethers.parseEther("2.5"));
    });

    it("rejects refunds before the deadline", async function () {
      const { crowdfunding, alice } = await loadFixture(campaignFixture);
      await crowdfunding.connect(alice).contribute(1, { value: 1n });
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignNotEnded"
      );
    });

    it("prevents duplicate refunds", async function () {
      const { crowdfunding, alice } = await loadFixture(failedFixture);
      await crowdfunding.connect(alice).claimRefund(1);
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "NothingToRefund"
      );
    });

    it("rejects refunds for accounts that never contributed", async function () {
      const { crowdfunding, stranger } = await loadFixture(failedFixture);
      await expect(crowdfunding.connect(stranger).claimRefund(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "NothingToRefund"
      );
    });

    it("keeps totalRaised as a historical record and status Failed after refunds", async function () {
      const { crowdfunding, alice } = await loadFixture(failedFixture);
      await crowdfunding.connect(alice).claimRefund(1);
      const c = await crowdfunding.getCampaign(1);
      expect(c.totalRaised).to.equal(ethers.parseEther("5"));
      expect(c.status).to.equal(Status.Failed);
    });

    it("rejects refunds from a non-existent campaign", async function () {
      const { crowdfunding, alice } = await loadFixture(failedFixture);
      await expect(crowdfunding.connect(alice).claimRefund(7)).to.be.revertedWithCustomError(
        crowdfunding,
        "CampaignDoesNotExist"
      );
    });

    it("a campaign nobody contributed to fails with nothing to refund", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      await time.increaseTo(deadline);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Failed);
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.be.revertedWithCustomError(
        crowdfunding,
        "NothingToRefund"
      );
    });
  });

  // ---------------------------------------------------------------
  describe("Reentrancy and failed transfers", function () {
    it("blocks re-entrant refund attempts (only one refund is paid)", async function () {
      const { crowdfunding, alice, deadline } = await loadFixture(campaignFixture);
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await crowdfunding.getAddress());

      // Honest user and attacker both fund the same failing campaign
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("3") });
      await attacker.contribute(1, { value: ethers.parseEther("1") });
      await time.increaseTo(deadline);

      const attackerAddr = await attacker.getAddress();
      await attacker.attackRefund();

      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      // Attacker only got its own 1 ETH back; alice's 3 ETH is still safe
      expect(await ethers.provider.getBalance(attackerAddr)).to.equal(ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(ethers.parseEther("3"));
      expect(await crowdfunding.getContribution(1, attackerAddr)).to.equal(0n);

      // Alice can still refund fully
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.changeEtherBalance(alice, ethers.parseEther("3"));
    });

    it("blocks re-entrant withdrawal attempts (only one payout)", async function () {
      const { crowdfunding, alice } = await loadFixture(deployFixture);
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await crowdfunding.getAddress());

      await attacker.createCampaign(ethers.parseEther("2"), DURATION); // attacker is creator
      const id = await attacker.campaignId();
      await crowdfunding.connect(alice).contribute(id, { value: ethers.parseEther("2") });
      // A second campaign keeps extra ETH in the contract that a re-entrant call could steal
      await crowdfunding.connect(alice).createCampaign(GOAL, DURATION);
      await crowdfunding.connect(alice).contribute(2, { value: ethers.parseEther("1") });

      await time.increase(DURATION + 1);
      await attacker.attackWithdrawFunds();

      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      expect(await ethers.provider.getBalance(await attacker.getAddress())).to.equal(ethers.parseEther("2"));
      expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(ethers.parseEther("1"));
    });

    it("reverts with TransferFailed when the creator cannot receive ETH", async function () {
      const { crowdfunding, alice } = await loadFixture(deployFixture);
      const Reject = await ethers.getContractFactory("RejectEther");
      const reject = await Reject.deploy();
      const cfAddr = await crowdfunding.getAddress();

      await reject.createCampaign(cfAddr, ethers.parseEther("1"), DURATION);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await time.increase(DURATION + 1);

      await expect(reject.withdraw(cfAddr, 1)).to.be.revertedWithCustomError(crowdfunding, "TransferFailed");
      // State was rolled back: still not withdrawn and funds are safe
      expect((await crowdfunding.getCampaign(1)).withdrawn).to.equal(false);
      expect(await ethers.provider.getBalance(cfAddr)).to.equal(ethers.parseEther("1"));
    });

    it("reverts with TransferFailed when a contributor cannot receive a refund", async function () {
      const { crowdfunding } = await loadFixture(deployFixture);
      const Reject = await ethers.getContractFactory("RejectEther");
      const reject = await Reject.deploy();
      const cfAddr = await crowdfunding.getAddress();

      await crowdfunding.createCampaign(GOAL, DURATION);
      await reject.contribute(cfAddr, 1, { value: ethers.parseEther("1") });
      await time.increase(DURATION + 1);

      await expect(reject.refund(cfAddr, 1)).to.be.revertedWithCustomError(crowdfunding, "TransferFailed");
      // Contribution record restored because the whole transaction reverted
      expect(await crowdfunding.getContribution(1, await reject.getAddress())).to.equal(ethers.parseEther("1"));
    });
  });

  // ---------------------------------------------------------------
  describe("End-to-end scenarios", function () {
    it("full success flow: create -> fund -> wait -> withdraw", async function () {
      const { crowdfunding, creator, alice, bob } = await loadFixture(deployFixture);
      await crowdfunding.connect(creator).createCampaign(ethers.parseEther("5"), 3600);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("3") });
      await crowdfunding.connect(bob).contribute(1, { value: ethers.parseEther("2") });
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Active);

      await time.increase(3600);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Successful);
      await expect(crowdfunding.connect(creator).withdrawFunds(1)).to.changeEtherBalance(
        creator,
        ethers.parseEther("5")
      );
    });

    it("full failure flow: create -> partially fund -> wait -> refunds", async function () {
      const { crowdfunding, creator, alice, bob } = await loadFixture(deployFixture);
      await crowdfunding.connect(creator).createCampaign(ethers.parseEther("5"), 3600);
      await crowdfunding.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await crowdfunding.connect(bob).contribute(1, { value: ethers.parseEther("2") });

      await time.increase(3600);
      expect(await crowdfunding.getStatus(1)).to.equal(Status.Failed);
      await expect(crowdfunding.connect(alice).claimRefund(1)).to.changeEtherBalance(alice, ethers.parseEther("1"));
      await expect(crowdfunding.connect(bob).claimRefund(1)).to.changeEtherBalance(bob, ethers.parseEther("2"));
    });
  });
});
