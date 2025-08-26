import { usePublicClient } from "wagmi";
import { useToast } from "../lib/toast";
import type { Hash } from "viem";

// Helper hook to wrap a write action with a standardized pending toast
// Usage: await withPendingToast('Action en cours', async () => writeContractAsync(...))
export function usePendingTxToast() {
  const publicClient = usePublicClient();
  const { push, remove } = useToast();

  async function withPendingToast<T>(title: string, action: () => Promise<Hash>): Promise<T | undefined> {
    let pendingId: string | number | undefined;
    try {
      pendingId = push({ variant: "pending", title, description: "Signature et inclusion…" });
      const tx = await action();
      await publicClient?.waitForTransactionReceipt({ hash: tx });
      if (pendingId !== undefined) remove(pendingId as any);
      return undefined as any;
    } catch (e: any) {
      if (pendingId !== undefined) remove(pendingId as any);
      push({ description: e?.shortMessage || e?.message || "Transaction échouée", variant: "error" });
      throw e;
    }
  }

  return { withPendingToast };
}
