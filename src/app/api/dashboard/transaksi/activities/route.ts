import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toNumberSafe(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && typeof v.toString === "function") return Number(v.toString());
  return Number(v);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const take = Number(searchParams.get("take") ?? 10);

  const rows = await prisma.transaksi.findMany({
    orderBy: { diperbarui_pada: "desc" },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      kode_transaksi: true,
      status_transaksi: true,
      tanggal_transaksi: true,
      harga_deal: true,
      listing: {
        select: {
          id_property: true,
          judul: true,
          gambar: true,
          kota: true,
          kecamatan: true,
          kelurahan: true,
          provinsi: true,
        },
      },
    },
  });

  const data = rows.map((t) => ({
    id: t.id.toString(),
    kode: t.kode_transaksi ?? `TR-${t.id.toString()}`,
    status: t.status_transaksi,
    date: t.tanggal_transaksi.toISOString().slice(0, 10),
    price: toNumberSafe(t.harga_deal),
    listingId: t.listing.id_property.toString(),
    addressShort: [t.listing.kelurahan, t.listing.kecamatan, t.listing.kota]
      .filter(Boolean)
      .join(", ")
      .slice(0, 28),
    imageUrl: t.listing.gambar ?? "/images/listing/sample-1.jpg",
    title: t.listing.judul,
  }));

  return NextResponse.json({ data });
}