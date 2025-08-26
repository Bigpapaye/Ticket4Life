import { ethers } from "hardhat";

async function main() {
  const TICKET = process.env.TICKET_ADDRESS || "0x551fD3061D56657761Dae83930ab93a3E15d099a";
  const MARKETPLACE = process.env.MARKETPLACE_ADDRESS || "0x99Fa3014BC00dCdf3D2c351827aCC98075b6a0a1";
  const SELLER = process.env.SELLER || "0x4999BCb319C604FF5Dc5dFE29159fEb4A091f7dE";
  const TOKEN_ID = BigInt(process.env.TOKEN_ID || "1");
  const PRICE_ETH = process.env.PRICE_ETH || "0.002";

  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Buyer:", me);

  const mp = await ethers.getContractAt("Marketplace", MARKETPLACE, signer);

  console.log("Buying token", TOKEN_ID.toString(), "from", SELLER, "for", PRICE_ETH, "ETH");
  const tx = await mp.buy(TICKET, TOKEN_ID, SELLER, { value: ethers.parseEther(PRICE_ETH) });
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  console.log("confirmed in block", rc?.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });
