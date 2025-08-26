import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (!treasury) {
    throw new Error("NEXT_PUBLIC_TREASURY_ADDRESS not set in .env");
  }

  const Ticket = await ethers.getContractFactory("Ticket4LifeTicket");
  const ticket = await Ticket.deploy(deployer.address, treasury);
  await ticket.waitForDeployment();
  const ticketAddr = await ticket.getAddress();
  console.log("NEW_TICKET:", ticketAddr);
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
