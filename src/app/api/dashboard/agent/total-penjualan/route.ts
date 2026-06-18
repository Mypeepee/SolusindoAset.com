import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────
   /api/dashboard/agent/total-penjualan
   ── Sumber kebenaran: detail_transaksi (pendapatan agent per role di
      tiap closing), di-join ke transaksi untuk dapat tanggal_transaksi.
   ── Output:
      • available_years   — daftar tahun (DESC) yang punya minimal 1
                            penjualan untuk agent ini. Dipakai sebagai
                            opsi YearPicker. Kalau kosong, frontend
                            tampil empty state.
      • monthly_by_year   — { "2025": [Jan, Feb, ..., Des] } dalam satuan
                            JUTA Rupiah (Rp / 1.000.000) — selaras dengan
                            kontrak ANNUAL_SALES_BY_YEAR di komponen
                            dashboard, jadi formatter juta yang sudah
                            ada (formatJutaCurrency, formatJutaShort) bisa
                            langsung dipakai tanpa konversi tambahan.
      • current_year      — tahun kalender saat ini (server-side), supaya
                            frontend tidak bias ke timezone client.
   ── Status filter:
      Transaksi dengan status `batal`, `kalah`, dan `mediasi_gagal`
      di-eksklusi karena tidak menghasilkan pendapatan realized. Status
      lainnya (closing, kuitansi_selesai, balik_nama_selesai, selesai,
      dll.) dianggap sah sebagai "penjualan" yang sudah ke-track di
      detail_transaksi. Kalau bisnis butuh aturan lain (mis. hanya
      `selesai` yang dihitung), tinggal ubah `EXCLUDED_STATUSES`.
   ──────────────────────────────────────────────────────────────────── */

const EXCLUDED_STATUSES = ["batal", "kalah", "mediasi_gagal"] as const;
const JUTA = 1_000_000;

type MonthlyByYear = Record<string, number[]>;

function emptyYear(): number[] {
  return Array(12).fill(0);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const agentId = (session.user as { agentId?: string }).agentId;
    if (!agentId) {
      return NextResponse.json(
        { ok: false, message: "Agent ID tidak ditemukan di sesi" },
        { status: 403 },
      );
    }

    // Ambil semua baris detail_transaksi agent ini, hanya kolom yang
    // dibutuhkan untuk agregasi. Tanggal & status di-include dari
    // relasi transaksi. Sengaja tidak pakai groupBy Prisma karena kita
    // butuh aggregate berdasarkan extracted month/year dari tanggal —
    // hal yang lebih bersih dilakukan di JS daripada Prisma raw SQL
    // (apalagi cross-db).
    const rows = await prisma.detailTransaksi.findMany({
      where: {
        id_agent: agentId,
        transaksi: {
          status_transaksi: {
            notIn: [...EXCLUDED_STATUSES],
          },
        },
      },
      select: {
        pendapatan: true,
        transaksi: {
          select: { tanggal_transaksi: true },
        },
      },
    });

    // Bucket: year → [12 bulan, satuan IDR mentah dulu, dikonversi ke
    // juta di akhir supaya akumulasi BigInt → Number tidak lossy untuk
    // angka < 9 quadrillion (Number.MAX_SAFE_INTEGER ≈ 9.0e15).
    const byYear: Record<string, number[]> = {};
    for (const r of rows) {
      const d = r.transaksi.tanggal_transaksi;
      // tanggal_transaksi tipenya DateTime @db.Date — Prisma return Date.
      // getFullYear/getMonth pakai locale local server. Untuk konsistensi
      // gunakan UTC karena kolom Date di Postgres tidak punya timezone.
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth(); // 0–11
      const key = String(year);
      if (!byYear[key]) byYear[key] = emptyYear();
      byYear[key][month] += Number(r.pendapatan);
    }

    // Konversi tiap nilai ke juta dengan rounding ke 0 desimal supaya
    // chart tidak punya angka aneh (misal Rp 1.234.567 → 1 jt).
    const monthly_by_year: MonthlyByYear = {};
    for (const [year, arr] of Object.entries(byYear)) {
      monthly_by_year[year] = arr.map((v) => Math.round(v / JUTA));
    }

    // Daftar tahun yang punya minimal 1 transaksi (sum bulan > 0). Sort
    // descending biar tahun terbaru di atas dropdown.
    const available_years = Object.entries(monthly_by_year)
      .filter(([, arr]) => arr.some((v) => v > 0))
      .map(([y]) => Number(y))
      .sort((a, b) => b - a);

    const current_year = new Date().getUTCFullYear();

    return NextResponse.json({
      ok: true,
      current_year,
      available_years,
      monthly_by_year,
    });
  } catch (e) {
    console.error("[total-penjualan]", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
