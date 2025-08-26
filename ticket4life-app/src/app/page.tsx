"use client";

import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { CONTRACTS, ABI } from "@/config/contracts";
import { useWriteContract } from "wagmi";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/lib/toast";
import { Skeleton, Button } from "@/components/ui";
import { useTxToasts } from "@/lib/txToasts";
import { useRefresh } from "@/components/SyncProvider";
// import { Tooltip } from "@/components/Tooltip";
import { formatEther, keccak256, encodePacked } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import QuizWidget from "@/components/QuizWidget";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { push, remove } = useToast();
  const [minting, setMinting] = useState(false);
  const mintingRef = useRef(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { withTxToasts } = useTxToasts();
  const { refreshAll } = useRefresh();
  const { openConnectModal } = useConnectModal();
  // Flat theme palette (aligned with Quiz/FAQ)
  const COLORS = {
    CREAM: "#F6EADA",
    PANEL: "#FAF0E3",
    PANEL_HOVER: "#F3E9D7",
    BORDER: "#E6D8C6",
    TEXT: "#111111",
    SUBTEXT: "#6B6B6B",
    CTA: "#27E7C5",
  } as const;
  const ORANGE = COLORS.CTA; // teal CTA
  const LAST_PUBLIC_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplace || "").toLowerCase();
    return `t4l_last_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);
  const ADMIN_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplace || "").toLowerCase();
    return `t4l_admin_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);
  // V2: hint for user's last public listing (banner) on marketplace V2
  const V2_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplaceV2 || "").toLowerCase();
    return `t4l_v2_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);
  const [lastListedLocal, setLastListedLocal] = useState<{ addr: string; tokenId: string; priceWei: string; type?: string } | null>(null);
  const [lastAdminLocal, setLastAdminLocal] = useState<{ addr: string; tokenId: string; priceWei: string } | null>(null);
  const [lastListingActive, setLastListingActive] = useState<boolean | null>(null);
  const [lastV2ListedLocal, setLastV2ListedLocal] = useState<{ addr: string; tokenId: string; priceWei?: string } | null>(null);
  const [lastV2ListingActive, setLastV2ListingActive] = useState<boolean | null>(null);
  // One-time migration: clear old un-namespaced keys
  useEffect(() => {
    try { localStorage.removeItem("t4l_last_listing"); } catch {}
    try { localStorage.removeItem("t4l_admin_listing"); } catch {}
  }, []);
  // Action centrale de mint (réutilisée dans l'étape 1)
  const handleMint = async () => {
    if (mintingRef.current) return;
    if (hasOnchain && !isOwner) {
      push({ description: "Tu détiens déjà un ticket avec ce wallet.", variant: "info" });
      return;
    }
    try {
      mintingRef.current = true;
      setMinting(true);
      if (typeof mintPrice !== "bigint") {
        push({ description: "Prix du mint non chargé. Réessaie dans un instant.", variant: "info" });
        return;
      }
      await withTxToasts(
        { pending: "Transaction en cours…", success: "Mint confirmé" },
        async () => await writeContractAsync({
          address: CONTRACTS.ticket as `0x${string}`,
          abi: ABI.ticket as any,
          functionName: "mint",
          args: [],
          value: mintPrice as any,
        }),
        { onSuccess: () => { refreshAll(); router.push("/quiz?minted=1"); } }
      );
    } catch (e: any) {
      // Close any pending toast if present
      push({ description: e?.shortMessage || e?.message || "Échec du mint on-chain", variant: "error" });
    } finally {
      mintingRef.current = false;
      setMinting(false);
    }
  };
  // Détection ownership on-chain
  const { data: chainBal } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: (ABI.erc721 as any),
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(CONTRACTS.ticket && address) } as any,
  } as any);
  // Detect contract owner to bypass one-per-wallet in UI for admin
  const { data: ticketOwner } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: (ABI.ticket as any),
    functionName: "owner",
    args: [],
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const hasOnchain = typeof chainBal === "bigint" ? chainBal !== BigInt(0) : false;
  // Évite le clignotement: tant que balanceOf n'est pas chargé, on ne bascule pas l'UI
  const ownershipLoaded = !address || typeof chainBal === "bigint";
  const isOwner = ticketOwner && address && (String(ticketOwner).toLowerCase() === String(address).toLowerCase());

  // Charger la persistance des listings (public + admin)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_PUBLIC_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.addr && address && parsed.addr.toLowerCase() === String(address).toLowerCase()) {
          setLastListedLocal(parsed);
        } else {
          setLastListedLocal(null);
        }
      } else {
        setLastListedLocal(null);
      }
    } catch { setLastListedLocal(null); }
    try {
      const rawA = localStorage.getItem(ADMIN_LS_KEY);
      if (rawA) {
        const parsedA = JSON.parse(rawA);
        if (parsedA?.addr && address && parsedA.addr.toLowerCase() === String(address).toLowerCase()) {
          setLastAdminLocal(parsedA);
        } else {
          setLastAdminLocal(null);
        }
      } else {
        setLastAdminLocal(null);
      }
    } catch { setLastAdminLocal(null); }
    // V2 local hint
    try {
      const rawV2 = localStorage.getItem(V2_LS_KEY);
      if (rawV2) {
        const parsedV2 = JSON.parse(rawV2);
        if (parsedV2?.addr && address && parsedV2.addr.toLowerCase() === String(address).toLowerCase()) {
          setLastV2ListedLocal(parsedV2);
        } else {
          setLastV2ListedLocal(null);
        }
      } else {
        setLastV2ListedLocal(null);
      }
    } catch { setLastV2ListedLocal(null); }
  }, [address]);

  // Vérifier on-chain si un listing persistant est actif
  useEffect(() => {
    (async () => {
      try {
        if (!publicClient || !CONTRACTS.marketplace || !CONTRACTS.ticket) return;
        // Priorité: public, sinon admin
        const local = lastListedLocal && address && lastListedLocal.addr?.toLowerCase() === String(address).toLowerCase()
          ? lastListedLocal
          : (lastAdminLocal && address && lastAdminLocal.addr?.toLowerCase() === String(address).toLowerCase() ? lastAdminLocal : null);
        if (!local) { setLastListingActive(false); return; }
        setLastListingActive(null); // loading
        const seller = local.addr as `0x${string}`;
        const nft = CONTRACTS.ticket as `0x${string}`;
        const tid = BigInt(local.tokenId);
        const id = keccak256(encodePacked(["address","uint256","address"], [nft, tid, seller]));
        const res: any = await publicClient.readContract({ address: CONTRACTS.marketplace as `0x${string}`, abi: ABI.marketplace as any, functionName: "listings", args: [id] } as any);
        const active = !!(res && (res.active === true || res[4] === true));
        const sellerOk = !res?.seller || String(res.seller).toLowerCase() === seller.toLowerCase();
        setLastListingActive(active && sellerOk);
        if (!(active && sellerOk)) {
          try { localStorage.removeItem(LAST_PUBLIC_LS_KEY); } catch {}
          try { localStorage.removeItem(ADMIN_LS_KEY); } catch {}
        }
      } catch {
        setLastListingActive(null);
      }
    })();
  }, [lastListedLocal, lastAdminLocal, address, publicClient]);

  // Vérifier on-chain si un listing V2 persistant est actif et escrowé au marketplaceV2
  useEffect(() => {
    (async () => {
      try {
        if (!publicClient || !CONTRACTS.marketplaceV2 || !CONTRACTS.ticket) return;
        const local = lastV2ListedLocal && address && lastV2ListedLocal.addr?.toLowerCase() === String(address).toLowerCase()
          ? lastV2ListedLocal
          : null;
        if (!local) { setLastV2ListingActive(false); return; }
        setLastV2ListingActive(null); // loading
        const seller = local.addr as `0x${string}`;
        const nft = CONTRACTS.ticket as `0x${string}`;
        const tid = BigInt(local.tokenId);
        const id = keccak256(encodePacked(["address","uint256","address"], [nft, tid, seller]));
        const rec: any = await publicClient.readContract({ address: CONTRACTS.marketplaceV2 as `0x${string}`, abi: ABI.marketplaceV2 as any, functionName: "listings", args: [id] } as any);
        const active = !!(rec && (rec.active === true || rec[4] === true));
        // Optionnel mais plus robuste: vérifier que le NFT est bien en escrow sur marketplaceV2
        const owner: any = await publicClient.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: "ownerOf", args: [tid] } as any);
        const escrowed = typeof owner === "string" && owner.toLowerCase() === String(CONTRACTS.marketplaceV2).toLowerCase();
        const sellerOk = !rec?.seller || String(rec.seller).toLowerCase() === seller.toLowerCase();
        const ok = active && escrowed && sellerOk;
        setLastV2ListingActive(ok);
        if (!ok) {
          try { localStorage.removeItem(V2_LS_KEY); } catch {}
        }
      } catch {
        setLastV2ListingActive(null);
      }
    })();
  }, [lastV2ListedLocal, address, publicClient]);

  // Tickets vendus (on-chain): ticket.nextId() comme compteur simple
  const { data: nextId } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "nextId",
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const minted = useMemo(() => {
    if (typeof nextId !== "bigint") return 0;
    const n = Number(nextId);
    // Clamp to 0 to avoid negative display when contract returns 0
    return Math.max(0, n - 1);
  }, [nextId]);

  // Prix et treasury on-chain (diagnostic & affichage)
  const { data: mintPrice } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "MINT_PRICE",
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const { data: ticketTreasury } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "treasury",
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const mintPriceEth = useMemo(() => (typeof mintPrice === "bigint" ? Number(mintPrice) / 1e18 : 0.001), [mintPrice]);

  // Prize pool (on-chain)
  const { data: prizePool } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "prizePool",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  const prize = useMemo(() => (typeof prizePool === "bigint" ? Number(prizePool) / 1e18 : 0), [prizePool]);

  // TVL (off-chain) — total USDC from /api/treasury
  const [tvlUsdc, setTvlUsdc] = useState<number | null>(null);
  const [tvlLoading, setTvlLoading] = useState<boolean>(false);
  useEffect(() => {
    const load = async () => {
      try {
        setTvlLoading(true);
        const res = await fetch('/api/treasury', { cache: 'no-store' });
        if (!res.ok) throw new Error('fail');
        const data = await res.json();
        const entries = Array.isArray(data?.entries) ? data.entries : [];
        const total = entries.reduce((s: number, e: any) => s + (Number(e.usdc)||0), 0);
        setTvlUsdc(total);
      } catch {
        setTvlUsdc(null);
      } finally {
        setTvlLoading(false);
      }
    };
    load();
  }, []);
  const hasTicketOrListed = hasOnchain
    || (!!lastListedLocal && lastListingActive !== false)
    || (!!lastAdminLocal && lastListingActive !== false)
    || (!!lastV2ListedLocal && lastV2ListingActive !== false);
  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: COLORS.CREAM, minHeight: "100vh" }}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Bandeau gagnant retiré (mock). On pourra lier à un event/contrat de distribution si nécessaire. */}
      <section className="py-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2" style={{ color: COLORS.TEXT }}>Ticket<span style={{ color: ORANGE }}>4</span>Life</h1>
        <p className="mt-2 max-w-2xl" style={{ color: COLORS.SUBTEXT }}>
          Mint un ticket NFT. Chaque semaine, réponds au quiz pour être éligible au tirage.
          Si tu es tiré au sort, tu reçois le prize sur ton wallet. Tu peux revendre ton ticket quand tu veux.
        </p>
        <div className="mt-0" />
      </section>

      {/* Mon statut — déplacé en bas de page */}

      {/* Stats overview */}
      <section className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Prix du ticket</div>
          <div className="text-xl font-semibold">
            {typeof mintPrice === "bigint" ? (
              <>{formatEther(mintPrice as bigint)} ETH</>
            ) : (
              <Skeleton className="h-6 w-24 mt-1" />
            )}
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Prize Money de cette semaine</div>
          <div className="text-xl font-semibold">
            {typeof prizePool === "bigint" ? (
              <>{prize.toFixed(3)} ETH</>
            ) : (
              <Skeleton className="h-6 w-28 mt-1" />
            )}
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Tickets vendus</div>
          <div className="text-xl font-semibold">
            {typeof nextId === "bigint" ? (
              <>{minted}</>
            ) : (
              <Skeleton className="h-6 w-10 mt-1" />
            )}
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Total value Locked</div>
          <div className="text-xl font-semibold">
            {tvlUsdc !== null ? (
              <>{tvlUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</>
            ) : (
              <Skeleton className="h-6 w-28 mt-1" />
            )}
          </div>
        </div>
      </section>

      {/* Quiz countdown + eligibility — déplacé sous "Comment ça marche" */}

      {/* Explainer: Comment ça marche ? */}
      <section className="mt-5">
        <h2 className="text-xl font-semibold" style={{ color: COLORS.TEXT }}>Comment ça marche ?</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          {/* Étape 1 */}
          <div
            className="rounded-lg p-4 flex flex-col h-full min-h-[260px]"
            style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}
          >
            <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Étape 1</div>
            <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>Mintez votre ticket</div>
            <p className="text-sm mt-2" style={{ color: COLORS.SUBTEXT }}>
              Un ticket par wallet à la fois. Gardez-le aussi longtemps que vous voulez — votre accès au projet.
            </p>
            <div className="mt-auto" />
            <div className="mt-3 h-[48px] flex items-center">
              {!isConnected ? (
                <Button
                  className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
                  style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
                  onClick={() => openConnectModal?.()}
                >
                  Connecter mon wallet
                </Button>
              ) : !ownershipLoaded ? (
                <Button disabled className="text-base px-4 py-3 border rounded-md text-gray-400 cursor-not-allowed w-full sm:w-auto min-w-[200px]">
                  Chargement…
                </Button>
              ) : !hasTicketOrListed ? (
                <Button
                  className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
                  style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
                  disabled={minting || typeof mintPrice !== "bigint"}
                  aria-busy={minting}
                  onClick={handleMint}
                >
                  {minting ? "En attente…" : `Mintez votre ticket (${mintPrice ? formatEther(mintPrice as bigint) : "…"} ETH)`}
                </Button>
              ) : (
                hasOnchain ? (
                  <div className="text-base px-4 py-3 rounded-md inline-block min-w-[200px]" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}`, color: COLORS.TEXT }}>Vous avez votre ticket</div>
                ) : lastListingActive === null ? (
                  <div className="text-base px-4 py-3 border rounded-md inline-block min-w-[200px]" style={{ borderColor: COLORS.BORDER, color: COLORS.SUBTEXT }}>Vérification de votre listing…</div>
                ) : (
                  <Link href="/marketplaceV2" className="text-base px-4 py-3 rounded-md inline-block min-w-[200px]" style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}>Gérer ma vente</Link>
                )
              )}
            </div>
          </div>
          {/* Étape 2 */}
          <div
            className="rounded-lg p-4 flex flex-col h-full min-h-[260px]"
            style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}
          >
            <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Étape 2</div>
            <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>Participez au quiz chaque semaine</div>
            <p className="text-sm mt-2" style={{ color: COLORS.SUBTEXT }}>
              Répondez chaque semaine avant la deadline pour rendre votre ticket <span className="font-medium">éligible au tirage au sort</span>
              et tenter de <span className="font-medium">gagner le prize money</span>.
            </p>
            <div className="mt-auto" />
            <div className="mt-3 h-[48px] flex items-center">
              {!ownershipLoaded ? (
                <Button disabled className="text-base px-4 py-3 border rounded-md text-gray-400 cursor-not-allowed w-full sm:w-auto min-w-[200px]">
                  Chargement…
                </Button>
              ) : hasOnchain ? (
                <Link
                  href="/quiz"
                  className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
                  style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
                >
                  Participer au quiz
                </Link>
              ) : null}
            </div>
          </div>
          {/* Étape 3 remplacée par Quiz de la semaine (compact) */}
          <div className="rounded-lg p-4 flex flex-col h-full min-h-[260px]" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
            <QuizWidget variant="compact" />
          </div>
        </div>
      </section>

      {/* Étape 3 — zone large */}
      <section className="mt-5">
        <div className="rounded-lg p-4" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}>
          <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>Revendez quand vous voulez</div>
          <p className="text-sm mt-2" style={{ color: COLORS.SUBTEXT }}>
            Vous pouvez mettre votre ticket en vente sur la marketplace à tout moment.
            Après revente, vous pourrez en minter un nouveau plus tard si vous le souhaitez.
          </p>
          <div className="mt-3 h-[48px] flex items-center">
            <Link
              href="/marketplaceV2"
              className="text-base px-4 py-3 rounded-md font-semibold min-w-[200px]"
              style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
            >
              Aller à la marketplace
            </Link>
          </div>
          <div className="mt-1" />
        </div>
      </section>

      {/* Mon statut retiré */}
      </div>
    </div>
  );
}
