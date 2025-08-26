"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, ABI } from "@/config/contracts";

// Flat theme palette (aligned with Home/Quiz/FAQ)
const COLORS = {
  PANEL: "#FAF0E3",
  BORDER: "#E6D8C6",
  TEXT: "#111111",
  SUBTEXT: "#6B6B6B",
  CTA: "#27E7C5",
} as const;

function formatDuration(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return days > 0
    ? `${days}j ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getNextSunday20Local(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun
  const daysUntilSunday = (7 - day) % 7; // 0 if today is Sunday
  const target = new Date(d);
  target.setHours(20, 0, 0, 0);
  if (daysUntilSunday === 0 && d <= target) {
    // today Sunday before 20:00
    return target;
  }
  target.setDate(d.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  return target;
}

type QuizWidgetProps = { variant?: "large" | "compact" };

export default function QuizWidget({ variant = "large" }: QuizWidgetProps) {
  const { address, isConnected } = useAccount();

  const { data: eligible } = useReadContract({
    address: CONTRACTS.quiz as `0x${string}`,
    abi: ABI.quiz as any,
    functionName: "isEligible",
    args: [address as `0x${string}`],
    query: { enabled: Boolean(CONTRACTS.quiz && address) } as any,
  } as any);

  const [now, setNow] = useState<Date>(new Date());
  const target = useMemo(() => getNextSunday20Local(now), [now]);
  const msLeft = Math.max(0, target.getTime() - now.getTime());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const eligLabel = !isConnected
    ? "Connecte-toi"
    : eligible === undefined
    ? "Calcul…"
    : eligible
    ? "Oui"
    : "Non";

  if (variant === "compact") {
    return (
      <>
        <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Quiz de la semaine</div>
        <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>Compte à rebours</div>
        <p className="text-sm mt-1" style={{ color: COLORS.SUBTEXT }}>Prochaine échéance: dimanche 20:00</p>
        <div className="mt-1 text-2xl font-mono" aria-live="polite" aria-atomic="true" style={{ color: COLORS.CTA }}>
          {formatDuration(msLeft)}
        </div>
        <div className="mt-2 text-sm">
          <span style={{ color: COLORS.SUBTEXT }}>Éligible au tirage: </span>
          <span className="font-semibold" style={{ color: COLORS.CTA }}>{eligLabel}</span>
        </div>
      </>
    );
  }

  return (
    <section className="mt-5">
      <div
        className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}` }}
      >
        <div>
          <div className="text-xs font-bold" style={{ color: COLORS.TEXT }}>Quiz de la semaine</div>
          <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>Compte à rebours</div>
          <p className="text-sm mt-1" style={{ color: COLORS.SUBTEXT }}>Prochaine échéance: dimanche 20:00</p>
          <div className="mt-1 text-2xl font-mono" aria-live="polite" aria-atomic="true" style={{ color: COLORS.CTA }}>
            {formatDuration(msLeft)}
          </div>
          <div className="mt-2 text-sm">
            <span style={{ color: COLORS.SUBTEXT }}>Éligible au tirage: </span>
            <span className="font-semibold" style={{ color: COLORS.CTA }}>{eligLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
