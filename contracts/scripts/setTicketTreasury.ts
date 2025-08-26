import { ethers } from "hardhat";

async function main() {
  const TICKET = process.env.TICKET_ADDRESS;
  const NEW_TREASURY = process.env.NEW_TREASURY_ADDRESS;
  if (!TICKET) throw new Error("TICKET_ADDRESS not set");
  if (!NEW_TREASURY) throw new Error("NEW_TREASURY_ADDRESS not set");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", await signer.getAddress());

  const abi = ["function setTreasury(address) external"];
  const ticket = new ethers.Contract(TICKET, abi, signer);
  const tx = await ticket.setTreasury(NEW_TREASURY);
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc?.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });
