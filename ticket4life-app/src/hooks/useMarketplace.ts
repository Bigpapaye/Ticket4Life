"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Address, Hex } from "viem";
import { ABI, CONTRACTS, DEPLOY_BLOCKS } from "@/config/contracts";
import { useEventPulse } from "@/components/EventProvider";

export type ActiveListing = {
  id: Hex;
  seller: Address;
  nft: Address;
  tokenId: bigint;
  price: bigint;
};

export function useOwnedTokenId(): { tokenId: bigint | null; loading: boolean } {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const { pulse, last } = useEventPulse();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address || !CONTRACTS.ticket || !publicClient) {
        setTokenId(null);
        return;
      }
      setLoading(true);
      try {
        // get nextId to bound search
        const nextId = (await publicClient.readContract({
          address: CONTRACTS.ticket as Address,
          abi: ABI.ticket as any,
          functionName: "nextId",
          args: [],
        })) as bigint;
        // scan for the token owned by address; 1 token per wallet
        for (let i = BigInt(1); i <= nextId; i = i + BigInt(1)) {
          // optional small batch skip if already found
          const owner = (await publicClient.readContract({
            address: CONTRACTS.ticket as Address,
            abi: ABI.ticket as any,
            functionName: "ownerOf",
            args: [i],
          })) as Address;
          if (owner.toLowerCase() === (address as Address).toLowerCase()) {
            if (!cancelled) setTokenId(i);
            break;
          }
        }
      } catch {
        if (!cancelled) setTokenId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    // Re-run when address changes
  }, [address, publicClient, pulse, last]);

  return { tokenId, loading };
}

