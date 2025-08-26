import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  let registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as string | undefined;
  if (!registryAddr) {
    try {
      const appRoot = path.resolve(__dirname, "../../ticket4life-app");
      const envPath = path.join(appRoot, ".env.local");
      const content = fs.readFileSync(envPath, "utf8");
      const m = content.match(/NEXT_PUBLIC_REGISTRY_ADDRESS=(.*)/);
      if (m) registryAddr = m[1].trim();
    } catch {}
  }
  if (!registryAddr) throw new Error("Missing NEXT_PUBLIC_REGISTRY_ADDRESS");
  const QuizRegistry = await ethers.getContractFactory("QuizRegistry");
  const registry = QuizRegistry.attach(registryAddr);

  // authorize deployer EOA by default (so admin UI/scripts can write)
  let tx = await registry.setAuthorized(deployer.address, true);
  console.log("Authorize EOA tx:", tx.hash);
  await tx.wait();
  console.log("EOA authorized:", deployer.address);

  const quizAddr = process.env.NEXT_PUBLIC_QUIZ_ADDRESS as string | undefined;
  if (quizAddr) {
    tx = await registry.setAuthorized(quizAddr, true);
    console.log("Authorize QuizManager tx:", tx.hash);
    await tx.wait();
    console.log("QuizManager authorized:", quizAddr);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
