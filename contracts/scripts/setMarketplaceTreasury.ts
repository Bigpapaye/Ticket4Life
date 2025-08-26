import { ethers } from "hardhat";

async function main() {
  const MARKETPLACE = process.env.MARKETPLACE_ADDRESS;
  const NEW_TREASURY = process.env.NEW_TREASURY_ADDRESS;
  if (!MARKETPLACE) throw new Error("MARKETPLACE_ADDRESS not set");
  if (!NEW_TREASURY) throw new Error("NEW_TREASURY_ADDRESS not set");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", await signer.getAddress());

  const abi = ["function setTreasury(address) external"];
  const market = new ethers.Contract(MARKETPLACE, abi, signer);
  const tx = await market.setTreasury(NEW_TREASURY);
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc?.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });
