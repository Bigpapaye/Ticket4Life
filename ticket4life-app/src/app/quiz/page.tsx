"use client";

import React, { useMemo, useState, useEffect, Suspense } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { CONTRACTS, ABI } from "@/config/contracts";
import { useToast } from "@/lib/toast";
import { Skeleton, Button } from "@/components/ui";
import { useTxToasts } from "@/lib/txToasts";
import { useRefresh } from "@/components/SyncProvider";
import { useSearchParams, useRouter } from "next/navigation";
import Confetti from "@/components/Confetti";
import { Manrope } from "next/font/google";
import { BG_CREAM, BG_PANEL, BG_PANEL_HOVER, BORDER, TEXT_PRIMARY, TEXT_SUBTLE, BRAND_ORANGE as ORANGE } from "@/styles/theme";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

function QuizContent() {
  const { address, isConnected } = useAccount();
  const { push } = useToast();
  const { writeContractAsync } = useWriteContract();
  const { withTxToasts } = useTxToasts();
  const { refreshAll } = useRefresh();
  const params = useSearchParams();
  const router = useRouter();

  const quizAddr = CONTRACTS.quiz;
  const ticketAddr = CONTRACTS.ticket;

  // Marqueur local pour refléter immédiatement l'état après envoi
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [mintedSuccess, setMintedSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [buying, setBuying] = useState(false);

  // Détecter le retour post-mint depuis la home
  useEffect(() => {
    const m = params?.get("minted");
    if (m === "1") {
      setMintedSuccess(true);
      setShowConfetti(true);
      // Nettoyer l'URL pour éviter de rejouer au refresh
      try { router.replace("/quiz"); } catch {}
    }
  }, [params, router]);

  // Après un mint réussi, force un rafraîchissement des lectures on-chain
  useEffect(() => {
    if (mintedSuccess) {
      try { refreshAll(); } catch {}
    }
  }, [mintedSuccess, refreshAll]);

  const { data: hasQuiz } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "hasQuiz",
    query: { enabled: Boolean(quizAddr) } as any,
  } as any);

  // Check ticket ownership
  const { data: balance } = useReadContract({
    address: ticketAddr as `0x${string}`,
    abi: ABI.erc721 as any,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(ticketAddr && address) } as any,
  } as any);
  const hasTicket = useMemo(() => {
    try { return (balance as any)?.valueOf ? (BigInt(balance as any) > BigInt(0)) : (Number(balance) > 0); } catch { return false; }
  }, [balance]);

  // Read mint price for CTA
  const { data: mintPrice } = useReadContract({
    address: ticketAddr as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "MINT_PRICE",
    query: { enabled: Boolean(ticketAddr) } as any,
  } as any);

  const { data: quizData } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "get",
    query: { enabled: Boolean(quizAddr && hasQuiz) } as any,
  } as any);

  const { data: submitted } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "hasSubmitted",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(quizAddr && address) } as any,
  } as any);

  // Source of truth eligibility according to the quiz smart contract
  const { data: eligible } = useReadContract({
    address: quizAddr as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "isEligible",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(quizAddr && address) } as any,
  } as any);

  // Considère immédiatement le ticket comme acquis après redirection post-mint
  const hasTicketEffective = useMemo(() => Boolean(eligible || hasTicket || mintedSuccess), [eligible, hasTicket, mintedSuccess]);

  const parsed = useMemo(() => {
    if (!quizData) return null as null | { title: string; question: string; options: string[]; active: boolean };
    const [title, question, options, active] = quizData as any;
    return { title, question, options, active } as { title: string; question: string; options: string[]; active: boolean };
  }, [quizData]);

  const [answer, setAnswer] = useState<number | null>(null);
  const already = Boolean(submitted) || justSubmitted;
  const canSubmit = Boolean(
    quizAddr && isConnected && parsed?.active && parsed?.options?.length && hasTicketEffective && !already && answer !== null
  );

  // Prize pool to display prize boxes like on home
  const { data: prizePool } = useReadContract({
    address: CONTRACTS.treasury as `0x${string}`,
    abi: ABI.treasury as any,
    functionName: "prizePool",
    query: { enabled: Boolean(CONTRACTS.treasury) } as any,
  } as any);
  const prize = useMemo(() => (typeof prizePool === "bigint" ? Number(prizePool) / 1e18 : 0), [prizePool]);

  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: BG_CREAM, minHeight: "100vh" }}>
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Confetti show={showConfetti} onEnd={() => setShowConfetti(false)} />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {canSubmit ? "Quiz prêt" : "Chargement ou conditions non remplies"}
        {submitting ? " — Soumission en cours" : justSubmitted ? " — Réponse envoyée avec succès" : ""}
        {buying ? " — Achat du ticket en cours" : ""}
      </div>
      {/* Hero section */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, border: `1px solid ${BORDER}` }}>
              Quiz hebdomadaire
            </div>
            <h1 className={`text-2xl md:text-3xl font-semibold tracking-tight mt-2`} style={{ color: TEXT_PRIMARY }}>
              Valide ton ticket en répondant à la question de la semaine!
            </h1>
            <p className="text-sm mt-1" style={{ color: TEXT_SUBTLE }}>70% / 20% / 10% pour les 3 meilleurs gagnants. Une seule participation par wallet.</p>
          </div>
        </div>
      </div>

      {mintedSuccess && (
        <div role="alert" className="mb-4 text-sm rounded p-3" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, border: `1px solid ${BORDER}` }}>
          Bravo ! Ton ticket a été minté avec succès. Tu peux maintenant participer au quiz de la semaine 🎉
        </div>
      )}

      <section className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg p-4" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
            <div className="text-xs font-bold" style={{ color: TEXT_PRIMARY }}>1er Prix — 70%</div>
            <div className="text-2xl font-semibold">{(prize * 0.7).toFixed(6)} ETH</div>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
            <div className="text-xs font-bold" style={{ color: TEXT_PRIMARY }}>2e Prix — 20%</div>
            <div className="text-2xl font-semibold">{(prize * 0.2).toFixed(6)} ETH</div>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
            <div className="text-xs font-bold" style={{ color: TEXT_PRIMARY }}>3e Prix — 10%</div>
            <div className="text-2xl font-semibold">{(prize * 0.1).toFixed(6)} ETH</div>
          </div>
        </div>
      </section>

      {!quizAddr ? (
        <div className="rounded-lg p-5" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
          <p className="text-sm rounded p-2" style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, border: `1px solid ${BORDER}` }}>
            Adresse du contrat de quiz manquante. Ajoute `NEXT_PUBLIC_QUIZ_ADDRESS` dans `.env.local` puis relance le serveur.
          </p>
        </div>
      ) : hasQuiz === undefined ? (
        <div className="rounded-lg p-5" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : !hasQuiz ? (
        <div className="rounded-lg p-5" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: TEXT_SUBTLE }}>Aucun quiz n'est en cours. Reviens plus tard !</p>
        </div>
      ) : !parsed?.active ? (
        <div className="rounded-lg p-5" style={{ backgroundColor: BG_PANEL, border: `1px solid ${BORDER}` }}>
          <p className="text-sm" style={{ color: TEXT_SUBTLE }}>Le quiz est actuellement inactif.</p>
        </div>
      ) : (
        <div className="rounded-lg p-5" style={{ backgroundColor: BG_PANEL, border: `1px solid ${already ? ORANGE : BORDER}` }}>
          {already && (
            <div
              className="mb-3 text-sm rounded p-3 mx-auto text-center"
              style={{
                backgroundColor: BG_PANEL,
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER}`,
                maxWidth: 560,
              }}
            >
              {justSubmitted
                ? "Merci d'avoir participé à ce quiz, nous te souhaitons bonne chance !"
                : "Merci d'avoir joué! rendez vous dimanche soir 20h pour les résultats."}
            </div>
          )}

          {!already && (
            <>
              <div className="text-lg font-semibold mb-3" style={{ color: TEXT_PRIMARY }}>{parsed?.question}</div>
              <div className="space-y-2">
                {parsed?.options?.map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer px-2 py-2 rounded border" style={{ border: `1px solid ${BORDER}`, backgroundColor: BG_PANEL }}>
                    <input
                      type="radio"
                      name="quiz-answer"
                      checked={answer === idx}
                      onChange={() => setAnswer(idx)}
                      style={{ accentColor: TEXT_PRIMARY }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                {hasTicketEffective ? (
                  <Button
                    className="font-semibold focus-visible:!ring-gray-900"
                    style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: TEXT_PRIMARY }}
                    disabled={!canSubmit || submitting}
                    aria-busy={submitting}
                    onClick={async () => {
                      try {
                        if (answer === null) return;
                        setSubmitting(true);
                        await withTxToasts(
                          { pending: "Soumission en cours", success: "Réponse envoyée" },
                          async () => await writeContractAsync({
                            address: quizAddr as `0x${string}`,
                            abi: ABI.quiz as any,
                            functionName: "submit",
                            args: [answer],
                          } as any),
                          { onSuccess: () => { setJustSubmitted(true); refreshAll(); } }
                        );
                      } catch (e: any) {
                        push({ description: e?.shortMessage || e?.message || "Échec de la soumission", variant: "error" });
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {submitting ? "Soumission…" : "Soumettre on-chain"}
                  </Button>
                ) : (
                  <Button
                    className="font-semibold focus-visible:!ring-gray-900"
                    style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: TEXT_PRIMARY }}
                    disabled={!isConnected || !ticketAddr || buying}
                    aria-busy={buying}
                    onClick={async () => {
                      try {
                        setBuying(true);
                        const price = (mintPrice as any) as bigint;
                        await withTxToasts(
                          { pending: "Achat du ticket", success: "Ticket acheté" },
                          async () => await writeContractAsync({
                            address: ticketAddr as `0x${string}`,
                            abi: ABI.ticket as any,
                            functionName: "mint",
                            value: price,
                          } as any),
                          { onSuccess: () => { setMintedSuccess(true); refreshAll(); } }
                        );
                      } catch (e: any) {
                        push({ description: e?.shortMessage || e?.message || "Échec de l'achat du ticket", variant: "error" });
                      } finally {
                        setBuying(false);
                      }
                    }}
                  >
                    {buying ? "Achat du ticket…" : `Acheter un ticket${typeof mintPrice === "bigint" ? ` (${Number(mintPrice)/1e18} ETH)` : ""}`}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="p-4"><span className="sr-only" aria-live="polite">Chargement…</span></div>}>
      <QuizContent />
    </Suspense>
  );
}
