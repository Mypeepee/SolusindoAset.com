import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { cariCocok, lolosSemuaGerbang, hargaEfektif, buangKembar, type KriteriaMatch } from "../klienMatch";
import { siapkanDekat, dekatUntuk } from "../klienDekat";
import { pesanRekomendasi } from "../klienPesan";
import { isBuyerCriteria, publicText } from "./property-knowledge";
import { preferenceFingerprint } from "./client-preferences";
import { RECOMMENDATION_BATCH_SIZE, SEARCH_CRITERIA_FIELDS } from "../../../backend/whatsapp/services/recommendation_policy.js";
import type { BuyerCriteria } from "./property-knowledge";
import { isFreshAuction } from "../../../backend/whatsapp/services/auction_freshness.js";

export const RECOMMENDATION_PAGE_SIZE = 50;
export const DAILY_CLIENT_PAGE_SIZE = 10;
export const NEW_PROPERTY_SELECT = {
  id_property: true, slug: true, judul: true, jenis_transaksi: true, kategori: true,
  status_tayang: true, bukan_properti: true, ada_bangunan: true, legalitas: true,
  kota: true, provinsi: true, kecamatan: true, kelurahan: true, alamat_lengkap: true,
  luas_tanah: true, luas_bangunan: true, harga: true, harga_promo: true,
  gambar: true, kamar_tidur: true, is_hot_deal: true, tanggal_dibuat: true,
  harga_efektif: true, nilai_limit_lelang: true, tanggal_lelang: true,
  tempatDekat: { select: { id_tempat: true, jarak_meter: true, presisi: true, tempat: { select: { kelas: true } } } },
} satisfies Prisma.ListingSelect;
type Stock = Prisma.ListingGetPayload<{ select: typeof NEW_PROPERTY_SELECT }>;
type Match = { client_id: string; property_id: string; preference_id: string; search_criteria: BuyerCriteria | null };
const id = (v: unknown) => typeof v === "string" && /^[1-9]\d{0,17}$/.test(v);
export function validRecommendationRequest(v: any): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v) || !/^AG\d{1,18}$/.test(v.agent_id)) return false;
  const fields: Record<string, string[]> = { initialize: [], scan: ["cursor"], daily: ["after_client"], prepare: ["client_id", "property_ids"], acknowledge: ["receipt"] };
  const allowed = Object.hasOwn(fields, v.action) ? fields[v.action] : null;
  if (!allowed || Object.keys(v).some(k => !["agent_id", "action", ...allowed].includes(k))) return false;
  return v.action === "initialize" || v.action === "scan" && typeof v.cursor === "string" && /^(?:0|[1-9]\d{0,17})$/.test(v.cursor) ||
    v.action === "daily" && typeof v.after_client === "string" && /^(?:|KL\d{1,18})$/.test(v.after_client) ||
    v.action === "prepare" && /^KL\d{1,18}$/.test(v.client_id) && Array.isArray(v.property_ids) && v.property_ids.length >= 1 && v.property_ids.length <= RECOMMENDATION_BATCH_SIZE && v.property_ids.every(id) && new Set(v.property_ids).size === v.property_ids.length ||
    v.action === "acknowledge" && typeof v.receipt === "string" && v.receipt.length <= 5000;
}
const clean = (value: unknown, fallback = "") => (publicText(value, 160) || fallback).replace(/[*_~`]/g, "").trim();
const normal = (v: string) => v.toLowerCase().replace(/^(?:kota|kabupaten|kab\.)\s+/, "").trim();
const eligiblePreference = (p: any) => !!(p.loc_kota || p.loc_kecamatan || p.loc_kelurahan || p.loc_provinsi || p.alamat_teks || p.dekat_nilai) && Number(p.budget_max) > 0;
const eligibleProperty = (l: Stock, now: number) => Number.isFinite(hargaEfektif(l)) && hargaEfektif(l) > 0 && hargaEfektif(l) <= 1e15 &&
  isFreshAuction(l, now);

// Extra constraints in chatbot snapshots must never disappear when an older
// CRM integration only synchronized a single city. Manually edited rows keep
// their own meaning; only untouched integration-owned rows use the snapshot.
function extraGate(p: any, l: Stock) {
  const meta = p.klien.chatbot_preferensi_meta;
  const owned = meta?.rows?.some((r: any) => r.id === String(p.id_preferensi) && r.fingerprint === preferenceFingerprint(p));
  if (!owned) return true;
  const c = p.klien.chatbot_kriteria;
  if (!isBuyerCriteria(c)) return false;
  // These cannot be verified by the listing's structured fields. Keep the
  // CRM's manual recommendation path available for an agent to check them.
  if (c.special_requirements || c.route_landmarks?.length || c.rental_period ||
    c.legal_requirements?.some(v => !/^(?:bukan\s+surat\s+ijo|shm|hgb|shm\/hgb)$/i.test(v))) return false;
  if (c.legal_requirements?.some(v => /^bukan\s+surat\s+ijo$/i.test(v)) && !["SHM", "HGB"].includes(l.legalitas || "")) return false;
  if (c.certificate_types?.length && (!l.legalitas || !c.certificate_types.includes(l.legalitas))) return false;
  if (c.cities?.length && !c.cities.some(v => normal(v) === normal(l.kota))) return false;
  if (c.locations?.length) {
    const text = [l.alamat_lengkap, l.kelurahan, l.kecamatan, l.kota, l.judul].filter(Boolean).join(" ").toLowerCase();
    if (!c.locations.some(v => new RegExp(`(?:^|[^\\p{L}\\p{N}])${v.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "u").test(text))) return false;
  }
  return true;
}

