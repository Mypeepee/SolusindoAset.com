import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_req: Request, { params }: RouteContext) {
  const listingId = String(params?.id ?? "").trim();

  if (!listingId) {
    return NextResponse.json(
      {
        success: false,
        message: "Parameter id listing tidak ditemukan.",
        data: [],
      },
      { status: 400 }
    );
  }

  try {
    const query = `
      SELECT
        a.id_agent,
        p.nama_lengkap AS nama,
        a.nama_kantor AS kantor
      FROM public.agent a
      INNER JOIN public.pengguna p
        ON p.id_pengguna = a.id_pengguna
      ORDER BY p.nama_lengkap ASC, a.id_agent ASC
    `;

    const result = await pool.query(query);

    const data = result.rows.map((row) => ({
      id_agent: String(row.id_agent ?? "").trim(),
      nama: String(row.nama ?? "").trim(),
      kantor: String(row.kantor ?? "").trim(),
    }));

    return NextResponse.json({
      success: true,
      message: "Daftar agent berhasil diambil.",
      listing_id: listingId,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("[DETAIL_PEMBAGIAN_GET_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil daftar agent.",
        data: [],
      },
      { status: 500 }
    );
  }
}