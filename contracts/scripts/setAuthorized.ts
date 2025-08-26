import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const addr = process.env.T4L_AUTH_ADDR || signer.address;
  const registryAddr = process.env.T4L_REGISTRY_ADDR;
  if (!registryAddr) throw new Error("T4L_REGISTRY_ADDR is required");
  console.log("Signer:", signer.address);
  const Registry = await ethers.getContractFactory("QuizRegistry");
  const registry = Registry.attach(registryAddr);

  const tx = await (registry.connect(signer) as any).setAuthorized(addr, true);
  console.log("setAuthorized tx:", tx.hash);
  await tx.wait();
  console.log("Authorized:", addr);
}

main().catch((e) => { console.error(e); process.exit(1); });