function preferenceSearch(p: any, l: Stock, nearby: ReturnType<typeof dekatUntuk>): BuyerCriteria | null {
  const owned = p.klien.chatbot_preferensi_meta?.rows?.some((r: any) => r.id === String(p.id_preferensi) && r.fingerprint === preferenceFingerprint(p));
  const raw = p.klien.chatbot_kriteria;
  if (owned && isBuyerCriteria(raw)) return Object.fromEntries(Object.entries(raw).filter(([key]) => SEARCH_CRITERIA_FIELDS.includes(key))) as BuyerCriteria;
  const city = p.loc_kota || l.kota;
  const c: BuyerCriteria = { location: p.alamat_teks || p.loc_kelurahan || p.loc_kecamatan || city,
    city, province: p.loc_provinsi || null, district: p.loc_kecamatan || null, village: p.loc_kelurahan || null,
    category: p.tipe_properti, transaction_type: p.jenis_transaksi || l.jenis_transaksi,
    max_price: Number(p.budget_max), ...(p.budget_min != null ? { min_price: Number(p.budget_min) } : {}),
    min_land_area_m2: p.luas_min == null ? null : Number(p.luas_min), max_land_area_m2: p.luas_max == null ? null : Number(p.luas_max),
    ...(p.legalitas ? { certificate_types: [p.legalitas] } : {}),
    ...(nearby ? { nearby: { query: nearby.label, ...(p.dekat_radius ? { radius_m: p.dekat_radius } : {}) } } : {}) };
  return isBuyerCriteria(c) ? c : null;
}

