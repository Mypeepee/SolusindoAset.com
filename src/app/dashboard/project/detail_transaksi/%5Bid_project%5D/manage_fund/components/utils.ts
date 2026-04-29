import type {
    DashboardStats,
    DbCashflow,
    DbProject,
    LedgerRow,
    WalletOption,
    WalletSummary,
  } from "./types";
  
  type WalletConfig = WalletOption & {
    getBudget: (project: DbProject) => number;
    show: (project: DbProject) => boolean;
  };
  
  export const CASHFLOW_TYPE_OPTIONS = ["masuk", "keluar"] as const;
  
  /**
   * Kalau enum kategori_transaksi di DB Anda beda,
   * cukup ubah dbCategory di sini.
   */
  const WALLET_CONFIGS: WalletConfig[] = [
    {
      key: "main",
      label: "Dompet Utama",
      description: "Limit lelang + spare bidding",
      dbCategory: "dompet_utama",
      getBudget: (project) =>
        toNumber(project.nilai_limit_lelang) + toNumber(project.spare_bidding),
      show: () => true,
    },
    {
      key: "documents",
      label: "Pengurusan Dokumen",
      description: "Lelang, BPHTB, balik nama, roya",
      dbCategory: "pengurusan_dokumen",
      getBudget: (project) => toNumber(project.biaya_balik_nama),
      show: () => true,
    },
    {
      key: "execution",
      label: "Eksekusi Pengosongan",
      description: "Pengosongan, pengamanan, operasional",
      dbCategory: "eksekusi_pengosongan",
      getBudget: (project) => toNumber(project.biaya_eksekusi),
      show: () => true,
    },
    {
      key: "renovation",
      label: "Renovasi",
      description: "Perbaikan dan persiapan jual",
      dbCategory: "renovasi",
      getBudget: (project) => toNumber(project.biaya_renov),
      show: () => true,
    },
    {
      key: "reserve",
      label: "Dana Cadangan",
      description: "Sisa target pendanaan di luar biaya akuisisi",
      dbCategory: "dana_cadangan",
      getBudget: (project) => toNumber(project.dana_cadangan),
      show: (project) => toNumber(project.dana_cadangan) > 0,
    },
  ];
  
  export const WALLET_CATEGORY_VALUES = WALLET_CONFIGS.map(
    (item) => item.dbCategory
  );
  
  export function toNumber(value: unknown): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
  
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  
    if (value && typeof value === "object" && "toString" in value) {
      const parsed = Number(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    }
  
    return 0;
  }
  
  export function formatIDR(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  }
  
  export function formatDate(value?: string | Date | null) {
    if (!value) return "-";
  
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
  
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(date);
  }
  
  export function formatDateTime(value?: string | Date | null) {
    if (!value) return "-";
  
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
  
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
  }
  
  export function getTodayJakartaString() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());
  }
  
  export function humanizeText(value?: string | null) {
    if (!value) return "-";
  
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function getVisibleWalletOptions(project: DbProject): WalletOption[] {
    return WALLET_CONFIGS.filter((item) => item.show(project)).map(
      ({ getBudget: _getBudget, show: _show, ...rest }) => rest
    );
  }
  
  function isActiveTransaction(item: DbCashflow) {
    return item.status_transaksi !== "dibatalkan";
  }
  
  function getEntryDirectionValue(item: DbCashflow) {
    return item.jenis_transaksi === "masuk"
      ? toNumber(item.nominal)
      : -toNumber(item.nominal);
  }
  
  export function getWalletLabelByCategory(category: string) {
    const found = WALLET_CONFIGS.find((item) => item.dbCategory === category);
    return found?.label ?? humanizeText(category);
  }
  
  export function getWalletSummaries(
    project: DbProject,
    cashflows: DbCashflow[]
  ): WalletSummary[] {
    const activeCashflows = cashflows.filter(isActiveTransaction);
  
    return WALLET_CONFIGS.filter((item) => item.show(project)).map((wallet) => {
      const planned = wallet.getBudget(project);
  
      const inflow = activeCashflows
        .filter(
          (item) =>
            item.kategori_transaksi === wallet.dbCategory &&
            item.jenis_transaksi === "masuk"
        )
        .reduce((sum, item) => sum + toNumber(item.nominal), 0);
  
      const outflow = activeCashflows
        .filter(
          (item) =>
            item.kategori_transaksi === wallet.dbCategory &&
            item.jenis_transaksi === "keluar"
        )
        .reduce((sum, item) => sum + toNumber(item.nominal), 0);
  
      const remaining = planned + inflow - outflow;
      const usedNet = Math.max(outflow - inflow, 0);
      const usageRatio = planned > 0 ? Math.min(usedNet / planned, 1) : 0;
  
      return {
        key: wallet.key,
        label: wallet.label,
        description: wallet.description,
        dbCategory: wallet.dbCategory,
        planned,
        inflow,
        outflow,
        remaining,
        usageRatio,
        overBudget: remaining < 0,
      };
    });
  }
  
  export function getDashboardStats(
    project: DbProject,
    cashflows: DbCashflow[]
  ): DashboardStats {
    const activeCashflows = cashflows.filter(isActiveTransaction);
  
    const openingBalance = toNumber(project.total_pendanaan);
    const totalInflow = activeCashflows
      .filter((item) => item.jenis_transaksi === "masuk")
      .reduce((sum, item) => sum + toNumber(item.nominal), 0);
  
    const totalOutflow = activeCashflows
      .filter((item) => item.jenis_transaksi === "keluar")
      .reduce((sum, item) => sum + toNumber(item.nominal), 0);
  
    const targetFunding = toNumber(project.target_pendanaan);
    const acquisitionBudget = toNumber(project.total_biaya_akuisisi);
  
    return {
      openingBalance,
      currentBalance: openingBalance + totalInflow - totalOutflow,
      totalInflow,
      totalOutflow,
      targetFunding,
      remainingTarget: targetFunding - openingBalance,
      acquisitionBudget,
      remainingBudget: acquisitionBudget - totalOutflow,
    };
  }
  
  function sortCashflowsAscending(a: DbCashflow, b: DbCashflow) {
    const dateA = new Date(a.tanggal_transaksi).getTime();
    const dateB = new Date(b.tanggal_transaksi).getTime();
  
    if (dateA !== dateB) return dateA - dateB;
  
    return new Date(a.dibuat_tanggal).getTime() - new Date(b.dibuat_tanggal).getTime();
  }
  
  export function getLedgerRows(
    project: DbProject,
    cashflows: DbCashflow[]
  ): LedgerRow[] {
    const openingBalance = toNumber(project.total_pendanaan);
    const sorted = [...cashflows].sort(sortCashflowsAscending);
  
    let runningBalance = openingBalance;
  
    const rows = sorted.map((item) => {
      const nominal = toNumber(item.nominal);
  
      if (isActiveTransaction(item)) {
        runningBalance += getEntryDirectionValue(item);
      }
  
      return {
        ...item,
        amountIn: item.jenis_transaksi === "masuk" ? nominal : 0,
        amountOut: item.jenis_transaksi === "keluar" ? nominal : 0,
        runningBalance,
        categoryLabel: getWalletLabelByCategory(item.kategori_transaksi),
      };
    });
  
    return rows.reverse();
  }