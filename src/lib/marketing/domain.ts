import { AUCTION_LEAD_HOURS } from "./campaign-selection";
import { z } from "zod";
import { SITE_URL } from "@/lib/site";
import { BUY_PROPERTY_TYPES } from "@/lib/propertyType";
import {
  DEFAULT_DEAL_THRESHOLD,
  hasVerifiedKelurahan,
  isWorthItDeal,
  type DealFilters,
  type DealDiscountMode,
  type InvestorListing,
} from "@/lib/investor-deals";

export const settingsSchema = z
  .object({
    revision: z.number().int().positive(),
    enabled: z.boolean(),
    instagram: z.boolean(),
    whatsapp: z.boolean(),
    schedules: z
      .array(
        z
          .string()
          .regex(
            /^([01]\d|2[0-3]):[0-5]\d$/,
            "Gunakan format HH:mm dengan jam 00–23 dan menit 00–59.",
          ),
      )
      .min(1)
      .max(12),
    companyName: z.string().trim().min(1).max(100),
    companyPhone: z.string().trim().max(30),
    city: z.string().trim().max(300),
    locations: z
      .array(
        z
          .object({
            id: z.string().max(150),
            name: z.string().min(1).max(150),
            level: z.enum(["provinsi", "kota"]),
            parent: z.string().max(150).optional(),
            ancestors: z.array(z.string().max(150)).max(3).optional(),
          })
          .strict(),
      )
      .max(20),
    category: z.enum(["ALL", "PRIMARY", "LELANG", "SECONDARY"]),
    propertyTypes: z
      .array(z.enum(BUY_PROPERTY_TYPES))
      .max(BUY_PROPERTY_TYPES.length),
    minPrice: z.number().finite().min(0).max(1e15).nullable(),
    maxPrice: z.number().finite().positive().max(1e15).nullable(),
    minSpread: z.number().min(0).max(100),
    minDrop: z.number().min(0).max(100),
    cooldownDays: z.number().int().min(1).max(90),
    whatsappAudience: z
      .array(z.string().regex(/^[1-9]\d{6,14}@(s\.whatsapp\.net|lid)$/))
      .max(2000),
    whatsappAccount: z
      .string()
      .regex(/^[1-9]\d{6,14}$/)
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.schedules).size !== v.schedules.length)
      ctx.addIssue({
        code: "custom",
        path: ["schedules"],
        message: "Jam publikasi tidak boleh berulang.",
      });
    if (v.minPrice !== null && v.maxPrice !== null && v.minPrice > v.maxPrice)
      ctx.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "Harga maksimum harus sama atau lebih besar dari minimum.",
      });
    if (v.enabled && !v.instagram && !v.whatsapp)
      ctx.addIssue({
        code: "custom",
        path: ["instagram"],
        message: "Pilih minimal satu kanal.",
      });
    if (
      v.companyPhone &&
      !/^[1-9]\d{6,14}$/.test(normalizePhone(v.companyPhone))
    )
      ctx.addIssue({
        code: "custom",
        path: ["companyPhone"],
        message: "Masukkan nomor WhatsApp yang valid.",
      });
  });
