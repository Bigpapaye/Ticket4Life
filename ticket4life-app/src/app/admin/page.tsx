"use client";

import { useAccount, useWriteContract, useReadContract, usePublicClient, useChainId, useSwitchChain, useSignMessage } from "wagmi";
import { useMemo } from "react";
import { isAdmin } from "@/config/adminWallets";
import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast";
import { CONTRACTS, ABI } from "@/config/contracts";
import { parseEther, isAddress, createPublicClient, http, keccak256, toHex } from "viem";
import { baseSepolia } from "viem/chains";
import { useActiveListings } from "@/hooks/useMarketplace";
import { txUrl, addrUrl } from "@/lib/explorer";
import { BRAND_ORANGE, BG_PANEL, BG_CREAM, BG_PANEL_HOVER, BORDER, TEXT_PRIMARY, TEXT_SUBTLE } from "@/styles/theme";
import { formatTxError } from "@/lib/formatTxError";
import { usePendingTxToast } from "@/hooks/usePendingTxToast";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Manrope } from "next/font/google";
import { APP } from "@/config/app";
 

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400","600","700"] });

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const allowed = mounted && isConnected && isAdmin(address ?? null);
  const { writeContractAsync } = useWriteContract();
  const ORANGE = BRAND_ORANGE;
  const { withPendingToast } = usePendingTxToast();
  // One-time migration: clear old un-namespaced admin key
  useEffect(() => {
    try { localStorage.removeItem('t4l_admin_listing'); } catch {}
  }, []);
  // Quiz ownership and registry linkage
  const { data: quizOwner } = useReadContract({
    address: (CONTRACTS.quiz || "0x") as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "owner",
    args: [],
    query: { enabled: Boolean(CONTRACTS.quiz) } as any,
  } as any);
  const { data: quizRegistry } = useReadContract({
    address: (CONTRACTS.quiz || "0x") as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "registry",
    args: [],
    query: { enabled: Boolean(CONTRACTS.quiz) } as any,
  } as any);
  const [autoLinking, setAutoLinking] = useState(false);
  const [autoLinkedOnce, setAutoLinkedOnce] = useState(false);
  // Treasury on-chain pools
  const { data: salePool } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "salePool",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  const { data: treasuryOwner } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "owner",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  const { data: prizePool } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "prizePool",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  const { data: buybackPool } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "buybackPool",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  // On-chain marketplace listings
  const { listings, removeListingById } = useActiveListings();
  // Admin price = 90% du prix original (MINT_PRICE)
  const { data: mintPrice } = useReadContract({
    address: (CONTRACTS.ticket || "0x") as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "MINT_PRICE",
    args: [],
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const adminPrice: bigint | undefined = typeof mintPrice === "bigint" ? ((mintPrice as bigint) * BigInt(90)) / BigInt(100) : undefined;
  // Base filter: only listings at admin price
  const adminEligible = useMemo(() => {
    if (!Array.isArray(listings)) return [] as typeof listings;
    if (adminPrice === undefined) return listings; // fallback while price is loading
    return listings.filter((l) => typeof l.price === "bigint" && (l.price as bigint) === adminPrice);
  }, [listings, adminPrice]);

  // Namespaced localStorage key for admin listing hint
  const ADMIN_LS_KEY = useMemo(() => {
    const addr = (CONTRACTS.marketplace || "").toLowerCase();
    return `t4l_admin_listing:${CONTRACTS.chainId}:${addr}`;
  }, []);

  // Inject a local admin listing from marketplace hint so it appears instantly in the widget
  const adminEligibleDisplay = useMemo(() => {
    try {
      const arr = [...adminEligible];
      const raw = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_LS_KEY) : null;
      if (!raw) return arr;
      const parsed = JSON.parse(raw) as { addr: string; tokenId: string; priceWei: string } | null;
      if (!parsed) return arr;
      // Require adminPrice match to avoid polluting widget if price changes
      if (adminPrice !== undefined && String(parsed.priceWei) !== String(adminPrice)) return arr;
      const exists = arr.some((l) => String(l.tokenId) === String(parsed.tokenId) && String(l.price) === String(parsed.priceWei));
      if (exists) return arr;
      // Build a pseudo entry; id can be derived from tokenId for stable key
      arr.unshift({
        id: ("0x" + BigInt(parsed.tokenId).toString(16).padStart(64, '0')) as any,
        nft: CONTRACTS.ticket as any,
        tokenId: BigInt(parsed.tokenId),
        price: BigInt(parsed.priceWei),
        seller: parsed.addr as any,
      });
      return arr;
    } catch { return adminEligible; }
  }, [adminEligible, adminPrice, ADMIN_LS_KEY]);
  const { push, remove } = useToast();
  // On-chain ownership read to allow manual sync utility
  // (Optionnel) On pourrait lire des infos supplémentaires ici si nécessaire.

  // Alerte env et réseau retirée pour épurer l'UI

  // Local UI state
  const [quizTitle, setQuizTitle] = useState("");
  const [activating, setActivating] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  // Quiz Builder state
  const [qText, setQText] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [correct, setCorrect] = useState<number | null>(null);
  const [prizeTotal, setPrizeTotal] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [adjust, setAdjust] = useState<{ sale: string; buyback: string; prize: string }>({ sale: "", buyback: "", prize: "" });
  const [buyingId, setBuyingId] = useState<string | null>(null);
  // Admin-owned tickets widget state
  const [ownedIds, setOwnedIds] = useState<number[]>([]);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [validatingAll, setValidatingAll] = useState(false);
  // Registry history state
  
  // Treasury widget state
  // Montants par pool (champ visible + / -)
  const [dep, setDep] = useState<{ sale: string; prize: string; buyback: string }>({ sale: "", prize: "", buyback: "" });
  const [sending, setSending] = useState(false);
  // Instant UI overrides for pool balances after tx success
  const [saleLocal, setSaleLocal] = useState<bigint | null>(null);
  const [prizeLocal, setPrizeLocal] = useState<bigint | null>(null);
  const [buybackLocal, setBuybackLocal] = useState<bigint | null>(null);
  // On-chain DistributionV1 UI state
  const [winner1, setWinner1] = useState("");
  const [winner2, setWinner2] = useState("");
  const [winner3, setWinner3] = useState("");
  const [totalEth, setTotalEth] = useState("");
  const [sendingDistribution, setSendingDistribution] = useState(false);
  const [share70, setShare70] = useState("");
  const [share20, setShare20] = useState("");
  const [share10, setShare10] = useState("");
  const [lastDrawBlockHash, setLastDrawBlockHash] = useState<string | null>(null);

  // Gestion des fonds (off-chain) — UI state
  const [funds, setFunds] = useState<Array<{ name: string; wallet: string; usdc: string }>>([{ name: "", wallet: "", usdc: "" }]);
  const [treasuryMeta, setTreasuryMeta] = useState<{ updatedAt: number; updatedBy: `0x${string}` | null } | null>(null);
  const [loadingTreasury, setLoadingTreasury] = useState(false);
  const [savingTreasury, setSavingTreasury] = useState(false);
  const [errors, setErrors] = useState<Record<number, { name?: string; wallet?: string; usdc?: string }>>({});
  const { signMessageAsync } = useSignMessage();

  useEffect(() => { loadTreasury(); }, []);

  async function loadTreasury() {
    try {
      setLoadingTreasury(true);
      const res = await fetch('/api/treasury', { cache: 'no-store' });
      if (!res.ok) throw new Error('Fail');
      const data = await res.json();
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      setFunds(entries.length > 0 ? entries.map((e: any) => ({ name: String(e.name||''), wallet: String(e.wallet||''), usdc: String(e.usdc||'') })) : [{ name: "", wallet: "", usdc: "" }]);
      setTreasuryMeta({ updatedAt: Number(data?.updatedAt || 0), updatedBy: (data?.updatedBy as any) || null });
    } catch {
      // noop
    } finally {
      setLoadingTreasury(false);
    }
  }

  const addFundRow = () => setFunds((f) => [...f, { name: "", wallet: "", usdc: "" }]);
  const removeFundRow = (idx: number) => setFunds((f) => f.filter((_, i) => i !== idx));

  const updateFund = (idx: number, key: 'name' | 'wallet' | 'usdc', value: string) => {
    setFunds((f) => f.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
    setErrors((e) => ({ ...e, [idx]: { ...(e[idx]||{}), [key]: undefined } }));
  };

  async function saveFunds() {
    try {
      if (!address) { push({ description: 'Connecte un wallet admin', variant: 'error' }); return; }
      const normalized: { name: string; wallet: `0x${string}`; usdc: string }[] = [];
      const errs: Record<number, { name?: string; wallet?: string; usdc?: string }> = {};
      funds.forEach((r, idx) => {
        const name = String(r.name||'').trim();
        const wallet = String(r.wallet||'').trim() as `0x${string}`;
        const usdcStr = String(r.usdc||'').trim();
        const rowErr: Record<string, string> = {};
        if (!name) rowErr.name = 'Obligatoire';
        if (!isAddress(wallet)) rowErr.wallet = 'Adresse invalide';
        const num = Number(usdcStr);
        if (!Number.isFinite(num) || num < 0) rowErr.usdc = 'Montant invalide';
        if (Object.keys(rowErr).length) errs[idx] = rowErr as any;
        else normalized.push({ name, wallet, usdc: String(num) });
      });
      if (Object.keys(errs).length) { setErrors(errs); push({ description: 'Corrige les erreurs du formulaire', variant: 'error' }); return; }
      const ts = Date.now();
      const digest = keccak256(toHex(JSON.stringify({ ts, entries: normalized })));
      const message = `T4L_TREASURY:${digest}`;
      setSavingTreasury(true);
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/treasury', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, ts, entries: normalized, signature }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec de l\'enregistrement');
      setTreasuryMeta({ updatedAt: Number(data.updatedAt || Date.now()), updatedBy: (data.updatedBy as any) || address });
      setFunds(normalized.length>0 ? normalized.map((e)=> ({ ...e })) : [{ name: '', wallet: '', usdc: '' }]);
      setErrors({});
      push({ description: 'Trésorerie mise à jour', variant: 'success' });
    } catch (e: any) {
      push({ description: e?.shortMessage || e?.message || 'Échec sauvegarde', variant: 'error' });
    } finally {
      setSavingTreasury(false);
    }
  }

  // Auto-link Quiz -> Registry if owner and not linked or wrong address
  useEffect(() => {
    const run = async () => {
      if (autoLinkedOnce || autoLinking) return;
      if (!CONTRACTS.quiz || !CONTRACTS.registry) return;
      if (!address || !isConnected) return;
      const owner = (quizOwner as string | undefined)?.toLowerCase?.();
      if (!owner || owner !== (address as string).toLowerCase()) return; // only owner auto-links
      const onChainReg = (quizRegistry as string | undefined) || "0x0000000000000000000000000000000000000000"; // if read fails, treat as not linked
      const expected = CONTRACTS.registry as string;
      const needsLink = !onChainReg || onChainReg.toLowerCase() === "0x0000000000000000000000000000000000000000" || onChainReg.toLowerCase() !== expected.toLowerCase();
      if (!needsLink) { setAutoLinkedOnce(true); return; }
      try {
        setAutoLinking(true);
        const tx = await writeContractAsync({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'setRegistry', args: [expected as `0x${string}`] } as any);
        push({ title: 'Registry lié automatiquement', description: txUrl(tx as any), variant: 'success' });
        setAutoLinkedOnce(true);
        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
      } catch (e:any) {
        // Afficher l'erreur pour diagnostic
        const msg = e?.shortMessage || e?.message || 'Échec du lien automatique';
        push({ description: msg, variant: 'error' });
      } finally { setAutoLinking(false); }
    };
    run();
  }, [address, isConnected, quizOwner, quizRegistry, CONTRACTS.quiz, CONTRACTS.registry, autoLinkedOnce, autoLinking]);

  // Helper to load winners and prize pool shares
  const loadWinnersAndShares = async () => {
    try {
      if (!publicClient || !CONTRACTS.quiz) return;
      const res = await publicClient.readContract({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'getLastWinners' } as any) as any;
      const [w1, w2, w3, seed] = res as [string, string, string, string];
      const isNZ = (a:string) => a && a !== '0x0000000000000000000000000000000000000000';
      if (isNZ(w1)) setWinner1(w1);
      if (isNZ(w2)) setWinner2(w2);
      if (isNZ(w3)) setWinner3(w3);
      if (seed) setLastDrawBlockHash(String(seed));
    } catch {}
    try {
      if (!publicClient || !CONTRACTS.treasury) return;
      const pool = await publicClient.readContract({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'prizePool' } as any) as any;
      if (typeof pool === 'bigint') {
        const total = (Number(pool)/1e18);
        setTotalEth(total.toFixed(6));
        setShare70((total * 0.7).toFixed(6));
        setShare20((total * 0.2).toFixed(6));
        setShare10((total * 0.1).toFixed(6));
      }
    } catch {}
  };

  // Auto-refresh ownedIds on Ticket Transfer events affecting admin
  useEffect(() => {
    if (!publicClient || !CONTRACTS.ticket || !address) return;
    const addr = CONTRACTS.ticket as `0x${string}`;
    const abi = ABI.erc721 as any;
    let timeout: any;
    const trigger = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => { loadOwnedIds(); }, 400);
    };
    let unsub: (() => void) | null = null;
    try {
      unsub = publicClient.watchContractEvent({
        address: addr,
        abi,
        eventName: 'Transfer',
        onLogs: (logs: any[]) => {
          const me = (address as string).toLowerCase();
          const hit = logs.some((l:any) => {
            const from = (l.args?.from || '').toLowerCase?.() || '';
            const to = (l.args?.to || '').toLowerCase?.() || '';
            return from === me || to === me;
          });
          if (hit) trigger();
        },
      });
    } catch {}
    return () => { if (unsub) { try { unsub(); } catch {} } ; clearTimeout(timeout); };
  }, [publicClient, CONTRACTS.ticket, address]);

  // Reset winners/seed in Distribution widget
  const resetDistribution = () => {
    setWinner1("");
    setWinner2("");
    setWinner3("");
    setLastDrawBlockHash(null);
  };

  // Watch on-chain events to auto-refresh without manual reload
  useEffect(() => {
    if (!publicClient || !CONTRACTS.quiz) return;
    const address = CONTRACTS.quiz as `0x${string}`;
    const abi = ABI.quiz as any;
    const unsubs: Array<() => void> = [];
    const refreshQuiz = async () => {
      try {
        const existsNow = await publicClient.readContract({ address, abi, functionName: 'hasQuiz' } as any);
        const getNow = await publicClient.readContract({ address, abi, functionName: 'get' } as any) as any;
        const st = await publicClient.readContract({ address, abi, functionName: 'getStats' } as any) as any;
        if (typeof existsNow === 'boolean') setQuizExistsLocal(existsNow);
        if (Array.isArray(getNow)) {
          const [t,q,opt,a] = getNow as any;
          setParsedQuizLocal({ title: t, question: q, options: opt, active: Boolean(a) });
        }
        if (Array.isArray(st)) { setParticipantsLocal(st[0] as bigint); setCorrectCountLocal(st[1] as bigint); }
      } catch {}
    };
    // Subscribe to key events (best-effort)
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'QuizCreated', onLogs: () => { resetDistribution(); refreshQuiz(); } }); unsubs.push(u); } catch {}
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'QuizUpdated', onLogs: () => { refreshQuiz(); } }); unsubs.push(u); } catch {}
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'QuizActivationChanged', onLogs: () => { refreshQuiz(); } }); unsubs.push(u); } catch {}
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'QuizEnded', onLogs: () => { resetDistribution(); refreshQuiz(); } }); unsubs.push(u); } catch {}
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'WinnersDrawn', onLogs: () => { loadWinnersAndShares(); } }); unsubs.push(u); } catch {}
    try { const u = publicClient.watchContractEvent({ address, abi, eventName: 'AdminTicketsMarked', onLogs: async (logs:any) => {
      // Refresh stats after admin validation
      try { await refreshQuiz(); } catch {}
    } }); unsubs.push(u); } catch {}
    // Fallback polling every 5s
    const iv = setInterval(() => { refreshQuiz(); loadWinnersAndShares(); }, 5000);
    // Initial load
    refreshQuiz();
    loadWinnersAndShares();
    return () => { unsubs.forEach((u) => { try { u(); } catch {} }); clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, CONTRACTS.quiz]);

  const blockUrl = (hash: string) => {
    // Use chain-specific explorer search as a generic proof link
    const base = chainId === 8453
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org'; // default Base Sepolia (84532)
    return `${base}/search?f=0&q=${hash}`;
  };
  const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
  const shortAddr = (addr?: string) => {
    if (!addr) return '';
    const a = String(addr);
    return a.length > 10 ? `${a.slice(0,6)}…${a.slice(-4)}` : a;
  };

  // UI styles helpers (flat theme, no colored focus rings or gray hovers)
  const btn = 'px-3 py-1.5 rounded border text-xs focus:outline-none transition-colors duration-150 disabled:opacity-50';
  const btnSm = 'px-2 py-1 border rounded text-[11px] focus:outline-none transition-colors duration-150 disabled:opacity-50';
  const badge = 'text-[11px] px-1.5 py-0.5 rounded border';
  const badgeInfo = `${badge}`;
  const badgeWarn = `${badge}`;
  const badgeGood = `${badge}`;
  const badgeNeutral = `${badge}`;

  // Formatters & helpers
  const fmtEth6 = useMemo(() => new Intl.NumberFormat(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 }), []);
  const fmtDate = (ts?: number | string) => {
    const n = Number(ts ?? 0);
    if (!isFinite(n) || n <= 0) return '—';
    try {
      const d = new Date(n * 1000);
      const t = d.getTime();
      if (!isFinite(t)) return '—';
      return d.toLocaleString();
    } catch { return '—'; }
  };
  const toISO = (ts?: number | string) => {
    const n = Number(ts || 0);
    if (!isFinite(n) || n <= 0) return 'n/a';
    try {
      const d = new Date(n * 1000);
      const t = d.getTime();
      if (!isFinite(t)) return 'n/a';
      return d.toISOString();
    } catch { return 'n/a'; }
  };
  const copyToClipboard = async (text: string, label?: string) => {
    try { await navigator.clipboard.writeText(text); push({ description: `${label ? label+': ' : ''}copié`, variant: 'success' }); } catch {}
  };

  // Per-group payments pagination (3 per page)
  const [payPageBySeed, setPayPageBySeed] = useState<Record<string, number>>({});
  const pageSizePerGroup = 3;
  const setGroupPage = (seedKey: string, page: number) => setPayPageBySeed((m)=> ({ ...m, [seedKey]: Math.max(0, page) }));

  // Dedicated read client pinned to app chain (Base Sepolia by default)
  const readClient = useMemo(() => {
    try {
      if (CONTRACTS.chainId === 84532) {
        const rpc = APP.baseRpcUrl;
        return createPublicClient({ chain: baseSepolia, transport: http(rpc || undefined) });
      }
    } catch {}
    return publicClient;
  }, [publicClient]);

  // Auto-load history (quiz ends + distributions)
  const [histLoading, setHistLoading] = useState(false);
  const [quizEnds, setQuizEnds] = useState<any[]>([]);
  const [dists, setDists] = useState<any[]>([]);
  const [regCounts, setRegCounts] = useState<{ lenQ: number; lenD: number }>({ lenQ: 0, lenD: 0 });
  const [histSort, setHistSort] = useState<'desc'|'asc'>('desc');
  const [histFilterInput, setHistFilterInput] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilter(histFilterInput.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [histFilterInput]);

  // KPIs & helpers derived from state
  const totalDistributedEth = useMemo(() => {
    try { return (dists.reduce((s, d:any) => s + Number(d.a1||0) + Number(d.a2||0) + Number(d.a3||0), 0) / 1e18); } catch { return 0; }
  }, [dists]);
  const quizSeedsSet = useMemo(() => new Set(quizEnds.map((q:any) => String(q.seed).toLowerCase())), [quizEnds]);
  // Pagination state for groups
  const [pageSize, setPageSize] = useState<number>(3);
  const [currentPage, setCurrentPage] = useState<number>(1);
  useEffect(()=> { setCurrentPage(1); }, [debouncedFilter, histSort, pageSize]);

  // Build groups by seed (payments + optional quiz)
  const groups = useMemo(()=>{
    const qBySeed = new Map<string, any>();
    for (const q of quizEnds) qBySeed.set(String(q.seed).toLowerCase(), q);
    const map = new Map<string, { seed:string, quiz?:any, payments:any[], latestAt:number, totalEth:number }>();
    for (const d of dists) {
      const key = String(d.seed).toLowerCase();
      const g = map.get(key) || { seed: key, quiz: qBySeed.get(key), payments: [], latestAt: 0, totalEth: 0 };
      g.payments.push(d);
      const at = Number(d.at||0);
      if (at > g.latestAt) g.latestAt = at;
      g.totalEth += (Number(d.a1||0)+Number(d.a2||0)+Number(d.a3||0))/1e18;
      map.set(key, g);
    }
    // Also include seeds that have quiz but no payments yet
    for (const [seed, q] of qBySeed.entries()) {
      if (!map.has(seed)) map.set(seed, { seed, quiz: q, payments: [], latestAt: Number(q.endedAt||0), totalEth: 0 });
    }
    let arr = Array.from(map.values());
    // Filter
    const f = debouncedFilter;
    if (f) {
      arr = arr.filter(g => {
        const vals:string[] = [g.seed, g.quiz?.title, String(g.quiz?.id)];
        for (const p of g.payments) vals.push(p.w1, p.w2, p.w3, p.source);
        return vals.some(v => String(v||'').toLowerCase().includes(f));
      });
    }
    // Sort
    arr.sort((a,b)=> histSort==='desc' ? (b.latestAt - a.latestAt) : (a.latestAt - b.latestAt));
    return arr;
  }, [quizEnds, dists, debouncedFilter, histSort]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const pageClamped = Math.min(currentPage, totalPages);
  const groupsPage = useMemo(()=> {
    const start = (pageClamped-1)*pageSize;
    return groups.slice(start, start + pageSize);
  }, [groups, pageClamped, pageSize]);
  

  // Quiz Manager address shortcut (used by multiple hooks below)
  const quizAddr = CONTRACTS.quiz;

  const exportHistoryCSV = () => {
    // Export quizEnds enriched, with associated distributions flattened
    const rows: string[] = [];
    rows.push(['id','title','participants','correct','seed','endedAt','source','pay_count','total_eth','w1','a1','w2','a2','w3','a3'].join(','));
    for (const q of quizEnds) {
      const pays = Array.isArray(q.dists) ? q.dists : [];
      const first = pays[0] || {};
      const line = [
        String(q.id||''),
        '"'+String(q.title||'').replaceAll('"','""')+'"',
        String(q.participants||''),
        String(q.correct||''),
        String(q.seed||''),
        String(q.endedAt||''),
        String(q.source||''),
        String(pays.length),
        String(((Number(q.totalAmount||0))/1e18).toFixed(6)),
        String(first.w1||''), String(first.a1||''),
        String(first.w2||''), String(first.a2||''),
        String(first.w3||''), String(first.a3||'')
      ].join(',');
      rows.push(line);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'quiz_history.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const loadHistory = async (silent = false) => {
    if (!CONTRACTS.registry) return;
    if (!silent) setHistLoading(true);
    try {
      const client = readClient;
      if (!client) throw new Error('Public client indisponible');
      const [lenQ, lenD] = await Promise.all([
        client.readContract({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'quizEndsLength' } as any) as any,
        client.readContract({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'distributionsLength' } as any) as any,
      ]);
      const qn = Number(lenQ || 0);
      const dn = Number(lenD || 0);
      setRegCounts({ lenQ: qn, lenD: dn });
      const showAll = (document.getElementById('histShowAll') as HTMLInputElement | null)?.checked;
      const limit = showAll ? 50 : 10;
      const takeQ = Math.min(limit, qn);
      const takeD = Math.min(limit, dn);
      const qIndexes = Array.from({ length: takeQ }, (_, i) => qn - 1 - i).filter(i => i >= 0);
      const dIndexes = Array.from({ length: takeD }, (_, i) => dn - 1 - i).filter(i => i >= 0);
      const qContracts = qIndexes.map((idx) => ({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'getQuizEnd', args: [BigInt(idx)] }));
      const dContracts = dIndexes.map((idx) => ({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'getDistribution', args: [BigInt(idx)] }));
      const [qRes, dRes] = await Promise.all([
        qContracts.length ? client.multicall({ contracts: qContracts as any, allowFailure: true } as any) : Promise.resolve([]),
        dContracts.length ? client.multicall({ contracts: dContracts as any, allowFailure: true } as any) : Promise.resolve([]),
      ]);
      const qParsed = (qRes as any[]).map((r, i) => ({ idx: qIndexes[i], ...(Array.isArray(r?.result) ? {
        id: r.result[0], title: r.result[1], question: r.result[2], options: r.result[3], correctIdx: r.result[4], participants: r.result[5], correct: r.result[6], w1: r.result[7], w2: r.result[8], w3: r.result[9], seed: r.result[10], endedAt: r.result[11], source: r.result[12]
      } : {})})).filter(x => x.id !== undefined);
      // DistributionRecord: w1,w2,w3,a1,a2,a3,t1,t2,t3,seed,at,source
      const dParsed = (dRes as any[]).map((r, i) => ({ idx: dIndexes[i], ...(Array.isArray(r?.result) ? {
        w1: r.result[0], w2: r.result[1], w3: r.result[2], a1: r.result[3], a2: r.result[4], a3: r.result[5], t1: r.result[6], t2: r.result[7], t3: r.result[8], seed: r.result[9], at: r.result[10], source: r.result[11]
      } : {})})).filter(x => x.w1 !== undefined);
      // If some payment seeds don't have a matching quiz in qParsed, fetch more recent quizEnds (up to 200 total) to improve matching
      try {
        const haveSeeds = new Set(qParsed.map(q => String(q.seed).toLowerCase()));
        const needSeeds = new Set((dParsed as any[]).map(d => String(d.seed).toLowerCase()));
        let missing = [...needSeeds].filter(s => !haveSeeds.has(s));
        if (missing.length && qn > qParsed.length) {
          const extraCount = Math.min(200, qn);
          if (qParsed.length < extraCount) {
            const want = extraCount;
            const moreIndexes = Array.from({ length: want }, (_, i) => qn - 1 - i).filter(i => i >= 0);
            const moreContracts = moreIndexes.map((idx) => ({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'getQuizEnd', args: [BigInt(idx)] }));
            const moreRes = await client.multicall({ contracts: moreContracts as any, allowFailure: true } as any);
            const moreParsed = (moreRes as any[]).map((r, i2) => ({ idx: moreIndexes[i2], ...(Array.isArray(r?.result) ? {
              id: r.result[0], title: r.result[1], question: r.result[2], options: r.result[3], correctIdx: r.result[4], participants: r.result[5], correct: r.result[6], w1: r.result[7], w2: r.result[8], w3: r.result[9], seed: r.result[10], endedAt: r.result[11], source: r.result[12]
            } : {})})).filter(x => x.id !== undefined);
            // Merge unique by idx
            const map = new Map<number, any>();
            for (const q of [...qParsed, ...moreParsed]) map.set(q.idx, q);
            const merged = [...map.values()].sort((a,b)=> a.idx - b.idx);
            merged.forEach(q => haveSeeds.add(String(q.seed).toLowerCase()));
            missing = [...needSeeds].filter(s => !haveSeeds.has(s));
            if (missing.length === 0) {
              setQuizEnds(merged as any);
            } else {
              setQuizEnds(merged as any);
            }
          }
        }
      } catch {}
      // Associer paiements aux quiz via seed
      const dBySeed = new Map<string, any[]>();
      for (const d of dParsed) {
        const key = String(d.seed).toLowerCase();
        const arr = dBySeed.get(key) || [];
        arr.push(d);
        dBySeed.set(key, arr);
      }
      const qEnriched = qParsed.map((q) => {
        const arr = dBySeed.get(String(q.seed).toLowerCase()) || [];
        const total = arr.reduce((sum, x) => sum + Number(x.a1||0) + Number(x.a2||0) + Number(x.a3||0), 0);
        return { ...q, dists: arr, totalAmount: total } as any;
      });
      setQuizEnds(qEnriched);
      setDists(dParsed);
    } catch (e:any) {
      push({ description: e?.shortMessage || e?.message || 'Échec de chargement de l\'historique', variant: 'error' });
    } finally { if (!silent) setHistLoading(false); }
  };

  // QuizManager history + WinnersDrawn seed logs
  const [qmHistory, setQmHistory] = useState<any[]>([]);
  const [qmLoading, setQmLoading] = useState(false);
  const [qmSeedById, setQmSeedById] = useState<Record<string, string>>({}); // quizId -> seed (hex)
  const [qmIdBySeed, setQmIdBySeed] = useState<Record<string, string>>({}); // seed (lower) -> quizId
  // Pagination QuizManager (3 par page)
  const [qmPageSize, setQmPageSize] = useState<number>(3);
  const [qmCurrentPage, setQmCurrentPage] = useState<number>(1);
  useEffect(()=> { setQmCurrentPage(1); }, [qmHistory.length]);
  const qmTotalPages = Math.max(1, Math.ceil(qmHistory.length / qmPageSize));
  const qmPageClamped = Math.min(qmCurrentPage, qmTotalPages);
  const qmPage = useMemo(()=> {
    const start = (qmPageClamped - 1) * qmPageSize;
    return qmHistory.slice(start, start + qmPageSize);
  }, [qmHistory, qmPageClamped, qmPageSize]);

  const loadQuizManagerHistory = async (silent = true) => {
    if (!quizAddr) return;
    if (!silent) setQmLoading(true);
    try {
      const client = readClient || publicClient;
      if (!client) return;
      // length
      const lenRaw = await client.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'historyLength' } as any) as any;
      const hn = Number(lenRaw || 0);
      const limit = Math.min(100, hn);
      const idxs = Array.from({ length: limit }, (_, i) => hn - 1 - i).filter(i => i >= 0);
      const contracts = idxs.map((idx) => ({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'getHistory', args: [BigInt(idx)] }));
      const res: any[] = contracts.length ? await client.multicall({ contracts: contracts as any, allowFailure: true } as any) : [];
      const parsed = res.map((r, i) => ({ idx: idxs[i], ...(Array.isArray(r?.result) ? {
        id: r.result[0], title: r.result[1], question: r.result[2], options: r.result[3], correctIdx: r.result[4], participants: r.result[5], correct: r.result[6], endedAt: r.result[7]
      } : {}) })).filter(x => x.id !== undefined);
      setQmHistory(parsed);
      // Fetch WinnersDrawn logs to map id -> seed
      try {
        if (!publicClient) return;
        const current = await publicClient.getBlockNumber();
        const from = current > BigInt(300_000) ? current - BigInt(300_000) : BigInt(0);
        const logs = await publicClient.getLogs({
          address: quizAddr as `0x${string}`,
          event: (ABI.quiz as any).find((x:any)=> x.type==='event' && x.name==='WinnersDrawn'),
          fromBlock: from,
          toBlock: 'latest'
        } as any);
        const mapIdSeed: Record<string,string> = {};
        const mapSeedId: Record<string,string> = {};
        for (const lg of logs as any[]) {
          const args = lg.args || {};
          const id = String(args.id ?? '');
          const seed = String(args.seed ?? '').toLowerCase();
          if (id && seed && seed.startsWith('0x')) { mapIdSeed[id] = seed; mapSeedId[seed] = id; }
        }
        setQmSeedById(mapIdSeed);
        setQmIdBySeed(mapSeedId);
      } catch {}
    } catch (e) {
      // silent
    } finally { if (!silent) setQmLoading(false); }
  };

  // Auto: charge au montage + rafraîchit toutes les 20s
  useEffect(() => {
    let iv: any;
    loadHistory(true);
    iv = setInterval(() => { loadHistory(true); }, 20000);
    return () => { if (iv) clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readClient, CONTRACTS.registry]);

  // Auto: load QuizManager history periodically
  useEffect(() => {
    let iv: any;
    loadQuizManagerHistory(true);
    iv = setInterval(() => { loadQuizManagerHistory(true); }, 20000);
    return () => { if (iv) clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readClient, publicClient, quizAddr]);

  // Load admin-owned token IDs (scan 1..nextId via multicall)
  const loadOwnedIds = async () => {
    if (!CONTRACTS.ticket || !address) return;
    setLoadingOwned(true);
    try {
      push({ description: 'Chargement de vos tickets…', variant: 'info' });
      const client = readClient;
      if (!client) throw new Error('Public client indisponible');
      const nextId = await client.readContract({ address: CONTRACTS.ticket as `0x${string}`, abi: ABI.ticket as any, functionName: 'nextId' } as any) as any;
      const maxId = Number(nextId || 0);
      if (!maxId) { setOwnedIds([]); return; }
      const BATCH = 100; // multicall batches
      const ids: number[] = [];
      for (let start = 1; start <= maxId; start += BATCH) {
        const end = Math.min(start + BATCH - 1, maxId);
        const contracts = Array.from({ length: end - start + 1 }, (_, i) => ({
          address: CONTRACTS.ticket as `0x${string}`,
          abi: ABI.ticket as any,
          functionName: 'ownerOf',
          args: [BigInt(start + i)],
        }));
        const res: any[] = await client.multicall({ contracts, allowFailure: true } as any);
        res.forEach((item, idx) => {
          const val = item?.result as string | undefined;
          if (val && typeof val === 'string') {
            if (val.toLowerCase() === (address as string).toLowerCase()) ids.push(start + idx);
          }
        });
        // tiny delay between batches to avoid 503
        await new Promise((r) => setTimeout(r, 80));
      }
      setOwnedIds(ids);
      push({ description: `${ids.length} ticket(s) trouvé(s)`, variant: 'success' });
    } catch (e) {
      push({ description: (e as any)?.shortMessage || (e as any)?.message || 'Échec de chargement des tickets (RPC)', variant: 'error' });
    } finally { setLoadingOwned(false); }
  };

  // Quiz Manager (on-chain)
  const isQuizAdmin = Boolean(address && quizOwner && (address as string).toLowerCase() === (quizOwner as string).toLowerCase());
  const { data: quizExists } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "hasQuiz",
    query: { enabled: Boolean(quizAddr) } as any,
  } as any);
  const { data: quizState } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "get",
    query: { enabled: Boolean(quizAddr && quizExists) } as any,
  } as any);
  const parsedQuiz = (() => {
    if (!quizState) return null as null | { title: string; question: string; options: string[]; active: boolean };
    const [title, question, options, active] = quizState as any;
    return { title, question, options, active } as { title: string; question: string; options: string[]; active: boolean };
  })();
  // Local overrides to force instant UI refresh after tx success
  const [quizExistsLocal, setQuizExistsLocal] = useState<boolean | null>(null);
  const [parsedQuizLocal, setParsedQuizLocal] = useState<{
    title: string; question: string; options: string[]; active: boolean
  } | null>(null);
  const currentQuizExists = (quizExistsLocal ?? (quizExists as any)) as boolean | undefined;
  const currentParsedQuiz = (parsedQuizLocal ?? (parsedQuiz as any)) as { title: string; question: string; options: string[]; active: boolean } | null;
  const isActive = Boolean(currentParsedQuiz && currentParsedQuiz.active);
  // Stats (v2)
  const { data: stats } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "getStats",
    query: { enabled: Boolean(quizAddr && currentQuizExists) } as any,
  } as any);
  const participants = stats ? (stats as any)[0] as bigint : undefined;
  const correctCount = stats ? (stats as any)[1] as bigint : undefined;
  // Local overrides for stats to avoid manual refresh after tx
  const [participantsLocal, setParticipantsLocal] = useState<bigint | undefined>(undefined);
  const [correctCountLocal, setCorrectCountLocal] = useState<bigint | undefined>(undefined);
  const currentParticipants = (participantsLocal ?? participants) as bigint | undefined;
  const currentCorrectCount = (correctCountLocal ?? correctCount) as bigint | undefined;
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Local record of distributions performed from this admin UI (since on-chain linkage to quiz history isn't trivially available)
  const [recentDistributions, setRecentDistributions] = useState<{
    tx: `0x${string}`; winners: [`0x${string}`, `0x${string}`, `0x${string}`]; amountEth: string; ts: number;
  }[]>([]);

  if (!mounted) {
    // Render a stable placeholder for SSR to avoid hydration mismatch
    return <div className="mx-auto max-w-6xl p-4 sm:p-6" />;
  }

  if (!allowed) {
    return (
      <div className={`${manrope.className} mx-auto max-w-6xl p-4 sm:p-6`}>
        <h1 className="text-2xl font-semibold uppercase tracking-wide mb-4">Admin <span style={{ color: ORANGE }}>Dashboard</span></h1>
        <p className="text-sm" style={{ color: TEXT_SUBTLE }}>Accès restreint. Connecte un wallet admin.</p>
      </div>
    );
  }

  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: BG_CREAM, minHeight: "100vh" }}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold uppercase tracking-wide mb-4">Admin <span style={{ color: ORANGE }}>Dashboard</span></h1>
      {/* Live region for SR updates */}
      <div aria-live="polite" role="status" className="sr-only">
        {(sending || loadingOwned || validatingAll || creatingQuiz || activating || autoLinking || histLoading || sendingDistribution) ? 'Action en cours…' : ''}
      </div>
      {/* Treasury Pools */}
      <section className="border rounded-lg p-5 mb-8" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
        <h2 className="font-semibold mb-1" style={{ color: TEXT_PRIMARY }}>Gestion des pools</h2>
        {/* Ligne Owner supprimée pour épurer l'UI */}
        {!CONTRACTS.treasury ? (
          <p className="text-sm border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>
            Adresse du Treasury manquante. Renseigne `NEXT_PUBLIC_TREASURY_ADDRESS` dans `.env.local`.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="border rounded p-5" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                <div className="space-y-1 min-h-24">
                  <div className="font-medium" style={{ color: TEXT_PRIMARY }}>Sale Pool</div>
                  <div style={{ color: TEXT_PRIMARY }}><span className="font-semibold">{typeof (saleLocal ?? salePool) === "bigint" ? (Number(saleLocal ?? salePool) / 1e18).toFixed(6) : "…"}</span> ETH</div>
                  <p className="text-xs" style={{ color: TEXT_SUBTLE }}>Frais de vente collectés. Seront utilisés pour l’écosystème.</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className="border rounded px-2 py-1 w-40 md:w-44" placeholder="Montant (ETH)" value={dep.sale}
                    style={{ borderColor: BORDER }}
                    onChange={(e)=>setDep((p)=>({...p, sale: e.target.value}))} />
                  <Button aria-label="Ajouter" title="Ajouter" variant="brand" className="w-9 h-9 rounded disabled:opacity-50 flex items-center justify-center"
                    disabled={sending || !dep.sale}
                    aria-disabled={sending || !dep.sale}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.sale);
                        await withPendingToast('Dépôt en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "depositToSale", args: [], value: amount }) as any);
                        if (typeof salePool === "bigint") setSaleLocal((saleLocal ?? salePool) + amount);
                        setDep((p)=>({...p, sale: ""}));
                        push({ title: "Dépôt confirmé", description: `Sale pool crédité`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec dépôt sale") , variant:"error"}); } finally { setSending(false);} }
                  }>+</Button>
                  <Button aria-label="Retirer" title="Retirer" className="w-9 h-9 rounded border flex items-center justify-center disabled:opacity-50" style={{ borderColor: BORDER }}
                    disabled={sending || !dep.sale || !address}
                    aria-disabled={sending || !dep.sale || !address}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.sale);
                        await withPendingToast('Retrait en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "spendSale", args: [address as `0x${string}`, amount] } as any) as any);
                        if (typeof salePool === "bigint") setSaleLocal(() => {
                          const base = saleLocal ?? salePool;
                          return base > amount ? base - amount : BigInt(0);
                        });
                        setDep((p)=>({...p, sale: ""}));
                        push({ title: "Retrait confirmé", description: `Envoyé sur ton wallet`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec retrait sale") , variant:"error"}); } finally { setSending(false);} }
                  }>
                    -
                  </Button>
                </div>
              </div>
              <div className="border rounded p-5" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                <div className="space-y-1 min-h-24">
                  <div className="font-medium" style={{ color: TEXT_PRIMARY }}>Prize Pool</div>
                  <div style={{ color: TEXT_PRIMARY }}><span className="font-semibold">{typeof (prizeLocal ?? prizePool) === "bigint" ? (Number(prizeLocal ?? prizePool) / 1e18).toFixed(6) : "…"}</span> ETH</div>
                  <p className="text-xs" style={{ color: TEXT_SUBTLE }}>Cagnotte des tirages 70/20/10.</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className="border rounded px-2 py-1 w-40 md:w-44" placeholder="Montant (ETH)" value={dep.prize}
                    style={{ borderColor: BORDER }}
                    onChange={(e)=>setDep((p)=>({...p, prize: e.target.value}))} />
                  <Button aria-label="Ajouter" title="Ajouter" variant="brand" className="w-9 h-9 rounded disabled:opacity-50 flex items-center justify-center"
                    disabled={sending || !dep.prize}
                    aria-disabled={sending || !dep.prize}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.prize);
                        await withPendingToast('Dépôt en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "depositToPrize", args: [], value: amount }) as any);
                        if (typeof prizePool === "bigint") setPrizeLocal((prizeLocal ?? prizePool) + amount);
                        setDep((p)=>({...p, prize: ""}));
                        push({ title: "Dépôt confirmé", description: `Prize pool crédité`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec dépôt prize") , variant:"error"}); } finally { setSending(false);} }
                  }>+</Button>
                  <Button aria-label="Retirer" title="Retirer" className="w-9 h-9 rounded border flex items-center justify-center disabled:opacity-50" style={{ borderColor: BORDER }}
                    disabled={sending || !dep.prize || !address}
                    aria-disabled={sending || !dep.prize || !address}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.prize);
                        await withPendingToast('Retrait en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "spendPrize", args: [address as `0x${string}`, amount] } as any) as any);
                        if (typeof prizePool === "bigint") setPrizeLocal(() => {
                          const base = prizeLocal ?? prizePool;
                          return base > amount ? base - amount : BigInt(0);
                        });
                        setDep((p)=>({...p, prize: ""}));
                        push({ title: "Retrait confirmé", description: `Envoyé sur ton wallet`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec retrait prize") , variant:"error"}); } finally { setSending(false);} }
                  }>
                    -
                  </Button>
                </div>
              </div>
              <div className="border rounded p-5" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                <div className="space-y-1 min-h-24">
                  <div className="font-medium" style={{ color: TEXT_PRIMARY }}>Buyback Pool</div>
                  <div style={{ color: TEXT_PRIMARY }}><span className="font-semibold">{typeof (buybackLocal ?? buybackPool) === "bigint" ? (Number(buybackLocal ?? buybackPool) / 1e18).toFixed(6) : "…"}</span> ETH</div>
                  <p className="text-xs" style={{ color: TEXT_SUBTLE }}>Réservé aux rachats admin des tickets listés au prix buyback.</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input className="border rounded px-2 py-1 w-40 md:w-44" placeholder="Montant (ETH)" value={dep.buyback}
                    style={{ borderColor: BORDER }}
                    onChange={(e)=>setDep((p)=>({...p, buyback: e.target.value}))} />
                  <Button aria-label="Ajouter" title="Ajouter" variant="brand" className="w-9 h-9 rounded disabled:opacity-50 flex items-center justify-center"
                    disabled={sending || !dep.buyback}
                    aria-disabled={sending || !dep.buyback}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.buyback);
                        await withPendingToast('Dépôt en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "depositToBuyback", args: [], value: amount }) as any);
                        if (typeof buybackPool === "bigint") setBuybackLocal((buybackLocal ?? buybackPool) + amount);
                        setDep((p)=>({...p, buyback: ""}));
                        push({ title: "Dépôt confirmé", description: `Buyback pool crédité`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec dépôt buyback") , variant:"error"}); } finally { setSending(false);} }
                  }>+</Button>
                  <Button aria-label="Retirer" title="Retirer" className="w-9 h-9 rounded border flex items-center justify-center disabled:opacity-50" style={{ borderColor: BORDER }}
                    disabled={sending || !dep.buyback || !address}
                    aria-disabled={sending || !dep.buyback || !address}
                    aria-busy={sending}
                    onClick={async ()=>{
                      try{ setSending(true);
                        const amount = parseEther(dep.buyback);
                        await withPendingToast('Retrait en cours', async () => await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: "spendBuyback", args: [address as `0x${string}`, amount] } as any) as any);
                        if (typeof buybackPool === "bigint") setBuybackLocal(() => {
                          const base = buybackLocal ?? buybackPool;
                          return base > amount ? base - amount : BigInt(0);
                        });
                        setDep((p)=>({...p, buyback: ""}));
                        push({ title: "Retrait confirmé", description: `Envoyé sur ton wallet`, variant: "success" });
                        try { await loadHistory(true); await loadQuizManagerHistory(true); } catch {}
                      }catch(e:any){ push({ description: formatTxError(e, "Échec retrait buyback") , variant:"error"}); } finally { setSending(false);} }
                  }>
                    -
                  </Button>
                </div>
              </div>
            </div>
            {/* Section "Dépenser" supprimée: actions de retrait intégrées à chaque pool */}
          </div>
        )}
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Admin-owned tickets and batch validation */}
        <section className="border rounded-lg p-5 md:col-span-2 order-last" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <h2 className="font-semibold mb-2" style={{ color: TEXT_PRIMARY }}>Mes tickets (admin)</h2>
          {!CONTRACTS.ticket || !CONTRACTS.quiz ? (
            <p className="text-sm border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>Renseigne les adresses Ticket et Quiz dans `.env.local`.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand"
                  disabled={loadingOwned || !address}
                  aria-disabled={loadingOwned || !address}
                  aria-busy={loadingOwned}
                  aria-label="Charger mes tickets détenus"
                  onClick={loadOwnedIds}>
                  {loadingOwned ? 'Chargement…' : 'Charger mes tickets'}
                </Button>
                <div style={{ color: TEXT_SUBTLE }}>{ownedIds.length ? `${ownedIds.length} tickets trouvés` : 'Aucun ticket chargé'}</div>
              </div>
              <div className="border rounded max-h-56 overflow-y-auto p-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }} aria-busy={loadingOwned}>
                {loadingOwned ? (
                  <ul className="grid grid-cols-2 gap-2 text-xs animate-pulse">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <li key={i} className="h-6 rounded" style={{ backgroundColor: BG_PANEL }} />
                    ))}
                  </ul>
                ) : ownedIds.length === 0 ? (
                  <div className="text-xs" style={{ color: TEXT_SUBTLE }}>Liste vide.</div>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 text-xs">
                    {ownedIds.map((id) => (
                      <li key={id} className="border rounded px-2 py-1" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>Token #{id}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand"
                  disabled={validatingAll || ownedIds.length === 0 || !isActive}
                  aria-disabled={validatingAll || ownedIds.length === 0 || !isActive}
                  aria-busy={validatingAll}
                  onClick={async () => {
                    if (!address || !CONTRACTS.quiz) return;
                    try {
                      setValidatingAll(true);
                      // ensure correct chain
                      if (chainId !== CONTRACTS.chainId) {
                        try { await switchChainAsync({ chainId: CONTRACTS.chainId }); } catch {}
                      }
                      await withPendingToast('Validation en cours', async () => await writeContractAsync({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'adminMarkOwnedTicketsEligible', args: [address as `0x${string}`, BigInt(0)] } as any) as any);
                      // optimistic local stats bump
                      if (typeof currentParticipants === 'bigint') setParticipantsLocal((currentParticipants as bigint) + BigInt(ownedIds.length));
                      if (typeof currentCorrectCount === 'bigint') setCorrectCountLocal((currentCorrectCount as bigint) + BigInt(ownedIds.length));
                      push({ title: 'Validation confirmée', description: `${ownedIds.length} tickets marqués éligibles`, variant: 'success' });
                    } catch (e:any) {
                      push({ description: formatTxError(e, 'Échec de validation'), variant: 'error' });
                    } finally { setValidatingAll(false); }
                  }}>
                  {validatingAll ? 'Validation…' : 'Valider tous mes tickets'}
                </Button>
                {!isActive ? (<div className="text-xs" style={{ color: TEXT_SUBTLE }}>Quiz inactif.</div>) : null}
              </div>
            </div>
          )}
        </section>
        {/* Quiz Manager (on-chain) - now second and full width */}
        <section className="border rounded-lg p-5 md:col-span-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <h2 className="font-semibold mb-3" style={{ color: TEXT_PRIMARY }}>Quiz</h2>
          {!CONTRACTS.quiz ? (
            <p className="text-sm border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>
              Adresse du contrat de quiz manquante. Ajoute `NEXT_PUBLIC_QUIZ_ADDRESS` dans `.env.local`.
            </p>
          ) : !isQuizAdmin ? (
            <div className="text-sm" style={{ color: TEXT_SUBTLE }}>
              <p style={{ color: TEXT_SUBTLE }}>Tu n'es pas owner du contrat de quiz.</p>
              {currentParsedQuiz ? (
                <div className="mt-3 text-xs" style={{ color: TEXT_SUBTLE }}>
                  <div>Titre: {currentParsedQuiz.title || "(n/a)"}</div>
                  <div>Actif: {String(currentParsedQuiz.active)}</div>
                  <div>Options: {(currentParsedQuiz && currentParsedQuiz.options ? currentParsedQuiz.options.length : 0)}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {/* If a quiz exists, show it; else show builder */}
              {currentQuizExists && currentParsedQuiz ? (
                <div className="border rounded p-4" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">Quiz actuel</div>
                      <div className="text-sm" style={{ color: TEXT_PRIMARY }}>Titre: <span className="font-semibold">{currentParsedQuiz.title || "(n/a)"}</span></div>
                      <div className="text-sm" style={{ color: TEXT_PRIMARY }}>Question: {currentParsedQuiz.question || "(n/a)"}</div>
                      <div className="mt-2 text-sm">Options:</div>
                      <ul className="list-disc pl-6 text-sm">
                        {(currentParsedQuiz.options||[]).map((op,i)=>(<li key={i}>{op}</li>))}
                      </ul>
                      <div className="mt-3 text-sm">Etat: {isActive? <span className="text-green-600">Actif</span> : <span style={{ color: TEXT_SUBTLE }}>Inactif</span>}</div>
                      <div className="mt-3 text-sm">Participants: <span className="font-semibold">{currentParticipants!==undefined? Number(currentParticipants as bigint): "…"}</span> • Bonnes réponses: <span className="font-semibold">{currentCorrectCount!==undefined? Number(currentCorrectCount as bigint): "…"}</span></div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <Button className="px-3 py-2 rounded disabled:opacity-50" variant="brand" disabled={!isQuizAdmin || !quizAddr || !address}
                        aria-disabled={!isQuizAdmin || !quizAddr || !address}
                        aria-busy={activating}
                        onClick={async()=>{
                          try{
                            push({ title: isActive? "Désactivation…":"Activation…", description: "", variant:"info" });
                            await withPendingToast(isActive? 'Désactivation…' : 'Activation…', async () => await writeContractAsync({ account: address as `0x${string}`, chainId: CONTRACTS.chainId as number, address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "setActive", args: [!isActive] } as any) as any);
                            setParsedQuizLocal((prev)=> prev? { ...prev, active: !prev.active } : prev);
                            push({ title: isActive? "Désactivé":"Activé", description: "", variant:"success" });
                            // Si on vient d'activer, mémoriser le block courant pour borner les participations
                            try {
                              if (!isActive) {
                                const bn = await publicClient!.getBlockNumber();
                                if (typeof window !== 'undefined') {
                                  localStorage.setItem('quizActiveFromBlock', String(bn));
                                }
                              }
                            } catch {}
                            // Soft refresh stats
                            try {
                              const st = await publicClient?.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'getStats' } as any) as any;
                              if (Array.isArray(st)) { setParticipantsLocal(st[0] as bigint); setCorrectCountLocal(st[1] as bigint); }
                            } catch {}
                          }catch(e:any){ push({ description: formatTxError(e, "Échec setActive"), variant:"error" }); }
                        }}>{isActive? "Désactiver":"Activer"}</Button>
                      <Button className="px-3 py-2 rounded disabled:opacity-50" variant="brand" disabled={!isQuizAdmin || !quizAddr || !address}
                        aria-disabled={!isQuizAdmin || !quizAddr || !address}
                        aria-busy={creatingQuiz}
                        onClick={async()=>{
                          try{
                            push({ title: "Fin du quiz…", description: "", variant:"info" });
                            await withPendingToast('Fin du quiz…', async () => await writeContractAsync({ account: address as `0x${string}`, chainId: CONTRACTS.chainId as number, address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "endQuiz", args: [] } as any) as any);
                            // After end, update UI immediately
                            setQuizExistsLocal(false);
                            setParsedQuizLocal(null);
                            setParticipantsLocal(undefined);
                            setCorrectCountLocal(undefined);
                            // Auto-load latest history (last 10)
                            try {
                              const len = await publicClient!.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'historyLength' } as any) as any;
                              const n = Number(len as bigint);
                              const from = Math.max(0, n - 10);
                              const indices = Array.from({ length: n - from }, (_,i)=> from + i);
                              const items = await Promise.all(indices.map(i=> publicClient!.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'getHistory', args:[BigInt(i)] } as any)));
                              setHistory(items.reverse());
                            } catch {}
                            push({ title: "Quiz terminé", description: "", variant:"success" });
                          // Refresh history to show the new entry
                          loadHistory(true);
                          }catch(e:any){ push({ description: formatTxError(e, "Échec fin du quiz"), variant:"error" }); }
                        }}>Terminer le quiz</Button>
                      <Button className="px-3 py-2 rounded border" aria-busy={preparing} onClick={async()=>{
                        try{
                          // Lire le prizePool pour pré-remplir la distribution
                          const pool = await publicClient!.readContract({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'prizePool' } as any) as any;
                          if (typeof pool === 'bigint') {
                            const total = (Number(pool)/1e18).toFixed(6);
                            setTotalEth(total);
                            // Enregistrer des montants indicatifs 70/20/10 (affichage)
                            setShare70(((Number(pool)/1e18)*0.7).toFixed(6));
                            setShare20(((Number(pool)/1e18)*0.2).toFixed(6));
                            setShare10(((Number(pool)/1e18)*0.1).toFixed(6));
                          }
                        }catch{}
                        // Tirage ON-CHAIN: appelle drawWinners() puis lit getLastWinners()
                        try {
                          await withPendingToast('Tirage en cours', async () => await writeContractAsync({
                            address: quizAddr as `0x${string}`,
                            abi: ABI.quiz as any,
                            functionName: 'drawWinners',
                            args: [],
                          } as any) as any);
                          push({ title: 'Tirage on-chain envoyé', description: 'En attente de fulfillment VRF…', variant: 'info' });
                          push({ description: 'Demande VRF envoyée, en attente de fulfillment…', variant: 'info' });
                          let w1 = '0x0000000000000000000000000000000000000000';
                          let w2 = w1; let w3 = w1; let seed = '0x';
                          const deadline = Date.now() + 60_000; // 60s timeout
                          while (Date.now() < deadline) {
                            try {
                              const res = await publicClient!.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'getLastWinners' } as any) as any;
                              [w1, w2, w3, seed] = res as [string, string, string, string];
                              const nz = (a:string) => a && a !== '0x0000000000000000000000000000000000000000';
                              if (nz(w1) || nz(w2) || nz(w3)) break;
                            } catch {}
                            await new Promise(r => setTimeout(r, 2000));
                          }
                          if (w1 && w1 !== '0x0000000000000000000000000000000000000000') setWinner1(w1);
                          if (w2 && w2 !== '0x0000000000000000000000000000000000000000') setWinner2(w2);
                          if (w3 && w3 !== '0x0000000000000000000000000000000000000000') setWinner3(w3);
                          // Refresh history silently after VRF result to help associate distributions
                          loadHistory(true);
                          setLastDrawBlockHash(String(seed));
                          if ((w1 && w1 !== '0x0000000000000000000000000000000000000000') || (w2 && w2 !== '0x0000000000000000000000000000000000000000') || (w3 && w3 !== '0x0000000000000000000000000000000000000000')) {
                            push({ title: 'Gagnants tirés (VRF)', description: [w1,w2,w3].filter(Boolean).join(' , '), variant: 'success' });
                          } else {
                            push({ description: 'Aucun gagnant retourné avant expiration (VRF fulfillment en retard). Réessaie de lire plus tard.', variant: 'info' });
                          }
                        } catch (e:any) {
                          push({ description: formatTxError(e, 'Échec du tirage on-chain'), variant: 'error' });
                        }
                        const el = document.getElementById("distribution-widget");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}>Tirage au sort</Button>
                    </div>
                  </div>
                  
                </div>
              ) : (
                <div className="border rounded p-4" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="font-medium mb-2">Configuration du quiz</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border rounded px-2 py-1" placeholder="Titre du quiz" style={{ borderColor: BORDER }}
                      value={quizTitle} onChange={(e)=>setQuizTitle(e.target.value)} />
                    <input className="border rounded px-2 py-1" placeholder="Question" style={{ borderColor: BORDER }}
                      value={qText} onChange={(e)=>setQText(e.target.value)} />
                  </div>
                  <div className="mt-2 space-y-2">
                    {options.map((op, i)=> (
                      <div key={i} className="flex items-center gap-2">
                        <input className="border rounded px-2 py-1 flex-1" placeholder={`Option #${i+1}`} style={{ borderColor: BORDER }}
                          value={op} onChange={(e)=> setOptions((prev)=> prev.map((v,idx)=> idx===i? e.target.value : v))} />
                        <label className="text-xs flex items-center gap-1">
                          <input type="radio" name="correct" checked={correct===i} onChange={()=> setCorrect(i)} />
                          Correcte
                        </label>
                        {options.length>2 && (
                          <Button className="text-xs px-2 py-1 border rounded" onClick={()=> {
                            setOptions((prev)=> prev.filter((_,idx)=> idx!==i));
                            setCorrect((prev)=>{
                              if (prev===null) return prev;
                              if (prev===i) return null; // removed selected -> unset
                              if (i < prev) return prev-1; // shift left
                              return prev; // unchanged
                            });
                          }}>Supprimer</Button>
                        )}
                      </div>
                    ))}
                    {options.length < 8 && (
                      <Button className="text-xs px-2 py-1 border rounded" onClick={()=> setOptions((prev)=> [...prev, ""]) }>Ajouter une option</Button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      className="px-4 py-2 rounded disabled:opacity-50"
                      variant="brand"
                      disabled={creatingQuiz || !quizTitle || !qText || options.some(o=>!o.trim()) || correct===null || (correct!==null && (correct as number) >= options.length)}
                      onClick={async ()=>{
                        try {
                          setCreatingQuiz(true);
                          console.log("[Quiz] Create/Update clicked");
                          push({ title: "Préparation", description: "Vérifications en cours…", variant: "info" });
                          if (correct===null || Number(correct) < 0 || Number(correct) >= options.length) {
                            push({ title: "Index de réponse invalide", description: "Choisis la bonne réponse parmi les options.", variant: "error" });
                            setCreatingQuiz(false);
                            return;
                          }
                          if (options.length < 2) {
                            push({ title: "Options insuffisantes", description: "Ajoute au moins 2 options.", variant: "error" });
                            setCreatingQuiz(false);
                            return;
                          }
                          if (!address) {
                            push({ title: "Wallet non connecté", description: "Connecte ton wallet pour créer le quiz.", variant: "error" });
                            setCreatingQuiz(false);
                            return;
                          }
                          if (!quizAddr) {
                            push({ title: "Adresse quiz manquante", description: "Vérifie NEXT_PUBLIC_QUIZ_ADDRESS dans l'env.", variant: "error" });
                            setCreatingQuiz(false);
                            return;
                          }
                          if (!publicClient) {
                            console.error("[Quiz] publicClient is undefined");
                            push({ title: "Client RPC indisponible", description: "Recharge la page et vérifie ta connexion réseau.", variant: "error" });
                            setCreatingQuiz(false);
                            return;
                          }
                          // Ensure correct chain before reads/writes
                          if (CONTRACTS.chainId && chainId !== CONTRACTS.chainId) {
                            try {
                              await switchChainAsync({ chainId: CONTRACTS.chainId });
                            } catch (e:any) {
                              push({ title: "Mauvaise chaîne", description: e?.shortMessage||e?.message||"Échec du switch de réseau", variant: "error" });
                              setCreatingQuiz(false);
                              return;
                            }
                          }
                          // Check bytecode exists at address (non-bloquant)
                          try {
                            const code = await publicClient.getBytecode({ address: quizAddr as `0x${string}` });
                            if (!code || code === '0x') {
                              push({ title: 'Contrat non détecté', description: 'Aucun bytecode à cette adresse. On tente quand même (vérifie NEXT_PUBLIC_QUIZ_ADDRESS).', variant: 'info' });
                            }
                          } catch (e:any) {
                            push({ title: 'Lecture bytecode impossible', description: (e?.shortMessage||e?.message||'getBytecode a échoué') + ' • On tente quand même.', variant: 'info' });
                          }
                          console.log("[Quiz] Reading hasQuiz…");
                          let existsBefore = false;
                          try {
                            existsBefore = await publicClient.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'hasQuiz' } as any) as any;
                          } catch (e:any) {
                            console.warn('[Quiz] hasQuiz read failed:', e?.shortMessage||e?.message||e);
                            let retried = false;
                            try {
                              await new Promise(r=>setTimeout(r, 200));
                              existsBefore = await publicClient.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'hasQuiz' } as any) as any;
                              retried = true;
                            } catch (e2:any) {
                              console.warn('[Quiz] hasQuiz retry failed:', e2?.shortMessage||e2?.message||e2);
                            }
                            if (!retried) {
                              push({ title: 'Lecture hasQuiz impossible', description: "On tente quand même la création (vérifie ensuite l'owner et l'adresse).", variant: 'info' });
                              existsBefore = false;
                            }
                          }
                          console.log("[Quiz] hasQuiz=", existsBefore);
                          if (!existsBefore) {
                            // Try simulate, but do NOT block if it fails (still open wallet)
                            let simOk = false;
                            try {
                              console.log("[Quiz] Simulating create…");
                              await publicClient.simulateContract({ account: address as `0x${string}`, address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "create", args: [quizTitle] } as any);
                              simOk = true;
                              push({ title: "Simulation ok", description: "create() passe, ouverture de MetaMask…", variant: "info" });
                            } catch (simErr: any) {
                              console.warn("[Quiz] simulate create failed, proceeding to wallet:", simErr);
                              push({ title: "Simulation create échouée", description: "On tente quand même l'envoi du tx…", variant: "info" });
                            }
                            console.log("[Quiz] Sending create tx…", simOk ? "(after ok sim)" : "(no sim)");
                            const txCreate = await writeContractAsync({ account: address as `0x${string}`, chainId: CONTRACTS.chainId as number, address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: "create", args: [quizTitle] } as any);
                            await publicClient?.waitForTransactionReceipt({ hash: txCreate as any });
                            push({ title: "Créé", description: "create() confirmé", variant: "success" });
                            // Optimistic local state so menu can pick it up immediately
                            setQuizExistsLocal(true);
                          }
                          // Simulate setQA before sending
                          let simSetOk = false;
                          try {
                            console.log("[Quiz] Simulating setQA…");
                            await publicClient.simulateContract({ account: address as `0x${string}`, address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "setQA", args: [qText, options, Number(correct)] } as any);
                            simSetOk = true;
                            push({ title: "Simulation ok", description: "setQA() passe, ouverture de MetaMask…", variant: "info" });
                          } catch (simErr: any) {
                            console.warn("[Quiz] simulate setQA failed, proceeding:", simErr);
                            push({ title: "Simulation setQA échouée", description: "On tente quand même l'envoi du tx…", variant: "info" });
                          }
                          console.log("[Quiz] Sending setQA tx…", simSetOk ? "(after ok sim)" : "(no sim)");
                          const txSet = await writeContractAsync({ account: address as `0x${string}`, chainId: CONTRACTS.chainId as number, address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: "setQA", args: [qText, options, Number(correct) as any] } as any);
                          await publicClient.waitForTransactionReceipt({ hash: txSet as any });
                          push({ title: "Q&R mis à jour", description: "setQA() confirmé", variant: "success" });
                          // Soft refetch to update UI instantly
                          try {
                            const existsNow = await publicClient.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "hasQuiz" } as any);
                            const getNow = await publicClient.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: "get" } as any);
                            const st = await publicClient.readContract({ address: quizAddr as `0x${string}`, abi: ABI.quiz as any, functionName: 'getStats' } as any);
                            if (typeof existsNow === 'boolean') setQuizExistsLocal(existsNow);
                            if (Array.isArray(getNow)) {
                              const [t,q,opt,a] = getNow as any;
                              setParsedQuizLocal({ title: t, question: q, options: opt, active: Boolean(a) });
                            }
                            if (Array.isArray(st)) { setParticipantsLocal(st[0] as bigint); setCorrectCountLocal(st[1] as bigint); }
                          } catch {}
                          push({ title: "Quiz créé", description: "Quiz et Q&R enregistrés", variant: "success" });
                        } catch (e:any) {
                          push({ description: e?.shortMessage||e?.message||"Échec création/MAJ du quiz", variant: "error" });
                        } finally {
                          setCreatingQuiz(false);
                        }
                      }}
                    >
                      {currentQuizExists ? 'Mettre à jour le quiz' : 'Créer le quiz'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        <section id="distribution-widget" className="border rounded-lg p-4 md:col-span-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <h2 className="font-semibold mb-3" style={{ color: TEXT_PRIMARY }}>Distribution</h2>
          {!CONTRACTS.distribution ? (
            <p className="text-sm border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>
              Adresse du contrat de distribution manquante. Renseigne `NEXT_PUBLIC_DISTRIBUTION_ADDRESS` dans `.env.local`.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium" style={{ color: TEXT_PRIMARY }}>Prize Money</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className={`border rounded px-2 py-1`}
                  placeholder="Montant total (ETH)"
                  value={totalEth}
                  onChange={(e) => setTotalEth(e.target.value)}
                  readOnly={Boolean(share70)}
                  style={{ borderColor: BORDER, ...(share70 ? { backgroundColor: BG_PANEL_HOVER, color: TEXT_PRIMARY } : {}) }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded-lg p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="text-xs uppercase tracking-wide" style={{ color: TEXT_SUBTLE }}>Winner #1 (70%)</div>
                  <div className="font-mono break-all select-text mt-1">{winner1 || "—"}</div>
                  {share70 && <div className="text-xs mt-1" style={{ color: TEXT_SUBTLE }}>≈ {share70} ETH</div>}
                </div>
                <div className="border rounded-lg p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="text-xs uppercase tracking-wide" style={{ color: TEXT_SUBTLE }}>Winner #2 (20%)</div>
                  <div className="font-mono break-all select-text mt-1">{winner2 || "—"}</div>
                  {share20 && <div className="text-xs mt-1" style={{ color: TEXT_SUBTLE }}>≈ {share20} ETH</div>}
                </div>
                <div className="border rounded-lg p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="text-xs uppercase tracking-wide" style={{ color: TEXT_SUBTLE }}>Winner #3 (10%)</div>
                  <div className="font-mono break-all select-text mt-1">{winner3 || "—"}</div>
                  {share10 && <div className="text-xs mt-1" style={{ color: TEXT_SUBTLE }}>≈ {share10} ETH</div>}
                </div>
              </div>
              <Button
                className="px-4 py-2 rounded disabled:opacity-50"
                variant="brand"
                disabled={!address || (!isAddress(winner1 as any) && !isAddress(winner2 as any) && !isAddress(winner3 as any)) || !share70 || !share20 || !share10}
                aria-disabled={!address || (!isAddress(winner1 as any) && !isAddress(winner2 as any) && !isAddress(winner3 as any)) || !share70 || !share20 || !share10}
                aria-busy={sendingDistribution}
                onClick={async () => {
                  try {
                    if (!CONTRACTS.treasury) { push({ description: 'Adresse Treasury manquante', variant: 'error' }); return; }
                    setSendingDistribution(true);
                    // Déclarer les tx hashes au scope extérieur pour pouvoir les réutiliser après
                    let tx1: `0x${string}` | null = null;
                    let tx2: `0x${string}` | null = null;
                    let tx3: `0x${string}` | null = null;
                    await withPendingToast('Paiements en cours', async () => {
                      const tasks: Array<Promise<any>> = [];
                      if (isAddress(winner1 as any)) {
                        tx1 = await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'spendPrize', args: [winner1 as `0x${string}`, parseEther(share70)], } as any) as any;
                        push({ title: 'Paiement 70% envoyé', description: 'Transaction envoyée', variant: 'success' });
                        tasks.push(publicClient!.waitForTransactionReceipt({ hash: tx1 as any }) as any);
                      }
                      if (isAddress(winner2 as any)) {
                        tx2 = await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'spendPrize', args: [winner2 as `0x${string}`, parseEther(share20)], } as any) as any;
                        push({ title: 'Paiement 20% envoyé', description: 'Transaction envoyée', variant: 'success' });
                        tasks.push(publicClient!.waitForTransactionReceipt({ hash: tx2 as any }) as any);
                      }
                      if (isAddress(winner3 as any)) {
                        tx3 = await writeContractAsync({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'spendPrize', args: [winner3 as `0x${string}`, parseEther(share10)], } as any) as any;
                        push({ title: 'Paiement 10% envoyé', description: 'Transaction envoyée', variant: 'success' });
                        tasks.push(publicClient!.waitForTransactionReceipt({ hash: tx3 as any }) as any);
                      }
                      await Promise.all(tasks);
                      // Retourner un hash pour respecter la signature de withPendingToast
                      return (tx1 as any) || (tx2 as any) || (tx3 as any) || ('0x0000000000000000000000000000000000000000000000000000000000000000' as any);
                    });
                    // Soft refresh du prizePool local
                    try {
                      const pool = await publicClient!.readContract({ address: CONTRACTS.treasury as `0x${string}`, abi: ABI.treasury as any, functionName: 'prizePool' } as any) as any;
                      if (typeof pool === 'bigint') {
                        setShare70(((Number(pool)/1e18)*0.7).toFixed(6));
                        setShare20(((Number(pool)/1e18)*0.2).toFixed(6));
                        setShare10(((Number(pool)/1e18)*0.1).toFixed(6));
                        setTotalEth((Number(pool)/1e18).toFixed(6));
                      }
                    } catch {}
                    // Record distribution on-chain in QuizRegistry si dispo
                    try {
                      if (CONTRACTS.registry && publicClient) {
                        const a1 = isAddress(winner1 as any) ? parseEther(share70) : BigInt(0);
                        const a2 = isAddress(winner2 as any) ? parseEther(share20) : BigInt(0);
                        const a3 = isAddress(winner3 as any) ? parseEther(share10) : BigInt(0);
                        let seedNow = lastDrawBlockHash as string | null;
                        try {
                          if (CONTRACTS.quiz) {
                            const res = await publicClient.readContract({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'getLastWinners' } as any) as any;
                            if (Array.isArray(res) && res[3]) seedNow = String(res[3]);
                          }
                        } catch {}
                        let at = Math.floor(Date.now()/1000);
                        try { const bn = await publicClient.getBlockNumber(); const b = await publicClient.getBlock({ blockNumber: bn }); at = Number(b.timestamp); } catch {}
                        const source = CONTRACTS.treasury as `0x${string}`;
                        await writeContractAsync({
                          address: CONTRACTS.registry as `0x${string}`,
                          abi: ABI.registry as any,
                          functionName: 'recordDistribution',
                          args: [
                            (isAddress(winner1 as any) ? winner1 : '0x0000000000000000000000000000000000000000') as `0x${string}`,
                            (isAddress(winner2 as any) ? winner2 : '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
                            (isAddress(winner3 as any) ? winner3 : '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
                            a1, a2, a3,
                            (tx1 || '0x0000000000000000000000000000000000000000000000000000000000000000') as any,
                            (tx2 || '0x0000000000000000000000000000000000000000000000000000000000000000') as any,
                            (tx3 || '0x0000000000000000000000000000000000000000000000000000000000000000') as any,
                            (seedNow || '0x') as any,
                            BigInt(at),
                            source,
                          ],
                        } as any);
                        push({ title: 'Historique mis à jour', description: 'Distribution enregistrée dans le Registry', variant: 'success' });
                      }
                    } catch (e:any) {
                      push({ description: formatTxError(e, 'Enregistrement Registry échoué'), variant: 'error' });
                    }
                  } catch (e:any) {
                    push({ description: formatTxError(e, 'Échec paiement depuis prize pool'), variant: 'error' });
                  } finally { setSendingDistribution(false); }
                }}
              >
                Payer les gagnants
              </Button>
              {lastDrawBlockHash && (
                <p className="text-xs mt-2" style={{ color: TEXT_SUBTLE }}>
                  Preuve du tirage: seed {shortHash(lastDrawBlockHash)}
                </p>
              )}
            </div>
          )}
        </section>
        {/* (Section legacy mock pools supprimée) */}

        {/* On-chain History (Registry) - full width, restyled */}
        <section className="border rounded-lg p-5 md:col-span-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="sticky top-0 z-10 -m-5 mb-3 p-3 border-b rounded-t-lg flex items-start justify-between gap-3" style={{ backgroundColor: BG_PANEL, borderBottomColor: BORDER }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
              Historique des tirages et paiements
              {(() => {
                const reg = (quizRegistry as string | undefined)?.toLowerCase?.();
                const exp = (CONTRACTS.registry || '').toLowerCase?.();
                if (!CONTRACTS.registry) return (<span className={badgeWarn}>⚠️ Registry non défini (env)</span>);
                if (!reg || reg === '0x0000000000000000000000000000000000000000') return (<span className={badgeWarn}>⚠️ Registry non lié</span>);
                if (reg === exp) return (<span className={badgeGood}>✅ Registry lié</span>);
                return (<span className={badgeWarn}>⚠️ Lié à une autre adresse</span>);
              })()}
              {autoLinking && (<span className={badgeInfo}>Lien en cours…</span>)}
            </h2>
            <div className="flex items-center gap-2">
              <input
                id="histFilter"
                value={histFilterInput}
                onChange={(e)=> setHistFilterInput(e.target.value)}
                placeholder="Rechercher (titre, seed, adresse…)"
                className="border rounded px-2 py-1 text-xs w-52"
                style={{ borderColor: BORDER }}
              />
              <select
                className="border rounded px-2 py-1 text-xs"
                value={histSort}
                onChange={(e)=> setHistSort(e.target.value as 'desc'|'asc')}
                aria-label="Tri"
                style={{ borderColor: BORDER }}
              >
                <option value="desc">Plus récents</option>
                <option value="asc">Plus anciens</option>
              </select>
              <label className="flex items-center gap-1 text-xs" style={{ color: TEXT_SUBTLE }}>
                <input id="histShowAll" type="checkbox" onChange={() => loadHistory(true)} style={{ accentColor: ORANGE }} /> Tout afficher (max 50)
              </label>
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Recharger l'historique" onClick={()=> loadHistory(false)} disabled={histLoading} aria-busy={histLoading}>
                {histLoading? 'Rafraîchissement…' : 'Recharger'}
              </Button>
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Exporter l'historique CSV" onClick={exportHistoryCSV}>Export CSV</Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] mb-3" style={{ color: TEXT_PRIMARY }}>
            <div className="border rounded p-2 flex items-center justify-between" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}><span>Quiz</span><span className="font-semibold">{quizEnds.length}</span></div>
            <div className="border rounded p-2 flex items-center justify-between" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}><span>Paiements</span><span className="font-semibold">{dists.length}</span></div>
            <div className="border rounded p-2 flex items-center justify-between" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}><span>Total distribué</span><span className="font-semibold">{fmtEth6.format(totalDistributedEth)} ETH</span></div>
          </div>

          <details className="mb-3">
            <summary className="cursor-pointer text-xs" style={{ color: TEXT_SUBTLE }}>Détails techniques</summary>
            <div className="mt-2 text-[10px] grid grid-cols-1 md:grid-cols-2 gap-y-1" style={{ color: TEXT_SUBTLE }}>
              <div className="break-all"><span className="font-semibold">owner (on-chain):</span> <span className="font-mono">{String(quizOwner||'')}</span></div>
              <div className="break-all"><span className="font-semibold">connecté:</span> <span className="font-mono">{String(address||'')}</span></div>
              <div className="break-all"><span className="font-semibold">registry (on-chain):</span> <span className="font-mono">{quizRegistry ? String(quizRegistry) : 'Inconnu (lecture non disponible)'}</span></div>
              <div className="break-all"><span className="font-semibold">registry (attendu .env):</span> <span className="font-mono">{String(CONTRACTS.registry||'')}</span></div>
              <div><span className="font-semibold">chainId:</span> {String(chainId)}</div>
            </div>
            <div className="mt-2 flex flex-col md:flex-row md:items-center gap-2 text-xs">
              <input className="border rounded px-2 py-1 w-[360px] max-w-full" placeholder="Adresse à autoriser/révoquer (0x...)" id="authAddrInput" style={{ borderColor: BORDER }} />
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={!CONTRACTS.registry}
                aria-disabled={!CONTRACTS.registry}
                aria-busy={sending}
                onClick={async () => {
                  try {
                    const el = document.getElementById('authAddrInput') as HTMLInputElement | null;
                    const who = (el?.value||'').trim();
                    if (!CONTRACTS.registry) { push({ description: 'Adresse Registry manquante', variant: 'error' }); return; }
                    if (!isAddress(who as any)) { push({ description: 'Adresse invalide', variant: 'error' }); return; }
                    await withPendingToast('Autorisation…', async () => await writeContractAsync({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'setAuthorized', args: [who as `0x${string}`, true] } as any) as any);
                    push({ title: 'Autorisé', description: 'Autorisation réussie', variant: 'success' });
                  } catch (e:any) {
                    push({ description: formatTxError(e, 'Échec autorisation'), variant: 'error' });
                  }
                }}>
                Autoriser ce wallet
              </Button>
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={!CONTRACTS.registry}
                aria-disabled={!CONTRACTS.registry}
                aria-busy={sending}
                onClick={async () => {
                  try {
                    const el = document.getElementById('authAddrInput') as HTMLInputElement | null;
                    const who = (el?.value||'').trim();
                    if (!CONTRACTS.registry) { push({ description: 'Adresse Registry manquante', variant: 'error' }); return; }
                    if (!isAddress(who as any)) { push({ description: 'Adresse invalide', variant: 'error' }); return; }
                    await withPendingToast('Révocation…', async () => await writeContractAsync({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'setAuthorized', args: [who as `0x${string}`, false] } as any) as any);
                    push({ title: 'Révoqué', description: 'Révocation réussie', variant: 'success' });
                  } catch (e:any) {
                    push({ description: formatTxError(e, 'Échec révocation'), variant: 'error' });
                  }
                }}>
                Révoquer
              </Button>
            </div>
          </details>

          {!CONTRACTS.registry ? (
            <p className="text-sm border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>NEXT_PUBLIC_REGISTRY_ADDRESS manquant dans `.env.local`.</p>
          ) : (
            <div className="text-sm">
              <h3 className="font-medium mb-2" style={{ color: TEXT_PRIMARY }}>Groupes par seed</h3>
              <div className="text-xs mb-2" style={{ color: TEXT_SUBTLE }}>{groups.length===0 ? 'Aucun élément pour le moment.' : `${groups.length} groupe(s)`}</div>
              <div className="space-y-2">
                {groupsPage.map((g:any, gi:number)=> (
                  <details key={`g-${g.seed}-${gi}`} className="border rounded" open style={{ borderColor: BORDER }}>
                    <summary className="cursor-pointer select-none px-2 py-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[12px]" title={`Seed: ${g.seed}`}>
                        Seed: <a className="underline" style={{ color: ORANGE }} href={blockUrl(String(g.seed))} target="_blank" rel="noopener noreferrer">{shortHash(String(g.seed))}</a>
                      </span>
                      <span className="text-[11px]" style={{ color: TEXT_SUBTLE }} title={`Dernier évènement: ${toISO(g.latestAt)}`}>{fmtDate(g.latestAt)}</span>
                      <span className={badgeNeutral} title="Nombre de paiements">{g.payments.length} paiement(s)</span>
                      <span className={badgeNeutral} title="Total distribué dans ce groupe">Total: {fmtEth6.format(g.totalEth)} ETH</span>
                      {!g.quiz && g.payments.length>0 && (
                        <span className={badgeWarn}>Orphelin</span>
                      )}
                      {!g.quiz && (()=>{ const id = qmIdBySeed[String(g.seed).toLowerCase()]; return id ? (
                        <span className={badgeInfo} title="Quiz trouvé dans QuizManager">QuizManager #{id}</span>
                      ) : null; })()}
                      {g.quiz && (
                        <span className="text-[12px]" title={`Quiz #${g.quiz.id}`}>{g.quiz.title || `Quiz #${g.quiz.id}`}</span>
                      )}
                    </summary>
                    <div className="px-2 pb-2 space-y-1">
                      {g.quiz && (
                        <div className="text-[11px]" style={{ color: TEXT_SUBTLE }}>Participants: {g.quiz.participants ?? '—'} · Bonnes réponses: {g.quiz.correct ?? '—'} · Fin: {fmtDate(g.quiz.endedAt)}</div>
                      )}
                      {(() => {
                        const seedKey = String(g.seed).toLowerCase();
                        const sorted = [...g.payments].sort((a:any,b:any)=> Number(b.at)-Number(a.at));
                        const totalPages = Math.max(1, Math.ceil(sorted.length / pageSizePerGroup));
                        const page = Math.min(payPageBySeed[seedKey] ?? 0, totalPages - 1);
                        const start = page * pageSizePerGroup;
                        const visible = sorted.slice(start, start + pageSizePerGroup);
                        return visible.map((d:any, idx:number)=> {
                          const tx1 = typeof d.t1 === 'string' && d.t1.startsWith('0x') && d.t1.length === 66 ? d.t1 : null;
                          const tx2 = typeof d.t2 === 'string' && d.t2.startsWith('0x') && d.t2.length === 66 ? d.t2 : null;
                          const tx3 = typeof d.t3 === 'string' && d.t3.startsWith('0x') && d.t3.length === 66 ? d.t3 : null;
                          const total = (Number(d.a1||0)+Number(d.a2||0)+Number(d.a3||0))/1e18;
                          return (
                            <div key={`d-${gi}-${start+idx}`} className="border rounded px-2 py-1" style={{ borderColor: BORDER }}>
                              <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }} title={toISO(d.at)}>{fmtDate(d.at)} · Seed: <a className="underline" style={{ color: ORANGE }} href={blockUrl(String(d.seed))} target="_blank" rel="noopener noreferrer">{shortHash(String(d.seed))}</a> · Σ {fmtEth6.format(total)} ETH</div>
                              <div className="flex items-center gap-2 text-[12px]" title={String(d.w1)}>
                                <span className="min-w-[28px]" style={{ color: TEXT_SUBTLE }}>W1</span>
                                <span className="font-mono">{shortAddr(String(d.w1))}</span>
                                <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Copier adresse W1" onClick={()=> copyToClipboard(String(d.w1), 'W1')}>Copier</Button>
                                <span style={{ color: TEXT_PRIMARY }}>{fmtEth6.format(Number(d.a1||0)/1e18)} ETH</span>
                                {tx1 ? (
                                  <a className="underline" style={{ color: ORANGE }} href={txUrl(tx1)} target="_blank" rel="noopener noreferrer" title={tx1}>Tx</a>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 text-[12px]" title={String(d.w2)}>
                                <span className="min-w-[28px]" style={{ color: TEXT_SUBTLE }}>W2</span>
                                <span className="font-mono">{shortAddr(String(d.w2))}</span>
                                <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Copier adresse W2" onClick={()=> copyToClipboard(String(d.w2), 'W2')}>Copier</Button>
                                <span style={{ color: TEXT_PRIMARY }}>{fmtEth6.format(Number(d.a2||0)/1e18)} ETH</span>
                                {tx2 ? (
                                  <a className="underline" style={{ color: ORANGE }} href={txUrl(tx2)} target="_blank" rel="noopener noreferrer" title={tx2}>Tx</a>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 text-[12px]" title={String(d.w3)}>
                                <span className="min-w-[28px]" style={{ color: TEXT_SUBTLE }}>W3</span>
                                <span className="font-mono">{shortAddr(String(d.w3))}</span>
                                <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Copier adresse W3" onClick={()=> copyToClipboard(String(d.w3), 'W3')}>Copier</Button>
                                <span style={{ color: TEXT_PRIMARY }}>{fmtEth6.format(Number(d.a3||0)/1e18)} ETH</span>
                                {tx3 ? (
                                  <a className="underline" style={{ color: ORANGE }} href={txUrl(tx3)} target="_blank" rel="noopener noreferrer" title={tx3}>Tx</a>
                                ) : null}
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {g.payments.length===0 && (
                        <div className="text-[12px]" style={{ color: TEXT_SUBTLE }}>Aucun paiement dans ce groupe.</div>
                      )}
                      {g.payments && g.payments.length > pageSizePerGroup && (() => {
                        const seedKey = String(g.seed).toLowerCase();
                        const sorted = [...g.payments].sort((a:any,b:any)=> Number(b.at)-Number(a.at));
                        const totalPages = Math.max(1, Math.ceil(sorted.length / pageSizePerGroup));
                        const page = Math.min(payPageBySeed[seedKey] ?? 0, totalPages - 1);
                        return (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Précédent" onClick={()=> setGroupPage(seedKey, page-1)} disabled={page<=0}>Précédent</Button>
                            <span className="text-[11px]" style={{ color: TEXT_SUBTLE }}>Page {page+1}/{totalPages}</span>
                            <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Suivant" onClick={()=> setGroupPage(seedKey, page+1)} disabled={page>=totalPages-1}>Suivant</Button>
                          </div>
                        );
                      })()}
                    </div>
                  </details>
                ))}
              </div>

              {/* Pagination controls */}
              {groups.length > pageSize && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>Par page:</span>
                    <select className="border rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
                      <option value={3}>3</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={pageClamped<=1} onClick={()=> setCurrentPage(p=> Math.max(1, p-1))}>Précédent</Button>
                    <span>Page {pageClamped} / {totalPages}</span>
                    <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={pageClamped>=totalPages} onClick={()=> setCurrentPage(p=> Math.min(totalPages, p+1))}>Suivant</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Historique des quiz (QuizManager) */}
        <section className="border rounded-lg p-5 md:col-span-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="-m-5 mb-3 p-3 border-b rounded-t-lg flex items-center justify-between" style={{ backgroundColor: BG_PANEL, borderBottomColor: BORDER }}>
            <h2 className="font-semibold" style={{ color: TEXT_PRIMARY }}>Historique des quiz (QuizManager)</h2>
            <div className="flex items-center gap-2 text-xs">
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" aria-label="Recharger l'historique QuizManager" onClick={()=> loadQuizManagerHistory(false)} disabled={qmLoading}>{qmLoading ? 'Chargement…' : 'Recharger'}</Button>
            </div>
          </div>
          {qmLoading ? (
            <div className="space-y-2">
              {[0,1,2].map(i=> (
                <div key={`qmskel-${i}`} className="border rounded p-2 animate-pulse" style={{ borderColor: BORDER }}>
                  <div className="h-4 rounded w-2/3 mb-2" style={{ backgroundColor: BG_PANEL_HOVER }} />
                  <div className="h-3 rounded w-1/3 mb-1" style={{ backgroundColor: BG_PANEL_HOVER }} />
                  <div className="h-3 rounded w-1/2" style={{ backgroundColor: BG_PANEL_HOVER }} />
                </div>
              ))}
            </div>
          ) : qmHistory.length === 0 ? (
            <div className="text-sm" style={{ color: TEXT_SUBTLE }}>Aucun quiz terminé côté QuizManager pour le moment.</div>
          ) : (
            <div className="space-y-2">
              {qmPage.map((h:any, i:number)=> {
                const seed = qmSeedById[String(h.id)] || '';
                const linkedGroup = seed && groups.find(g => String(g.seed).toLowerCase() === seed);
                return (
                  <div key={`qm-${h.idx}-${i}`} className="border rounded p-2 text-sm" style={{ borderColor: BORDER }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{h.title || `Quiz #${String(h.id)}`}</span>
                      <span className="text-xs" style={{ color: TEXT_SUBTLE }}>ID: {String(h.id)}</span>
                      <span className="text-xs" style={{ color: TEXT_SUBTLE }}>Fin: {fmtDate(h.endedAt)}</span>
                      {seed ? (
                        <span className={badgeNeutral}>Seed: <a className="underline" style={{ color: ORANGE }} href={blockUrl(seed)} target="_blank" rel="noopener noreferrer">{shortHash(seed)}</a></span>
                      ) : (
                        <span className={badgeWarn}>Seed inconnu (pas de log WinnersDrawn trouvé)</span>
                      )}
                      {linkedGroup ? (
                        <span className={badgeGood}>Lié à groupe paiements</span>
                      ) : seed ? (
                        <span className={badgeWarn}>Pas de paiements trouvés pour ce seed</span>
                      ) : null}
                    </div>
                    <div className="text-xs mt-1" style={{ color: TEXT_SUBTLE }}>Participants: {String(h.participants)} · Bonnes réponses: {String(h.correct)}</div>
                    <div className="mt-2 text-[13px]">
                      {h.question ? (
                        <div className="mb-1"><span className="font-medium">Question:</span> {String(h.question)}</div>
                      ) : null}
                      {Array.isArray(h.options) && h.options.length>0 && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: TEXT_SUBTLE }}>Réponses:</div>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {h.options.map((opt:string, idx:number)=> {
                              const ok = Number(h.correctIdx) === idx;
                              return (
                                <li key={`opt-${h.idx}-${idx}`} className={ok ? 'font-semibold' : ''} style={{ color: TEXT_PRIMARY }}>
                                  <span className="font-mono text-[11px] mr-1">#{idx+1}</span>
                                  {String(opt)}
                                  {ok && <span className={`${badgeGood} ml-2`}>Correct</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Pagination QuizManager */}
              {qmHistory.length > qmPageSize && (
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>Par page:</span>
                    <select className="border rounded px-2 py-1 focus:outline-none" value={qmPageSize} onChange={(e)=> setQmPageSize(Number(e.target.value))} style={{ borderColor: BORDER }}>
                      <option value={3}>3</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={qmPageClamped<=1} onClick={()=> setQmCurrentPage(p=> Math.max(1, p-1))}>Précédent</Button>
                    <span>Page {qmPageClamped} / {qmTotalPages}</span>
                    <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" disabled={qmPageClamped>=qmTotalPages} onClick={()=> setQmCurrentPage(p=> Math.min(qmTotalPages, p+1))}>Suivant</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Mini place de marché admin (listings à 90% du prix original) */}
        <section className="border rounded-lg p-5 md:col-span-2" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <h2 className="font-semibold mb-1" style={{ color: TEXT_PRIMARY }}>Mini place de marché admin</h2>
          <div className="text-xs mb-3" style={{ color: TEXT_SUBTLE }}>Affiche uniquement les listings au prix admin (90% du prix original). L’action achète via <code>Marketplace.buy</code>.</div>
          {adminEligibleDisplay.length === 0 ? (
            <div className="text-sm" style={{ color: TEXT_SUBTLE }}>{adminPrice === undefined ? "Chargement des listings…" : "Aucun ticket listé auprès de l’admin pour le moment."}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {adminEligibleDisplay.map((l) => (
                <div key={l.id} className="border rounded p-3 flex flex-col" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                  <div className="text-xs" style={{ color: TEXT_SUBTLE }}>Ticket #{Number(l.tokenId)}</div>
                  <div className="mt-1 text-sm truncate">Vendeur · {l.seller.slice(0,6)}…{l.seller.slice(-4)}</div>
                  <div className="mt-2 font-semibold">{(Number(l.price)/1e18).toFixed(6)} ETH</div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="px-3 py-1.5 rounded disabled:opacity-50"
                      variant="brand"
                      disabled={buyingId === l.id}
                      onClick={async () => {
                        try {
                          if (!CONTRACTS.marketplace || !CONTRACTS.treasury) return;
                          setBuyingId(l.id);
                          // Appel atomique via la Trésorerie: utilise la buybackPool et transfère le NFT à l'admin
                          const hash = await writeContractAsync({
                            address: CONTRACTS.treasury as `0x${string}`,
                            abi: ABI.treasury as any,
                            functionName: "buyFromMarketplace",
                            args: [CONTRACTS.marketplace as `0x${string}`, l.nft as `0x${string}`, l.tokenId as any, l.seller as `0x${string}`, address as `0x${string}`, l.price as any],
                          } as any);
                          // Wait for confirmation, then update UI immediately
                          await publicClient?.waitForTransactionReceipt({ hash: hash as any });
                          try {
                            removeListingById(l.id);
                          } catch {}
                          try {
                            // Clear local admin-injected listing if it is this token
                            const raw = localStorage.getItem(ADMIN_LS_KEY);
                            if (raw) {
                              const p = JSON.parse(raw) as { tokenId: string; priceWei: string } | null;
                              if (p && String(p.tokenId) === String(l.tokenId)) {
                                localStorage.removeItem(ADMIN_LS_KEY);
                              }
                            }
                          } catch {}
                          push({ description: `Rachat confirmé. Voir tx: ${txUrl(hash as any)}`, variant: "success" });
                        } catch (e:any) {
                          push({ description: e?.shortMessage || e?.message || "Échec du rachat", variant: "error" });
                        } finally {
                          setBuyingId(null);
                        }
                      }}
                    >
                      {buyingId === l.id ? "Rachat…" : "Racheter"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs" style={{ color: TEXT_SUBTLE }}>Remarque: l’achat transfère le ticket à votre wallet admin.</p>
        </section>

        {/* Gestion des fonds (off-chain) */}
        <section className="border rounded-lg p-5 md:col-span-2 mt-8" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <h2 className="font-semibold mb-1" style={{ color: TEXT_PRIMARY }}>Gestion des fonds (off-chain)</h2>
          <div className="text-xs mb-3" style={{ color: TEXT_SUBTLE }}>
            Renseigne la liste des protocoles/entreprises et montants en USDC. Ces données sont signées puis stockées côté serveur.
            La page publique <Link href="/treasury" className="underline" style={{ color: ORANGE }}>/treasury</Link> affiche la liste.
          </div>
          <div className="text-[12px] mb-3" style={{ color: TEXT_SUBTLE }}>
            {loadingTreasury ? 'Chargement…' : (
              treasuryMeta?.updatedAt ? (
                <>
                Dernière mise à jour: {new Date(treasuryMeta.updatedAt).toLocaleString()} {treasuryMeta.updatedBy ? (
                  <>· par <a className="underline" style={{ color: ORANGE }} href={addrUrl(String(treasuryMeta.updatedBy))} target="_blank" rel="noopener noreferrer">{String(treasuryMeta.updatedBy).slice(0,6)}…{String(treasuryMeta.updatedBy).slice(-4)}</a></>
                ) : null}
                </>
              ) : 'Aucune donnée pour le moment.'
            )}
          </div>
          <div className="space-y-2">
            {funds.map((r, idx) => {
              const err = errors[idx] || {};
              return (
                <div key={`fund-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <input
                  className={`md:col-span-4 border rounded px-2 py-1 text-sm ${err.name ? 'border-red-400 bg-red-50' : ''}`}
                  placeholder="Nom (protocole/entreprise)"
                  value={r.name}
                  onChange={(e)=> updateFund(idx, 'name', e.target.value)}
                />
                <input
                  className={`md:col-span-5 border rounded px-2 py-1 text-sm font-mono ${err.wallet ? 'border-red-400 bg-red-50' : ''}`}
                  placeholder="Wallet (0x...)"
                  value={r.wallet}
                  onChange={(e)=> updateFund(idx, 'wallet', e.target.value)}
                />
                <input
                  className={`md:col-span-2 border rounded px-2 py-1 text-sm ${err.usdc ? 'border-red-400 bg-red-50' : ''}`}
                  placeholder="Montant USDC"
                  value={r.usdc}
                  onChange={(e)=> updateFund(idx, 'usdc', e.target.value)}
                />
                <div className="md:col-span-1 flex items-center">
                  <Button className={btnSm} aria-label={`Supprimer la ligne ${idx+1}`} onClick={()=> removeFundRow(idx)} disabled={funds.length<=1}>Supprimer</Button>
                </div>
              </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Button className={btnSm} onClick={addFundRow}>Ajouter une ligne</Button>
              <Button className={btnSm} onClick={loadTreasury} disabled={loadingTreasury} aria-busy={loadingTreasury}>{loadingTreasury ? 'Rechargement…' : 'Recharger'}</Button>
              <Button className="px-3 py-1.5 rounded disabled:opacity-50" variant="brand" onClick={saveFunds} disabled={savingTreasury} aria-busy={savingTreasury}>
                {savingTreasury ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
            <div className="text-sm" style={{ color: TEXT_PRIMARY }}>
              Total USDC: {(() => {
                try {
                  const s = funds.reduce((acc, r) => acc + (Number(r.usdc)||0), 0);
                  return s.toLocaleString(undefined, { maximumFractionDigits: 2 });
                } catch { return '—'; }
              })()} USDC
            </div>
          </div>
          <div className="mt-2 text-[11px]" style={{ color: TEXT_SUBTLE }}>Validation côté client: adresse ETH et montant ≥ 0. Seules les lignes valides sont enregistrées.</div>
        </section>
      </div>
      </div>
    </div>
  );
}
