"use client";

import { useSyncExternalStore } from "react";
import { adminWallets } from "@/config/adminWallets";

export type Address = `0x${string}`;
export type Listing = { id: string; priceEth: number; owner: Address };
export type Ticket = { owner: Address; eligibleThisWeek: boolean };

type State = {
  week: number;
  pools: { sale: number; buyback: number; prize: number };
  totals: { minted: number };
  listings: Listing[];
  tickets: Record<Address, Ticket>; // 1 ticket per wallet
  winners: { week: number; winner: Address; prizeEth: number }[];
  ledger: { ts: number; type: string; details: any }[];
  currentQuiz: { id: string; title: string; active: boolean; question?: string; options?: string[]; correctIndex?: number } | null;
  quizzes: { id: string; title: string; createdAt: number; status: "archived" | "completed" | "canceled"; question?: string; options?: string[]; correctIndex?: number }[];
  pendingPayouts: { address: Address; amount: number }[] | null;
};

// Try to restore persisted state (client-side only)
let persisted: State | null = null;
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem("t4l_store_v1");
    if (raw) persisted = JSON.parse(raw) as State;
  } catch {}
}

let state: State = persisted ?? {
  week: 1,
  pools: { sale: 0.0123, buyback: 0.0045, prize: 0.002 },
  totals: { minted: 0 },
  listings: [],
  tickets: {},
  winners: [],
  ledger: [],
  currentQuiz: null,
  quizzes: [],
  pendingPayouts: null,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): Readonly<State> {
  return state;
}

function setState(updater: (prev: State) => State) {
  state = updater(state);
  // Persist after each change (best-effort)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("t4l_store_v1", JSON.stringify(state));
    } catch {}
  }
  emit();
}

// Actions (mock logic)
const TICKET_PRICE = 0.001;

