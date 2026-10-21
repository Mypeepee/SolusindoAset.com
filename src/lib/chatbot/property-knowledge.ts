import type { Prisma, PrismaClient } from "@prisma/client";
import { SITE_URL } from "../site.ts";
import { regionValueVariants } from "../regionMatch.ts";
import { transactionPreference, transactionGeographyText } from "../../../backend/whatsapp/services/property_transaction.js";
import { normalizeBuyerLanguage } from "../../../backend/whatsapp/services/buyer_language.js";
import { SURABAYA_REGIONS, nearbyQueryParts } from "../../../backend/whatsapp/services/search_scope.js";
import { normalNama, kelasDariKata, tebakKelasDariNama, KELAS_TEMPAT, RADIUS_JANGKAUAN } from "../tempat/normalisasi.ts";
import { nearbyNameWhere } from "../nearbyNameWhere.ts";
import { freshAuctionWhere, isFreshAuction } from "../../../backend/whatsapp/services/auction_freshness.js";

// This is the entire database surface available to the chatbot. Never use
// include: true, SELECT *, an LLM-generated query, or a user-selected column.
export const PUBLIC_PROPERTY_SELECT = {
  id_property: true, slug: true, judul: true, jenis_transaksi: true, kategori: true,
  harga: true, harga_promo: true, nilai_limit_lelang: true, uang_jaminan: true,
  tanggal_lelang: true, alamat_lengkap: true, provinsi: true, kota: true,
  kecamatan: true, kelurahan: true, latitude: true, longitude: true,
  akses_terdekat: true, luas_tanah: true, luas_bangunan: true, ada_bangunan: true,
  kamar_tidur: true, kamar_mandi: true, daya_listrik: true,
  sumber_air: true, hadap_bangunan: true, kondisi_interior: true, legalitas: true,
  tanggal_diupdate: true,
} satisfies Prisma.ListingSelect;

type PublicRow = Prisma.ListingGetPayload<{ select: typeof PUBLIC_PROPERTY_SELECT }>;
type Database = Pick<PrismaClient, "listing" | "listingSekitar" | "listingTempat" | "listingSewaDetail">;
export type BuyerCriteria = { location: string; city?: string | null; province?: string | null; district?: string | null; village?: string | null; category?: PublicRow["kategori"] | null;
  locations?: string[]; cities?: string[]; route_landmarks?: string[];
  certificate_types?: NonNullable<PublicRow["legalitas"]>[];
  legal_requirements?: string[]; special_requirements?: string;
  region_group?: keyof typeof SURABAYA_REGIONS;
  nearby?: { query: string; radius_m?: number };
  categories?: NonNullable<PublicRow["kategori"]>[];
  transaction_type?: PublicRow["jenis_transaksi"] | null; min_price?: number | null;
  transaction_types?: NonNullable<PublicRow["jenis_transaksi"]>[];
  rental_period?: "HARIAN" | "MINGGUAN" | "BULANAN" | "TAHUNAN";
  max_price?: number | null; purpose?: "live" | "investment" | "both" | null;
  sort_by?: "price_asc";
  min_land_area_m2?: number | null; max_land_area_m2?: number | null;
  upcoming_auction_only?: boolean; exclude_ids?: string[] };
const ID = /^[1-9]\d{0,17}$/;
const STOP_WORDS = new Set("saya aku bapak ibu mau ingin cari carikan mencari tolong ada apakah yang di daerah wilayah sekitar dekat deket dengan untuk dan atau ini itu aset properti property listing rumah tanah ruko gudang apartemen kos lelang jual dijual sewa disewa lokasi kota kab kabupaten kec kecamatan berapa mana saja ya dong bisa harga murah punya tersedia masih lihat detail info informasi lengkap".split(" "));
const SECRET_TEXT = /password|kata[_\s-]?sandi|api[_\s-]?key|access[_\s-]?token|bearer\s|private[_\s-]?key|nomor\s*rekening|no\.?\s*rek(?:ening)?\b|\b(?:npwp|nik|ktp|otp|pin|debitur|pemilik)\b|atas\s+nama|nomor\s*(?:sertifikat|shm|hgb)|arus\s*kas|om[sz]et|gaji|komisi\s*(?:agent|agen)|saldo\s*(?:perusahaan|rekening)|ignore\s+(?:all|previous)|abaikan\s+(?:semua|instruksi)|system[_\s-]?prompt/i;

