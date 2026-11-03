import { getClientDiscountScope } from "@/lib/investor-cma-legacy.server";
import { withInvestorRead } from "@/lib/investor-read.server";
import { kunciDiskon, lolosDiskon, type PreferensiDiskon, type LokasiDiskon, type MetrikDiskon } from "@/lib/preferensiDiskon";

type Kriteria = PreferensiDiskon & LokasiDiskon & { maksud: "BELI" | "SEWA" };

/** Keep the qualifying values from the same snapshot used for matching. */
export async function siapkanBuktiDiskon(prefs: readonly Kriteria[]) {
  const unik = new Map(prefs.filter(p => p.diskon_jenis).map(p => [kunciDiskon(p), p]));
  const hasil = new Map<string, ReadonlyMap<string, MetrikDiskon>>();
  if (!unik.size) return hasil;
  const scopes = new Map<string, Awaited<ReturnType<typeof getClientDiscountScope>>>();
  for (const [key, pref] of unik) {
    const scopeKey = kunciDiskon({ ...pref, diskon_jenis: null, diskon_persen: null });
    let scope = scopes.get(scopeKey);
    if (!scope) {
      scope = await withInvestorRead(tx => getClientDiscountScope(tx, pref.maksud, pref));
      scopes.set(scopeKey, scope);
    }
    hasil.set(key, new Map(scope.filter(row => lolosDiskon(pref, row)).map(row => [row.id, {
      kelurahan: pref.diskon_jenis === "TURUN_LELANG" ? null : row.kelurahan,
      turunLelang: pref.diskon_jenis === "KELURAHAN" ? null : row.turunLelang,
    }])));
  }
  return hasil;
}

/** Existing scanners only need IDs; CRM also consumes the retained values. */
export async function siapkanDiskon(prefs: readonly Kriteria[]) {
  const bukti = await siapkanBuktiDiskon(prefs);
  return new Map([...bukti].map(([key, rows]) => [key, new Set(rows.keys()) as ReadonlySet<string>]));
}
