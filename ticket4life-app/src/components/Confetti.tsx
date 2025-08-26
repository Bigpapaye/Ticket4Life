"use client";

import React, { useEffect, useMemo } from "react";

type ConfettiProps = {
  show: boolean;
  durationMs?: number; // total overlay life
  onEnd?: () => void;
};

const COLORS = ["#27E7C5", "#FFD166", "#06D6A0", "#118AB2", "#EF476F", "#8338EC"];

export default function Confetti({ show, durationMs = 2500, onEnd }: ConfettiProps) {
  const pieces = useMemo(() =>
    Array.from({ length: 80 }).map((_, i) => ({
      left: Math.random() * 100, // vw%
      size: 6 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 300,
      rotate: Math.random() * 360,
      fall: durationMs - Math.random() * 600,
      borderRadius: Math.random() > 0.6 ? `${Math.floor(Math.random()*50)}%` : "2px",
    })),
  [durationMs]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onEnd?.(), durationMs + 200);
    return () => clearTimeout(t);
  }, [show, durationMs, onEnd]);

  if (!show) return null;
  return (
    <div aria-hidden className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      <style jsx>{`
        @keyframes t4l-fall {
          0% { transform: translate3d(0,-10%,0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate3d(0,110vh,0) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p, idx) => (
        <span
          key={idx}
          className="absolute"
          style={{
            top: -10,
            left: `${p.left}vw`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: p.borderRadius as any,
            animation: `t4l-fall ${p.fall}ms linear ${p.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
