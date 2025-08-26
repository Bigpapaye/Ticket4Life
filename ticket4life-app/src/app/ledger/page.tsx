"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui";
import { usePublicClient } from "wagmi";
import { ABI, CONTRACTS } from "@/config/contracts";
import { txUrl, addrUrl } from "@/lib/explorer";
import { Button } from "@/components/ui/Button";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

type Row = {
  ts: number;
  blockNumber: bigint;
  txHash: `0x${string}`;
  type: string;
  details: Record<string, any>;
};

export default function LedgerPage() {
  const publicClient = usePublicClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const targets = useMemo(() => {
    const list: { address: `0x${string}`; abi: any; events: { name: string }[] }[] = [];
    if (CONTRACTS.treasury) {
      list.push({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, events: [
        { name: "Received" },
        { name: "PoolMoved" },
      ] });
    }
    if (CONTRACTS.marketplace) {
      list.push({ address: CONTRACTS.marketplace as `0x${string}`, abi: ABI.marketplace as any, events: [
        { name: "SaleSettled" },
      ] });
    }
    if (CONTRACTS.ticket) {
      list.push({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, events: [
        { name: "Minted" },
      ] });
    }
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!publicClient) return;
      setLoading(true);
      setError(null);
      try {
        const latest = await publicClient.getBlockNumber();
        // Fetch last ~30k blocks (~1-2 weeks on Base Sepolia). Adjust if needed.
        const span = BigInt(30000);
        const fromBlock = latest > span ? (latest - span) : BigInt(0);

        const all: Row[] = [];
        for (const t of targets) {
          for (const ev of t.events) {
            try {
              const logs = await publicClient.getLogs({
                address: t.address,
                event: (t.abi as any).find((i: any) => i.type === "event" && i.name === ev.name),
                fromBlock,
                toBlock: latest,
              } as any);
              for (const lg of logs) {
                const blk = await publicClient.getBlock({ blockHash: lg.blockHash! });
                const ts = Number(blk.timestamp) * 1000;
                const details: Record<string, any> = { contract: t.address };
                // Shape by event name
                if (ev.name === "SaleSettled") {
                  const { id, buyer, seller, nft, tokenId, price, fee, payout } = (lg as any).args || {};
                  Object.assign(details, { id, buyer, seller, nft, tokenId: tokenId?.toString?.(), price: toEth(price), fee: toEth(fee), payout: toEth(payout) });
                } else if (ev.name === "Received") {
                  const { from, amount } = (lg as any).args || {};
                  Object.assign(details, { from, amount: toEth(amount) });
                } else if (ev.name === "PoolMoved") {
                  const { pool, amount } = (lg as any).args || {};
                  Object.assign(details, { pool, amount: toEth(amount) });
                } else if (ev.name === "Minted") {
                  const { minter, tokenId, value } = (lg as any).args || {};
                  Object.assign(details, { minter, tokenId: tokenId?.toString?.(), value: toEth(value) });
                }
                all.push({
                  ts,
                  blockNumber: lg.blockNumber!,
                  txHash: lg.transactionHash as `0x${string}`,
                  type: `${ev.name}`,
                  details,
                });
              }
            } catch (e) {
              // Continue on a per-event basis
              console.warn("getLogs failed", t.address, ev.name, e);
            }
          }
        }
        if (!cancelled) {
          all.sort((a, b) => Number(b.blockNumber - a.blockNumber));
          setRows(all);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Impossible de charger le ledger");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [publicClient, targets, reloadTick]);

  return (
    <div className={`${manrope.className} mx-auto max-w-6xl p-4 sm:p-6`}>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{loading ? "Chargement du ledger" : "Ledger à jour"}</div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">Ledger (on-chain)</h1>
        <Button
          className="px-3 py-1.5 border rounded disabled:opacity-50"
          disabled={loading}
          aria-disabled={loading}
          aria-busy={loading}
          onClick={() => {
            // trigger reload without hard refresh
            setRows([]);
            setReloadTick((t) => t + 1);
          }}
        >{loading ? "Chargement…" : "Rafraîchir"}</Button>
      </div>
      {!CONTRACTS.treasury && !CONTRACTS.marketplace && !CONTRACTS.ticket && (
        <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">Aucune adresse de contrat configurée. Renseigner les variables d'environnement.</div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</div>
      )}
      {rows.length === 0 ? (
        loading ? (
          <div className="space-y-2">
            <div className="border rounded p-3">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="border rounded p-3">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="border rounded p-3">
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 border rounded p-4">Aucun événement trouvé dans la fenêtre récente.</div>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded overflow-hidden">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="p-2 border-b">Date</th>
                <th className="p-2 border-b">Bloc</th>
                <th className="p-2 border-b">Type</th>
                <th className="p-2 border-b">Tx</th>
                <th className="p-2 border-b">Détails</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, idx) => (
                <tr key={`${e.txHash}-${idx}`} className="odd:bg-white even:bg-gray-50 align-top">
                  <td className="p-2 border-b whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                  <td className="p-2 border-b">{e.blockNumber.toString()}</td>
                  <td className="p-2 border-b font-mono">{e.type}</td>
                  <td className="p-2 border-b">
                    <a className="text-blue-600 hover:underline" href={txUrl(e.txHash)} target="_blank" rel="noreferrer">{shortHash(e.txHash)}</a>
                  </td>
                  <td className="p-2 border-b">
                    <Details details={e.details} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toEth(v?: bigint | number | string) {
  try {
    if (typeof v === "bigint") return Number(v) / 1e18;
    if (typeof v === "number") return v / 1e18;
    if (typeof v === "string") return Number(v) / 1e18;
    return undefined;
  } catch { return undefined; }
}

function shortHash(h: string) {
  return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "";
}

function Details({ details }: { details: Record<string, any> }) {
  const entries = Object.entries(details || {});
  if (entries.length === 0) return <span className="text-gray-500">-</span>;
  return (
    <div className="text-xs space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-gray-500 min-w-[120px]">{k}</span>
          <span className="font-mono break-all">
            {isAddressLike(v) ? (
              <a className="text-blue-600 hover:underline" href={addrUrl(String(v))} target="_blank" rel="noreferrer">{String(v)}</a>
            ) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function isAddressLike(v: any) {
  return typeof v === 'string' && v.startsWith('0x') && v.length === 42;
}
