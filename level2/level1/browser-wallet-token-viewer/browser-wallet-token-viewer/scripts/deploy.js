// Deploys MyToken and saves the new address into public/config.js
// Usage:  npm run deploy:local     (Hardhat node must be running)
//         npm run deploy:sepolia   (needs .env values)
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const INITIAL_SUPPLY = 1_000_000n; // whole tokens, sent to the deployer

async function main() {
  const { ethers, network } = hre;

  if (network.name === "hardhat") {
    console.log(
      "\nYou ran the deploy on Hardhat's temporary in-memory network.\n" +
        "That network disappears when this command ends, so the address would be useless.\n" +
        "Start a node with 'npm run node' in another terminal, then run 'npm run deploy:local'.\n"
    );
    process.exitCode = 1;
    return;
  }

  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Network:  ${network.name} (chain ID ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const token = await ethers.deployContract("MyToken", [INITIAL_SUPPLY]);
  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log(`\nMyToken deployed to: ${address}`);
  console.log(`Initial supply: ${INITIAL_SUPPLY.toString()} MTK -> ${deployer.address}`);

  // Write the address into public/config.js for this chain ID
  const configPath = path.join(__dirname, "..", "public", "config.js");
  const original = fs.readFileSync(configPath, "utf8");
  const pattern = new RegExp(`(\\b${chainId}\\s*:\\s*)"[^"]*"`);

  if (pattern.test(original)) {
    fs.writeFileSync(configPath, original.replace(pattern, `$1"${address}"`));
    console.log(`Saved the address to public/config.js (chain ID ${chainId}).`);
  } else {
    console.log(
      `\nCould not find a tokenAddresses entry for chain ID ${chainId} in public/config.js.\n` +
        `Add this line inside tokenAddresses yourself:\n    ${chainId}: "${address}",`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
