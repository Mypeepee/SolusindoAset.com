import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === "object" && typeof v.toString === "function") return Number(v.toString());
  return Number(v) || 0;
}

function extractFirstImage(raw: string | null | undefined): string {
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim();
  if (!first) return "";
  // Bare Drive ID — resolve to thumbnail
  if (!first.includes("/") && !first.includes(".") && /^[a-zA-Z0-9_-]{10,}$/.test(first)) {
    return `/api/drive-image?id=${first}&sz=w400`;
  }
  return first;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;

  const { searchParams } = new URL(req.url);
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? 10), 1), 50);

  const rows = await prisma.mou.findMany({
    where: agentId ? { id_agent: agentId } : {},
    orderBy: { diperbarui_pada: "desc" },
    take,
    select: {
      id: true,
      id_transaksi: true,
      status: true,
      tipe_komisi: true,
      harga_deal: true,
      maksimum_bidding: true,
      dibuat_pada: true,
      listing: {
        select: {
          id_property: true,
          judul: true,
          gambar: true,
          kota: true,
          kecamatan: true,
          kelurahan: true,
        },
      },
      transaksi: {
        select: {
          status_transaksi: true,
          tanggal_transaksi: true,
          harga_bidding: true,
        },
      },
    },
  });

  const CLOSING_STATUSES = new Set([
    "closing", "pengurusan_balik_nama", "balik_nama_selesai",
    "pengurusan_risalah_lelang", "risalah_lelang_selesai",
    "mediasi", "mediasi_gagal", "permohonan_eksekusi",
    "aanmaning", "penetapan", "rakor",
    "pelaksanaan_eksekusi", "serah_terima_kunci", "selesai",
  ]);

  const data = rows.map((m) => {
    const isPersen = m.tipe_komisi.toUpperCase() === "PERSENTASE";
    const status = (m.transaksi?.status_transaksi as string | undefined) ?? m.status;
    const isClosing = CLOSING_STATUSES.has(status);
    // PERSENTASE + closing → harga_bidding (fallback ke maksimum_bidding).
    const persenValue = isClosing
      ? toNum(m.transaksi?.harga_bidding) || toNum(m.maksimum_bidding)
      : toNum(m.maksimum_bidding);
    const price = isPersen ? persenValue : toNum(m.harga_deal);
    const date = m.transaksi?.tanggal_transaksi?.toISOString().slice(0, 10)
      ?? m.dibuat_pada.toISOString().slice(0, 10);

    return {
      id: m.id.toString(),
      kode: m.id_transaksi ?? `MOU-${m.id}`,
      status,
      date,
      price,
      listingId: m.listing.id_property.toString(),
      addressShort: [m.listing.kelurahan, m.listing.kecamatan, m.listing.kota]
        .filter(Boolean).join(", ").slice(0, 28),
      imageUrl: extractFirstImage(m.listing.gambar) || "/images/listing/sample-1.jpg",
      title: m.listing.judul,
    };
  });

  return NextResponse.json({ data });
}
