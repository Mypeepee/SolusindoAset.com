"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  FileText,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  // onSubmit boleh async — modal akan track loading state sendiri
  onSubmit?: (payload: { template: SuratTemplate; values: Record<string, string> }) => Promise<void> | void;
};

type ScanStatus = "idle" | "valid" | "review" | "invalid";

type OcrKtpResult = {
  raw_text?: string;
  confidence?: number;
  score?: number;
  status?: ScanStatus;
  warnings?: string[];
  parsed?: {
    nama?: string;
    nik?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    alamat_lengkap?: string;
  };
};

type OcrRisalahResult = {
  raw_text?: string;
  confidence?: number;
  score?: number;
  status?: ScanStatus;
  warnings?: string[];
  parsed?: {
    nomor_risalah?:  string;
    tanggal_risalah?: string;
    pejabat_lelang?: string;
    pukul?:          string;
    nip?:            string;
    uraian?:         string;
  };
};

type FormValues = {
  // Files
  fileKtpPemohon: string;
  fileKtpKuasa:   string;
  fileRisalah:    string;

  bertindakSebagai: "sendiri" | "kuasa";

  // Data KTP Pemohon (selalu ada)
  nama_pemohon:        string;
  nik_pemohon:         string;
  tempatlahir_pemohon: string;
  tanggallahir_pemohon: string;
  alamat_pemohon:      string;

  // Data KTP Kuasa (hanya jika menggunakan kuasa)
  nama_kuasa:         string;
  nik_kuasa:          string;
  tempatlahir_kuasa:  string;
  tanggallahir_kuasa: string;
  alamat_kuasa:       string;

  // Data Risalah (dari OCR)
  nomor_risalah:    string;
  tanggal_risalah:  string;
  pejabat_lelang:   string;
  pukul_lelang:     string;
  nip_pejabat:      string;
  uraian_risalah:   string;
};

const EMPTY: FormValues = {
  fileKtpPemohon: "", fileKtpKuasa: "", fileRisalah: "",
  bertindakSebagai: "sendiri",
  nama_pemohon: "", nik_pemohon: "", tempatlahir_pemohon: "", tanggallahir_pemohon: "", alamat_pemohon: "",
  nama_kuasa: "", nik_kuasa: "", tempatlahir_kuasa: "", tanggallahir_kuasa: "", alamat_kuasa: "",
  nomor_risalah: "", tanggal_risalah: "", pejabat_lelang: "", pukul_lelang: "", nip_pejabat: "", uraian_risalah: "",
};

// ── Accent color map ──────────────────────────────────────────────────────────

type AccentColor = "cyan" | "violet" | "amber";

