import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  __projectWalletPool?: Pool;
};

const pool =
  globalForPg.__projectWalletPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (!globalForPg.__projectWalletPool) {
  globalForPg.__projectWalletPool = pool;
}

type WalletSummaryRow = {
  total_dana: string | number | null;
  total_lunas: string | number | null;
  total_pending: string | number | null;
  project_aktif: string | number | null;
  jumlah_property_didanai: string | number | null;
  pending_payment_count: string | number | null;
  pending_project_count: string | number | null;
};

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export async function GET(request: NextRequest) {
  const idAgent = request.nextUrl.searchParams.get("id_agent")?.trim();

  if (!idAgent) {
    return NextResponse.json(
      {
        success: false,
        message: "id_agent wajib dikirim.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query<WalletSummaryRow>(
      `
        SELECT
          COALESCE(SUM(pi.nominal_komitmen), 0) AS total_dana,
          COALESCE(
            SUM(
              CASE
                WHEN pi.status = 'lunas' THEN pi.nominal_komitmen
                ELSE 0
              END
            ),
            0
          ) AS total_lunas,
          COALESCE(
            SUM(
              CASE
                WHEN pi.status = 'menunggu_pembayaran' THEN pi.nominal_komitmen
                ELSE 0
              END
            ),
            0
          ) AS total_pending,
          COUNT(DISTINCT pi.id_project)::int AS project_aktif,
          COUNT(DISTINCT pi.id_project)::int AS jumlah_property_didanai,
          COUNT(*) FILTER (
            WHERE pi.status = 'menunggu_pembayaran'
          )::int AS pending_payment_count,
          COUNT(DISTINCT CASE
            WHEN pi.status = 'menunggu_pembayaran' THEN pi.id_project
            ELSE NULL
          END)::int AS pending_project_count
        FROM public.project_investor pi
        INNER JOIN public.project p
          ON p.id_project = pi.id_project
        WHERE pi.id_agent = $1
      `,
      [idAgent]
    );

    const row = result.rows[0] ?? {
      total_dana: 0,
      total_lunas: 0,
      total_pending: 0,
      project_aktif: 0,
      jumlah_property_didanai: 0,
      pending_payment_count: 0,
      pending_project_count: 0,
    };

    const totalDana = toNumber(row.total_dana);
    const totalDanaLunas = toNumber(row.total_lunas);
    const totalDanaPending = toNumber(row.total_pending);
    const projectAktif = toNumber(row.project_aktif);
    const jumlahPropertyDidanai = toNumber(row.jumlah_property_didanai);
    const pendingPaymentCount = toNumber(row.pending_payment_count);
    const pendingProjectCount = toNumber(row.pending_project_count);

    return NextResponse.json({
      success: true,
      data: {
        idAgent,
        totalDana,
        totalDanaLunas,
        totalDanaPending,
        projectAktif,
        jumlahPropertyDidanai,
        pendingPaymentCount,
        pendingProjectCount,
        hasPendingPayment: pendingPaymentCount > 0,
      },
    });
  } catch (error) {
    console.error("[GET_PROJECT_WALLET_SUMMARY_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil ringkasan wallet investor.",
      },
      { status: 500 }
    );
  }
}