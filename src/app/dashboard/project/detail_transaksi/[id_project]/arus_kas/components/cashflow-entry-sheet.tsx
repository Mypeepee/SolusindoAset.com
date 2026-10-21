"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { DbCashflow } from "../types";
import CashflowQuickForm from "./cashflow-quick-form";

export default function CashflowEntrySheet({ open, onClose, idProject, editingTransaction = null, onSubmitted }: { open: boolean; onClose: () => void; idProject: string; editingTransaction?: DbCashflow | null; onSubmitted?: () => void }) {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const editing = Boolean(editingTransaction?.id_project_arus_kas);
  useEffect(() => { if (!open) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
    <button type="button" aria-label="Tutup form" onClick={onClose} className="absolute inset-0" disabled={pending} />
    <section role="dialog" aria-modal="true" className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#09131e] shadow-2xl sm:max-h-[88dvh] sm:rounded-[30px]">
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5 sm:px-6"><div><p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-200/70">{editing ? "Perbarui catatan" : "Catatan baru"}</p><h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit transaksi" : "Catat arus kas"}</h2><p className="mt-1 text-sm text-slate-400">Pilih arah uang, isi nominal, lalu simpan.</p></div><button type="button" onClick={onClose} disabled={pending} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 hover:bg-white/[0.06]"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><CashflowQuickForm formId={formId} idProject={idProject} editingTransaction={editingTransaction} onSubmitted={onSubmitted ?? onClose} onPendingChange={setPending} /></div>
      <div className="border-t border-white/10 p-5 sm:px-6"><button type="submit" form={formId} disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">{pending ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan…</> : editing ? "Simpan perubahan" : "Simpan transaksi"}</button></div>
    </section>
  </div>;
}
