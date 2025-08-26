import { ethers } from "hardhat";

async function main() {
  console.log("Deploying QuizManager v2…");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const QuizManager = await ethers.getContractFactory("QuizManager");
  const quiz = await QuizManager.deploy(deployer.address);
  await quiz.waitForDeployment();
  const addr = await quiz.getAddress();

  console.log("QuizManager deployed at:", addr);
  console.log(`Explorer: https://sepolia.basescan.org/address/${addr}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
