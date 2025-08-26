import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Conservative EIP-1559 fee settings for Base Sepolia to avoid underpriced replacement errors
  const maxPriorityFeePerGas = ethers.parseUnits("2", "gwei");
  const maxFeePerGas = ethers.parseUnits("100", "gwei");

  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address, { maxPriorityFeePerGas, maxFeePerGas });
  await treasury.waitForDeployment();
  console.log("Treasury:", await treasury.getAddress());

  // Deploy Ticket (treasury wired in constructor)
  const Ticket = await ethers.getContractFactory("Ticket4LifeTicket");
  const ticket = await Ticket.deploy(deployer.address, await treasury.getAddress(), { maxPriorityFeePerGas, maxFeePerGas });
  await ticket.waitForDeployment();
  console.log("Ticket:", await ticket.getAddress());

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(deployer.address, await treasury.getAddress(), { maxPriorityFeePerGas, maxFeePerGas });
  await marketplace.waitForDeployment();
  console.log("Marketplace:", await marketplace.getAddress());

  // Deploy Buyback (90% of mint)
  const mintPrice = ethers.parseEther("0.001");
  const buybackPrice = (mintPrice * 9n) / 10n; // 90%
  const Buyback = await ethers.getContractFactory("Buyback");
  const buyback = await Buyback.deploy(deployer.address, await ticket.getAddress(), await treasury.getAddress(), buybackPrice, { maxPriorityFeePerGas, maxFeePerGas });
  await buyback.waitForDeployment();
  console.log("Buyback:", await buyback.getAddress());

  // Deploy DistributionV1
  const Distribution = await ethers.getContractFactory("DistributionV1");
  const distribution = await Distribution.deploy(deployer.address, await treasury.getAddress(), { maxPriorityFeePerGas, maxFeePerGas });
  await distribution.waitForDeployment();
  console.log("DistributionV1:", await distribution.getAddress());

  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
