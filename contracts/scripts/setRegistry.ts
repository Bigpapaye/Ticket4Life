import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  let quizAddr = process.env.NEXT_PUBLIC_QUIZ_ADDRESS as string | undefined;
  let registryAddr = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as string | undefined;
  if (!quizAddr || !registryAddr) {
    try {
      const appRoot = path.resolve(__dirname, "../../ticket4life-app");
      const envPath = path.join(appRoot, ".env.local");
      const content = fs.readFileSync(envPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^(NEXT_PUBLIC_QUIZ_ADDRESS|NEXT_PUBLIC_REGISTRY_ADDRESS)=(.*)$/);
        if (m) {
          if (m[1] === 'NEXT_PUBLIC_QUIZ_ADDRESS') quizAddr = m[2].trim();
          if (m[1] === 'NEXT_PUBLIC_REGISTRY_ADDRESS') registryAddr = m[2].trim();
        }
      }
    } catch {}
  }
  if (!quizAddr || !registryAddr) throw new Error("Missing NEXT_PUBLIC_QUIZ_ADDRESS or NEXT_PUBLIC_REGISTRY_ADDRESS");
  const Quiz = await ethers.getContractFactory("QuizManager");
  const quiz = Quiz.attach(quizAddr);
  console.log("Quiz:", quizAddr);
  console.log("Registry (target):", registryAddr);
  let owner: string | null = null;
  let current: string | null = null;
  try { owner = await quiz.owner(); } catch (e:any) { console.warn("Warn: owner() read failed:", e?.reason || e?.message || e); }
  try { current = await quiz.registry(); } catch (e:any) { console.warn("Warn: registry() read failed:", e?.reason || e?.message || e); }
  if (owner) console.log("Owner(on-chain):", owner);
  if (current) console.log("Current registry(on-chain):", current);
  if (owner && owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not owner. Deployer=${deployer.address} Owner=${owner}`);
  }
  if (current && current.toLowerCase() === registryAddr.toLowerCase()) {
    console.log("Already linked. Nothing to do.");
    return;
  }
  try {
    const tx = await quiz.setRegistry(registryAddr);
    console.log("setRegistry tx:", tx.hash);
    await tx.wait();
    console.log("Registry set:", registryAddr);
  } catch (e:any) {
    console.error("setRegistry failed:", e?.reason || e?.message || e);
    throw e;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