export const actions = {
  mintTicket(owner?: Address): { ok: boolean; message: string } {
    if (!owner) return { ok: false, message: "Wallet non connecté" };
    if (state.tickets[owner]) return { ok: false, message: "Déjà 1 ticket par wallet" };
    setState((s) => {
      const next: State = {
        ...s,
        totals: { minted: s.totals.minted + 1 },
        tickets: { ...s.tickets, [owner]: { owner, eligibleThisWeek: false } },
        // 80% vers Pool Vente, 20% vers Buyback
        pools: {
          sale: s.pools.sale + TICKET_PRICE * 0.8,
          buyback: s.pools.buyback + TICKET_PRICE * 0.2,
          prize: s.pools.prize,
        },
        ledger: [...s.ledger, { ts: Date.now(), type: "mint", details: { owner, amount: TICKET_PRICE } }],
      };
      return next;
    });
    return { ok: true, message: "Ticket minté (mock)" };
  },

  // Top3 preparation: 70/20/10 split into pending payouts (manual send)
  prepareTop3(totalPrize?: number): { ok: boolean; message: string } {
    const amount = totalPrize && totalPrize > 0 ? totalPrize : state.pools.prize;
    const eligible = Object.values(state.tickets).filter((t) => t.eligibleThisWeek);
    if (eligible.length < 1) return { ok: false, message: "Aucun ticket éligible" };
    if (state.pools.prize < amount) return { ok: false, message: "Prize Pool insuffisante" };
    // pick up to 3 distinct winners randomly
    const pool = [...eligible.map((t) => t.owner)];
    const pickUnique = (): Address | null => {
      if (pool.length === 0) return null;
      const i = Math.floor(Math.random() * pool.length);
      const addr = pool[i];
      pool.splice(i, 1);
      return addr;
    };
    const w1 = pickUnique();
    const w2 = pickUnique();
    const w3 = pickUnique();
    const payouts: { address: Address; amount: number }[] = [];
    if (w1) payouts.push({ address: w1, amount: +(amount * 0.7).toFixed(6) });
    if (w2) payouts.push({ address: w2, amount: +(amount * 0.2).toFixed(6) });
    if (w3) payouts.push({ address: w3, amount: +(amount * 0.1).toFixed(6) });
    setState((s) => ({
      ...s,
      pendingPayouts: payouts,
      ledger: [...s.ledger, { ts: Date.now(), type: "prepare-top3", details: { week: s.week, total: amount, payouts } }],
    }));
    return { ok: true, message: "Gagnants préparés (mock)" };
  },

  confirmTop3Distribution(): { ok: boolean; message: string } {
    if (!state.pendingPayouts || state.pendingPayouts.length === 0) return { ok: false, message: "Rien à distribuer" };
    const total = state.pendingPayouts.reduce((acc, p) => acc + p.amount, 0);
    if (state.pools.prize < total) return { ok: false, message: "Prize Pool insuffisante" };
    // finalize week, clear pending and reset eligibility
    setState((s) => ({
      ...s,
      pools: { ...s.pools, prize: s.pools.prize - total },
      winners: [
        ...s.winners,
        ...s.pendingPayouts!.map((p) => ({ week: s.week, winner: p.address, prizeEth: p.amount })),
      ],
      week: s.week + 1,
      pendingPayouts: null,
      tickets: Object.fromEntries(
        Object.entries(s.tickets).map(([addr, t]) => [addr as Address, { ...t, eligibleThisWeek: false }])
      ),
      quizzes: s.currentQuiz
        ? [
            ...(s.quizzes || []),
            {
              id: s.currentQuiz.id,
              title: s.currentQuiz.title,
              createdAt: Date.now(),
              status: "completed" as const,
              question: s.currentQuiz.question,
              options: s.currentQuiz.options,
              correctIndex: s.currentQuiz.correctIndex,
            },
          ]
        : s.quizzes || [],
      currentQuiz: s.currentQuiz ? null : s.currentQuiz,
      ledger: [...s.ledger, { ts: Date.now(), type: "confirm-top3", details: { total } }],
    }));
    return { ok: true, message: "Distribution confirmée (mock)" };
  },

  cancelTop3Preparation(): { ok: boolean; message: string } {
    if (!state.pendingPayouts) return { ok: true, message: "Aucun lot en préparation" };
    setState((s) => ({ ...s, pendingPayouts: null, ledger: [...s.ledger, { ts: Date.now(), type: "cancel-top3", details: {} }] }));
    return { ok: true, message: "Préparation annulée" };
  },

  // Quiz management (mock)
  createQuiz(title: string) {
    if (!title.trim()) return { ok: false, message: "Titre requis" };
    setState((s) => ({
      ...s,
      currentQuiz: { id: `${Date.now()}`, title, active: false },
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz-create", details: { title } }],
    }));
    return { ok: true, message: "Quiz créé (mock)" };
  },
  setQuizActive(active: boolean) {
    if (!state.currentQuiz) return { ok: false, message: "Aucun quiz" };
    if (active) {
      const q = state.currentQuiz;
      const ready = !!q.question && Array.isArray(q.options) && q.options.length >= 3 && typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < q.options.length;
      if (!ready) return { ok: false, message: "Complète la question et les réponses avant d'activer" };
    }
    setState((s) => ({
      ...s,
      currentQuiz: s.currentQuiz ? { ...s.currentQuiz, active } : null,
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz-active", details: { active } }],
    }));
    return { ok: true, message: active ? "Quiz activé" : "Quiz désactivé" };
  },

  setQuizQA(question: string, options: string[], correctIndex: number) {
    if (!state.currentQuiz) return { ok: false, message: "Aucun quiz" };
    const opts = (options || []).map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return { ok: false, message: "Question requise" };
    if (opts.length < 3 || opts.length > 5) return { ok: false, message: "3 à 5 réponses requises" };
    if (correctIndex < 0 || correctIndex >= opts.length) return { ok: false, message: "Index de bonne réponse invalide" };
    setState((s) => ({
      ...s,
      currentQuiz: s.currentQuiz ? { ...s.currentQuiz, question: question.trim(), options: opts, correctIndex } : null,
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz-qa", details: { question: question.trim(), options: opts, correctIndex } }],
    }));
    return { ok: true, message: "Question & réponses enregistrées" };
  },

  deleteCurrentQuiz(status: "archived" | "completed" | "canceled" = "archived") {
    if (!state.currentQuiz) return { ok: false, message: "Aucun quiz" };
    const q = state.currentQuiz;
    setState((s) => ({
      ...s,
      quizzes: [
        ...(s.quizzes || []),
        {
          id: q.id,
          title: q.title,
          createdAt: Date.now(),
          status,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
        },
      ],
      currentQuiz: null,
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz-delete", details: { id: q.id, status } }],
    }));
    return { ok: true, message: "Quiz archivé" };
  },

  // Admin rachat des listings (burn le ticket du vendeur, paiement depuis buyback pool)
  adminBuyListingAndBurn(id: string): { ok: boolean; message: string } {
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) return { ok: false, message: "Listing introuvable" };
    if (state.pools.buyback < listing.priceEth) return { ok: false, message: "Buyback Pool insuffisante" };
    setState((s) => {
      const rest = s.listings.filter((l) => l.id !== id);
      const newTickets = { ...s.tickets } as Record<Address, Ticket>;
      // burn seller ticket
      delete newTickets[listing.owner];
      return {
        ...s,
        listings: rest,
        tickets: newTickets,
        pools: { ...s.pools, buyback: s.pools.buyback - listing.priceEth },
        ledger: [...s.ledger, { ts: Date.now(), type: "admin-buy-burn", details: { id, owner: listing.owner, price: listing.priceEth } }],
      };
    });
    return { ok: true, message: "Listing racheté (mock)" };
  },

  // Ajuster une pool (ajout ou retrait direct, simulation in/out)
  adjustPool(pool: "sale" | "buyback" | "prize", delta: number): { ok: boolean; message: string } {
    if (!isFinite(delta) || delta === 0) return { ok: false, message: "Montant invalide" };
    if (delta < 0 && state.pools[pool] < Math.abs(delta)) return { ok: false, message: "Solde insuffisant" };
    setState((s) => ({
      ...s,
      pools: { ...s.pools, [pool]: +(s.pools[pool] + delta).toFixed(6) },
      ledger: [...s.ledger, { ts: Date.now(), type: "adjust-pool", details: { pool, delta } }],
    }));
    return { ok: true, message: "Pool ajustée (mock)" };
  },


  listTicket(owner?: Address, priceEth?: number): { ok: boolean; message: string } {
    if (!owner) return { ok: false, message: "Wallet non connecté" };
    if (!state.tickets[owner]) return { ok: false, message: "Aucun ticket à lister" };
    if (!priceEth || priceEth <= 0) return { ok: false, message: "Prix invalide" };
    const id = `${Date.now()}`;
    setState((s) => ({ ...s, listings: [...s.listings, { id, priceEth, owner }], ledger: [...s.ledger, { ts: Date.now(), type: "list", details: { owner, id, priceEth } }] }));
    return { ok: true, message: "Listing créé (mock)" };
  },

  buyListing(buyer?: Address, id?: string): { ok: boolean; message: string } {
    if (!buyer) return { ok: false, message: "Wallet non connecté" };
    const listing = state.listings.find((l) => l.id === id);
    if (!listing) return { ok: false, message: "Listing introuvable" };
    if (state.tickets[buyer]) return { ok: false, message: "Déjà 1 ticket par wallet" };
    // 10% commission -> Pool Vente
    setState((s) => {
      const rest = s.listings.filter((l) => l.id !== id);
      const commission = listing.priceEth * 0.1;
      // transférer le ticket
      const prevTicket = s.tickets[listing.owner];
      const newTickets = { ...s.tickets } as Record<Address, Ticket>;
      if (prevTicket) delete newTickets[listing.owner];
      newTickets[buyer] = { owner: buyer, eligibleThisWeek: false };
      return {
        ...s,
        listings: rest,
        tickets: newTickets,
        pools: { ...s.pools, sale: s.pools.sale + commission },
        ledger: [...s.ledger, { ts: Date.now(), type: "buy", details: { buyer, id, priceEth: listing.priceEth, commission } }],
      };
    });
    return { ok: true, message: "Achat effectué (mock)" };
  },

  sellBack(owner?: Address): { ok: boolean; message: string } {
    if (!owner) return { ok: false, message: "Wallet non connecté" };
    if (!state.tickets[owner]) return { ok: false, message: "Aucun ticket à revendre" };
    const payout = TICKET_PRICE * 0.9;
    if (state.pools.buyback < payout) return { ok: false, message: "Buyback Pool insuffisante" };
    setState((s) => {
      const newTickets = { ...s.tickets } as Record<Address, Ticket>;
      delete newTickets[owner];
      return {
        ...s,
        tickets: newTickets,
        pools: { ...s.pools, buyback: s.pools.buyback - payout },
        ledger: [...s.ledger, { ts: Date.now(), type: "sellback", details: { owner, payout } }],
      };
    });
    return { ok: true, message: "Rachat effectué (mock)" };
  },

  submitQuiz(owner?: Address, correct?: boolean): { ok: boolean; message: string } {
    if (!owner) return { ok: false, message: "Wallet non connecté" };
    const t = state.tickets[owner];
    if (!t) return { ok: false, message: "Aucun ticket" };
    if (!state.currentQuiz || !state.currentQuiz.active) return { ok: false, message: "Quiz inactif" };
    setState((s) => ({
      ...s,
      tickets: { ...s.tickets, [owner]: { ...t, eligibleThisWeek: !!correct } },
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz", details: { owner, correct: !!correct } }],
    }));
    return { ok: true, message: correct ? "Éligible au tirage" : "Réponse incorrecte" };
  },

  submitQuizAnswer(owner?: Address, answerIndex?: number): { ok: boolean; message: string } {
    if (!owner) return { ok: false, message: "Wallet non connecté" };
    const t = state.tickets[owner];
    if (!t) return { ok: false, message: "Aucun ticket" };
    if (!state.currentQuiz || !state.currentQuiz.active) return { ok: false, message: "Quiz inactif" };
    const cq = state.currentQuiz;
    if (!Number.isInteger(answerIndex)) return { ok: false, message: "Réponse invalide" };
    const correct = typeof cq.correctIndex === "number" && Array.isArray(cq.options)
      ? answerIndex === cq.correctIndex
      : false;
    setState((s) => ({
      ...s,
      tickets: { ...s.tickets, [owner]: { ...t, eligibleThisWeek: !!correct } },
      ledger: [...s.ledger, { ts: Date.now(), type: "quiz", details: { owner, correct, answerIndex } }],
    }));
    return { ok: true, message: correct ? "Éligible au tirage" : "Réponse incorrecte" };
  },

  drawAndDistribute(prizeEth?: number): { ok: boolean; message: string } {
    const amount = prizeEth && prizeEth > 0 ? prizeEth : state.pools.prize;
    const eligible = Object.values(state.tickets).filter((t) => t.eligibleThisWeek);
    if (eligible.length === 0) return { ok: false, message: "Aucun ticket éligible" };
    if (state.pools.prize < amount) return { ok: false, message: "Prize Pool insuffisante" };
    const winner = eligible[Math.floor(Math.random() * eligible.length)].owner;
    setState((s) => ({
      ...s,
      winners: [...s.winners, { week: s.week, winner, prizeEth: amount }],
      pools: { ...s.pools, prize: s.pools.prize - amount },
      week: s.week + 1,
      // reset eligibility each week
      tickets: Object.fromEntries(
        Object.entries(s.tickets).map(([addr, t]) => [addr as Address, { ...t, eligibleThisWeek: false }])
      ),
      ledger: [...s.ledger, { ts: Date.now(), type: "draw", details: { week: s.week, winner, amount } }],
    }));
    return { ok: true, message: "Tirage effectué (mock)" };
  },

  move(from: "sale" | "buyback" | "prize", to: "sale" | "buyback" | "prize", amount: number) {
    if (from === to) return { ok: false, message: "Même pool" };
    if (amount <= 0) return { ok: false, message: "Montant invalide" };
    if (state.pools[from] < amount) return { ok: false, message: "Solde insuffisant" };
    setState((s) => ({
      ...s,
      pools: { ...s.pools, [from]: s.pools[from] - amount, [to]: s.pools[to] + amount },
      ledger: [...s.ledger, { ts: Date.now(), type: "move", details: { from, to, amount } }],
    }));
    return { ok: true, message: "Mouvement effectué (mock)" };
  },

  autoValidateAdminTickets(enable: boolean) {
    if (!enable) return { ok: true, message: "Désactivé" };
    // marque les tickets des admins comme éligibles
    setState((s) => {
      const updated = { ...s.tickets } as Record<Address, Ticket>;
      for (const addr of adminWallets) {
        if (updated[addr]) updated[addr] = { ...updated[addr], eligibleThisWeek: true };
      }
      return { ...s, tickets: updated, ledger: [...s.ledger, { ts: Date.now(), type: "auto-validate", details: { enabled: true } }] };
    });
    return { ok: true, message: "Validation auto activée (mock)" };
  },
};

// React hook to select store state
export function useMockStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState())
  );
}
