import type { DbCashflow, DbProject, WalletKey, WalletSummary } from "../types";
import { WALLET_LABELS } from "../types";
import { isIncomeKind, toNumber } from "./format-currency";

export function mapProjectWallets(
  project: DbProject,
  rows: DbCashflow[]
): WalletSummary[] {
  const cadanganBudgetRaw =
    toNumber(project.dana_cadangan) > 0
      ? toNumber(project.dana_cadangan)
      : Math.max(
          toNumber(project.target_pendanaan) -
            toNumber(project.total_biaya_akuisisi),
          0
        );

  const budgets: Record<WalletKey, number> = {
    utama: toNumber(project.nilai_limit_lelang) + toNumber(project.spare_bidding),
    dokumen: toNumber(project.biaya_balik_nama),
    eksekusi: toNumber(project.biaya_eksekusi),
    renovasi: toNumber(project.biaya_renov),
    cadangan: cadanganBudgetRaw,
  };

  const aggregates: Record<
    WalletKey,
    { income: number; expense: number }
  > = {
    utama: { income: 0, expense: 0 },
    dokumen: { income: 0, expense: 0 },
    eksekusi: { income: 0, expense: 0 },
    renovasi: { income: 0, expense: 0 },
    cadangan: { income: 0, expense: 0 },
  };

  for (const row of rows) {
    const key = row.wallet_key;
    const nominal = toNumber(row.nominal);

    if (isIncomeKind(row.jenis_transaksi)) {
      aggregates[key].income += nominal;
    } else {
      aggregates[key].expense += nominal;
    }
  }

  const order: WalletKey[] = [
    "utama",
    "dokumen",
    "eksekusi",
    "renovasi",
    "cadangan",
  ];

  return order
    .filter((key) => key !== "cadangan" || budgets.cadangan > 0)
    .map((key) => {
      const income = aggregates[key].income;
      const expense = aggregates[key].expense;
      const balance = income - expense;
      const remainingBudget = budgets[key] - expense;

      return {
        walletKey: key,
        title: WALLET_LABELS[key],
        budget: budgets[key],
        income,
        expense,
        balance,
        remainingBudget,
      };
    });
}