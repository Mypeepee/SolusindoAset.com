import { NextResponse } from "next/server";

// cache sederhana
declare global {
  var __ALL_KOTA_CACHE__:
    | { ts: number; data: { id: string; name: string; province: string }[] }
    | undefined;
}

const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 jam

export async function GET(req: Request) {
  try {
    const now = Date.now();
    if (global.__ALL_KOTA_CACHE__ && now - global.__ALL_KOTA_CACHE__.ts < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        count: global.__ALL_KOTA_CACHE__.data.length,
        cities: global.__ALL_KOTA_CACHE__.data,
      });
    }

    const base = "https://ibnux.github.io/data-indonesia";
    const provRes = await fetch(`${base}/propinsi.json`, { cache: "no-store" });
    if (!provRes.ok) throw new Error("Gagal fetch provinsi");

    const provs = await provRes.json();

    const allKota: { id: string; name: string; province: string }[] = [];

    // paralel fetch per provinsi
    await Promise.all(
      provs.map(async (p: any) => {
        const kabRes = await fetch(`${base}/kabupaten/${p.id}.json`, { cache: "no-store" });
        if (!kabRes.ok) return;

        const listK = await kabRes.json();
        listK.forEach((kab: any) => {
          allKota.push({
            id: kab.id,
            name: kab.nama,
            province: p.nama,
          });
        });
      })
    );

    // sort alphab
    allKota.sort((a, b) => a.name.localeCompare(b.name, "id"));

    global.__ALL_KOTA_CACHE__ = { ts: now, data: allKota };

    return NextResponse.json({
      ok: true,
      count: allKota.length,
      cities: allKota,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      message: err?.message || "Server error.",
    });
  }
}
