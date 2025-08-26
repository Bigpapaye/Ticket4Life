import { ethers } from "hardhat";

async function main() {
  // Buyback address from latest deployment
  const BUYBACK = process.env.BUYBACK_ADDRESS || "0xC128767a82a5f0157Ca47Ff2C7eF46d23E9518E0";
  const amount = process.env.AMOUNT_ETH || "0.01"; // ETH

  const [signer] = await ethers.getSigners();
  console.log("Funder:", await signer.getAddress());
  console.log("Sending", amount, "ETH to", BUYBACK);

  const tx = await signer.sendTransaction({ to: BUYBACK, value: ethers.parseEther(amount) });
  console.log("tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("confirmed in block", receipt?.blockNumber);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
