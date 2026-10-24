// Unit tests for SimpleToken (Campus Token, CAMP).
// They run on Hardhat's built-in in-memory blockchain: no node, wallet or ETH needed.
// Run them with:  npm test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SimpleToken (Campus Token)", function () {
  const DECIMALS = 18;
  // 1,000,000 tokens written in the smallest unit (1 token = 10^18 units).
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", DECIMALS);

  // A "fixture" deploys a fresh contract. loadFixture reuses a snapshot so
  // every test starts from the same clean state (and runs fast).
  async function deployTokenFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    const token = await SimpleToken.deploy();
    await token.waitForDeployment();
    return { token, owner, alice, bob };
  }

  describe("Token details", function () {
    it("has the name 'Campus Token'", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Campus Token");
    });

    it("has the symbol 'CAMP'", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.symbol()).to.equal("CAMP");
    });

    it("uses 18 decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("Initial supply", function () {
    it("has a total supply of 1,000,000 CAMP", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("exposes the same value in the INITIAL_SUPPLY constant", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.INITIAL_SUPPLY()).to.equal(INITIAL_SUPPLY);
    });

    it("emitted a Transfer event from the zero address to the deployer when minting", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const filter = token.filters.Transfer(ethers.ZeroAddress, owner.address);
      const events = await token.queryFilter(filter);
      expect(events.length).to.equal(1);
      expect(events[0].args.value).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("Deployer balance", function () {
    it("gives the whole initial supply to the deployer", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("gives other accounts a balance of zero", async function () {
      const { token, alice, bob } = await loadFixture(deployTokenFixture);
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(0);
    });
  });

  describe("Transfers", function () {
    it("moves tokens from the sender to the receiver", async function () {
      const { token, owner, alice } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("100", DECIMALS);

      await token.transfer(alice.address, amount);

      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it("updates both balances correctly", async function () {
      const { token, owner, alice } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("250", DECIMALS);

      await expect(token.transfer(alice.address, amount)).to.changeTokenBalances(
        token,
        [owner, alice],
        [-amount, amount]
      );

      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - amount);
    });

    it("emits a Transfer event with the right details", async function () {
      const { token, owner, alice } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("5", DECIMALS);

      await expect(token.transfer(alice.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, alice.address, amount);
    });

    it("does not change the total supply", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      await token.transfer(alice.address, ethers.parseUnits("1000", DECIMALS));
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("lets a receiver pass tokens on to someone else", async function () {
      const { token, alice, bob } = await loadFixture(deployTokenFixture);
      const first = ethers.parseUnits("100", DECIMALS);
      const second = ethers.parseUnits("40", DECIMALS);

      await token.transfer(alice.address, first);
      await token.connect(alice).transfer(bob.address, second);

      expect(await token.balanceOf(alice.address)).to.equal(first - second);
      expect(await token.balanceOf(bob.address)).to.equal(second);
    });

    it("allows sending the sender's entire balance", async function () {
      const { token, owner, alice } = await loadFixture(deployTokenFixture);

      await token.transfer(alice.address, INITIAL_SUPPLY);

      expect(await token.balanceOf(owner.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(INITIAL_SUPPLY);
    });

    it("allows a transfer of zero tokens", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      await expect(token.transfer(alice.address, 0)).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });
  });

  describe("Failed transfers", function () {
    it("fails when the sender has no tokens", async function () {
      const { token, alice, bob } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseUnits("1", DECIMALS);

      await expect(token.connect(alice).transfer(bob.address, amount))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, 0, amount);
    });

    it("fails when the sender tries to send more than they own", async function () {
      const { token, owner, alice } = await loadFixture(deployTokenFixture);
      const tooMuch = INITIAL_SUPPLY + 1n;

      await expect(token.transfer(alice.address, tooMuch))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(owner.address, INITIAL_SUPPLY, tooMuch);
    });

    it("fails when a receiver tries to send more than they received", async function () {
      const { token, alice, bob } = await loadFixture(deployTokenFixture);
      const received = ethers.parseUnits("10", DECIMALS);
      const tooMuch = ethers.parseUnits("11", DECIMALS);

      await token.transfer(alice.address, received);

      await expect(token.connect(alice).transfer(bob.address, tooMuch))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, received, tooMuch);
    });

    it("leaves all balances unchanged after a failed transfer", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseUnits("1", DECIMALS))
      ).to.be.reverted;

      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(0);
    });

    it("refuses to send tokens to the zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      await expect(token.transfer(ethers.ZeroAddress, 1))
        .to.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
    });
  });

  describe("Allowances (approve and transferFrom)", function () {
    it("lets an approved spender move tokens on the owner's behalf", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployTokenFixture);
      const allowance = ethers.parseUnits("100", DECIMALS);
      const spend = ethers.parseUnits("60", DECIMALS);

      await token.approve(alice.address, allowance);
      expect(await token.allowance(owner.address, alice.address)).to.equal(allowance);

      await token.connect(alice).transferFrom(owner.address, bob.address, spend);

      expect(await token.balanceOf(bob.address)).to.equal(spend);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - spend);
      expect(await token.allowance(owner.address, alice.address)).to.equal(allowance - spend);
    });

    it("fails when the spender uses more than the allowance", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployTokenFixture);
      const allowance = ethers.parseUnits("10", DECIMALS);
      const tooMuch = ethers.parseUnits("11", DECIMALS);

      await token.approve(alice.address, allowance);

      await expect(token.connect(alice).transferFrom(owner.address, bob.address, tooMuch))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance")
        .withArgs(alice.address, allowance, tooMuch);
    });
  });

  describe("Security design", function () {
    it("has no mint function, so the supply is fixed forever", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const hasMint = token.interface.fragments.some(
        (f) => f.type === "function" && f.name === "mint"
      );
      expect(hasMint).to.equal(false);
    });

    it("has no owner function, so nobody has special admin powers", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const hasOwner = token.interface.fragments.some(
        (f) => f.type === "function" && f.name === "owner"
      );
      expect(hasOwner).to.equal(false);
    });
  });
});
