"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalahLelang } from "@/lib/ocrRisalahLelang";
import { generateSurat, downloadBlob } from "@/lib/generateSurat";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit?: (payload: { template: SuratTemplate; values: Record<string, string> }) => void;
};

type ScanStatus = "idle" | "valid" | "review" | "invalid";
type OcrMeta    = { status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string };

const FRESH: OcrMeta = { status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" };

type OcrKtpParsed = {
  nama_pemohon?: string;       nik_pemohon?: string;
  kotalahir_pemohon?: string;  tanggallahir_pemohon?: string;
  kelamin_pemohon?: string;    agama_pemohon?: string;
  alamat_pemohon?: string;     alamat_utama_pemohon?: string;
  kelurahan_pemohon?: string;  kecamatan_pemohon?: string;
  kota_pemohon?: string;       jenis_kota_pemohon?: string;
  rt_rw_pemohon?: string;      pekerjaan_pemohon?: string;
  statuskawin_pemohon?: string; warga_negara?: string;
};

type OcrKtpResult = {
  raw_text?: string; cleaned_text?: string; rawText?: string; cleanedText?: string;
  confidence?: number; parsed?: OcrKtpParsed; score?: number;
  status?: ScanStatus; warnings?: string[];
};

type Form = {
  mode: "sendiri" | "kuasa";
  // Pemohon
  ktpPemohon: string;
  nama_pemohon: string;
  NIK_pemohon: string;
  tanggallahir_pemohon: string;
  alamat_utama_pemohon: string;
  rt_rw_pemohon: string;
  kelurahan_pemohon: string;
  kecamatan_pemohon: string;
  kota_pemohon: string;
  jenis_kota_pemohon: string;
  alamat_pemohon: string;
  // Kuasa
  ktpKuasa: string;
  nama_kuasa: string;
  NIK_kuasa: string;
  tanggallahir_kuasa: string;
  alamat_utama_kuasa: string;
  rt_rw_kuasa: string;
  kelurahan_kuasa: string;
  kecamatan_kuasa: string;
  kota_kuasa: string;
  jenis_kota_kuasa: string;
  alamat_kuasa: string;
  // Risalah Lelang
  risalahFile: string;
  nomor_risalahlelang: string;
  tanggal_risalahlelang: string;
  pejabat_lelang: string;
  jamlelang: string;
  NIP: string;
};

const BLANK: Form = {
  mode: "sendiri",
  ktpPemohon: "", nama_pemohon: "", NIK_pemohon: "", tanggallahir_pemohon: "",
  alamat_utama_pemohon: "", rt_rw_pemohon: "", kelurahan_pemohon: "",
  kecamatan_pemohon: "", kota_pemohon: "", jenis_kota_pemohon: "", alamat_pemohon: "",
  ktpKuasa: "", nama_kuasa: "", NIK_kuasa: "", tanggallahir_kuasa: "",
  alamat_utama_kuasa: "", rt_rw_kuasa: "", kelurahan_kuasa: "",
  kecamatan_kuasa: "", kota_kuasa: "", jenis_kota_kuasa: "", alamat_kuasa: "",
  risalahFile: "",
  nomor_risalahlelang: "", tanggal_risalahlelang: "",
  pejabat_lelang: "", jamlelang: "", NIP: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRaw(r: OcrKtpResult) {
  return r.cleaned_text || r.cleanedText || r.raw_text || r.rawText || "";
}

function buildAlamat(p: {
  alamatUtama?: string; rtRw?: string;
  kelurahan?: string; kecamatan?: string;
  kota?: string; jenisKota?: string;
}) {
  const parts: string[] = [];
  if (p.alamatUtama?.trim()) parts.push(p.alamatUtama.trim());
  if (p.rtRw?.trim())        parts.push(`RT/RW ${p.rtRw.trim()}`);
  if (p.kelurahan?.trim())   parts.push(`Kel. ${p.kelurahan.trim()}`);
  if (p.kecamatan?.trim())   parts.push(`Kec. ${p.kecamatan.trim()}`);
  if (p.kota?.trim()) {
    const pre = p.jenisKota === "Kota" ? "Kota" : p.jenisKota === "Kabupaten" ? "Kabupaten" : "";
    parts.push(pre ? `${pre} ${p.kota.trim()}` : p.kota.trim());
  }
  return parts.join(", ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-[11px] font-bold text-sky-400">
        {n}
      </span>
      <span className="text-[13px] font-semibold tracking-wide text-slate-200">{label}</span>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "rounded-xl border px-3.5 py-2.5 text-[13px] outline-none transition",
          readOnly
            ? "cursor-default border-slate-800 bg-slate-900/60 text-slate-400"
            : "border-slate-800 bg-slate-900 text-slate-100 placeholder-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20",
        ].join(" ")}
      />
    </div>
  );
}

