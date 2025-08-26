import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const OWNER = process.env.OWNER_ADDRESS || deployer.address;
  const TICKET = process.env.NEXT_PUBLIC_TICKET_ADDRESS || process.env.TICKET_ADDRESS;
  const VRF_COORD = process.env.VRF_COORDINATOR_ADDRESS;
  const VRF_KEY_HASH = process.env.VRF_KEY_HASH as `0x${string}` | undefined;
  const VRF_SUB_ID = process.env.VRF_SUBSCRIPTION_ID ? BigInt(process.env.VRF_SUBSCRIPTION_ID) : undefined;

  if (!TICKET) throw new Error("Missing TICKET address (NEXT_PUBLIC_TICKET_ADDRESS or TICKET_ADDRESS)");
  if (!VRF_COORD || !VRF_KEY_HASH || !VRF_SUB_ID) throw new Error("Missing VRF config (VRF_COORDINATOR_ADDRESS, VRF_KEY_HASH, VRF_SUBSCRIPTION_ID)");

  // Use network fee data with conservative caps to keep costs low on Base Sepolia
  const fee = await ethers.provider.getFeeData();
  let maxPriorityFeePerGas = fee.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei");
  let maxFeePerGas = fee.maxFeePerGas ?? ethers.parseUnits("10", "gwei");
  const cap = ethers.parseUnits("12", "gwei");
  if (maxFeePerGas > cap) maxFeePerGas = cap;
  const tipCap = ethers.parseUnits("1", "gwei");
  if (maxPriorityFeePerGas > tipCap) maxPriorityFeePerGas = tipCap;

  const Quiz = await ethers.getContractFactory("QuizManager");
  console.log("Deploying QuizManager...");
  const quiz = await Quiz.deploy(OWNER, TICKET, VRF_COORD, VRF_KEY_HASH, VRF_SUB_ID, { maxPriorityFeePerGas, maxFeePerGas });
  await quiz.waitForDeployment();
  const addr = await quiz.getAddress();
  console.log("QuizManager deployed:", addr);

  const targetRegistry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  if (targetRegistry && targetRegistry !== "") {
    try {
      const tx = await quiz.setRegistry(targetRegistry, { maxPriorityFeePerGas, maxFeePerGas });
      console.log("setRegistry tx:", tx.hash);
      await tx.wait();
      console.log("Registry set:", targetRegistry);
    } catch (e: any) {
      console.warn("setRegistry at deploy failed:", e?.reason || e?.message || e);
    }
  }

  // print JSON snippet for frontend env
  console.log("\n--- ENV UPDATE ---");
  console.log("NEXT_PUBLIC_QUIZ_ADDRESS=", addr);

  // Try to update frontend .env.local as well
  try {
    const appRoot = path.resolve(__dirname, "../../ticket4life-app");
    const envPath = path.join(appRoot, ".env.local");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const line = `NEXT_PUBLIC_QUIZ_ADDRESS=${addr}`;
    if (/NEXT_PUBLIC_QUIZ_ADDRESS=.*/.test(content)) {
      content = content.replace(/NEXT_PUBLIC_QUIZ_ADDRESS=.*/g, line);
    } else {
      content += (content.endsWith("\n") ? "" : "\n") + line + "\n";
    }
    fs.writeFileSync(envPath, content, "utf8");
    console.log("Updated:", envPath);
  } catch (e) {
    console.warn("Could not update frontend .env.local automatically:", (e as any)?.message || e);
  }

  // Also update contracts/.env for consistency
  try {
    const contractsEnv = path.resolve(__dirname, "../.env");
    let content2 = fs.existsSync(contractsEnv) ? fs.readFileSync(contractsEnv, "utf8") : "";
    const line2 = `NEXT_PUBLIC_QUIZ_ADDRESS=${addr}`;
    if (/NEXT_PUBLIC_QUIZ_ADDRESS=.*/.test(content2)) {
      content2 = content2.replace(/NEXT_PUBLIC_QUIZ_ADDRESS=.*/g, line2);
    } else {
      content2 += (content2.endsWith("\n") ? "" : "\n") + line2 + "\n";
    }
    fs.writeFileSync(contractsEnv, content2, "utf8");
    console.log("Updated:", contractsEnv);
  } catch (e) {
    console.warn("Could not update contracts/.env automatically:", (e as any)?.message || e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
