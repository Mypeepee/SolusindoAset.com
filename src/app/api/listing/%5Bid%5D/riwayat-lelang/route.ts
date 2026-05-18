import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);

    const current = await prisma.listing.findUnique({
      where: { id_property: id },
      select: {
        id_property: true,
        judul: true,
        harga: true,
        nilai_limit_lelang: true,
        tanggal_lelang: true,
        gambar: true,
        status_tayang: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        legalitas: true,
        nomor_legalitas: true,
        slug: true,
      },
    });

    if (!current) {
      return NextResponse.json({ riwayat: [] });
    }

    const serializeItem = (r: typeof current) => {
      const gambarArr = r.gambar?.trim()
        ? r.gambar.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      return {
        id_property: r.id_property.toString(),
        judul: r.judul,
        harga: Number(r.harga),
        nilai_limit_lelang: r.nilai_limit_lelang ? Number(r.nilai_limit_lelang) : null,
        tanggal_lelang: r.tanggal_lelang?.toISOString() ?? null,
        gambar_utama: gambarArr[0] ?? null,
        status_tayang: r.status_tayang,
        kelurahan: r.kelurahan,
        kecamatan: r.kecamatan,
        kota: r.kota,
        legalitas: r.legalitas,
        nomor_legalitas: r.nomor_legalitas,
        slug: r.slug,
      };
    };

    // Jika kelurahan atau legalitas kosong, tidak bisa cari riwayat terkait
    // Tampilkan minimal property ini sendiri
    if (!current.kelurahan || !current.legalitas) {
      return NextResponse.json({ riwayat: [serializeItem(current)] });
    }

    // Jika nomor_legalitas ada → match ketiganya (paling spesifik)
    // Jika nomor_legalitas kosong → match kelurahan + legalitas saja
    const whereClause =
      current.nomor_legalitas?.trim()
        ? {
            kelurahan: current.kelurahan,
            legalitas: current.legalitas,
            nomor_legalitas: current.nomor_legalitas,
            jenis_transaksi: "LELANG" as const,
          }
        : {
            kelurahan: current.kelurahan,
            legalitas: current.legalitas,
            jenis_transaksi: "LELANG" as const,
          };

    const riwayat = await prisma.listing.findMany({
      where: whereClause,
      select: {
        id_property: true,
        judul: true,
        harga: true,
        nilai_limit_lelang: true,
        tanggal_lelang: true,
        gambar: true,
        status_tayang: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        legalitas: true,
        nomor_legalitas: true,
        slug: true,
      },
      orderBy: { tanggal_lelang: "asc" },
    });

    return NextResponse.json({ riwayat: riwayat.map(serializeItem) });
  } catch (error) {
    console.error("❌ Error fetching riwayat lelang:", error);
    return NextResponse.json({ riwayat: [] }, { status: 500 });
  }
}
