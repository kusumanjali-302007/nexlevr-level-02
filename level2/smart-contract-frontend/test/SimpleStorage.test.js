const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleStorage", function () {
  let storage, owner, other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SimpleStorage");
    storage = await Factory.deploy();
    await storage.waitForDeployment();
  });

  it("starts at zero", async function () {
    expect(await storage.retrieve()).to.equal(0n);
  });

  it("stores and retrieves a number", async function () {
    await (await storage.store(42)).wait();
    expect(await storage.retrieve()).to.equal(42n);
  });

  it("overwrites the previous value", async function () {
    await (await storage.store(1)).wait();
    await (await storage.store(2)).wait();
    expect(await storage.retrieve()).to.equal(2n);
  });

  it("accepts the maximum uint256 value", async function () {
    const max = ethers.MaxUint256;
    await (await storage.store(max)).wait();
    expect(await storage.retrieve()).to.equal(max);
  });

  it("lets any account store a number", async function () {
    await (await storage.connect(other).store(7)).wait();
    expect(await storage.connect(owner).retrieve()).to.equal(7n);
  });

  it("emits NumberStored with the sender and value", async function () {
    await expect(storage.connect(other).store(99))
      .to.emit(storage, "NumberStored")
      .withArgs(other.address, 99n);
  });
});
