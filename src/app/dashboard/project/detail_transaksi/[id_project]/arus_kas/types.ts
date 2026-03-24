export type WalletKey =
  | "utama"
  | "dokumen"
  | "eksekusi"
  | "renovasi"
  | "cadangan";

export type DbProject = {
  id_project: string;
  nama_project: string;
  status: string;
  target_pendanaan: number;
  total_pendanaan: number;
  total_biaya_akuisisi: number;
  nilai_limit_lelang: number;
  spare_bidding: number;
  biaya_balik_nama: number;
  biaya_eksekusi: number;
  biaya_renov: number;
  dana_cadangan: number;
  estimasi_harga_jual: number;
  estimasi_profit_bersih: number;
  dibuat_tanggal: string | Date;
};

export type DbCashflow = {
  id_project_arus_kas: number;
  id_project: string;
  tanggal_transaksi: string | Date;
  jenis_transaksi: string;
  kategori_transaksi: string;
  judul_transaksi: string;
  pihak_terkait?: string | null;
  nomor_referensi?: string | null;
  metode_pembayaran?: string | null;
  nominal: number;
  status_transaksi: string;
  catatan?: string | null;
  dibuat_tanggal?: string | Date;
  diupdate_tanggal?: string | Date;
  wallet_key?: WalletKey;
};

export type WalletSummary = {
  walletKey: WalletKey;
  title: string;
  budget: number;
  income: number;
  expense: number;
  balance: number;
  usedBudget: number;
  remainingBudget: number;
  visible: boolean;
};

export type ManageFundData = {
  project: DbProject;
  wallets: WalletSummary[];
  transactions: DbCashflow[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  totalRemainingBudget: number;
};