// src/lib/lelangPoster.ts
// Generator poster katalog lelang (story 1080×1920).
// Sisi klien menyusun payload tampilan, lalu POST ke /api/poster/lelang yang
// merender template HTML (public/templates/katalog_lelang_solusindo.html) menjadi
// JPEG via Puppeteer — sehingga bebas dari masalah CORS foto.

import { downloadPosterImage, safeFileName } from "@/lib/poster/downloadPoster";
import type { AuctionHistoryResult } from "@/lib/auctionHistory";

export interface LelangPosterPayload {
  heroTitle: string;
  eyebrow: string;
  alamat: string;
  luasTanah: string;
  luasTanahTerbilang?: string | null;
  luasBangunan?: string | null;
  legalMain: string;
  legalSub: string;
  hargaLimit: string;          // sudah diformat: "Rp 317.000.000"
  hargaLelangAwal?: string | null;
  diskonPct?: number | null;
  hematNominal?: string | null;
  uangJaminan?: string | null; // diformat, atau null bila tak ada
  contactNum: string;
  agentName: string;
  qrUrl: string;
  photos: string[];
}

const money = (n: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
};

const ANGKA = [
  "nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh",
  "delapan", "sembilan", "sepuluh", "sebelas",
];

function ejaBilangan(n: number): string {
  if (n < 12) return ANGKA[n];
  if (n < 20) return `${ejaBilangan(n - 10)} belas`;
  const gabung = (awalan: string, sisa: number) =>
    sisa ? `${awalan} ${ejaBilangan(sisa)}` : awalan;
  if (n < 100) return gabung(`${ejaBilangan(Math.floor(n / 10))} puluh`, n % 10);
  if (n < 200) return gabung("seratus", n - 100);
  if (n < 1000) return gabung(`${ejaBilangan(Math.floor(n / 100))} ratus`, n % 100);
  if (n < 2000) return gabung("seribu", n - 1000);
  for (const [nilai, nama] of [
    [1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1000, "ribu"],
  ] as const) {
    if (n >= nilai) return gabung(`${ejaBilangan(Math.floor(n / nilai))} ${nama}`, n % nilai);
  }
  return "";
}

/** Eja angka yang sudah diformat agar desimalnya sama dengan angka di kartu. */
function terbilangLuas(formatted: string | null): string | null {
  if (!formatted) return null;
  const [bulat, desimal] = formatted.replace(/ m²$/, "").split(",");
  const n = Number(bulat.replace(/\./g, ""));
  if (!Number.isSafeInteger(n) || n < 0) return null;
  const koma = desimal
    ? ` koma ${desimal.split("").map((digit) => ANGKA[Number(digit)]).join(" ")}`
    : "";
  return `${ejaBilangan(n)}${koma} meter persegi`;
}

/** Rapikan nomor telepon jadi format lokal (0812-3456-7890). */
function formatPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  const m = d.match(/^(\d{4})(\d{3,4})(\d+)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : d;
}

const LEGAL_SUB: Record<string, string> = {
  SHM: "Sertifikat Hak Milik",
  HGB: "Hak Guna Bangunan",
  SHGB: "Hak Guna Bangunan",
  HGU: "Hak Guna Usaha",
  AJB: "Akta Jual Beli",
  GIRIK: "Girik / Letter C",
};

interface BuildOpts {
  /** Kode agent yang membagikan — leads masuk ke dia (dipakai di URL/QR). */
  agentCode?: string | null;
  /** Profil agent yang sedang login, untuk kontak di poster. */
  selfAgent?: { nama?: string; whatsapp?: string; telepon?: string } | null;
  /** Riwayat aset dari mesin pencocokan yang juga dipakai halaman detail. */
  riwayatLelang?: AuctionHistoryResult | null;
  /** Origin (default window.location.origin). */
  origin?: string;
}

