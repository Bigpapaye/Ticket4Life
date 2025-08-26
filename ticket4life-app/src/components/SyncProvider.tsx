"use client";

import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";

type RefreshAPI = {
  refreshAll: () => void;
  onRefresh: (cb: () => void) => () => void; // subscribe, returns unsubscribe
  tick: number; // increments on refreshAll
};

const Ctx = createContext<RefreshAPI | null>(null);

export function useRefresh() {
  const v = useContext(Ctx);
  return (
    v || {
      refreshAll: () => {},
      onRefresh: () => () => {},
      tick: 0,
    }
  );
}

export function SyncProvider({ children }: { children?: React.ReactNode }) {
  const subs = useRef(new Set<() => void>());
  const [tick, setTick] = useState(0);

  const refreshAll = useCallback(() => {
    setTick((t) => t + 1);
    for (const cb of Array.from(subs.current)) {
      try {
        cb();
      } catch {}
    }
  }, []);

  const onRefresh = useCallback((cb: () => void) => {
    subs.current.add(cb);
    return () => subs.current.delete(cb);
  }, []);

  const api: RefreshAPI = useMemo(
    () => ({
      refreshAll,
      onRefresh,
      tick,
    }),
    [refreshAll, onRefresh, tick]
  );

  return <Ctx.Provider value={api}>{children ?? null}</Ctx.Provider>;
}
