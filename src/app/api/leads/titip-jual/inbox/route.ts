// src/app/api/leads/titip-jual/inbox/route.ts
// Inbox titip-jual untuk agent yang sedang login.
// Mengembalikan tiga bucket:
//   items         → titip yang dishare ke agent ini, masih PENDING & belum kedaluwarsa
//                   (identitas pengirim di-mask sampai diterima)
//   claimed_items → titip yang sudah dimenangkan agent ini (status terklaim)
//                   untuk section "Sedang Tindak Lanjuti"
//                   (identitas pengirim full — agent sudah berhak)
//   missed_items  → titip yang dishare ke agent ini, distribusi masih PENDING,
//                   tetapi parent titip-nya sudah TERKLAIM oleh agent lain.
//                   Untuk closure: kasih tahu siapa yang menang dan kapan,
//                   supaya agent yang offline/lambat tidak bingung.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskPhone(raw: string): string {
  // Tampilkan 3 digit awal + 3 digit akhir, tengah diganti dot.
  // Mencegah agent bypass platform via WA langsung sebelum accept.
  const d = (raw || "").replace(/\D/g, "");
  if (d.length <= 6) return d.replace(/.(?=.{2})/g, "•");
  return `${d.slice(0, 3)}••••${d.slice(-3)}`;
}

function maskName(raw: string): string {
  const parts = (raw || "").trim().split(/\s+/);
  return parts
    .map((p, i) =>
      i === 0
        ? p
        : p.length <= 1
        ? p
        : `${p[0]}${"•".repeat(Math.min(p.length - 1, 4))}`,
    )
    .join(" ");
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session as any)?.agentId || (session?.user as any)?.agentId;

    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Cari id_agent kalau tidak ada di session
    let id_agent: string | null = agentId || null;
    if (!id_agent) {
      const a = await prisma.agent.findFirst({
        where: { id_pengguna: session.user.id as string },
        select: { id_agent: true },
      });
      id_agent = a?.id_agent ?? null;
    }
    if (!id_agent) {
      return NextResponse.json({ ok: true, items: [] });
    }

    // Window untuk "missed" — hanya tampilkan kekalahan dari 7 hari terakhir
    // supaya list tidak menumpuk dengan trace yang sudah jauh ke belakang.
    const MISSED_WINDOW_DAYS = 7;
    const missedFromDate = new Date(
      Date.now() - MISSED_WINDOW_DAYS * 24 * 3600 * 1000,
    );

    // Jalan paralel: pending (bisa diklaim) + claimed (sudah dimenangkan) + missed
    const [pendingRows, claimedRows, missedRows] = await Promise.all([
      prisma.propertyTitipDistribution.findMany({
        where: {
          id_agent,
          status: "pending",
          titip: {
            status: "pending",
            kedaluwarsa_pada: { gt: new Date() },
          },
        },
        include: {
          titip: {
            select: {
              id_titip: true,
              jenis_properti: true,
              alamat_lengkap: true,
              provinsi: true,
              kota: true,
              kecamatan: true,
              kelurahan: true,
              latitude: true,
              longitude: true,
              estimasi_harga: true,
              pengirim_nama: true,
              pengirim_phone: true,
              status_kepemilikan: true,
              kedaluwarsa_pada: true,
              dibuat_pada: true,
            },
          },
        },
        orderBy: { dibuat_pada: "desc" },
        take: 50,
      }),
      prisma.propertyTitip.findMany({
        where: {
          diklaim_oleh_agent: id_agent,
          status: "terklaim",
        },
        select: {
          id_titip: true,
          jenis_properti: true,
          alamat_lengkap: true,
          kota: true,
          kecamatan: true,
          estimasi_harga: true,
          pengirim_nama: true,
          pengirim_phone: true,
          diklaim_pada: true,
        },
        orderBy: { diklaim_pada: "desc" },
        take: 20,
      }),
      // Missed: titip yang dishare ke agent ini, distribusi pending,
      // parent titip sudah terklaim oleh agent LAIN dalam 7 hari terakhir.
      prisma.propertyTitipDistribution.findMany({
        where: {
          id_agent,
          status: "pending",
          titip: {
            status: "terklaim",
            diklaim_oleh_agent: { not: id_agent },
            diklaim_pada: { gte: missedFromDate },
          },
        },
        include: {
          titip: {
            select: {
              id_titip: true,
              jenis_properti: true,
              alamat_lengkap: true,
              kota: true,
              kecamatan: true,
              diklaim_pada: true,
              agent: {
                select: {
                  id_agent: true,
                  pengguna: { select: { nama_lengkap: true } },
                },
              },
            },
          },
        },
        orderBy: { titip: { diklaim_pada: "desc" } },
        take: 30,
      }),
    ]);

    const items = pendingRows.map((r) => ({
      id_titip: r.titip.id_titip.toString(),
      jenis_properti: r.titip.jenis_properti,
      alamat_lengkap: r.titip.alamat_lengkap,
      provinsi: r.titip.provinsi,
      kota: r.titip.kota,
      kecamatan: r.titip.kecamatan,
      kelurahan: r.titip.kelurahan,
      latitude: r.titip.latitude?.toString() ?? null,
      longitude: r.titip.longitude?.toString() ?? null,
      estimasi_harga: r.titip.estimasi_harga?.toString() ?? null,
      // identitas dimask sampai diterima
      pengirim_nama_masked: maskName(r.titip.pengirim_nama),
      pengirim_phone_masked: maskPhone(r.titip.pengirim_phone),
      status_kepemilikan: r.titip.status_kepemilikan,
      kedaluwarsa_pada: r.titip.kedaluwarsa_pada.toISOString(),
      dibuat_pada: r.titip.dibuat_pada.toISOString(),
    }));

    const claimed_items = claimedRows.map((t) => ({
      id_titip: t.id_titip.toString(),
      jenis_properti: t.jenis_properti,
      alamat_lengkap: t.alamat_lengkap,
      kota: t.kota,
      kecamatan: t.kecamatan,
      estimasi_harga: t.estimasi_harga?.toString() ?? null,
      // identitas full — agent sudah berhak setelah klaim
      pengirim_nama: t.pengirim_nama,
      pengirim_phone: t.pengirim_phone,
      diklaim_pada: t.diklaim_pada?.toISOString() ?? null,
    }));

    // Bentuk nama agent pemenang dalam format hormat: "Jason C."
    function shortName(full: string | null | undefined): string {
      const parts = (full || "").trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return "Agent lain";
      if (parts.length === 1) return parts[0]!;
      return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
    }

    const missed_items = missedRows.map((d) => ({
      id_titip: d.titip.id_titip.toString(),
      jenis_properti: d.titip.jenis_properti,
      alamat_lengkap: d.titip.alamat_lengkap,
      kota: d.titip.kota,
      kecamatan: d.titip.kecamatan,
      by_agent_kode: d.titip.agent?.id_agent ?? null,
      by_agent_nama: shortName(d.titip.agent?.pengguna?.nama_lengkap),
      diklaim_pada: d.titip.diklaim_pada?.toISOString() ?? null,
    }));

    return NextResponse.json({ ok: true, items, claimed_items, missed_items });
  } catch (err) {
    console.error("❌ /api/leads/titip-jual/inbox error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
