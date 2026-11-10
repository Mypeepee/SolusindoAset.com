"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { CalendarDays, Check, ChevronDown, Minus, Plus } from "lucide-react";
import { requiredAdditionalCapital } from "@/lib/project-kas";
import type { DbCashflow, InvestorSummary } from "../types";
import DatePickerModal, { formatDatePretty, normalizeDateValue, todayIso } from "./date-picker-modal";
import { kategoriOptions, type KategoriOption } from "./cashflow-categories";
import { formatCurrency } from "../lib/format-currency";

type Jenis = "pemasukan" | "pengeluaran";
type Props = { idProject: string; fundSisaKas: number; investors: InvestorSummary[]; editingTransaction?: DbCashflow | null; onSubmitted?: () => void; onPendingChange?: (pending: boolean) => void; formId?: string };
const onlyDigits = (value: string) => value.replace(/\D/g, "");
const formatDigits = (value: string) => value ? new Intl.NumberFormat("id-ID").format(Number(value)) : "";
const normalJenis = (value?: string | null): Jenis => value === "pemasukan" || value === "masuk" ? "pemasukan" : "pengeluaran";
const defaultCategory = (jenis: Jenis) => jenis === "pemasukan" ? "pemasukan_lain" : "pengeluaran_lain";

function CategorySelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly KategoriOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function closeFromOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("mousedown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  if (!selected) return null;

  return (
    <div ref={rootRef} className="relative mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-left transition hover:bg-white/[0.06] focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
          <Icon icon={selected.icon} aria-hidden className="text-[17px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{selected.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Kategori transaksi"
          className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-[90] max-h-[min(310px,calc(100dvh-11rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#111b27]/[.98] p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.58),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[.16em] text-slate-500">
            Pilih kategori
          </p>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                  active
                    ? "bg-cyan-400/[0.12] text-cyan-50"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-cyan-300/15 text-cyan-200" : "bg-white/[0.05] text-slate-400"}`}>
                  <Icon icon={option.icon} aria-hidden className="text-[18px]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>
                {active ? <Check className="h-4 w-4 shrink-0 text-cyan-200" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function CashflowQuickForm({ idProject, fundSisaKas, investors, editingTransaction = null, onSubmitted, onPendingChange, formId = "cashflow-entry-form" }: Props) {
  const editingId = String(editingTransaction?.id_project_arus_kas ?? "");
  const editing = Boolean(editingId);
  const [jenis, setJenis] = useState<Jenis>(() => normalJenis(editingTransaction?.jenis_transaksi));
  const [kategori, setKategori] = useState(() => editingTransaction?.kategori_transaksi ?? defaultCategory(normalJenis(editingTransaction?.jenis_transaksi)));
  const [nominal, setNominal] = useState(() => editingTransaction ? onlyDigits(String(editingTransaction.nominal)) : "");
  const [judul, setJudul] = useState(() => editingTransaction?.judul_transaksi ?? "");
  const [tanggal, setTanggal] = useState(() => editingTransaction ? normalizeDateValue(editingTransaction.tanggal_transaksi) : todayIso());
  const [catatan, setCatatan] = useState(() => editingTransaction?.catatan ?? "");
  const [investorId, setInvestorId] = useState(() => investors.length === 1 ? investors[0].id_project_investor : "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => kategoriOptions(jenis), [jenis]);
  const amountValue = Number(nominal || 0);
  const cashShortfall = !editing && jenis === "pengeluaran" && amountValue > 0
    ? requiredAdditionalCapital(fundSisaKas, amountValue)
    : 0;

  useEffect(() => {
    const nextJenis = normalJenis(editingTransaction?.jenis_transaksi);
    setJenis(nextJenis); setKategori(editingTransaction?.kategori_transaksi ?? defaultCategory(nextJenis)); setNominal(editingTransaction ? onlyDigits(String(editingTransaction.nominal)) : ""); setJudul(editingTransaction?.judul_transaksi ?? ""); setTanggal(editingTransaction ? normalizeDateValue(editingTransaction.tanggal_transaksi) : todayIso()); setCatatan(editingTransaction?.catatan ?? ""); setInvestorId(investors.length === 1 ? investors[0].id_project_investor : ""); setError("");
  }, [editingTransaction, investors]);
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  function changeJenis(next: Jenis) { if (pending) return; setJenis(next); setKategori(defaultCategory(next)); setInvestorId(investors.length === 1 ? investors[0].id_project_investor : ""); setError(""); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(nominal || 0);
    if (!amount || amount <= 0) return setError("Masukkan nominal transaksi.");
    if (!judul.trim()) return setError("Tulis keterangan transaksi agar mudah dicari nanti.");
    if (cashShortfall > 0 && investors.length === 0) return setError("Project ini belum memiliki investor. Tambahkan investor sebelum mencatat pengeluaran ini.");
    if (cashShortfall > 0 && investors.length > 1 && !investorId) return setError("Pilih investor yang akan menambah modal untuk menutup kekurangan kas.");
    setPending(true); setError("");
    try {
      const response = await fetch(editing ? `/api/project/catat_arus_kas/${editingId}` : "/api/project/catat_arus_kas", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id_project: idProject, wallet_key: "utama", jenis_transaksi: jenis, kategori_transaksi: kategori, nominal: amount, judul_transaksi: judul.trim(), tanggal_transaksi: tanggal, catatan: catatan.trim() || null, status_transaksi: editingTransaction?.status_transaksi ?? "tercatat", id_project_investor: cashShortfall > 0 && investors.length > 1 ? investorId || null : null }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Transaksi belum dapat disimpan.");
      onSubmitted?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Transaksi belum dapat disimpan."); } finally { setPending(false); }
  }

  return <><form id={formId} onSubmit={submit} className="space-y-5">
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/10 p-1.5">{([{ value: "pemasukan" as const, label: "Uang masuk", Icon: Plus, active: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" }, { value: "pengeluaran" as const, label: "Uang keluar", Icon: Minus, active: "border-rose-300/30 bg-rose-400/10 text-rose-100" }]).map(({ value, label, Icon, active }) => <button key={value} type="button" onClick={() => changeJenis(value)} className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${jenis === value ? active : "border-transparent text-slate-400 hover:bg-white/[0.04]"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
    <div><label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Nominal</label><div className={`mt-2 rounded-2xl border p-4 ${jenis === "pemasukan" ? "border-emerald-300/20 bg-emerald-400/[0.05]" : "border-rose-300/20 bg-rose-400/[0.05]"}`}><div className="flex items-center gap-3"><span className="text-xl font-semibold text-white/60">Rp</span><input inputMode="numeric" autoFocus={!editing} value={formatDigits(nominal)} onChange={(event) => { setNominal(onlyDigits(event.target.value)); setError(""); }} placeholder="0" className="w-full bg-transparent text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20" /></div></div></div>
    {cashShortfall > 0 ? <section aria-live="polite" className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4">
      <div>
        <p className="text-sm font-semibold text-amber-100">Saldo proyek tidak mencukupi</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">Kekurangan {formatCurrency(cashShortfall)} akan dicatat sebagai setoran modal tambahan.</p>
      </div>
      {investors.length === 1 ? <p className="rounded-xl border border-white/[0.08] bg-black/10 px-3 py-3 text-sm leading-6 text-slate-200">Setoran modal tambahan dicatat atas nama <strong className="font-semibold text-white">{investors[0].nama}</strong>. Modal disetor investor bertambah {formatCurrency(cashShortfall)}.</p> : investors.length > 1 ? <fieldset className="max-h-64 space-y-2 overflow-y-auto pr-1">
        <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Pilih investor yang menambah modal</legend>
        {investors.map((investor) => {
          const selected = investor.id_project_investor === investorId;
          return <label key={investor.id_project_investor} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-cyan-200/40 ${selected ? "border-cyan-200/35 bg-cyan-300/[0.08]" : "border-white/10 bg-black/10 hover:bg-white/[0.04]"}`}>
            <input type="radio" name={`${formId}-modal-investor`} value={investor.id_project_investor} checked={selected} onChange={() => { setInvestorId(investor.id_project_investor); setError(""); }} className="h-4 w-4 shrink-0 accent-cyan-300" />
            <span className="min-w-0 flex-1 text-sm font-medium text-white">{investor.nama}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">+{formatCurrency(cashShortfall)}</span>
          </label>;
        })}
        <p className="text-xs leading-5 text-slate-400">Modal disetor investor terpilih akan bertambah sesuai kekurangan kas.</p>
      </fieldset> : <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-3 text-sm leading-6 text-rose-100">Project ini belum memiliki investor. Tambahkan investor sebelum mencatat pengeluaran ini.</p>}
      <div className="flex items-center justify-between gap-3 border-t border-amber-200/10 pt-3 text-sm"><span className="text-slate-300">Saldo setelah transaksi</span><strong className="tabular-nums text-white">{formatCurrency(Math.max(0, fundSisaKas + cashShortfall - amountValue))}</strong></div>
    </section> : null}
    <div className="grid gap-4 sm:grid-cols-[1.25fr_.75fr]"><div><label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Keterangan</label><input value={judul} onChange={(event) => setJudul(event.target.value)} placeholder={jenis === "pemasukan" ? "Contoh: Hasil penjualan unit" : "Contoh: Bayar notaris"} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35 focus:bg-cyan-400/[0.04]" /></div><div><label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Tanggal</label><button type="button" onClick={() => setCalendarOpen(true)} className="mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 text-left text-sm text-white transition hover:bg-white/[0.06]"><span>{formatDatePretty(tanggal)}</span><CalendarDays className="h-4 w-4 text-slate-400" /></button></div></div>
    <div><label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Kategori</label><CategorySelect options={options} value={kategori} onChange={setKategori} disabled={pending} /></div>
    <div><label className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Catatan <span className="normal-case tracking-normal text-white/25">(opsional)</span></label><textarea value={catatan} onChange={(event) => setCatatan(event.target.value)} rows={3} placeholder="Tambahkan detail atau nomor bukti bila perlu" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/35" /></div>
    {error ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
  </form><DatePickerModal open={calendarOpen} value={tanggal} disabled={pending} onClose={() => setCalendarOpen(false)} onChange={(value) => { setTanggal(value); setCalendarOpen(false); }} /></>;
}
