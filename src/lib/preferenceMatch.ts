import prisma from "@/lib/prisma";

/**
 * Pencocokan listing dari sebuah Preferensi Klien (CRM).
 *
 * Strategi: FILTER KETAT — listing harus memenuhi SEMUA kriteria yang diisi
 * (tipe properti, jenis transaksi, lokasi, budget, luas). Cakupan: SEMUA
 * listing (co-broking), bukan hanya milik agent yang login.
 *
 * Lokasi listing disimpan sebagai teks bebas (hasil geocoding), jadi
 * pencocokan lokasi dilakukan setelah dinormalisasi (toleran beda format,
 * mis. "Kota Surabaya" vs "Surabaya") — helper diadaptasi dari
 * src/app/Jual/[slug]/lib/similar.ts.
 */

const num = (v: any): number => (v == null ? 0 : Number(v));

// "Surabaya" / "Kota Surabaya" / "KOTA SURABAYA" → "surabaya".
function normLoc(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan|kel\.?|kelurahan|desa)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Inti nama kota untuk SQL "contains" (toleran thd prefix Kota/Kab).
function kotaSearchTerm(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Harga efektif untuk perbandingan: lelang → nilai_limit_lelang; lainnya → promo (bila valid) / harga.
function effectivePrice(l: {
  jenis_transaksi: any;
  harga: any;
  harga_promo: any;
  nilai_limit_lelang: any;
}): number {
  if (String(l.jenis_transaksi).toUpperCase() === "LELANG") return num(l.nilai_limit_lelang);
  const h = num(l.harga);
  const p = num(l.harga_promo);
  return p > 0 && p < h ? p : h;
}

function normalizeImages(raw?: string | null): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
        ? s
        : `https://drive.google.com/thumbnail?id=${s}`,
    );
}

function normalizeAgentPhoto(fileId?: string | null): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

const SELECT = {
  id_property: true,
  slug: true,
  judul: true,
  kota: true,
  provinsi: true,
  kecamatan: true,
  kelurahan: true,
  alamat_lengkap: true,
  harga: true,
  harga_promo: true,
  nilai_limit_lelang: true,
  jenis_transaksi: true,
  kategori: true,
  gambar: true,
  luas_tanah: true,
  luas_bangunan: true,
  kamar_tidur: true,
  kamar_mandi: true,
  tanggal_lelang: true,
  is_hot_deal: true,
  agent: {
    select: {
      nama_kantor: true,
      foto_profil_url: true,
      pengguna: { select: { nama_lengkap: true } },
    },
  },
} as const;

const MAX_RESULTS = 60;

export type PreferensiMatchInput = {
  tipe_properti: any;
  jenis_transaksi: any;
  loc_provinsi: string | null;
  loc_kota: string | null;
  loc_kecamatan: string | null;
  loc_kelurahan: string | null;
  budget_min: any;
  budget_max: any;
  luas_min: any;
  luas_max: any;
};

export type MatchedListing = {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  alamat_lengkap: string;
  jenis_transaksi: string;
  kategori: string;
  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;
  gambar: string;
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_office: string;
  agent_photo: string;
};

// Cek satu dimensi luas berada dalam range [min, max] (bila batas diisi).
function luasInRange(luas: number, min: number | null, max: number | null): boolean {
  if (luas <= 0) return false;
  if (min != null && luas < min) return false;
  if (max != null && luas > max) return false;
  return true;
}

export async function matchListingsForPreferensi(
  pref: PreferensiMatchInput,
): Promise<MatchedListing[]> {
  try {
    const baseWhere: any = {
      status_tayang: "TERSEDIA",
      kategori: pref.tipe_properti,
    };
    if (pref.jenis_transaksi) baseWhere.jenis_transaksi = pref.jenis_transaksi;

    // Pool awal: persempit via SQL pakai kota (contains, toleran prefix) bila ada.
    const kotaTerm = kotaSearchTerm(pref.loc_kota);
    const pool = await prisma.listing.findMany({
      where: kotaTerm
        ? { ...baseWhere, kota: { contains: kotaTerm, mode: "insensitive" } }
        : baseWhere,
      select: SELECT,
      take: 500,
      orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
    });

    const budgetMin = pref.budget_min != null ? num(pref.budget_min) : null;
    const budgetMax = pref.budget_max != null ? num(pref.budget_max) : null;
    const luasMin = pref.luas_min != null ? num(pref.luas_min) : null;
    const luasMax = pref.luas_max != null ? num(pref.luas_max) : null;
    const hasLuas = luasMin != null || luasMax != null;

    // Level lokasi terdalam yang diisi → dipakai untuk pencocokan ketat.
    const wantKel = normLoc(pref.loc_kelurahan);
    const wantKec = normLoc(pref.loc_kecamatan);
    const wantKota = normLoc(pref.loc_kota);
    const kategori = String(pref.tipe_properti).toUpperCase();

    const matched = pool.filter((l) => {
      // Lokasi — cocokkan level terdalam yang tersedia.
      if (wantKel) {
        if (normLoc(l.kelurahan) !== wantKel) return false;
      } else if (wantKec) {
        if (normLoc(l.kecamatan) !== wantKec) return false;
      } else if (wantKota) {
        if (normLoc(l.kota) !== wantKota) return false;
      }

      // Budget — harga efektif dalam range.
      const price = effectivePrice(l);
      if (budgetMin != null && price < budgetMin) return false;
      if (budgetMax != null && price > budgetMax) return false;

      // Luas — sesuai tipe properti.
      if (hasLuas) {
        const lt = num(l.luas_tanah);
        const lb = num(l.luas_bangunan);
        let ok: boolean;
        if (kategori === "TANAH") ok = luasInRange(lt, luasMin, luasMax);
        else if (kategori === "APARTEMEN") ok = luasInRange(lb, luasMin, luasMax);
        else ok = luasInRange(lt, luasMin, luasMax) || luasInRange(lb, luasMin, luasMax);
        if (!ok) return false;
      }

      return true;
    });

    return matched.slice(0, MAX_RESULTS).map((c) => {
      const imgs = normalizeImages(c.gambar);
      const h = num(c.harga);
      const p = num(c.harga_promo);
      const isLel = String(c.jenis_transaksi).toUpperCase() === "LELANG";
      return {
        id_property: String(c.id_property),
        slug: c.slug,
        judul: c.judul,
        kota: c.kota ?? "",
        kecamatan: c.kecamatan ?? "",
        kelurahan: c.kelurahan ?? "",
        alamat_lengkap: c.alamat_lengkap ?? "",
        jenis_transaksi: String(c.jenis_transaksi),
        kategori: String(c.kategori),
        harga: h,
        harga_promo: !isLel && p > 0 && p < h ? p : null,
        nilai_limit_lelang: c.nilai_limit_lelang != null ? num(c.nilai_limit_lelang) : null,
        gambar: imgs[0] || "/images/hero/banner.jpg",
        luas_tanah: num(c.luas_tanah),
        luas_bangunan: num(c.luas_bangunan),
        kamar_tidur: c.kamar_tidur ?? 0,
        kamar_mandi: c.kamar_mandi ?? 0,
        agent_name: c.agent?.pengguna?.nama_lengkap || "Agent Premier",
        agent_office: c.agent?.nama_kantor || "Premier Asset",
        agent_photo: normalizeAgentPhoto(c.agent?.foto_profil_url),
      } as MatchedListing;
    });
  } catch (err) {
    console.error("matchListingsForPreferensi error:", err);
    return [];
  }
}
