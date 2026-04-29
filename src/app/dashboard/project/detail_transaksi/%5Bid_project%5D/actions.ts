"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { WalletKey } from "./types";

type CreateProjectCashflowInput = {
  idProject: string;
  walletKey: WalletKey;
  tanggalTransaksi: string;
  jenisTransaksi: string;
  kategoriTransaksi: string;
  judulTransaksi: string;
  nominal: number;
  pihakTerkait?: string;
  nomorReferensi?: string;
  metodePembayaran?: string;
  catatan?: string;
};

export async function createProjectCashflow(input: CreateProjectCashflowInput) {
  const judul = input.judulTransaksi.trim();
  const nominal = Number(input.nominal ?? 0);

  if (!input.idProject) {
    throw new Error("Project tidak valid.");
  }

  if (!input.tanggalTransaksi) {
    throw new Error("Tanggal transaksi wajib diisi.");
  }

  if (!input.jenisTransaksi) {
    throw new Error("Jenis transaksi wajib dipilih.");
  }

  if (!input.kategoriTransaksi) {
    throw new Error("Kategori transaksi wajib dipilih.");
  }

  if (!judul) {
    throw new Error("Judul transaksi wajib diisi.");
  }

  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error("Nominal harus lebih besar dari 0.");
  }

  await prisma.$executeRaw`
    INSERT INTO public.project_arus_kas (
      id_project,
      wallet_key,
      tanggal_transaksi,
      jenis_transaksi,
      kategori_transaksi,
      judul_transaksi,
      pihak_terkait,
      nomor_referensi,
      metode_pembayaran,
      nominal,
      status_transaksi,
      catatan
    ) VALUES (
      ${input.idProject},
      ${input.walletKey}::public.project_wallet_enum,
      ${input.tanggalTransaksi}::date,
      ${input.jenisTransaksi}::public.jenis_arus_kas_enum,
      ${input.kategoriTransaksi}::public.kategori_arus_kas_enum,
      ${judul},
      ${input.pihakTerkait?.trim() || null},
      ${input.nomorReferensi?.trim() || null},
      ${input.metodePembayaran?.trim() || null}::public.metode_pembayaran_arus_kas_enum,
      ${nominal},
      'tercatat'::public.status_arus_kas_enum,
      ${input.catatan?.trim() || null}
    )
  `;

  revalidatePath(`/dashboard/project/detail_transaksi/${input.idProject}`);
  revalidatePath(`/dashboard/project/detail_transaksi/${input.idProject}/arus_kas`);
}