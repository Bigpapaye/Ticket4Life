import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const COORD_ABI = [
  "function addConsumer(uint256 subId, address consumer) external"
];

async function main() {
  const [signer] = await ethers.getSigners();
  const coordAddr = process.env.VRF_COORDINATOR_ADDRESS as string;
  const subIdStr = process.env.VRF_SUBSCRIPTION_ID as string;
  const quiz = (process.env.NEXT_PUBLIC_QUIZ_ADDRESS || process.env.QUIZ_ADDRESS) as string;
  if (!coordAddr || !subIdStr || !quiz) throw new Error("Missing VRF_COORDINATOR_ADDRESS or VRF_SUBSCRIPTION_ID or QUIZ address");
  const subId = BigInt(subIdStr);

  const coord = new ethers.Contract(coordAddr, COORD_ABI, signer);
  console.log("Adding consumer:", quiz, "to subId:", subId.toString());
  const tx = await coord.addConsumer(subId, quiz);
  console.log("addConsumer tx:", tx.hash);
  await tx.wait();
  console.log("Consumer added:", quiz);
}

main().catch((e)=>{console.error(e); process.exit(1)});
