"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { Address, Hex, keccak256, encodePacked, parseEther } from "viem";
import { ABI, CONTRACTS, DEPLOY_BLOCKS } from "@/config/contracts";
import { useV2ActiveListings } from "@/hooks/useMarketplaceV2";
import { useToast } from "@/lib/toast";
import { useTxToasts } from "@/lib/txToasts";
import { Button, Skeleton, VisuallyHidden } from "@/components/ui";
import { txUrl } from "@/lib/explorer";
import { useRouter } from "next/navigation";
import { useRefresh } from "@/components/SyncProvider";
import { EnvGuard } from "@/components/EnvGuard";
import { Tooltip } from "@/components/Tooltip";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });
const COLORS = {
  CREAM: "#F6EADA",
  PANEL: "#FAF0E3",
  PANEL_HOVER: "#F3E9D7",
  BORDER: "#E6D8C6",
  TEXT: "#111111",
  SUBTEXT: "#6B6B6B",
  CTA: "#27E7C5",
} as const;
const ORANGE = COLORS.CTA;

export default function MarketplaceV2Page() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { withTxToasts } = useTxToasts();
  const { push, remove } = useToast();
  const router = useRouter();
  const { refreshAll } = useRefresh();
  const { openConnectModal } = useConnectModal();

  const { listings, loading, addOptimisticListing, removeOptimisticListing, hideListingById, refresh } = useV2ActiveListings();

  // Read on-chain balance to know if user already has a ticket
  const { data: balance } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.erc721 as any,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(CONTRACTS.ticket && address) } as any,
  } as any);
  const hasTicket = typeof balance === "bigint" ? balance > 0n : false;

  // Read mint price and compute admin buyback price (90% of mint)
  const { data: mintPrice } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "MINT_PRICE",
    args: [],
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const adminPrice: bigint | undefined = typeof mintPrice === "bigint" ? (mintPrice as bigint) * 90n / 100n : undefined;

  // LocalStorage keys (namespaced by chain and contract address to avoid stale cache across redeploys)
  const ADMIN_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplace ?? "").toLowerCase();
    return `t4l_admin_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);
  const V2_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplaceV2 ?? "").toLowerCase();
    return `t4l_v2_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);

  const [price, setPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  // We support multiple concurrent public listings per wallet; derive them from listings
  const myListings = useMemo(() => {
    try { return address ? listings.filter((x) => x.seller.toLowerCase() === (address as string).toLowerCase()) : []; } catch { return []; }
  }, [listings, address]);
  const [justBought, setJustBought] = useState(false);
  const [myAdminListing, setMyAdminListing] = useState<{ id: Hex; price: bigint; tokenId: bigint } | null>(null);
  const [cancelingAdmin, setCancelingAdmin] = useState(false);
  const [cancelingMine, setCancelingMine] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");

  // Consider ticket "owned" if wallet holds it OR it's escrowed on Marketplace V1/V2 as my active listing
  const hasTicketLike = useMemo(() => {
    try {
      const mineV2 = (myListings?.length ?? 0) > 0;
      let cached = false;
      let cachedV2 = false;
      try {
        if (address) {
          const raw = localStorage.getItem(`t4l_owned_token:${CONTRACTS.chainId}:${(address as string).toLowerCase()}`);
          cached = Boolean(raw);
          const rawV2 = localStorage.getItem(V2_LS_KEY);
          if (rawV2) { try { const parsed = JSON.parse(rawV2); cachedV2 = parsed?.addr?.toLowerCase?.() === (address as string).toLowerCase(); } catch {} }
        }
      } catch {}
      return Boolean(
        hasTicket || myAdminListing || mineV2 || justBought || cached || cachedV2
      );
    } catch {
      return Boolean(hasTicket || myAdminListing || justBought);
    }
  }, [address, myListings, hasTicket, myAdminListing, justBought]);

  // Admin listing (buyback) helpers copied from Marketplace V1
  const [mounted, setMounted] = useState(false);
  const [selling, setSelling] = useState(false);
  const [lastAdminListedLocal, setLastAdminListedLocal] = useState<{ addr: string; tokenId: string; priceWei: string } | null>(null);
  const [lastV2ListedLocal, setLastV2ListedLocal] = useState<{ addr: string; tokenId: string; priceWei: string; id?: string } | null>(null);
  useEffect(() => { setMounted(true); }, []);
  // One-time migration: clear pre-namespaced keys if present
  useEffect(() => {
    try {
      localStorage.removeItem("t4l_v2_listing");
      localStorage.removeItem("t4l_admin_listing");
      if (address) localStorage.removeItem(`t4l_owned_token:${(address as string).toLowerCase()}`);
    } catch {}
  }, [address]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_LS_KEY);
      if (!raw) { setLastAdminListedLocal(null); return; }
      const parsed = JSON.parse(raw) as { addr: string; tokenId: string; priceWei: string };
      if (parsed && parsed.addr && address && parsed.addr.toLowerCase() === String(address).toLowerCase()) {
        setLastAdminListedLocal(parsed);
      } else {
        setLastAdminListedLocal(null);
      }
    } catch { setLastAdminListedLocal(null); }
  }, [address]);
  // Load V2 listing hint from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(V2_LS_KEY);
      if (!raw) { setLastV2ListedLocal(null); return; }
      const parsed = JSON.parse(raw) as { addr: string; tokenId: string; priceWei: string; id?: string };
      if (parsed && parsed.addr && address && parsed.addr.toLowerCase() === String(address).toLowerCase()) {
        setLastV2ListedLocal(parsed);
      } else {
        setLastV2ListedLocal(null);
      }
    } catch { setLastV2ListedLocal(null); }
  }, [address]);
  // Track my admin listing (Marketplace V1) from on-chain mapping
  useEffect(() => {
    let stop = false;
    async function run() {
      try {
        if (!publicClient || !address || !CONTRACTS.marketplace || !CONTRACTS.ticket) { if (!stop) setMyAdminListing(null); return; }
        let tid: bigint | null = null;
        if (tid == null) {
          const hint = lastAdminListedLocal;
          if (hint && hint.tokenId) {
            try { tid = BigInt(hint.tokenId); } catch { tid = null; }
          }
        }
        if (tid == null) {
          // Fallback 1: scan Marketplace V1 logs for my active listing(s)
          try {
            const logs = await publicClient.getLogs({
              address: CONTRACTS.marketplace as Address,
              abi: ABI.marketplace as any,
              eventName: "Listed",
              args: { seller: address as Address },
              fromBlock: DEPLOY_BLOCKS.marketplace,
              toBlock: "latest",
            } as any);
            for (let i = logs.length - 1; i >= 0; i--) {
              const lg: any = logs[i];
              const args = lg?.args;
              if (!args) continue;
              const candId = args.id as Hex;
              try {
                const rec = await publicClient.readContract({ address: CONTRACTS.marketplace as Address, abi: ABI.marketplace as any, functionName: "listings", args: [candId] } as any) as { seller: Address; nft: Address; tokenId: bigint; price: bigint; active: boolean };
                if (rec && rec.active && (rec.seller as string).toLowerCase() === (address as string).toLowerCase()) {
                  if (!stop) setMyAdminListing({ id: candId, price: rec.price, tokenId: rec.tokenId });
                  return;
                }
              } catch {}
            }
          } catch {}
          // Fallback 2: brute-force scan listing mapping by tokenId range
          try {
            const nextId = await publicClient.readContract({ address: CONTRACTS.ticket as Address, abi: ABI.ticket as any, functionName: "nextId", args: [] } as any) as bigint;
            for (let i = nextId; i >= 1n; i--) {
              const candId = keccak256(encodePacked(["address","uint256","address"], [CONTRACTS.ticket as Address, i, address as Address])) as Hex;
              try {
                const rec = await publicClient.readContract({ address: CONTRACTS.marketplace as Address, abi: ABI.marketplace as any, functionName: "listings", args: [candId] } as any) as { seller: Address; nft: Address; tokenId: bigint; price: bigint; active: boolean };
                if (rec && rec.active && (rec.seller as string).toLowerCase() === (address as string).toLowerCase()) {
                  if (!stop) setMyAdminListing({ id: candId, price: rec.price, tokenId: rec.tokenId });
                  return;
                }
              } catch {}
            }
          } catch {}
          if (!stop) setMyAdminListing(null);
          return;
        }
        const id = keccak256(encodePacked(["address","uint256","address"], [CONTRACTS.ticket as Address, tid as bigint, address as Address])) as Hex;
        const rec = await publicClient.readContract({ address: CONTRACTS.marketplace as Address, abi: ABI.marketplace as any, functionName: "listings", args: [id] } as any) as { seller: Address; nft: Address; tokenId: bigint; price: bigint; active: boolean };
        if (!stop && rec && rec.active && (rec.seller as string).toLowerCase() === (address as string).toLowerCase()) {
          setMyAdminListing({ id, price: rec.price, tokenId: rec.tokenId });
        } else if (!stop) {
          setMyAdminListing(null);
        }
      } catch {
        if (!stop) setMyAdminListing(null);
      }
    }
    run();
    return () => { stop = true; };
  }, [publicClient, address, lastAdminListedLocal]);
  // Approval for Marketplace V1 (admin listing flow)
  const { data: approvedForMarketplace } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.erc721 as any,
    functionName: "isApprovedForAll",
    args: address && CONTRACTS.marketplace ? [address as `0x${string}`, CONTRACTS.marketplace as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && CONTRACTS.ticket && CONTRACTS.marketplace) } as any,
  } as any);
  // Simple view helpers
  const adminHintEffective = Boolean(lastAdminListedLocal);
  const sellerView = Boolean(address && (hasTicketLike || adminHintEffective));
  const hideBuyCta = !address;

  // Admin listing is tracked separately via myAdminListing (Marketplace V1)
  // Prefer on-chain state; fall back to local hint so the banner appears immediately
  const adminBanner = useMemo<{ id: Hex; price: bigint; tokenId: bigint; fromHint?: boolean } | null>(() => {
    if (myAdminListing) return { ...myAdminListing };
    try {
      if (!lastAdminListedLocal || !address) return null;
      const same = lastAdminListedLocal.addr?.toLowerCase?.() === (address as string).toLowerCase();
      if (!same) return null;
      const t = BigInt(lastAdminListedLocal.tokenId);
      const p = BigInt(lastAdminListedLocal.priceWei);
      const id = keccak256(encodePacked(["address","uint256","address"], [CONTRACTS.ticket as Address, t, address as Address])) as Hex;
      return { id, price: p, tokenId: t, fromHint: true };
    } catch {
      return null;
    }
  }, [myAdminListing, lastAdminListedLocal, address]);

  // Public banner: only show when exactly one public listing is mine
  const myPublicBanner = useMemo<{ id: Hex; price: bigint; tokenId: bigint } | null>(() => {
    if (myAdminListing) return null;
    if (!myListings || myListings.length !== 1) return null;
    const l = myListings[0];
    return { id: l.id as Hex, price: l.price, tokenId: l.tokenId };
  }, [myAdminListing, myListings]);

  // Consider item already listed if listed publicly or with admin, including hints and direct presence in listings
  const alreadyListed = useMemo(() => {
    try { return Boolean(myAdminListing || adminBanner || (myListings && myListings.length > 0) || lastV2ListedLocal); }
    catch { return Boolean(myAdminListing || adminBanner || lastV2ListedLocal); }
  }, [myAdminListing, adminBanner, myListings, lastV2ListedLocal]);

  // Check global approvals for marketplaceV2 to list
  const { data: approvedForMarketV2 } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.erc721 as any,
    functionName: "isApprovedForAll",
    args: address && CONTRACTS.marketplaceV2 ? [address as `0x${string}`, CONTRACTS.marketplaceV2 as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && CONTRACTS.ticket && CONTRACTS.marketplaceV2) } as any,
  } as any);

  const sorted = useMemo(() => {
    try { return [...listings].sort((a,b) => Number(a.price) - Number(b.price)); } catch { return listings; }
  }, [listings]);

  // UI highlight helpers: make the turquoise outline follow the ticket activity
  const highlightAdmin = Boolean(adminBanner);
  const highlightPublic = Boolean(!highlightAdmin && myPublicBanner);
  const highlightOwned = Boolean(hasTicketLike && !highlightAdmin && !highlightPublic);
  const HL = ORANGE; // site accent (turquoise)

  async function ensureChain() {
    if (CONTRACTS.chainId && chainId && CONTRACTS.chainId !== chainId) {
      try { await switchChainAsync({ chainId: CONTRACTS.chainId }); }
      catch {
        push({ description: "Mauvaise chaîne. Bascule sur Base Sepolia.", variant: "error" });
        setLiveMsg("Mauvaise chaîne détectée. Bascule sur Base Sepolia.");
        throw new Error("WRONG_CHAIN");
      }
    }
  }

  useEffect(() => {
    if (!liveMsg) return;
    const t = setTimeout(() => setLiveMsg(""), 4000);
    return () => clearTimeout(t);
  }, [liveMsg]);

  // Removed single-listing fallback effect; rely on listings feed + optimistic cache from useV2ActiveListings

  // Compute listings to display
  // Keep a separate banner for my admin listing above.
  const displayListings = useMemo(() => {
    // We trust the listings feed (chain + optimistic) to contain my listings as well
    return [...sorted];
  }, [sorted]);

  return (
    <div className={`${manrope.className} mx-auto max-w-5xl p-4 sm:p-6`} style={{ backgroundColor: COLORS.CREAM, minHeight: "100vh" }}>
      <h1 className="text-2xl font-semibold uppercase tracking-wide" style={{ color: COLORS.TEXT }}>Marketplace</h1>
      {/* description removed per request */}
      <EnvGuard />
      <div aria-live="polite" role="status" className="sr-only">{liveMsg}</div>

      {hasTicketLike && (
        <div
          className="mt-3 rounded-md border px-3 py-2 text-sm transition-all"
          style={{
            background: COLORS.PANEL,
            borderColor: highlightOwned ? HL : COLORS.BORDER,
            color: COLORS.TEXT,
            boxShadow: highlightOwned ? `0 0 0 2px ${HL} inset` : "none",
          }}
        >
          Tu possèdes déjà un ticket. Tu ne peux pas en acheter un autre depuis ce wallet.
        </div>
      )}

      {/* Info banner when listed with admin (Marketplace V1) */}
      {adminBanner && (
        <div
          className="mt-3 p-3 border rounded text-sm flex items-center justify-between transition-all"
          style={{
            background: COLORS.PANEL,
            borderColor: highlightAdmin ? HL : COLORS.BORDER,
            color: COLORS.TEXT,
            boxShadow: highlightAdmin ? `0 0 0 2px ${HL} inset` : "none",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block align-middle text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: ORANGE, color: COLORS.TEXT }}>Admin</span>
            <div>Ton ticket est listé auprès de l’admin à <span className="font-semibold">{(Number(adminBanner.price) / 1e18).toFixed(6)} ETH</span></div>
          </div>
          <Button
            className="px-3 py-1.5 rounded"
            style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
            aria-busy={cancelingAdmin}
            aria-disabled={cancelingAdmin}
            disabled={cancelingAdmin}
            onClick={async () => {
              try {
                if (!CONTRACTS.marketplace || !adminBanner) return;
                await ensureChain();
                setCancelingAdmin(true);
                setLiveMsg("Annulation du listing admin en cours…");
                const tx = await writeContractAsync({ address: CONTRACTS.marketplace as `0x${string}`, abi: ABI.marketplace as any, functionName: "cancel", args: [CONTRACTS.ticket as `0x${string}`, adminBanner.tokenId] });
                await publicClient?.waitForTransactionReceipt({ hash: tx as any });
                push({ title: "Listing annulé", description: `Voir transaction: ${txUrl(tx as any)}`, variant: "success" });
                setLiveMsg("Listing admin annulé");
                setMyAdminListing(null);
                try { localStorage.removeItem(ADMIN_LS_KEY); } catch {}
                try { setLastAdminListedLocal(null); } catch {}
                refresh();
              } catch (e:any) {
                push({ description: e?.shortMessage || e?.message || "Erreur d'annulation", variant: "error" });
                setLiveMsg("Erreur lors de l’annulation du listing admin");
              } finally { setCancelingAdmin(false); }
            }}
          >Annuler</Button>
        </div>
      )}

      {/* Info banner when listed publicly (non-admin price). Use derived fallback if needed */}
      {myPublicBanner && (
        <div
          className="mt-3 p-3 border rounded text-sm flex items-center justify-between transition-all"
          style={{
            background: COLORS.PANEL,
            borderColor: highlightPublic ? HL : COLORS.BORDER,
            color: COLORS.TEXT,
            boxShadow: highlightPublic ? `0 0 0 2px ${HL} inset` : "none",
          }}
        >
          <div>Ton ticket est listé à <span className="font-semibold">{(Number(myPublicBanner.price) / 1e18).toFixed(6)} ETH</span></div>
          <Button
            className="px-3 py-1.5 rounded"
            style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
            aria-busy={cancelingMine}
            aria-disabled={cancelingMine}
            disabled={cancelingMine}
            onClick={async () => {
              try {
                if (!CONTRACTS.marketplaceV2 || !myPublicBanner) return;
                await ensureChain();
                setCancelingMine(true);
                setLiveMsg("Annulation du listing en cours…");
                // Pré-vérification on-chain: ne nettoyer l'UI que si INACTIF ET NON ESCROWÉ
                try {
                  if (publicClient) {
                    const [rec, owner] = await Promise.all([
                      publicClient.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [myPublicBanner.id] } as any) as Promise<{ active: boolean } & any>,
                      publicClient.readContract({ address: CONTRACTS.ticket as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [myPublicBanner.tokenId] } as any) as Promise<Address>,
                    ]);
                    const active = Boolean((rec as any)?.active);
                    const escrowed = typeof owner === "string" && owner.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                    if (!active && !escrowed) {
                      // Déjà annulé: nettoyer l'état local et sortir sans tx
                      try { localStorage.removeItem(V2_LS_KEY); } catch {}
                      try { setLastV2ListedLocal(null); } catch {}
                      try { hideListingById(myPublicBanner.id as any); } catch {}
                      refresh();
                      push({ description: "Listing déjà annulé sur la chaîne. État local nettoyé.", variant: "success" });
                      setLiveMsg("Listing déjà annulé");
                      return;
                    }
                  }
                } catch {}
                // Simulation avant envoi de la transaction cancel
                try {
                  await publicClient?.simulateContract({
                    account: address as `0x${string}`,
                    address: CONTRACTS.marketplaceV2 as `0x${string}`,
                    abi: ABI.marketplaceV2 as any,
                    functionName: "cancel",
                    args: [CONTRACTS.ticket as `0x${string}`, myPublicBanner.tokenId],
                  } as any);
                } catch (simErr:any) {
                  // Si la simulation échoue, vérifier si l'état on-chain indique déjà une annulation
                  try {
                    const [rec2, owner2] = await Promise.all([
                      publicClient!.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [myPublicBanner.id] } as any) as Promise<{ active: boolean } & any>,
                      publicClient!.readContract({ address: CONTRACTS.ticket as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [myPublicBanner.tokenId] } as any) as Promise<Address>,
                    ]);
                    const active2 = Boolean((rec2 as any)?.active);
                    const escrowed2 = typeof owner2 === "string" && owner2.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                    if (!active2 && !escrowed2) {
                      try { localStorage.removeItem(V2_LS_KEY); } catch {}
                      try { setLastV2ListedLocal(null); } catch {}
                      try { hideListingById(myPublicBanner.id as any); } catch {}
                      refresh();
                      push({ description: "Listing déjà annulé sur la chaîne. État local nettoyé.", variant: "success" });
                      setLiveMsg("Listing déjà annulé");
                      return;
                    }
                  } catch {}
                  push({ description: simErr?.shortMessage || simErr?.message || "Simulation d'annulation échouée", variant: "error" });
                  setLiveMsg("Erreur lors de la simulation d’annulation");
                  return;
                }
                const tx = await writeContractAsync({ address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "cancel", args: [CONTRACTS.ticket as `0x${string}`, myPublicBanner.tokenId] });
                await publicClient?.waitForTransactionReceipt({ hash: tx as any });
                push({ title: "Listing annulé", description: `Voir transaction: ${txUrl(tx as any)}`, variant: "success" });
                setLiveMsg("Listing annulé");
                try { localStorage.removeItem(V2_LS_KEY); } catch {}
                try { setLastV2ListedLocal(null); } catch {}
                try { hideListingById(myPublicBanner.id as any); } catch {}
                refresh();
              } catch (e:any) {
                push({ description: e?.shortMessage || e?.message || "Erreur d'annulation", variant: "error" });
                setLiveMsg("Erreur lors de l’annulation du listing");
              } finally { setCancelingMine(false); }
            }}
          >Annuler</Button>
        </div>
      )}

      {/* Actions container: Buyback and Public Listing side by side */}
      <div className="mt-6 grid gap-4 items-stretch grid-cols-1 md:grid-cols-2">
        {/* Buyback (admin) section copied from Marketplace V1, targeting Marketplace V1 */}
        <section className="border rounded-lg p-4 flex flex-col h-full min-h-[260px]" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: ORANGE }}>Buyback</div>
          <p className="text-sm font-semibold mt-1 text-black">Revente directe auprès de l'administration du site pour 90% de la valeur initiale du ticket.</p>
          <p className="text-xs text-gray-600 mt-1">Le rachat peut mettre jusque 24h maximum</p>
          <div className="mt-auto" />
          <div className="mt-3 h-[48px] flex items-center gap-2">
            {!mounted ? (
              <div className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]" style={{ backgroundColor: ORANGE }} />
            ) : sellerView ? (
              (() => {
                const disabledAdmin = selling || adminPrice === undefined || alreadyListed;
                const reasonAdmin = alreadyListed ? "Ton ticket est déjà listé" : (selling ? "Opération en cours" : (adminPrice === undefined ? "Chargement…" : ""));
                return (
                  <Tooltip content={<span>{reasonAdmin || "Lister auprès de l’admin"}</span>}>
                    <Button
                onClick={async () => {
                  try {
                    if (!address || !CONTRACTS.ticket) { push({ description: "Wallet/contrat indisponible.", variant: "error" }); return; }
                    if (!publicClient) { push({ description: "Client RPC indisponible. Recharge la page.", variant: "error" }); return; }
                    if (adminPrice === undefined) { push({ description: "Chargement du prix admin… réessaie dans un instant.", variant: "error" }); return; }
                    // Ensure correct chain
                    if (CONTRACTS.chainId && chainId && CONTRACTS.chainId !== chainId) {
                      try { await switchChainAsync({ chainId: CONTRACTS.chainId }); }
                      catch { push({ description: "Mauvaise chaîne. Bascule sur Base Sepolia.", variant: "error" }); return; }
                    }
                    // Resolve tokenId quickly
                    let tid: bigint | null = null;
                    if (tid == null) {
                      try { const cached = localStorage.getItem(`t4l_owned_token:${CONTRACTS.chainId}:${(address || "").toLowerCase()}`); if (cached) tid = BigInt(cached); } catch {}
                    }
                    if (tid == null) {
                      try {
                        const nextId = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "nextId", args: [] } as any) as bigint;
                        for (let i = 1n; i <= nextId; i++) {
                          const owner = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "ownerOf", args: [i] } as any) as `0x${string}`;
                          if (owner.toLowerCase() === (address as `0x${string}`).toLowerCase()) { tid = i; break; }
                        }
                      } catch {}
                    }
                    if (tid == null) { push({ description: "Impossible de détecter ton ticket. Réessaie après quelques secondes ou recharge.", variant: "error" }); return; }
                    setSelling(true);
                    setLiveMsg("Listing admin en cours…");
                    const priceToList = adminPrice as bigint;
                    // Approval for Marketplace V1
                    let needApprove = approvedForMarketplace === false;
                    if (approvedForMarketplace === undefined) {
                      try {
                        const direct = await publicClient.readContract({
                          address: CONTRACTS.ticket as `0x${string}`,
                          abi: ABI.erc721 as any,
                          functionName: "isApprovedForAll",
                          args: [address as `0x${string}`, CONTRACTS.marketplace as `0x${string}`],
                        } as any);
                        needApprove = direct === false;
                      } catch {}
                    }
                    if (needApprove) {
                      const approveHash = await writeContractAsync({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "setApprovalForAll", args: [CONTRACTS.marketplace as `0x${string}`, true] });
                      await publicClient?.waitForTransactionReceipt({ hash: approveHash as any });
                      push({ title: "Approbation réussie", description: `Voir transaction: ${txUrl(approveHash as any)}`, variant: "success" });
                    }
                    await withTxToasts(
                      { pending: "Listing admin en cours", success: "Ticket listé auprès de l’administrateur" },
                      async () => await writeContractAsync({ address: CONTRACTS.marketplace as `0x${string}`, abi: ABI.marketplace as any, functionName: "list", args: [CONTRACTS.ticket as `0x${string}`, tid, priceToList] }),
                      { onSuccess: () => {
                        setLiveMsg("Ticket listé auprès de l’administrateur");
                        try {
                          localStorage.setItem(ADMIN_LS_KEY, JSON.stringify({ addr: String(address), tokenId: String(tid), priceWei: String(priceToList) }));
                          const id = keccak256(encodePacked(["address","uint256","address"], [CONTRACTS.ticket as Address, tid as bigint, address as Address])) as Hex;
                          setMyAdminListing({ id, price: priceToList, tokenId: tid as bigint });
                        } catch {}
                        try { refreshAll(); } catch {}
                      } }
                    );
                  } catch (e:any) {
                    push({ description: (e?.shortMessage || e?.message || "Erreur lors du listing admin"), variant: "error" });
                    setLiveMsg("Erreur lors du listing admin");
                  } finally { setSelling(false); }
                }}
                disabled={disabledAdmin}
                className={`text-base px-4 py-3 rounded-md font-semibold min-w-[200px] ${disabledAdmin ? "cursor-not-allowed" : ""}`}
                style={disabledAdmin ? { backgroundColor: COLORS.PANEL, borderColor: COLORS.BORDER, color: COLORS.SUBTEXT } : { backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                aria-busy={selling}
                aria-disabled={disabledAdmin}
              >
                {selling ? "Vente…" : (adminPrice === undefined ? "Chargement…" : "Lister auprès de l’admin")}
              </Button>
                  </Tooltip>
                );
              })()
            ) : (
              address ? (
                <Button
                  onClick={() => { router.push("/"); }}
                  className={`text-base px-4 py-3 rounded-md font-semibold min-w-[200px]`}
                  style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                >
                  {"Acheter un ticket"}
                </Button>
              ) : (
                <Button
                  onClick={() => openConnectModal?.()}
                  className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
                  style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                >
                  {"Connecter mon wallet"}
                </Button>
              )
            )}
          </div>
        </section>

        {/* Revente libre section (public listing) */}
        <section className="border rounded-lg p-4 flex flex-col h-full min-h-[260px]" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: ORANGE }}>Revente libre</div>
          <p className="text-sm font-semibold mt-1 text-black">Reventes sur la place du marché</p>
          <p className="text-sm text-gray-600 mt-2">
            Liste ton ticket au prix souhaité (10% de commission)
            <Tooltip content={<span>La commission de 10% est retenue sur le prix de vente. Le net vendeur est indiqué ci-dessous.</span>}>
              <span className="ml-1 text-gray-400 cursor-help" aria-label="Aide: commission et net vendeur">[?]</span>
            </Tooltip>
          </p>
          <div className="mt-3">
            <label className="text-xs font-bold" style={{ color: ORANGE }}>Prix souhaité en ETH</label>
            <div className="mt-1">
              <label htmlFor="priceEth" className="sr-only">Prix en ETH</label>
              <input
                id="priceEth"
                className={`border rounded px-3 py-2 w-full ${listing ? "bg-gray-100" : ""} disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed`}
                style={{ backgroundColor: COLORS.PANEL, borderColor: COLORS.BORDER, color: COLORS.TEXT }}
                placeholder="0.001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={listing || !address || alreadyListed}
                aria-disabled={listing || !address || alreadyListed}
                aria-describedby="priceHelp"
                inputMode="decimal"
              />
              <span id="priceHelp" className="sr-only">Saisis le prix en ETH, par exemple 0.001</span>
            </div>
            {(() => {
              const p = parseFloat(price);
              const valid = !isNaN(p) && p > 0;
              const gross = valid ? p : 0.001;
              const fee = +(gross * 0.1).toFixed(6);
              const net = +(gross * 0.9).toFixed(6);
              return (
                <div className="mt-1 text-xs text-gray-500">Commission: 10% ({fee} ETH) • Net vendeur: {net} ETH</div>
              );
            })()}
          </div>
          <div className="mt-auto" />
          <div className="mt-3 h-[48px] flex items-center gap-2">
            {!mounted ? (
              <div className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]" style={{ backgroundColor: ORANGE }} />
            ) : sellerView ? (() => {
              const p = parseFloat(price);
              const priceInvalid = price.trim().length > 0 && (isNaN(p) || p <= 0);
              const disabled = listing || isApproving || priceInvalid || alreadyListed;
              const reason = alreadyListed
                ? "Ton ticket est déjà listé"
                : priceInvalid
                ? "Prix invalide"
                : (listing || isApproving)
                ? "Opération en cours"
                : "";
              return (
                <Tooltip content={<span>{reason || "Lister ton ticket"}</span>}>
                  <Button
                    onClick={async () => {
                      try {
                        if (!address) { openConnectModal?.(); return; }
                        if (!CONTRACTS.marketplaceV2 || !CONTRACTS.ticket) { push({ description: "Contrats indisponibles.", variant: "error" }); return; }
                        if (!publicClient) { push({ description: "Client RPC indisponible.", variant: "error" }); return; }
                        await ensureChain();
                        // find tokenId (use hook + cache only)
                        let tid: bigint | null = null;
                        if (tid == null) {
                          // quick fallback: scan nextId small loop (kept minimal)
                          try {
                            const nextId = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "nextId", args: [] } as any) as bigint;
                            for (let i = 1n; i <= nextId; i++) {
                              const owner = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "ownerOf", args: [i] } as any) as `0x${string}`;
                              if (owner.toLowerCase() === (address as `0x${string}`).toLowerCase()) { tid = i; break; }
                            }
                          } catch {}
                        }
                        if (tid == null) { push({ description: "Impossible de détecter ton ticket.", variant: "error" }); return; }
                        const input = (price ?? "").replace(",", ".").trim();
                        let priceWei: bigint;
                        try {
                          priceWei = parseEther(input === "" ? "0.001" : input);
                        } catch {
                          push({ description: "Prix invalide. Utilise un nombre, ex: 0.001", variant: "error" });
                          return;
                        }
                        // need approval?
                        let needApprove = approvedForMarketV2 === false;
                        if (approvedForMarketV2 === undefined) {
                          try {
                            const direct = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.erc721 as any, functionName: "isApprovedForAll", args: [address as `0x${string}`, CONTRACTS.marketplaceV2 as `0x${string}`] } as any);
                            needApprove = direct === false;
                          } catch {}
                        }
                        setListing(true);
                        setLiveMsg(needApprove ? "Approbation en cours…" : "Listing en cours…");
                        if (needApprove) {
                          setIsApproving(true);
                          const approveHash = await writeContractAsync({
                            address: CONTRACTS.ticket as `0x${string}`,
                            abi: ABI.ticket as any,
                            functionName: "setApprovalForAll",
                            args: [CONTRACTS.marketplaceV2 as `0x${string}`, true],
                          });
                          await publicClient.waitForTransactionReceipt({ hash: approveHash as any });
                          push({ title: "Approbation réussie", description: `Voir transaction: ${txUrl(approveHash as any)}`, variant: "success" });
                          setIsApproving(false);
                        }
                        // simulate + tx
                        try {
                          await publicClient.simulateContract({ account: address as `0x${string}`, address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "list", args: [CONTRACTS.ticket as `0x${string}`, tid, priceWei] } as any);
                        } catch (simErr:any) { push({ description: simErr?.shortMessage || simErr?.message || "Simulation de listing échouée", variant: "error" }); setListing(false); return; }
                        await withTxToasts(
                          { pending: "Listing en cours", success: "Listing créé" },
                          async () => await writeContractAsync({ address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "list", args: [CONTRACTS.ticket as `0x${string}`, tid, priceWei] }),
                          { onSuccess: () => {
                            setLiveMsg("Listing créé");
                            try {
                              addOptimisticListing({ nft: CONTRACTS.ticket as Address, tokenId: tid as bigint, price: priceWei, seller: address as Address });
                              const id = keccak256(encodePacked(["address","uint256","address"], [CONTRACTS.ticket as Address, tid as bigint, address as Address])) as Hex;
                              // persist hint for reloads
                              try {
                                localStorage.setItem(V2_LS_KEY, JSON.stringify({ addr: String(address), tokenId: String(tid), priceWei: String(priceWei), id }));
                              } catch {}
                            } catch {}
                          } }
                        );
                      } catch (e:any) {
                        push({ description: (e?.shortMessage || e?.message || "Erreur lors du listing"), variant: "error" });
                      } finally {
                        setListing(false);
                      }
                    }}
                    disabled={disabled || !address}
                    className={`text-base px-4 py-3 rounded-md font-semibold min-w-[200px] ${disabled ? "cursor-not-allowed" : ""}`}
                    style={disabled ? { backgroundColor: COLORS.PANEL, borderColor: COLORS.BORDER, color: COLORS.SUBTEXT } : { backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                    aria-busy={listing || isApproving}
                    aria-disabled={disabled || !address}
                  >
                    {listing ? (isApproving ? "Approbation…" : "Listing…") : (priceInvalid ? "Prix invalide" : "Vendre son ticket sur la marketplace")}
                  </Button>
                </Tooltip>
              );
            })() : (
              address ? (
                <Button
                  onClick={() => { router.push("/"); }}
                  className={`text-base px-4 py-3 rounded-md font-semibold min-w-[200px]`}
                  style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                >
                  {"Acheter un ticket"}
                </Button>
              ) : (
                <Button
                  onClick={() => openConnectModal?.()}
                  className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
                  style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                >
                  {"Connecter mon wallet"}
                </Button>
              )
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold uppercase tracking-wide" style={{ color: COLORS.TEXT }}>TICKET MIS EN VENTE</h2>
        </div>
        {loading && displayListings.length === 0 ? (
          <div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" role="status" aria-live="polite">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border rounded overflow-hidden flex flex-col" style={{ backgroundColor: COLORS.PANEL, borderColor: COLORS.BORDER }}>
                  <div className="relative w-full" style={{ paddingTop: "66%" }}>
                    <div className="absolute inset-0">
                      <Skeleton className="w-full h-full" />
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-28 mt-2" />
                    <Skeleton className="h-9 w-28 mt-3" />
                  </div>
                </div>
              ))}
            </div>
            <VisuallyHidden>Chargement des listings…</VisuallyHidden>
          </div>
        ) : displayListings.length === 0 ? (
          <div className="text-sm text-gray-600">Aucun listing pour le moment.</div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayListings.map((l) => {
              const isMine = address && l.seller.toLowerCase() === (address as any).toLowerCase();
              const eth = Number(l.price) / 1e18;
              const id = l.id as string;
              return (
                <div
                  key={id}
                  className="border rounded-lg overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  style={{ backgroundColor: COLORS.PANEL, borderColor: COLORS.BORDER, borderTop: `3px solid ${ORANGE}` }}
                >
                  <div className="relative w-full" style={{ paddingTop: "66%" }}>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${COLORS.PANEL} 0%, #ffffff 100%)` }}
                    >
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Ticket #{Number(l.tokenId)}</div>
                        <div className="inline-block px-3 py-1 rounded" style={{ backgroundColor: ORANGE, color: COLORS.TEXT }}>T4L</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm text-gray-500">Vendeur · {l.seller.slice(0, 6)}…{l.seller.slice(-4)}</div>
                    <div className="mt-1 text-lg font-bold">{eth.toFixed(6)} ETH</div>
                    <div className="mt-3 flex gap-2">
                      {isMine ? (
                        <Button
                          className={`px-3 py-1.5 rounded ${canceling === id ? "opacity-60 cursor-wait" : ""}`}
                          style={{ backgroundColor: ORANGE, borderColor: ORANGE, color: COLORS.TEXT }}
                          onClick={async () => {
                            try {
                              if (!CONTRACTS.marketplaceV2) return;
                              await ensureChain();
                              const pendingId = push({ variant: "pending", title: "Annulation en cours", description: "Signature et inclusion…" });
                              setCanceling(id);
                              setLiveMsg("Annulation du listing en cours…");
                              // Pré-vérification on-chain: ne nettoyer l'UI que si INACTIF ET NON ESCROWÉ
                              try {
                                if (publicClient) {
                                  const [rec, owner] = await Promise.all([
                                    publicClient.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [l.id] } as any) as Promise<{ active: boolean } & any>,
                                    publicClient.readContract({ address: l.nft as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [l.tokenId] } as any) as Promise<Address>,
                                  ]);
                                  const active = Boolean((rec as any)?.active);
                                  const escrowed = typeof owner === "string" && owner.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                                  if (!active && !escrowed) {
                                    remove(pendingId);
                                    try { removeOptimisticListing({ nft: l.nft as any, tokenId: l.tokenId as any, seller: address as any }); hideListingById(l.id as any); refresh(); } catch {}
                                    try { localStorage.removeItem(V2_LS_KEY); } catch {}
                                    try { setLastV2ListedLocal(null); } catch {}
                                    push({ description: "Listing déjà annulé sur la chaîne. État local nettoyé.", variant: "success" });
                                    setLiveMsg("Listing déjà annulé");
                                    return;
                                  }
                                }
                              } catch {}
                              // Simulation avant envoi de la transaction cancel
                              try {
                                await publicClient?.simulateContract({
                                  account: address as `0x${string}`,
                                  address: CONTRACTS.marketplaceV2 as `0x${string}`,
                                  abi: ABI.marketplaceV2 as any,
                                  functionName: "cancel",
                                  args: [l.nft, l.tokenId],
                                } as any);
                              } catch (simErr:any) {
                                // Vérifier si l'état indique déjà une annulation; si oui, nettoyer l'UI
                                try {
                                  const [rec2, owner2] = await Promise.all([
                                    publicClient!.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [l.id] } as any) as Promise<{ active: boolean } & any>,
                                    publicClient!.readContract({ address: l.nft as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [l.tokenId] } as any) as Promise<Address>,
                                  ]);
                                  const active2 = Boolean((rec2 as any)?.active);
                                  const escrowed2 = typeof owner2 === "string" && owner2.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                                  if (!active2 && !escrowed2) {
                                    remove(pendingId);
                                    try { removeOptimisticListing({ nft: l.nft as any, tokenId: l.tokenId as any, seller: address as any }); hideListingById(l.id as any); refresh(); } catch {}
                                    try { localStorage.removeItem(V2_LS_KEY); } catch {}
                                    try { setLastV2ListedLocal(null); } catch {}
                                    push({ description: "Listing déjà annulé sur la chaîne. État local nettoyé.", variant: "success" });
                                    setLiveMsg("Listing déjà annulé");
                                    return;
                                  }
                                } catch {}
                                remove(pendingId);
                                push({ description: simErr?.shortMessage || simErr?.message || "Simulation d'annulation échouée", variant: "error" });
                                setLiveMsg("Erreur lors de la simulation d’annulation");
                                return;
                              }
                              const tx = await writeContractAsync({ address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "cancel", args: [l.nft, l.tokenId] });
                              await publicClient?.waitForTransactionReceipt({ hash: tx as any });
                              remove(pendingId);
                              push({ title: "Listing annulé", description: `Voir transaction: ${txUrl(tx as any)}`, variant: "success" });
                              setLiveMsg("Listing annulé");
                              try { removeOptimisticListing({ nft: l.nft as any, tokenId: l.tokenId as any, seller: address as any }); hideListingById(l.id as any); refresh(); } catch {}
                              try { localStorage.removeItem(V2_LS_KEY); } catch {}
                              try { setLastV2ListedLocal(null); } catch {}
                            } catch (e:any) {
                              push({ description: e?.shortMessage || e?.message || "Erreur d'annulation", variant: "error" });
                              setLiveMsg("Erreur lors de l’annulation du listing");
                            } finally { setCanceling(null); }
                          }}
                        >Annuler</Button>
                      ) : (
                        <Button
                          className={`px-3 py-1.5 rounded ${buying === id ? "opacity-60 cursor-wait" : ""}`}
                          style={{ backgroundColor: hasTicketLike ? COLORS.PANEL : ORANGE, borderColor: hasTicketLike ? COLORS.BORDER : ORANGE, color: hasTicketLike ? COLORS.SUBTEXT : COLORS.TEXT }}
                          disabled={hasTicketLike || buying === id}
                          aria-disabled={hasTicketLike || buying === id}
                          aria-busy={buying === id}
                          title={hasTicketLike ? "Tu as déjà un ticket" : "Acheter ce ticket"}
                          onClick={async () => {
                            try {
                              if (!address) { openConnectModal?.(); return; }
                              if (!CONTRACTS.marketplaceV2) return;
                              await ensureChain();
                              setBuying(id);
                              setLiveMsg(`Achat du ticket #${Number(l.tokenId)} en cours…`);
                              // simulate
                              try {
                                await publicClient?.simulateContract({ account: address as `0x${string}`, address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "buy", args: [l.nft, l.tokenId, l.seller], value: l.price } as any);
                              } catch (simErr:any) {
                                // Vérifier si le listing est déjà indisponible (INACTIF ET NON ESCROWÉ) et nettoyer l'UI si besoin
                                try {
                                  const [rec2, owner2] = await Promise.all([
                                    publicClient!.readContract({ address: CONTRACTS.marketplaceV2 as Address, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [l.id] } as any) as Promise<{ active: boolean } & any>,
                                    publicClient!.readContract({ address: l.nft as Address, abi: ABI.ticket as any, functionName: "ownerOf", args: [l.tokenId] } as any) as Promise<Address>,
                                  ]);
                                  const active2 = Boolean((rec2 as any)?.active);
                                  const escrowed2 = typeof owner2 === "string" && owner2.toLowerCase() === (CONTRACTS.marketplaceV2 as Address).toLowerCase();
                                  if (!active2 && !escrowed2) {
                                    try { removeOptimisticListing({ nft: l.nft as any, tokenId: l.tokenId as any, seller: l.seller as any }); hideListingById(l.id as any); refresh(); } catch {}
                                    push({ description: "Ce listing n'est plus disponible. UI rafraîchie.", variant: "success" });
                                    setLiveMsg("Listing indisponible");
                                    setBuying(null);
                                    return;
                                  }
                                } catch {}
                                push({ description: simErr?.shortMessage || simErr?.message || "Simulation d'achat échouée", variant: "error" });
                                setBuying(null);
                                return;
                              }
                              await withTxToasts(
                                { pending: "Achat en cours", success: "Achat réussi" },
                                async () => await writeContractAsync({ address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "buy", args: [l.nft, l.tokenId, l.seller], value: l.price } as any),
                                { onSuccess: () => { setLiveMsg("Achat réussi"); try { removeOptimisticListing({ nft: l.nft as any, tokenId: l.tokenId as any, seller: l.seller as any }); hideListingById(l.id as any); setJustBought(true); refresh(); } catch {} } }
                              );
                            } catch (e:any) {
                              push({ description: e?.shortMessage || e?.message || "Erreur d'achat", variant: "error" });
                              setLiveMsg("Erreur lors de l’achat");
                            } finally { setBuying(null); }
                          }}
                        >{buying === id ? "Achat…" : (!address ? "Connecter mon wallet" : (hasTicket ? "Déjà 1 ticket" : "Acheter"))}</Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
