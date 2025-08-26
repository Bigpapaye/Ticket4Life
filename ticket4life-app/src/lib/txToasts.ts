import { usePublicClient } from "wagmi";
import type { Hash } from "viem";
import { useToast } from "./toast";
import { txUrl } from "./explorer";

// Helper hook to wrap a write action with standardized toasts
// Usage: await withTxToasts({ pending: 'Achat en cours', success: 'Achat confirmé' }, async () => writeContractAsync(...))
export function useTxToasts() {
  const publicClient = usePublicClient();
  const { push, remove } = useToast();

  async function withTxToasts<T>(
    msgs: { pending: string; success?: string; error?: string },
    action: () => Promise<Hash>,
    opts?: { onSuccess?: () => void; explorerLink?: boolean }
  ): Promise<T | undefined> {
    let pendingId: string | number | undefined;
    try {
      pendingId = push({ variant: "pending", title: msgs.pending, description: "Signature et inclusion…" });
      const hash = await action();
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (pendingId !== undefined) remove(pendingId as any);
      const url = opts?.explorerLink !== false ? txUrl(hash) : undefined;
      const status = (receipt as any)?.status;
      const ok = status === "success" || status === 1 || status === true || status === undefined /* some L2s */ ? status !== "reverted" : false;
      if (!ok) {
        push({
          title: msgs.error || "Transaction échouée",
          description: url || "Échec (reverted)",
          variant: "error",
        });
        throw new Error("Transaction reverted");
      }
      push({
        title: msgs.success || "Transaction confirmée",
        description: url || "Transaction confirmée",
        variant: "success",
      });
      if (opts?.onSuccess) opts.onSuccess();
      return receipt as any;
    } catch (e: any) {
      if (pendingId !== undefined) remove(pendingId as any);
      const desc = e?.shortMessage || e?.message || msgs.error || "Transaction échouée";
      push({ description: desc, variant: "error" });
      throw e;
    }
  }

  return { withTxToasts };
}
