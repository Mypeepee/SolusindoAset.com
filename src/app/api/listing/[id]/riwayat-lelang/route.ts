import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAuctionHistory } from "@/lib/auctionHistory";
import { bisaLihatRiwayatLelang } from "@/lib/sessionJabatan";

export const dynamic = "force-dynamic";

/**
 * Riwayat lelang satu aset. Logika pencocokan aset ada di
 * @/lib/auctionHistory (dipakai bersama halaman detail & modul closing).
 * Detail hanya boleh diakses oleh akun Owner dan Agent.
 *
 * Kontrak penting: endpoint ini TIDAK PERNAH memakai array kosong sebagai cara
 * melaporkan kegagalan. Versi lama mengembalikan `{ riwayat: [] }` saat error,
 * sehingga blok riwayat di halaman detail hilang diam-diam dan terlihat
 * "kadang muncul kadang tidak". Sekarang kegagalan dibalas status 5xx + `ok:
 * false` supaya klien bisa retry dan menampilkan status yang jujur.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const privateHeaders = { "Cache-Control": "private, no-store" };

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "LOGIN_DIBUTUHKAN" },
        { status: 401, headers: privateHeaders }
      );
    }

    if (!bisaLihatRiwayatLelang(session.user)) {
      return NextResponse.json(
        { ok: false, error: "AKSES_KHUSUS_OWNER_AGENT" },
        { status: 403, headers: privateHeaders }
      );
    }

    const hasil = await getAuctionHistory(params.id);

    if (!hasil) {
      return NextResponse.json(
        { ok: false, error: "LISTING_TIDAK_DITEMUKAN", riwayat: [] },
        { status: 404, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        riwayat: hasil.items,
        total: hasil.total,
        total_lain: hasil.total_lain,
        total_sebidang: hasil.total_sebidang,
        total_lot_terkait: hasil.total_lot_terkait,
        match: hasil.match,
        alasan_tanpa_riwayat: hasil.alasan_tanpa_riwayat,
      },
      {
        headers: privateHeaders,
      }
    );
  } catch (error) {
    console.error("❌ Gagal mengambil riwayat lelang:", error);
    return NextResponse.json(
      { ok: false, error: "GAGAL_MEMUAT_RIWAYAT", riwayat: [] },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
