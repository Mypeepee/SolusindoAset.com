import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { BuyerCriteria } from "./property-knowledge.ts";
import { SURABAYA_REGIONS, nearbyQueryParts } from "../../../backend/whatsapp/services/search_scope.js";
import { resolveRegion } from "../../../backend/whatsapp/services/region_directory.js";
import { uncertainLocation } from "../../../backend/whatsapp/services/search_recovery.js";
import { normalNama, kelasDariKata } from "../tempat/normalisasi.ts";

const fields = ["tipe_properti", "maksud", "jenis_transaksi", "lokasi_dicari", "loc_provinsi", "loc_kota", "loc_kecamatan", "loc_kelurahan", "budget_min", "budget_max", "luas_min", "luas_max", "tujuan_beli", "legalitas", "dekat_nilai", "dekat_radius", "alamat_teks", "catatan"] as const;
const numbers = new Set(["budget_min", "budget_max", "luas_min", "luas_max", "dekat_radius"]);
export function preferenceFingerprint(row: Record<string, any>) {
  return createHash("sha256").update(JSON.stringify(fields.map((field) => row[field] == null ? null : numbers.has(field) ? Number(row[field]) : row[field]))).digest("hex");
}
type SyncMeta = { version: number; fingerprint: string; rows: { id: string; fingerprint: string }[] };

export async function clientPreferenceRows(tx: Prisma.TransactionClient, criteria: BuyerCriteria) {
  const c = criteria;
  const region = resolveRegion(c.village && !uncertainLocation(c.village) ? `Kelurahan ${c.village}` : c.district || c.location, { city: c.city, province: c.province });
  const district = c.district || (!region?.clarification ? region?.district : null);
  const village = c.village && !uncertainLocation(c.village) ? c.village : null;
  const districts = c.region_group ? SURABAYA_REGIONS[c.region_group] : [district || null];
  const cities = c.cities?.length ? c.cities : [c.city || null];
  const areas = c.locations?.length ? c.locations : districts;
  const certificates = c.certificate_types?.length ? c.certificate_types : [null];
  const types = c.categories?.length ? c.categories : [c.category || null];
  const transactions = c.transaction_types?.length ? c.transaction_types : [c.transaction_type || null];
  let token: string | null = null;
  if (c.nearby) {
    const normalized = normalNama(c.nearby.query);
    const kelas = kelasDariKata(normalized);
    const groups = nearbyQueryParts(c.nearby.query);
    if (groups.length > 1 || groups[0].length > 1) token = `kueri:${c.nearby.query.toLowerCase()}`;
    else if (kelas) token = `kelas:${kelas}${c.city ? `@${c.city.toLowerCase().replace(/\s+/g, "-")}` : ""}`;
    else {
      const exact = await tx.tempat.findMany({ where: { OR: [{ nama_normal: normalized }, { alias: { some: { alias_normal: normalized } } }] }, select: { slug: true }, take: 2 });
      token = exact.length === 1 ? exact[0].slug : `kueri:${c.nearby.query.toLowerCase()}`;
    }
  }
  const informal = !district && !village && !c.region_group && c.location && c.city &&
    c.location.toLowerCase() !== c.city.toLowerCase() && !uncertainLocation(c.location) ? c.location : null;
  const rows: Prisma.PreferensiKlienCreateManyInput[] = [];
  for (const type of types) for (const transaction of transactions) for (const city of cities) for (const area of areas) for (const certificate of certificates) {
    const resolved = area ? resolveRegion(area, { city, province: c.province }) : null;
    const localDistrict = c.locations?.length ? (!resolved?.clarification ? resolved?.district || null : null) : area;
    const localVillage = c.locations?.length ? (!resolved?.clarification ? resolved?.village || null : null) : village;
    const address = c.locations?.length ? (!localDistrict && !localVillage ? area : null) : informal;
    rows.push({
    id_klien: "", tipe_properti: type, maksud: transaction === "SEWA" ? "SEWA" : "BELI", jenis_transaksi: transaction,
    lokasi_dicari: localVillage || area || city || c.location, loc_provinsi: c.province || (!region?.clarification ? region?.province : null),
    loc_kota: city, loc_kecamatan: localDistrict, loc_kelurahan: localVillage,
    budget_min: c.min_price ?? null, budget_max: c.max_price ?? null,
    luas_min: c.min_land_area_m2 ?? null, luas_max: c.max_land_area_m2 ?? null,
    tujuan_beli: c.purpose === "live" ? "ditempati" : c.purpose === "investment" ? "investasi" : null,
    legalitas: certificate, dekat_nilai: token, dekat_radius: c.nearby?.radius_m ?? null,
    alamat_teks: address, catatan: [transaction === "SEWA" && c.rental_period ? `Periode budget sewa: ${c.rental_period.toLowerCase()}` : null,
      c.special_requirements ? `Perlu verifikasi: ${c.special_requirements}` : null,
      c.route_landmarks?.length ? `Patokan rute: ${c.route_landmarks.join(", ")}` : null].filter(Boolean).join("; ") || null,
  });
  }
  return rows;
}

// Only untouched rows written by this integration may be replaced. Manual
// rows, changed rows and deliberately removed preferences belong to the Owner.
export async function syncClientPreferences(tx: Prisma.TransactionClient, clientId: string, criteria: BuyerCriteria, meta: unknown) {
  const rows = await clientPreferenceRows(tx, criteria);
  const fingerprint = createHash("sha256").update(JSON.stringify(rows.map(preferenceFingerprint))).digest("hex");
  const previous = meta as SyncMeta | null;
  if (previous?.version === 1 && previous.fingerprint === fingerprint) return;
  await tx.$queryRaw`SELECT id_preferensi FROM public.preferensi_klien WHERE id_klien=${clientId} FOR UPDATE`;
  const existing = await tx.preferensiKlien.findMany({ where: { id_klien: clientId } });
  const owned = existing.filter((row) => previous?.rows?.some((item) => item.id === String(row.id_preferensi) && item.fingerprint === preferenceFingerprint(row)));
  const linked: SyncMeta["rows"] = [];
  for (const data of rows) {
    const fp = preferenceFingerprint(data);
    const duplicate = existing.find((row) => preferenceFingerprint(row) === fp && !linked.some((item) => item.id === String(row.id_preferensi)));
    if (duplicate) {
      if (owned.includes(duplicate)) { linked.push({ id: String(duplicate.id_preferensi), fingerprint: fp }); owned.splice(owned.indexOf(duplicate), 1); }
      continue;
    }
    const old = owned.shift();
    const row = old ? await tx.preferensiKlien.update({ where: { id_preferensi: old.id_preferensi }, data: { ...data, id_klien: clientId, terakhir_dipindai: null, diperbarui_pada: new Date() } }) :
      await tx.preferensiKlien.create({ data: { ...data, id_klien: clientId } });
    linked.push({ id: String(row.id_preferensi), fingerprint: fp });
  }
  if (owned.length) await tx.preferensiKlien.deleteMany({ where: { id_klien: clientId, id_preferensi: { in: owned.map((row) => row.id_preferensi) } } });
  await tx.klien.update({ where: { id_klien: clientId }, data: { chatbot_preferensi_meta: { version: 1, fingerprint, rows: linked } } });
}
