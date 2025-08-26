import { NextResponse } from 'next/server';
import { isAdmin } from '@/config/adminWallets';
import { isAddress, keccak256, toHex, verifyMessage, type Hex } from 'viem';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const DATA_FILE = path.join(process.cwd(), 'data', 'treasury.json');

type FundEntry = {
  name: string;
  wallet: `0x${string}`;
  usdc: string; // numeric string
};

type StoreShape = {
  updatedAt: number;
  updatedBy: `0x${string}` | null;
  entries: FundEntry[];
};

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.entries)) throw new Error('bad');
    return parsed as StoreShape;
  } catch {
    return { updatedAt: 0, updatedBy: null, entries: [] };
  }
}

async function writeStore(data: StoreShape) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEntries(entries: any[]): FundEntry[] {
  const out: FundEntry[] = [];
  for (const e of entries || []) {
    const name = String(e?.name ?? '').trim();
    const wallet = String(e?.wallet ?? '').trim() as `0x${string}`;
    const usdcRaw = String(e?.usdc ?? e?.amount ?? '').trim();
    if (!name || !wallet || !usdcRaw) continue;
    if (!isAddress(wallet)) continue;
    const num = Number(usdcRaw);
    if (!Number.isFinite(num) || num < 0) continue;
    out.push({ name, wallet, usdc: String(num) });
  }
  return out;
}

export async function GET() {
  const store = await readStore();
  return new NextResponse(JSON.stringify(store), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const address = String(body?.address || '').trim() as `0x${string}`;
    const signature = String(body?.signature || '').trim() as Hex;
    const ts = Number(body?.ts || 0);
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Adresse invalide' }, { status: 400 });
    }
    if (!isAdmin(address)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Timestamp invalide ou expiré' }, { status: 400 });
    }

    const normalized = normalizeEntries(entries);
    // Build digest of payload for signing
    const digest = keccak256(toHex(JSON.stringify({ ts, entries: normalized })));
    const message = `T4L_TREASURY:${digest}`;
    const ok = await verifyMessage({ address, message, signature });
    if (!ok) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    const toWrite: StoreShape = {
      updatedAt: Date.now(),
      updatedBy: address,
      entries: normalized,
    };
    await writeStore(toWrite);
    return NextResponse.json({ ok: true, ...toWrite }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