export type MarketingConfig = z.infer<typeof settingsSchema>;
/** Campaign criteria extend selection only; global automation controls stay intact. */
export type MarketingSelectionConfig = MarketingConfig & {
  discountMode?: DealDiscountMode;
};
export type Channel = "instagram" | "whatsapp";
export type AssetSnapshot = {
  id: string;
  assetKey: string;
  title: string;
  address: string;
  city: string;
  price: number;
  landArea: number | null;
  certificateType?: string | null;
  category: string;
  propertyType: string;
  auctionDate: string | null;
  listingUrl: string;
  images: string[];
  revision: string;
  sourceListedAt?: string | null;
  marketSpreadPct?: number | null;
  auctionDropPct?: number | null;
};
export type MetricValues = {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  replies: number | null;
  reactions: number | null;
};
export const EMPTY_METRICS: MetricValues = {
  views: null,
  reach: null,
  likes: null,
  comments: null,
  saved: null,
  shares: null,
  replies: null,
  reactions: null,
};
export const DEFAULT_CONFIG: MarketingConfig = {
  revision: 1,
  enabled: false,
  instagram: true,
  whatsapp: true,
  schedules: ["09:00", "13:00", "18:00"],
  companyName: "Solusindo Aset",
  companyPhone: "",
  city: "",
  locations: [],
  category: "ALL",
  propertyTypes: [],
  minPrice: null,
  maxPrice: null,
  minSpread: DEFAULT_DEAL_THRESHOLD,
  minDrop: DEFAULT_DEAL_THRESHOLD,
  cooldownDays: 7,
  whatsappAudience: [],
  whatsappAccount: null,
};
export const normalizePhone = (value: string) => {
  const phone = value.replace(/[\s()+-]/g, "");
  return phone.startsWith("0") ? "62" + phone.slice(1) : phone;
};
export const PLANNING_DAYS = 90;
export function investorFilters(config: MarketingSelectionConfig): DealFilters {
  return {
    city: config.city,
    query: "",
    transactionType: "BELI",
    listingCategory: config.category,
    dataState: "deals",
    minSpread: config.minSpread,
    minDrop: config.minDrop,
    discountMode: config.discountMode,
    sort: "score",
    savedOnly: false,
    upcomingOnly: false,
    propertyTypes: config.propertyTypes,
    locations: config.locations,
    ...(config.minPrice !== null ? { minPrice: config.minPrice } : {}),
    ...(config.maxPrice !== null ? { maxPrice: config.maxPrice } : {}),
  };
}
export function eligibleAsset(
  item: InvestorListing,
  config: MarketingSelectionConfig,
  now = new Date(),
) {
  return (
    item.status === "TERSEDIA" &&
    item.transactionType !== "SEWA" &&
    hasVerifiedKelurahan(item) &&
    Number.isFinite(item.currentAuctionPrice) &&
    item.currentAuctionPrice > 0 &&
    isWorthItDeal(
      item,
      config.minDrop,
      config.minSpread,
      config.discountMode,
    ) &&
    (item.listingCategory !== "LELANG" ||
      (!!item.auctionDate &&
        Date.parse(item.auctionDate) - now.getTime() >=
          AUCTION_LEAD_HOURS * 3600000))
  );
}
export const assetIdentity = (item: InvestorListing) =>
  item.assetCode ? "asset:" + item.assetCode : "listing:" + item.id;
