// src/app/dashboard/transaksi/page.tsx
import TransaksiPageClient from "./components/TransaksiPageClient";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ListingClientDTO = {
  id: string;
  judul: string;
  vendor: string | null;

  jenis_transaksi: string;
  kategori: string;

  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;

  tanggal_lelang: string | null;

  alamat_lengkap: string | null;
  provinsi: string | null;
  kota: string | null;
  kecamatan: string | null;
  kelurahan: string | null;

  luas_tanah: number | null;
  luas_bangunan: number | null;

  luas: number;

  imageUrl: string;

  agent_nama: string | null;
  agent_kantor: string | null;
};

const toFiniteNumber = (v: unknown): number => {
  if (v === null || v === undefined) return 0;

  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "bigint") return Number(v);

  if (typeof v === "object" && v !== null && "toString" in v) {
    const n = Number(String((v as any).toString()));
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toFiniteNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;

  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return Number(v);

  if (typeof v === "object" && v !== null && "toString" in v) {
    const n = Number(String((v as any).toString()));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeUrl = (u: string) => (u || "").trim().replace(/\s+/g, "");
const sanitizeDriveId = (id: string) => (id || "").trim().replace(/_+$/g, "");

const toDriveThumb = (url: string) => {
  if (!url) return "";

  if (/drive\.google\.com\/thumbnail\?id=/i.test(url)) {
    const m = url.match(/thumbnail\?id=([^&]+)/i);
    if (m?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m[1])}`;
    return url;
  }

  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m1[1])}`;

  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m2[1])}`;

  const m3 = url.match(/drive\.google\.com\/uc\?[^#]*id=([^&]+)/i);
  if (m3?.[1]) return `https://drive.google.com/thumbnail?id=${sanitizeDriveId(m3[1])}`;

  return url;
};

const isProbablyUrl = (url: string) =>
  !!url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"));

const extractFirstImageUrl = (raw: unknown): string => {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  const candidates = str
    .split(",")
    .map((x) => toDriveThumb(normalizeUrl(x)))
    .filter(Boolean);

  for (const c of candidates) {
    if (isProbablyUrl(c)) return c;
  }

  const single = toDriveThumb(normalizeUrl(str));
  return isProbablyUrl(single) ? single : "";
};

const toProxyImg = (url: string) => {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/img?url=${encodeURIComponent(url)}`;
  }
  return "";
};

async function getInitial(): Promise<ListingClientDTO[]> {
  const rows = await prisma.listing.findMany({
    take: 50, // ✅ lebih banyak supaya “terlihat global”
    orderBy: { tanggal_diupdate: "desc" },
    select: {
      id_property: true,
      judul: true,
      vendor: true,
      jenis_transaksi: true,
      kategori: true,

      harga: true,
      harga_promo: true,
      nilai_limit_lelang: true,
      tanggal_lelang: true,

      alamat_lengkap: true,
      provinsi: true,
      kota: true,
      kecamatan: true,
      kelurahan: true,

      luas_tanah: true,
      luas_bangunan: true,

      gambar: true,

      agent: {
        select: {
          nama_kantor: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    const jenis = String(r.jenis_transaksi);
    const luasTanah = toFiniteNullableNumber(r.luas_tanah);
    const luasBangunan = jenis === "LELANG" ? null : toFiniteNullableNumber(r.luas_bangunan);

    const rawImg = extractFirstImageUrl(r.gambar);
    const imageUrl = toProxyImg(rawImg);

    const tanggal_lelang =
      jenis === "LELANG" && r.tanggal_lelang ? new Date(r.tanggal_lelang).toISOString() : null;

    return {
      id: String(r.id_property),
      judul: r.judul ?? "",
      vendor: r.vendor ?? null,

      jenis_transaksi: jenis,
      kategori: String(r.kategori),

      harga: toFiniteNumber(r.harga),
      harga_promo: toFiniteNullableNumber(r.harga_promo),
      nilai_limit_lelang: toFiniteNullableNumber(r.nilai_limit_lelang),

      tanggal_lelang,

      alamat_lengkap: r.alamat_lengkap ?? null,
      provinsi: r.provinsi ?? null,
      kota: r.kota ?? null,
      kecamatan: r.kecamatan ?? null,
      kelurahan: r.kelurahan ?? null,

      luas_tanah: luasTanah,
      luas_bangunan: luasBangunan,

      luas: toFiniteNumber(luasBangunan ?? luasTanah ?? 0),

      imageUrl,

      agent_nama: r.agent?.pengguna?.nama_lengkap ?? null,
      agent_kantor: r.agent?.nama_kantor ?? null,
    };
  });
}

export default async function Page() {
  const initialListings = await getInitial();
  return <TransaksiPageClient initialListings={initialListings} />;
}