export function useActiveListings(): {
  listings: ActiveListing[];
  loading: boolean;
  addOptimisticListing: (args: { nft: Address; tokenId: bigint; price: bigint; seller: Address }) => void;
  removeListingByKey: (args: { seller: Address; nft: Address; tokenId: bigint }) => void;
  removeListingById: (id: Hex) => void;
  clearOptimistic: () => void;
} {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [listings, setListings] = useState<ActiveListing[]>([]);
  const [loading, setLoading] = useState(false);
  // For reliability, fetch from genesis. Can be optimized later with checkpoints.
  const lastProcessedBlock = useRef<bigint | null>(null);
  const { pulse, last } = useEventPulse();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Local optimistic cache keyed by seller|nft|tokenId
  const optimistic = useRef<Map<string, ActiveListing>>(new Map());
  const LS_KEY = "t4l_optimistic_listings";

  function keyOf(a: { seller: Address; nft: Address; tokenId: bigint }) {
    return `${a.seller.toLowerCase()}|${a.nft.toLowerCase()}|${a.tokenId.toString()}`;
  }

  const addOptimisticListing = ({ nft, tokenId, price, seller }: { nft: Address; tokenId: bigint; price: bigint; seller: Address }) => {
    const idHex = ("0x" + tokenId.toString(16).padStart(64, "0")) as Hex; // pseudo id
    const item: ActiveListing = { id: idHex, nft, tokenId, price, seller };
    const k = keyOf(item);
    optimistic.current.set(k, item);
    try {
      const arr = Array.from(optimistic.current.values());
      // Persist only entries of the current account
      const filtered = address ? arr.filter(o => o.seller.toLowerCase() === (address as Address).toLowerCase()) : [];
      localStorage.setItem(LS_KEY, JSON.stringify(filtered.map(o => ({ ...o, tokenId: o.tokenId.toString(), price: o.price.toString() }))));
    } catch {}
    // Merge into current state immediately
    setListings((prev) => {
      const byKey = new Map<string, ActiveListing>();
      for (const it of prev) byKey.set(keyOf(it), it);
      byKey.set(k, item);
      return Array.from(byKey.values());
    });
  };

  const removeListingByKey = ({ seller, nft, tokenId }: { seller: Address; nft: Address; tokenId: bigint }) => {
    const k = keyOf({ seller, nft, tokenId });
    optimistic.current.delete(k);
    try {
      const arr = Array.from(optimistic.current.values());
      localStorage.setItem(LS_KEY, JSON.stringify(arr.map(o => ({ ...o, tokenId: o.tokenId.toString(), price: o.price.toString() }))));
    } catch {}
    setListings((prev) => prev.filter((it) => keyOf(it) !== k));
  };

  const removeListingById = (id: Hex) => {
    // Remove from optimistic map if we can match by key
    setListings((prev) => prev.filter((it) => it.id.toLowerCase() !== id.toLowerCase()));
    // Also try to delete matching key from optimistic cache
    for (const [k, v] of optimistic.current) {
      if (v.id.toLowerCase() === id.toLowerCase()) {
        optimistic.current.delete(k);
        break;
      }
    }
    try {
      const arr = Array.from(optimistic.current.values());
      localStorage.setItem(LS_KEY, JSON.stringify(arr.map(o => ({ ...o, tokenId: o.tokenId.toString(), price: o.price.toString() }))));
    } catch {}
  };

  const clearOptimistic = () => {
    optimistic.current.clear();
    try { localStorage.removeItem(LS_KEY); } catch {}
  };

  useEffect(() => {
    // If address changes, reset local optimistic state to avoid stale listings from previous wallet
    clearOptimistic();
    setListings([]);
  }, [address]);

  useEffect(() => {
    if (!publicClient || !CONTRACTS.marketplace) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    // Load optimistic state from localStorage on first mount (scoped to current account)
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as any[];
        for (const rec of arr) {
          if (!address) continue;
          if ((rec.seller as string)?.toLowerCase() !== (address as Address)?.toLowerCase()) continue;
          const item: ActiveListing = {
            id: rec.id as Hex,
            nft: rec.nft as Address,
            tokenId: BigInt(rec.tokenId),
            price: BigInt(rec.price),
            seller: rec.seller as Address,
          };
          optimistic.current.set(keyOf(item), item);
        }
        // Merge into UI immediately
        setListings((prev) => {
          const byKey = new Map<string, ActiveListing>();
          for (const it of prev) byKey.set(keyOf(it), it);
          for (const it of optimistic.current.values()) byKey.set(keyOf(it), it);
          return Array.from(byKey.values());
        });
      }
    } catch {}

    const pc = publicClient!;

    async function fetchAll() {
      setLoading(true);
      try {
        const address = CONTRACTS.marketplace as Address;
        const fromBlock = DEPLOY_BLOCKS.marketplace;

        // Fetch logs for Listed, Cancelled, Bought
        const listed = await pc.getLogs({
          address,
          event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Listed"),
          fromBlock,
          toBlock: "latest",
        } as any);
        const cancelledLogs = await pc.getLogs({
          address,
          event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Cancelled"),
          fromBlock,
          toBlock: "latest",
        } as any);
        const boughtLogs = await pc.getLogs({
          address,
          event: (ABI.marketplace as any).find((e: any) => e.type === "event" && e.name === "Bought"),
          fromBlock,
          toBlock: "latest",
        } as any);

        // Merge and sort all logs chronologically, then apply state transitions per id
        type AnyLog = { args: any; blockNumber?: bigint; logIndex?: number; __type: "Listed" | "Cancelled" | "Bought" } & any;
        const all: AnyLog[] = [
          ...listed.map((l: any) => ({ ...l, __type: "Listed" as const })),
          ...cancelledLogs.map((l: any) => ({ ...l, __type: "Cancelled" as const })),
          ...boughtLogs.map((l: any) => ({ ...l, __type: "Bought" as const })),
        ];
        all.sort((a, b) => {
          const ba = (a.blockNumber ?? BigInt(0)) as bigint;
          const bb = (b.blockNumber ?? BigInt(0)) as bigint;
          if (ba !== bb) return Number(ba - bb);
          const ia = (a.logIndex ?? 0) as number;
          const ib = (b.logIndex ?? 0) as number;
          return ia - ib;
        });

        const nextActive = new Map<string, ActiveListing>();
        for (const lg of all) {
          const idHex = (lg as any).args?.id as Hex | undefined;
          if (!idHex) continue;
          const id = idHex.toLowerCase();
          if (lg.__type === "Listed") {
            const args = (lg as any).args;
            nextActive.set(id, {
              id: args.id as Hex,
              seller: args.seller as Address,
              nft: args.nft as Address,
              tokenId: BigInt(args.tokenId),
              price: BigInt(args.price),
            });
          } else {
            // Cancelled or Bought removes the listing if it exists
            nextActive.delete(id);
          }
        }

        // Merge optimistic entries (skip those that now exist from chain)
        for (const [, item] of optimistic.current) {
          const k = keyOf(item);
          // If a chain-listed item exists for same seller/nft/token, prefer chain
          let exists = false;
          for (const v of nextActive.values()) {
            if (keyOf(v) === k) { exists = true; break; }
          }
          if (!exists) nextActive.set(item.id.toLowerCase(), item);
        }
        if (!cancelled) setListings(Array.from(nextActive.values()));
      } catch (e) {
        // On RPC failure (e.g., 503), avoid merging optimistic into UI to prevent stale listings from previous accounts
        // Keep previous UI state unchanged.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();

    // live updates
    const unsubs: Array<() => void> = [];
    const listedUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplace as Address,
      abi: ABI.marketplace as any,
      eventName: "Listed",
      onLogs: () => fetchAll(),
    });
    unsubs.push(listedUnsub);
    const cancelUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplace as Address,
      abi: ABI.marketplace as any,
      eventName: "Cancelled",
      onLogs: () => fetchAll(),
    });
    unsubs.push(cancelUnsub);
    const boughtUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplace as Address,
      abi: ABI.marketplace as any,
      eventName: "Bought",
      onLogs: () => fetchAll(),
    });
    unsubs.push(boughtUnsub);

    unsub = () => {
      for (const u of unsubs) try { u(); } catch {}
    };

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [publicClient, pulse, last, address]);

  // Debounced refresh on marketplace-related pulses
  useEffect(() => {
    if (!publicClient) return;
    if (!(last === "Listed" || last === "Cancelled" || last === "Bought")) return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      // trigger a refresh by resetting lastProcessedBlock to re-read a small window
      lastProcessedBlock.current = null;
      // call a local fetch using the same logic by toggling loading state
      // simplest approach: setLoading to prompt components to re-render, the effect above will watch publicClient and remain mounted
      setLoading((v) => v); // no-op to ensure state hook is referenced
    }, 150);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [publicClient, pulse, last]);

  return { listings, loading, addOptimisticListing, removeListingByKey, removeListingById, clearOptimistic };
}
