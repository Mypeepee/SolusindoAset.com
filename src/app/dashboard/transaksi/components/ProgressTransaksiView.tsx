"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DetailItem = { role: string; agentNama: string; pendapatan: number };

type TransaksiRow = {
  id: string;
  kode: string;
  status: string;
  jenis: string;
  tipeKomisi: string;
  hargaDeal: number;
  hargaPromoDeal: number;
  hargaBidding: number;
  maksimumBidding: number;
  mouGenerated: boolean;
  invoiceUtmGenerated: boolean;
  nilaiTransaksi: number;
  tanggal: string;
  dibuat: string;
  agentNama: string;
  agentKantor: string;
  agentFoto: string;
  klienNama: string | null;
  listingId: string;
  listingJudul: string;
  listingGambar: string;
  listingAlamat: string;
  listingKota: string;
  pendapatanKantor: number;
  thcAgent: number;
  komisiPersentase: number;
  biayaBaliknama: number;
  biayaPengosongan: number;
  royaltyFee: number;
  cobrokeFee: number;
  catatan: string | null;
  rating: number | null;
  comment: string | null;
  detail: DetailItem[];
};

type Stats = {
  total: number;
  totalNilai: number;
  inProgress: number;
  selesai: number;
};

// ── Stage pipeline config ─────────────────────────────────────────────────────

type StageItem = { id: string; label: string; icon: string };

// Satu pipeline untuk semua jenis transaksi setelah closing dikonfirmasi
const STAGES_CLOSING: StageItem[] = [
  { id: "closing",               label: "Closing",       icon: "solar:handshake-bold-duotone" },
  { id: "pengurusan_balik_nama", label: "Balik Nama",    icon: "solar:document-text-bold-duotone" },
  { id: "pelaksanaan_eksekusi",  label: "Eksekusi",      icon: "solar:home-bold-duotone" },
  { id: "serah_terima_kunci",    label: "Serah Terima",  icon: "solar:key-bold-duotone" },
];

// Status yang masuk pipeline closing
const CLOSING_STATUSES = new Set([
  "closing", "pengurusan_balik_nama", "balik_nama_selesai",
  "pengurusan_risalah_lelang", "risalah_lelang_selesai",
  "mediasi", "mediasi_gagal", "permohonan_eksekusi",
  "aanmaning", "penetapan", "rakor",
  "pelaksanaan_eksekusi", "serah_terima_kunci", "selesai",
]);

// Status terminal negatif
const TERMINAL_STATUSES = new Set(["kalah", "batal"]);

function isClosingPipeline(status: string) { return CLOSING_STATUSES.has(status); }
function isTerminal(status: string) { return TERMINAL_STATUSES.has(status); }
function isPending(status: string) { return status === "proses" || status === "pending" || status === "uang_tanda_jaminan"; }

function getStageIdx(stages: StageItem[], status: string): number {
  const idx = stages.findIndex((s) => s.id === status);
  return idx >= 0 ? idx : 0;
}

// Stage pills untuk filter
type PillItem = { id: string; label: string };

function getStagePills(): PillItem[] {
  return [
    { id: "ALL",                  label: "Semua" },
    { id: "proses",               label: "Proses" },
    { id: "closing",              label: "Closing" },
    { id: "pelaksanaan_eksekusi", label: "Eksekusi" },
    { id: "serah_terima_kunci",   label: "Serah Terima" },
    { id: "selesai",              label: "Selesai" },
    { id: "kalah",                label: "Kalah" },
    { id: "batal",                label: "Batal" },
  ];
}

// ── Jenis dropdown config ─────────────────────────────────────────────────────

type JenisKey = "ALL" | "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";

