import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
// @ts-expect-error – no types for xlsx-populate
import XlsxPopulate from "xlsx-populate";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function n(v: Prisma.Decimal | number | null | undefined): number {
  const num = v instanceof Prisma.Decimal ? v.toNumber() : Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function fmtDate(v: Date | string | null | undefined): string {
  if (!v) return "-";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtIDR(v: number): string {
  return `Rp${v.toLocaleString("id-ID")}`;
}

function status(persen: number): string {
  if (persen < 0.9) return "Aman";
  if (persen <= 1) return "Waspada";
  return "Over Budget";
}

type WalletKey = "utama" | "dokumen" | "eksekusi" | "renovasi" | "cadangan";

function normalizeWalletKey(v: unknown): WalletKey {
  if (["utama","dokumen","eksekusi","renovasi","cadangan"].includes(v as string)) return v as WalletKey;
  return "utama";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id_project: string } }
) {
  const { id_project } = params;

  // ── Ambil data dari DB ──────────────────────────────────────
  const [project, txRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id_project },
      select: {
        id_project: true,
        nama_project: true,
        alamat_property: true,
        provinsi: true,
        kota: true,
        kecamatan: true,
        kelurahan: true,
        status: true,
        jenis_pendanaan: true,
        tanggal_pembelian: true,
        mulai_tanggal: true,
        estimasi_selesai: true,
        estimasi_bulan: true,
        target_pendanaan: true,
        total_pendanaan: true,
        harga_pembelian: true,
        total_biaya_akuisisi: true,
        nilai_limit_lelang: true,
        spare_bidding: true,
        biaya_balik_nama: true,
        biaya_eksekusi: true,
        biaya_renov: true,
        dana_cadangan: true,
        estimasi_harga_jual: true,
        estimasi_profit_bersih: true,
        dibuat_tanggal: true,
        pembuat: {
          select: {
            pengguna: {
              select: { nama_lengkap: true },
            },
          },
        },
      },
    }),
    prisma.projectArusKas.findMany({
      where: { id_project, status_transaksi: { not: "dibatalkan" } },
      orderBy: { tanggal_transaksi: "asc" },
      select: {
        id_project_arus_kas: true,
        id_project: true,
        wallet_key: true,
        tanggal_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        judul_transaksi: true,
        nominal: true,
        status_transaksi: true,
        catatan: true,
      },
    }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  }

  const lokasiParts = [project.kota, project.kecamatan, project.kelurahan, project.provinsi].filter(Boolean);
  const namaAgen = project.pembuat?.pengguna?.nama_lengkap ?? "-";

  const p = {
    id_project: project.id_project,
    nama_project: project.nama_project,
    alamat_property: project.alamat_property ?? "-",
    lokasi: lokasiParts.length ? lokasiParts.join(", ") : "-",
    status: project.status ?? "-",
    jenis_pendanaan: String(project.jenis_pendanaan ?? "-").replace(/_/g, " "),
    tanggal_pembelian: project.tanggal_pembelian,
    mulai_tanggal: project.mulai_tanggal,
    estimasi_selesai: project.estimasi_selesai,
    estimasi_bulan: project.estimasi_bulan ?? 0,
    penanggung_jawab: namaAgen,
    target_pendanaan: n(project.target_pendanaan),
    total_pendanaan: n(project.total_pendanaan),
    harga_pembelian: n(project.harga_pembelian),
    total_biaya_akuisisi: n(project.total_biaya_akuisisi),
    nilai_limit_lelang: n(project.nilai_limit_lelang),
    spare_bidding: n(project.spare_bidding),
    biaya_balik_nama: n(project.biaya_balik_nama),
    biaya_eksekusi: n(project.biaya_eksekusi),
    biaya_renov: n(project.biaya_renov),
    dana_cadangan: n(project.dana_cadangan),
    estimasi_harga_jual: n(project.estimasi_harga_jual),
    estimasi_profit_bersih: n(project.estimasi_profit_bersih),
    dibuat_tanggal: project.dibuat_tanggal,
  };

  const transactions = txRows.map((r) => ({
    wallet_key: normalizeWalletKey(r.wallet_key),
    tanggal_transaksi: r.tanggal_transaksi,
    jenis_transaksi: r.jenis_transaksi as "pemasukan" | "pengeluaran",
    kategori_transaksi: r.kategori_transaksi ?? "-",
    judul_transaksi: r.judul_transaksi ?? "-",
    nominal: n(r.nominal),
    status_transaksi: r.status_transaksi ?? "tercatat",
    catatan: r.catatan ?? "",
  }));

  // Budget per dompet (Utama = limit + bidding SAJA, Eksekusi terpisah)
  const budgetUtama    = p.nilai_limit_lelang + p.spare_bidding;
  const budgetDokumen  = p.biaya_balik_nama;
  const budgetEksekusi = p.biaya_eksekusi;
  const budgetRenovasi = p.biaya_renov;
  const budgetCadangan = p.dana_cadangan;
  const totalBudget    = budgetUtama + budgetDokumen + budgetEksekusi + budgetRenovasi + budgetCadangan;

  // Realisasi per dompet (pengeluaran saja)
  const realOf = (key: WalletKey) =>
    transactions.filter((t) => t.wallet_key === key && t.jenis_transaksi === "pengeluaran")
      .reduce((s, t) => s + t.nominal, 0);

  const realUtama    = realOf("utama");
  const realDokumen  = realOf("dokumen");
  const realEksekusi = realOf("eksekusi");
  const realRenovasi = realOf("renovasi");
  const realCadangan = realOf("cadangan");
  const totalReal    = realUtama + realDokumen + realEksekusi + realRenovasi + realCadangan;

  const totalIncome  = transactions.filter((t) => t.jenis_transaksi === "pemasukan").reduce((s, t) => s + t.nominal, 0);
  const totalExpense = transactions.filter((t) => t.jenis_transaksi === "pengeluaran").reduce((s, t) => s + t.nominal, 0);
  const totalBalance = totalIncome - totalExpense;

  // ── Buka template dengan xlsx-populate ─────────────────────
  const templatePath = path.join(process.cwd(), "src/app/dashboard/project/detail_transaksi/%5Bid_project%5D/arus_kas/components/Solusindo_Premier_Laporan_Lelang.xlsx");
  const templateBuf = fs.readFileSync(templatePath);
  const wb = await XlsxPopulate.fromDataAsync(templateBuf);

  // ── Helper ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S = (sheetName: string) => wb.sheet(sheetName) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (sheet: any, cell: string, value: string | number) => sheet.cell(cell).value(value);

  // ── 1. COVER ────────────────────────────────────────────────
  const cover = S("Cover");
  set(cover, "D9",  p.id_project);
  set(cover, "D13", p.nama_project);
  set(cover, "D14", p.alamat_property);
  set(cover, "D15", p.lokasi);
  set(cover, "D16", fmtDate(p.tanggal_pembelian));
  set(cover, "D17", fmtDate(p.mulai_tanggal));
  set(cover, "D18", fmtDate(p.estimasi_selesai));
  set(cover, "D19", p.estimasi_bulan > 0 ? `${p.estimasi_bulan} bulan` : "-");
  set(cover, "D20", p.status);
  set(cover, "D21", p.jenis_pendanaan);
  set(cover, "D22", p.penanggung_jawab);
  set(cover, "B28", p.total_biaya_akuisisi);
  set(cover, "D28", p.estimasi_harga_jual);
  set(cover, "F28", p.estimasi_profit_bersih);

  // ── 2. PROFIL PROYEK ────────────────────────────────────────
  const profil = S("Profil Proyek");
  set(profil, "D9",  p.total_biaya_akuisisi);
  set(profil, "D10", p.estimasi_harga_jual);
  set(profil, "D11", p.estimasi_profit_bersih);
  set(profil, "D15", p.nilai_limit_lelang);
  set(profil, "D16", p.spare_bidding);
  set(profil, "D17", p.biaya_eksekusi);
  set(profil, "D18", p.biaya_balik_nama);
  set(profil, "D19", p.biaya_renov);
  set(profil, "D20", p.dana_cadangan);
  set(profil, "D21", p.total_biaya_akuisisi);
  set(profil, "D25", p.target_pendanaan);
  set(profil, "D26", p.total_pendanaan);
  set(profil, "D27", p.target_pendanaan - p.total_pendanaan);
  set(profil, "C32", p.total_biaya_akuisisi);
  set(profil, "C33", p.total_biaya_akuisisi);
  set(profil, "C34", p.estimasi_harga_jual);
  set(profil, "C35", p.estimasi_profit_bersih);

  // ── 3. CASHFLOW TIMELINE ────────────────────────────────────
  const timeline = S("Cashflow Timeline");
  let runBalance = 0;
  transactions.slice(0, 100).forEach((tx, i) => {
    const row = 7 + i;
    runBalance += tx.jenis_transaksi === "pemasukan" ? tx.nominal : -tx.nominal;
    set(timeline, `B${row}`, i + 1);
    set(timeline, `C${row}`, fmtDate(tx.tanggal_transaksi));
    set(timeline, `D${row}`, p.id_project);
    set(timeline, `E${row}`, tx.jenis_transaksi);
    set(timeline, `F${row}`, tx.kategori_transaksi);
    set(timeline, `G${row}`, tx.nominal);
    set(timeline, `H${row}`, tx.wallet_key);
    set(timeline, `I${row}`, tx.judul_transaksi);
    set(timeline, `J${row}`, tx.status_transaksi);
    set(timeline, `K${row}`, tx.catatan);
    set(timeline, `L${row}`, runBalance);
  });
  set(timeline, "G108", totalExpense);
  set(timeline, "L108", runBalance);

  // ── 4. DOMPET SHEETS ────────────────────────────────────────
  const dompetCfg = [
    { name: "Dompet Utama",    key: ["utama"]    as WalletKey[], budget: budgetUtama,    real: realUtama    },
    { name: "Dompet Dokumen",  key: ["dokumen"]  as WalletKey[], budget: budgetDokumen,  real: realDokumen  },
    { name: "Dompet Eksekusi", key: ["eksekusi"] as WalletKey[], budget: budgetEksekusi, real: realEksekusi },
    { name: "Dompet Renovasi", key: ["renovasi"] as WalletKey[], budget: budgetRenovasi, real: realRenovasi },
    { name: "Dompet Cadangan", key: ["cadangan"] as WalletKey[], budget: budgetCadangan, real: realCadangan },
  ];

  for (const cfg of dompetCfg) {
    const ws = S(cfg.name);
    const sisa   = cfg.budget - cfg.real;
    const persen = cfg.budget > 0 ? cfg.real / cfg.budget : 0;
    set(ws, "E5", cfg.budget);
    set(ws, "I5", sisa);
    set(ws, "E6", cfg.real);
    set(ws, "I6", persen);

    const txList = transactions.filter((t) => cfg.key.includes(t.wallet_key));
    txList.slice(0, 50).forEach((tx, i) => {
      const row = 12 + i;
      set(ws, `B${row}`, i + 1);
      set(ws, `C${row}`, fmtDate(tx.tanggal_transaksi));
      set(ws, `D${row}`, tx.jenis_transaksi);
      set(ws, `E${row}`, tx.kategori_transaksi);
      set(ws, `F${row}`, tx.judul_transaksi);
      set(ws, `G${row}`, tx.nominal);
      set(ws, `H${row}`, tx.status_transaksi);
      set(ws, `I${row}`, tx.catatan);
    });

    const subtotal = txList.filter((t) => t.jenis_transaksi === "pengeluaran").reduce((s, t) => s + t.nominal, 0);
    set(ws, "G62", subtotal);
  }

  // ── 5. RINGKASAN EKSEKUTIF ──────────────────────────────────
  const ringkasan = S("Ringkasan Eksekutif");
  const penyerapanTotal = totalBudget > 0 ? totalReal / totalBudget : 0;
  const sisaTotal = totalBudget - totalReal;

  set(ringkasan, "B6", totalBudget);
  set(ringkasan, "D6", totalReal);
  set(ringkasan, "E6", penyerapanTotal);
  set(ringkasan, "G6", sisaTotal);
  set(ringkasan, "B12", totalIncome);
  set(ringkasan, "D12", totalExpense);
  set(ringkasan, "F12", totalBalance);

  // 5 dompet rows 17-21, TOTAL row 22
  const dompetRows = [
    { row: 17, label: "Utama",    src: "Limit Lelang + Spare Bidding",         budget: budgetUtama,    real: realUtama    },
    { row: 18, label: "Dokumen",  src: "Biaya Balik Nama (Notaris, BPN, Pajak)", budget: budgetDokumen,  real: realDokumen  },
    { row: 19, label: "Eksekusi", src: "Biaya Eksekusi",                        budget: budgetEksekusi, real: realEksekusi },
    { row: 20, label: "Renovasi", src: "Renovasi & Peningkatan Properti",       budget: budgetRenovasi, real: realRenovasi },
    { row: 21, label: "Cadangan", src: "Dana Cadangan / Kontingensi",           budget: budgetCadangan, real: realCadangan },
  ];
  for (const dr of dompetRows) {
    const sisa2 = dr.budget - dr.real;
    const p2    = dr.budget > 0 ? dr.real / dr.budget : 0;
    set(ringkasan, `B${dr.row}`, dr.label);
    set(ringkasan, `C${dr.row}`, dr.src);
    set(ringkasan, `D${dr.row}`, dr.budget);
    set(ringkasan, `E${dr.row}`, dr.real);
    set(ringkasan, `F${dr.row}`, sisa2);
    set(ringkasan, `G${dr.row}`, p2);
    set(ringkasan, `H${dr.row}`, status(p2));
  }
  // TOTAL di row 22 (geser 1 dari template asli yang di row 21)
  set(ringkasan, "B22", "TOTAL");
  set(ringkasan, "C22", "Seluruh Dompet");
  set(ringkasan, "D22", totalBudget);
  set(ringkasan, "E22", totalReal);
  set(ringkasan, "F22", sisaTotal);
  set(ringkasan, "G22", penyerapanTotal);
  set(ringkasan, "H22", status(penyerapanTotal));

  const roi = p.total_biaya_akuisisi > 0
    ? ((p.estimasi_profit_bersih / p.total_biaya_akuisisi) * 100).toFixed(1) : "0.0";
  set(ringkasan, "B26", `• Total anggaran proyek sebesar ${fmtIDR(totalBudget)} dengan realisasi ${fmtIDR(totalReal)} (${(penyerapanTotal * 100).toFixed(1)}% dari plafon).`);
  set(ringkasan, "B27", `• Sisa anggaran tersedia: ${fmtIDR(sisaTotal)}.`);
  set(ringkasan, "B28", `• Status keseluruhan: ${status(penyerapanTotal)}.`);
  set(ringkasan, "B29", `• Estimasi profit bersih: ${fmtIDR(p.estimasi_profit_bersih)} (ROI: ${roi}%).`);

  // ── 6. ANGGARAN vs REALISASI ────────────────────────────────
  const avr = S("Anggaran vs Realisasi");
  // 5 dompet rows 6-10, TOTAL row 11
  const avrRows = [
    { row: 6,  label: "Utama",    src: "Limit Lelang + Spare Bidding",          budget: budgetUtama,    real: realUtama    },
    { row: 7,  label: "Dokumen",  src: "Biaya Balik Nama (Notaris, BPN, Pajak)", budget: budgetDokumen,  real: realDokumen  },
    { row: 8,  label: "Eksekusi", src: "Biaya Eksekusi",                         budget: budgetEksekusi, real: realEksekusi },
    { row: 9,  label: "Renovasi", src: "Renovasi & Peningkatan Properti",        budget: budgetRenovasi, real: realRenovasi },
    { row: 10, label: "Cadangan", src: "Dana Cadangan / Kontingensi",            budget: budgetCadangan, real: realCadangan },
  ];
  for (const ar of avrRows) {
    const v  = ar.budget - ar.real;
    const p3 = ar.budget > 0 ? ar.real / ar.budget : 0;
    set(avr, `B${ar.row}`, ar.label);
    set(avr, `C${ar.row}`, ar.src);
    set(avr, `D${ar.row}`, ar.budget);
    set(avr, `E${ar.row}`, ar.real);
    set(avr, `F${ar.row}`, v);
    set(avr, `G${ar.row}`, p3);
    set(avr, `H${ar.row}`, status(p3));
  }
  // TOTAL row 11
  set(avr, "B11", "TOTAL");
  set(avr, "C11", "Seluruh Dompet");
  set(avr, "D11", totalBudget);
  set(avr, "E11", totalReal);
  set(avr, "F11", sisaTotal);
  set(avr, "G11", penyerapanTotal);
  set(avr, "H11", status(penyerapanTotal));

  // ── 7. BREAKDOWN KATEGORI ───────────────────────────────────
  const bkSheet = S("Breakdown Kategori");
  const byKat: Record<string, number> = {};
  transactions.filter((t) => t.jenis_transaksi === "pengeluaran").forEach((t) => {
    byKat[t.kategori_transaksi] = (byKat[t.kategori_transaksi] ?? 0) + t.nominal;
  });
  const totalPengeluaran = Object.values(byKat).reduce((s, v) => s + v, 0);

  const bkRows: [string, number][] = [
    ["Pendanaan Investor", 7], ["Modal Internal", 8], ["Pengembalian Modal", 9],
    ["Pembayaran Lelang", 10], ["Biaya Eksekusi", 11], ["Balik Nama", 12],
    ["Renovasi", 13], ["Operasional", 14], ["Pengeluaran Lainnya", 15],
    ["Penjualan Properti", 16], ["Pemasukan Lainnya", 17],
  ];
  for (const [kat, row] of bkRows) {
    const val = byKat[kat] ?? 0;
    set(bkSheet, `C${row}`, val);
    set(bkSheet, `D${row}`, totalPengeluaran > 0 ? val / totalPengeluaran : 0);
  }
  set(bkSheet, "C18", totalPengeluaran);

  // ── Output ──────────────────────────────────────────────────
  const outputBuf: Buffer = await wb.outputAsync();
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `LaporanKeuangan_${p.id_project}_${today}.xlsx`;

  return new NextResponse(outputBuf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
