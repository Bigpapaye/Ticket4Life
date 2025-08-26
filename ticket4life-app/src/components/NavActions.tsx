"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { isAdmin } from "@/config/adminWallets";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function NavActions() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showAdmin = mounted && isConnected && isAdmin(address ?? null);

  return (
    <div className="flex items-center gap-3">
      {showAdmin && (
        <Link
          href="/admin"
          className="text-sm text-gray-700 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black rounded"
          aria-label="Ouvrir le tableau de bord administrateur"
          title="Admin"
        >
          Admin
        </Link>
      )}
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const ready = mounted && authenticationStatus !== "loading";
          const connected = ready && account && chain;

          if (!ready) {
            return (
              <div aria-hidden className="h-9 w-[180px] rounded-full" />
            );
          }

          if (!connected) {
            return (
              <Button variant="brand" size="md" onClick={openConnectModal} aria-label="Connecter le portefeuille">
                Connecter le portefeuille
              </Button>
            );
          }

          if (chain?.unsupported) {
            return (
              <Button variant="brand" size="md" onClick={openChainModal} aria-label="Changer de réseau">
                Mauvais réseau
              </Button>
            );
          }

          return (
            <Button variant="brand" size="md" onClick={openAccountModal} aria-label="Ouvrir le portefeuille">
              {account?.displayName || "Portefeuille"}
            </Button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
