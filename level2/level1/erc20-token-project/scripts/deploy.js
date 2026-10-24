// Deployment script for SimpleToken (Campus Token, CAMP).
//
// Run it with:   npm run deploy:localhost
// (the local node must already be running in another terminal: npm run node)
//
// Nothing here is hardcoded: the contract address and transaction hash are
// read from the blockchain after the deployment really happens.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;

  // 1. The deployer is the first account that Hardhat gives us.
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();

  console.log("=======================================================");
  console.log(" Deploying SimpleToken (Campus Token)");
  console.log("=======================================================");
  console.log("Network          :", network.name, `(chain ID ${chainId})`);
  console.log("Deployer wallet  :", deployer.address);

  // 2. Get the "factory": it knows how to create the contract from compiled code.
  const SimpleToken = await ethers.getContractFactory("SimpleToken");

  // 3. Send the deployment transaction. The constructor mints the supply to us.
  console.log("\nSending deployment transaction...");
  const token = await SimpleToken.deploy();
  const deploymentTx = token.deploymentTransaction();
  console.log("Transaction hash :", deploymentTx.hash);

  // 4. Wait until the transaction is mined into a block (the confirmation).
  await token.waitForDeployment();
  const receipt = await deploymentTx.wait();
  if (receipt.status !== 1) {
    throw new Error("Deployment transaction failed.");
  }

  // 5. Read the REAL address from the blockchain.
  const address = await token.getAddress();
  if (receipt.contractAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Address mismatch between the contract object and the receipt.");
  }

  // 6. Prove that code really exists at that address.
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error("No contract code found at the deployed address.");
  }

  // 7. Ask the deployed contract about itself.
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = Number(await token.decimals());
  const totalSupply = await token.totalSupply();
  const deployerBalance = await token.balanceOf(deployer.address);

  console.log("\n-------------------- DEPLOYMENT RESULT -------------------");
  console.log("Contract address :", address);
  console.log("Deployer wallet  :", deployer.address);
  console.log("Token name       :", name);
  console.log("Token symbol     :", symbol);
  console.log("Decimals         :", decimals);
  console.log("Initial supply   :", ethers.formatUnits(totalSupply, decimals), symbol);
  console.log("Deployer balance :", ethers.formatUnits(deployerBalance, decimals), symbol);
  console.log("Deployment tx    :", deploymentTx.hash);
  console.log("Block number     :", receipt.blockNumber);
  console.log("---------------------------------------------------------");

  // 8. Save the details to a file so you can find the address later.
  const info = {
    network: network.name,
    chainId,
    contractName: "SimpleToken",
    address,
    deployer: deployer.address,
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    name,
    symbol,
    decimals,
    totalSupply: totalSupply.toString(),
    deployedAt: new Date().toISOString(),
  };
  const folder = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
  console.log("\nDetails saved to :", path.relative(process.cwd(), file));

  console.log("\nNext step: import the token into MetaMask using the contract address above.");
}

main().catch((error) => {
  const text = String(error && error.message ? error.message : error);
  if (text.includes("ECONNREFUSED") || text.includes("HH108") || text.includes("Cannot connect")) {
    console.error("\nCould not connect to the local node.");
    console.error("Open a SECOND terminal, run:  npm run node");
    console.error("Keep it running, then run this deploy command again.\n");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
