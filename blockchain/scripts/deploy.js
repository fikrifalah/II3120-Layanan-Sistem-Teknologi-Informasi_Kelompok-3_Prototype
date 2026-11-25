const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const arbiterAddress =
    process.env.ARBITER_ADDRESS || (signers[1] ? signers[1].address : deployer.address);

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Configured Arbiter address:      ", arbiterAddress);

  // 1. Deploy SIMIDR ERC-20 Token
  const SIMIDR = await hre.ethers.getContractFactory("SIMIDR");
  const simidr = await SIMIDR.deploy();
  await simidr.waitForDeployment();
  const simidrAddress = await simidr.getAddress();
  console.log("SIMIDR deployed to:              ", simidrAddress);

  // 2. Deploy Escrow Contract
  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(simidrAddress, arbiterAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow deployed to:              ", escrowAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
