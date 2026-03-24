import {
    ArrowDownLeft,
    ArrowUpRight,
    CalendarDays,
    CircleDollarSign,
    FileText,
    Wallet2,
  } from "lucide-react";
  import { formatCurrency } from "../lib/format-currency";
  import type { DbCashflow } from "../types";
  
  function formatDate(value?: string | Date | null) {
    if (!value) return "-";
  
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
  
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
  
  function getWalletLabel(walletKey?: string | null) {
    switch (walletKey) {
      case "utama":
        return "Dompet Utama";
      case "dokumen":
        return "Dokumen";
      case "eksekusi":
        return "Eksekusi";
      case "renovasi":
        return "Renovasi";
      case "cadangan":
        return "Cadangan";
      default:
        return "Dompet Utama";
    }
  }
  
  function getWalletTone(walletKey?: string | null) {
    switch (walletKey) {
      case "utama":
        return "border-emerald-300/15 bg-emerald-400/10 text-emerald-200";
      case "dokumen":
        return "border-cyan-300/15 bg-cyan-400/10 text-cyan-200";
      case "eksekusi":
        return "border-amber-300/15 bg-amber-400/10 text-amber-200";
      case "renovasi":
        return "border-violet-300/15 bg-violet-400/10 text-violet-200";
      case "cadangan":
        return "border-rose-300/15 bg-rose-400/10 text-rose-200";
      default:
        return "border-white/10 bg-white/[0.05] text-white/70";
    }
  }
  
  function getStatusTone(status?: string | null) {
    switch (status) {
      case "berhasil":
      case "success":
      case "selesai":
        return "border-emerald-300/15 bg-emerald-400/10 text-emerald-200";
      case "pending":
      case "menunggu":
        return "border-amber-300/15 bg-amber-400/10 text-amber-200";
      case "gagal":
      case "dibatalkan":
      case "failed":
        return "border-rose-300/15 bg-rose-400/10 text-rose-200";
      default:
        return "border-white/10 bg-white/[0.05] text-white/70";
    }
  }
  
  export default function CashflowTable({
    rows,
  }: {
    rows: DbCashflow[];
  }) {
    if (!rows?.length) {
      return (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50">
            <CircleDollarSign className="h-6 w-6" />
          </div>
  
          <h3 className="mt-5 text-lg font-semibold text-white">
            Belum ada transaksi
          </h3>
  
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Belum ada riwayat transaksi pada filter yang sedang dipilih.
          </p>
        </div>
      );
    }
  
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
        <div className="divide-y divide-white/8">
          {rows.map((item) => {
            const isExpense = item.jenis_transaksi === "keluar";
            const AmountIcon = isExpense ? ArrowUpRight : ArrowDownLeft;
  
            return (
              <div
                key={item.id_project_arus_kas}
                className="flex flex-col gap-4 px-5 py-4 transition-colors duration-200 hover:bg-white/[0.03] sm:px-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="truncate text-sm font-semibold text-white sm:text-[15px]">
                        {item.judul_transaksi || "Transaksi"}
                      </div>
  
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                          getWalletTone(item.wallet_key),
                        ].join(" ")}
                      >
                        <Wallet2 className="mr-1.5 h-3.5 w-3.5" />
                        {getWalletLabel(item.wallet_key)}
                      </div>
  
                      <div
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                          isExpense
                            ? "border-rose-300/15 bg-rose-400/10 text-rose-200"
                            : "border-emerald-300/15 bg-emerald-400/10 text-emerald-200",
                        ].join(" ")}
                      >
                        {item.jenis_transaksi}
                      </div>
                    </div>
  
                    {item.catatan ? (
                      <div className="mt-2 flex items-start gap-2 text-sm text-slate-400">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                        <p className="line-clamp-2">{item.catatan}</p>
                      </div>
                    ) : null}
                  </div>
  
                  <div className="shrink-0 text-left lg:text-right">
                    <div
                      className={[
                        "inline-flex items-center gap-2 text-lg font-semibold",
                        isExpense ? "text-rose-100" : "text-emerald-100",
                      ].join(" ")}
                    >
                      <AmountIcon className="h-4 w-4" />
                      <span>
                        {isExpense ? "-" : "+"}
                        {formatCurrency(Number(item.nominal ?? 0))}
                      </span>
                    </div>
  
                    <div className="mt-2">
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
                          getStatusTone(item.status_transaksi),
                        ].join(" ")}
                      >
                        {item.status_transaksi ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
  
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/38">
                  <div className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatDate(item.tanggal_transaksi)}</span>
                  </div>
  
                  <div className="inline-flex items-center gap-1.5">
                    <CircleDollarSign className="h-3.5 w-3.5" />
                    <span>ID: {item.id_project_arus_kas}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }