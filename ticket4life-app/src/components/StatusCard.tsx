"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";

type Props = {
  isConnected: boolean;
  hasTicket: boolean;
  hasListingActive: boolean | null;
  mintPrice?: bigint;
  onConnect?: () => void;
  ORANGE?: string;
};

const FAUCET_URL = "https://www.alchemy.com/faucets/base-sepolia";

export default function StatusCard({ isConnected, hasTicket, hasListingActive, mintPrice, onConnect, ORANGE = "#27E7C5" }: Props) {
  const { address } = useAccount();
  const { data: bal } = useBalance({ address: address as `0x${string}` | undefined, query: { enabled: Boolean(address) } as any });

  // Flat theme palette (aligned with Home/Quiz/FAQ)
  const COLORS = {
    PANEL: "#FAF0E3",
    BORDER: "#E6D8C6",
    TEXT: "#111111",
    SUBTEXT: "#6B6B6B",
  } as const;

  const insufficientForMint = Boolean(
    isConnected && typeof mintPrice === "bigint" && bal?.value !== undefined && bal.value < mintPrice
  );

  const statusLabel = !isConnected
    ? "Non connecté"
    : hasTicket
    ? "Ticket détenu"
    : hasListingActive === true
    ? "Listing actif"
    : hasListingActive === null
    ? "Vérification du statut…"
    : "Pas de ticket";

  const nextAction = !isConnected
    ? { label: "Connecter mon wallet", onClick: onConnect }
    : hasTicket
    ? { label: "Participer au quiz", href: "/quiz", primary: true }
    : hasListingActive === true
    ? { label: "Gérer ma vente", href: "/marketplaceV2" }
    : { label: typeof mintPrice === "bigint" ? `Mintez votre ticket (${formatEther(mintPrice)} ETH)` : "Mintez votre ticket", href: undefined };

  return (
    <section className="mt-3">
      <div
        className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}`, color: COLORS.TEXT }}
      >
        <div>
          <div className="text-xs font-bold" style={{ color: ORANGE }}>Mon statut</div>
          <div className="text-lg font-semibold mt-1" style={{ color: COLORS.TEXT }}>{statusLabel}</div>
          <p className="text-sm mt-1" style={{ color: COLORS.SUBTEXT }}>
            {isConnected && bal?.value !== undefined ? `Solde: ${formatEther(bal.value)} ETH (Base Sepolia)` : "Réseau: Base Sepolia (test)"}
          </p>
          {(!isConnected || insufficientForMint) && (
            <p className="text-sm mt-1" style={{ color: COLORS.SUBTEXT }}>
              Il te faut un peu d'ETH test pour payer les frais. C’est gratuit.
              {" "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="underline" style={{ color: ORANGE }}>
                Faucet Base Sepolia
              </a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && nextAction.onClick ? (
            <Button
              className="text-base px-4 py-2 rounded-md font-semibold"
              style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
              onClick={nextAction.onClick}
            >
              {nextAction.label}
            </Button>
          ) : nextAction.href ? (
            <Link
              href={nextAction.href}
              className={`text-base px-4 py-2 rounded-md font-semibold ${nextAction.primary ? "" : ""}`}
              style={{ backgroundColor: ORANGE, border: `1px solid ${ORANGE}`, color: COLORS.TEXT }}
            >
              {nextAction.label}
            </Link>
          ) : (
            <span className="text-sm" style={{ color: COLORS.SUBTEXT }}>{nextAction.label}</span>
          )}
        </div>
      </div>
    </section>
  );
}
