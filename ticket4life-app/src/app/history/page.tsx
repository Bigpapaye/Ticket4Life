"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { CONTRACTS, ABI } from "@/config/contracts";
import { BRAND_ORANGE, BG_CREAM, BG_PANEL, TEXT_PRIMARY, TEXT_SUBTLE, BORDER } from "@/styles/theme";
import { txUrl, addrUrl } from "@/lib/explorer";
import { Button } from "@/components/ui/Button";
import { Manrope } from "next/font/google";
import { APP } from "@/config/app";

const ORANGE = BRAND_ORANGE;
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400","600","700"] });

// Small helpers for display
const formatEth = (wei?: any) => ((Number(wei || 0) / 1e18).toFixed(6));
const shortAddr = (a?: string) => {
  const s = String(a || '');
  return s && s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

export default function HistoryPage() {
  // Public client (pinned to Base Sepolia if applicable)
  const readClient = useMemo(() => {
    try {
      if (CONTRACTS.chainId === 84532) {
        const rpc = APP.baseRpcUrl;
        return createPublicClient({ chain: baseSepolia, transport: http(rpc || undefined) });
      }
    } catch {}
    // fallback: generic client from env
    return createPublicClient({ chain: baseSepolia, transport: http(APP.baseRpcUrl || undefined) });
  }, []);

  const [histLoading, setHistLoading] = useState(false);
  const [quizEnds, setQuizEnds] = useState<any[]>([]);
  const [dists, setDists] = useState<any[]>([]);
  const [histSort, setHistSort] = useState<'desc'|'asc'>("desc");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  const loadHistory = async (silent = false) => {
    if (!CONTRACTS.registry) return;
    if (!silent) setHistLoading(true);
    try {
      // Always read against the latest head to avoid cached/stale RPC responses
      let head: bigint | undefined;
      try {
        head = await readClient.getBlockNumber();
      } catch {}
      console.debug('[History] Reading registry', {
        registry: CONTRACTS.registry,
        chainId: CONTRACTS.chainId,
        head: head ? Number(head) : null,
      });
      const [lenQ, lenD] = await Promise.all([
        readClient.readContract({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'quizEndsLength', ...(head ? { blockNumber: head } : {}) } as any) as any,
        readClient.readContract({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'distributionsLength', ...(head ? { blockNumber: head } : {}) } as any) as any,
      ]);
      console.debug('[History] Lengths', { quizEndsLength: String(lenQ||0), distributionsLength: String(lenD||0) });
      const qn = Number(lenQ || 0);
      const dn = Number(lenD || 0);
      const limit = 50;
      const takeQ = Math.min(limit, qn);
      const takeD = Math.min(limit, dn);
      const qIndexes = Array.from({ length: takeQ }, (_, i) => qn - 1 - i).filter(i => i >= 0);
      const dIndexes = Array.from({ length: takeD }, (_, i) => dn - 1 - i).filter(i => i >= 0);
      const qContracts = qIndexes.map((idx) => ({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'getQuizEnd', args: [BigInt(idx)], ...(head ? { blockNumber: head } : {}) }));
      const dContracts = dIndexes.map((idx) => ({ address: CONTRACTS.registry as `0x${string}`, abi: ABI.registry as any, functionName: 'getDistribution', args: [BigInt(idx)], ...(head ? { blockNumber: head } : {}) }));
      const [qRes, dRes] = await Promise.all([
        qContracts.length ? readClient.multicall({ contracts: qContracts as any, allowFailure: true } as any) : Promise.resolve([]),
        dContracts.length ? readClient.multicall({ contracts: dContracts as any, allowFailure: true } as any) : Promise.resolve([]),
      ]);
      const qParsed = (qRes as any[]).map((r, i) => ({ idx: qIndexes[i], ...(Array.isArray(r?.result) ? {
        id: r.result[0], title: r.result[1], question: r.result[2], options: r.result[3], correctIdx: r.result[4], participants: r.result[5], correct: r.result[6], w1: r.result[7], w2: r.result[8], w3: r.result[9], seed: r.result[10], endedAt: r.result[11], source: r.result[12]
      } : {})})).filter(x => x.id !== undefined);
      const dParsed = (dRes as any[]).map((r, i) => ({ idx: dIndexes[i], ...(Array.isArray(r?.result) ? {
        w1: r.result[0], w2: r.result[1], w3: r.result[2], a1: r.result[3], a2: r.result[4], a3: r.result[5], t1: r.result[6], t2: r.result[7], t3: r.result[8], seed: r.result[9], at: r.result[10], source: r.result[11]
      } : {})})).filter(x => x.w1 !== undefined);
      console.debug('[History] Parsed', { quizzes: qParsed.length, dists: dParsed.length, seeds: dParsed.slice(0,5).map((x:any)=>String(x.seed)) });
      // Associer paiements aux quiz via seed
      const dBySeed = new Map<string, any[]>();
      for (const d of dParsed) {
        const key = String(d.seed).toLowerCase();
        const arr = dBySeed.get(key) || [];
        arr.push(d);
        dBySeed.set(key, arr);
      }
      const asLower = (a?: string) => (a || '').toLowerCase();
      const sameWinner = (qa?: string, qb?: string) => qa && qb && asLower(qa) === asLower(qb);
      const within = (a: number, b: number, sec: number) => Math.abs(a - b) <= sec;
      // Build enriched quizzes: seed match first, then infer by winners/time if needed
      const qEnriched = qParsed.map((q) => {
        let arr = dBySeed.get(String(q.seed).toLowerCase()) || [];
        // Fallback inference: if no seed-linked distribution, try to match by winners and time proximity
        if (!arr.length) {
          const qeAt = Number(q.endedAt || 0);
          const cand = (dParsed as any[]).filter((d:any) => {
            // require at least one winner overlap
            const winnerOverlap = (
              sameWinner(q.w1, d.w1) || sameWinner(q.w1, d.w2) || sameWinner(q.w1, d.w3) ||
              sameWinner(q.w2, d.w1) || sameWinner(q.w2, d.w2) || sameWinner(q.w2, d.w3) ||
              sameWinner(q.w3, d.w1) || sameWinner(q.w3, d.w2) || sameWinner(q.w3, d.w3)
            );
            const dt = Number(d.at || 0);
            // 24h window around quiz end to be safe
            const timeOk = qeAt > 0 ? within(qeAt, dt, 24*3600) : true;
            return winnerOverlap && timeOk;
          });
          if (cand.length) arr = cand;
        }
        // Prioritize distributions with real tx hashes and most recent first
        const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const score = (d:any) => [d?.t1, d?.t2, d?.t3].reduce((s:any, t:any) => s + ((t && String(t) !== ZERO) ? 1 : 0), 0);
        arr = [...arr].sort((a:any, b:any) => {
          const sb = score(b) - score(a);
          if (sb !== 0) return sb;
          return Number(b.at||0) - Number(a.at||0);
        });
        const total = arr.reduce((sum, x) => sum + Number(x.a1||0) + Number(x.a2||0) + Number(x.a3||0), 0);
        return { ...q, dists: arr, totalAmount: total } as any;
      });
      // Fallback: also read quiz history directly from QuizManager in case recordQuizEnd wasn't called
      let qLocal: any[] = [];
      if (CONTRACTS.quiz) {
        try {
          const hLen = await readClient.readContract({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'historyLength', ...(head ? { blockNumber: head } : {}) } as any) as any;
          const hn = Number(hLen || 0);
          const limit = 50;
          const take = Math.min(limit, hn);
          const idxs = Array.from({ length: take }, (_, i) => hn - 1 - i).filter(i => i >= 0);
          const contracts = idxs.map((idx) => ({ address: CONTRACTS.quiz as `0x${string}`, abi: ABI.quiz as any, functionName: 'getHistory', args: [BigInt(idx)], ...(head ? { blockNumber: head } : {}) }));
          const res = contracts.length ? await readClient.multicall({ contracts: contracts as any, allowFailure: true } as any) : [];
          qLocal = (res as any[]).map((r, i) => ({
            idx: idxs[i],
            ...(Array.isArray(r?.result) ? {
              id: r.result[0], title: r.result[1], question: r.result[2], options: r.result[3], correctIdx: r.result[4], participants: r.result[5], correct: r.result[6], endedAt: r.result[7]
            } : {})
          })).filter(x => x.id !== undefined);
        } catch (e) { console.debug('[History] QuizManager history read failed', e); }
      }
      // Merge registry quizEnds with local quiz history by id (avoid duplicates)
      const regById = new Map<string, any>();
      for (const q of qEnriched) { regById.set(String(q.id), q); }
      for (const q of qLocal) {
        const key = String(q.id);
        if (!regById.has(key)) {
          regById.set(key, { ...q, dists: [], totalAmount: 0, source: CONTRACTS.quiz });
        }
      }
      const allQuizzes = Array.from(regById.values());
      console.debug('[History] Parsed', { quizzes: allQuizzes.length, dists: dParsed.length, seeds: dParsed.slice(0,5).map((x:any)=>String(x.seed)) });
      setQuizEnds(allQuizzes);
      setDists(dParsed);
      setLastSync(Date.now());
    } catch (e:any) {
      console.error(e);
    } finally { if (!silent) setHistLoading(false); }
  };

  useEffect(() => {
    let iv: any;
    loadHistory(true);
    iv = setInterval(() => loadHistory(true), 30000);
    // Refresh when tab regains focus/visibility
    const onFocus = () => loadHistory(true);
    const onVis = () => { if (document.visibilityState === 'visible') loadHistory(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (iv) clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // No CSV export on public page (not needed for players)

  const blockUrl = (hash: string) => `https://sepolia.basescan.org/search?f=0&q=${hash}`;
  // txUrl is used directly with t1,t2,t3

  // Construire une liste fusionnée sans doublons:
  // - Tente d'abord d'attacher les distributions orphelines aux quiz sans dist à proximité temporelle
  // - Puis rend tous les quiz (avec dists désormais rattachées si possible)
  // - Enfin ajoute uniquement les distributions restantes réellement orphelines
  const mergedItems = useMemo(() => {
    const quizzes = Array.isArray(quizEnds) ? quizEnds.map((q:any) => ({ ...q })) : [];
    const distList = Array.isArray(dists) ? dists.map((d:any) => ({ ...d })) : [];
    // Marquer les distributions déjà utilisées par les quizzes (par seed)
    const usedDistIdx = new Set<number>();
    for (const q of quizzes) {
      if (Array.isArray(q.dists)) {
        for (const d of q.dists) {
          if (typeof d.idx === 'number') usedDistIdx.add(d.idx);
        }
      }
    }
    // Fenêtre de rapprochement temporel
    const WINDOW_SEC = 3 * 3600; // 3h
    const within = (a:number, b:number, sec:number) => Math.abs(a - b) <= sec;
    // Pour chaque dist non utilisée, tenter de l'attacher au quiz le plus proche sans dist
    for (const d of distList) {
      if (typeof d.idx !== 'number' || usedDistIdx.has(d.idx)) continue;
      const dAt = Number(d.at || 0);
      let best: any = null;
      let bestDt = Number.MAX_SAFE_INTEGER;
      for (const q of quizzes) {
        const qAt = Number(q?.endedAt || (q?.dists?.[0]?.at ?? 0) || 0);
        const hasDist = Array.isArray(q.dists) && q.dists.length > 0;
        if (!qAt || hasDist) continue;
        const dt = Math.abs(qAt - dAt);
        if (dt <= WINDOW_SEC && dt < bestDt) { best = q; bestDt = dt; }
      }
      if (best) {
        best.dists = Array.isArray(best.dists) ? [...best.dists, d] : [d];
        // Recalcul simple du total
        best.totalAmount = (best.dists as any[]).reduce((sum, x:any) => sum + Number(x.a1||0) + Number(x.a2||0) + Number(x.a3||0), 0);
        usedDistIdx.add(d.idx);
      }
    }
    // Les distributions réellement orphelines (non attachées)
    const orphanDists = distList.filter((d:any) => !usedDistIdx.has(d.idx));
    const quizItems = quizzes.map((q:any) => ({
      type: 'quiz' as const,
      at: Number(q?.endedAt || (q?.dists?.[0]?.at ?? 0)),
      key: `q-${q.idx}`,
      q,
    }));
    const distItems = orphanDists.map((d:any) => ({
      type: 'dist' as const,
      at: Number(d?.at || 0),
      key: `d-${d.idx}`,
      d,
    }));
    const items = [...quizItems, ...distItems];
    items.sort((a, b) => histSort === 'desc' ? (b.at - a.at) : (a.at - b.at));
    return items;
  }, [quizEnds, dists, histSort]);

  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: BG_CREAM, minHeight: "100vh", color: TEXT_PRIMARY }}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Live region for loading announcements */}
      <div aria-live="polite" role="status" className="sr-only">{histLoading ? 'Chargement de l\'historique…' : ''}</div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT_PRIMARY }}>Historique des paiements et transparence</h1>
      <p className="text-sm mb-4" style={{ color: TEXT_SUBTLE }}>Toutes les informations on-chain: tirages, paiements, adresses et liens vérifiables.</p>

      {/* Contracts summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
        <div className="border rounded p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="font-semibold mb-1">QuizManager</div>
          <div className="font-mono break-all">{String(CONTRACTS.quiz||'')}</div>
          {CONTRACTS.quiz && <a className="underline" style={{ color: ORANGE }} href={addrUrl(CONTRACTS.quiz!)} target="_blank" rel="noreferrer">Voir sur explorer</a>}
        </div>

        <div className="border rounded p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="font-semibold mb-1">QuizRegistry</div>
          <div className="font-mono break-all">{String(CONTRACTS.registry||'')}</div>
          {CONTRACTS.registry && <a className="underline" style={{ color: ORANGE }} href={addrUrl(CONTRACTS.registry!)} target="_blank" rel="noreferrer">Voir sur explorer</a>}
        </div>
        <div className="border rounded p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="font-semibold mb-1">Treasury (prize)</div>
          <div className="font-mono break-all">{String(CONTRACTS.treasury||'')}</div>
          {CONTRACTS.treasury && <a className="underline" style={{ color: ORANGE }} href={addrUrl(CONTRACTS.treasury!)} target="_blank" rel="noreferrer">Voir sur explorer</a>}
        </div>
      </div>

      {/* Controls removed for public page */}

      {/* Liste historique — sans grand cadre */}
      <div className="p-0 bg-transparent" aria-busy={histLoading} aria-describedby="history-loading-desc">
        <div className="flex items-center justify-end mb-2">
          <label className="flex items-center gap-1 text-xs" aria-label="Contrôle de tri de l'historique">
            <span style={{ color: TEXT_SUBTLE }}>Tri</span>
            <select
              value={histSort}
              onChange={e=>setHistSort(e.target.value as any)}
              className="border rounded px-2 py-1"
              style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}
              aria-label="Sélectionner l'ordre de tri"
              aria-controls="history-list"
            >
              <option value="desc">Récent → Ancien</option>
              <option value="asc">Ancien → Récent</option>
            </select>
          </label>
        </div>
        {lastSync && (
          <div className="text-[11px] mb-2" style={{ color: TEXT_SUBTLE }}>Dernière synchro: {new Date(lastSync).toLocaleTimeString()}</div>
        )}
        {histLoading && (
          <div className="animate-pulse space-y-2" id="history-loading-desc">
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
            <div className="h-16 rounded" style={{ backgroundColor: BG_PANEL }} />
          </div>
        )}
        <div className="space-y-3" id="history-list">
          {mergedItems.length === 0 ? (
            <div className="text-sm" style={{ color: TEXT_SUBTLE }}>Aucun enregistrement pour le moment.</div>
          ) : (
            mergedItems.map((item: any) => {
              if (item.type === 'quiz') {
                const q = item.q;
                const d = Array.isArray(q.dists) && q.dists.length ? q.dists[0] : null;
                const isOpen = !!openDetails[item.key];
                const detailsId = `quiz-details-${item.key}`;
                return (
                  <div key={item.key} className="border rounded-lg p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-base font-semibold" style={{ color: TEXT_PRIMARY }}>
                        {new Date(Number(q.endedAt || (d?.at ?? 0)) * 1000).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[12px]" style={{ color: TEXT_SUBTLE }}>ID: {String(q.id ?? '')}</div>
                        <Button
                          variant="brand"
                          size="sm"
                          className="text-[12px]"
                          onClick={() => setOpenDetails(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                          aria-expanded={isOpen}
                          aria-pressed={isOpen}
                          aria-controls={detailsId}
                        >{isOpen ? 'Masquer les détails' : 'Détails'}</Button>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="font-medium text-sm" style={{ color: TEXT_PRIMARY }}>{String(q.title || 'Quiz')}</div>
                      {!!q?.totalAmount && (
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full border text-[11px]" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>
                          Total distribué: {formatEth(q.totalAmount)} ETH
                        </div>
                      )}
                    </div>
                    {/* Winners section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 1</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d?.a1)} ETH</div>
                        <div className="text-[12px] mt-1" style={{ color: TEXT_SUBTLE }}>{(d?.w1 || q?.w1) ? (<a className="underline" href={addrUrl(d?.w1 || q?.w1)} target="_blank" rel="noreferrer">{shortAddr(d?.w1 || q?.w1)}</a>) : '—'}</div>
                        {d?.t1 && String(d.t1) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t1))}>Voir la transaction</a></div>
                        )}
                      </div>
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 2</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d?.a2)} ETH</div>
                        <div className="text-[12px] mt-1" style={{ color: TEXT_SUBTLE }}>{(d?.w2 || q?.w2) ? (<a className="underline" href={addrUrl(d?.w2 || q?.w2)} target="_blank" rel="noreferrer">{shortAddr(d?.w2 || q?.w2)}</a>) : '—'}</div>
                        {d?.t2 && String(d.t2) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t2))}>Voir la transaction</a></div>
                        )}
                      </div>
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 3</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d?.a3)} ETH</div>
                        <div className="text-[12px] mt-1" style={{ color: TEXT_SUBTLE }}>{(d?.w3 || q?.w3) ? (<a className="underline" href={addrUrl(d?.w3 || q?.w3)} target="_blank" rel="noreferrer">{shortAddr(d?.w3 || q?.w3)}</a>) : '—'}</div>
                        {d?.t3 && String(d.t3) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t3))}>Voir la transaction</a></div>
                        )}
                      </div>
                    </div>
                    {/* Status banners if no distribution */}
                    {(!d && q && q.seed !== undefined && q.source !== CONTRACTS.quiz) && (
                      <div className="mt-3 text-[12px] border rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_SUBTLE, borderColor: BORDER }}>
                        Paiement en attente d'enregistrement dans le Registry pour ce quiz (seed: {String(q.seed)}).
                      </div>
                    )}
                    {(!d && q && (q.seed === undefined || q.source === CONTRACTS.quiz)) && (
                      <div className="mt-3 text-[12px]" style={{ color: TEXT_SUBTLE }}>
                        Enregistré via QuizManager (fallback). Les paiements apparaîtront dès qu'une distribution sera associée au seed correspondant dans le Registry.
                      </div>
                    )}
                    {/* Footer with contract & seed (toggle) */}
                    {d && isOpen && (
                      <div id={detailsId} role="region" className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>Contrat: <a className="ml-1 underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/address/${d.source}`}>{shortAddr(d.source)}</a></span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>Seed: <span className="ml-1 break-all">{String(d.seed)}</span> <a className="ml-2 underline" style={{ color: ORANGE }} href={blockUrl(String(d.seed))} target="_blank" rel="noreferrer">Tracer</a></span>
                      </div>
                    )}
                  </div>
                );
              } else {
                const d = item.d;
                return (
                  <div key={item.key} className="border rounded-lg p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-base font-semibold" style={{ color: TEXT_PRIMARY }}>
                        {new Date(Number(d.at) * 1000).toLocaleString()}
                      </div>
                    </div>
                    {/* Winners */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 1</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d.a1)} ETH</div>
                        {d.t1 && String(d.t1) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t1))}>Voir la transaction</a></div>
                        )}
                      </div>
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 2</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d.a2)} ETH</div>
                        {d.t2 && String(d.t2) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t2))}>Voir la transaction</a></div>
                        )}
                      </div>
                      <div className="rounded border p-3" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
                        <div className="text-[11px] mb-1" style={{ color: TEXT_SUBTLE }}>Gagnant 3</div>
                        <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>{formatEth(d.a3)} ETH</div>
                        {d.t3 && String(d.t3) !== ZERO_HASH && (
                          <div className="text-[12px] mt-1"><a className="underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={txUrl(String(d.t3))}>Voir la transaction</a></div>
                        )}
                      </div>
                    </div>
                    {/* Footer with contract & seed */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>Contrat: <a className="ml-1 underline" style={{ color: ORANGE }} target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/address/${d.source}`}>{shortAddr(d.source)}</a></span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}>Seed: <span className="ml-1 break-all">{String(d.seed)}</span> <a className="ml-2 underline" style={{ color: ORANGE }} href={blockUrl(String(d.seed))} target="_blank" rel="noreferrer">Tracer</a></span>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </div>
  </div>
);
}
