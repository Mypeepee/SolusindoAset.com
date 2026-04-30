import * as XLSX from "xlsx";
import type { DbCashflow, ManageFundData, WalletKey } from "../types";

function set(ws: XLSX.WorkSheet, cell: string, value: string | number | null | undefined) {
  const v = value ?? "";
  ws[cell] = { v, t: typeof v === "number" ? "n" : "s" };
}

function fmtDate(value: Date | string | undefined | null): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtIDR(value: number | string | undefined): string {
  return `Rp${Number(value ?? 0).toLocaleString("id-ID")}`;
}

function walletStatus(persen: number): string {
  if (persen < 0.9) return "Aman";
  if (persen <= 1) return "Waspada";
  return "Over Budget";
}

export async function exportArusKasToExcel(data: ManageFundData) {
  const resp = await fetch("/templates/laporan-arus-kas.xlsx");
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

  // Force Excel recalculate on open
  if (!wb.Workbook) wb.Workbook = {} as XLSX.WorkBook["Workbook"];
  if (!wb.Workbook!.CalcPr) (wb.Workbook as Record<string, unknown>).CalcPr = {};
  (wb.Workbook as Record<string, Record<string, unknown>>).CalcPr!.fullCalcOnLoad = 1;

  const p = data.project;

  // Semua transaksi urut tanggal ASC untuk Timeline
  const sortedTx = [...data.transactions].sort((a, b) => {
    return new Date(a.tanggal_transaksi).getTime() - new Date(b.tanggal_transaksi).getTime();
  });

  const getWallet = (key: WalletKey) => data.wallets.find((w) => w.walletKey === key);

  // Budget per dompet sesuai mapping template
  const budgetUtama = Number(p.nilai_limit_lelang) + Number(p.spare_bidding) + Number(p.biaya_eksekusi);
  const budgetDokumen = Number(p.biaya_balik_nama);
  const budgetRenovasi = Number(p.biaya_renov);
  const budgetCadangan = Number(p.dana_cadangan);
  const totalBudget = budgetUtama + budgetDokumen + budgetRenovasi + budgetCadangan;

  // Realisasi per dompet
  const realUtama = Number(getWallet("utama")?.expense ?? 0);
  const realDokumen = Number(getWallet("dokumen")?.expense ?? 0);
  const realRenovasi = Number(getWallet("renovasi")?.expense ?? 0);
  const realCadangan = Number(getWallet("cadangan")?.expense ?? 0);
  const totalReal = realUtama + realDokumen + realRenovasi + realCadangan;

  // ─────────────────────────────────────────────────────────────
  // 1. COVER
  // Range B1:G33  (6 kolom: B C D E F G)
  // ─────────────────────────────────────────────────────────────
  const cover = wb.Sheets["Cover"];
  set(cover, "D9",  p.id_project);
  set(cover, "D13", p.nama_project);
  set(cover, "D17", fmtDate(p.dibuat_tanggal));
  set(cover, "D20", p.status);
  // KPI bawah (row 28): Harga Pembelian | Estimasi Harga Jual | Estimasi Profit Bersih
  set(cover, "B28", Number(p.total_biaya_akuisisi));
  set(cover, "D28", Number(p.estimasi_harga_jual));
  set(cover, "F28", Number(p.estimasi_profit_bersih));

  // ─────────────────────────────────────────────────────────────
  // 2. PROFIL PROYEK
  // Range B1:G38  (6 kolom: B C D E F G)
  // D = nilai, E = % (formula, tidak disentuh)
  // ─────────────────────────────────────────────────────────────
  const profil = wb.Sheets["Profil Proyek"];
  // Valuasi
  set(profil, "D9",  Number(p.total_biaya_akuisisi));   // Harga Pembelian
  set(profil, "D10", Number(p.estimasi_harga_jual));
  set(profil, "D11", Number(p.estimasi_profit_bersih));
  // Breakdown biaya akuisisi
  set(profil, "D15", Number(p.nilai_limit_lelang));
  set(profil, "D16", Number(p.spare_bidding));
  set(profil, "D17", Number(p.biaya_eksekusi));
  set(profil, "D18", Number(p.biaya_balik_nama));
  set(profil, "D19", Number(p.biaya_renov));
  set(profil, "D20", Number(p.dana_cadangan));
  set(profil, "D21", Number(p.total_biaya_akuisisi));
  // Status pendanaan
  set(profil, "D25", Number(p.target_pendanaan));
  set(profil, "D26", Number(p.total_pendanaan));
  set(profil, "D27", Number(p.target_pendanaan) - Number(p.total_pendanaan));
  // ROI table (row 32-35): kolom C = nilai
  set(profil, "C32", Number(p.total_biaya_akuisisi));
  set(profil, "C33", Number(p.total_biaya_akuisisi));
  set(profil, "C34", Number(p.estimasi_harga_jual));
  set(profil, "C35", Number(p.estimasi_profit_bersih));

  // ─────────────────────────────────────────────────────────────
  // 3. CASHFLOW TIMELINE
  // Range B1:L110  (11 kolom: B C D E F G H I J K L)
  // Header row 6, data rows 7-106, total row 108
  // L = Saldo Berjalan (hitung manual supaya langsung tampil)
  // ─────────────────────────────────────────────────────────────
  const timeline = wb.Sheets["Cashflow Timeline"];
  let runBalance = 0;

  sortedTx.slice(0, 100).forEach((tx, i) => {
    const row = 7 + i;
    const nominal = Number(tx.nominal ?? 0);
    runBalance += tx.jenis_transaksi === "pemasukan" ? nominal : -nominal;

    set(timeline, `B${row}`, i + 1);
    set(timeline, `C${row}`, fmtDate(tx.tanggal_transaksi));
    set(timeline, `D${row}`, p.id_project);
    set(timeline, `E${row}`, tx.jenis_transaksi);
    set(timeline, `F${row}`, tx.kategori_transaksi ?? "-");
    set(timeline, `G${row}`, nominal);
    set(timeline, `H${row}`, tx.wallet_key);
    set(timeline, `I${row}`, tx.judul_transaksi ?? "-");
    set(timeline, `J${row}`, tx.status_transaksi);
    set(timeline, `K${row}`, tx.catatan ?? "");
    set(timeline, `L${row}`, runBalance);
  });

  // Total row 108
  const netNominal = sortedTx.reduce((s, t) => {
    return s + (t.jenis_transaksi === "pemasukan" ? Number(t.nominal ?? 0) : -Number(t.nominal ?? 0));
  }, 0);
  set(timeline, "G108", Number(data.totalExpense));
  set(timeline, "L108", netNominal);

  // ─────────────────────────────────────────────────────────────
  // 4. DOMPET SHEETS
  // Range B1:I64  (8 kolom: B C D E F G H I)
  // Row 5: E5=Anggaran, I5=Sisa
  // Row 6: E6=Realisasi, I6=% Penyerapan
  // Header row 11, data rows 12-61, subtotal row 62: G62
  // ─────────────────────────────────────────────────────────────
  const dompetConfig = [
    { sheet: "Dompet Utama",    key: "utama"    as WalletKey, budget: budgetUtama,    real: realUtama    },
    { sheet: "Dompet Dokumen",  key: "dokumen"  as WalletKey, budget: budgetDokumen,  real: realDokumen  },
    { sheet: "Dompet Renovasi", key: "renovasi" as WalletKey, budget: budgetRenovasi, real: realRenovasi },
    { sheet: "Dompet Cadangan", key: "cadangan" as WalletKey, budget: budgetCadangan, real: realCadangan },
  ];

  for (const cfg of dompetConfig) {
    const ws = wb.Sheets[cfg.sheet];
    if (!ws) continue;

    const sisa = cfg.budget - cfg.real;
    const persen = cfg.budget > 0 ? cfg.real / cfg.budget : 0;

    set(ws, "E5", cfg.budget);
    set(ws, "I5", sisa);
    set(ws, "E6", cfg.real);
    set(ws, "I6", persen);

    const txList = sortedTx.filter((t) => t.wallet_key === cfg.key);
    txList.slice(0, 50).forEach((tx, i) => {
      const row = 12 + i;
      set(ws, `B${row}`, i + 1);
      set(ws, `C${row}`, fmtDate(tx.tanggal_transaksi));
      set(ws, `D${row}`, tx.jenis_transaksi);
      set(ws, `E${row}`, tx.kategori_transaksi ?? "-");
      set(ws, `F${row}`, tx.judul_transaksi ?? "-");
      set(ws, `G${row}`, Number(tx.nominal ?? 0));
      set(ws, `H${row}`, tx.status_transaksi);
      set(ws, `I${row}`, tx.catatan ?? "");
    });

    const subtotal = txList
      .filter((t) => t.jenis_transaksi === "pengeluaran")
      .reduce((s, t) => s + Number(t.nominal ?? 0), 0);
    set(ws, "G62", subtotal);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. RINGKASAN EKSEKUTIF
  // Range B1:H36  (7 kolom: B C D E F G H)
  // ─────────────────────────────────────────────────────────────
  const ringkasan = wb.Sheets["Ringkasan Eksekutif"];
  const penyerapanTotal = totalBudget > 0 ? totalReal / totalBudget : 0;
  const sisaTotal = totalBudget - totalReal;

  // KPI Anggaran row 6: B=totalAnggaran, D=realisasi, E=%, G=sisa
  set(ringkasan, "B6", totalBudget);
  set(ringkasan, "D6", totalReal);
  set(ringkasan, "E6", penyerapanTotal);
  set(ringkasan, "G6", sisaTotal);

  // KPI Cashflow row 12: B=pemasukan, D=pengeluaran, F=net
  set(ringkasan, "B12", Number(data.totalIncome));
  set(ringkasan, "D12", Number(data.totalExpense));
  set(ringkasan, "F12", Number(data.totalBalance));

  // Ringkasan per dompet rows 17-20
  const dompetRows = [
    { row: 17, budget: budgetUtama,    real: realUtama    },
    { row: 18, budget: budgetDokumen,  real: realDokumen  },
    { row: 19, budget: budgetRenovasi, real: realRenovasi },
    { row: 20, budget: budgetCadangan, real: realCadangan },
  ];
  for (const dr of dompetRows) {
    const sisa = dr.budget - dr.real;
    const p2 = dr.budget > 0 ? dr.real / dr.budget : 0;
    set(ringkasan, `D${dr.row}`, dr.budget);
    set(ringkasan, `E${dr.row}`, dr.real);
    set(ringkasan, `F${dr.row}`, sisa);
    set(ringkasan, `G${dr.row}`, p2);
    set(ringkasan, `H${dr.row}`, walletStatus(p2));
  }
  // Total row 21
  set(ringkasan, "D21", totalBudget);
  set(ringkasan, "E21", totalReal);
  set(ringkasan, "F21", sisaTotal);
  set(ringkasan, "G21", penyerapanTotal);
  set(ringkasan, "H21", walletStatus(penyerapanTotal));

  // Catatan manajemen rows 26-29
  const roi = Number(p.total_biaya_akuisisi) > 0
    ? ((Number(p.estimasi_profit_bersih) / Number(p.total_biaya_akuisisi)) * 100).toFixed(1)
    : "0.0";
  set(ringkasan, "B26", `• Total anggaran proyek sebesar ${fmtIDR(totalBudget)} dengan realisasi ${fmtIDR(totalReal)} (${(penyerapanTotal * 100).toFixed(1)}% dari plafon).`);
  set(ringkasan, "B27", `• Sisa anggaran tersedia: ${fmtIDR(sisaTotal)}.`);
  set(ringkasan, "B28", `• Status keseluruhan: ${walletStatus(penyerapanTotal)}.`);
  set(ringkasan, "B29", `• Estimasi profit bersih: ${fmtIDR(p.estimasi_profit_bersih)} (ROI: ${roi}%).`);

  // ─────────────────────────────────────────────────────────────
  // 6. ANGGARAN vs REALISASI
  // Range B1:I13  (8 kolom: B C D E F G H I)
  // D=Anggaran, E=Realisasi, F=Varians, G=% Pakai, H=Status
  // ─────────────────────────────────────────────────────────────
  const avr = wb.Sheets["Anggaran vs Realisasi"];
  const avrRows = [
    { row: 6, budget: budgetUtama,    real: realUtama    },
    { row: 7, budget: budgetDokumen,  real: realDokumen  },
    { row: 8, budget: budgetRenovasi, real: realRenovasi },
    { row: 9, budget: budgetCadangan, real: realCadangan },
  ];
  for (const ar of avrRows) {
    const varians = ar.budget - ar.real;
    const p3 = ar.budget > 0 ? ar.real / ar.budget : 0;
    set(avr, `D${ar.row}`, ar.budget);
    set(avr, `E${ar.row}`, ar.real);
    set(avr, `F${ar.row}`, varians);
    set(avr, `G${ar.row}`, p3);
    set(avr, `H${ar.row}`, walletStatus(p3));
  }
  // Total row 10
  set(avr, "D10", totalBudget);
  set(avr, "E10", totalReal);
  set(avr, "F10", sisaTotal);
  set(avr, "G10", penyerapanTotal);
  set(avr, "H10", walletStatus(penyerapanTotal));

  // ─────────────────────────────────────────────────────────────
  // 7. BREAKDOWN KATEGORI
  // Range B1:G18  (6 kolom: B C D E F G)
  // C=Total Pengeluaran, D=% dari Total
  // ─────────────────────────────────────────────────────────────
  const bkSheet = wb.Sheets["Breakdown Kategori"];
  const pengeluaranByKat: Record<string, number> = {};
  data.transactions
    .filter((t) => t.jenis_transaksi === "pengeluaran")
    .forEach((t) => {
      const kat = t.kategori_transaksi ?? "Pengeluaran Lainnya";
      pengeluaranByKat[kat] = (pengeluaranByKat[kat] ?? 0) + Number(t.nominal ?? 0);
    });

  const totalPengeluaran = Object.values(pengeluaranByKat).reduce((s, v) => s + v, 0);

  const bkRows: [string, number][] = [
    ["Pendanaan Investor", 7],
    ["Modal Internal",     8],
    ["Pengembalian Modal", 9],
    ["Pembayaran Lelang",  10],
    ["Biaya Eksekusi",     11],
    ["Balik Nama",         12],
    ["Renovasi",           13],
    ["Operasional",        14],
    ["Pengeluaran Lainnya",15],
    ["Penjualan Properti", 16],
    ["Pemasukan Lainnya",  17],
  ];
  for (const [kat, row] of bkRows) {
    const val = pengeluaranByKat[kat] ?? 0;
    set(bkSheet, `C${row}`, val);
    set(bkSheet, `D${row}`, totalPengeluaran > 0 ? val / totalPengeluaran : 0);
  }
  set(bkSheet, "C18", totalPengeluaran);

  // ─────────────────────────────────────────────────────────────
  // Download
  // ─────────────────────────────────────────────────────────────
  const fileName = `LaporanKeuangan_${p.id_project}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
