import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const maxPriorityFeePerGas = ethers.parseUnits("2", "gwei");
  const maxFeePerGas = ethers.parseUnits("100", "gwei");

  const Registry = await ethers.getContractFactory("QuizRegistry");
  const registry = await Registry.deploy(deployer.address, { maxPriorityFeePerGas, maxFeePerGas });
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("QuizRegistry:", addr);

  // Optionally update frontend .env.local
  try {
    const appRoot = path.resolve(__dirname, "../../ticket4life-app");
    const envPath = path.join(appRoot, ".env.local");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const line = `NEXT_PUBLIC_REGISTRY_ADDRESS=${addr}`;
    if (/NEXT_PUBLIC_REGISTRY_ADDRESS=.*/.test(content)) {
      content = content.replace(/NEXT_PUBLIC_REGISTRY_ADDRESS=.*/g, line);
    } else {
      content += (content.endsWith("\n") ? "" : "\n") + line + "\n";
    }
    fs.writeFileSync(envPath, content, "utf8");
    console.log("Updated:", envPath);
  } catch (e) {
    console.warn("Could not update frontend .env.local automatically:", (e as any)?.message || e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
