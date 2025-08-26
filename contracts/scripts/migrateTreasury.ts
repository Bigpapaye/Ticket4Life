import { ethers } from "hardhat";

async function main() {
  const OLD_TREASURY = process.env.OLD_TREASURY_ADDRESS;
  const NEW_TREASURY = process.env.NEW_TREASURY_ADDRESS;
  if (!OLD_TREASURY) throw new Error("OLD_TREASURY_ADDRESS not set");
  if (!NEW_TREASURY) throw new Error("NEW_TREASURY_ADDRESS not set");

  const [signer] = await ethers.getSigners();
  const admin = await signer.getAddress();
  console.log("Admin (EOA) signer:", admin);
  console.log("Old Treasury:", OLD_TREASURY);
  console.log("New Treasury:", NEW_TREASURY);

  const oldAbi = [
    "function prizePool() view returns (uint256)",
    "function salePool() view returns (uint256)",
    "function buybackPool() view returns (uint256)",
    "function spendPrize(address to, uint256 amount)",
    "function spendSale(address to, uint256 amount)",
    "function spendBuyback(address to, uint256 amount)",
  ];
  const newAbi = [
    "function depositToPrize() payable",
    "function depositToSale() payable",
    "function depositToBuyback() payable",
  ];

  const oldT = new ethers.Contract(OLD_TREASURY, oldAbi, signer);
  const newT = new ethers.Contract(NEW_TREASURY, newAbi, signer);

  const prize: bigint = await oldT.prizePool();
  const sale: bigint = await oldT.salePool();
  const buyback: bigint = await oldT.buybackPool();
  console.log("Old pools:", { prize: prize.toString(), sale: sale.toString(), buyback: buyback.toString() });

  // Helper to migrate one pool
  const migratePool = async (
    label: string,
    amount: bigint,
    spend: (to: string, amount: bigint) => Promise<any>,
    deposit: (opts: { value: bigint }) => Promise<any>,
  ) => {
    if (amount === 0n) { console.log(label, "= 0, skip"); return; }
    console.log(`Migrating ${label}:`, amount.toString());
    const tx1 = await spend(admin, amount);
    console.log(`${label} spend tx:`, tx1.hash);
    await tx1.wait();
    const tx2 = await deposit({ value: amount });
    console.log(`${label} deposit tx:`, tx2.hash);
    await tx2.wait();
  };

  await migratePool("prize", prize, (to, amt) => oldT.spendPrize(to, amt), (opts) => newT.depositToPrize({ ...opts }));
  await migratePool("sale", sale, (to, amt) => oldT.spendSale(to, amt), (opts) => newT.depositToSale({ ...opts }));
  await migratePool("buyback", buyback, (to, amt) => oldT.spendBuyback(to, amt), (opts) => newT.depositToBuyback({ ...opts }));

  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
