import * as XLSX from "xlsx";
import type { DbCashflow, ManageFundData, WalletKey } from "../types";

const WALLET_LABELS: Record<WalletKey | "all", string> = {
  all: "Semua Dompet",
  utama: "Dompet Utama",
  dokumen: "Dokumen",
  eksekusi: "Eksekusi",
  renovasi: "Renovasi",
  cadangan: "Cadangan",
};

function formatDate(value: Date | string | undefined): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function formatRupiah(value: number | string | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

export async function exportArusKasToExcel(
  data: ManageFundData,
  rows: DbCashflow[],
  selectedWallet: WalletKey | "all"
) {
  // Baca template dari public folder
  const response = await fetch("/templates/laporan-arus-kas.xlsx");
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

  // Buat sheet data transaksi
  const sheetData: (string | number)[][] = [
    // Header
    [`Laporan Arus Kas — ${data.project.nama_project}`],
    [`Dompet: ${WALLET_LABELS[selectedWallet]}`],
    [`Tanggal Export: ${formatDate(new Date())}`],
    [],
    ["No", "Tanggal", "Judul Transaksi", "Kategori", "Dompet", "Jenis", "Nominal (Rp)", "Status", "Catatan"],
    // Rows data
    ...rows.map((row, i) => [
      i + 1,
      formatDate(row.tanggal_transaksi),
      row.judul_transaksi ?? "-",
      row.kategori_transaksi ?? "-",
      WALLET_LABELS[row.wallet_key] ?? row.wallet_key,
      row.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran",
      Number(row.nominal ?? 0),
      row.status_transaksi === "tercatat" ? "Tercatat" : "Dibatalkan",
      row.catatan ?? "-",
    ]),
    // Summary
    [],
    ["", "", "", "", "", "Total Pemasukan", data.totalIncome],
    ["", "", "", "", "", "Total Pengeluaran", data.totalExpense],
    ["", "", "", "", "", "Saldo", data.totalBalance],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Lebar kolom
  sheet["!cols"] = [
    { wch: 5 },   // No
    { wch: 18 },  // Tanggal
    { wch: 32 },  // Judul
    { wch: 20 },  // Kategori
    { wch: 18 },  // Dompet
    { wch: 14 },  // Jenis
    { wch: 20 },  // Nominal
    { wch: 12 },  // Status
    { wch: 30 },  // Catatan
  ];

  // Hapus sheet "Data Transaksi" lama jika ada, lalu tambahkan
  const existingIdx = workbook.SheetNames.indexOf("Data Transaksi");
  if (existingIdx !== -1) {
    workbook.SheetNames.splice(existingIdx, 1);
    delete workbook.Sheets["Data Transaksi"];
  }
  XLSX.utils.book_append_sheet(workbook, sheet, "Data Transaksi");

  // Trigger download
  const projectId = data.project.id_project;
  const walletLabel = WALLET_LABELS[selectedWallet].replace(/\s/g, "_");
  const fileName = `ArusKas_${projectId}_${walletLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
