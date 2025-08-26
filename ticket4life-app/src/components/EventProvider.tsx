"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { Address } from "viem";
import { ABI, CONTRACTS } from "@/config/contracts";
import { useRefresh } from "./SyncProvider";

export type EventPulse = {
  // increments each time we see any watched event
  pulse: number;
  // last event type name
  last?: string;
  // last block seen
  lastBlock?: bigint | null;
};

const Ctx = createContext<EventPulse | null>(null);

export function useEventPulse(): EventPulse {
  const v = useContext(Ctx);
  return v ?? { pulse: 0, last: undefined, lastBlock: null };
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const pc = usePublicClient();
  const { refreshAll } = useRefresh();
  const [pulse, setPulse] = useState(0);
  const [last, setLast] = useState<string | undefined>(undefined);
  const lastBlock = useRef<bigint | null>(null);

  useEffect(() => {
    if (!pc) return;
    const unsubs: Array<() => void> = [];

    function bump(type: string) {
      setPulse((p) => p + 1);
      setLast(type);
      // Update last block async
      pc?.getBlockNumber().then((bn) => (lastBlock.current = bn)).catch(() => {});
      // Trigger global refresh so pages re-fetch live data
      try { refreshAll(); } catch {}
    }

    // Marketplace events
    if (pc && CONTRACTS.marketplace) {
      const address = CONTRACTS.marketplace as Address;
      for (const name of ["Listed", "Cancelled", "Bought"]) {
        const u = pc.watchContractEvent({
          address,
          abi: ABI.marketplace as any,
          eventName: name as any,
          onLogs: () => bump(name),
        });
        unsubs.push(u);
      }
    }

    // Ticket Transfer events
    if (pc && CONTRACTS.ticket) {
      const u = pc.watchContractEvent({
        address: CONTRACTS.ticket as Address,
        abi: ABI.erc721 as any,
        eventName: "Transfer",
        onLogs: () => bump("Transfer"),
      });
      unsubs.push(u);
    }

    return () => {
      for (const u of unsubs) try { u(); } catch {}
    };
  }, [pc]);

  const value: EventPulse = useMemo(() => ({ pulse, last, lastBlock: lastBlock.current }), [pulse, last]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
