import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ticket = process.env.NEXT_PUBLIC_TICKET_ADDRESS;
  const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (!ticket) throw new Error("NEXT_PUBLIC_TICKET_ADDRESS not set");
  if (!treasury) throw new Error("NEXT_PUBLIC_TREASURY_ADDRESS not set");

  const mintPrice = ethers.parseEther("0.001");
  const buybackPrice = (mintPrice * 9n) / 10n; // 90%

  const Buyback = await ethers.getContractFactory("Buyback");
  const buyback = await Buyback.deploy(deployer.address, ticket, treasury, buybackPrice);
  await buyback.waitForDeployment();
  const addr = await buyback.getAddress();
  console.log("NEW_BUYBACK:", addr);
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
