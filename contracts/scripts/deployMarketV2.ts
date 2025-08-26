import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  const ticket = process.env.NEXT_PUBLIC_TICKET_ADDRESS;

  if (!treasury || !ticket) {
    throw new Error("Missing NEXT_PUBLIC_TREASURY_ADDRESS or NEXT_PUBLIC_TICKET_ADDRESS in environment");
  }

  const maxPriorityFeePerGas = ethers.parseUnits("2", "gwei");
  const maxFeePerGas = ethers.parseUnits("100", "gwei");

  const Factory = await ethers.getContractFactory("MarketplaceV2");
  const c = await Factory.deploy(deployer.address, treasury, ticket, { maxPriorityFeePerGas, maxFeePerGas });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("MarketplaceV2 deployed at:", addr);

  // Useful env line for frontend
  console.log("NEXT_PUBLIC_MARKETPLACEV2_ADDRESS=", addr);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
