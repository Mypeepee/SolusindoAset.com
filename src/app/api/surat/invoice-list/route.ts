import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const driveMatch =
    raw.match(/drive\.google\.com\/file\/d\/([^/]+)/) ??
    raw.match(/drive\.google\.com\/open\?id=([^&]+)/) ??
    raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveMatch?.[1]) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  return raw;
}

function extractFirstImageUrl(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const candidates = str
    .split(",")
    .map((x) => normalizeUrl(x))
    .filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/"));
  return candidates[0] ?? "";
}

function toProxyImg(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://"))
    return `/api/img?url=${encodeURIComponent(url)}`;
  return "";
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(typeof v === "object" ? String(v) : v);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.invoice.findMany({
    orderBy: { tanggal_invoice: "desc" },
    include: {
      transaksi: {
        select: {
          id_transaksi: true,
          mou: {
            select: {
              listing: { select: { alamat_lengkap: true, judul: true, kota: true, gambar: true } },
            },
          },
        },
      },
    },
  });

  const result = rows.map((inv) => {
    const listing    = inv.transaksi.mou?.listing;
    const rawGambar  = extractFirstImageUrl(listing?.gambar);
    const foto_url   = toProxyImg(rawGambar);

    return {
      id_invoice:      inv.id_invoice,
      id_kuitansi:     inv.id_kuitansi,
      ditagihkan_ke:   inv.ditagihkan_ke,
      keterangan:      inv.keterangan,
      nominal:         toNum(inv.nominal),
      tanggal_invoice: inv.tanggal_invoice.toISOString(),
      kode_transaksi:  inv.transaksi.id_transaksi,
      alamat_property: listing?.alamat_lengkap ?? listing?.kota ?? "",
      foto_url,
      sudah_kuitansi:  inv.id_kuitansi !== null,
    };
  });

  return NextResponse.json(result);
}
