import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function splitImages(gambar: any): string[] {
  const raw = (gambar ?? "").toString();
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function firstImage(gambar: any): string {
  const arr = splitImages(gambar);
  return arr[0] || "/placeholder.jpg";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id_property = BigInt(params.id);

    const current = await prisma.listing.findUnique({
      where: { id_property },
      select: {
        id_property: true,
        jenis_transaksi: true,
        kelurahan: true,
        legalitas: true,
        nomor_legalitas: true,
        kota: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (current.jenis_transaksi !== "LELANG") {
      return NextResponse.json({
        current: { ...current, id_property: current.id_property.toString() },
        rows: [],
      });
    }

    // Cari listing lain yang merupakan aset yang sama:
    // kota (selalu ada) + legalitas + nomor_legalitas → unik per aset.
    // Kelurahan tidak dipakai karena sering tidak konsisten antar listing.
    const canMatch = current.legalitas && current.nomor_legalitas;

    const rows = await prisma.listing.findMany({
      where: canMatch
        ? {
            id_property: { not: id_property },
            kota: { equals: current.kota, mode: "insensitive" },
            legalitas: current.legalitas!,
            nomor_legalitas: { equals: current.nomor_legalitas!, mode: "insensitive" },
          }
        : { id_property: -1n },
      orderBy: [{ tanggal_lelang: "asc" }, { tanggal_dibuat: "asc" }],
      select: {
        id_property: true,
        tanggal_lelang: true,
        tanggal_dibuat: true,
        nilai_limit_lelang: true,
        uang_jaminan: true,
        link: true,
        gambar: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        legalitas: true,
        nomor_legalitas: true,
        alamat_lengkap: true,
        id_agent: true,
        agent: {
          select: {
            nama_kantor: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    });

    // current (ikut masuk urutan lelang ke-1..n)
    const currentFull = await prisma.listing.findUnique({
      where: { id_property },
      select: {
        id_property: true,
        tanggal_lelang: true,
        tanggal_dibuat: true,
        nilai_limit_lelang: true,
        uang_jaminan: true,
        link: true,
        gambar: true,
        kelurahan: true,
        kecamatan: true,
        kota: true,
        legalitas: true,
        nomor_legalitas: true,
        alamat_lengkap: true,
        id_agent: true,
        agent: {
          select: {
            nama_kantor: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
    });

    const normalize = (x: any) => {
      const gambarList = splitImages(x.gambar);
      return {
        id_property: x.id_property.toString(),
        tanggal_lelang: x.tanggal_lelang,
        tanggal_dibuat: x.tanggal_dibuat,
        nilai_limit_lelang: x.nilai_limit_lelang?.toString?.() ?? null,
        uang_jaminan: x.uang_jaminan?.toString?.() ?? null,
        link: x.link ?? null,
        gambar: x.gambar ?? null,
        gambar_list: gambarList,
        imageUrl: firstImage(x.gambar),
        kelurahan: x.kelurahan ?? null,
        kecamatan: x.kecamatan ?? null,
        kota: x.kota ?? null,
        legalitas: x.legalitas ?? null,
        nomor_legalitas: x.nomor_legalitas ?? null,
        alamat_lengkap: x.alamat_lengkap ?? null,
        id_agent: x.id_agent,
        agent_nama:
          x.agent?.pengguna?.nama_lengkap ??
          x.agent?.nama_kantor ??
          x.id_agent ??
          "-",
      };
    };

    const merged = [normalize(currentFull), ...rows.map(normalize)].sort(
      (a, b) => {
        const da = new Date(a.tanggal_lelang ?? a.tanggal_dibuat ?? 0).getTime();
        const db = new Date(b.tanggal_lelang ?? b.tanggal_dibuat ?? 0).getTime();
        return da - db;
      }
    );

    return NextResponse.json({
      current: { ...current, id_property: current.id_property.toString() },
      rows: merged,
      matchCriteria: canMatch
        ? {
            kota: current.kota,
            legalitas: current.legalitas,
            nomor_legalitas: current.nomor_legalitas,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}