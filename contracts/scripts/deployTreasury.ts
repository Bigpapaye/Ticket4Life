import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const addr = await treasury.getAddress();
  console.log("NEW_TREASURY:", addr);
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
