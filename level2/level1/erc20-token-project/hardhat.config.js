// Hardhat configuration file.
// It tells Hardhat which Solidity version to use and how to reach the local network.

require("@nomicfoundation/hardhat-toolbox"); // adds ethers.js, chai matchers, test helpers
require("dotenv").config();                  // reads optional settings from a .env file

// Address of the local node started with "npm run node".
// You normally do NOT need a .env file for this project.
const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",

  networks: {
    // Built-in in-memory network. Used automatically by "npm test".
    hardhat: {
      chainId: 31337,
    },
    // The node you start yourself with "npm run node" (used by MetaMask too).
    localhost: {
      url: LOCAL_RPC_URL,
      chainId: 31337,
    },
  },
};
