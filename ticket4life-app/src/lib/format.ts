export function formatEth(wei: bigint | string | number, decimals = 6): string {
  try {
    let v: number;
    if (typeof wei === "bigint") v = Number(wei) / 1e18;
    else if (typeof wei === "string") v = Number(wei) / 1e18;
    else v = wei / 1e18;
    if (!isFinite(v)) return "-";
    const factor = Math.pow(10, decimals);
    return (Math.round(v * factor) / factor).toFixed(decimals);
  } catch {
    return "-";
  }
}

export function shortAddr(addr?: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
