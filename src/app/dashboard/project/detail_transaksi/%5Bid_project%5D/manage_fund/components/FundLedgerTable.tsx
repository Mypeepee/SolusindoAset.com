import {
    ArrowDownLeft,
    ArrowUpRight,
    Landmark,
    ReceiptText,
  } from "lucide-react";
  
  import type { ArusKasEntry } from "./types";
  import {
    cn,
    formatDate,
    formatIDR,
    KATEGORI_META,
    METODE_LABEL,
    STATUS_META,
  } from "./utils";
  
  export default function FundLedgerTable({
    entries,
  }: {
    entries: ArusKasEntry[];
  }) {
    return (
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Ledger
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Arus kas proyek
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Tabel utama untuk semua transaksi. Inilah sumber kebenaran kas
              proyek: kapan uang bergerak, kategori apa, ke siapa, dan statusnya
              sudah dibayar atau baru tercatat.
            </p>
          </div>
  
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            <ReceiptText className="h-3.5 w-3.5" />
            {entries.length} entri
          </div>
        </div>
  
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] text-left">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Tanggal</th>
                <th className="px-5 py-4 font-medium">Arah</th>
                <th className="px-5 py-4 font-medium">Kategori</th>
                <th className="px-5 py-4 font-medium">Uraian</th>
                <th className="px-5 py-4 font-medium">Pihak terkait</th>
                <th className="px-5 py-4 font-medium">Metode</th>
                <th className="px-5 py-4 font-medium text-right">Nominal</th>
                <th className="px-5 py-4 font-medium">Status</th>
              </tr>
            </thead>
  
            <tbody>
              {entries.map((entry) => {
                const isIncome = entry.jenis_transaksi === "pemasukan";
                const category = KATEGORI_META[entry.kategori_transaksi];
                const status = STATUS_META[entry.status_transaksi];
  
                return (
                  <tr
                    key={entry.id_project_arus_kas}
                    className="border-t border-white/10 align-top transition hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-5">
                      <div className="text-sm font-medium text-white">
                        {formatDate(entry.tanggal_transaksi)}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Landmark className="h-3.5 w-3.5" />
                        #{entry.id_project_arus_kas}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                          isIncome
                            ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-200"
                            : "border-rose-400/15 bg-rose-400/10 text-rose-200"
                        )}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                        {isIncome ? "Pemasukan" : "Pengeluaran"}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <div className="text-sm font-medium text-white">
                        {category.label}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {category.shortLabel}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <div className="text-sm font-medium text-white">
                        {entry.judul_transaksi}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">
                        {entry.catatan || entry.nomor_referensi || "Tanpa catatan"}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <div className="text-sm text-slate-200">
                        {entry.pihak_terkait || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {entry.nomor_referensi || "Tanpa referensi"}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <div className="text-sm text-slate-200">
                        {entry.metode_pembayaran
                          ? METODE_LABEL[entry.metode_pembayaran]
                          : "—"}
                      </div>
                    </td>
  
                    <td className="px-5 py-5 text-right">
                      <div
                        className={cn(
                          "text-sm font-semibold",
                          isIncome ? "text-emerald-200" : "text-rose-200"
                        )}
                      >
                        {isIncome ? "+" : "-"}
                        {formatIDR(entry.nominal)}
                      </div>
                    </td>
  
                    <td className="px-5 py-5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
  
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center text-sm text-slate-400"
                  >
                    Belum ada transaksi pada ledger project ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }