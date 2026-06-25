import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy wilayah Indonesia (ibnux/data-indonesia) untuk dropdown bertingkat.
 *   ?level=provinsi
 *   ?level=kota&parentId={provId}
 *   ?level=kecamatan&parentId={kotaId}
 *   ?level=kelurahan&parentId={kecId}
 * Respons: { ok, items: [{ id, name }] }
 *
 * Cache in-memory sederhana per (level+parentId) — pola sama seperti
 * src/app/api/regions/cities/route.ts.
 */

type Level = "provinsi" | "kota" | "kecamatan" | "kelurahan";
type WilayahItem = { id: string; name: string };

declare global {
  // eslint-disable-next-line no-var
  var __WILAYAH_CACHE__: Map<string, { ts: number; data: WilayahItem[] }> | undefined;
}

const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 jam
const BASE = "https://ibnux.github.io/data-indonesia";

function cache() {
  if (!global.__WILAYAH_CACHE__) global.__WILAYAH_CACHE__ = new Map();
  return global.__WILAYAH_CACHE__;
}

function endpointFor(level: Level, parentId: string): string | null {
  switch (level) {
    case "provinsi":  return `${BASE}/propinsi.json`;
    case "kota":      return parentId ? `${BASE}/kabupaten/${parentId}.json` : null;
    case "kecamatan": return parentId ? `${BASE}/kecamatan/${parentId}.json` : null;
    case "kelurahan": return parentId ? `${BASE}/kelurahan/${parentId}.json` : null;
    default:          return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const level = (searchParams.get("level") || "") as Level;
    const parentId = (searchParams.get("parentId") || "").trim();

    if (!["provinsi", "kota", "kecamatan", "kelurahan"].includes(level)) {
      return NextResponse.json({ ok: false, message: "level tidak valid" }, { status: 400 });
    }
    if (level !== "provinsi" && !parentId) {
      return NextResponse.json({ ok: false, message: "parentId wajib" }, { status: 400 });
    }

    const key = `${level}:${parentId}`;
    const now = Date.now();
    const hit = cache().get(key);
    if (hit && now - hit.ts < CACHE_TTL) {
      return NextResponse.json({ ok: true, items: hit.data });
    }

    const url = endpointFor(level, parentId);
    if (!url) return NextResponse.json({ ok: false, message: "permintaan tidak valid" }, { status: 400 });

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Gagal fetch wilayah (${level})`);

    const raw: { id: string; nama: string }[] = await res.json();
    const items: WilayahItem[] = raw
      .map((r) => ({ id: String(r.id), name: r.nama }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    cache().set(key, { ts: now, data: items });

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || "Server error." }, { status: 500 });
  }
}
