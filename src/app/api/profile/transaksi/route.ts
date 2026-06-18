// app/api/profile/transaksi/route.ts
// GET /api/profile/transaksi
// Mengembalikan riwayat transaksi (mou) milik klien yang sedang login.
// Dipakai oleh tab "Riwayat Transaksi" di halaman profile.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FINAL_TRANSAKSI_STATUS = [
  "selesai",
  "kuitansi_selesai",
  "risalah_lelang_selesai",
  "balik_nama_selesai",
  "serah_terima_kunci",
];

const CANCELLED_TRANSAKSI_STATUS = ["kalah", "batal"];

export type TransaksiStatus = "proses" | "active" | "completed" | "cancelled";

function resolveStatus(
  mouStatus: string,
  transaksiStatus: string | null | undefined,
): TransaksiStatus {
  if (mouStatus === "kalah" || mouStatus === "batal") return "cancelled";

  if (mouStatus === "proses") return "proses";

  // mouStatus === "closing"
  if (transaksiStatus) {
    if (CANCELLED_TRANSAKSI_STATUS.includes(transaksiStatus)) return "cancelled";
    if (FINAL_TRANSAKSI_STATUS.includes(transaksiStatus)) return "completed";
    return "active";
  }

  return "active";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | null | undefined;
    const agentId = (session?.user as any)?.agentId as string | null | undefined;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Silakan login untuk melihat riwayat transaksi." },
        { status: 401 },
      );
    }

    const mouList = await prisma.mou.findMany({
      where: agentId
        ? { OR: [{ id_klien: userId }, { id_agent: agentId }] }
        : { id_klien: userId },
      include: {
        listing: {
          select: {
            judul: true,
            slug: true,
            gambar: true,
            kota: true,
            kecamatan: true,
            jenis_transaksi: true,
          },
        },
        agent: {
          select: {
            id_agent: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
        transaksi: {
          select: { status_transaksi: true },
        },
      },
      orderBy: { dibuat_pada: "desc" },
    });

    const data = mouList.map((mou) => {
      const fotoList = (mou.listing?.gambar ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      return {
        id_transaksi: mou.id_transaksi ?? `MOU-${mou.id.toString()}`,
        judul: mou.listing?.judul ?? "Properti",
        slug: mou.listing?.slug ?? null,
        gambar: fotoList[0] ?? null,
        lokasi: [mou.listing?.kecamatan, mou.listing?.kota]
          .filter(Boolean)
          .join(", "),
        jenis_transaksi: mou.jenis_transaksi,
        tipe_komisi: mou.tipe_komisi,
        tanggal_transaksi: mou.tanggal_transaksi,
        harga_deal: mou.harga_deal ? mou.harga_deal.toString() : null,
        agent_nama: mou.agent?.pengguna?.nama_lengkap ?? "-",
        status: resolveStatus(mou.status, mou.transaksi?.status_transaksi),
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/profile/transaksi]", error);
    return NextResponse.json(
      { ok: false, error: "Gagal memuat riwayat transaksi." },
      { status: 500 },
    );
  }
}