const JENIS_OPTS: Array<{
  id: JenisKey;
  label: string;
  desc: string;
  icon: string;
  dot: string;
  activeBg: string;
  activeText: string;
  activeRing: string;
  optBg: string;
  optText: string;
}> = [
  {
    id: "ALL", label: "Semua Jenis", desc: "Tampilkan semua jenis",
    icon: "solar:layers-bold-duotone",
    dot: "bg-zinc-400", activeBg: "bg-zinc-800", activeText: "text-zinc-200", activeRing: "ring-zinc-600/40",
    optBg: "hover:bg-zinc-800/60", optText: "text-zinc-200",
  },
  {
    id: "PRIMARY", label: "Primary", desc: "Properti baru dari developer",
    icon: "solar:home-2-bold-duotone",
    dot: "bg-emerald-400", activeBg: "bg-emerald-500/18", activeText: "text-emerald-200", activeRing: "ring-emerald-500/30",
    optBg: "hover:bg-emerald-500/10", optText: "text-emerald-200",
  },
  {
    id: "SECONDARY", label: "Secondary", desc: "Properti bekas / resale",
    icon: "solar:buildings-3-bold-duotone",
    dot: "bg-blue-400", activeBg: "bg-blue-500/18", activeText: "text-blue-200", activeRing: "ring-blue-500/30",
    optBg: "hover:bg-blue-500/10", optText: "text-blue-200",
  },
  {
    id: "LELANG", label: "Lelang", desc: "Properti lelang / auction",
    icon: "solar:tag-price-bold-duotone",
    dot: "bg-amber-400", activeBg: "bg-amber-500/18", activeText: "text-amber-200", activeRing: "ring-amber-500/30",
    optBg: "hover:bg-amber-500/10", optText: "text-amber-200",
  },
  {
    id: "SEWA", label: "Sewa", desc: "Properti sewa / rental",
    icon: "solar:key-bold-duotone",
    dot: "bg-violet-400", activeBg: "bg-violet-500/18", activeText: "text-violet-200", activeRing: "ring-violet-500/30",
    optBg: "hover:bg-violet-500/10", optText: "text-violet-200",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShort(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}Jt`;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}


function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Jenis badge config ────────────────────────────────────────────────────────

const JENIS: Record<string, { label: string; cls: string }> = {
  PRIMARY:   { label: "Primary",   cls: "bg-emerald-400/12 text-emerald-200 ring-emerald-500/20" },
  SECONDARY: { label: "Secondary", cls: "bg-blue-400/12 text-blue-200 ring-blue-500/20" },
  LELANG:    { label: "Lelang",    cls: "bg-amber-400/12 text-amber-200 ring-amber-500/20" },
  SEWA:      { label: "Sewa",      cls: "bg-purple-400/12 text-purple-200 ring-purple-500/20" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: "cyan" | "emerald" | "amber" | "violet";
}) {
  const c = {
    cyan: {
      bg:      "bg-gradient-to-br from-cyan-500/[0.22] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-cyan-500/25",
      glow:    "bg-cyan-400/30",
      iconBg:  "bg-cyan-500/20 ring-1 ring-cyan-400/30",
      iconTxt: "text-cyan-300",
      val:     "text-cyan-100",
      subTxt:  "text-cyan-300/50",
    },
    emerald: {
      bg:      "bg-gradient-to-br from-emerald-500/[0.22] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-emerald-500/25",
      glow:    "bg-emerald-400/30",
      iconBg:  "bg-emerald-500/20 ring-1 ring-emerald-400/30",
      iconTxt: "text-emerald-300",
      val:     "text-emerald-100",
      subTxt:  "text-emerald-300/50",
    },
    amber: {
      bg:      "bg-gradient-to-br from-amber-500/[0.20] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-amber-500/22",
      glow:    "bg-amber-400/28",
      iconBg:  "bg-amber-500/20 ring-1 ring-amber-400/28",
      iconTxt: "text-amber-300",
      val:     "text-amber-100",
      subTxt:  "text-amber-300/50",
    },
    violet: {
      bg:      "bg-gradient-to-br from-violet-500/[0.20] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-violet-500/22",
      glow:    "bg-violet-400/28",
      iconBg:  "bg-violet-500/20 ring-1 ring-violet-400/28",
      iconTxt: "text-violet-300",
      val:     "text-violet-100",
      subTxt:  "text-violet-300/50",
    },
  }[color];

  return (
    <div className={cx("relative overflow-hidden rounded-2xl p-4", c.bg, c.ring)}>
      {/* Corner glow */}
      <div className={cx("pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-70", c.glow)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
          <p className={cx("mt-2 text-[22px] font-black leading-none", c.val)}>{value}</p>
          {sub && <p className={cx("mt-1.5 text-[11px] font-semibold", c.subTxt)}>{sub}</p>}
        </div>
        <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", c.iconBg)}>
          <Icon icon={icon} className={cx("text-2xl", c.iconTxt)} />
        </div>
      </div>
    </div>
  );
}

function StageStepper({
  stages,
  status,
  onChange,
}: {
  stages: StageItem[];
  status: string;
  onChange: (s: string) => void;
}) {
  const currentIdx = getStageIdx(stages, status);
  const done_all   = status === "selesai";

  return (
    <div className="flex items-start">
      {stages.map((stage, idx) => {
        const done   = done_all || idx < currentIdx;
        const active = !done_all && idx === currentIdx;
        const last   = idx === stages.length - 1;

        return (
          <div key={stage.id} className="flex flex-1 min-w-0 items-start">
            <div className="flex flex-1 min-w-0 flex-col items-center">
              <div className="flex w-full items-center">
                {/* left connector */}
                <div className={cx(
                  "h-0.5 flex-1 transition-all duration-500",
                  idx === 0 ? "invisible" : done ? "bg-emerald-500/60" : "bg-zinc-800",
                )} />

                {/* node — clickable to advance */}
                <button
                  type="button"
                  onClick={() => onChange(stage.id)}
                  title={`Tandai: ${stage.label}`}
                  className={cx(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus:outline-none",
                    done   ? "bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.40)]" : "",
                    active ? "bg-cyan-500 ring-4 ring-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,0.45)] hover:bg-cyan-400" : "",
                    !done && !active ? "border-2 border-zinc-700 bg-zinc-900 hover:border-zinc-500" : "",
                  )}
                >
                  {done
                    ? <Icon icon="solar:check-bold" className="text-sm text-white" />
                    : <Icon icon={stage.icon} className={cx("text-sm", active ? "text-white" : "text-zinc-500")} />
                  }
                  {active && <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/15" />}
                </button>

                {/* right connector */}
                <div className={cx(
                  "h-0.5 flex-1 transition-all duration-500",
                  last ? "invisible" : done ? "bg-emerald-500/60" : "bg-zinc-800",
                )} />
              </div>

              <p className={cx(
                "mt-1.5 px-0.5 text-center text-[9px] font-black leading-tight",
                done ? "text-emerald-400" : active ? "text-cyan-300" : "text-zinc-600",
              )}>
                {stage.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Decision buttons (uang_tanda_jaminan → closing / kalah / batal) ───────────

// ── Unified step-by-step proses transaksi ─────────────────────────────────────

const MOU_STEPS = [
  "Menyiapkan data MOU…",
  "Memproses template PDF…",
  "Mengunduh dokumen…",
  "Menyimpan status…",
];

const INV_STEPS = [
  "Menghitung nilai UTM…",
  "Memproses template invoice…",
  "Mengunduh invoice…",
  "Menyimpan ke database…",
];

function ProsesSteps({
  row,
  onUpdate,
}: {
  row: TransaksiRow;
  onUpdate: (status?: string) => void;
}) {
  const router = useRouter();
  const [loadingDecision, setLoadingDecision] = useState<string | null>(null);
  const [markingDoc,      setMarkingDoc]      = useState<string | null>(null);
  const [mouStep,         setMouStep]         = useState<string | null>(null);
  const [mouError,        setMouError]        = useState<string | null>(null);
  const [mouSuccess,      setMouSuccess]      = useState(false);
  const [invStep,         setInvStep]         = useState<string | null>(null);
  const [invError,        setInvError]        = useState<string | null>(null);
  const [invSuccess,      setInvSuccess]      = useState(false);
  const suratBase = `/dashboard/surat?transaksi=${row.id}`;

  const mouDone     = row.mouGenerated || mouSuccess;
  const invoiceDone = row.invoiceUtmGenerated || invSuccess;
  const allDone     = mouDone && invoiceDone;

  async function markDoc(jenis: "mou" | "invoice_utm") {
    await fetch("/api/closing/dokumen-flag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_mou: row.id, jenis }),
    }).catch((e) => console.warn("[markDoc]", e));
  }

  async function generateMouPdf(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (mouStep) return;
    setMouError(null);
    setMouSuccess(false);
    const idTrx = row.kode ?? row.id;
    setMarkingDoc("mou");
    try {
      setMouStep(MOU_STEPS[0]);
      const res = await fetch("/api/surat/generate-MOU", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_transaksi: String(idTrx) }),
      });
      setMouStep(MOU_STEPS[1]);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setMouError(err.error ?? "Gagal generate MOU. Coba lagi.");
        return;
      }
      setMouStep(MOU_STEPS[2]);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `MOU_${idTrx}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMouStep(MOU_STEPS[3]);
      await markDoc("mou");
      setMouSuccess(true);
      onUpdate();
    } catch {
      // silent
    } finally {
      setMouStep(null);
      setMarkingDoc(null);
    }
  }

  async function generateInvoicePdf(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (invStep) return;
    setInvError(null);
    setInvSuccess(false);
    const idTrx = row.kode ?? row.id;
    setMarkingDoc("invoice_utm");
    try {
      setInvStep(INV_STEPS[0]);
      const res = await fetch("/api/surat/generate-invoice-utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_transaksi: String(idTrx) }),
      });
      setInvStep(INV_STEPS[1]);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setInvError(err.error ?? "Gagal generate Invoice UTM. Coba lagi.");
        return;
      }
      setInvStep(INV_STEPS[2]);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Invoice_UTM_${idTrx}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setInvStep(INV_STEPS[3]);
      await markDoc("invoice_utm");
      setInvSuccess(true);
      onUpdate();
    } catch {
      // silent
    } finally {
      setInvStep(null);
      setMarkingDoc(null);
    }
  }

  async function decide(status: string) {
    setLoadingDecision(status);
    try {
      const res = await fetch("/api/dashboard/transaksi/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Gagal update status (${res.status})`);
      onUpdate(status);
      if (status === "closing") {
        router.push(`/closing/${row.listingId}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.";
      setMouError(msg);
    } finally {
      setLoadingDecision(null);
    }
  }

  // Progress bar pct
  const donePct = [mouDone, invoiceDone, allDone].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* ── Progress indicator ── */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2">
          {allDone
            ? <span className="relative flex h-2 w-2 shrink-0"><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            : <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" /></span>}
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
            {allDone ? "Siap konfirmasi hasil" : "Langkah diperlukan"}
          </span>
        </div>
        <span className="text-[11px] font-black text-zinc-600">{donePct}/3</span>
      </div>

      {/* ── MOU Button ── */}
      <DocButton
        done={mouDone}
        locked={false}
        loading={!!mouStep}
        loadingStep={mouStep ?? undefined}
        icon="solar:file-text-bold-duotone"
        label="Generate MOU"
        sub="Memorandum of Understanding · Kantor & Klien"
        href="#"
        color="violet"
        onGenerate={() => {}}
        onDirectClick={generateMouPdf}
      />
      {mouError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5">
          <Icon icon="solar:danger-circle-bold-duotone" className="mt-0.5 shrink-0 text-base text-red-400" />
          <p className="flex-1 text-[12px] leading-relaxed text-red-300">{mouError}</p>
          <button type="button" onClick={() => setMouError(null)} className="shrink-0 text-red-600 transition-colors hover:text-red-400">
            <Icon icon="solar:close-circle-linear" className="text-sm" />
          </button>
        </div>
      )}

      {/* ── Invoice Button (locked until MOU done) ── */}
      <DocButton
        done={invoiceDone}
        locked={!mouDone}
        loading={!!invStep}
        loadingStep={invStep ?? undefined}
        icon="solar:bill-bold-duotone"
        label="Generate Invoice UTM"
        sub="Invoice Uang Tanda Minat · Untuk Klien"
        href="#"
        color="cyan"
        onGenerate={() => {}}
        onDirectClick={generateInvoicePdf}
      />
      {invError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5">
          <Icon icon="solar:danger-circle-bold-duotone" className="mt-0.5 shrink-0 text-base text-red-400" />
          <p className="flex-1 text-[12px] leading-relaxed text-red-300">{invError}</p>
          <button type="button" onClick={() => setInvError(null)} className="shrink-0 text-red-600 transition-colors hover:text-red-400">
            <Icon icon="solar:close-circle-linear" className="text-sm" />
          </button>
        </div>
      )}

      {/* ── Hasil Transaksi ── */}
      <div className={cx(
        "overflow-hidden rounded-2xl border transition-all duration-500",
        allDone
          ? "border-zinc-700/60 bg-zinc-900/60"
          : "border-zinc-800/40 bg-zinc-950/50 opacity-50",
      )}>
        <div className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-3">
          <div className={cx(
            "grid h-7 w-7 shrink-0 place-items-center rounded-xl ring-1 transition-all duration-300",
            allDone ? "bg-emerald-500/15 ring-emerald-500/25" : "bg-zinc-800 ring-zinc-700/50",
          )}>
            <Icon
              icon={allDone ? "solar:flag-bold-duotone" : "solar:lock-bold-duotone"}
              className={cx("text-sm", allDone ? "text-emerald-300" : "text-zinc-600")}
            />
          </div>
          <div>
            <p className={cx("text-[12px] font-black", allDone ? "text-white" : "text-zinc-500")}>
              Hasil Transaksi
            </p>
            <p className="text-[10px] text-zinc-600">
              {allDone ? "Pilih hasil transaksi ini" : "Selesaikan dokumen di atas dahulu"}
            </p>
          </div>
        </div>

        {allDone && (
          <div className="space-y-2 p-3">
            {/* Closing — hero button */}
            <button
              type="button"
              disabled={!!loadingDecision}
              onClick={() => decide("closing")}
              className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl px-4 py-4 transition-all duration-300 active:scale-[0.985] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.25) 0%, rgba(16,185,129,0.12) 50%, rgba(0,0,0,0.20) 100%)", border: "1px solid rgba(52,211,153,0.25)" }}
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="pointer-events-none absolute -left-4 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-2xl transition-all duration-500 group-hover:bg-emerald-400/30" />
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-[14px] bg-emerald-500/30 blur-md" />
                <div className="relative grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-emerald-500/40 to-emerald-700/20 ring-1 ring-emerald-400/40">
                  {loadingDecision === "closing"
                    ? <Icon icon="solar:spinner-linear" className="animate-spin text-xl text-emerald-200" />
                    : <Icon icon="solar:cup-star-bold-duotone" className="text-xl text-emerald-200" />}
                </div>
              </div>
              <div className="relative min-w-0 flex-1 text-left">
                <p className="text-[15px] font-black text-white">Closing — Menang 🏆</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {loadingDecision === "closing"
                    ? "Menyimpan & membuka halaman closing…"
                    : "Konfirmasi deal · Lanjut 4 langkah pembagian fee"}
                </p>
              </div>
              <div className="relative flex shrink-0 flex-col items-center gap-0.5">
                <Icon
                  icon={loadingDecision === "closing" ? "solar:spinner-linear" : "solar:arrow-right-up-bold"}
                  className={loadingDecision === "closing" ? "animate-spin text-base text-emerald-300" : "text-base text-emerald-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"}
                />
                {loadingDecision !== "closing" && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">4 step</span>
                )}
              </div>
            </button>

            {/* Kalah + Batal — secondary */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "kalah", label: "Kalah Lelang", sub: "Tidak menang penawaran", icon: "solar:sad-circle-bold-duotone",
                  style: { background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.20)" }, textCls: "text-amber-200", iconCls: "bg-amber-500/12 ring-amber-500/20 text-amber-300" },
                { key: "batal", label: "Batalkan",     sub: "Transaksi dibatalkan",   icon: "solar:close-circle-bold-duotone",
                  style: { background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }, textCls: "text-red-300", iconCls: "bg-red-500/12 ring-red-500/15 text-red-300" },
              ] as const).map(({ key, label, sub, icon, style, textCls, iconCls }) => (
                <button
                  key={key}
                  type="button"
                  disabled={!!loadingDecision}
                  onClick={() => decide(key)}
                  className="group flex items-center gap-2.5 rounded-xl px-3 py-3 transition-all duration-200 active:scale-[0.97] disabled:opacity-60 hover:brightness-110"
                  style={style}
                >
                  <div className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1", iconCls)}>
                    {loadingDecision === key
                      ? <Icon icon="solar:spinner-linear" className="animate-spin text-sm" />
                      : <Icon icon={icon} className="text-sm" />}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className={cx("text-[12px] font-black", textCls)}>{label}</p>
                    <p className="text-[10px] text-zinc-600">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DocButton — tombol generate dokumen ───────────────────────────────────────

function DocButton({
  done, locked, loading, loadingStep, icon, label, sub, href, color, onGenerate, onDirectClick,
}: {
  done: boolean; locked: boolean; loading: boolean;
  loadingStep?: string;
  icon: string; label: string; sub: string; href: string;
  color: "violet" | "cyan";
  onGenerate: () => void;
  onDirectClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const palette = {
    violet: {
      from: "rgba(139,92,246,0.22)", border: "rgba(139,92,246,0.30)",
      loadingBg: "rgba(109,40,217,0.28)", loadingBorder: "rgba(139,92,246,0.55)",
      blob: "rgba(139,92,246,0.20)", ring: "rgba(139,92,246,0.35)",
      iconFrom: "rgba(139,92,246,0.50)", iconTo: "rgba(109,40,217,0.25)",
      text: "text-violet-200", glow: "rgba(139,92,246,0.40)",
      barColor: "rgba(167,139,250,0.8)", dotColor: "bg-violet-300",
    },
    cyan: {
      from: "rgba(34,211,238,0.18)", border: "rgba(34,211,238,0.28)",
      loadingBg: "rgba(8,145,178,0.28)", loadingBorder: "rgba(34,211,238,0.55)",
      blob: "rgba(34,211,238,0.15)", ring: "rgba(34,211,238,0.30)",
      iconFrom: "rgba(34,211,238,0.50)", iconTo: "rgba(8,145,178,0.25)",
      text: "text-cyan-200", glow: "rgba(34,211,238,0.35)",
      barColor: "rgba(103,232,249,0.8)", dotColor: "bg-cyan-300",
    },
  }[color];

  // ── Locked ──────────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-zinc-800/50 bg-zinc-950/40 px-4 py-4 opacity-45">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-zinc-800 ring-1 ring-zinc-700/50">
          <Icon icon="solar:lock-bold-duotone" className="text-xl text-zinc-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black text-zinc-500">{label}</p>
          <p className="mt-0.5 text-[11px] text-zinc-700">{sub}</p>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-800/60 ring-1 ring-zinc-700/40">
          <Icon icon="solar:lock-bold" className="text-xs text-zinc-700" />
        </div>
      </div>
    );
  }

  // ── Loading — premium state ──────────────────────────────────────────────────
  if (loading) {
    const isRegen = done;
    const ld = isRegen
      ? {
          bg:      "rgba(5,150,105,0.18)",
          border:  "rgba(52,211,153,0.40)",
          glow:    "rgba(52,211,153,0.25)",
          iconBg:  "linear-gradient(135deg, rgba(52,211,153,0.40) 0%, rgba(16,185,129,0.15) 100%)",
          bar:     "#6ee7b7",
          dot:     "bg-emerald-300",
          text:    "text-emerald-200",
          ring:    "rgba(52,211,153,0.18)",
          label:   "text-emerald-400",
        }
      : color === "violet"
      ? {
          bg:      "rgba(109,40,217,0.22)",
          border:  "rgba(139,92,246,0.45)",
          glow:    "rgba(139,92,246,0.25)",
          iconBg:  "linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(109,40,217,0.20) 100%)",
          bar:     "#c4b5fd",
          dot:     "bg-violet-300",
          text:    "text-violet-200",
          ring:    "rgba(139,92,246,0.18)",
          label:   "text-violet-400",
        }
      : {
          bg:      "rgba(8,145,178,0.22)",
          border:  "rgba(34,211,238,0.45)",
          glow:    "rgba(34,211,238,0.25)",
          iconBg:  "linear-gradient(135deg, rgba(34,211,238,0.45) 0%, rgba(8,145,178,0.20) 100%)",
          bar:     "#67e8f9",
          dot:     "bg-cyan-300",
          text:    "text-cyan-200",
          ring:    "rgba(34,211,238,0.18)",
          label:   "text-cyan-400",
        };

    return (
      <div
        className="relative overflow-hidden rounded-2xl select-none"
        style={{
          background: `linear-gradient(145deg, ${ld.bg} 0%, rgba(0,0,0,0.55) 100%)`,
          border: `1px solid ${ld.border}`,
          boxShadow: `0 0 32px ${ld.glow}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Sweep shimmer — uses globals.css @keyframes sp-shimmer */}
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
          style={{ animation: "sp-shimmer 2.2s ease-in-out infinite" }}
        />

        {/* Animated border glow — top edge */}
        <div
          className="absolute top-0 inset-x-[15%] h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${ld.bar}, transparent)` }}
        />

        {/* Bottom indeterminate progress bar */}
        <div className="absolute bottom-0 inset-x-0 h-[2.5px] overflow-hidden rounded-b-2xl" style={{ background: ld.ring }}>
          <div
            className="absolute inset-y-0 w-[45%] rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${ld.bar}, transparent)`,
              animation: "sp-bar 1.7s cubic-bezier(0.4,0,0.2,1) infinite",
            }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Left: logo box with pulsing glow */}
          <div className="relative shrink-0">
            <div
              className="absolute -inset-1 rounded-[16px] blur-lg animate-pulse"
              style={{ background: ld.glow, opacity: 0.7 }}
            />
            <div
              className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] ring-1"
              style={{ background: ld.iconBg, borderColor: ld.border, boxShadow: `0 0 14px ${ld.glow}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo/logopremier.svg"
                alt="logo"
                className="h-7 w-7 object-contain"
                style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }}
              />
            </div>
          </div>

          {/* Center: step text + dots */}
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-black tracking-tight text-white leading-tight">
              {loadingStep ?? "Memproses…"}
            </p>
            <div className="mt-[5px] flex items-center gap-1">
              {[0, 200, 400].map((delay) => (
                <span
                  key={delay}
                  className={cx("h-[5px] w-[5px] rounded-full", ld.dot)}
                  style={{ animation: `bounce 1.1s ease-in-out ${delay}ms infinite` }}
                />
              ))}
              <span className={cx("ml-1.5 text-[10px] font-semibold tracking-wide opacity-50", ld.label)}>
                mohon tunggu
              </span>
            </div>
          </div>

          {/* Right: proper indeterminate Material-style spinner */}
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-full blur-md animate-pulse"
              style={{ background: ld.glow, opacity: 0.5 }}
            />
            <svg
              className="relative h-9 w-9"
              viewBox="0 0 36 36"
              style={{ animation: "sp-rotate 1.4s linear infinite" }}
            >
              {/* Track */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="2.5"
              />
              {/* Indeterminate arc — stroke-dasharray animated via sp-dash */}
              <circle
                cx="18" cy="18" r="14"
                fill="none"
                strokeWidth="2.5"
                stroke={ld.bar}
                strokeLinecap="round"
                style={{ animation: "sp-dash 1.4s ease-in-out infinite", transformOrigin: "center" }}
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <a
        href={href}
        onClick={onDirectClick}
        className="group flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all duration-300 active:scale-[0.985]"
        style={{
          background: "rgba(16,185,129,0.08)",
          borderColor: "rgba(52,211,153,0.25)",
          textDecoration: "none",
          boxShadow: "0 0 20px rgba(52,211,153,0.08)",
        }}
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-[14px] bg-emerald-500/20 blur-md" />
          <div className="relative grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-emerald-500/35 to-emerald-700/15 ring-1 ring-emerald-400/35">
            <Icon icon="solar:check-circle-bold-duotone" className="text-xl text-emerald-300" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-black text-emerald-100">{label}</p>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-emerald-300 ring-1 ring-emerald-500/20">
              ✓ Selesai
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500">PDF telah diunduh · Klik untuk generate ulang</p>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 transition-all duration-200 group-hover:bg-emerald-500/20">
          <Icon icon="solar:restart-bold" className="text-xs text-emerald-400" />
        </div>
      </a>
    );
  }

  // ── Idle ────────────────────────────────────────────────────────────────────
  return (
    <a
      href={href}
      onClick={onDirectClick ?? (() => onGenerate())}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 py-4 transition-all duration-300 hover:-translate-y-px active:scale-[0.985]"
      style={{
        background: `linear-gradient(135deg, ${palette.from} 0%, rgba(0,0,0,0.25) 100%)`,
        border: `1px solid ${palette.border}`,
        textDecoration: "none",
      }}
    >
      {/* Hover shimmer */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {/* Ambient blob */}
      <div
        className="pointer-events-none absolute -left-4 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full blur-2xl transition-opacity duration-500 opacity-60 group-hover:opacity-100"
        style={{ background: palette.blob }}
      />

      {/* Icon orb */}
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-[14px] blur-md opacity-70 group-hover:opacity-100 transition-opacity duration-300" style={{ background: palette.blob }} />
        <div
          className="relative grid h-11 w-11 place-items-center rounded-[14px] ring-1 transition-transform duration-300 group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${palette.iconFrom} 0%, ${palette.iconTo} 100%)`, borderColor: palette.ring }}
        >
          <Icon icon={icon} className={cx("text-xl", palette.text)} />
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="text-[14px] font-black text-white">{label}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
      </div>

      <div
        className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 transition-all duration-200 group-hover:scale-110"
        style={{ background: palette.iconFrom, borderColor: palette.ring }}
      >
        <Icon icon="solar:arrow-right-up-bold" className={cx("text-xs transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px", palette.text)} />
      </div>
    </a>
  );
}