// Free-text fields have an additional filter. Raw descriptions, attachments,
// certificate numbers, vendor identity and all internal notes are excluded.
export function publicText(value: unknown, max = 240): string | null {
  if (typeof value !== "string" || SECRET_TEXT.test(value)) return null;
  const text = value.replace(/<[^>]*>/g, " ").replace(/https?:\/\/\S+/gi, "")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "")
    .replace(/(?:\+?62|0)8\d[\d\s().-]{6,18}\d/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}
function number(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : null;
}
function positive(value: unknown) { const n = number(value); return n != null && n > 0 ? n : null; }
function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
}
const rupiah = (value: number | null) => value == null ? null : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function propertyDetailUrl(row: Pick<PublicRow, "id_property" | "slug" | "jenis_transaksi">, siteUrl = SITE_URL) {
  const origin = new URL(siteUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password || /^(localhost|127\.|0\.|\[)|\.local$/i.test(origin.hostname)) throw new TypeError("INVALID_PUBLIC_SITE_URL");
  const route = row.jenis_transaksi === "LELANG" ? "Lelang" : row.jenis_transaksi === "SEWA" ? "Sewa" : "Jual";
  // A safe fallback still resolves by ID and the page redirects to its canonical slug.
  const slug = row.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(row.slug) && row.slug.length <= 400 ? row.slug : "properti";
  return `${origin.origin}/${route}/${slug}-${row.id_property}`;
}

function fullAddress(address: { street: string | null; village: string | null; district: string | null; city: string | null; province: string | null }) {
  const parts: string[] = [];
  for (const value of [address.street, address.village, address.district, address.city, address.province]) {
    if (!value) continue;
    const comparable = value.toLowerCase().replace(/^(?:kelurahan|kel\.?|kecamatan|kec\.?|kota|kabupaten|kab\.?|provinsi)\s+/, "");
    if (!parts.join(" ").toLowerCase().includes(comparable)) parts.push(value);
  }
  return parts.join(", ") || null;
}

export function isBuyerCriteria(value: unknown): value is BuyerCriteria {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (Object.keys(c).some((key) => !["location", "locations", "cities", "route_landmarks", "certificate_types", "legal_requirements", "special_requirements", "city", "province", "district", "village", "region_group", "nearby", "category", "categories", "transaction_type", "transaction_types", "rental_period", "min_price", "max_price", "purpose", "sort_by", "min_land_area_m2", "max_land_area_m2", "upcoming_auction_only", "exclude_ids"].includes(key)) ||
    typeof c.location !== "string" || !c.location.trim() || c.location.length > 100 || !publicText(c.location)) return false;
  const categories = ["RUMAH", "APARTEMEN", "RUKO", "TANAH", "GUDANG", "HOTEL_DAN_VILLA", "TOKO", "PABRIK", "KOS"];
  for (const field of ["locations", "cities", "route_landmarks", "legal_requirements"]) {
    const values = c[field];
    if (values != null && (!Array.isArray(values) || !values.length || values.length > 10 ||
      new Set(values).size !== values.length || values.some((v) => typeof v !== "string" || !v.trim() || v.length > 100 || !publicText(v)))) return false;
  }
  if (c.special_requirements != null && (typeof c.special_requirements !== "string" || c.special_requirements.length > 600 || !publicText(c.special_requirements))) return false;
  if (c.certificate_types != null && (!Array.isArray(c.certificate_types) || !c.certificate_types.length || c.certificate_types.length > 8 ||
    new Set(c.certificate_types).size !== c.certificate_types.length || c.certificate_types.some((v) => !["SHM", "HGB", "HGU", "HP", "STRATA_TITLE", "PPJB", "AJB", "LAINNYA"].includes(v)))) return false;
  if (c.category != null && (typeof c.category !== "string" || !categories.includes(c.category))) return false;
  if (c.categories != null && (!Array.isArray(c.categories) || !c.categories.length || c.categories.length > categories.length ||
    c.categories.some((category) => typeof category !== "string" || !categories.includes(category)) ||
    new Set(c.categories).size !== c.categories.length || c.category != null)) return false;
  if (c.transaction_type != null && !["LELANG", "SEWA", "SECONDARY", "PRIMARY", "CESSIE"].includes(String(c.transaction_type))) return false;
  if (c.transaction_types != null && (!Array.isArray(c.transaction_types) || !c.transaction_types.length || c.transaction_types.length > 4 ||
    c.transaction_type != null || new Set(c.transaction_types).size !== c.transaction_types.length ||
    c.transaction_types.some((type) => typeof type !== "string" || !["LELANG", "PRIMARY", "SECONDARY", "SEWA"].includes(type)))) return false;
  const includesRental = c.transaction_type === "SEWA" || Array.isArray(c.transaction_types) && c.transaction_types.includes("SEWA");
  if (c.rental_period != null && (!includesRental || !["HARIAN", "MINGGUAN", "BULANAN", "TAHUNAN"].includes(String(c.rental_period)))) return false;
  if (c.purpose != null && !["live", "investment", "both"].includes(String(c.purpose))) return false;
  if (c.sort_by != null && c.sort_by !== "price_asc") return false;
  if (c.region_group != null && (typeof c.region_group !== "string" || !Object.hasOwn(SURABAYA_REGIONS, c.region_group) ||
    typeof c.city !== "string" || !/^(?:kota\s+)?surabaya$/i.test(c.city))) return false;
  if (c.nearby != null) {
    if (typeof c.nearby !== "object" || Array.isArray(c.nearby)) return false;
    const n = c.nearby as Record<string, unknown>;
    if (Object.keys(n).some((key) => !["query", "radius_m"].includes(key)) || typeof n.query !== "string" ||
      !n.query.trim() || n.query.length > 100 || !normalNama(n.query) || !publicText(n.query) ||
      (n.radius_m != null && (typeof n.radius_m !== "number" || !Number.isInteger(n.radius_m) || n.radius_m < 1 || n.radius_m > 20000))) return false;
  }
  for (const field of ["city", "province", "district", "village"]) if (c[field] != null && (typeof c[field] !== "string" || !(c[field] as string).trim() || (c[field] as string).length > 100 || !publicText(c[field]))) return false;
  if (c.upcoming_auction_only != null && (typeof c.upcoming_auction_only !== "boolean" || (c.upcoming_auction_only && c.transaction_type !== "LELANG"))) return false;
  if (c.exclude_ids != null && (!Array.isArray(c.exclude_ids) || c.exclude_ids.length > 64 || c.exclude_ids.some((id) => typeof id !== "string" || !ID.test(id)))) return false;
  for (const key of ["min_price", "max_price"]) if (c[key] != null && (typeof c[key] !== "number" || !Number.isSafeInteger(c[key]) || Number(c[key]) <= 0 || Number(c[key]) > 1e15)) return false;
  for (const key of ["min_land_area_m2", "max_land_area_m2"]) if (c[key] != null && (typeof c[key] !== "number" || !Number.isFinite(c[key]) || Number(c[key]) <= 0 || Number(c[key]) > 1e9)) return false;
  return (c.min_price == null || c.max_price == null || Number(c.min_price) <= Number(c.max_price)) &&
    (c.min_land_area_m2 == null || c.max_land_area_m2 == null || Number(c.min_land_area_m2) <= Number(c.max_land_area_m2));
}

export function planPropertyLookup(text: string, previousId?: string | null) {
  text = normalizeBuyerLanguage(text).replace(/\*/g, "");
  const explicit = [...text.matchAll(/(?:\b(?:kode|id|aset|properti|property)\s*[:#-]?\s*\*?|#)([1-9]\d{0,17})\b/gi)].map((m) => m[1]);
  const standalone = /^\s*\*?([1-9]\d{0,17})\*?\s*$/.exec(text)?.[1];
  if (standalone) explicit.push(standalone);
  // Public property links are parsed as text; no URL supplied by a user is fetched.
  for (const match of text.matchAll(/\/(?:Lelang|Jual|Secondary|Primary|Sewa|properti)\/(?:[^\s/?#]*?-)?([1-9]\d{0,17})(?:\/|[?#\s)*.,]|$)/gi)) explicit.push(match[1]);
  const ids = [...new Set(explicit)];
  if (ids.length) return { ids: ids.slice(0, 4), explicit: true, terms: [] as string[], transaction: null, category: null };
  const search = /\b(cari(?:kan)?|mencari|ada\s+(?:aset|properti|rumah|tanah|ruko|kos|gudang|apartemen)|alternatif|pilihan\s+(?:lain|properti))\b/i.test(text);
  if (previousId && ID.test(previousId) && !search) return { ids: [previousId], explicit: false, terms: [] as string[], transaction: null, category: null };
  const preference = transactionPreference(text);
  const normalized: string = (preference ? transactionGeographyText(text) : text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ");
  const terms = [...new Set(normalized.split(/\s+/).filter((t) => t.length >= 3 && t.length <= 40 && !STOP_WORDS.has(t) && !/^\d+$/.test(t)))].slice(0, 4);
  const transaction = preference?.values.length === 1 ? preference.values[0] as NonNullable<PublicRow["jenis_transaksi"]> : null;
  const categories = ["RUMAH", "TANAH", "RUKO", "GUDANG", "APARTEMEN", "KOS", "TOKO", "PABRIK"] as const;
  const category = categories.find((v) => new RegExp(`\\b${v.toLowerCase()}\\b`).test(normalized)) || null;
  return { ids: [] as string[], explicit: false, terms, transaction, transactions: preference?.values as NonNullable<PublicRow["jenis_transaksi"]>[] | undefined, category };
}

// Match the beginning of a location word, not the middle of another place:
// Manukan must not silently become Pamanukan. Keep compound names such as
// Manukan Kulon and address punctuation; Prisma still binds all search values.
function locationTermWhere(term: string): Prisma.ListingWhereInput {
  const matches: Prisma.StringFilter[] = [{ startsWith: term, mode: "insensitive" },
    ...[" ", "\n", "\r", "\t", ",", ".", "-", "/", "("].map((separator) => ({ contains: separator + term, mode: "insensitive" as const }))];
  const fields = ["judul", "kota", "kecamatan", "kelurahan", "provinsi", "alamat_lengkap"] as const;
  return { OR: [
    ...fields.flatMap((field) => matches.map((match) => ({ [field]: match }))),
    { tempatDekat: { some: { presisi: { in: ["TITIK", "ALAMAT", "PATOKAN"] }, tempat: { OR: matches.flatMap((match) => [
      { nama: match }, { alias: { some: { alias_normal: match } } },
    ]) } } } },
  ] };
}

function regionNamesWhere(field: "kota" | "kecamatan" | "kelurahan", names: string[]): Prisma.ListingWhereInput {
  // One case-insensitive IN preserves every spelling variant without hundreds
  // of ILIKE branches and repeated trigram-index scans for a directional area.
  return { [field]: { in: [...new Set(names)], mode: "insensitive" } };
}

function manualNearby(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 15).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const name = publicText(item.nama, 160), category = publicText(item.tipe, 40);
    if (!name) return [];
    const distance = positive(item.jarak);
    const unit = ["METER", "KM", "MENIT"].includes(item.satuan) ? item.satuan : null;
    return [{ name, category, distance: unit ? distance : null, unit,
      measurement: "Keterangan patokan pada listing; estimasi agent, bukan rute terverifikasi.", source: "listing.akses_terdekat" }];
  });
}

export function mapPublicProperty(row: PublicRow, readAt: number) {
  const base = positive(row.harga), promo = positive(row.harga_promo);
  const price = promo != null && base != null && promo < base ? promo : base;
  const isAuction = row.jenis_transaksi === "LELANG";
  const limit = isAuction ? positive(row.nilai_limit_lelang) ?? base : null;
  const lat = number(row.latitude), lon = number(row.longitude);
  const coordinates = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0) ? { latitude: lat, longitude: lon } : null;
  const address = { street: publicText(row.alamat_lengkap, 500), province: publicText(row.provinsi),
    city: publicText(row.kota), district: publicText(row.kecamatan), village: publicText(row.kelurahan), coordinates };
  return {
    id: String(row.id_property), name: publicText(row.judul) || `Properti ${row.id_property}`,
    detail_url: propertyDetailUrl(row), full_address: fullAddress(address),
    source: "database_listing_publik", retrieved_at: new Date(readAt).toISOString(),
    updated_at: iso(row.tanggal_diupdate), transaction_type: row.jenis_transaksi,
    category: row.kategori, origin: "unknown", limit_price: limit,
    asking_price: price, price_display: rupiah(isAuction ? limit : price),
    price_label: isAuction ? "Harga limit lelang" : row.jenis_transaksi === "SEWA" ? "Harga sewa (periode lihat rental)" : "Harga penawaran",
    deposit: isAuction ? positive(row.uang_jaminan) : null,
    auction_at: isAuction ? iso(row.tanggal_lelang) : null,
    location: [publicText(row.kecamatan), publicText(row.kota)].filter(Boolean).join(", "),
    address,
    specifications: { land_area_m2: positive(row.luas_tanah), building_area_m2: positive(row.luas_bangunan),
      has_building: row.ada_bangunan, bedrooms: number(row.kamar_tidur),
      bathrooms: number(row.kamar_mandi), electricity_watts: positive(row.daya_listrik),
      water_source: publicText(row.sumber_air), facing: publicText(row.hadap_bangunan), interior: publicText(row.kondisi_interior),
      certificate_type: row.legalitas },
    nearby: manualNearby(row.akses_terdekat),
    // A published flag is not proof that an auction lot is still open at DJKN.
    publication: { status: "TERSEDIA", note: "Masih ditayangkan di website; ketersediaan aktual dan jadwal resmi perlu dikonfirmasi." },
  };
}

export async function getPropertyKnowledge(db: Database, input: { text: string; previousId?: string | null; criteria?: BuyerCriteria }, now = Date.now()) {
  const plan = planPropertyLookup(input.text, input.previousId);
  const criteria = input.criteria;
  if (criteria && !isBuyerCriteria(criteria)) throw new TypeError("INVALID_BUYER_CRITERIA");
  if (criteria && !plan.explicit) {
    plan.ids = [];
    plan.terms = criteria.region_group || criteria.locations?.length || criteria.cities?.length || criteria.route_landmarks?.length ? [] : criteria.location.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t)).slice(0, 4);
  }
  if (!criteria && !plan.ids.length && !plan.terms.length && !plan.category && !plan.transaction) {
    return { status: "needs_property", asset: null, candidates: [], source: "database_listing_publik" };
  }
  const where: Prisma.ListingWhereInput = { status_tayang: "TERSEDIA", bukan_properti: false };
  if (plan.ids.length) where.id_property = { in: plan.ids.map((id) => BigInt(id)) };
  else {
    if (criteria?.upcoming_auction_only) where.tanggal_lelang = { gt: new Date(now) };
    if (criteria?.exclude_ids?.length) where.id_property = { notIn: criteria.exclude_ids.map((id) => BigInt(id)) };
    // Structured preferences are authoritative. Never fall back to a negated
    // keyword in the raw message when criteria were supplied.
    if (criteria?.transaction_types?.length) where.jenis_transaksi = { in: criteria.transaction_types };
    else if (criteria?.transaction_type) where.jenis_transaksi = criteria.transaction_type;
    else if (criteria) where.jenis_transaksi = { in: ["LELANG", "PRIMARY", "SECONDARY"] };
    else if (plan.transactions?.length) where.jenis_transaksi = { in: plan.transactions };
    else if (plan.transaction) where.jenis_transaksi = plan.transaction;
    const category = criteria ? criteria.category : plan.category;
    if (criteria?.categories?.length) where.kategori = { in: criteria.categories };
    else if (category) where.kategori = category;
    if (plan.terms.length) where.AND = plan.terms.map(locationTermWhere);
    // Area alternatives belong to one OR group. Budget, land size and legal
    // requirements remain AND constraints outside that group.
    const areas = criteria?.locations?.length ? criteria.locations : criteria?.route_landmarks;
    if (areas?.length) where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: areas.map(locationTermWhere) }];
    if (criteria?.cities?.length) where.AND = [...(Array.isArray(where.AND) ? where.AND : []),
      regionNamesWhere("kota", criteria.cities.flatMap((city) => regionValueVariants(city, "kota")))];
    if (criteria?.certificate_types?.length) where.legalitas = { in: criteria.certificate_types };
    if (criteria?.region_group) {
      const names = SURABAYA_REGIONS[criteria.region_group].flatMap((district) =>
        [district, `Kecamatan ${district}`, `Kec. ${district}`].flatMap((name) => regionValueVariants(name, "kecamatan")));
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), regionNamesWhere("kecamatan", names)];
    }
    if (criteria?.nearby) {
      const nearby = criteria.nearby;
      const groups = nearbyQueryParts(nearby.query);
      const filter = (query: string): Prisma.ListingWhereInput => {
        const normalized = normalNama(query);
        const category = kelasDariKata(normalized);
        const inferred = category || tebakKelasDariNama(query)?.kelas;
        const radius = nearby.radius_m ?? (inferred ? RADIUS_JANGKAUAN[KELAS_TEMPAT[inferred].jangkauan] : undefined);
        const place: Prisma.TempatWhereInput = category ? { kelas: category } : nearbyNameWhere(query);
        return { tempatDekat: { some: { tempat: place, ...(radius ? { jarak_meter: { lte: radius } } : {
          // An alias such as UNESA gets the actual dictionary class's radius,
          // just as the searchbar does; unknown aliases are never guessed 1km.
          OR: [{ jarak_meter: { lte: RADIUS_JANGKAUAN.HARIAN } },
            { jarak_meter: { lte: RADIUS_JANGKAUAN.LANDMARK }, tempat: { jangkauan: "LANDMARK" } }],
        }) } } };
      };
      // The relation is mandatory even when the dictionary has no match.
      // Dropping this predicate would silently recommend unrelated properties.
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: groups.map((queries: string[]) => ({ AND: queries.map(filter) })) }];
    }
    if (criteria?.min_price || criteria?.max_price) {
      const range = { ...(criteria.min_price ? { gte: criteria.min_price } : {}), ...(criteria.max_price ? { lte: criteria.max_price } : {}) };
      const rentFields = { HARIAN: 'harga_sewa_harian', MINGGUAN: 'harga_sewa_mingguan', BULANAN: 'harga_sewa_bulanan', TAHUNAN: 'harga_sewa_tahunan' } as const;
      const rentalPrice: Prisma.ListingWhereInput | null = criteria.rental_period ? {
        jenis_transaksi: "SEWA",
        sewaDetail: { is: { [rentFields[criteria.rental_period]]: { ...range, gt: 0 } } },
      } : null;
      const nonAuction: Prisma.ListingWhereInput = rentalPrice ? { jenis_transaksi: { in: ["PRIMARY", "SECONDARY", "CESSIE"] } } : { jenis_transaksi: { not: "LELANG" } };
      const listingPrices: Prisma.ListingWhereInput[] = [
        { jenis_transaksi: "LELANG", nilai_limit_lelang: { ...range, gt: 0 } },
        { jenis_transaksi: "LELANG", OR: [{ nilai_limit_lelang: null }, { nilai_limit_lelang: { lte: 0 } }], harga: range },
        { ...nonAuction, harga_efektif: { ...range, gt: 0 } },
        { ...nonAuction, OR: [{ harga_efektif: null }, { harga_efektif: { lte: 0 } }], harga: range },
      ];
      const priceFilter: Prisma.ListingWhereInput = rentalPrice && criteria.transaction_type === "SEWA" ? rentalPrice : {
        OR: [...listingPrices, ...(rentalPrice ? [rentalPrice] : [])],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), priceFilter];
    }
    if (criteria?.city) where.AND = [...(Array.isArray(where.AND) ? where.AND : []), regionNamesWhere("kota", regionValueVariants(criteria.city, "kota"))];
    if (criteria?.district) {
      const core = criteria.district.replace(/^(?:kecamatan|kec\.?)\s+/i, "");
      const names = [core, `Kecamatan ${core}`, `Kec. ${core}`].flatMap((name) => regionValueVariants(name, "kecamatan"));
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), regionNamesWhere("kecamatan", names)];
    }
    if (criteria?.village) {
      const core = criteria.village.replace(/^(?:kelurahan|kel\.?|desa)\s+/i, "");
      const names = [core, `Kelurahan ${core}`, `Kel. ${core}`, `Desa ${core}`].flatMap((name) => regionValueVariants(name, "kelurahan"));
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), regionNamesWhere("kelurahan", names)];
    }
    if (criteria?.min_land_area_m2 != null || criteria?.max_land_area_m2 != null) where.luas_tanah = {
      gt: 0, ...(criteria.min_land_area_m2 != null ? { gte: criteria.min_land_area_m2 } : {}), ...(criteria.max_land_area_m2 != null ? { lte: criteria.max_land_area_m2 } : {}),
    };
  }
  const recommended = !!criteria && !plan.explicit && !!criteria.max_price;
  if (!plan.ids.length) where.AND = [...(Array.isArray(where.AND) ? where.AND : []), freshAuctionWhere(now)];
  const rankAuctions = recommended && (criteria.transaction_types ? criteria.transaction_types.includes("LELANG") : !criteria.transaction_type || criteria.transaction_type === "LELANG");
  const cheapestFirst = criteria?.sort_by === "price_asc";
  let selection: { schedule_priority: "upcoming" | "needs_confirmation" | "standard"; sort_by?: "price_asc" } = { schedule_priority: "standard" };
  const preferredOrder = (order: Prisma.ListingOrderByWithRelationInput[]): Prisma.ListingOrderByWithRelationInput[] =>
    cheapestFirst ? [{ harga_efektif: "asc" }, ...order.filter((item) => !("harga_efektif" in item))] : order;
  const query = (filter: Prisma.ListingWhereInput, orderBy: Prisma.ListingOrderByWithRelationInput[]) =>
    db.listing.findMany({ where: filter, select: PUBLIC_PROPERTY_SELECT, take: 5, orderBy: preferredOrder(orderBy) });
  let rows: PublicRow[];
  if (rankAuctions && !criteria.upcoming_auction_only) {
    // Apply the same budget/location/public filters to both passes. A cheap old
    // auction cannot outrank a matching future one. Do not pad a short fresh
    // list with expired lots just to reach five recommendations.
    rows = await query({ ...where, AND: [...(Array.isArray(where.AND) ? where.AND : []), { OR: [
      { jenis_transaksi: "LELANG", tanggal_lelang: { gt: new Date(now) } },
      { jenis_transaksi: { not: "LELANG" } },
    ] }] }, [{ tanggal_lelang: { sort: "asc", nulls: "last" } }, { harga_efektif: "asc" }, { tanggal_diupdate: "desc" }, { id_property: "desc" }]);
    selection = { schedule_priority: "upcoming" };
    if (!rows.length) {
      rows = await query(where, [{ tanggal_lelang: { sort: "desc", nulls: "last" } }, { tanggal_diupdate: "desc" }, { harga_efektif: "asc" }, { id_property: "desc" }]);
      selection = { schedule_priority: "needs_confirmation" };
    }
  } else {
    rows = await query(where, criteria ? [{ harga_efektif: "asc" }, { tanggal_diupdate: "desc" }, { id_property: "desc" }] : [{ tanggal_diupdate: "desc" }, { id_property: "desc" }]);
    if (criteria?.upcoming_auction_only) selection = { schedule_priority: "upcoming" };
  }
  if (cheapestFirst) selection.sort_by = "price_asc";
  const properties = rows.filter(row => plan.ids.length || isFreshAuction(row, now)).map((row) => mapPublicProperty(row, now));
  // A residential brand can occur in multiple cities. Do not silently prefer
  // the cheapest city when the client has not specified which one they mean.
  if (criteria && !plan.explicit && !criteria.city && !criteria.cities?.length && new Set(properties.map((p) => p.address.city?.toLowerCase().replace(/^(?:kota|kab(?:upaten)?\.?)\s*/i, ''))).size > 1) {
    return { status: "clarify_location", asset: null, candidates: [], source: "database_listing_publik" };
  }
  // Never choose a different lot when an explicit code is absent/non-public.
  const asset = plan.ids.length === 1 && properties.length === 1 ? properties[0] : null;
  if (asset) return { status: "matched", asset: await enrichPublicProperty(db, asset), candidates: [], source: "database_listing_publik" };
  return { status: properties.length ? recommended ? "recommendations" : "choose_property" : "not_found", asset: null,
    candidates: recommended ? await Promise.all(properties.map(async (property) => {
      const enriched = await enrichPublicProperty(db, property);
      if (criteria?.rental_period && enriched.transaction_type === "SEWA" && enriched.rental) {
        const fields = { HARIAN: 'daily_price', MINGGUAN: 'weekly_price', BULANAN: 'monthly_price', TAHUNAN: 'yearly_price' } as const;
        const price = enriched.rental[fields[criteria.rental_period]];
        return { ...enriched, asking_price: price, price_display: rupiah(price), rental: { ...enriched.rental, period: criteria.rental_period } };
      }
      return enriched;
    })) : properties,
    source: "database_listing_publik", selection };
}

