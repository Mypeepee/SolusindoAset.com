export type SuccessStory = {
  id: string;
  images: string[];
  type: string;
  title: string;
  location: string;
  desc: string;
  marketPrice: number;
  dealPrice: number;
  tiktokUrl?: string;
};

export const MAX_STORY_IMAGES = 6;
export const MAX_STORY_IMAGE_BYTES = 8 * 1024 * 1024;
export const STORY_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export function isTikTokUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com"))
    );
  } catch {
    return false;
  }
}

export function formatStoryPrice(n: number): string {
  if (Math.abs(n) >= 1_000_000_000)
    return `Rp ${Number((n / 1_000_000_000).toFixed(3)).toLocaleString("id-ID")}M`;
  if (Math.abs(n) >= 1_000_000)
    return `Rp ${Number((n / 1_000_000).toFixed(2)).toLocaleString("id-ID")}Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export const DEFAULT_SUCCESS_STORIES: SuccessStory[] = [
  {
    id: "pabrik-mojokerto",
    images: [
      "/images/hero/pasinan1.jpg",
      "/images/hero/pasinan2.jpg",
      "/images/hero/pasinan3.jpg",
    ],
    type: "Aset Lelang",
    title: "Pabrik Mojokerto",
    location: "Mojokerto, Jawa Timur",
    desc: "Hanya 10 bulan. Hemat Rp 27 miliar. Kunci sudah di tangan klien — bersih, sah, dan tuntas secara hukum.",
    marketPrice: 50_000_000_000,
    dealPrice: 23_000_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxo1tXm3/",
  },
  {
    id: "gudang-surabaya",
    images: ["/images/hero/kedinding1.jpg", "/images/hero/kedinding2.jpg"],
    type: "Aset Lelang",
    title: "Gudang Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Kunci sudah di tangan — bahkan sebelum balik nama selesai. Hemat Rp 1,1 miliar, tanpa menunggu birokrasi pertanahan berbulan-bulan.",
    marketPrice: 2_700_000_000,
    dealPrice: 1_565_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoR7DxM/",
  },
  {
    id: "rumah-sidoarjo",
    images: ["/images/hero/unimas2.jpg", "/images/hero/unimas3.jpg"],
    type: "Aset Lelang",
    title: "Rumah Sidoarjo",
    location: "Sidoarjo, Jawa Timur",
    desc: "Aset masih bersengketa, balik nama belum selesai — kunci tetap berpindah tangan. Hemat Rp 900 juta, karena hukum kami berdiri di depan masalah, bukan menunggu di belakang.",
    marketPrice: 2_500_000_000,
    dealPrice: 1_600_000_000,
    tiktokUrl: "https://www.tiktok.com/@koko_lelang/video/7567352888402464008",
  },
  {
    id: "rumah-surabaya",
    images: ["/images/hero/rungkut.jpg"],
    type: "Aset Lelang",
    title: "Rumah Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Dihadang ormas di lapangan — kunci tetap berpindah ke klien. Hemat Rp 1 miliar, karena keberanian kami bukan retorika, melainkan eksekusi yang nyata.",
    marketPrice: 2_200_000_000,
    dealPrice: 1_200_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxo9Sqqa/",
  },
  {
    id: "apotek-surabaya",
    images: ["/images/hero/balongsari.jpeg"],
    type: "Aset Lelang",
    title: "Apotek Strategis Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Dihadang kuasa hukum debitur — eksekusi tetap berjalan, kunci tetap berpindah ke klien. Hemat Rp 2,1 miliar, karena tim hukum kami selalu satu langkah di depan setiap perlawanan.",
    marketPrice: 3_600_000_000,
    dealPrice: 1_500_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoxe7Jc/",
  },
  {
    id: "rumah-malang",
    images: ["/images/hero/malang.jpg"],
    type: "Aset Lelang",
    title: "Rumah di Malang",
    location: "Malang, Jawa Timur",
    desc: "Hanya 30 hari. Belum balik nama, kunci sudah di tangan klien. Hemat Rp 640 juta — karena kami eksekusi di ritme klien, bukan di ritme birokrasi.",
    marketPrice: 1_000_000_000,
    dealPrice: 360_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoQ6s6P/",
  },
];
