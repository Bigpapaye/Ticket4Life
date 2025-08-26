import { ethers } from "hardhat";

async function main() {
  const TICKET = process.env.TICKET_ADDRESS || "0x551fD3061D56657761Dae83930ab93a3E15d099a";
  const MARKETPLACE = process.env.MARKETPLACE_ADDRESS || "0x99Fa3014BC00dCdf3D2c351827aCC98075b6a0a1";

  const mintPriceEth = process.env.MINT_PRICE_ETH || "0.001";
  const listPriceEth = process.env.LIST_PRICE_ETH || "0.002";

  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Signer:", me);

  const ticket = await ethers.getContractAt("Ticket4LifeTicket", TICKET, signer);
  const mp = await ethers.getContractAt("Marketplace", MARKETPLACE, signer);

  // Mint if balance is 0
  const bal = await ticket.balanceOf(me);
  let tokenId: bigint | undefined;
  if (bal === 0n) {
    console.log("Minting ticket for", mintPriceEth, "ETH");
    const tx = await ticket.mint({ value: ethers.parseEther(mintPriceEth) });
    const receipt = await tx.wait();
    console.log("Minted in block", receipt?.blockNumber);
    // tokenId assumed to be totalSupply-like incremental; fetch via Transfer event
    const transferLog = receipt!.logs
      .map((l) => {
        try { return ticket.interface.parseLog(l); } catch { return null; }
      })
      .find((p) => p && p.name === "Transfer");
    if (!transferLog) throw new Error("Transfer event not found");
    tokenId = transferLog!.args[2] as bigint;
  } else {
    // find a tokenId owned by signer by scanning 1..nextId
    const nextId = await ticket.nextId();
    console.log("Already minted. Searching owned token among 1..", nextId.toString());
    for (let i = 1n; i <= nextId; i++) {
      try {
        const owner = await ticket.ownerOf(i);
        if (owner.toLowerCase() === me.toLowerCase()) {
          tokenId = i;
          break;
        }
      } catch {
        // skip non-existent ids
      }
    }
    if (!tokenId) {
      throw new Error("No owned tokenId found for signer");
    }
  }

  console.log("Approving token", tokenId, "to Marketplace", MARKETPLACE);
  const approveTx = await ticket.approve(MARKETPLACE, tokenId);
  await approveTx.wait();

  console.log("Listing token at", listPriceEth, "ETH");
  const listTx = await mp.list(TICKET, tokenId, ethers.parseEther(listPriceEth));
  const listRc = await listTx.wait();
  console.log("Listed in block", listRc?.blockNumber);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
