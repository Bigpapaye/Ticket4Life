"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Address, Hex } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ABI, CONTRACTS, DEPLOY_BLOCKS } from "@/config/contracts";

export type HistoryItem = {
  type: "Transfer" | "Listed" | "Bought" | "Cancelled";
  txHash: Hex;
  blockNumber: bigint;
  timestamp?: number;
  // common
  nft?: Address;
  tokenId?: bigint;
  price?: bigint;
  // specific
  from?: Address;
  to?: Address;
  seller?: Address;
  buyer?: Address;
  id?: Hex;
};

export function useHistory() {
  const { address } = useAccount();
  const pc = usePublicClient();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastProcessedBlock = useRef<bigint | null>(null);

  useEffect(() => {
    if (!pc || !address) return;
    let cancelled = false;

    async function fetchWindow() {
      setLoading(true);
      try {
        const current = await pc!.getBlockNumber();
        const windowSize = BigInt(200_000);
        const baseFrom = lastProcessedBlock.current
          ? lastProcessedBlock.current + BigInt(1)
          : current > windowSize
          ? current - windowSize
          : BigInt(0);

        const fromTicket = baseFrom < DEPLOY_BLOCKS.ticket ? DEPLOY_BLOCKS.ticket : baseFrom;
        const fromMarketplace = baseFrom < DEPLOY_BLOCKS.marketplace ? DEPLOY_BLOCKS.marketplace : baseFrom;

        const out: HistoryItem[] = [];

        // Ticket Transfers involving address
        if (CONTRACTS.ticket) {
          const transfers = await pc!.getLogs({
            address: CONTRACTS.ticket as Address,
            event: (ABI.erc721 as any).find((e: any) => e.type === "event" && e.name === "Transfer"),
            fromBlock: fromTicket,
            toBlock: "latest",
          } as any);
          for (const lg of transfers) {
            const args = (lg as any).args;
            if (!args) continue;
            const from = (args.from as Address).toLowerCase();
            const to = (args.to as Address).toLowerCase();
            const me = (address as Address).toLowerCase();
            if (from === me || to === me) {
              out.push({
                type: "Transfer",
                txHash: (lg as any).transactionHash as Hex,
                blockNumber: (lg as any).blockNumber as bigint,
                nft: CONTRACTS.ticket as Address,
                tokenId: BigInt(args.tokenId),
                from: args.from as Address,
                to: args.to as Address,
              });
            }
          }
        }

        if (CONTRACTS.marketplace) {
          const addressMp = CONTRACTS.marketplace as Address;
          const listed = await pc!.getLogs({
            address: addressMp,
            event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Listed"),
            fromBlock: fromMarketplace,
            toBlock: "latest",
          } as any);
          const bought = await pc!.getLogs({
            address: addressMp,
            event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Bought"),
            fromBlock: fromMarketplace,
            toBlock: "latest",
          } as any);
          const cancelled = await pc!.getLogs({
            address: addressMp,
            event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Cancelled"),
            fromBlock: fromMarketplace,
            toBlock: "latest",
          } as any);

          const me = (address as Address).toLowerCase();

          for (const lg of listed) {
            const a = (lg as any).args;
            if (!a) continue;
            const seller = (a.seller as Address).toLowerCase();
            if (seller === me) {
              out.push({
                type: "Listed",
                txHash: (lg as any).transactionHash as Hex,
                blockNumber: (lg as any).blockNumber as bigint,
                id: a.id as Hex,
                seller: a.seller as Address,
                nft: a.nft as Address,
                tokenId: BigInt(a.tokenId),
                price: BigInt(a.price),
              });
            }
          }
          for (const lg of bought) {
            const a = (lg as any).args;
            if (!a) continue;
            const buyer = (a.buyer as Address).toLowerCase();
            const seller = (a.seller as Address).toLowerCase();
            if (buyer === me || seller === me) {
              out.push({
                type: "Bought",
                txHash: (lg as any).transactionHash as Hex,
                blockNumber: (lg as any).blockNumber as bigint,
                id: a.id as Hex,
                seller: a.seller as Address,
                buyer: a.buyer as Address,
                nft: a.nft as Address,
                tokenId: BigInt(a.tokenId),
                price: BigInt(a.price),
              });
            }
          }
          for (const lg of cancelled) {
            const a = (lg as any).args;
            if (!a) continue;
            const seller = (a.seller as Address).toLowerCase();
            if (seller === me) {
              out.push({
                type: "Cancelled",
                txHash: (lg as any).transactionHash as Hex,
                blockNumber: (lg as any).blockNumber as bigint,
                id: a.id as Hex,
                seller: a.seller as Address,
                nft: a.nft as Address,
                tokenId: BigInt(a.tokenId),
                price: BigInt(a.price),
              });
            }
          }
        }

        // sort by block desc
        out.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        if (!cancelled) setItems(out);
        lastProcessedBlock.current = current;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWindow();
  }, [pc, address]);

  return { items, loading };
}
