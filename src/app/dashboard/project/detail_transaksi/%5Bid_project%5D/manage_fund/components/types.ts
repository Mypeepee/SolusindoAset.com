export type DbProject = {
    id_project: string;
    nama_project: string;
    status: string;
    target_pendanaan: unknown;
    total_pendanaan: unknown;
    total_biaya_akuisisi: unknown;
    nilai_limit_lelang: unknown;
    spare_bidding: unknown;
    biaya_balik_nama: unknown;
    biaya_eksekusi: unknown;
    biaya_renov: unknown;
    dana_cadangan: unknown;
    estimasi_harga_jual: unknown;
    estimasi_profit_bersih: unknown;
    dibuat_tanggal: string | Date;
  };
  
  export type DbCashflow = {
    id_project_arus_kas: number;
    id_project: string;
    tanggal_transaksi: string | Date;
    jenis_transaksi: string;
    kategori_transaksi: string;
    judul_transaksi: string;
    pihak_terkait: string | null;
    nomor_referensi: string | null;
    metode_pembayaran: string | null;
    nominal: unknown;
    status_transaksi: string;
    catatan: string | null;
    dibuat_tanggal: string | Date;
    diupdate_tanggal: string | Date;
  };
  
  export type WalletKey =
    | "main"
    | "documents"
    | "execution"
    | "renovation"
    | "reserve";
  
  export type WalletOption = {
    key: WalletKey;
    label: string;
    description: string;
    dbCategory: string;
  };
  
  export type WalletSummary = WalletOption & {
    planned: number;
    inflow: number;
    outflow: number;
    remaining: number;
    usageRatio: number;
    overBudget: boolean;
  };
  
  export type DashboardStats = {
    openingBalance: number;
    currentBalance: number;
    totalInflow: number;
    totalOutflow: number;
    targetFunding: number;
    remainingTarget: number;
    acquisitionBudget: number;
    remainingBudget: number;
  };
  
  export type LedgerRow = DbCashflow & {
    amountIn: number;
    amountOut: number;
    runningBalance: number;
    categoryLabel: string;
  };
  
  export type CashflowActionState = {
    success: boolean;
    message: string;
    errors?: Partial<
      Record<
        | "id_project"
        | "tanggal_transaksi"
        | "jenis_transaksi"
        | "kategori_transaksi"
        | "judul_transaksi"
        | "nominal",
        string
      >
    >;
  };