async function enrichPublicProperty(db: Database, asset: ReturnType<typeof mapPublicProperty>) {
  // Optional cache tables may not have been migrated on every installation.
  // Only missing schema is tolerated; other failures fail closed.
  const optional = async <T>(query: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await query(); } catch (error) {
      if (["P2021", "P2022"].includes((error as { code?: string }).code || "")) return fallback;
      throw error;
    }
  };
  const id = BigInt(asset.id);
  const [cache, indexed, rental] = await Promise.all([
    optional(() => db.listingSekitar.findUnique({ where: { id_property: id }, select: { tempat: true, landmark: true, presisi_titik: true, dipindai_pada: true } }), null),
    optional(() => db.listingTempat.findMany({ where: { id_property: id, sumber: "PINDAI", presisi: { in: ["TITIK", "ALAMAT"] } },
      select: { jarak_meter: true, tempat: { select: { nama: true, kelas: true } } }, take: 20, orderBy: { jarak_meter: "asc" } }), []),
    asset.transaction_type === "SEWA" ? optional(() => db.listingSewaDetail.findUnique({ where: { id_property: id }, select: {
      durasi_sewa: true, harga_sewa_harian: true, harga_sewa_mingguan: true, harga_sewa_bulanan: true, harga_sewa_tahunan: true,
      deposit: true, luas_kamar: true, fasilitas_kamar: true, fasilitas_bersama: true, kos_gender: true,
      termasuk_listrik: true, termasuk_air: true, akses_24_jam: true, minimal_sewa_jumlah: true, minimal_sewa_satuan: true,
    } }), null) : Promise.resolve(null),
  ]);
  const nearby: object[] = [...asset.nearby];
  const scanned = cache && ["TITIK", "ALAMAT"].includes(cache.presisi_titik || "")
    ? [...(Array.isArray(cache.tempat) ? cache.tempat : []), ...(Array.isArray(cache.landmark) ? cache.landmark : [])] : [];
  for (const raw of scanned.slice(0, 50)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>, name = publicText(item.nama, 160), distance = positive(item.jarak);
    if (name && distance != null && distance <= 20000) nearby.push({ name, category: publicText(item.kategori || item.kelas, 40),
      distance: Math.round(distance), unit: "METER", measurement: "Jarak garis lurus, bukan jarak tempuh/waktu berkendara.", source: "listing_sekitar", scanned_at: iso(cache?.dipindai_pada) });
  }
  for (const item of indexed) {
    const name = publicText(item.tempat.nama, 160);
    if (name && item.jarak_meter >= 0 && item.jarak_meter <= 20000) nearby.push({ name, category: publicText(item.tempat.kelas, 40),
      distance: item.jarak_meter, unit: "METER", measurement: "Jarak garis lurus, bukan jarak tempuh/waktu berkendara.", source: "listing_tempat" });
  }
  const seen = new Set<string>();
  const uniqueNearby = nearby.filter((p) => { const key = String((p as { name: string }).name).toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 20);
  return { ...asset, nearby: uniqueNearby, rental: rental ? {
    period: rental.durasi_sewa, daily_price: positive(rental.harga_sewa_harian), weekly_price: positive(rental.harga_sewa_mingguan),
    monthly_price: positive(rental.harga_sewa_bulanan), yearly_price: positive(rental.harga_sewa_tahunan), deposit: positive(rental.deposit),
    room_area_m2: positive(rental.luas_kamar), room_facilities: publicText(rental.fasilitas_kamar, 600), shared_facilities: publicText(rental.fasilitas_bersama, 600),
    gender: rental.kos_gender, electricity_included: rental.termasuk_listrik, water_included: rental.termasuk_air, access_24_hours: rental.akses_24_jam,
    minimum_duration: rental.minimal_sewa_jumlah, minimum_period: rental.minimal_sewa_satuan,
  } : null };
}
