// Deploys Crowdfunding and writes the address + ABI for the frontend.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying with account:", deployer.address);
  console.log("Network:", hre.network.name, "(chainId " + network.chainId + ")");

  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy();
  await crowdfunding.waitForDeployment();
  const address = await crowdfunding.getAddress();

  console.log("\n✅ Crowdfunding deployed to:", address);
  console.log("⚠️  On the local Hardhat network this address is only valid while that");
  console.log("    node keeps running. Restart the node => deploy again.\n");

  // Save config for the frontend (public/contract-config.json)
  const artifact = await hre.artifacts.readArtifact("Crowdfunding");
  const config = {
    address,
    chainId: Number(network.chainId),
    network: hre.network.name,
    rpcUrl: hre.network.name === "localhost" ? "http://127.0.0.1:8545" : undefined,
    abi: artifact.abi,
  };
  const publicDir = path.join(__dirname, "..", "public");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "contract-config.json"), JSON.stringify(config, null, 2));
  console.log("Saved frontend config to public/contract-config.json");

  // Also keep a record in deployments/
  const depDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(depDir, { recursive: true });
  fs.writeFileSync(
    path.join(depDir, hre.network.name + ".json"),
    JSON.stringify({ address, chainId: config.chainId, deployer: deployer.address }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
