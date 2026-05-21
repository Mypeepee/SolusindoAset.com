"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Loader2,
  Receipt,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
};

type InvoiceItem = {
  id_invoice:      string;
  id_kuitansi:     string | null;
  ditagihkan_ke:   string;
  keterangan:      string;
  nominal:         number;
  tanggal_invoice: string;
  kode_transaksi:  string | null; // mapped from id_transaksi
  alamat_property: string | null;
  foto_url:        string;
  sudah_kuitansi:  boolean;
};

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function KuitansiModal({ open, template, onClose }: Props) {
  const [mounted, setMounted]           = useState(false);
  const [isEntered, setIsEntered]       = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [invoiceList, setInvoiceList] = useState<InvoiceItem[]>([]);
  const [isFetching, setIsFetching]   = useState(false);
  const [selectedInv, setSelectedInv] = useState<InvoiceItem | null>(null);
  const [search, setSearch]           = useState("");
  const [listOpen, setListOpen]       = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      setSelectedInv(null);
      setSearch("");
      setListOpen(false);
      setIsGenerating(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const fetchInvoices = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/surat/invoice-list");
      if (res.ok) setInvoiceList(await res.json() as InvoiceItem[]);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchInvoices();
  }, [open, fetchInvoices]);

  const canSubmit = selectedInv !== null;

  const handleSubmit = async () => {
    if (!canSubmit || isGenerating || !selectedInv) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/surat/generate-kuitansi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id_invoice: selectedInv.id_invoice }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        alert(err.detail ?? "Gagal generate kuitansi. Coba lagi.");
        return;
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const nameMatch   = disposition.match(/filename="([^"]+)"/);
      const filename    = nameMatch?.[1] ?? "Kuitansi.pdf";

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (e) {
      console.error(e);
      alert("Gagal menghubungi server.");
    } finally {
      setIsGenerating(false);
    }
  };

  const filtered = invoiceList.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.id_invoice.toLowerCase().includes(q) ||
      inv.ditagihkan_ke.toLowerCase().includes(q) ||
      inv.keterangan.toLowerCase().includes(q) ||
      inv.alamat_property?.toLowerCase().includes(q)
    );
  });

  if (!open || !template || !mounted) return null;

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

      {/* Sheet */}
      <div
        className={cx(
          "relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-white/[0.07] bg-[#0b0b14]",
          "shadow-[0_-20px_80px_rgba(0,0,0,0.9)] sm:rounded-3xl sm:shadow-[0_40px_120px_rgba(0,0,0,0.95)]",
          "translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          !isEntered && "translate-y-full",
          "sm:translate-y-0 sm:transition-[opacity,transform] sm:duration-300 sm:ease-out",
          isEntered ? "sm:opacity-100 sm:scale-100" : "sm:opacity-0 sm:scale-95",
        )}
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Pull handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="relative flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-5 sm:pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
              <Receipt className="h-5 w-5 text-emerald-400" />
              <div className="absolute inset-0 rounded-2xl bg-emerald-400/5 blur-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-black tracking-tight text-white">Kuitansi Pembayaran</h2>
                <span className={cx(
                  "rounded-full px-2 py-0.5 text-[10px] font-black ring-1 transition-all duration-500",
                  canSubmit
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                    : "bg-white/5 text-zinc-500 ring-white/10",
                )}>
                  {canSubmit ? "1/1" : "0/1"}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-500">Solusindo Premier · Surabaya</p>
            </div>
          </div>

          <button
            type="button"
            onClick={isGenerating ? undefined : onClose}
            disabled={isGenerating}
            className={cx(
              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.08] transition-all",
              isGenerating ? "cursor-not-allowed text-zinc-700" : "text-zinc-500 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="relative mx-6 mb-1 h-0.5 overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: canSubmit ? "100%" : "0%" }}
          />
        </div>

        {/* ── Generating overlay ─────────────────────────────────────────────── */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 rounded-[2rem] bg-[#0b0b14]/95 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 animate-ping rounded-full bg-emerald-500/10" />
              <div className="absolute h-20 w-20 animate-pulse rounded-full bg-emerald-500/15" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
                <Sparkles className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[17px] font-black text-white">Membuat Kuitansi…</p>
              <p className="mt-1.5 text-[13px] text-zinc-500">Dokumen sedang disiapkan</p>
            </div>
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className={cx(
          "flex-1 overflow-y-auto overscroll-contain",
          isGenerating && "pointer-events-none select-none",
        )}>
          <div className="space-y-3 px-6 pb-6 pt-5">

            {/* ── Step label ── */}
            <div className="flex items-center gap-3">
              <div className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-all duration-300",
                canSubmit
                  ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                  : "bg-white/5 text-zinc-500 ring-1 ring-white/10",
              )}>
                {canSubmit ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : 1}
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
                Pilih Invoice
              </span>
              {canSubmit && (
                <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                  Selesai
                </span>
              )}
            </div>

            {/* ── Selected card ── */}
            {selectedInv && !listOpen && (
              <div className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
                {/* Photo */}
                <div className="relative h-32 w-full bg-zinc-900">
                  {selectedInv.foto_url ? (
                    <img src={selectedInv.foto_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Building2 className="h-10 w-10 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {/* Nomor invoice badge */}
                  <div className="absolute bottom-3 left-3 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="font-mono text-[10px] font-bold text-zinc-400">No. Invoice</p>
                    <p className="font-mono text-[13px] font-black text-emerald-300">{selectedInv.id_invoice}</p>
                  </div>
                  {/* Status badge */}
                  {selectedInv.sudah_kuitansi && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-500/30 backdrop-blur-sm">
                      <BadgeCheck className="h-3 w-3" />
                      Sudah Kuitansi
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 bg-white/[0.02] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Ditagihkan ke</p>
                      <p className="mt-0.5 truncate text-[14px] font-bold text-white">{selectedInv.ditagihkan_ke}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Nominal</p>
                      <p className="mt-0.5 text-[14px] font-black text-emerald-300">{fmtRupiah(selectedInv.nominal)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Keterangan</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-400">{selectedInv.keterangan}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.05] pt-2">
                    <span className="text-[11px] text-zinc-600">{fmtTanggal(selectedInv.tanggal_invoice)}</span>
                    <button
                      type="button"
                      onClick={() => setListOpen(true)}
                      className="rounded-xl bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-zinc-400 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.09] hover:text-white"
                    >
                      Ganti
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Inline picker — tampil saat belum pilih ATAU klik Ganti ── */}
            {(!selectedInv || listOpen) && (
              <div className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
                {/* Search bar */}
                <div className="border-b border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nomor invoice atau nama penerima…"
                      className="w-full rounded-xl bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-zinc-600 outline-none ring-1 ring-white/[0.06] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                {/* List — inline, no floating */}
                <div className="divide-y divide-white/[0.04]">
                  {isFetching ? (
                    <div className="flex items-center justify-center gap-2.5 py-10 text-[13px] text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                      Memuat data invoice…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <Search className="h-6 w-6 text-zinc-700" />
                      <p className="text-[12px] text-zinc-600">
                        {search ? "Tidak ditemukan" : "Belum ada invoice"}
                      </p>
                    </div>
                  ) : (
                    filtered.map((inv) => {
                      const isActive = selectedInv?.id_invoice === inv.id_invoice;
                      return (
                        <button
                          key={inv.id_invoice}
                          type="button"
                          onClick={() => { setSelectedInv(inv); setListOpen(false); setSearch(""); }}
                          className={cx(
                            "flex w-full items-stretch gap-0 text-left transition-all",
                            isActive ? "bg-emerald-500/[0.07]" : "hover:bg-white/[0.03]",
                          )}
                        >
                          {/* Photo thumbnail */}
                          <div className="relative w-[80px] shrink-0 overflow-hidden bg-zinc-900">
                            {inv.foto_url ? (
                              <img src={inv.foto_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Building2 className="h-6 w-6 text-zinc-700" />
                              </div>
                            )}
                            {/* Active checkmark overlay */}
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 backdrop-blur-[1px]">
                                <Check className="h-5 w-5 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1 px-3 py-3">
                            {/* Row 1: invoice number + status */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold text-emerald-300 leading-none">
                                {inv.id_invoice}
                              </span>
                              {inv.sudah_kuitansi && (
                                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-px text-[9px] font-black text-amber-400 ring-1 ring-amber-500/20">
                                  ✓ Kuitansi
                                </span>
                              )}
                            </div>

                            {/* Row 2: nama penerima */}
                            <p className="mt-1 truncate text-[13px] font-bold text-white leading-tight">
                              {inv.ditagihkan_ke}
                            </p>

                            {/* Row 3: keterangan */}
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500 leading-snug">
                              {inv.keterangan}
                            </p>

                            {/* Row 4: tanggal + nominal */}
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-zinc-600">
                                {fmtTanggal(inv.tanggal_invoice)}
                              </span>
                              <span className="text-[12px] font-black text-emerald-400">
                                {fmtRupiah(inv.nominal)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Cancel ganti (hanya muncul kalau sudah ada pilihan sebelumnya) */}
                {selectedInv && listOpen && (
                  <div className="border-t border-white/[0.06] bg-white/[0.02] p-2">
                    <button
                      type="button"
                      onClick={() => { setListOpen(false); setSearch(""); }}
                      className="w-full rounded-xl py-2 text-[12px] font-bold text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-zinc-300"
                    >
                      Batal ganti
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Nominal summary (hanya saat invoice terpilih & list tertutup) ── */}
            {canSubmit && !listOpen && (
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/[0.12] to-emerald-600/[0.06] ring-1 ring-emerald-500/20">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500/60">
                      Nominal Kuitansi
                    </p>
                    <p className="mt-1 text-[22px] font-black tracking-tight text-emerald-300">
                      {fmtRupiah(selectedInv!.nominal)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Nomor kuitansi di-generate otomatis
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

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0b0b14] px-6 py-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className={cx(
                "flex h-13 items-center rounded-2xl px-5 py-3.5 text-[13px] font-bold ring-1 ring-white/[0.08] transition-all",
                isGenerating ? "cursor-not-allowed text-zinc-700" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isGenerating || listOpen}
              className={cx(
                "relative flex flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-2xl py-3.5 text-[14px] font-black transition-all duration-300",
                isGenerating
                  ? "cursor-not-allowed bg-emerald-600/80 text-black"
                  : canSubmit && !listOpen
                    ? "bg-emerald-500 text-black shadow-[0_4px_24px_rgba(52,211,153,0.35)] hover:bg-emerald-400 hover:shadow-[0_6px_32px_rgba(52,211,153,0.45)] active:scale-[0.98]"
                    : "cursor-not-allowed bg-white/[0.05] text-zinc-600 ring-1 ring-white/[0.06]",
              )}
            >
              {canSubmit && !isGenerating && !listOpen && (
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
              )}
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Membuat Kuitansi…</>
              ) : (
                <><Sparkles className="h-4 w-4" />Generate Kuitansi<ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
