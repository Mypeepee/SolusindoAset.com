// src/app/api/regions/cities/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pastikan tidak ke-cache aneh oleh Next
export const revalidate = 0;

// ==============================
// Types
// ==============================
type GithubRegionItem = { id: string; nama: string };

type CityItem = {
  id: string;
  name: string;
  province: string;
};

// ==============================
// Simple in-memory cache (global)
// ==============================
declare global {
  // cache data
  // eslint-disable-next-line no-var
  var __ALL_KOTA_CACHE__:
    | {
        ts: number;
        data: CityItem[];
      }
    | undefined;

  // dedupe concurrent rebuilds
  // eslint-disable-next-line no-var
  var __ALL_KOTA_INFLIGHT__:
    | Promise<{
        ts: number;
        data: CityItem[];
      }>
    | undefined;
}

const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 jam
const BASE = "https://ibnux.github.io/data-indonesia";

// ==============================
// Helpers
// ==============================
function jsonOk(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        // optional: reduce blocked by GH
        "User-Agent": "nextjs-region-proxy",
      },
    });
    if (!res.ok) throw new Error(`Fetch gagal (${res.status}) ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Concurrency limiter (promise pool)
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  const workers = new Array(Math.max(1, limit)).fill(null).map(async () => {
    while (idx < items.length) {
      const my = idx++;
      const r = await fn(items[my], my);
      results[my] = r;
    }
  });

  await Promise.all(workers);
  return results;
}

function clean(s: any) {
  return String(s ?? "").trim();
}

function uniqById(arr: CityItem[]) {
  const m = new Map<string, CityItem>();
  for (const it of arr) {
    if (!it?.id) continue;
    if (!m.has(it.id)) m.set(it.id, it);
  }
  return Array.from(m.values());
}

function sortIdAlpha(arr: CityItem[]) {
  return arr.sort((a, b) => {
    const an = (a.name || "").toLocaleLowerCase("id-ID");
    const bn = (b.name || "").toLocaleLowerCase("id-ID");
    if (an !== bn) return an.localeCompare(bn, "id-ID");
    // tie breaker: province then id
    const ap = (a.province || "").toLocaleLowerCase("id-ID");
    const bp = (b.province || "").toLocaleLowerCase("id-ID");
    if (ap !== bp) return ap.localeCompare(bp, "id-ID");
    return String(a.id).localeCompare(String(b.id));
  });
}

// ==============================
// Builder (fetch provinsi + all kabupaten)
// ==============================
async function buildAllCities(): Promise<{ ts: number; data: CityItem[] }> {
  const now = Date.now();

  const provs = await fetchJson<GithubRegionItem[]>(`${BASE}/propinsi.json`);

  // fetch kabupaten per provinsi (limit concurrency biar gak “banjir”)
  const concurrency = 8;

  const buckets = await mapLimit(provs, concurrency, async (p) => {
    const provId = clean(p.id);
    const provName = clean(p.nama);
    if (!provId || !provName) return [] as CityItem[];

    try {
      const kabList = await fetchJson<GithubRegionItem[]>(
        `${BASE}/kabupaten/${provId}.json`
      );

      return kabList
        .map((kab) => ({
          id: clean(kab.id),
          name: clean(kab.nama),
          province: provName,
        }))
        .filter((x) => x.id && x.name);
    } catch {
      // kalau satu provinsi gagal, jangan matiin semuanya
      return [] as CityItem[];
    }
  });

  const flat = uniqById(buckets.flat());
  sortIdAlpha(flat);

  return { ts: now, data: flat };
}

// ==============================
// Route
// ==============================
export async function GET() {
  try {
    const now = Date.now();

    // ✅ serve from cache if valid
    if (global.__ALL_KOTA_CACHE__ && now - global.__ALL_KOTA_CACHE__.ts < CACHE_TTL) {
      return jsonOk({
        ok: true,
        cached: true,
        ttl_ms: CACHE_TTL,
        age_ms: now - global.__ALL_KOTA_CACHE__.ts,
        count: global.__ALL_KOTA_CACHE__.data.length,
        cities: global.__ALL_KOTA_CACHE__.data,
      });
    }

    // ✅ dedupe concurrent rebuilds
    if (!global.__ALL_KOTA_INFLIGHT__) {
      global.__ALL_KOTA_INFLIGHT__ = buildAllCities().finally(() => {
        // clear inflight after finish
        global.__ALL_KOTA_INFLIGHT__ = undefined;
      });
    }

    const built = await global.__ALL_KOTA_INFLIGHT__;

    global.__ALL_KOTA_CACHE__ = built;

    return jsonOk({
      ok: true,
      cached: false,
      ttl_ms: CACHE_TTL,
      count: built.data.length,
      cities: built.data,
    });
  } catch (err: any) {
    return jsonOk(
      {
        ok: false,
        message: err?.message || "Server error.",
      },
      500
    );
  }
}