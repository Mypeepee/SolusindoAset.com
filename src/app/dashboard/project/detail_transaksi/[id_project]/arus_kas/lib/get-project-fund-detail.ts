import { prisma } from "@/lib/prisma";
import type { DbCashflow, DbProject, ManageFundData, WalletKey } from "../types";

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractWalletKey(catatan?: string | null): WalletKey {
  const text = String(catatan ?? "");
  const match = text.match(/\[wallet:(utama|dokumen|eksekusi|renovasi|cadangan)\]/i);

  if (!match) return "utama";

  const key = match[1]?.toLowerCase();

  if (
    key === "utama" ||
    key === "dokumen" ||
    key === "eksekusi" ||
    key === "renovasi" ||
    key === "cadangan"
  ) {
    return key;
  }

  return "utama";
}

function cleanCatatan(catatan?: string | null) {
  if (!catatan) return "";
  return catatan
    .replace(/\[wallet:(utama|dokumen|eksekusi|renovasi|cadangan)\]/gi, "")
    .trim();
}

export async function getProjectFundDetail(
  idProject: string
): Promise<ManageFundData | null> {
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
      WHERE id_project = ${idProject}
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
      WHERE id_project = ${idProject}
      ORDER BY tanggal_transaksi DESC, dibuat_tanggal DESC
    `,
  ]);

  const project = projectRows[0];

  if (!project) {
    return null;
  }

  const transactions = cashflowRows.map((row) => ({
    ...row,
    wallet_key: extractWalletKey(row.catatan),
    catatan: cleanCatatan(row.catatan),
    nominal: toNumber(row.nominal),
  }));

  const budgetUtama =
    toNumber(project.nilai_limit_lelang) + toNumber(project.spare_bidding);
  const budgetDokumen = toNumber(project.biaya_balik_nama);
  const budgetEksekusi = toNumber(project.biaya_eksekusi);
  const budgetRenovasi = toNumber(project.biaya_renov);
  const budgetCadangan = Math.max(
    toNumber(project.dana_cadangan) ||
      toNumber(project.target_pendanaan) - toNumber(project.total_biaya_akuisisi),
    0
  );

  const walletBase = [
    {
      walletKey: "utama" as WalletKey,
      title: "Dompet Utama",
      budget: budgetUtama,
      visible: true,
    },
    {
      walletKey: "dokumen" as WalletKey,
      title: "Pengurusan Dokumen",
      budget: budgetDokumen,
      visible: true,
    },
    {
      walletKey: "eksekusi" as WalletKey,
      title: "Eksekusi Pengosongan",
      budget: budgetEksekusi,
      visible: true,
    },
    {
      walletKey: "renovasi" as WalletKey,
      title: "Renovasi",
      budget: budgetRenovasi,
      visible: true,
    },
    {
      walletKey: "cadangan" as WalletKey,
      title: "Dana Cadangan",
      budget: budgetCadangan,
      visible: budgetCadangan > 0,
    },
  ].filter((item) => item.visible);

  const wallets = walletBase.map((wallet) => {
    const rows = transactions.filter(
      (item) => item.wallet_key === wallet.walletKey
    );

    const income = rows
      .filter((item) => item.jenis_transaksi === "masuk")
      .reduce((sum, item) => sum + toNumber(item.nominal), 0);

    const expense = rows
      .filter((item) => item.jenis_transaksi === "keluar")
      .reduce((sum, item) => sum + toNumber(item.nominal), 0);

    const balance = income - expense;
    const usedBudget = expense;
    const remainingBudget = wallet.budget - usedBudget;

    return {
      walletKey: wallet.walletKey,
      title: wallet.title,
      budget: wallet.budget,
      income,
      expense,
      balance,
      usedBudget,
      remainingBudget,
      visible: true,
    };
  });

  const totalIncome = wallets.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = wallets.reduce((sum, item) => sum + item.expense, 0);
  const totalBalance = wallets.reduce((sum, item) => sum + item.balance, 0);
  const totalRemainingBudget = wallets.reduce(
    (sum, item) => sum + item.remainingBudget,
    0
  );

  return {
    project,
    wallets,
    transactions,
    totalIncome,
    totalExpense,
    totalBalance,
    totalRemainingBudget,
  };
}