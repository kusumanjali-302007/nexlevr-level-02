require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { subtask, task } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Optional fallback: compile with the "solc" npm package (solc-js) instead of
// downloading a native compiler. Enable with USE_SOLCJS=true (see README).
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (process.env.USE_SOLCJS === "true") {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: require("solc/package.json").version,
    };
  }
  return runSuper();
});

// Demo helper: jump forward in time on your LOCAL node so a campaign deadline passes.
//   npx hardhat fast-forward --seconds 3600 --network localhost
task("fast-forward", "Moves the local blockchain clock forward and mines a block")
  .addParam("seconds", "How many seconds to jump forward")
  .setAction(async ({ seconds }, hre) => {
    const secs = parseInt(seconds, 10);
    if (!Number.isInteger(secs) || secs <= 0) throw new Error("--seconds must be a positive integer");
    await hre.network.provider.send("evm_increaseTime", [secs]);
    await hre.network.provider.send("evm_mine");
    const block = await hre.ethers.provider.getBlock("latest");
    console.log("Jumped forward " + secs + "s. New block time: " + new Date(block.timestamp * 1000).toISOString());
  });

const { SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    ...(SEPOLIA_RPC_URL && PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [PRIVATE_KEY] } }
      : {}),
  },
};
