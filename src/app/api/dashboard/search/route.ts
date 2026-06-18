import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { suratSearchMeta } from "@/app/dashboard/surat/search-meta";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ listings: [], agents: [], projects: [], events: [], surat: [] });
  }

  const LIMIT = 5;

  const [listings, agents, projects, events] = await Promise.all([
    prisma.listing.findMany({
      where: {
        OR: [
          { judul: { contains: q, mode: "insensitive" } },
          { alamat_lengkap: { contains: q, mode: "insensitive" } },
          { kota: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id_property: true,
        id_agent: true,
        judul: true,
        slug: true,
        kota: true,
        kategori: true,
        jenis_transaksi: true,
        harga: true,
        gambar: true,
        status_tayang: true,
      },
      take: LIMIT,
      orderBy: { tanggal_dibuat: "desc" },
    }),

    prisma.agent.findMany({
      where: {
        OR: [
          { pengguna: { nama_lengkap: { contains: q, mode: "insensitive" } } },
          { nama_kantor: { contains: q, mode: "insensitive" } },
          { kota_area: { contains: q, mode: "insensitive" } },
          { id_agent: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id_agent: true,
        jabatan: true,
        kota_area: true,
        foto_profil_url: true,
        status_keanggotaan: true,
        pengguna: { select: { nama_lengkap: true } },
      },
      take: LIMIT,
      orderBy: { dibuat_pada: "desc" },
    }),

    prisma.project.findMany({
      where: {
        OR: [
          { nama_project: { contains: q, mode: "insensitive" } },
          { listing: { judul: { contains: q, mode: "insensitive" } } },
          { listing: { kota: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id_project: true,
        nama_project: true,
        status: true,
        jenis_pendanaan: true,
        gambar_thumbnail: true,
        listing: { select: { kota: true } },
      },
      take: LIMIT,
      orderBy: { dibuat_tanggal: "desc" },
    }),

    prisma.acara.findMany({
      where: {
        OR: [
          { judul_acara: { contains: q, mode: "insensitive" } },
          { lokasi: { contains: q, mode: "insensitive" } },
          { deskripsi: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id_acara: true,
        judul_acara: true,
        tipe_acara: true,
        status_acara: true,
        tanggal_mulai: true,
        lokasi: true,
      },
      take: LIMIT,
      orderBy: { tanggal_mulai: "asc" },
    }),
  ]);

  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id_property.toString(),
      id_agent: l.id_agent,
      judul: l.judul,
      slug: l.slug,
      kota: l.kota,
      kategori: l.kategori,
      jenis: l.jenis_transaksi,
      harga: Number(l.harga ?? 0),
      gambar: l.gambar ? l.gambar.split(",")[0].trim() : null,
      status: l.status_tayang,
    })),
    agents: agents.map((a) => ({
      id: a.id_agent,
      nama: a.pengguna?.nama_lengkap ?? "—",
      jabatan: a.jabatan,
      kota: a.kota_area,
      foto: a.foto_profil_url
        ? `https://lh3.googleusercontent.com/d/${a.foto_profil_url}=s100`
        : null,
      status: a.status_keanggotaan,
    })),
    projects: projects.map((p) => {
      const raw = p.gambar_thumbnail ?? null;
      const driveId = raw?.match(/[?&]id=([^&]+)/)?.[1];
      const thumbnail = driveId
        ? `https://lh3.googleusercontent.com/d/${driveId}=s200`
        : raw;
      return {
        id: p.id_project,
        nama: p.nama_project,
        status: p.status,
        jenis: p.jenis_pendanaan,
        thumbnail,
        kota: p.listing?.kota ?? "—",
      };
    }),
    events: events.map((e) => ({
      id: e.id_acara.toString(),
      judul: e.judul_acara,
      tipe: e.tipe_acara,
      status: e.status_acara,
      tanggal: e.tanggal_mulai.toISOString(),
      lokasi: e.lokasi ?? "—",
    })),
    surat: suratSearchMeta
      .filter((t) =>
        [t.title, t.code, t.category, t.description].some((f) =>
          f.toLowerCase().includes(q.toLowerCase())
        )
      )
      .slice(0, 5),
  });
}
