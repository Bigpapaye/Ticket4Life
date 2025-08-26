import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const maxPriorityFeePerGas = ethers.parseUnits("2", "gwei");
  const maxFeePerGas = ethers.parseUnits("100", "gwei");

  const Quiz = await ethers.getContractFactory("QuizManager");
  const ticketAddress = (process.env.NEXT_PUBLIC_TICKET_ADDRESS || process.env.TICKET_ADDRESS) as string;
  const vrfCoordinator = (process.env.VRF_COORDINATOR_ADDRESS || process.env.VRF_COORDINATOR) as string;
  const vrfKeyHash = process.env.VRF_KEY_HASH as string;
  const vrfSubIdStr = process.env.VRF_SUBSCRIPTION_ID as string;
  const missing: string[] = [];
  if (!ticketAddress) missing.push("NEXT_PUBLIC_TICKET_ADDRESS");
  if (!vrfCoordinator) missing.push("VRF_COORDINATOR_ADDRESS");
  if (!vrfKeyHash) missing.push("VRF_KEY_HASH");
  if (!vrfSubIdStr) missing.push("VRF_SUBSCRIPTION_ID");
  if (missing.length) {
    throw new Error(`Missing VRF env: ${missing.join(", ")}`);
  }
  const vrfSubId = BigInt(vrfSubIdStr);

  const quiz = await Quiz.deploy(deployer.address, ticketAddress, vrfCoordinator, vrfKeyHash as any, vrfSubId, { maxPriorityFeePerGas, maxFeePerGas });
  await quiz.waitForDeployment();
  const addr = await quiz.getAddress();
  console.log("QuizManager:", addr);
  console.log("Set NEXT_PUBLIC_QUIZ_ADDRESS=", addr);

  // Try to update frontend .env.local
  try {
    const appRoot = path.resolve(__dirname, "../../ticket4life-app");
    const envPath = path.join(appRoot, ".env.local");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf8");
      const hasLine = /NEXT_PUBLIC_QUIZ_ADDRESS=.+/g.test(content);
      if (hasLine) {
        content = content.replace(/NEXT_PUBLIC_QUIZ_ADDRESS=.*/g, `NEXT_PUBLIC_QUIZ_ADDRESS=${addr}`);
      } else {
        content += (content.endsWith("\n") ? "" : "\n") + `NEXT_PUBLIC_QUIZ_ADDRESS=${addr}\n`;
      }
    } else {
      content = `NEXT_PUBLIC_QUIZ_ADDRESS=${addr}\n`;
    }
    fs.writeFileSync(envPath, content, "utf8");
    console.log("Updated:", envPath);
  } catch (e) {
    console.warn("Could not update frontend .env.local automatically:", (e as any)?.message || e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
