import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────
   /api/dashboard/agent/network
   ── Mengembalikan seluruh jaringan referral agent yang sedang login.
      "Jaringan" = semua agen yang `id_upline`-nya menunjuk ke agent
      ini secara rekursif (multi-level downline tree).

   ── Response:
      • stats          — aggregate seluruh jaringan (recursive CTE)
      • downlines      — tree 2 level untuk UI (level 1 + level 2)
   ──────────────────────────────────────────────────────────────────── */

type RawNetworkStats = {
  total_network: bigint;
  total_active: bigint;
  total_closing_network: bigint;
  total_omset_network: bigint;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const agentId = (session.user as { agentId?: string }).agentId;
    if (!agentId) {
      return NextResponse.json(
        { ok: false, message: "Agent ID tidak ditemukan di sesi" },
        { status: 403 },
      );
    }

    // ── Aggregate stats seluruh jaringan via recursive CTE ──
    // Prisma tidak support recursive CTE natively, pakai $queryRaw.
    // CTE mulai dari direct downlines agent ini, lalu rekursif ke bawah.
    const rawStats = await prisma.$queryRaw<RawNetworkStats[]>`
      WITH RECURSIVE network AS (
        SELECT id_agent, status_keanggotaan, jumlah_closing, total_omset
        FROM agent
        WHERE id_upline = ${agentId}
        UNION ALL
        SELECT a.id_agent, a.status_keanggotaan, a.jumlah_closing, a.total_omset
        FROM agent a
        INNER JOIN network n ON a.id_upline = n.id_agent
      )
      SELECT
        COUNT(*)                                                     AS total_network,
        COUNT(*) FILTER (WHERE status_keanggotaan = 'AKTIF')        AS total_active,
        COALESCE(SUM(jumlah_closing), 0)                            AS total_closing_network,
        COALESCE(SUM(total_omset),    0)                            AS total_omset_network
      FROM network
    `;

    const s = rawStats[0] ?? {
      total_network: 0n,
      total_active: 0n,
      total_closing_network: 0n,
      total_omset_network: 0n,
    };

    // ── Direct downlines (level 1) + sub-downlines (level 2) untuk tree UI ──
    const directDownlines = await prisma.agent.findMany({
      where: { id_upline: agentId },
      select: {
        id_agent: true,
        jabatan: true,
        kota_area: true,
        status_keanggotaan: true,
        tanggal_gabung: true,
        jumlah_closing: true,
        total_omset: true,
        poin: true,
        foto_profil_url: true,
        pengguna: { select: { nama_lengkap: true, nomor_telepon: true } },
        _count: { select: { downlines: true } },
        downlines: {
          select: {
            id_agent: true,
            jabatan: true,
            kota_area: true,
            status_keanggotaan: true,
            tanggal_gabung: true,
            jumlah_closing: true,
            total_omset: true,
            poin: true,
            foto_profil_url: true,
            pengguna: { select: { nama_lengkap: true } },
            _count: { select: { downlines: true } },
          },
          orderBy: [{ jumlah_closing: "desc" }, { tanggal_gabung: "asc" }],
          take: 5,
        },
      },
      orderBy: [{ jumlah_closing: "desc" }, { tanggal_gabung: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      agent_id: agentId,
      stats: {
        total_direct: directDownlines.length,
        total_network: Number(s.total_network),
        total_active: Number(s.total_active),
        total_closing_network: Number(s.total_closing_network),
        total_omset_network: Number(s.total_omset_network),
      },
      downlines: directDownlines.map((d) => ({
        id_agent: d.id_agent,
        nama_lengkap: d.pengguna.nama_lengkap,
        nomor_telepon: d.pengguna.nomor_telepon,
        foto_profil_url: d.foto_profil_url,
        jabatan: d.jabatan,
        kota_area: d.kota_area,
        status_keanggotaan: d.status_keanggotaan,
        tanggal_gabung: d.tanggal_gabung?.toISOString() ?? null,
        jumlah_closing: d.jumlah_closing,
        total_omset: Number(d.total_omset ?? 0),
        poin: d.poin,
        jumlah_downline: d._count.downlines,
        downlines: d.downlines.map((dd) => ({
          id_agent: dd.id_agent,
          nama_lengkap: dd.pengguna.nama_lengkap,
          foto_profil_url: dd.foto_profil_url,
          jabatan: dd.jabatan,
          kota_area: dd.kota_area,
          status_keanggotaan: dd.status_keanggotaan,
          tanggal_gabung: dd.tanggal_gabung?.toISOString() ?? null,
          jumlah_closing: dd.jumlah_closing,
          total_omset: Number(dd.total_omset ?? 0),
          poin: dd.poin,
          jumlah_downline: dd._count.downlines,
        })),
      })),
    });
  } catch (err) {
    console.error("[network]", err);
    return NextResponse.json({ ok: false, message: "Gagal memuat jaringan" }, { status: 500 });
  }
}
