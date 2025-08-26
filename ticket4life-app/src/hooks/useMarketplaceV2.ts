"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { Address, Hex, keccak256, encodePacked } from "viem";
import { ABI, CONTRACTS, DEPLOY_BLOCKS } from "@/config/contracts";

export type V2Listing = {
  id: Hex;
  seller: Address;
  nft: Address;
  tokenId: bigint;
  price: bigint;
};

export function useV2ActiveListings() {
  const publicClient = usePublicClient();
  const [listings, setListings] = useState<V2Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const optimistic = useRef<Map<string, V2Listing>>(new Map());
  const hiddenIds = useRef<Set<string>>(new Set()); // session-only hidden listings (e.g., just bought)
  const LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplaceV2 ?? "").toLowerCase();
    return `t4l_v2_optimistic_listings:${CONTRACTS.chainId}:${addr}`;
  }, []);
  const refreshRef = useRef<null | (() => void)>(null);
  // Keep an incremental active map (idLower -> listing)
  const activeRef = useRef<Map<string, V2Listing>>(new Map());
  const removedIdsRef = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function keyOf(a: { seller: Address; nft: Address; tokenId: bigint }) {
    return `${a.seller.toLowerCase()}|${a.nft.toLowerCase()}|${a.tokenId.toString()}`;
  }

  function persistLS() {
    try {
      const arr = Array.from(optimistic.current.values());
      localStorage.setItem(LS_KEY, JSON.stringify(arr.map(o => ({ ...o, tokenId: o.tokenId.toString(), price: o.price.toString() }))));
    } catch {}
  }

  const addOptimisticListing = ({ nft, tokenId, price, seller }: { nft: Address; tokenId: bigint; price: bigint; seller: Address }) => {
    // compute the real listing id as used by the contract: keccak256(abi.encodePacked(nft, tokenId, seller))
    const realId = keccak256(encodePacked(["address","uint256","address"], [nft, tokenId, seller])) as Hex;
    const item: V2Listing = { id: realId, nft, tokenId, price, seller };
    const k = keyOf(item);
    optimistic.current.set(k, item);
    persistLS();
    // reflect immediately in UI unless chain already has it
    scheduleFlush();
  };

  const removeOptimisticListing = ({ nft, tokenId, seller }: { nft: Address; tokenId: bigint; seller: Address }) => {
    const k = keyOf({ nft, tokenId, seller } as any);
    if (optimistic.current.has(k)) {
      optimistic.current.delete(k);
      persistLS();
    }
    scheduleFlush();
  };

  function removeOptimisticById(idLower: string) {
    let changed = false;
    for (const [k, v] of optimistic.current.entries()) {
      if ((v.id as string).toLowerCase() === idLower) { optimistic.current.delete(k); changed = true; }
    }
    if (changed) persistLS();
  }

  function buildFinalFromActive(): V2Listing[] {
    // Start with chain active
    const baseArr = Array.from(activeRef.current.values());
    const natKeys = new Set<string>(baseArr.map((it) => keyOf(it)));
    let final = [...baseArr];
    // Merge optimistic if not present and not removed
    for (const it of optimistic.current.values()) {
      const idLower = (it.id as string).toLowerCase();
      if (removedIdsRef.current.has(idLower)) continue;
      if (!natKeys.has(keyOf(it))) final.push(it);
    }
    // Apply session hidden ids
    if (hiddenIds.current.size) final = final.filter((v) => !hiddenIds.current.has((v.id as string).toLowerCase()));
    return final;
  }

  function scheduleFlush() {
    if (flushTimer.current) { clearTimeout(flushTimer.current); }
    flushTimer.current = setTimeout(() => {
      try { setListings(buildFinalFromActive()); } finally { flushTimer.current = null; }
    }, 300);
  }

  useEffect(() => {
    if (!publicClient || !CONTRACTS.marketplaceV2) return;
    let cancelled = false;
    const pc = publicClient;

    async function fetchAll() {
      setLoading(true);
      try {
        const address = CONTRACTS.marketplaceV2 as Address;
        let fromBlock = DEPLOY_BLOCKS.marketplaceV2;
        let listed = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Listed", fromBlock, toBlock: "latest" } as any);
        let cancelledLogs = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Cancelled", fromBlock, toBlock: "latest" } as any);
        let boughtLogs = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Bought", fromBlock, toBlock: "latest" } as any);
        // Fallback: if a wrong deploy block is configured and returns no logs, rescan from genesis
        if (fromBlock > 0n && listed.length === 0 && cancelledLogs.length === 0 && boughtLogs.length === 0) {
          fromBlock = 0n;
          listed = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Listed", fromBlock, toBlock: "latest" } as any);
          cancelledLogs = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Cancelled", fromBlock, toBlock: "latest" } as any);
          boughtLogs = await pc.getLogs({ address, abi: ABI.marketplaceV2 as any, eventName: "Bought", fromBlock, toBlock: "latest" } as any);
        }

        type AnyLog = { args: any; blockNumber?: bigint; logIndex?: number; __type: "Listed" | "Cancelled" | "Bought" } & any;
        const all: AnyLog[] = [
          ...listed.map((l: any) => ({ ...l, __type: "Listed" as const })),
          ...cancelledLogs.map((l: any) => ({ ...l, __type: "Cancelled" as const })),
          ...boughtLogs.map((l: any) => ({ ...l, __type: "Bought" as const })),
        ];
        all.sort((a, b) => {
          const ba = (a.blockNumber ?? 0n) as bigint;
          const bb = (b.blockNumber ?? 0n) as bigint;
          if (ba !== bb) return Number(ba - bb);
          const ia = (a.logIndex ?? 0) as number;
          const ib = (b.logIndex ?? 0) as number;
          return ia - ib;
        });

        const nextActive = new Map<string, V2Listing>();
        const removedIds = new Set<string>();
        for (const lg of all) {
          const idHex = (lg as any).args?.id as Hex | undefined;
          if (!idHex) continue;
          const id = idHex.toLowerCase();
          if (lg.__type === "Listed") {
            const args = (lg as any).args;
            const it: V2Listing = {
              id: args.id as Hex,
              seller: args.seller as Address,
              nft: args.nft as Address,
              tokenId: BigInt(args.tokenId),
              price: BigInt(args.price),
            };
            nextActive.set(id, it);
          } else {
            nextActive.delete(id);
            removedIds.add(id);
          }
        }
        // set active map snapshot (pre-verify)
        activeRef.current = nextActive;
        removedIdsRef.current = removedIds;
        // purge optimistic items by id when removed on-chain
        for (const idLower of removedIdsRef.current) removeOptimisticById(idLower);
        // final safety: verify against on-chain mapping (filters out items already bought/cancelled even if logs decoding mismatched)
        const verified = new Map<string, V2Listing>();
        try {
          const results = await Promise.all(
            Array.from(nextActive.values()).map(async (v) => {
              try {
                const [rec, owner] = await Promise.all([
                  pc.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [v.id] } as any) as Promise<{ active: boolean } & any>,
                  pc.readContract({ address: v.nft as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [v.tokenId] } as any) as Promise<Address>,
                ]);
                const active = Boolean(rec?.active);
                const escrowed = typeof owner === "string" && owner.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                return { v, keep: active && escrowed };
              } catch { return { v, active: true }; }
            })
          );
          for (const r of results) if ((r as any).keep) verified.set(r.v.id.toLowerCase(), r.v);
        } catch {
          // if mapping checks fail, fall back to nextActive
          for (const v of nextActive.values()) verified.set(v.id.toLowerCase(), v);
        }
        // Any id present in nextActive but not verified is considered removed by verification.
        for (const idLower of nextActive.keys()) {
          if (!verified.has(idLower)) {
            removedIdsRef.current.add(idLower);
            removeOptimisticById(idLower);
          }
        }
        // replace active with verified snapshot
        activeRef.current = verified;
        if (!cancelled) setListings(buildFinalFromActive());
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refreshRef.current = () => { if (!cancelled) fetchAll(); };

    // one-time migration: clear pre-namespaced key
    try { localStorage.removeItem("t4l_v2_optimistic_listings"); } catch {}

    // load optimistic from LS once
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as any[];
        for (const rec of arr) {
          const item: V2Listing = { id: rec.id as Hex, nft: rec.nft as Address, tokenId: BigInt(rec.tokenId), price: BigInt(rec.price), seller: rec.seller as Address };
          optimistic.current.set(keyOf(item), item);
        }
        setListings(Array.from(optimistic.current.values()));
      }
    } catch {}

    fetchAll();
    const unsubs: Array<() => void> = [];
    const listedUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplaceV2 as Address,
      abi: ABI.marketplaceV2 as any,
      eventName: "Listed",
      onLogs: (logs: any[]) => {
        for (const lg of logs) {
          const args = (lg as any).args;
          if (!args?.id) continue;
          const idLower = (args.id as Hex as string).toLowerCase();
          const it: V2Listing = {
            id: args.id as Hex,
            seller: args.seller as Address,
            nft: args.nft as Address,
            tokenId: BigInt(args.tokenId),
            price: BigInt(args.price),
          };
          activeRef.current.set(idLower, it);
          removeOptimisticById(idLower);
        }
        scheduleFlush();
      },
    });
    unsubs.push(listedUnsub);
    const cancelUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplaceV2 as Address,
      abi: ABI.marketplaceV2 as any,
      eventName: "Cancelled",
      onLogs: (logs: any[]) => {
        for (const lg of logs) {
          const idLower = ((lg as any).args?.id as string | undefined)?.toLowerCase?.();
          if (!idLower) continue;
          activeRef.current.delete(idLower);
          removedIdsRef.current.add(idLower);
          removeOptimisticById(idLower);
        }
        scheduleFlush();
      },
    });
    unsubs.push(cancelUnsub);
    const boughtUnsub = pc.watchContractEvent({
      address: CONTRACTS.marketplaceV2 as Address,
      abi: ABI.marketplaceV2 as any,
      eventName: "Bought",
      onLogs: (logs: any[]) => {
        for (const lg of logs) {
          const idLower = ((lg as any).args?.id as string | undefined)?.toLowerCase?.();
          if (!idLower) continue;
          activeRef.current.delete(idLower);
          removedIdsRef.current.add(idLower);
          removeOptimisticById(idLower);
        }
        scheduleFlush();
      },
    });
    unsubs.push(boughtUnsub);

    return () => { cancelled = true; for (const u of unsubs) try { u(); } catch {} };
  }, [publicClient]);

  const refresh = () => { try { refreshRef.current?.(); } catch {} };
  const hideListingById = (id: Hex) => {
    try { hiddenIds.current.add((id as string).toLowerCase()); } catch {}
    setListings((prev) => prev.filter((l) => l.id.toLowerCase() !== (id as string).toLowerCase()));
  };
  return { listings, loading, addOptimisticListing, removeOptimisticListing, refresh, hideListingById };
}

