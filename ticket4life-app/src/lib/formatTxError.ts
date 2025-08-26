export function formatTxError(err: unknown, fallback: string = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const anyErr = err as any;
  return anyErr?.shortMessage || anyErr?.message || fallback;
}
