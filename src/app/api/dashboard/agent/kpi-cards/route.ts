import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, message: "Agent ID tidak ditemukan" }, { status: 403 });
    }

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // tanggal_transaksi adalah kolom DATE (bukan timestamptz),
    // jadi cukup pakai Date biasa — tidak ada masalah timezone.
    const awalBulanIni  = new Date(year, month, 1);
    const awalBulanLalu = new Date(year, month - 1, 1);
    // upper bound bulan lalu = eksklusif awal bulan ini

    // Year boundaries untuk YoY (year-over-year) comparison
    const awalTahunIni  = new Date(year,     0, 1);
    const awalTahunDpn  = new Date(year + 1, 0, 1);
    const awalTahunLalu = new Date(year - 1, 0, 1);

    // tanggal_dibuat di acara adalah timestamptz, tetap pakai UTC
    const awalBulanIniUtc = new Date(Date.UTC(year, month, 1));

    const [
      pendapatanAllTime,
      totalTransaksi,
      totalListing,
      leadsFromTable,
      leadsBulanIniFromTable,
      leadsBulanLaluFromTable,
      pendapatanTahunIniAgg,
      pendapatanTahunLaluAgg,
      transaksiBulanIni,
      transaksiBulanLalu,
      transaksiTahunIni,
      titipClaimedAllTime,
      titipClaimedBulanIni,
      titipClaimedBulanLalu,
    ] = await Promise.all([

      // Total pendapatan all-time
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: { id_agent: agentId },
      }),

      // Total transaksi all-time
      prisma.transaksi.count({
        where: { mou: { id_agent: agentId } },
      }),

      // Total listing aktif
      prisma.listing.count({
        where: {
          id_agent: agentId,
          status_tayang: { not: "TARIK_LISTING" },
        },
      }),

      // Total leads (all-time) — sumber tabel `leads`, filter id_agent
      prisma.lead.count({
        where: { id_agent: agentId },
      }),

      // Leads yang aktivitasnya update bulan ini — pakai kolom updated_at
      prisma.lead.count({
        where: {
          id_agent: agentId,
          updated_at: { gte: awalBulanIniUtc },
        },
      }),

      // Leads yang aktivitasnya update bulan lalu
      prisma.lead.count({
        where: {
          id_agent: agentId,
          updated_at: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt:  awalBulanIniUtc,
          },
        },
      }),

      // Pendapatan tahun ini (1 Jan tahun ini → 1 Jan tahun depan, eksklusif)
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: {
          id_agent: agentId,
          transaksi: {
            tanggal_transaksi: { gte: awalTahunIni, lt: awalTahunDpn },
          },
        },
      }),

      // Pendapatan tahun lalu (1 Jan tahun lalu → 1 Jan tahun ini, eksklusif)
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: {
          id_agent: agentId,
          transaksi: {
            tanggal_transaksi: { gte: awalTahunLalu, lt: awalTahunIni },
          },
        },
      }),

      // Jumlah transaksi bulan ini — tanggal_transaksi = tanggal closing aktual
      prisma.transaksi.count({
        where: {
          mou: { id_agent: agentId },
          tanggal_transaksi: { gte: awalBulanIni },
        },
      }),

      // Jumlah transaksi bulan lalu
      prisma.transaksi.count({
        where: {
          mou: { id_agent: agentId },
          tanggal_transaksi: {
            gte: awalBulanLalu,
            lt:  awalBulanIni,
          },
        },
      }),

      // Jumlah transaksi sepanjang tahun ini (YTD) — konteks achievement,
      // bukan untuk pembanding (cegah demotivasi early-year)
      prisma.transaksi.count({
        where: {
          mou: { id_agent: agentId },
          tanggal_transaksi: {
            gte: awalTahunIni,
            lt:  awalTahunDpn,
          },
        },
      }),

      // Titip jual yang sudah diterima agent ini = lead aktif juga.
      // Sumber lead bukan cuma WA — titip jual yang diklaim ikut dihitung.
      prisma.propertyTitip.count({
        where: { diklaim_oleh_agent: agentId },
      }),
      prisma.propertyTitip.count({
        where: {
          diklaim_oleh_agent: agentId,
          diklaim_pada: { gte: awalBulanIniUtc },
        },
      }),
      prisma.propertyTitip.count({
        where: {
          diklaim_oleh_agent: agentId,
          diklaim_pada: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt:  awalBulanIniUtc,
          },
        },
      }),
    ]);

    const totalLeads   = leadsFromTable     + titipClaimedAllTime;
    const leadBulanIni = leadsBulanIniFromTable  + titipClaimedBulanIni;
    const leadBulanLalu = leadsBulanLaluFromTable + titipClaimedBulanLalu;

    /**
     * Hitung delta %:
     * - cur > 0, prev = 0 → null (pencapaian pertama, tidak bisa dibandingkan)
     * - cur = 0, prev > 0 → -100
     * - keduanya 0        → null
     * - normal            → rumus biasa
     */
    function pct(cur: number, prev: number): number | null {
      if (prev === 0) return null;
      return +((cur - prev) / prev * 100).toFixed(1);
    }

    const totalPendapatan     = Number(pendapatanAllTime._sum.pendapatan      ?? 0);
    const pendapatanTahunIni  = Number(pendapatanTahunIniAgg._sum.pendapatan  ?? 0);
    const pendapatanTahunLalu = Number(pendapatanTahunLaluAgg._sum.pendapatan ?? 0);

    return NextResponse.json({
      ok: true,
      data: {
        totalPendapatan,
        totalTransaksi,
        totalListing,
        totalLeads,
        // YoY (year-over-year) — tahun ini vs tahun lalu, sumber detail_transaksi
        pendapatanDelta:    pct(pendapatanTahunIni, pendapatanTahunLalu),
        pendapatanTahunIni,
        pendapatanTahunLalu,
        // Monthly — Transaksi tile
        transaksiBulanIni,
        transaksiBulanLalu,
        // YTD count — achievement context (tidak dipakai untuk perbandingan)
        transaksiTahunIni,
        // Monthly — Leads tile (bucket pakai updated_at)
        leadBulanIni,
        leadBulanLalu,
        leadDelta: pct(leadBulanIni, leadBulanLalu),
      },
    });
  } catch (e: any) {
    console.error("[kpi-cards]", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
