import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function splitImages(gambar: any): string[] {
  const raw = (gambar ?? "").toString();
  return raw
    .split(",")
    .map((x: string) => x.trim())
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
        nomor_legalitas: true,
        luas_tanah: true,
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

    // history (aset sama)
    const rows = await prisma.listing.findMany({
      where: {
        id_property: { not: id_property },
        kota: current.kota,
        ...(current.nomor_legalitas
          ? { nomor_legalitas: current.nomor_legalitas }
          : {}),
        ...(current.luas_tanah ? { luas_tanah: current.luas_tanah } : {}),
      },
      orderBy: [{ tanggal_lelang: "asc" }, { tanggal_dibuat: "asc" }],
      select: {
        id_property: true,
        tanggal_lelang: true,
        tanggal_dibuat: true,
        nilai_limit_lelang: true,
        uang_jaminan: true,
        link: true,
        gambar: true,
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

        // ✅ penting untuk UI gambar
        gambar: x.gambar ?? null,
        gambar_list: gambarList,
        imageUrl: firstImage(x.gambar),

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
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}