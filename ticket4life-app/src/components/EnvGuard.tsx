"use client";

import { useAccount, useChainId, useSwitchChain, useReadContract } from "wagmi";
import { CONTRACTS, ABI } from "@/config/contracts";
import { Button } from "@/components/ui";

// Vérifie via les valeurs résolues dans CONTRACTS (plus fiable côté client que process.env[k])
const REQUIRED = [
  { env: "NEXT_PUBLIC_TICKET_ADDRESS", value: CONTRACTS.ticket },
  { env: "NEXT_PUBLIC_MARKETPLACE_ADDRESS", value: CONTRACTS.marketplace },
  { env: "NEXT_PUBLIC_MARKETPLACEV2_ADDRESS", value: CONTRACTS.marketplaceV2 },
  { env: "NEXT_PUBLIC_BUYBACK_ADDRESS", value: CONTRACTS.buyback },
  { env: "NEXT_PUBLIC_TREASURY_ADDRESS", value: CONTRACTS.treasury },
  // Distribution / Treasury / Quiz / Registry peuvent être optionnels selon déploiement
  // Ajoutez-les ici si vous souhaitez forcer la vérification
];

const expectedChainId = CONTRACTS.chainId || 84532;

export function EnvGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const missing = REQUIRED.filter((x) => !x.value).map((x) => x.env);
  const wrongNetwork = isConnected && chainId !== expectedChainId;

  // Lire le prix de mint on-chain et alerter si != 0.002 ETH
  const { data: mintPrice } = useReadContract({
    address: CONTRACTS.ticket as `0x${string}`,
    abi: ABI.ticket as any,
    functionName: "MINT_PRICE",
    // Activer uniquement si l'adresse du ticket est configurée
    query: { enabled: Boolean(CONTRACTS.ticket) } as any,
  } as any);
  const EXPECTED_PRICE = 2000000000000000n; // 0.002 ETH en wei
  const badPrice = Boolean(CONTRACTS.ticket && typeof mintPrice === "bigint" && mintPrice !== EXPECTED_PRICE);

  if (missing.length === 0 && !wrongNetwork && !badPrice) return null;

  return (
    <div className="mb-4 p-3 border rounded bg-yellow-50 border-yellow-200 text-yellow-800 text-sm">
      {missing.length > 0 && (
        <div className="mb-1">Variables manquantes: {missing.join(", ")}. Merci de compléter le fichier .env.local.</div>
      )}
      {wrongNetwork && (
        <div>
          Réseau incorrect détecté (chainId {chainId}). Merci de passer sur le réseau attendu (chainId {expectedChainId}).
          <div className="mt-2 flex items-center gap-2">
            <Button
              onClick={() => switchChain?.({ chainId: expectedChainId })}
              disabled={isSwitching}
              aria-busy={isSwitching}
              aria-disabled={isSwitching}
            >
              {isSwitching ? "Changement du réseau..." : "Changer de réseau"}
            </Button>
            {switchError && (
              <span role="status" aria-live="polite" className="text-red-700">
                Échec du changement: {"message" in switchError ? (switchError as any).message : String(switchError)}
              </span>
            )}
          </div>
        </div>
      )}
      {badPrice && (
        <div className="mt-2">
          Prix de mint inattendu sur le contrat Ticket.
          <div>
            Attendu: 0.002 ETH — Actuel: {typeof mintPrice === "bigint" ? (Number(mintPrice) / 1e18).toFixed(6) : "?"} ETH
          </div>
          <div className="text-[12px] mt-1">
            Merci de vérifier que l'adresse `NEXT_PUBLIC_TICKET_ADDRESS` pointe vers le bon contrat (prix de mint cohérent) et d'éviter plusieurs contrats.
          </div>
        </div>
      )}
    </div>
  );
}

