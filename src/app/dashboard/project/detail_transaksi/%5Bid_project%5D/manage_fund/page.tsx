import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import FundHeader from "./components/FundHeader";
import WalletGrid from "./components/WalletGrid";
import QuickEntryForm from "./components/QuickEntryForm";
import CashflowTable from "./components/CashflowTable";

import type { DbCashflow, DbProject } from "./components/types";
import {
  getDashboardStats,
  getLedgerRows,
  getVisibleWalletOptions,
  getWalletSummaries,
} from "./components/utils";

export default async function ManageFundPage({
  params,
}: {
  params: { id_project: string };
}) {
  const [projectRows, cashflowRows] = await Promise.all([
    prisma.$queryRaw<DbProject[]>`
      SELECT
        id_project,
        nama_project,
        status::text AS status,
        target_pendanaan,
        total_pendanaan,
        total_biaya_akuisisi,
        nilai_limit_lelang,
        spare_bidding,
        biaya_balik_nama,
        biaya_eksekusi,
        biaya_renov,
        dana_cadangan,
        estimasi_harga_jual,
        estimasi_profit_bersih,
        dibuat_tanggal
      FROM public.project
      WHERE id_project = ${params.id_project}
      LIMIT 1
    `,
    prisma.$queryRaw<DbCashflow[]>`
      SELECT
        id_project_arus_kas,
        id_project,
        tanggal_transaksi,
        jenis_transaksi::text AS jenis_transaksi,
        kategori_transaksi::text AS kategori_transaksi,
        judul_transaksi,
        pihak_terkait,
        nomor_referensi,
        metode_pembayaran::text AS metode_pembayaran,
        nominal,
        status_transaksi::text AS status_transaksi,
        catatan,
        dibuat_tanggal,
        diupdate_tanggal
      FROM public.project_arus_kas
      WHERE id_project = ${params.id_project}
      ORDER BY tanggal_transaksi DESC, dibuat_tanggal DESC
    `,
  ]);

  const project = projectRows[0];

  if (!project) {
    notFound();
  }

  const stats = getDashboardStats(project, cashflowRows);
  const wallets = getWalletSummaries(project, cashflowRows);
  const walletOptions = getVisibleWalletOptions(project);
  const ledgerRows = getLedgerRows(project, cashflowRows);

  return (
    <div className="space-y-6">
      <FundHeader project={project} stats={stats} />

      <WalletGrid wallets={wallets} />

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <QuickEntryForm
          idProject={project.id_project}
          walletOptions={walletOptions}
        />

        <CashflowTable rows={ledgerRows} />
      </div>
    </div>
  );
}