// ── Terminal state card (kalah / batal) ───────────────────────────────────────

function TerminalState({ status }: { status: string }) {
  const isKalah = status === "kalah";
  return (
    <div className={cx(
      "flex items-center gap-4 rounded-2xl border px-4 py-4",
      isKalah
        ? "border-amber-500/25 bg-gradient-to-r from-amber-500/[0.10] to-zinc-950"
        : "border-red-500/20 bg-gradient-to-r from-red-500/[0.08] to-zinc-950",
    )}>
      <div className={cx(
        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
        isKalah ? "bg-amber-500/15 ring-amber-500/25" : "bg-red-500/12 ring-red-500/20",
      )}>
        <Icon
          icon={isKalah ? "solar:sad-circle-bold-duotone" : "solar:close-circle-bold-duotone"}
          className={cx("text-2xl", isKalah ? "text-amber-300" : "text-red-400")}
        />
      </div>
      <div>
        <p className={cx("text-[14px] font-black", isKalah ? "text-amber-200" : "text-red-300")}>
          Transaksi {isKalah ? "Kalah" : "Dibatalkan"}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          {isKalah ? "Tidak berhasil memenangkan lelang" : "Transaksi ini telah dibatalkan"}
        </p>
      </div>
    </div>
  );
}


function TransaksiCard({
  row,
  highlighted,
  cardRef,
  onClick,
}: {
  row: TransaksiRow;
  highlighted?: boolean;
  cardRef?: React.RefCallback<HTMLButtonElement>;
  onClick: () => void;
}) {
  const batal    = row.status === "batal";
  const selesai  = row.status === "selesai";
  const jenis    = JENIS[row.jenis] ?? { label: row.jenis, cls: "bg-zinc-500/12 text-zinc-200 ring-zinc-500/20" };

  const isPersen     = row.tipeKomisi.toUpperCase() === "PERSENTASE";
  const displayPrice = isPersen ? row.maksimumBidding : row.hargaDeal;

  const STATUS_LABEL_MAP: Record<string, string> = {
    proses: "Proses",
    pending: "Proses",
    uang_tanda_jaminan: "Uang Tanda",
    closing: "Closing",
    pengurusan_balik_nama: "Balik Nama",
    pelaksanaan_eksekusi: "Eksekusi",
    serah_terima_kunci: "Serah Terima",
    selesai: "Selesai",
    kalah: "Kalah",
    batal: "Batal",
  };
  const statusLabel = STATUS_LABEL_MAP[row.status] ?? row.status.replace(/_/g, " ");
  const statusCls = batal
    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
    : selesai
      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
      : isPending(row.status)
        ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25"
        : "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/25";

  return (
    <button
      type="button"
      ref={cardRef}
      onClick={onClick}
      className={cx(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl text-left",
        "border transition-[border-color,box-shadow] duration-300 ease-out",
        highlighted
          ? "border-emerald-500/40 shadow-[0_0_0_2px_rgba(52,211,153,0.15),0_8px_32px_rgba(0,0,0,0.50)]"
          : "border-zinc-800/70 shadow-[0_2px_12px_rgba(0,0,0,0.40)]",
        "hover:border-zinc-600/80 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.55),0_0_40px_rgba(16,185,129,0.06)]",
        "active:shadow-[0_2px_8px_rgba(0,0,0,0.40)] active:border-zinc-800/70",
      )}
    >
      {/* ═══ IMAGE ZONE — explicit height container, img absolute inside ═══ */}
      <div className="relative h-44 w-full flex-shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.listingGambar}
          alt={row.listingJudul}
          style={{ display: "block", position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          className="transition-[filter] duration-500 ease-out group-hover:brightness-110"
          loading="lazy"
        />
        {/* dark gradient bottom */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
        {/* dark gradient top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-zinc-950/60 to-transparent" />
        {/* hover illuminate overlay */}
        <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-300 group-hover:bg-white/[0.03]" />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={cx("inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black backdrop-blur-sm ring-1", jenis.cls)}>
            {jenis.label}
          </span>
        </div>
        <div className="absolute right-3 top-3">
          <span className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black backdrop-blur-sm", statusCls)}>
            {batal ? <Icon icon="solar:close-circle-bold" className="text-xs" />
              : selesai ? <Icon icon="solar:check-circle-bold" className="text-xs" />
              : <Icon icon="solar:pulse-bold" className="text-xs" />}
            {statusLabel}
          </span>
        </div>

        {/* Agent — pinned bottom */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="relative shrink-0">
            <AgentAvatar foto={row.agentFoto} nama={row.agentNama} size="sm" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-[1.5px] ring-zinc-950" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-white" style={{ maxWidth: 130, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {row.agentNama}
            </p>
            {row.agentKantor && (
              <p className="truncate text-[9px] text-zinc-300/60" style={{ maxWidth: 130 }}>
                {row.agentKantor}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BODY ZONE — starts immediately, zero gap ═══ */}
      <div className="flex flex-col gap-2 bg-zinc-950 px-4 pb-4 pt-3">
        {/* Kode + tanggal */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-black tracking-wider text-cyan-300/80">
            {row.kode}
          </span>
          <span className="shrink-0 text-[10px] text-zinc-600">
            {fmtDate(row.dibuat)}
          </span>
        </div>

        {/* Alamat */}
        <div className="flex items-start gap-1.5">
          <Icon icon="solar:map-point-bold-duotone" className="mt-0.5 shrink-0 text-xs text-emerald-400/60" />
          <p className="line-clamp-2 text-[11px] leading-snug text-zinc-400">
            {row.listingAlamat || row.listingKota}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-800/60" />

        {/* Price + detail */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-black leading-none text-white">
            {fmtFull(displayPrice)}
          </p>
          <div className="flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2 py-1 ring-1 ring-zinc-700/50 transition-colors duration-200 group-hover:bg-zinc-700/70 group-hover:ring-zinc-600/60">
            <Icon icon="solar:arrow-right-up-bold" className="text-[10px] text-zinc-400 transition-colors duration-200 group-hover:text-white" />
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 transition-colors duration-200 group-hover:text-white">Detail</span>
          </div>
        </div>
      </div>

    </button>
  );
}

function AgentAvatar({
  foto,
  nama,
  size = "md",
}: {
  foto: string;
  nama: string;
  size?: "sm" | "md";
}) {
  const [imgError, setImgError] = useState(false);

  const initials = nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const dim = size === "sm"
    ? "h-9 w-9 text-[11px]"
    : "h-10 w-10 text-sm";

  const ring = size === "sm"
    ? "ring-2 ring-zinc-900"
    : "ring-2 ring-emerald-400/30";

  if (foto && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt={nama}
        className={cx("shrink-0 rounded-full object-cover shadow-lg", dim, ring)}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={cx(
      "flex shrink-0 items-center justify-center rounded-full font-black shadow-lg",
      size === "sm"
        ? "bg-gradient-to-br from-emerald-500/30 to-emerald-700/30"
        : "bg-emerald-500/20",
      dim,
      ring,
    )}>
      <span className={size === "sm" ? "text-emerald-300" : "text-emerald-300"}>
        {initials || "AG"}
      </span>
    </div>
  );
}

function DetailPanel({
  row,
  onStageChange,
}: {
  row: TransaksiRow;
  onStageChange: (id: string, status: string) => void;
}) {
  const jenis = JENIS[row.jenis] ?? { label: row.jenis, cls: "bg-zinc-500/12 text-zinc-200 ring-zinc-500/20" };

  const showDecision   = isPending(row.status) || row.status === "closing";
  const showPipeline   = isClosingPipeline(row.status);
  const showTerminal   = isTerminal(row.status);

  return (
    <div className="space-y-3">
      {/* ── Property image card ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ height: 200 }}>
        {row.listingGambar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.listingGambar}
            alt={row.listingJudul}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900">
            <Icon icon="solar:home-2-bold-duotone" className="text-5xl text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {/* Overlay content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Title + jenis */}
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black leading-tight text-white">
                {row.listingJudul}
              </h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-zinc-300">
                <Icon icon="solar:map-point-linear" className="shrink-0 text-emerald-400" />
                <span className="truncate">{row.listingKota}</span>
              </div>
            </div>
            <span
              className={cx(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1",
                jenis.cls,
              )}
            >
              {jenis.label}
            </span>
          </div>

          {/* Agent info + date strip */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AgentAvatar foto={row.agentFoto} nama={row.agentNama} />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-black text-white">{row.agentNama}</div>
                {row.agentKantor && (
                  <div className="truncate text-[10px] text-zinc-400">{row.agentKantor}</div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-bold text-zinc-300">{fmtDate(row.tanggal)}</div>
              <div className="text-[10px] font-mono text-zinc-500">{row.kode}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Proses step-by-step (uang_tanda_jaminan) ── */}
      {showDecision && (
        <ProsesSteps
          row={row}
          onUpdate={(status) => status !== undefined ? onStageChange(row.id, status) : setRefreshTick((t) => t + 1)}
        />
      )}

      {/* ── Closing pipeline stepper ── */}
      {showPipeline && (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
                <Icon icon="solar:diagram-up-bold-duotone" className="text-sm text-emerald-300" />
              </div>
              <span className="text-xs font-black text-zinc-200">Progress Closing</span>
            </div>
            <span className={cx(
              "rounded-full px-2.5 py-0.5 text-[10px] font-black capitalize",
              row.status === "selesai"
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
                : "bg-cyan-500/12 text-cyan-300 ring-1 ring-cyan-500/20",
            )}>
              {row.status.replace(/_/g, " ")}
            </span>
          </div>
          <StageStepper
            stages={STAGES_CLOSING}
            status={row.status}
            onChange={(s) => onStageChange(row.id, s)}
          />
          <p className="mt-3 text-[10px] text-zinc-600">Klik tahap untuk memperbarui progress.</p>
        </div>
      )}

      {/* ── Terminal state (kalah / batal) ── */}
      {showTerminal && <TerminalState status={row.status} />}
    </div>
  );
}

// ── Jenis Dropdown ────────────────────────────────────────────────────────────

function JenisDropdown({
  value,
  onChange,
}: {
  value: JenisKey;
  onChange: (v: JenisKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = JENIS_OPTS.find((o) => o.id === value) ?? JENIS_OPTS[0];

  return (
    <div className="relative shrink-0">
      {/* Trigger — icon+dot always, label hanya md+ */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cx(
          "flex h-[38px] items-center gap-1.5 rounded-xl border px-2.5 font-black transition-all focus:outline-none",
          open || value !== "ALL"
            ? cx("border-zinc-700", current.activeBg, current.activeText, "ring-1", current.activeRing)
            : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white",
        )}
      >
        <span className={cx("h-2 w-2 shrink-0 rounded-full", current.dot)} />
        <Icon icon={current.icon} className="shrink-0 text-base" />
        {/* Label hanya tampil di md ke atas */}
        <span className="hidden text-sm md:block">{current.label}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-[10px] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel — lebar max 240px, tidak overflow layar */}
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.72)] ring-1 ring-white/5"
               style={{ maxWidth: "min(240px, calc(100vw - 24px))" }}>
            <div className="border-b border-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jenis Transaksi</p>
            </div>
            <div className="p-1.5">
              {JENIS_OPTS.map((opt) => {
                const active = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { onChange(opt.id); setOpen(false); }}
                    className={cx(
                      "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all",
                      active ? cx(opt.activeBg, "ring-1", opt.activeRing) : opt.optBg,
                    )}
                  >
                    <div className={cx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 transition-all",
                      active ? cx(opt.activeBg, opt.activeRing) : "bg-zinc-900/60 ring-zinc-800",
                    )}>
                      {/* Icon selalu berwarna sesuai jenis — bukan cuma hover */}
                      <Icon icon={opt.icon} className={cx("text-sm", opt.activeText)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cx("text-[12px] font-black leading-tight", active ? opt.activeText : "text-zinc-200")}>
                        {opt.label}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">{opt.desc}</div>
                    </div>
                    {active && <Icon icon="solar:check-bold" className={cx("shrink-0 text-xs", opt.activeText)} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Stage pills dropdown (< lg) ───────────────────────────────────────────────

function StagePillsDropdown({
  pills,
  value,
  onChange,
}: {
  pills: PillItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = pills.find((p) => p.id === value) ?? pills[0];
  const isFiltered = value !== "ALL";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cx(
          "flex h-[38px] items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-black transition-all",
          isFiltered
            ? "bg-cyan-500/18 text-cyan-200 ring-1 ring-cyan-500/30"
            : "border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white",
        )}
      >
        <Icon icon="solar:tuning-2-bold-duotone" className="shrink-0 text-sm" />
        {/* Label — max 80px agar tidak overflow */}
        <span className="max-w-[80px] truncate">{current.label}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-[10px] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel — right-0 supaya tidak overflow kanan layar */}
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.72)] ring-1 ring-white/5"
               style={{ width: "min(220px, calc(100vw - 24px))" }}>
            <div className="border-b border-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stage</p>
            </div>
            <div className="p-1.5">
              {pills.map((pill) => {
                const active = value === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => { onChange(pill.id); setOpen(false); }}
                    className={cx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-black transition-all",
                      active
                        ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25"
                        : "text-zinc-300 hover:bg-zinc-800/60",
                    )}
                  >
                    {pill.label}
                    {active && <Icon icon="solar:check-bold" className="shrink-0 text-[10px] text-cyan-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/30">
      <div className="h-44 w-full bg-zinc-800/60" />
      <div className="space-y-2.5 px-4 pb-4 pt-3">
        <div className="flex justify-between">
          <div className="h-2.5 w-24 rounded bg-zinc-800/60" />
          <div className="h-2.5 w-16 rounded bg-zinc-800/40" />
        </div>
        <div className="h-2 w-full rounded bg-zinc-800/50" />
        <div className="h-2 w-3/4 rounded bg-zinc-800/40" />
        <div className="h-px w-full rounded bg-zinc-800/30" />
        <div className="h-4 w-32 rounded bg-zinc-800/60" />
      </div>
    </div>
  );
}

function TransaksiModal({
  row,
  onClose,
  onStageChange,
}: {
  row: TransaksiRow;
  onClose: () => void;
  onStageChange: (id: string, status: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const jenis = JENIS[row.jenis] ?? { label: row.jenis, cls: "bg-zinc-500/12 text-zinc-200 ring-zinc-500/20" };

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 350);
  }

  const showDecision = isPending(row.status) || row.status === "closing";
  const showPipeline = isClosingPipeline(row.status);
  const showTerminal = isTerminal(row.status);

  const statusLabel = row.status.replace(/_/g, " ");
  const statusStyle =
    row.status === "selesai" ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" :
    row.status === "kalah"   ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/25" :
    row.status === "batal"   ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/20" :
    row.status === "closing" ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30" :
    "bg-zinc-800/80 text-zinc-400 ring-1 ring-zinc-700/50";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">

      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0 backdrop-blur-[12px] transition-opacity duration-300"
        style={{ background: "rgba(0,0,5,0.85)", opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {/* ── Sheet panel ── */}
      <div
        className={cx(
          "relative z-10 w-full sm:max-w-[440px] flex flex-col",
          "sm:rounded-[32px] rounded-t-[32px]",
          "overflow-hidden",
          "transition-[transform,opacity] duration-[380ms]",
          visible ? "translate-y-0 opacity-100" : "translate-y-[60px] opacity-0",
        )}
        style={{
          maxHeight: "94dvh",
          background: "#0a0d12",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 -4px 60px rgba(0,0,0,0.7), 0 32px 100px rgba(0,0,0,0.9)",
          transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
        }}
      >

        {/* ══ HERO IMAGE ══ */}
        <div className="relative h-[220px] w-full shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.listingGambar}
            alt={row.listingJudul}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ display: "block" }}
          />
          {/* Multi-layer gradient */}
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(to top, #0a0d12 0%, rgba(10,13,18,0.6) 35%, rgba(10,13,18,0.25) 65%, rgba(10,13,18,0.55) 100%)" }}
          />

          {/* Drag handle — mobile */}
          <div className="absolute inset-x-0 top-3 flex justify-center sm:hidden">
            <div className="h-1 w-12 rounded-full bg-white/20" />
          </div>

          {/* Top row: badge + close */}
          <div className="absolute inset-x-3 top-3 flex items-center justify-between" style={{ top: 14 }}>
            <span className={cx("inline-flex items-center rounded-xl px-3 py-1.5 text-[10px] font-black backdrop-blur-md ring-1", jenis.cls)}>
              {jenis.label}
            </span>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-90 hover:bg-black/60"
              style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              {/* SVG X langsung — tidak bergantung iconify loading */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Bottom: property info overlay */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12">
            {/* Status pill */}
            <div className="mb-2">
              <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black capitalize", statusStyle)}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {statusLabel}
              </span>
            </div>
            <h2 className="text-[17px] font-black leading-tight text-white line-clamp-2" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
              {row.listingJudul}
            </h2>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon icon="solar:map-point-bold-duotone" className="shrink-0 text-xs text-emerald-400" />
                <span className="truncate text-[11px] text-zinc-300">{row.listingAlamat || row.listingKota}</span>
              </div>
              <span className="shrink-0 font-mono text-[10px] font-black text-cyan-300/70">{row.kode}</span>
            </div>
          </div>
        </div>

        {/* ══ INFO STRIP ══ */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.025)" }}
        >
          {/* Agent */}
          <div className="relative shrink-0">
            <AgentAvatar foto={row.agentFoto} nama={row.agentNama} size="sm" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-[1.5px]" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.6)", borderColor: "#0a0d12" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-white">{row.agentNama}</p>
            {row.agentKantor && <p className="truncate text-[10px] text-zinc-600">{row.agentKantor}</p>}
          </div>
          {/* Price */}
          <div className="shrink-0 text-right">
            <p className="text-[17px] font-black text-white leading-none">{fmtShort(row.nilaiTransaksi)}</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
              {row.tipeKomisi === "PERSENTASE" ? "Maks. Bidding" : "Harga Deal"}
            </p>
          </div>
        </div>

        {/* ══ SCROLLABLE BODY ══ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "none" }}>

          {/* Proses steps — pending */}
          {showDecision && (
            <ProsesSteps
              row={row}
              onUpdate={(status) => status !== undefined ? onStageChange(row.id, status) : setRefreshTick((t) => t + 1)}
            />
          )}

          {/* Closing pipeline */}
          {showPipeline && (
            <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
                    <Icon icon="solar:route-bold-duotone" className="text-sm text-emerald-300" />
                  </div>
                  <span className="text-[12px] font-black text-white">Progress Closing</span>
                </div>
                <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-black capitalize text-cyan-300 ring-1 ring-cyan-500/25">
                  {row.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="p-4">
                <StageStepper
                  stages={STAGES_CLOSING}
                  status={row.status}
                  onChange={(s) => onStageChange(row.id, s)}
                />
                <p className="mt-3 text-[10px] text-zinc-700">Klik tahap untuk memperbarui status.</p>
              </div>
            </div>
          )}

          {/* Terminal */}
          {showTerminal && <TerminalState status={row.status} />}

          {/* Safe area bottom */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-20 rounded bg-zinc-800/60" />
          <div className="h-6 w-28 rounded bg-zinc-800/60" />
          <div className="h-2 w-16 rounded bg-zinc-800/40" />
        </div>
        <div className="h-10 w-10 rounded-2xl bg-zinc-800/50" />
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ProgressTransaksiView({ highlightKode }: { highlightKode?: string } = {}) {
  const [rows, setRows]         = useState<TransaksiRow[]>([]);
  const [stats, setStats]       = useState<Stats>({ total: 0, totalNilai: 0, inProgress: 0, selesai: 0 });
  const [loading, setLoading]   = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected, setSelected] = useState<TransaksiRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [jenisFilter, setJenisFilter] = useState<JenisKey>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [search, setSearch]     = useState("");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(highlightKode ?? null);
  const highlightRef = useRef<HTMLButtonElement | null>(null);

  function handleJenisChange(jenis: JenisKey) {
    setJenisFilter(jenis);
    setStageFilter("ALL");
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ take: "50", q: search });
        if (jenisFilter !== "ALL") params.set("jenis", jenisFilter);
        if (stageFilter !== "ALL") params.set("status", stageFilter);
        const res = await fetch(`/api/dashboard/transaksi/progress?${params}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data: TransaksiRow[] = json.data ?? [];
        if (!cancelled) {
          setRows(data);
          setStats(json.stats ?? { total: 0, totalNilai: 0, inProgress: 0, selesai: 0 });
          setSelected((prev) => {
            if (!prev) return null;
            return data.find((r) => r.id === prev.id) ?? null;
          });
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, search ? 350 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, jenisFilter, stageFilter, refreshTick]);

  useEffect(() => {
    if (!highlightKode || loading || rows.length === 0) return;
    const match = rows.find((r) => r.kode === highlightKode);
    if (!match) return;
    setSelected(match);
    setActiveHighlight(highlightKode);
    setModalOpen(true);
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const t = setTimeout(() => setActiveHighlight(null), 3000);
    return () => clearTimeout(t);
  }, [highlightKode, loading, rows]);

  async function handleStageChange(id: string, status: string) {
    const update = (r: TransaksiRow) => (r.id === id ? { ...r, status } : r);
    setRows((prev) => prev.map(update));
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    if (status === "SELESAI") {
      setStats((prev) => ({ ...prev, selesai: prev.selesai + 1, inProgress: Math.max(0, prev.inProgress - 1) }));
    }
    await fetch("/api/dashboard/transaksi/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  function openDetail(row: TransaksiRow) {
    setSelected(row);
    setModalOpen(true);
  }

  const stagePills = getStagePills();

  return (
    <div className="space-y-4">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <KpiCard
              icon="solar:dollar-minimalistic-bold-duotone"
              label="Total Nilai Deal"
              value={fmtShort(stats.totalNilai)}
              sub={`${stats.total} transaksi`}
              color="cyan"
            />
            <KpiCard
              icon="solar:bill-list-bold-duotone"
              label="Total Closing"
              value={String(stats.total)}
              sub="keseluruhan"
              color="violet"
            />
            <KpiCard
              icon="solar:layers-bold-duotone"
              label="Dalam Proses"
              value={String(stats.inProgress)}
              sub="sedang berjalan"
              color="amber"
            />
            <KpiCard
              icon="solar:verified-check-bold-duotone"
              label="Selesai"
              value={String(stats.selesai)}
              sub="terjual / akad"
              color="emerald"
            />
          </>
        )}
      </div>

      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon
            icon="solar:magnifer-linear"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari…"
            className="h-[38px] w-full rounded-xl border border-zinc-800 bg-zinc-950/60 pl-8 pr-7 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-200"
            >
              <Icon icon="solar:close-circle-linear" className="text-sm" />
            </button>
          )}
        </div>

        <JenisDropdown value={jenisFilter} onChange={handleJenisChange} />

        <div className="hidden items-center gap-1 lg:flex">
          {stagePills.map((pill) => {
            const active = stageFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStageFilter(pill.id)}
                className={cx(
                  "whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-black transition-all",
                  active
                    ? "bg-cyan-500/18 text-cyan-200 ring-1 ring-cyan-500/30"
                    : "bg-zinc-900/60 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200",
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="lg:hidden">
          <StagePillsDropdown
            pills={stagePills}
            value={stageFilter}
            onChange={setStageFilter}
          />
        </div>
      </div>

      {/* ── Cards grid ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl border border-zinc-800 bg-zinc-950/40">
            <Icon icon="solar:bill-list-bold-duotone" className="text-3xl text-zinc-400" />
          </div>
          <div className="mt-3 text-sm font-black text-white">Tidak ada transaksi</div>
          <p className="mt-1 text-xs text-zinc-500">
            {search ? `Tidak ditemukan hasil untuk "${search}".` : "Belum ada transaksi yang tersimpan."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <TransaksiCard
              key={row.id}
              row={row}
              highlighted={activeHighlight === row.kode}
              cardRef={activeHighlight === row.kode ? (el) => { highlightRef.current = el; } : undefined}
              onClick={() => openDetail(row)}
            />
          ))}
        </div>
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {modalOpen && selected && (
        <TransaksiModal
          row={selected}
          onClose={() => setModalOpen(false)}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}