export function snapshotAsset(item: InvestorListing): AssetSnapshot {
  return {
    id: item.id,
    assetKey: assetIdentity(item),
    title: item.title,
    address: item.address,
    city: item.cityName,
    price: item.currentAuctionPrice,
    landArea: item.landAreaSqm,
    certificateType: item.certificateType || null,
    category: item.listingCategory || "SECONDARY",
    propertyType: item.propertyType,
    auctionDate: item.auctionDate,
    listingUrl: item.listingUrl,
    images: [
      ...new Set(
        item.imageUrls?.length
          ? item.imageUrls
          : item.imageUrl
            ? [item.imageUrl]
            : [],
      ),
    ].slice(0, 3),
    revision: item.sourceRevision || "",
    sourceListedAt: item.sourceListedAt || null,
    marketSpreadPct: item.metricMarketSpreadPct ?? null,
    auctionDropPct: item.metricAuctionDropPct ?? null,
  };
}
/** One public destination shared by the caption and the poster QR. */
export function marketingListingUrl(value: string, origin = SITE_URL) {
  try {
    const base = new URL(origin);
    const url = new URL(value, base);
    if (
      url.protocol !== "https:" ||
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      !/^\/(Lelang|Jual)\//.test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

const captionText = (value: string, limit: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, limit);

export function captionFor(asset: AssetSnapshot, config: MarketingConfig) {
  const money = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asset.price);
  const type = asset.propertyType.toUpperCase();
  const hook = /RUMAH|APARTEMEN|VILLA/.test(type)
    ? "🏡 Bayangkan punya tempat untuk memulai cerita baru."
    : /TANAH|LAHAN|KEBUN/.test(type)
      ? "✨ Rencana besar Anda layak punya ruang untuk tumbuh."
      : /GUDANG|PABRIK/.test(type)
        ? "✨ Usaha Anda punya langkah berikutnya. Mulai dari ruangnya."
        : /RUKO|TOKO|KANTOR|KIOS/.test(type)
          ? "✨ Bayangkan babak berikutnya untuk usaha Anda dimulai di sini."
          : "✨ Wujudkan langkah berikutnya lewat properti pilihan Anda.";
  const auction = asset.category === "LELANG";
  const auctionTime = asset.auctionDate ? Date.parse(asset.auctionDate) : NaN;
  const listingUrl = marketingListingUrl(asset.listingUrl);
  const footer = [
    "Suka yang Anda lihat? Kenali detailnya dan diskusikan rencana Anda bersama kami. ↓",
    listingUrl ? "🔗 Detail properti:\n" + listingUrl : "",
    "📩 Kirim DM dengan kode properti " +
      captionText(asset.id, 50) +
      " untuk bertanya atau menjadwalkan survei.",
    config.companyPhone
      ? "📲 WhatsApp: +" + normalizePhone(config.companyPhone)
      : "",
    captionText(config.companyName, 100),
  ]
    .filter(Boolean)
    .join("\n\n");
  const body = [
    hook,
    "",
    captionText(asset.title, 220),
    [asset.propertyType.replace(/_/g, " "), asset.city]
      .filter(Boolean)
      .map((v) => captionText(v, 100))
      .join(" • "),
    "",
    "📍 " + captionText(asset.address || asset.city, 350),
    Number.isFinite(asset.landArea) && asset.landArea! > 0
      ? "▸ Luas tanah " +
        new Intl.NumberFormat("id-ID").format(asset.landArea!) +
        " m²"
      : "",
    asset.certificateType
      ? "▸ Legalitas " + captionText(asset.certificateType, 80)
      : "",
    "▸ " + (auction ? "Limit lelang " : "Harga penawaran ") + money,
    auction && Number.isFinite(auctionTime)
      ? "▸ Jadwal lelang " +
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(auctionTime)) +
        " WIB"
      : "",
    "",
    "Geser untuk melihat foto detailnya. Simpan atau bagikan kepada orang yang ingin Anda ajak merencanakannya.",
    "",
    auction
      ? "Penjualan melalui lelang. Cek jadwal, kondisi aset, dan persyaratan sebelum mengikuti."
      : "Konfirmasikan kondisi dan ketersediaan terbaru bersama tim kami.",
  ]
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
    .join("\n");
  // Reserve the CTA and complete URL before trimming optional descriptive copy.
  return (
    body.slice(0, Math.max(0, 2200 - footer.length - 2)).trimEnd() +
    "\n\n" +
    footer
  );
}
export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function scheduledSlots(config: MarketingConfig, now = new Date()) {
  const day = jakartaDate(now);
  return [...config.schedules]
    .sort()
    .map((time) => new Date(day + "T" + time + ":00+07:00"));
}
export function nextSlot(config: MarketingConfig, now = new Date()) {
  return (
    scheduledSlots(config, now).find((date) => date > now) ||
    scheduledSlots(config, new Date(now.getTime() + 86400000))[0]
  );
}
export const statusLabels: Record<string, string> = {
  queued: "Terjadwal",
  preparing: "Menyiapkan",
  publishing: "Menerbitkan",
  completed: "Terbit",
  partial: "Sebagian terbit",
  skipped: "Dilewati",
  review: "Perlu diperiksa",
  pending: "Menunggu",
  sending: "Mengirim",
  published: "Terbit",
  failed: "Gagal",
  uncertain: "Perlu diperiksa",
};
export const errorLabels: Record<string, string> = {
  CAMPAIGN_ENDED:
    "Periode campaign sudah berakhir. Jadwal lama tidak diterbitkan.",
  CAMPAIGN_OUTSIDE_PERIOD:
    "Waktu tayang berada di luar periode campaign yang diterapkan.",
  MEDIA_DELETED:
    "Konten telah dihapus dari Instagram. Riwayat publikasi tetap disimpan.",
  ASSET_ALREADY_MARKETED:
    "Properti ini sudah pernah ditayangkan atau pengirimannya masih diperiksa. Pilih properti lain.",
  SELECTED_ASSET_UNAVAILABLE:
    "Properti yang dipilih tidak lagi memenuhi kriteria, jadwal lelang, atau jeda pemasaran. Pilih properti lain.",
  PLAN_CONFLICT:
    "Rencana telah berubah. Tutup formulir, perbarui kalender, lalu buka kembali.",
  PLAN_TIME_CONFLICT:
    "Waktu ini sudah memiliki slot lain. Pilih jam lain atau atur slot pada waktu tersebut.",
  CHANNEL_DISABLED:
    "Kanal pemasaran belum aktif. Pilih kanal yang aktif atau ubah Pengaturan.",
  RESCHEDULED: "Jadwal telah dipindahkan.",
  NO_ELIGIBLE_ASSET:
    "Tidak ada aset yang memenuhi kriteria dan jeda publikasi.",
  MISSED_SLOT: "Jadwal terlewat ketika layanan tidak berjalan.",
  PAUSED: "Otomatisasi dijeda.",
  SETTINGS_CHANGED:
    "Pengaturan berubah; materi akan diperbarui pada slot berikutnya.",
  ACCOUNT_NOT_READY: "Kanal belum siap. Periksa koneksi di Pengaturan.",
  PHOTO_UNAVAILABLE: "Foto aset tidak berhasil dimuat.",
  CAROUSEL_REQUIRED:
    "Instagram menggunakan carousel: satu sampul dan 1–3 foto properti. Siapkan ulang materi sebelum menerbitkan.",
  DELIVERY_UNCERTAIN:
    "Hasil pengiriman belum pasti. Periksa sebelum mencoba kembali.",
  TOKEN_EXPIRED: "Hubungkan kembali akun Instagram.",
  RATE_LIMIT: "Batas permintaan tercapai. Sistem akan mencoba lagi.",
  WA_DISCONNECTED: "WhatsApp perusahaan belum terhubung.",
  WA_TEST_REQUIRED: "Uji Status WA dengan akun perusahaan terlebih dahulu.",
  WA_ACCOUNT_CHANGED:
    "Akun WhatsApp berubah. Pilih kembali audiens, simpan pengaturan, lalu aktifkan kembali.",
  MEDIA_NOT_PUBLIC: "Media belum dapat dijangkau dari domain HTTPS publik.",
  PROVIDER_ERROR: "Layanan publikasi belum dapat menyelesaikan permintaan.",
  METRICS_UNAVAILABLE: "Metrik belum tersedia dari kanal ini.",
  STATUS_EXPIRED: "Status WA sudah berakhir; menampilkan data terakhir.",
  SCHEMA_NOT_READY:
    "Penyimpanan Pemasaran belum dipasang. Jalankan migrasi Pemasaran.",
  PREPARATION_TIMEOUT:
    "Foto dan materi belum selesai disiapkan dalam batas waktu. Slot berikutnya akan mencoba kembali.",
  LEASE_LOST: "Proses dihentikan karena dikerjakan oleh pemeriksaan lain.",
};
