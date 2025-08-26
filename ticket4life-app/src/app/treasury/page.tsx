import { addrUrl } from "@/lib/explorer";
import { headers } from "next/headers";
import { Manrope } from "next/font/google";
import { BG_CREAM, BG_PANEL, BRAND_ORANGE, TEXT_PRIMARY, TEXT_SUBTLE, BORDER } from "@/styles/theme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

 type FundEntry = { name: string; wallet: `0x${string}`; usdc: string };
 type StoreShape = { updatedAt: number; updatedBy: `0x${string}` | null; entries: FundEntry[] };

async function fetchTreasury(): Promise<StoreShape> {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/api/treasury`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("bad");
    const data = await res.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    return { updatedAt: Number(data?.updatedAt || 0), updatedBy: (data?.updatedBy as any) || null, entries };
  } catch {
    return { updatedAt: 0, updatedBy: null, entries: [] };
  }
}

export default async function TreasuryPage() {
  const store = await fetchTreasury();
  const total = store.entries.reduce((s, e) => s + (Number(e.usdc) || 0), 0);

  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: BG_CREAM, minHeight: "100vh" }}>
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold uppercase tracking-wide" style={{ color: TEXT_PRIMARY }}>Gestion des fonds</h1>
        <p className="mt-1 text-sm" style={{ color: TEXT_SUBTLE }}>
          Transparence sur les fonds off-chain gérés (montants en USDC, entrés manuellement).
        </p>

        <div className="mt-4 border rounded-lg" style={{ backgroundColor: BG_PANEL, borderColor: BORDER }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderBottomColor: BORDER }}>
            <div className="text-sm" style={{ color: TEXT_SUBTLE }}>
              Dernière mise à jour: {store.updatedAt ? new Date(store.updatedAt).toLocaleString() : "—"}
            </div>
            <div className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>
              Total: {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
            </div>
          </div>
          <div>
            {store.entries.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: TEXT_SUBTLE }}>Aucune entrée pour le moment.</div>
            ) : (
              store.entries.map((e, idx) => (
                <div
                  key={`row-${idx}`}
                  className={`p-4 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center${idx > 0 ? ' border-t' : ''}`}
                  style={idx > 0 ? { borderTopColor: BORDER } : undefined}
                >
                  <div className="sm:col-span-5">
                    <div className="text-sm font-medium" style={{ color: TEXT_PRIMARY }}>{e.name || "(sans nom)"}</div>
                    <div className="text-xs" style={{ color: TEXT_SUBTLE }}>
                      <a
                        className="underline"
                        style={{ color: BRAND_ORANGE }}
                        href={addrUrl(String(e.wallet))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {String(e.wallet).slice(0,6)}…{String(e.wallet).slice(-4)}
                      </a>
                    </div>
                  </div>
                  <div className="sm:col-span-3 text-sm" style={{ color: TEXT_SUBTLE }}>USDC</div>
                  <div className="sm:col-span-4 text-right text-base font-semibold" style={{ color: TEXT_PRIMARY }}>
                    {(Number(e.usdc)||0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 text-xs" style={{ color: TEXT_SUBTLE }}>
          Données maintenues hors-chaîne et signées par un administrateur. Voir la page admin pour modifier.
        </div>
      </div>
    </div>
  );
}
