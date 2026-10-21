"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Plus, WalletCards } from "lucide-react";
import type { DbCashflow, ManageFundData } from "../types";
import { formatCurrency } from "../lib/format-currency";
import CashflowTable from "./cashflow-table";
import CashflowEntrySheet from "./cashflow-entry-sheet";

type FlowFilter = "all" | "pemasukan" | "pengeluaran";
const isExpense = (row: DbCashflow) => row.jenis_transaksi === "pengeluaran";
const timestamp = (value?: string | Date | null) => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.getTime() : 0; };

function findScrollContainer(element: HTMLElement | null) {
  let parent = element?.parentElement ?? null;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

export default function ManageFundScreen({ data, isCreator = false }: { data: ManageFundData; isCreator?: boolean }) {
  const router = useRouter();
  const pageRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<FlowFilter>("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DbCashflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dashboard memakai container scroll sendiri, bukan window. Reset eksplisit
  // mencegah posisi scroll halaman detail sebelumnya terbawa ke arus kas.
  useEffect(() => {
    const resetScroll = () => {
      findScrollContainer(pageRef.current)?.scrollTo({ top: 0, left: 0 });
      window.scrollTo({ top: 0, left: 0 });
    };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    const timeout = window.setTimeout(resetScroll, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, []);

  const summary = useMemo(() => data.transactions.reduce((total, row) => {
    if (row.status_transaksi === "dibatalkan") return total;
    const nominal = Number(row.nominal) || 0;
    if (isExpense(row)) total.keluar += nominal; else total.masuk += nominal;
    return total;
  }, { masuk: 0, keluar: 0 }), [data.transactions]);
  const transactions = useMemo(() => data.transactions.filter((row) => filter === "all" || (filter === "pengeluaran" ? isExpense(row) : !isExpense(row))).sort((a, b) => timestamp(b.tanggal_transaksi) - timestamp(a.tanggal_transaksi)), [data.transactions, filter]);
  const saldo = summary.masuk - summary.keluar;
  const closeComposer = () => { setIsComposerOpen(false); setEditingTransaction(null); };
  const openCreate = () => { setEditingTransaction(null); setIsComposerOpen(true); };

  async function deleteTransaction(row: DbCashflow) {
    const id = String(row.id_project_arus_kas ?? "");
    if (!id || !window.confirm(`Hapus transaksi “${row.judul_transaksi || "Tanpa judul"}”?`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/project/catat_arus_kas/${id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Gagal menghapus transaksi.");
      window.location.reload();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Gagal menghapus transaksi."); } finally { setIsDeleting(false); }
  }
  const filterItems: Array<{ value: FlowFilter; label: string }> = [{ value: "all", label: "Semua" }, { value: "pemasukan", label: "Uang masuk" }, { value: "pengeluaran", label: "Uang keluar" }];

  return <>
    <main ref={pageRef} className="mx-auto max-w-7xl space-y-6 pb-24">
      <header className="sticky top-0 z-40 -mx-1 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-[#05070b]/92 px-1 py-3 shadow-[0_12px_28px_rgba(5,7,11,0.24)] backdrop-blur-xl sm:py-4">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => router.back()} aria-label="Kembali" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.09]"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200/65">Arus kas proyek</p><h1 className="truncate text-lg font-semibold text-white sm:text-xl">{data.project.nama_project}</h1></div></div>
        {isCreator ? <button type="button" onClick={openCreate} className="hidden items-center gap-2 rounded-full bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 sm:inline-flex"><Plus className="h-4 w-4" /> Catat transaksi</button> : null}
      </header>
      <section className="relative overflow-hidden rounded-[32px] border border-cyan-300/20 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,0.18),transparent_30%),linear-gradient(135deg,#0a2230_0%,#07111d_55%,#0a1522_100%)] p-5 shadow-[0_24px_70px_rgba(2,8,23,0.32)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end"><div><div className="flex items-center gap-2 text-sm text-cyan-100/75"><WalletCards className="h-4 w-4" /> Saldo saat ini</div><p className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{formatCurrency(saldo)}</p><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Satu buku kas untuk seluruh proyek. Catat setiap uang yang masuk dan keluar tanpa membagi dana ke dompet anggaran.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08] p-4"><div className="flex items-center gap-2 text-xs font-medium text-emerald-200"><ArrowDownLeft className="h-4 w-4" /> Uang masuk</div><p className="mt-2 text-lg font-semibold tabular-nums text-emerald-50">{formatCurrency(summary.masuk)}</p></div><div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.08] p-4"><div className="flex items-center gap-2 text-xs font-medium text-rose-200"><ArrowUpRight className="h-4 w-4" /> Uang keluar</div><p className="mt-2 text-lg font-semibold tabular-nums text-rose-50">{formatCurrency(summary.keluar)}</p></div></div></div>
      </section>
      <section className="rounded-[30px] border border-white/10 bg-white/[0.025] p-4 sm:p-6"><div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">Riwayat pencatatan</p><h2 className="mt-2 text-xl font-semibold text-white">Semua transaksi</h2><p className="mt-1 text-sm text-slate-400">{transactions.length} transaksi {filter === "all" ? "tercatat" : filter === "pemasukan" ? "uang masuk" : "uang keluar"}</p></div><div className="inline-flex w-fit rounded-xl border border-white/10 bg-black/10 p-1">{filterItems.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${filter === item.value ? "bg-white/12 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>{item.label}</button>)}</div></div><div className="pt-5"><CashflowTable rows={transactions} onCreateTransaction={isCreator ? openCreate : undefined} onEditTransaction={isCreator ? (row) => { setEditingTransaction(row); setIsComposerOpen(true); } : undefined} onDeleteTransaction={isCreator ? deleteTransaction : undefined} />{isDeleting ? <p className="mt-4 text-sm text-slate-400">Menghapus transaksi…</p> : null}</div></section>
    </main>
    {isCreator ? <button type="button" onClick={openCreate} aria-label="Catat transaksi" className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan-300 text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.3)] sm:hidden"><Plus className="h-6 w-6" /></button> : null}
    {isCreator ? <CashflowEntrySheet open={isComposerOpen} onClose={closeComposer} idProject={data.project.id_project} editingTransaction={editingTransaction} onSubmitted={() => window.location.reload()} /> : null}
  </>;
}
