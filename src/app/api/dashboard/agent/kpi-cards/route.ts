import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

    // tanggal_dibuat di acara adalah timestamptz, tetap pakai UTC
    const awalBulanIniUtc = new Date(Date.UTC(year, month, 1));

    const [
      pendapatanAllTime,
      totalTransaksi,
      totalListing,
      leadBaru,
      pendapatanBulanIni,
      transaksiBulanIni,
      pendapatanBulanLalu,
      transaksiBulanLalu,
    ] = await Promise.all([

      // Total pendapatan all-time
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: { id_agent: agentId },
      }),

      // Total transaksi all-time
      prisma.transaksi.count({
        where: { id_agent: agentId },
      }),

      // Total listing aktif
      prisma.listing.count({
        where: {
          id_agent: agentId,
          status_tayang: { not: "TARIK_LISTING" },
        },
      }),

      // Lead baru bulan ini
      prisma.acara.count({
        where: {
          id_agent: agentId,
          tipe_acara: { in: ["FOLLOW_UP", "BUYER_MEETING", "SITE_VISIT"] },
          tanggal_dibuat: { gte: awalBulanIniUtc },
        },
      }),

      // Pendapatan bulan ini — filter via tanggal_transaksi (DATE kolom, bukan timestamptz)
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: {
          id_agent: agentId,
          transaksi: {
            tanggal_transaksi: { gte: awalBulanIni },
          },
        },
      }),

      // Jumlah transaksi bulan ini — tanggal_transaksi = tanggal closing aktual
      prisma.transaksi.count({
        where: {
          id_agent: agentId,
          tanggal_transaksi: { gte: awalBulanIni },
        },
      }),

      // Pendapatan bulan lalu
      prisma.detailTransaksi.aggregate({
        _sum: { pendapatan: true },
        where: {
          id_agent: agentId,
          transaksi: {
            tanggal_transaksi: {
              gte: awalBulanLalu,
              lt:  awalBulanIni,
            },
          },
        },
      }),

      // Jumlah transaksi bulan lalu
      prisma.transaksi.count({
        where: {
          id_agent: agentId,
          tanggal_transaksi: {
            gte: awalBulanLalu,
            lt:  awalBulanIni,
          },
        },
      }),
    ]);

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

    const totalPendapatan     = Number(pendapatanAllTime._sum.pendapatan   ?? 0);
    const pendapatanCurMonth  = Number(pendapatanBulanIni._sum.pendapatan  ?? 0);
    const pendapatanPrevMonth = Number(pendapatanBulanLalu._sum.pendapatan ?? 0);

    return NextResponse.json({
      ok: true,
      data: {
        totalPendapatan,
        totalTransaksi,
        totalListing,
        leadBaru,
        pendapatanDelta:       pct(pendapatanCurMonth, pendapatanPrevMonth),
        transaksiBulanIni,
        transaksiBulanLalu,
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