function OcrBadge({ meta }: { meta: OcrMeta }) {
  if (meta.status === "idle") return null;
  const cfg = meta.status === "valid"
    ? { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 size={12} />, label: `Valid · ${meta.score}%` }
    : meta.status === "review"
    ? { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: <AlertTriangle size={12} />, label: `Perlu dicek · ${meta.score}%` }
    : { cls: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: <AlertTriangle size={12} />, label: "Gagal baca" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DropZone({
  label, hint, accept, fileName, scanning, ocrMeta,
  onFile, onReset,
}: {
  label: string; hint?: string; accept: string;
  fileName: string; scanning: boolean; ocrMeta: OcrMeta;
  onFile: (f: File) => void; onReset: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {ocrMeta.status !== "idle" && <OcrBadge meta={ocrMeta} />}
      </div>

      {fileName ? (
        <div className="flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-sky-400" />
          <span className="flex-1 truncate text-[12px] text-sky-300">{fileName}</span>
          {scanning
            ? <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            : <button onClick={onReset} title="Ganti file" className="text-slate-500 hover:text-rose-400 transition"><RefreshCw size={13} /></button>
          }
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            "flex w-full flex-col items-center gap-2.5 rounded-xl border border-dashed px-4 py-6 text-center transition-all duration-200 cursor-pointer",
            dragging
              ? "border-sky-400/70 bg-sky-500/[0.10] scale-[1.01] shadow-[0_0_0_3px_rgba(14,165,233,0.15)]"
              : "border-slate-700 bg-slate-900/50 hover:border-sky-500/50 hover:bg-sky-500/[0.05] hover:shadow-[0_0_0_3px_rgba(14,165,233,0.08)]",
          ].join(" ")}
        >
          <div className={[
            "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200",
            dragging ? "border-sky-400/40 bg-sky-400/20" : "border-sky-500/20 bg-sky-500/10",
          ].join(" ")}>
            {scanning
              ? <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              : <Upload className={["h-4 w-4 transition-transform duration-200", dragging ? "text-sky-300 scale-110" : "text-sky-400"].join(" ")} />
            }
          </div>
          <div className="space-y-0.5">
            <p className="text-[12px]">
              {dragging
                ? <span className="font-semibold text-sky-300">Lepas file di sini</span>
                : <><span className="font-medium text-sky-400">Klik untuk upload</span><span className="text-slate-500"> atau drag &amp; drop</span></>
              }
            </p>
            {hint && !dragging && <p className="text-[11px] text-slate-600">{hint}</p>}
          </div>
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateAkteGrosse({ open, template, onClose, onSubmit }: Props) {
  const [f, setF] = useState<Form>(BLANK);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));

  const [scanP, setScanP] = useState(false);
  const [scanK, setScanK] = useState(false);
  const [scanR, setScanR] = useState(false);

  const [ocrP, setOcrP] = useState<OcrMeta>(FRESH);
  const [ocrK, setOcrK] = useState<OcrMeta>(FRESH);
  const [ocrR, setOcrR] = useState<OcrMeta>(FRESH);

  const [banner, setBanner] = useState<{ type: "warn" | "err"; msg: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      setF(BLANK);
      setScanP(false); setScanK(false); setScanR(false);
      setOcrP(FRESH); setOcrK(FRESH); setOcrR(FRESH);
      setBanner(null);
    }
  }, [open]);

  // ── KTP OCR shared runner ──────────────────────────────────────────────────
  const runKtpOcr = async (
    file: File,
    setScanning: (b: boolean) => void,
    setOcr: (o: OcrMeta) => void,
    apply: (parsed: OcrKtpParsed) => void,
    label: string,
  ) => {
    setScanning(true); setBanner(null); setOcr(FRESH);
    try {
      const res = (await ocrKTP(file)) as OcrKtpResult;
      const p = res.parsed ?? {};
      apply(p);
      const bad = (res.confidence ?? 0) < 45 || !/^\d{16}$/.test(p.nik_pemohon ?? "");
      const status: ScanStatus = res.status === "invalid" || bad ? "review" : (res.status ?? "review");
      setOcr({ status, score: res.score ?? 0, confidence: res.confidence ?? 0, warnings: res.warnings ?? [], rawText: getRaw(res) });
      if (status === "review") setBanner({ type: "warn", msg: `Scan ${label}: beberapa data perlu dicek. Pastikan foto terang dan tidak blur.` });
    } catch {
      setOcr({ ...FRESH, status: "invalid" });
      setBanner({ type: "err", msg: `Gagal memproses ${label}. Pastikan server OCR aktif.` });
    } finally { setScanning(false); }
  };

  const handleKtpPemohon = (file: File) => {
    set("ktpPemohon", file.name);
    void runKtpOcr(file, setScanP, setOcrP, p => {
      const alamat = buildAlamat({
        alamatUtama: p.alamat_utama_pemohon, rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon, kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon, jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      setF(prev => ({
        ...prev,
        nama_pemohon:         p.nama_pemohon         || prev.nama_pemohon,
        NIK_pemohon:          p.nik_pemohon           || prev.NIK_pemohon,
        tanggallahir_pemohon: p.tanggallahir_pemohon  || prev.tanggallahir_pemohon,
        alamat_utama_pemohon: p.alamat_utama_pemohon  || prev.alamat_utama_pemohon,
        rt_rw_pemohon:        p.rt_rw_pemohon         || prev.rt_rw_pemohon,
        kelurahan_pemohon:    p.kelurahan_pemohon      || prev.kelurahan_pemohon,
        kecamatan_pemohon:    p.kecamatan_pemohon      || prev.kecamatan_pemohon,
        kota_pemohon:         p.kota_pemohon           || prev.kota_pemohon,
        jenis_kota_pemohon:   p.jenis_kota_pemohon     || prev.jenis_kota_pemohon,
        alamat_pemohon:       alamat                   || prev.alamat_pemohon,
      }));
    }, "KTP Pemohon");
  };

  const handleKtpKuasa = (file: File) => {
    set("ktpKuasa", file.name);
    void runKtpOcr(file, setScanK, setOcrK, p => {
      const alamat = buildAlamat({
        alamatUtama: p.alamat_utama_pemohon, rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon, kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon, jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      setF(prev => ({
        ...prev,
        nama_kuasa:         p.nama_pemohon        || prev.nama_kuasa,
        NIK_kuasa:          p.nik_pemohon          || prev.NIK_kuasa,
        tanggallahir_kuasa: p.tanggallahir_pemohon || prev.tanggallahir_kuasa,
        alamat_utama_kuasa: p.alamat_utama_pemohon || prev.alamat_utama_kuasa,
        rt_rw_kuasa:        p.rt_rw_pemohon        || prev.rt_rw_kuasa,
        kelurahan_kuasa:    p.kelurahan_pemohon    || prev.kelurahan_kuasa,
        kecamatan_kuasa:    p.kecamatan_pemohon    || prev.kecamatan_kuasa,
        kota_kuasa:         p.kota_pemohon         || prev.kota_kuasa,
        jenis_kota_kuasa:   p.jenis_kota_pemohon   || prev.jenis_kota_kuasa,
        alamat_kuasa:       alamat                  || prev.alamat_kuasa,
      }));
    }, "KTP Kuasa");
  };

  const handleRisalah = async (file: File) => {
    set("risalahFile", file.name);
    setScanR(true); setBanner(null); setOcrR(FRESH);
    try {
      const res = await ocrRisalahLelang(file);
      const p = res.parsed;
      setF(prev => ({
        ...prev,
        nomor_risalahlelang: p.nomor_risalahlelang || prev.nomor_risalahlelang,
        tanggal_risalahlelang: p.tanggal_risalahlelang || prev.tanggal_risalahlelang,
        pejabat_lelang: p.pejabat_lelang || prev.pejabat_lelang,
        jamlelang: p.jamlelang || prev.jamlelang,
        NIP: p.NIP || prev.NIP,
      }));
      const bad = (res.confidence ?? 0) < 45;
      const status: ScanStatus = res.status === "invalid" || bad ? "review" : (res.status ?? "review");
      setOcrR({ status, score: res.score ?? 0, confidence: res.confidence ?? 0, warnings: res.warnings ?? [], rawText: res.cleanedText || res.rawText });
      if (status === "review") setBanner({ type: "warn", msg: "Scan risalah: OCR mungkin kurang akurat karena kertas berwarna. Periksa data secara manual." });
    } catch {
      setOcrR({ ...FRESH, status: "invalid" });
      setBanner({ type: "err", msg: "Gagal memproses risalah lelang. Pastikan server OCR aktif." });
    } finally { setScanR(false); }
  };

  // Single template — backend trims to page 1 when mode="sendiri", keeps all when mode="kuasa"
  const templateFile = "Permohonan_Akta_Grosse.docx";

  const anyScan = scanP || scanK || scanR;

  const canSubmit = useMemo(() => {
    const pemohon = f.nama_pemohon.trim() && f.NIK_pemohon.trim();
    const kuasa = f.mode !== "kuasa" || (f.nama_kuasa.trim() && f.NIK_kuasa.trim());
    const risalah = f.nomor_risalahlelang.trim() && f.pejabat_lelang.trim();
    return Boolean(pemohon && kuasa && risalah);
  }, [f]);

  const handleSubmit = async () => {
    if (!template || generating) return;
    setGenerating(true); setBanner(null);
    try {
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === "string") values[k] = v;
      }
      const { blob, filename, isPdf } = await generateSurat(templateFile, values);
      downloadBlob(blob, filename);
      if (!isPdf) {
        setBanner({ type: "warn", msg: "LibreOffice tidak terdeteksi — file .docx berhasil diunduh." });
      }
      onSubmit?.({ template, values });
    } catch (e) {
      setBanner({ type: "err", msg: e instanceof Error ? e.message : "Gagal generate surat. Pastikan server backend aktif." });
    } finally { setGenerating(false); }
  };

  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] sm:rounded-[28px] border border-slate-800 bg-slate-950 shadow-[0_-20px_80px_-10px_rgba(0,0,0,0.7)] max-h-[94dvh] sm:max-h-[90vh]">

        {/* Sky accent bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/70 to-transparent" />
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-800 sm:hidden" />

        {/* ─── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
              <FileText className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600">DOK-003</p>
              <h2 className="text-[15px] font-bold leading-tight text-white">Permohonan Akte Grosse</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-500 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white">
            <X size={15} />
          </button>
        </div>

        {/* ─── BODY ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Banner */}
          {banner && (
            <div className={["flex gap-3 px-5 py-3 sm:px-7 text-sm", banner.type === "err" ? "bg-rose-500/8 text-rose-300" : "bg-amber-500/8 text-amber-300"].join(" ")}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{banner.msg}</span>
              <button onClick={() => setBanner(null)}><X size={13} className="opacity-50 hover:opacity-100" /></button>
            </div>
          )}

          <div className="divide-y divide-slate-800/50">

            {/* ═══════════════════════════════════════════════════════════════
                BLOK 1 · PEMOHON
            ════════════════════════════════════════════════════════════════ */}
            <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle n="01" label="Pemohon" />
                {/* Mode toggle */}
                <div className="flex overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-sm">
                  <button
                    type="button"
                    onClick={() => set("mode", "sendiri")}
                    className={["px-3.5 py-1.5 text-[12px] font-medium transition", f.mode === "sendiri" ? "bg-sky-500/15 text-sky-300" : "text-slate-500 hover:text-slate-300"].join(" ")}
                  >
                    Tanpa Kuasa
                  </button>
                  <button
                    type="button"
                    onClick={() => set("mode", "kuasa")}
                    className={["px-3.5 py-1.5 text-[12px] font-medium transition", f.mode === "kuasa" ? "bg-sky-500/15 text-sky-300" : "text-slate-500 hover:text-slate-300"].join(" ")}
                  >
                    Dengan Kuasa
                  </button>
                </div>
              </div>

              <DropZone
                label="Scan KTP Pemohon"
                hint="JPG / PNG — pastikan foto terang dan tidak blur"
                accept="image/*"
                fileName={f.ktpPemohon}
                scanning={scanP}
                ocrMeta={ocrP}
                onFile={handleKtpPemohon}
                onReset={() => { set("ktpPemohon", ""); setOcrP(FRESH); }}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama Pemohon" value={f.nama_pemohon} onChange={v => set("nama_pemohon", v)} placeholder="Nama sesuai KTP" />
                <Field label="NIK Pemohon" value={f.NIK_pemohon} onChange={v => set("NIK_pemohon", v)} placeholder="16 digit NIK" />
                <Field label="Tanggal Lahir" value={f.tanggallahir_pemohon} onChange={v => set("tanggallahir_pemohon", v)} placeholder="DD-MM-YYYY" />
              </div>

              <Field label="Alamat" value={f.alamat_pemohon} onChange={v => set("alamat_pemohon", v)} placeholder="Diisi otomatis dari KTP" />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                BLOK 2 · KUASA (hanya muncul jika mode = kuasa)
            ════════════════════════════════════════════════════════════════ */}
            {f.mode === "kuasa" && (
              <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">
                <SectionTitle n="02" label="Penerima Kuasa" />

                <DropZone
                  label="Scan KTP Penerima Kuasa"
                  hint="JPG / PNG — pastikan foto terang dan tidak blur"
                  accept="image/*"
                  fileName={f.ktpKuasa}
                  scanning={scanK}
                  ocrMeta={ocrK}
                  onFile={handleKtpKuasa}
                  onReset={() => { set("ktpKuasa", ""); setOcrK(FRESH); }}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nama Kuasa" value={f.nama_kuasa} onChange={v => set("nama_kuasa", v)} placeholder="Nama sesuai KTP" />
                  <Field label="NIK Kuasa" value={f.NIK_kuasa} onChange={v => set("NIK_kuasa", v)} placeholder="16 digit NIK" />
                  <Field label="Tanggal Lahir" value={f.tanggallahir_kuasa} onChange={v => set("tanggallahir_kuasa", v)} placeholder="DD-MM-YYYY" />
                </div>

                <Field label="Alamat" value={f.alamat_kuasa} onChange={v => set("alamat_kuasa", v)} placeholder="Diisi otomatis dari KTP" />
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                BLOK 3 · RISALAH LELANG
            ════════════════════════════════════════════════════════════════ */}
            <div className={["px-5 py-6 sm:px-7 sm:py-7 space-y-5"].join("")}>
              <div className="flex items-center gap-3">
                <SectionTitle n={f.mode === "kuasa" ? "03" : "02"} label="Risalah Lelang" />
              </div>

              <DropZone
                label="Upload Risalah Lelang (PDF)"
                hint="File PDF dari risalah lelang — Kutipan Risalah Lelang resmi KPKNL"
                accept="application/pdf"
                fileName={f.risalahFile}
                scanning={scanR}
                ocrMeta={ocrR}
                onFile={handleRisalah}
                onReset={() => { set("risalahFile", ""); setOcrR(FRESH); setF(prev => ({ ...prev, nomor_risalahlelang: "", tanggal_risalahlelang: "", pejabat_lelang: "", jamlelang: "", NIP: "" })); }}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nomor Risalah Lelang" value={f.nomor_risalahlelang} onChange={v => set("nomor_risalahlelang", v)} placeholder="Nomor risalah" />
                <Field label="Tanggal Risalah" value={f.tanggal_risalahlelang} onChange={v => set("tanggal_risalahlelang", v)} placeholder="DD Bulan YYYY" />
                <div className="sm:col-span-2">
                  <Field label="Pejabat Lelang" value={f.pejabat_lelang} onChange={v => set("pejabat_lelang", v)} placeholder="Nama pejabat lelang" />
                </div>
                <Field label="Jam Lelang" value={f.jamlelang} onChange={v => set("jamlelang", v)} placeholder="HH:MM" />
                <Field label="NIP Pejabat Lelang" value={f.NIP} onChange={v => set("NIP", v)} placeholder="NIP" />
              </div>
            </div>

          </div>
        </div>

        {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 px-4 py-2 text-[13px] font-medium text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || anyScan || generating}
            className={[
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition",
              canSubmit && !anyScan && !generating
                ? "bg-sky-500 text-white hover:bg-sky-400 shadow-[0_0_20px_-4px_rgba(14,165,233,0.4)]"
                : "cursor-not-allowed bg-slate-800 text-slate-600",
            ].join(" ")}
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Membuat Surat…</span></>
              : anyScan
              ? <><ScanLine className="h-4 w-4 animate-pulse" /><span>Memproses OCR…</span></>
              : <><FileText className="h-4 w-4" /><span>Buat Surat</span></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
