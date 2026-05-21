"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit?: (payload: { template: SuratTemplate; values: Record<string, string> }) => Promise<void> | void;
};

type TransaksiItem = {
  id: string;
  kode_transaksi: string | null; // mapped from id_transaksi
  tanggal_transaksi: string;
  judul_property: string;
  alamat_property: string | null;
  nama_agent: string;
  foto_url: string;
  harga: number;
  label_harga: string;
};

type InvoiceValues = {
  nama_pembeli: string;
  keterangan: string;
  nilai: string;
};

const EMPTY: InvoiceValues = { nama_pembeli: "", keterangan: "", nilai: "" };

// ─── Utils ────────────────────────────────────────────────────────────────────

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function fmtRupiah(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function fmtTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepLabel({
  n, label, done,
}: { n: number; label: string; done: boolean }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-all duration-300",
          done
            ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.4)]"
            : "bg-white/5 text-zinc-500 ring-1 ring-white/10",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </span>
      {done && (
        <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
          Selesai
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InvoiceModal({ open, template, onClose, onSubmit }: Props) {
  const [mounted, setMounted]           = useState(false);
  const [isEntered, setIsEntered]       = useState(false);
  const [values, setValues]             = useState<InvoiceValues>(EMPTY);
  const [isGenerating, setIsGenerating] = useState(false);

  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [isFetchingTrx, setIsFetchingTrx] = useState(false);
  const [selectedTrx, setSelectedTrx]     = useState<TransaksiItem | null>(null);
  const [trxSearch, setTrxSearch]         = useState("");
  const [trxOpen, setTrxOpen]             = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Enter animation — satu frame delay supaya transition terpicu
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setIsEntered(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsEntered(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setValues(EMPTY);
      setIsGenerating(false);
      setSelectedTrx(null);
      setTrxSearch("");
      setTrxOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const fetchTransaksi = useCallback(async () => {
    setIsFetchingTrx(true);
    try {
      const res = await fetch("/api/surat/transaksi-list");
      if (res.ok) setTransaksiList(await res.json() as TransaksiItem[]);
    } finally {
      setIsFetchingTrx(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchTransaksi();
  }, [open, fetchTransaksi]);

  const upd = <K extends keyof InvoiceValues>(k: K, v: InvoiceValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const nilaiNum = parseInt(values.nilai || "0") || 0;

  const step1Done = selectedTrx !== null;
  const step2Done = values.nama_pembeli.trim() !== "";
  const step3Done = values.keterangan.trim() !== "" && nilaiNum > 0;
  const canSubmit = step1Done && step2Done && step3Done;

  const handleSubmit = async () => {
    if (!template || !canSubmit || isGenerating || !selectedTrx) return;
    setIsGenerating(true);
    try {
      await onSubmit?.({
        template,
        values: {
          nama_pembeli:    values.nama_pembeli,
          keterangan:      values.keterangan,
          nilai:           values.nilai,
          id_transaksi:    selectedTrx.id,
          kode_transaksi:  selectedTrx.kode_transaksi ?? "",
          judul_property:  selectedTrx.judul_property,
          alamat_property: selectedTrx.alamat_property ?? "",
          nama_agent:      selectedTrx.nama_agent,
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredTrx = transaksiList.filter((t) => {
    if (!trxSearch) return true;
    const q = trxSearch.toLowerCase();
    return (
      t.alamat_property?.toLowerCase().includes(q) ||
      t.nama_agent.toLowerCase().includes(q)
    );
  });

  if (!open || !template || !mounted) return null;

  const stepsCompleted = [step1Done, step2Done, step3Done].filter(Boolean).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4 lg:p-6">
      {/* Backdrop */}
      <div
        className={cx(
          "absolute inset-0 bg-black/80 backdrop-blur-lg transition-opacity duration-300",
          isEntered ? "opacity-100" : "opacity-0",
        )}
        onClick={isGenerating ? undefined : onClose}
      />

      {/* Sheet — mobile: slide up · desktop: scale + fade */}
      <div
        className={cx(
          "relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-white/[0.07] bg-[#0b0b14]",
          "shadow-[0_-20px_80px_rgba(0,0,0,0.9)] sm:rounded-3xl sm:shadow-[0_40px_120px_rgba(0,0,0,0.95)]",
          // Mobile: slide dari bawah
          "translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          !isEntered && "translate-y-full",
          // Desktop: scale + fade (override translate)
          "sm:translate-y-0 sm:transition-[opacity,transform] sm:duration-300 sm:ease-out",
          isEntered ? "sm:opacity-100 sm:scale-100" : "sm:opacity-0 sm:scale-95",
        )}
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Pull handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="relative flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-5 sm:pt-6">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
              <FileText className="h-5 w-5 text-emerald-400" />
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/5 blur-sm" />
            </div>
            {/* Title */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-black tracking-tight text-white">
                  Invoice Penagihan
                </h2>
                {/* Progress chip */}
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[10px] font-black ring-1 transition-all duration-500",
                    canSubmit
                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                      : "bg-white/5 text-zinc-500 ring-white/10",
                  )}
                >
                  {stepsCompleted}/3
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                Solusindo Premier · Surabaya
              </p>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={isGenerating ? undefined : onClose}
            disabled={isGenerating}
            className={cx(
              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.08] transition-all",
              isGenerating
                ? "cursor-not-allowed text-zinc-700"
                : "text-zinc-500 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="relative mx-6 mb-1 h-0.5 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${(stepsCompleted / 3) * 100}%` }}
          />
        </div>

        {/* ── Generating overlay ───────────────────────────────────────────── */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 rounded-[2rem] bg-[#0b0b14]/95 backdrop-blur-sm">
            {/* Pulsing rings */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 animate-ping rounded-full bg-emerald-500/10" />
              <div className="absolute h-20 w-20 animate-pulse rounded-full bg-emerald-500/15" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
                <Sparkles className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[17px] font-black text-white">Membuat Invoice…</p>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                Dokumen PDF sedang disiapkan
              </p>
            </div>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div
          className={cx(
            "flex-1 overflow-y-auto overscroll-contain",
            isGenerating && "pointer-events-none select-none",
          )}
        >
          <div className="space-y-1 px-6 pb-6 pt-5">

            {/* ════ STEP 1 · TRANSAKSI ════════════════════════════════════ */}
            <div className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/[0.06]">
              <StepLabel n={1} label="Pilih Transaksi" done={step1Done} />

              {/* ── Selected card ── */}
              {selectedTrx ? (
                <div className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
                  {/* Photo */}
                  <div className="relative h-36 w-full bg-zinc-900">
                    {selectedTrx.foto_url ? (
                      <img
                        src={selectedTrx.foto_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Building2 className="h-10 w-10 text-zinc-700" />
                      </div>
                    )}
                    {/* Photo overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Harga badge */}
                    <div className="absolute bottom-3 left-3 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {selectedTrx.label_harga}
                      </p>
                      <p className="text-[14px] font-black text-white">
                        {fmtRupiah(selectedTrx.harga)}
                      </p>
                    </div>
                  </div>
                  {/* Details row */}
                  <div className="flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-white">
                        {selectedTrx.alamat_property ?? selectedTrx.judul_property}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                        <User className="h-3 w-3 shrink-0" />
                        <span>{selectedTrx.nama_agent}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{fmtTanggal(selectedTrx.tanggal_transaksi)}</span>
                      </div>
                    </div>
                    {/* Ganti button */}
                    <button
                      type="button"
                      onClick={() => setTrxOpen(true)}
                      className="shrink-0 rounded-xl bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-zinc-400 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.09] hover:text-white"
                    >
                      Ganti
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Empty state ── */
                <button
                  type="button"
                  onClick={() => setTrxOpen(true)}
                  className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.02] py-8 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08] transition-all group-hover:bg-emerald-500/10 group-hover:ring-emerald-500/25">
                    <Building2 className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-zinc-400">Belum ada transaksi dipilih</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">Ketuk untuk memilih transaksi</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2 text-[12px] font-black text-emerald-400 ring-1 ring-emerald-500/20">
                    Pilih Transaksi
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </button>
              )}

              {/* ── Dropdown panel ── */}
              {trxOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setTrxOpen(false); setTrxSearch(""); }} />
                  <div className="absolute left-0 right-0 z-20 mx-0 mt-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d18] shadow-[0_24px_64px_rgba(0,0,0,0.9)]"
                    style={{ top: "calc(100% - 0px)" }}
                  >
                    {/* Search */}
                    <div className="border-b border-white/[0.06] p-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          autoFocus
                          value={trxSearch}
                          onChange={(e) => setTrxSearch(e.target.value)}
                          placeholder="Cari alamat atau nama agent…"
                          className="w-full rounded-xl bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-zinc-600 outline-none ring-1 ring-white/[0.06] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/30"
                        />
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-64 overflow-y-auto">
                      {isFetchingTrx ? (
                        <div className="flex items-center justify-center gap-2.5 py-8 text-[13px] text-zinc-500">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                          Memuat data transaksi…
                        </div>
                      ) : filteredTrx.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8">
                          <Search className="h-6 w-6 text-zinc-700" />
                          <p className="text-[12px] text-zinc-600">
                            {trxSearch ? "Tidak ditemukan" : "Belum ada transaksi"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-px p-2">
                          {filteredTrx.map((t) => {
                            const isActive = selectedTrx?.id === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => { setSelectedTrx(t); setTrxOpen(false); setTrxSearch(""); }}
                                className={cx(
                                  "flex w-full items-center gap-3.5 rounded-xl p-3 text-left transition-all",
                                  isActive
                                    ? "bg-emerald-500/12 ring-1 ring-emerald-500/25"
                                    : "hover:bg-white/[0.04]",
                                )}
                              >
                                {/* Photo */}
                                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                                  {t.foto_url ? (
                                    <img src={t.foto_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Building2 className="h-6 w-6 text-zinc-600" />
                                    </div>
                                  )}
                                  {isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 backdrop-blur-[1px]">
                                      <Check className="h-5 w-5 text-white" strokeWidth={3} />
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-bold leading-snug text-white">
                                    {t.alamat_property ?? t.judul_property}
                                  </p>
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{t.nama_agent}</span>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-600">
                                      {fmtTanggal(t.tanggal_transaksi)}
                                    </span>
                                    <span className="text-[12px] font-black text-emerald-400">
                                      {fmtRupiah(t.harga)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ════ STEP 2 · PENERIMA ═════════════════════════════════════ */}
            <div className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/[0.06]">
              <StepLabel n={2} label="Data Penerima" done={step2Done} />

              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  value={values.nama_pembeli}
                  onChange={(e) => upd("nama_pembeli", e.target.value.toUpperCase())}
                  placeholder="NAMA LENGKAP ATAU NAMA PERUSAHAAN"
                  className="w-full rounded-2xl bg-white/[0.04] py-4 pl-11 pr-4 text-[14px] font-semibold text-white placeholder:text-zinc-700 outline-none ring-1 ring-white/[0.07] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* ════ STEP 3 · DETAIL TAGIHAN ═══════════════════════════════ */}
            <div className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/[0.06]">
              <StepLabel n={3} label="Detail Tagihan" done={step3Done} />

              <div className="space-y-3">
                {/* Keterangan */}
                <textarea
                  rows={3}
                  value={values.keterangan}
                  onChange={(e) => upd("keterangan", e.target.value)}
                  placeholder="Uraian pekerjaan / jasa yang ditagihkan…"
                  className="w-full resize-none rounded-2xl bg-white/[0.04] px-4 py-3.5 text-[13px] text-white placeholder:text-zinc-700 outline-none ring-1 ring-white/[0.07] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/40"
                />

                {/* Nilai input */}
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-black text-zinc-500">
                    Rp
                  </span>
                  <input
                    value={nilaiNum > 0 ? nilaiNum.toLocaleString("id-ID") : ""}
                    onChange={(e) => upd("nilai", e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="w-full rounded-2xl bg-white/[0.04] py-4 pl-12 pr-4 text-[20px] font-black tracking-tight text-white placeholder:text-zinc-700 outline-none ring-1 ring-white/[0.07] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/40"
                  />
                </div>

                {/* Total summary */}
                {nilaiNum > 0 && (
                  <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/[0.12] to-emerald-600/[0.06] ring-1 ring-emerald-500/20">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500/60">
                          Total Tagihan
                        </p>
                        <p className="mt-1 text-[22px] font-black tracking-tight text-emerald-300">
                          {fmtRupiah(nilaiNum)}
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
                        <Check className="h-5 w-5 text-emerald-400" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0b0b14] px-6 py-4">
          {/* Subtle top glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="flex items-center gap-3">
            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className={cx(
                "flex h-13 items-center rounded-2xl px-5 py-3.5 text-[13px] font-bold ring-1 ring-white/[0.08] transition-all",
                isGenerating
                  ? "cursor-not-allowed text-zinc-700"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              Batal
            </button>

            {/* Generate CTA */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isGenerating}
              className={cx(
                "relative flex flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl py-3.5 text-[14px] font-black transition-all duration-300",
                isGenerating
                  ? "cursor-not-allowed bg-emerald-600/80 text-black"
                  : canSubmit
                    ? "bg-emerald-500 text-black shadow-[0_4px_24px_rgba(52,211,153,0.35)] hover:bg-emerald-400 hover:shadow-[0_6px_32px_rgba(52,211,153,0.45)] active:scale-[0.98]"
                    : "cursor-not-allowed bg-white/[0.05] text-zinc-600 ring-1 ring-white/[0.06]",
              )}
            >
              {/* Shimmer on active */}
              {canSubmit && !isGenerating && (
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
              )}

              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membuat PDF…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Invoice
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