/** Bangun payload poster dari objek properti lelang. */
export function buildLelangPosterPayload(data: any, opts: BuildOpts = {}): LelangPosterPayload {
  const origin =
    opts.origin || (typeof window !== "undefined" ? window.location.origin : "");
  const agentCode = opts.agentCode || "";

  const judul: string = data?.judul || data?.title || "Aset Lelang";
  const kota: string = data?.kota || data?.area_lokasi || "";

  const formatLuas = (value: unknown): string | null => {
    const n = toNum(value);
    return Number.isFinite(n) && n > 0
      ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n)} m²`
      : null;
  };
  const formattedTanah = formatLuas(data?.luas_tanah);
  const luasTanah = formattedTanah || "Belum tersedia";
  const luasTanahTerbilang = terbilangLuas(formattedTanah);
  const luasBangunan = formatLuas(data?.luas_bangunan);

  const legalitas: string = (data?.legalitas || "").toString().trim();
  const legalMain = legalitas || "Cek Dokumen";
  const legalSub = legalitas
    ? LEGAL_SUB[legalitas.toUpperCase()] || "Legalitas Aset"
    : "Legalitas Aset";

  const limitNum = toNum(data?.nilai_limit_lelang) || toNum(data?.harga) || toNum(data?.priceRates?.monthly);
  const hargaLimit = money(limitNum);

  // Bandingkan dengan lelang PERTAMA yang tercatat untuk bidang persis sama.
  // Harga pasar, paket bidang lain, event kembar, dan lelang setelah listing
  // ini tidak boleh menghasilkan klaim diskon.
  const history = opts.riwayatLelang?.ok ? opts.riwayatLelang.items : [];
  const current = history.find(
    (item) =>
      item.is_current &&
      item.id_property === String(data?.id_property || data?.id || ""),
  );
  const currentDate = Date.parse(current?.tanggal_lelang || data?.tanggal_lelang || "");
  const first = history
    .filter(
      (item) =>
        !item.is_current &&
        item.cakupan === "SAMA" &&
        Date.parse(item.tanggal_lelang || "") < currentDate,
    )
    .sort((a, b) => Date.parse(a.tanggal_lelang!) - Date.parse(b.tanggal_lelang!))[0];
  const firstLimit = toNum(first?.harga_efektif);
  let hargaLelangAwal: string | null = null;
  let diskonPct: number | null = null;
  let hematNominal: string | null = null;
  if (
    current &&
    Number.isFinite(firstLimit) &&
    Number.isFinite(limitNum) &&
    firstLimit > limitNum &&
    limitNum > 0
  ) {
    // Bulatkan ke bawah agar tidak mengklaim 100% untuk harga yang masih > 0.
    const pct = Math.floor(((firstLimit - limitNum) / firstLimit) * 1000) / 10;
    if (pct > 0) {
      hargaLelangAwal = money(firstLimit);
      diskonPct = pct;
      hematNominal = money(firstLimit - limitNum);
    }
  }

  const jaminanNum = toNum(data?.uang_jaminan);
  const uangJaminan = jaminanNum > 0 ? money(jaminanNum) : null;

  const agentName: string =
    opts.selfAgent?.nama || data?.agent?.nama || data?.owner?.name || "Agent Premier";
  const rawPhone: string =
    opts.selfAgent?.whatsapp ||
    opts.selfAgent?.telepon ||
    data?.agent?.telepon ||
    data?.agent?.whatsapp ||
    data?.owner?.phone ||
    "";
  const contactNum = formatPhone(rawPhone) || "Hubungi via link";

  const slugId =
    data?.slug && data?.id_property
      ? `${data.slug}-${data.id_property}`
      : String(data?.id_property || data?.id || "");
  const qrUrl = `${origin}/Lelang/${slugId}${agentCode ? `/${agentCode}` : ""}`;

  const photos: string[] = Array.isArray(data?.foto_list)
    ? data.foto_list.filter((u: any) => typeof u === "string" && /^(https?:)?\/\/|^\//.test(u))
    : [];

  return {
    heroTitle: judul,
    eyebrow: `Lelang · Solusindo Premier Property${kota ? ` ${kota}` : ""}`,
    alamat: data?.alamat_lengkap || data?.address || "-",
    luasTanah,
    luasTanahTerbilang,
    luasBangunan,
    legalMain,
    legalSub,
    hargaLimit,
    hargaLelangAwal,
    diskonPct,
    hematNominal,
    uangJaminan,
    contactNum,
    agentName,
    qrUrl,
    photos,
  };
}

/**
 * Render + unduh poster lelang. Mobile → native share sheet (Simpan Gambar →
 * Galeri), desktop → unduh file.
 */
export async function downloadLelangPoster(
  payload: LelangPosterPayload,
  onStateChange?: (loading: boolean) => void,
): Promise<void> {
  return downloadPosterImage(
    "/api/poster/lelang",
    payload,
    `poster-lelang-${safeFileName(payload.heroTitle)}`,
    onStateChange,
  );
}