export function useOwnedTokenIdV2(): { tokenId: bigint | null; loading: boolean } {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const CHAIN = CONTRACTS.chainId;
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const watchers = useRef<(() => void)[] | null>(null);
  const currentRef = useRef<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initial() {
      // Reset watchers
      if (watchers.current) { for (const u of watchers.current) try { u(); } catch {} watchers.current = null; }
      currentRef.current = null;
      if (!address || !CONTRACTS.ticket || !publicClient) { setTokenId(null); return; }
      setLoading(true);
      try {
        // Seed from LS
        try {
          const raw = localStorage.getItem(`t4l_owned_token:${CHAIN}:${(address as Address).toLowerCase()}`);
          if (raw) { try { const v = BigInt(raw); currentRef.current = v; setTokenId(v); } catch {} }
        } catch {}
        const fromBlock = DEPLOY_BLOCKS.ticket;
        // Fetch transfers to me and from me
        const [toLogs, fromLogs] = await Promise.all([
          publicClient.getLogs({ address: CONTRACTS.ticket as Address, abi: ABI.erc721 as any, eventName: "Transfer", args: { to: address as Address }, fromBlock, toBlock: "latest" } as any),
          publicClient.getLogs({ address: CONTRACTS.ticket as Address, abi: ABI.erc721 as any, eventName: "Transfer", args: { from: address as Address }, fromBlock, toBlock: "latest" } as any),
        ]);
        type TLog = any & { blockNumber?: bigint; logIndex?: number; args?: any };
        const all: TLog[] = [...toLogs, ...fromLogs];
        all.sort((a, b) => {
          const ba = (a.blockNumber ?? 0n) as bigint; const bb = (b.blockNumber ?? 0n) as bigint;
          if (ba !== bb) return Number(ba - bb);
          return ((a.logIndex ?? 0) as number) - ((b.logIndex ?? 0) as number);
        });
        let curr: bigint | null = currentRef.current ?? null;
        for (const lg of all) {
          const args = lg.args as { from: Address; to: Address; tokenId: bigint };
          if (!args) continue;
          if ((args.to as string).toLowerCase() === (address as string).toLowerCase()) {
            curr = BigInt(args.tokenId);
          } else if ((args.from as string).toLowerCase() === (address as string).toLowerCase()) {
            // If I send away the token I had, I no longer own it
            if (curr != null && curr === BigInt(args.tokenId)) curr = null;
            else curr = null; // one-ticket-per-wallet policy simplifies state
          }
        }
        currentRef.current = curr;
        if (!cancelled) setTokenId(curr);
        try {
          const key = `t4l_owned_token:${CHAIN}:${(address as Address).toLowerCase()}`;
          if (curr != null) localStorage.setItem(key, curr.toString()); else localStorage.removeItem(key);
        } catch {}
        // Start watchers for live updates
        const unsubs: Array<() => void> = [];
        const wTo = publicClient.watchContractEvent({ address: CONTRACTS.ticket as Address, abi: ABI.erc721 as any, eventName: "Transfer", args: { to: address as Address }, onLogs: (logs: any[]) => {
          let curr = currentRef.current;
          for (const lg of logs) {
            const tid = BigInt((lg as any).args?.tokenId ?? 0);
            curr = tid; // received a token -> now own it
          }
          currentRef.current = curr ?? null;
          if (!cancelled) setTokenId(curr ?? null);
          try { if (curr != null) localStorage.setItem(`t4l_owned_token:${CHAIN}:${(address as Address).toLowerCase()}`, curr.toString()); } catch {}
        } } as any);
        unsubs.push(wTo);
        const wFrom = publicClient.watchContractEvent({ address: CONTRACTS.ticket as Address, abi: ABI.erc721 as any, eventName: "Transfer", args: { from: address as Address }, onLogs: (logs: any[]) => {
          let curr = currentRef.current;
          for (const lg of logs) {
            const tid = BigInt((lg as any).args?.tokenId ?? 0);
            if (curr != null && curr === tid) curr = null; else curr = null; // one-ticket-per-wallet policy
          }
          currentRef.current = curr ?? null;
          if (!cancelled) setTokenId(curr ?? null);
          try {
            const key = `t4l_owned_token:${CHAIN}:${(address as Address).toLowerCase()}`;
            if (curr != null) localStorage.setItem(key, curr.toString()); else localStorage.removeItem(key);
          } catch {}
        } } as any);
        unsubs.push(wFrom);
        watchers.current = unsubs;
      } catch {
        if (!cancelled) setTokenId(null);
      } finally { if (!cancelled) setLoading(false); }
    }
    initial();
    return () => { cancelled = true; if (watchers.current) { for (const u of watchers.current) try { u(); } catch {} watchers.current = null; } };
  }, [address, publicClient]);

  return { tokenId, loading };
}