const ACCENT: Record<AccentColor, { idle: string; hover: string; drag: string; success: string; iconRing: string; iconText: string; badge: string; chip: string }> = {
  cyan: {
    idle:     "border-zinc-800/70 bg-zinc-900/40",
    hover:    "hover:border-cyan-500/55 hover:bg-cyan-500/[0.04] hover:shadow-[0_0_40px_rgba(6,182,212,0.13)]",
    drag:     "border-cyan-400/90 bg-cyan-500/[0.08] shadow-[0_0_60px_rgba(6,182,212,0.22)]",
    success:  "border-cyan-500/55 bg-cyan-500/[0.05] shadow-[0_0_30px_rgba(6,182,212,0.11)]",
    iconRing: "bg-cyan-500/12 ring-1 ring-cyan-500/30",
    iconText: "text-cyan-400",
    badge:    "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/25",
    chip:     "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  },
  violet: {
    idle:     "border-zinc-800/70 bg-zinc-900/40",
    hover:    "hover:border-violet-500/55 hover:bg-violet-500/[0.04] hover:shadow-[0_0_40px_rgba(139,92,246,0.13)]",
    drag:     "border-violet-400/90 bg-violet-500/[0.08] shadow-[0_0_60px_rgba(139,92,246,0.22)]",
    success:  "border-violet-500/55 bg-violet-500/[0.05] shadow-[0_0_30px_rgba(139,92,246,0.11)]",
    iconRing: "bg-violet-500/12 ring-1 ring-violet-500/30",
    iconText: "text-violet-400",
    badge:    "bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/25",
    chip:     "border-violet-500/25 bg-violet-500/10 text-violet-300",
  },
  amber: {
    idle:     "border-zinc-800/70 bg-zinc-900/40",
    hover:    "hover:border-amber-500/55 hover:bg-amber-500/[0.04] hover:shadow-[0_0_40px_rgba(245,158,11,0.13)]",
    drag:     "border-amber-400/90 bg-amber-500/[0.08] shadow-[0_0_60px_rgba(245,158,11,0.22)]",
    success:  "border-amber-500/55 bg-amber-500/[0.05] shadow-[0_0_30px_rgba(245,158,11,0.11)]",
    iconRing: "bg-amber-500/12 ring-1 ring-amber-500/30",
    iconText: "text-amber-400",
    badge:    "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/25",
    chip:     "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
};

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PremiumDropzone({
  label, sublabel, accept, acceptLabel, color, Icon,
  filename, loading, status, onFile, className = "",
}: {
  label: string; sublabel: string; accept: string; acceptLabel: string;
  color: AccentColor; Icon: React.ElementType;
  filename?: string; loading?: boolean; status?: ScanStatus;
  onFile: (f: File) => void | Promise<void>; className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const a = ACCENT[color];
  const hasFile = Boolean(filename);

  const stateClass = loading ? `${a.idle} opacity-80`
    : dragging ? a.drag
    : hasFile && status !== "invalid" ? a.success
    : a.idle;

  const handleRaw = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Ukuran file maksimal 10 MB."); return; }
    await onFile(file);
  };

  return (
    <div
      className={cx("group relative cursor-pointer select-none rounded-2xl border border-dashed transition-all duration-300", stateClass, !loading && !hasFile && a.hover, className)}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleRaw(e.dataTransfer.files?.[0]); }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)" }} />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-7 text-center">
        <div className={cx("grid h-12 w-12 place-items-center rounded-2xl transition-all duration-300", a.iconRing, dragging && "scale-110")}>
          {loading ? <Loader2 className={cx("h-5 w-5 animate-spin", a.iconText)} />
            : hasFile && status !== "invalid" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            : <Icon className={cx("h-5 w-5 transition-all duration-300 group-hover:scale-110", a.iconText)} />}
        </div>
        <div className="space-y-0.5">
          <p className="text-[13px] font-bold text-white">{label}</p>
          <p className="text-[11px] leading-relaxed text-zinc-500">{sublabel}</p>
        </div>
        {hasFile ? (
          <div className={cx("inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold", a.chip)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 shrink-0" />
            <span className="truncate max-w-[140px]">{filename}</span>
          </div>
        ) : loading ? (
          <p className="text-[11px] text-zinc-500">Menganalisis dokumen…</p>
        ) : (
          <span className={cx("rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1", a.badge)}>{acceptLabel}</span>
        )}
        {!hasFile && !loading && (
          <p className="text-[10px] text-zinc-600 transition-colors group-hover:text-zinc-500">
            {dragging ? "Lepaskan file di sini" : "Klik atau seret & lepas"}
          </p>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { void handleRaw(e.target.files?.[0]); e.currentTarget.value = ""; }} />
    </div>
  );
}

function ModeToggle({ value, onChange }: { value: "sendiri" | "kuasa"; onChange: (v: "sendiri" | "kuasa") => void }) {
  return (
    <div className="flex gap-2">
      {(["sendiri", "kuasa"] as const).map((mode) => {
        const active   = value === mode;
        const isSend   = mode === "sendiri";
        const label    = isSend ? "Atas Nama Sendiri" : "Menggunakan Kuasa";
        const sublabel = isSend ? "Pemohon = pemilik aset" : "Mewakili pemilik aset";
        const accent   = isSend ? "cyan" : "violet";
        const activeCls = accent === "cyan"
          ? "border-cyan-500/50 bg-cyan-500/[0.08] text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
          : "border-violet-500/50 bg-violet-500/[0.08] text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.12)]";
        return (
          <button key={mode} type="button" onClick={() => onChange(mode)}
            className={cx(
              "flex-1 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
              active ? activeCls : "border-zinc-800/70 bg-zinc-900/40 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
            )}>
            <p className="text-[13px] font-bold">{label}</p>
            <p className={cx("text-[11px] mt-0.5", active ? "opacity-70" : "text-zinc-600")}>{sublabel}</p>
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{label}</p>;
}

function KtpCard({
  title, color, scanStatus, confidence, score, warnings, children,
}: {
  title: string; color: AccentColor; scanStatus: ScanStatus;
  confidence: number; score: number; warnings: string[];
  children: React.ReactNode;
}) {
  const borderColor = color === "cyan" ? "border-cyan-500/20" : "border-violet-500/20";
  const badgeColor =
    scanStatus === "valid"   ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" :
    scanStatus === "review"  ? "border-amber-500/20 bg-amber-500/10 text-amber-300" :
    scanStatus === "invalid" ? "border-red-500/20 bg-red-500/10 text-red-300" : "";

  return (
    <div className={cx("rounded-2xl border bg-zinc-900/40 overflow-hidden", borderColor)}>
      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
        <p className="text-[12px] font-black text-white">{title}</p>
        {scanStatus !== "idle" && (
          <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", badgeColor)}>
            {scanStatus === "valid" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {scanStatus === "valid" ? "Valid" : scanStatus === "review" ? "Perlu Review" : "Tidak Terbaca"}
          </span>
        )}
        {confidence > 0 && (
          <span className="ml-auto text-[10px] text-zinc-500">OCR {Math.round(confidence * 100)}% · Score {score}</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.08] px-3 py-2">
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-200">• {w}</p>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">{label}</label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10" />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">{label}</label>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 resize-none" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SuratTemplateModal({ open, template, onClose, onSubmit }: Props) {
  const [mounted, setMounted] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errorMsg, setErrorMsg] = useState("");

  const [isGenerating,   setIsGenerating]   = useState(false);
  const [loadingPemohon, setLoadingPemohon] = useState(false);
  const [loadingKuasa,   setLoadingKuasa]   = useState(false);
  const [loadingRisalah, setLoadingRisalah] = useState(false);

  const [pemohonStatus,  setPemohonStatus]  = useState<ScanStatus>("idle");
  const [pemohonConf,    setPemohonConf]    = useState(0);
  const [pemohonScore,   setPemohonScore]   = useState(0);
  const [pemohonWarns,   setPemohonWarns]   = useState<string[]>([]);

  const [kuasaStatus,    setKuasaStatus]    = useState<ScanStatus>("idle");
  const [kuasaConf,      setKuasaConf]      = useState(0);
  const [kuasaScore,     setKuasaScore]     = useState(0);
  const [kuasaWarns,     setKuasaWarns]     = useState<string[]>([]);

  const [risalahStatus,  setRisalahStatus]  = useState<ScanStatus>("idle");
  const [risalahConf,    setRisalahConf]    = useState(0);
  const [risalahScore,   setRisalahScore]   = useState(0);
  const [risalahWarns,   setRisalahWarns]   = useState<string[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      setValues(EMPTY); setErrorMsg(""); setIsGenerating(false);
      setLoadingPemohon(false); setLoadingKuasa(false); setLoadingRisalah(false);
      setPemohonStatus("idle"); setPemohonConf(0); setPemohonScore(0); setPemohonWarns([]);
      setKuasaStatus("idle");   setKuasaConf(0);   setKuasaScore(0);   setKuasaWarns([]);
      setRisalahStatus("idle"); setRisalahConf(0); setRisalahScore(0); setRisalahWarns([]);
    }
  }, [open, template?.id]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const upd = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  // ── OCR handlers ──────────────────────────────────────────────────────

  const handleKtpPemohon = async (file: File) => {
    upd("fileKtpPemohon", file.name);
    setErrorMsg(""); setLoadingPemohon(true);
    setPemohonStatus("idle"); setPemohonConf(0); setPemohonScore(0); setPemohonWarns([]);
    try {
      const ocr = (await ocrKTP(file)) as OcrKtpResult;
      const p = ocr.parsed ?? {};
      upd("nama_pemohon",         p.nama          ?? "");
      upd("nik_pemohon",          p.nik           ?? "");
      upd("tempatlahir_pemohon",  p.tempat_lahir  ?? "");
      upd("tanggallahir_pemohon", p.tanggal_lahir ?? "");
      upd("alamat_pemohon",       p.alamat_lengkap ?? "");
      setPemohonStatus(ocr.status ?? "invalid");
      setPemohonConf(Number(ocr.confidence ?? 0));
      setPemohonScore(Number(ocr.score ?? 0));
      setPemohonWarns(ocr.warnings ?? []);
      if (ocr.warnings?.length) setErrorMsg(ocr.warnings[0]);
    } catch {
      setPemohonStatus("invalid");
      setErrorMsg("Gagal membaca KTP pemohon. Pastikan gambar jelas.");
    } finally { setLoadingPemohon(false); }
  };

  const handleKtpKuasa = async (file: File) => {
    upd("fileKtpKuasa", file.name);
    setErrorMsg(""); setLoadingKuasa(true);
    setKuasaStatus("idle"); setKuasaConf(0); setKuasaScore(0); setKuasaWarns([]);
    try {
      const ocr = (await ocrKTP(file)) as OcrKtpResult;
      const p = ocr.parsed ?? {};
      upd("nama_kuasa",         p.nama          ?? "");
      upd("nik_kuasa",          p.nik           ?? "");
      upd("tempatlahir_kuasa",  p.tempat_lahir  ?? "");
      upd("tanggallahir_kuasa", p.tanggal_lahir ?? "");
      upd("alamat_kuasa",       p.alamat_lengkap ?? "");
      setKuasaStatus(ocr.status ?? "invalid");
      setKuasaConf(Number(ocr.confidence ?? 0));
      setKuasaScore(Number(ocr.score ?? 0));
      setKuasaWarns(ocr.warnings ?? []);
      if (ocr.warnings?.length) setErrorMsg(ocr.warnings[0]);
    } catch {
      setKuasaStatus("invalid");
      setErrorMsg("Gagal membaca KTP kuasa. Pastikan gambar jelas.");
    } finally { setLoadingKuasa(false); }
  };

  const handleRisalah = async (file: File) => {
    upd("fileRisalah", file.name);
    setErrorMsg(""); setLoadingRisalah(true);
    setRisalahStatus("idle"); setRisalahConf(0); setRisalahScore(0); setRisalahWarns([]);
    try {
      const ocr = (await ocrRisalah(file)) as OcrRisalahResult;
      const p = ocr.parsed ?? {};
      upd("nomor_risalah",   p.nomor_risalah   ?? "");
      upd("tanggal_risalah", p.tanggal_risalah ?? "");
      upd("pejabat_lelang",  p.pejabat_lelang  ?? "");
      upd("pukul_lelang",    p.pukul           ?? "");
      upd("nip_pejabat",     p.nip             ?? "");
      upd("uraian_risalah",  p.uraian          ?? "");
      setRisalahStatus(ocr.status ?? "invalid");
      setRisalahConf(Number(ocr.confidence ?? 0));
      setRisalahScore(Number(ocr.score ?? 0));
      setRisalahWarns(ocr.warnings ?? []);
    } catch {
      setRisalahStatus("invalid");
      setErrorMsg("Gagal membaca risalah. Pastikan file jelas.");
    } finally { setLoadingRisalah(false); }
  };

  const canSubmit = useMemo(() => {
    const hasPemohon = Boolean(values.nama_pemohon.trim() && values.nik_pemohon.trim() && values.alamat_pemohon.trim());
    const hasKuasa   = values.bertindakSebagai === "kuasa"
      ? Boolean(values.nama_kuasa.trim() && values.nik_kuasa.trim())
      : true;
    const hasRisalah = Boolean(values.nomor_risalah.trim());
    return hasPemohon && hasKuasa && hasRisalah;
  }, [values]);

  const handleSubmit = async () => {
    if (!template || isGenerating) return;
    setIsGenerating(true);
    try {
      await onSubmit?.({ template, values: { ...values } });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!open || !template || !mounted) return null;

  const isOcrLoading = loadingPemohon || loadingKuasa || loadingRisalah;
  const isLoading    = isOcrLoading || isGenerating;

  const modal = (
    <div className="fixed inset-0 z-[9999] grid place-items-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={isGenerating ? undefined : onClose} />

      <div className="relative flex flex-col w-full max-w-2xl max-h-[88vh] rounded-3xl bg-[#09090f] border border-white/[0.06] shadow-[0_32px_100px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}>

        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-3xl bg-gradient-to-b from-emerald-500/[0.05] to-transparent" />

        {/* Header */}
        <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-bold text-white">{template.title}</h2>
              <p className="text-[11px] text-zinc-500">Upload dokumen, sistem baca otomatis</p>
            </div>
          </div>
          <button type="button" onClick={isGenerating ? undefined : onClose} disabled={isGenerating}
            className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-white/[0.06] transition-all",
              isGenerating ? "cursor-not-allowed text-zinc-700" : "text-zinc-500 hover:bg-zinc-800/80 hover:text-white")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Overlay generating — mencegah interaksi selama proses berlangsung */}
        {isGenerating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-3xl bg-[#09090f]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-14 w-14 rounded-full border-2 border-emerald-500/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-white">Membuat Surat…</p>
                <p className="mt-1 text-[12px] text-zinc-500">Mohon tunggu, jangan tutup halaman ini</p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className={cx("flex-1 overflow-y-auto overscroll-contain", isGenerating && "pointer-events-none select-none")}>
          <div className="space-y-4 p-5">

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[13px] leading-relaxed text-amber-200">{errorMsg}</p>
              </div>
            )}

            {/* ── 1. Toggle Kuasa ── */}
            <ModeToggle value={values.bertindakSebagai} onChange={(v) => upd("bertindakSebagai", v)} />

            {/* ── 2. Dropzone KTP ── */}
            {values.bertindakSebagai === "kuasa" ? (
              <div className="grid grid-cols-2 gap-3">
                <PremiumDropzone label="KTP Pemohon" sublabel="KTP pemilik / debitur aset"
                  accept="image/jpeg,image/jpg,image/png,image/webp" acceptLabel="JPG · PNG"
                  color="cyan" Icon={ScanLine}
                  filename={values.fileKtpPemohon} loading={loadingPemohon} status={pemohonStatus}
                  onFile={handleKtpPemohon} />
                <PremiumDropzone label="KTP Kuasa" sublabel="KTP penerima kuasa"
                  accept="image/jpeg,image/jpg,image/png,image/webp" acceptLabel="JPG · PNG"
                  color="violet" Icon={UserCheck}
                  filename={values.fileKtpKuasa} loading={loadingKuasa} status={kuasaStatus}
                  onFile={handleKtpKuasa} />
              </div>
            ) : (
              <PremiumDropzone label="KTP Pemohon" sublabel="KTP pemilik / debitur aset"
                accept="image/jpeg,image/jpg,image/png,image/webp" acceptLabel="JPG · PNG"
                color="cyan" Icon={ScanLine}
                filename={values.fileKtpPemohon} loading={loadingPemohon} status={pemohonStatus}
                onFile={handleKtpPemohon} />
            )}

            {/* ── 3. Info KTP Pemohon ── */}
            {values.fileKtpPemohon && (
              <KtpCard title="Data KTP Pemohon" color="cyan"
                scanStatus={pemohonStatus} confidence={pemohonConf} score={pemohonScore} warnings={pemohonWarns}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FieldInput label="Nama" value={values.nama_pemohon} onChange={(v) => upd("nama_pemohon", v)} placeholder="Isi manual jika tidak terbaca" />
                  </div>
                  <FieldInput label="NIK" value={values.nik_pemohon} onChange={(v) => upd("nik_pemohon", v)} />
                  <FieldInput label="Tempat Lahir" value={values.tempatlahir_pemohon} onChange={(v) => upd("tempatlahir_pemohon", v)} />
                  <FieldInput label="Tanggal Lahir" value={values.tanggallahir_pemohon} onChange={(v) => upd("tanggallahir_pemohon", v)} />
                  <div className="sm:col-span-2">
                    <FieldTextarea label="Alamat Lengkap" value={values.alamat_pemohon} onChange={(v) => upd("alamat_pemohon", v)} rows={2} />
                  </div>
                </div>
              </KtpCard>
            )}

            {/* ── 3b. Info KTP Kuasa ── */}
            {values.fileKtpKuasa && values.bertindakSebagai === "kuasa" && (
              <KtpCard title="Data KTP Penerima Kuasa" color="violet"
                scanStatus={kuasaStatus} confidence={kuasaConf} score={kuasaScore} warnings={kuasaWarns}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FieldInput label="Nama" value={values.nama_kuasa} onChange={(v) => upd("nama_kuasa", v)} placeholder="Isi manual jika tidak terbaca" />
                  </div>
                  <FieldInput label="NIK" value={values.nik_kuasa} onChange={(v) => upd("nik_kuasa", v)} />
                  <FieldInput label="Tempat Lahir" value={values.tempatlahir_kuasa} onChange={(v) => upd("tempatlahir_kuasa", v)} />
                  <FieldInput label="Tanggal Lahir" value={values.tanggallahir_kuasa} onChange={(v) => upd("tanggallahir_kuasa", v)} />
                  <div className="sm:col-span-2">
                    <FieldTextarea label="Alamat Lengkap" value={values.alamat_kuasa} onChange={(v) => upd("alamat_kuasa", v)} rows={2} />
                  </div>
                </div>
              </KtpCard>
            )}

            {/* ── 4. Dropzone Risalah Lelang ── */}
            <PremiumDropzone label="Kutipan Risalah Lelang" sublabel="Foto atau scan kutipan risalah"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" acceptLabel="JPG · PNG · PDF"
              color="amber" Icon={FileSearch}
              filename={values.fileRisalah} loading={loadingRisalah} status={risalahStatus}
              onFile={handleRisalah} />

            {/* ── 5. Info Risalah ── */}
            {values.fileRisalah && (
              <div className="rounded-2xl border border-amber-500/20 bg-zinc-900/40 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
                  <p className="text-[12px] font-black text-white">Data Kutipan Risalah</p>
                  {risalahStatus !== "idle" && (
                    <span className={cx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      risalahStatus === "valid"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    )}>
                      {risalahStatus === "valid"
                        ? <><CheckCircle2 className="h-3 w-3" /> Valid</>
                        : <><AlertTriangle className="h-3 w-3" /> Perlu Review</>}
                    </span>
                  )}
                  {risalahConf > 0 && (
                    <span className="ml-auto text-[10px] text-zinc-500">
                      OCR {Math.round(risalahConf * 100)}%
                    </span>
                  )}
                </div>
                {risalahWarns.length > 0 && (
                  <div className="px-4 pt-3">
                    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.08] px-3 py-2">
                      {risalahWarns.map((w, i) => (
                        <p key={i} className="text-[11px] text-amber-200">• {w}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldInput label="Nomor Risalah"   value={values.nomor_risalah}   onChange={(v) => upd("nomor_risalah", v)} />
                  <FieldInput label="Tanggal Lelang"  value={values.tanggal_risalah} onChange={(v) => upd("tanggal_risalah", v)} />
                  <FieldInput label="Pukul Lelang"    value={values.pukul_lelang}    onChange={(v) => upd("pukul_lelang", v)} />
                  <FieldInput label="NIP Pejabat"     value={values.nip_pejabat}     onChange={(v) => upd("nip_pejabat", v)} />
                  <div className="sm:col-span-2">
                    <FieldInput label="Pejabat Lelang" value={values.pejabat_lelang} onChange={(v) => upd("pejabat_lelang", v)} />
                  </div>
                </div>
              </div>
            )}

            <div className="h-1" />
          </div>
        </div>

        {/* Footer */}
        <div className="relative shrink-0 flex items-center justify-between gap-4 border-t border-white/[0.05] bg-zinc-950/80 px-5 py-4">
          <span className={cx("text-[12px]",
            isGenerating ? "text-emerald-400 animate-pulse" :
            canSubmit    ? "text-emerald-400" : "text-zinc-600")}>
            {isGenerating ? "⏳ Sedang membuat surat PDF…" :
             canSubmit    ? "✓ Siap di-generate" : "Lengkapi data wajib"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} disabled={isGenerating}
              className={cx("rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all",
                isGenerating ? "cursor-not-allowed text-zinc-600" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white")}>
              Batal
            </button>
            <button type="button" onClick={handleSubmit}
              disabled={!canSubmit || isLoading}
              className={cx(
                "relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-200 overflow-hidden",
                isGenerating
                  ? "bg-emerald-600 text-black cursor-not-allowed shadow-[0_4px_20px_rgba(52,211,153,0.3)]"
                  : canSubmit && !isOcrLoading
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_4px_20px_rgba(52,211,153,0.25)] hover:shadow-[0_4px_28px_rgba(52,211,153,0.35)]"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
              )}>
              {/* Shimmer saat generating */}
              {isGenerating && (
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              )}
              {isGenerating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Membuat Surat…</>
                : isOcrLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menganalisis…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Generate Surat</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
