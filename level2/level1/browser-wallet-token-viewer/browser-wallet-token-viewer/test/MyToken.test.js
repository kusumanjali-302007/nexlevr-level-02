const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MyToken", function () {
  const INITIAL_SUPPLY = 1_000_000n; // whole tokens

  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();
    const token = await ethers.deployContract("MyToken", [INITIAL_SUPPLY]);
    await token.waitForDeployment();
    return { token, deployer, alice, bob };
  }

  describe("Deployment", function () {
    it("has the expected name, symbol and decimals", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("My Token");
      expect(await token.symbol()).to.equal("MTK");
      expect(await token.decimals()).to.equal(18n);
    });

    it("creates the fixed initial supply", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000", 18));
    });

    it("assigns the whole supply to the deployer", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      expect(await token.balanceOf(deployer.address)).to.equal(await token.totalSupply());
    });

    it("has no mint function (supply is fixed)", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(token.interface.getFunction("mint")).to.equal(null);
    });
  });

  describe("Reading balances", function () {
    it("returns zero for an account that holds nothing", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
    });

    it("updates balanceOf after a transfer", async function () {
      const { token, deployer, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("250", 18);

      await expect(token.transfer(alice.address, amount)).to.changeTokenBalances(
        token,
        [deployer, alice],
        [-amount, amount]
      );
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it("rejects a transfer larger than the sender's balance", async function () {
      const { token, alice, bob } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).transfer(bob.address, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
});
