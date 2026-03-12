// src/lib/auctionHistory.ts
import { prisma } from "@/lib/prisma";

export type AuctionHistoryRow = {
  id_property: bigint;
  judul: string;
  kota: string;
  tanggal_lelang: Date | null;
  tanggal_dibuat: Date | null;
  nilai_limit_lelang: any; // Prisma Decimal
  uang_jaminan: any; // Prisma Decimal
  link: string | null;
  gambar: string | null;
  id_agent: string;
  agent_nama: string | null;
};

export async function getAuctionHistoryForListing(id_property: bigint) {
  // 1) Ambil current
  const current = await prisma.listing.findUnique({
    where: { id_property },
    select: {
      id_property: true,
      jenis_transaksi: true,
      legalitas: true,
      nomor_legalitas: true,
      luas_tanah: true,
      kota: true,
    },
  });

  if (!current) throw new Error("Listing not found");

  // Kalau bukan lelang, ga perlu history
  if (current.jenis_transaksi !== "LELANG") {
    return { current, rows: [] as AuctionHistoryRow[] };
  }

  // 2) Raw SQL biar bisa normalisasi regexp_replace kayak Laravel kamu
  //    - match aset "sama" berdasarkan nomor_legalitas (dinormalisasi), kota, luas_tanah
  //    - urut berdasarkan tanggal_lelang, fallback tanggal_dibuat
  const rows = await prisma.$queryRaw<AuctionHistoryRow[]>`
    WITH base AS (
      SELECT
        l.id_property,
        l.judul,
        l.kota,
        l.tanggal_lelang,
        l.tanggal_dibuat,
        l.nilai_limit_lelang,
        l.uang_jaminan,
        l.link,
        l.gambar,
        l.id_agent,
        a.nama AS agent_nama,
        regexp_replace(lower(coalesce(l.nomor_legalitas, '')), '[^a-z0-9]', '', 'g') AS legal_no_norm,
        regexp_replace(lower(coalesce(${
          current.nomor_legalitas ?? ""
        }, '')), '[^a-z0-9]', '', 'g') AS current_legal_no_norm
      FROM listing l
      LEFT JOIN agent a ON a.id_agent = l.id_agent
    )
    SELECT
      id_property,
      judul,
      kota,
      tanggal_lelang,
      tanggal_dibuat,
      nilai_limit_lelang,
      uang_jaminan,
      link,
      gambar,
      id_agent,
      agent_nama
    FROM base
    WHERE 1=1
      AND id_property <> ${id_property}
      AND (
        (current_legal_no_norm <> '' AND legal_no_norm = current_legal_no_norm)
        OR (current_legal_no_norm = '' AND ${current.kota} = kota)
      )
      AND (${current.luas_tanah} IS NULL OR ${current.luas_tanah} = 0 OR ${current.luas_tanah} = (SELECT luas_tanah FROM listing WHERE id_property = base.id_property))
      AND lower(trim(kota)) = lower(trim(${current.kota}))
    ORDER BY COALESCE(tanggal_lelang, tanggal_dibuat) ASC
  `;

  // 3) Gabungkan current + history, lalu sort lagi
  //    (biar “Lelang ke-1..n” termasuk current)
  const currentFull = await prisma.listing.findUnique({
    where: { id_property },
    select: {
      id_property: true,
      judul: true,
      kota: true,
      tanggal_lelang: true,
      tanggal_dibuat: true,
      nilai_limit_lelang: true,
      uang_jaminan: true,
      link: true,
      gambar: true,
      id_agent: true,
      agent: { select: { nama: true } },
    },
  });

  const merged: AuctionHistoryRow[] = [
    {
      id_property: currentFull!.id_property,
      judul: currentFull!.judul,
      kota: currentFull!.kota,
      tanggal_lelang: currentFull!.tanggal_lelang,
      tanggal_dibuat: currentFull!.tanggal_dibuat,
      nilai_limit_lelang: currentFull!.nilai_limit_lelang,
      uang_jaminan: currentFull!.uang_jaminan,
      link: currentFull!.link,
      gambar: currentFull!.gambar,
      id_agent: currentFull!.id_agent,
      agent_nama: currentFull!.agent?.nama ?? null,
    },
    ...rows,
  ]
    .sort((a, b) => {
      const da = (a.tanggal_lelang ?? a.tanggal_dibuat)?.getTime() ?? 0;
      const db = (b.tanggal_lelang ?? b.tanggal_dibuat)?.getTime() ?? 0;
      return da - db;
    });

  return { current, rows: merged };
}