async function matches(db: PrismaClient, agentId: string, stock: Stock[], clientId?: string, now = Date.now()) {
  if (!stock.length) return [] as Match[];
  const result = new Map<string, Match>();
  let after = BigInt(0);
  for (;;) {
    const prefs = await db.preferensiKlien.findMany({
      where: { id_preferensi: { gt: after }, ...(clientId ? { id_klien: clientId } : {}),
        klien: { id_agent: agentId, status: { notIn: ["closing", "lost_iseng"] }, nomor_whatsapp: { not: null } } },
      orderBy: { id_preferensi: "asc" }, take: 500,
      include: { klien: { select: { id_klien: true, id_properti_asal: true, chatbot_kriteria: true, chatbot_preferensi_meta: true } } },
    });
    if (!prefs.length) break;
    const clients = [...new Set(prefs.map(p => p.id_klien))];
    const [sent, dismissed, nearby] = await Promise.all([
      db.kirimanRekomendasi.findMany({ where: { id_klien: { in: clients }, id_property: { in: stock.map(l => l.id_property) } }, select: { id_klien: true, id_property: true } }),
      db.rekomendasiDisingkirkan.findMany({ where: { id_klien: { in: clients }, id_property: { in: stock.map(l => l.id_property) } }, select: { id_klien: true, id_property: true } }),
      siapkanDekat(prefs),
    ]);
    const excluded = new Set([...sent, ...dismissed].map(r => `${r.id_klien}:${r.id_property}`));
    for (const p of prefs) for (const l of stock) {
      const key = `${p.id_klien}:${l.id_property}`;
      if (excluded.has(key) || p.klien.id_properti_asal === l.id_property || result.has(key) ||
        !eligibleProperty(l, now)) continue;
      const k: KriteriaMatch = { ...p, dekat: dekatUntuk(p, nearby) };
      // Never broadcast without a saved area and a positive spending ceiling.
      if (!eligiblePreference(p)) continue;
      if (!lolosSemuaGerbang(l, k, { now }) || !extraGate(p, l)) continue;
      result.set(key, { client_id: p.id_klien, property_id: String(l.id_property), preference_id: String(p.id_preferensi), search_criteria: preferenceSearch(p, l, k.dekat) });
    }
    after = prefs[prefs.length - 1].id_preferensi;
    if (prefs.length < 500) break;
  }
  return [...result.values()];
}

// The morning pass searches existing stock, so a newly saved preference does
// not depend on a future listing insert. Client pagination bounds each call;
// the worker commits its cursor and candidates together before continuing.
async function dailyMatches(db: PrismaClient, agentId: string, afterClient: string, now: number) {
  const clients = await db.klien.findMany({ where: { id_agent: agentId, id_klien: { gt: afterClient },
    status: { notIn: ["closing", "lost_iseng"] }, nomor_whatsapp: { not: null }, preferensi: { some: {} } },
    orderBy: { id_klien: "asc" }, take: DAILY_CLIENT_PAGE_SIZE,
    select: { id_klien: true, id_properti_asal: true, chatbot_kriteria: true, chatbot_preferensi_meta: true } });
  const ids = clients.map(c => c.id_klien);
  if (!ids.length) return { after_client: afterClient, more: false, candidates: [], checked: 0, matched: 0 };
  const [prefs, sent, dismissed] = await Promise.all([
    db.preferensiKlien.findMany({ where: { id_klien: { in: ids } }, orderBy: { id_preferensi: "asc" } }),
    db.kirimanRekomendasi.findMany({ where: { id_klien: { in: ids } }, select: { id_klien: true, id_property: true } }),
    db.rekomendasiDisingkirkan.findMany({ where: { id_klien: { in: ids } }, select: { id_klien: true, id_property: true } }),
  ]);
  const nearby = await siapkanDekat(prefs), candidates: { client_id: string; property_id: string }[] = [];
  let matched = 0;
  for (const client of clients) {
    const excluded = [...sent, ...dismissed].filter(r => r.id_klien === client.id_klien).map(r => r.id_property);
    if (client.id_properti_asal) excluded.push(client.id_properti_asal);
    const selected = new Map<string, Stock>();
    for (const raw of prefs.filter(p => p.id_klien === client.id_klien)) {
      if (!eligiblePreference(raw)) continue;
      const p = { ...raw, klien: client }, k = { ...raw, dekat: dekatUntuk(raw, nearby) };
      const stock = await cariCocok<Stock>(db, k, { select: NEW_PROPERTY_SELECT, kecuali: excluded, maks: 200, now });
      for (const l of stock) {
        if (excluded.some(id => id === l.id_property) || !eligibleProperty(l, now) || !lolosSemuaGerbang(l, k, { now }) || !extraGate(p, l)) continue;
        selected.set(String(l.id_property), l);
      }
      if (buangKembar([...selected.values()]).length >= RECOMMENDATION_BATCH_SIZE) break;
    }
    const properties = buangKembar([...selected.values()]).slice(0, RECOMMENDATION_BATCH_SIZE);
    if (properties.length) matched++;
    candidates.push(...properties.map(l => ({ client_id: client.id_klien, property_id: String(l.id_property) })));
  }
  return { after_client: clients.at(-1)!.id_klien, more: clients.length === DAILY_CLIENT_PAGE_SIZE, candidates, checked: clients.length, matched };
}

