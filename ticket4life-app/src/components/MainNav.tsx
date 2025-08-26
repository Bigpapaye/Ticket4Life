"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Manrope } from "next/font/google";

const ORANGE = "#27E7C5"; // unified teal accent (CTA)
const TEXT = "#111111";
const SUBTEXT = "#6B6B6B";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

const links = [
  { href: "/", label: "Ticket4Life" },
  { href: "/marketplaceV2", label: "Marketplace" },
  { href: "/quiz", label: "Quiz" },
  { href: "/history", label: "History" },
  { href: "/faq", label: "FAQ" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className={`${manrope.className} flex items-center gap-4 text-[13px] uppercase tracking-wide`} style={{ color: TEXT }}>
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "relative px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40 rounded-sm" +
              (active ? " font-semibold" : "")
            }
            style={active ? { color: ORANGE } : { color: SUBTEXT }}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
            {active && (
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-0.5 rounded"
                style={{ backgroundColor: ORANGE }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

