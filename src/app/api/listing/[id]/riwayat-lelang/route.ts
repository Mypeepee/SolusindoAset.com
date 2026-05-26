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

    const serializeItem = (r: NonNullable<typeof current>) => {
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

    // Aset unik dideteksi via kota + legalitas + nomor_legalitas (case-insensitive).
    // Kelurahan tidak dipakai karena sering tidak konsisten antar listing.
    const canMatch =
      !!current.kota &&
      !!current.legalitas &&
      !!current.nomor_legalitas?.trim();

    if (!canMatch) {
      return NextResponse.json({ riwayat: [serializeItem(current)] });
    }

    const others = await prisma.listing.findMany({
      where: {
        id_property: { not: id },
        jenis_transaksi: "LELANG",
        kota: { equals: current.kota!, mode: "insensitive" },
        legalitas: current.legalitas!,
        nomor_legalitas: { equals: current.nomor_legalitas!, mode: "insensitive" },
      },
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

    const merged = [current, ...others]
      .map(serializeItem)
      .sort((a, b) => {
        const da = a.tanggal_lelang ? new Date(a.tanggal_lelang).getTime() : 0;
        const db = b.tanggal_lelang ? new Date(b.tanggal_lelang).getTime() : 0;
        return da - db;
      });

    return NextResponse.json({ riwayat: merged });
  } catch (error) {
    console.error("❌ Error fetching riwayat lelang:", error);
    return NextResponse.json({ riwayat: [] }, { status: 500 });
  }
}
