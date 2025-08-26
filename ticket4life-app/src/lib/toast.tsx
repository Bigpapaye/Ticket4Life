"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { BG_PANEL, BORDER, TEXT_PRIMARY, BRAND_ORANGE as ORANGE } from "@/styles/theme";

type Toast = { id: number; title?: string; description: string; variant?: "success" | "error" | "info" | "pending"; duration?: number };

type ToastContextValue = { push: (t: Omit<Toast, "id">) => number; remove: (id: number) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = idRef.current++;
    const toast: Toast = { id, ...t } as Toast;
    setToasts((prev) => [...prev, toast]);
    const duration = typeof t.duration === "number" ? t.duration : (t.variant === "error" ? 6000 : t.variant === "pending" ? 0 : 3500);
    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed top-3 right-3 z-50 space-y-2" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => {
        const icon = t.variant === "success" ? "✓" : t.variant === "error" ? "!" : t.variant === "pending" ? "…" : "i";
        // Brand styling: panel background, primary text, border uses brand for success and neutral border otherwise.
        const style: React.CSSProperties = {
          backgroundColor: BG_PANEL,
          borderColor: t.variant === "success" ? ORANGE : BORDER,
          color: TEXT_PRIMARY,
          boxShadow: t.variant === "success" ? `0 0 0 2px ${ORANGE} inset` : "none",
        };
        const isUrl = typeof t.description === "string" && /^https?:\/\//.test(t.description);
        return (
          <div
            key={t.id}
            className="min-w-[280px] max-w-sm rounded border p-3 shadow text-sm"
            role="status"
            aria-live="polite"
            style={style}
          >
            <div className="flex items-start gap-2">
              <div className="text-xs mt-0.5 select-none" aria-hidden>{icon}</div>
              <div className="flex-1">
                {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
                <div className="break-all leading-relaxed">
                  {isUrl ? (
                    <a href={t.description} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: TEXT_PRIMARY }}>
                      {t.description}
                    </a>
                  ) : (
                    t.description
                  )}
                </div>
              </div>
              <button
                className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                aria-label="Fermer la notification"
                onClick={() => {
                  const el = document.activeElement as HTMLElement | null;
                  try { el && el.blur(); } catch {}
                  onClose(t.id);
                }}
              >×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
