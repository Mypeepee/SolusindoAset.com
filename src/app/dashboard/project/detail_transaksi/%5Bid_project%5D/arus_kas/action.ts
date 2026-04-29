"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type CreateCashflowInput = {
  id_project: string;
  wallet_key: "utama" | "dokumen" | "eksekusi" | "renovasi" | "cadangan";
  tanggal_transaksi: string;
  jenis_transaksi: "masuk" | "keluar";
  kategori_transaksi: string;
  judul_transaksi: string;
  nominal: number;
  pihak_terkait?: string;
  nomor_referensi?: string;
  metode_pembayaran?: string;
  catatan?: string;
};

export async function createProjectCashflow(input: CreateCashflowInput) {
  const tanggal =
    input.tanggal_transaksi &&
    !Number.isNaN(new Date(input.tanggal_transaksi).getTime())
      ? new Date(input.tanggal_transaksi)
      : new Date();

  const nominal = Number(input.nominal ?? 0);

  if (!input.id_project) {
    throw new Error("Project tidak valid.");
  }

  if (!input.judul_transaksi?.trim()) {
    throw new Error("Judul transaksi wajib diisi.");
  }

  if (!input.kategori_transaksi?.trim()) {
    throw new Error("Kategori transaksi wajib diisi.");
  }

  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error("Nominal harus lebih besar dari 0.");
  }

  const catatanGabungan = [
    input.catatan?.trim() || "",
    `[wallet:${input.wallet_key}]`,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  await prisma.$executeRaw`
    INSERT INTO public.project_arus_kas (
      id_project,
      tanggal_transaksi,
      jenis_transaksi,
      kategori_transaksi,
      judul_transaksi,
      pihak_terkait,
      nomor_referensi,
      metode_pembayaran,
      nominal,
      catatan
    )
    VALUES (
      ${input.id_project},
      ${tanggal},
      ${input.jenis_transaksi}::public.jenis_arus_kas_enum,
      ${input.kategori_transaksi}::public.kategori_arus_kas_enum,
      ${input.judul_transaksi.trim()},
      ${input.pihak_terkait?.trim() || null},
      ${input.nomor_referensi?.trim() || null},
      ${
        input.metode_pembayaran?.trim()
          ? prisma.$queryRaw`${input.metode_pembayaran}::public.metode_pembayaran_arus_kas_enum`
          : null
      },
      ${nominal},
      ${catatanGabungan || null}
    )
  `;

  revalidatePath(
    `/dashboard/project/detail_transaksi/${input.id_project}/arus_kas`
  );

  return { success: true };
}