type Receipt = { agent_id: string; client_id: string; at: number; assets: { id: string; preference: string; price: number; status: "TERSEDIA" }[] };
function sign(value: Receipt, secret: string) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
function verify(value: string, secret: string, agentId: string, now: number): Receipt {
  const [payload, signature, extra] = value.split(".");
  const expected = createHmac("sha256", secret).update(payload || "").digest();
  const given = Buffer.from(signature || "", "base64url");
  if (extra || given.length !== expected.length || !timingSafeEqual(expected, given)) throw new TypeError("INVALID_RECEIPT");
  const data: Receipt = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.agent_id !== agentId || !/^KL\d+$/.test(data.client_id) || !Number.isSafeInteger(data.at) || data.at > now + 60000 || !Array.isArray(data.assets) || !data.assets.length || data.assets.length > RECOMMENDATION_BATCH_SIZE ||
    data.assets.some(a => !id(a.id) || !id(a.preference) || !(a.price > 0) || !Number.isSafeInteger(a.price) || a.status !== "TERSEDIA")) throw new TypeError("INVALID_RECEIPT");
  return data;
}

export async function newPropertyRecommendations(db: PrismaClient, input: any, secret: string, now = Date.now()) {
  if (!validRecommendationRequest(input)) throw new TypeError("INVALID_REQUEST");
  const agent = await db.agent.findUnique({ where: { id_agent: input.agent_id }, select: {
    status_keanggotaan: true, pengguna: { select: { status_akun: true, nama_lengkap: true } },
  } });
  if (!agent || agent.status_keanggotaan !== "AKTIF" || agent.pengguna.status_akun !== "AKTIF") return { unavailable: true };
  if (input.action === "initialize") {
    const latest = await db.listing.findFirst({ orderBy: { id_property: "desc" }, select: { id_property: true } });
    return { cursor: String(latest?.id_property || BigInt(0)) };
  }
  if (input.action === "daily") return dailyMatches(db, input.agent_id, input.after_client, now);
  if (input.action === "scan") {
    // Scan *all* IDs so unavailable/non-property inserts also advance the
    // cursor. The SQLite transaction commits matches and cursor together.
    const stock = await db.listing.findMany({ where: { id_property: { gt: BigInt(input.cursor) } }, orderBy: { id_property: "asc" }, take: RECOMMENDATION_PAGE_SIZE, select: NEW_PROPERTY_SELECT });
    return { cursor: String(stock.at(-1)?.id_property || input.cursor), more: stock.length === RECOMMENDATION_PAGE_SIZE,
      candidates: (await matches(db, input.agent_id, stock, undefined, now)).map(({ client_id, property_id, preference_id }) => ({ client_id, property_id, preference_id })) };
  }
  if (input.action === "prepare") {
    const client = await db.klien.findFirst({ where: { id_klien: input.client_id, id_agent: input.agent_id, status: { notIn: ["closing", "lost_iseng"] } }, select: { nama: true, nomor_whatsapp: true } });
    const phone = client?.nomor_whatsapp?.replace(/[^\d]/g, "").replace(/^0/, "62");
    if (!client || !phone || !/^[1-9]\d{6,14}$/.test(phone)) return { skipped: true };
    const stock = await db.listing.findMany({ where: { id_property: { in: input.property_ids.map((v: string) => BigInt(v)) } }, select: NEW_PROPERTY_SELECT });
    const found = await matches(db, input.agent_id, stock, input.client_id, now);
    const allValid = buangKembar(stock.filter(l => found.some(m => m.property_id === String(l.id_property))));
    const valid = allValid.filter(l => (l.jenis_transaksi === "SEWA") === (allValid[0]?.jenis_transaksi === "SEWA"));
    if (!valid.length) return { skipped: true };
    const aset = valid.map(l => ({ id_property: String(l.id_property), slug: /^[a-z0-9-]+$/i.test(l.slug) ? l.slug : "properti",
      judul: clean(l.judul, `Properti ${l.id_property}`).slice(0, 140), kategori: l.kategori, jenis_transaksi: l.jenis_transaksi,
      harga: Math.round(hargaEfektif(l)), tanggal_lelang: l.tanggal_lelang, kota: clean(l.kota).slice(0, 80), kecamatan: clean(l.kecamatan).slice(0, 80), luas_tanah: Number(l.luas_tanah) || null, luas_bangunan: Number(l.luas_bangunan) || null }));
    const text = pesanRekomendasi({ namaKlien: /^Kontak(?: WhatsApp)?(?:\s|$)/i.test(client.nama) ? "Bapak/Ibu" : clean(client.nama, "Bapak/Ibu"),
      namaAgent: clean(agent.pengguna.nama_lengkap), idAgent: input.agent_id, aset, maksud: aset[0].jenis_transaksi === "SEWA" ? "SEWA" : "BELI", otomatis: true, now });
    const receipt = sign({ agent_id: input.agent_id, client_id: input.client_id, at: now, assets: aset.map(l => ({ id: l.id_property,
      preference: found.find(m => m.property_id === l.id_property)!.preference_id, price: l.harga, status: "TERSEDIA" })) }, secret);
    const previous = await db.kirimanRekomendasi.findMany({ where: { id_klien: input.client_id }, select: { id_property: true }, orderBy: { terakhir_dikirim: "desc" }, take: 64 });
    return { phone, text, receipt, property_ids: aset.map(l => l.id_property), name: clean(client.nama, "Bapak/Ibu"),
      search_criteria: found.find(m => m.property_id === aset[0].id_property)?.search_criteria || null,
      previous_property_ids: previous.map(p => String(p.id_property)) };
  }
  const data = verify(input.receipt, secret, input.agent_id, now);
  const client = await db.klien.findFirst({ where: { id_klien: data.client_id, id_agent: input.agent_id }, select: { id_klien: true } });
  if (!client) return { acknowledged: true };
  // Receipt records the price actually offered. Retried ACKs never increment
  // send counts or send another WhatsApp message.
  const [properties, prefs] = await Promise.all([
    db.listing.findMany({ where: { id_property: { in: data.assets.map(a => BigInt(a.id)) } }, select: { id_property: true } }),
    db.preferensiKlien.findMany({ where: { id_klien: data.client_id, id_preferensi: { in: data.assets.map(a => BigInt(a.preference)) } }, select: { id_preferensi: true } }),
  ]);
  await db.kirimanRekomendasi.createMany({ data: data.assets.filter(a => properties.some(p => String(p.id_property) === a.id)).map(a => ({
    id_klien: data.client_id, id_agent: input.agent_id, id_property: BigInt(a.id),
    id_preferensi: prefs.some(p => String(p.id_preferensi) === a.preference) ? BigInt(a.preference) : null,
    kanal: "WHATSAPP", harga_saat_kirim: a.price, harga_diketahui: a.price, status_saat_kirim: a.status,
    pertama_dikirim: new Date(data.at), terakhir_dikirim: new Date(data.at),
  })), skipDuplicates: true });
  return { acknowledged: true };
}
