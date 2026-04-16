"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Handshake,
  Loader2,
  RefreshCw,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";
import { generateSurat, downloadBlob } from "@/lib/generateSurat";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type OcrRisalahParsed = {
  nomor_risalah?: string; nomor_kwitansi?: string; nomor_risalah_lelang?: string;
  tanggal_risalah?: string; tanggal_kwitansi?: string; luas?: string;
  alamat_desa?: string; alamat_kecamatan?: string; alamat_kota?: string;
  alamat_provinsi?: string; no_sertifikat?: string; uraian?: string; nama_bank?: string;
  singkatan_sertifikat?: string; jenis_sertifikat?: string; nomor_nib?: string;
};

type OcrRisalahResult = {
  raw_text?: string; cleaned_text?: string; rawText?: string; cleanedText?: string;
  confidence?: number; parsed?: OcrRisalahParsed; score?: number;
  status?: ScanStatus; warnings?: string[];
};

// ─── Form type ────────────────────────────────────────────────────────────────

type Form = {
  // Pihak Kesatu — Pemilik Lama / Debitur
  ktpP1: string;
  p1_nama: string;          p1_nik: string;
  p1_kotalahir: string;     p1_tanggallahir: string;
  p1_kelamin: string;       p1_agama: string;
  p1_pekerjaan: string;     p1_statuskawin: string;
  p1_warga_negara: string;
  p1_alamat_utama: string;  p1_rt_rw: string;
  p1_kelurahan: string;     p1_kecamatan: string;
  p1_kota: string;          p1_jenis_kota: string;
  p1_alamat: string;
  // Penerima Kuasa
  ktpKuasa: string;
  kuasa_nama: string;       kuasa_nik: string;
  kuasa_kotalahir: string;  kuasa_tanggallahir: string;
  kuasa_kelamin: string;    kuasa_agama: string;
  kuasa_pekerjaan: string;  kuasa_statuskawin: string;
  kuasa_alamat_utama: string; kuasa_rt_rw: string;
  kuasa_kelurahan: string;  kuasa_kecamatan: string;
  kuasa_kota: string;       kuasa_jenis_kota: string;
  kuasa_alamat: string;
  // Pemenang Lelang — Pemberi Kuasa
  ktpPemenang: string;
  pemenang_nama: string;         pemenang_nik: string;
  pemenang_kotalahir: string;    pemenang_tanggallahir: string;
  pemenang_kelamin: string;      pemenang_agama: string;
  pemenang_pekerjaan: string;    pemenang_statuskawin: string;
  pemenang_warga_negara: string;
  pemenang_alamat_utama: string; pemenang_rt_rw: string;
  pemenang_kelurahan: string;    pemenang_kecamatan: string;
  pemenang_kota: string;         pemenang_jenis_kota: string;
  pemenang_alamat: string;
  // Kwitansi & Sertifikat
  kwitansiFile: string;
  nomor_kwitansi: string;       tanggal_kwitansi: string;
  nomor_risalah_lelang: string;  tanggal_risalah: string;
  nama_bank: string;
  jenis_sertifikat: string;     singkatan_sertifikat: string;
  no_sertifikat: string;        luas: string;
  lokasi_asset: string;
  kelurahan_asset: string;      kecamatan_asset: string;
  kota_asset: string;           provinsi_asset: string;
  nomor_nib: string;
  // Kesepakatan
  deadline_serah_terima: string;  // format: "DD Bulan YYYY" (Indonesian)
  total_kompensasi: string;
};

const BLANK: Form = {
  ktpP1: "", p1_nama: "", p1_nik: "",
  p1_kotalahir: "", p1_tanggallahir: "",
  p1_kelamin: "", p1_agama: "",
  p1_pekerjaan: "", p1_statuskawin: "", p1_warga_negara: "Indonesia",
  p1_alamat_utama: "", p1_rt_rw: "", p1_kelurahan: "", p1_kecamatan: "",
  p1_kota: "", p1_jenis_kota: "", p1_alamat: "",

  ktpKuasa: "", kuasa_nama: "", kuasa_nik: "",
  kuasa_kotalahir: "", kuasa_tanggallahir: "",
  kuasa_kelamin: "", kuasa_agama: "",
  kuasa_pekerjaan: "", kuasa_statuskawin: "",
  kuasa_alamat_utama: "", kuasa_rt_rw: "", kuasa_kelurahan: "", kuasa_kecamatan: "",
  kuasa_kota: "", kuasa_jenis_kota: "", kuasa_alamat: "",

  ktpPemenang: "", pemenang_nama: "", pemenang_nik: "",
  pemenang_kotalahir: "", pemenang_tanggallahir: "",
  pemenang_kelamin: "", pemenang_agama: "",
  pemenang_pekerjaan: "", pemenang_statuskawin: "", pemenang_warga_negara: "Indonesia",
  pemenang_alamat_utama: "", pemenang_rt_rw: "", pemenang_kelurahan: "", pemenang_kecamatan: "",
  pemenang_kota: "", pemenang_jenis_kota: "", pemenang_alamat: "",

  kwitansiFile: "", nomor_kwitansi: "", tanggal_kwitansi: "",
  nomor_risalah_lelang: "", tanggal_risalah: "", nama_bank: "",
  jenis_sertifikat: "", singkatan_sertifikat: "",
  no_sertifikat: "", luas: "", lokasi_asset: "",
  kelurahan_asset: "", kecamatan_asset: "",
  kota_asset: "", provinsi_asset: "",
  nomor_nib: "",

  deadline_serah_terima: "", total_kompensasi: "",
};

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

const ID_MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];
const ID_DAYS_SHORT = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

function formatDateID(d: Date): string {
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function parseIDDate(s: string): Date | null {
  const parts = s.split(" ");
  if (parts.length !== 3) return null;
  const day  = parseInt(parts[0], 10);
  const mon  = ID_MONTHS.indexOf(parts[1]);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || mon === -1 || isNaN(year)) return null;
  return new Date(year, mon, day);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAlamat(p: { alamatUtama?: string; rtRw?: string; kelurahan?: string; kecamatan?: string; kota?: string; jenisKota?: string }) {
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

function getRaw(r: OcrKtpResult | OcrRisalahResult) {
  return r.cleaned_text || r.cleanedText || r.raw_text || r.rawText || "";
}

function formatRp(raw: string): string {
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  return isNaN(n) ? "" : n.toLocaleString("id-ID");
}

function computeTermin1(totalRaw: string, persenStr: string): { jumlah: number; display: string } {
  const total = parseInt(totalRaw.replace(/\D/g, ""), 10);
  const pct   = parseFloat(persenStr);
  if (isNaN(total) || isNaN(pct) || total === 0) return { jumlah: 0, display: "" };
  const jumlah = Math.round(total * pct / 100);
  return { jumlah, display: jumlah.toLocaleString("id-ID") };
}

// ─── Custom Calendar Picker ───────────────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const today    = new Date();
  const selected = value ? parseIDDate(value) : null;

  const [open, setOpen]     = useState(false);
  const [viewYear,  setViewYear]  = useState(selected?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()     ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(formatDateID(d));
    setOpen(false);
  };

  const isSelected = (day: number) =>
    selected?.getFullYear() === viewYear &&
    selected?.getMonth()    === viewMonth &&
    selected?.getDate()     === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth()    === viewMonth &&
    today.getDate()     === day;

  // Build grid cells: blanks + days
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={[
          "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
          value
            ? "border-violet-500/30 bg-violet-500/[0.06] text-white hover:border-violet-500/50"
            : "border-slate-700/80 bg-slate-900/80 text-slate-500 hover:border-slate-600 hover:text-slate-300",
        ].join(" ")}
      >
        <CalendarDays className={["h-4 w-4 shrink-0", value ? "text-violet-400" : "text-slate-600"].join(" ")} />
        <span className="flex-1 text-left">{value || "Pilih tanggal…"}</span>
        {value && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(""); }}
            className="text-slate-600 transition hover:text-rose-400"
          >
            <X size={13} />
          </button>
        )}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">

          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="text-sm font-bold text-white">
              {ID_MONTHS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-800/60 px-2 py-2">
            {ID_DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-600">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 p-2">
            {cells.map((day, i) => {
              if (!day) return <div key={`blank-${i}`} />;
              const sel   = isSelected(day);
              const tod   = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    "relative flex h-8 w-full items-center justify-center rounded-lg text-sm font-medium transition",
                    sel
                      ? "bg-violet-500 text-white shadow-[0_0_12px_-2px_rgba(139,92,246,0.6)]"
                      : tod
                      ? "border border-violet-500/30 text-violet-400 hover:bg-violet-500/15"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  ].join(" ")}
                >
                  {day}
                  {tod && !sel && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-4 py-2.5">
            <button
              type="button"
              onClick={() => { const d = new Date(); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}
              className="text-[11px] font-semibold text-violet-500 transition hover:text-violet-400"
            >
              Hari ini — {formatDateID(today)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateAktaKesepakatan({ open, template, onClose, onSubmit }: Props) {
  const [f, setF]   = useState<Form>(BLANK);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));

  // Termin: hanya 2, termin1 punya persen input, termin2 = sisa
  const [termin1Persen, setTermin1Persen] = useState("50");

  const [scanP1,       setScanP1]       = useState(false);
  const [scanKuasa,    setScanKuasa]    = useState(false);
  const [scanPemenang, setScanPemenang] = useState(false);
  const [scanW,        setScanW]        = useState(false);

  const [ocrP1,       setOcrP1]       = useState<OcrMeta>(FRESH);
  const [ocrKuasa,    setOcrKuasa]    = useState<OcrMeta>(FRESH);
  const [ocrPemenang, setOcrPemenang] = useState<OcrMeta>(FRESH);
  const [ocrW,        setOcrW]        = useState<OcrMeta>(FRESH);

  const [banner,     setBanner]     = useState<{ type: "warn" | "err"; msg: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      setF(BLANK); setTermin1Persen("50");
      setScanP1(false); setScanKuasa(false); setScanPemenang(false); setScanW(false);
      setOcrP1(FRESH); setOcrKuasa(FRESH); setOcrPemenang(FRESH); setOcrW(FRESH);
      setBanner(null);
    }
  }, [open]);

  // ── KTP OCR runner ────────────────────────────────────────────────────────
  const runKtpOcr = async (
    file: File,
    setScanning: (b: boolean) => void,
    setOcr: (o: OcrMeta) => void,
    apply: (parsed: OcrKtpParsed, alamat: string) => void,
    label: string,
  ) => {
    setScanning(true); setBanner(null); setOcr(FRESH);
    try {
      const res = (await ocrKTP(file)) as OcrKtpResult;
      const p   = res.parsed ?? {};
      const alamat = buildAlamat({
        alamatUtama: p.alamat_utama_pemohon, rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon, kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon, jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      apply(p, alamat);
      const bad = (res.confidence ?? 0) < 45 || !/^\d{16}$/.test(p.nik_pemohon ?? "");
      const status: ScanStatus = res.status === "invalid" || bad ? "review" : (res.status ?? "review");
      setOcr({ status, score: res.score ?? 0, confidence: res.confidence ?? 0, warnings: res.warnings ?? [], rawText: getRaw(res) });
      if (status === "review") setBanner({ type: "warn", msg: `Scan ${label}: beberapa data perlu dicek. Pastikan foto terang dan tidak blur.` });
    } catch {
      setOcr({ ...FRESH, status: "invalid" });
      setBanner({ type: "err", msg: `Gagal memproses ${label}. Pastikan server OCR aktif.` });
    } finally { setScanning(false); }
  };

  const handleKtpP1 = (file: File) => {
    set("ktpP1", file.name);
    void runKtpOcr(file, setScanP1, setOcrP1, (p, alamat) => setF(prev => ({
      ...prev,
      p1_nama: p.nama_pemohon || prev.p1_nama, p1_nik: p.nik_pemohon || prev.p1_nik,
      p1_kotalahir: p.kotalahir_pemohon || prev.p1_kotalahir, p1_tanggallahir: p.tanggallahir_pemohon || prev.p1_tanggallahir,
      p1_kelamin: p.kelamin_pemohon || prev.p1_kelamin, p1_agama: p.agama_pemohon || prev.p1_agama,
      p1_pekerjaan: p.pekerjaan_pemohon || prev.p1_pekerjaan, p1_statuskawin: p.statuskawin_pemohon || prev.p1_statuskawin,
      p1_warga_negara: p.warga_negara || prev.p1_warga_negara || "Indonesia",
      p1_alamat_utama: p.alamat_utama_pemohon || prev.p1_alamat_utama, p1_rt_rw: p.rt_rw_pemohon || prev.p1_rt_rw,
      p1_kelurahan: p.kelurahan_pemohon || prev.p1_kelurahan, p1_kecamatan: p.kecamatan_pemohon || prev.p1_kecamatan,
      p1_kota: p.kota_pemohon || prev.p1_kota, p1_jenis_kota: p.jenis_kota_pemohon || prev.p1_jenis_kota,
      p1_alamat: alamat || prev.p1_alamat,
    })), "KTP Pihak Kesatu");
  };

  const handleKtpKuasa = (file: File) => {
    set("ktpKuasa", file.name);
    void runKtpOcr(file, setScanKuasa, setOcrKuasa, (p, alamat) => setF(prev => ({
      ...prev,
      kuasa_nama: p.nama_pemohon || prev.kuasa_nama, kuasa_nik: p.nik_pemohon || prev.kuasa_nik,
      kuasa_kotalahir: p.kotalahir_pemohon || prev.kuasa_kotalahir, kuasa_tanggallahir: p.tanggallahir_pemohon || prev.kuasa_tanggallahir,
      kuasa_kelamin: p.kelamin_pemohon || prev.kuasa_kelamin, kuasa_agama: p.agama_pemohon || prev.kuasa_agama,
      kuasa_pekerjaan: p.pekerjaan_pemohon || prev.kuasa_pekerjaan, kuasa_statuskawin: p.statuskawin_pemohon || prev.kuasa_statuskawin,
      kuasa_alamat_utama: p.alamat_utama_pemohon || prev.kuasa_alamat_utama, kuasa_rt_rw: p.rt_rw_pemohon || prev.kuasa_rt_rw,
      kuasa_kelurahan: p.kelurahan_pemohon || prev.kuasa_kelurahan, kuasa_kecamatan: p.kecamatan_pemohon || prev.kuasa_kecamatan,
      kuasa_kota: p.kota_pemohon || prev.kuasa_kota, kuasa_jenis_kota: p.jenis_kota_pemohon || prev.kuasa_jenis_kota,
      kuasa_alamat: alamat || prev.kuasa_alamat,
    })), "KTP Kuasa");
  };

  const handleKtpPemenang = (file: File) => {
    set("ktpPemenang", file.name);
    void runKtpOcr(file, setScanPemenang, setOcrPemenang, (p, alamat) => setF(prev => ({
      ...prev,
      pemenang_nama: p.nama_pemohon || prev.pemenang_nama, pemenang_nik: p.nik_pemohon || prev.pemenang_nik,
      pemenang_kotalahir: p.kotalahir_pemohon || prev.pemenang_kotalahir, pemenang_tanggallahir: p.tanggallahir_pemohon || prev.pemenang_tanggallahir,
      pemenang_kelamin: p.kelamin_pemohon || prev.pemenang_kelamin, pemenang_agama: p.agama_pemohon || prev.pemenang_agama,
      pemenang_pekerjaan: p.pekerjaan_pemohon || prev.pemenang_pekerjaan, pemenang_statuskawin: p.statuskawin_pemohon || prev.pemenang_statuskawin,
      pemenang_warga_negara: p.warga_negara || prev.pemenang_warga_negara || "Indonesia",
      pemenang_alamat_utama: p.alamat_utama_pemohon || prev.pemenang_alamat_utama, pemenang_rt_rw: p.rt_rw_pemohon || prev.pemenang_rt_rw,
      pemenang_kelurahan: p.kelurahan_pemohon || prev.pemenang_kelurahan, pemenang_kecamatan: p.kecamatan_pemohon || prev.pemenang_kecamatan,
      pemenang_kota: p.kota_pemohon || prev.pemenang_kota, pemenang_jenis_kota: p.jenis_kota_pemohon || prev.pemenang_jenis_kota,
      pemenang_alamat: alamat || prev.pemenang_alamat,
    })), "KTP Pemenang Lelang");
  };

  // ── Kwitansi OCR ─────────────────────────────────────────────────────────
  const handleKwitansi = async (file: File) => {
    set("kwitansiFile", file.name);
    setBanner(null); setScanW(true); setOcrW(FRESH);
    try {
      const res = (await ocrRisalah(file)) as OcrRisalahResult;
      const p   = res.parsed ?? {};
      const lokasiParts = [
        p.alamat_desa      ? `Desa/Kel ${p.alamat_desa}`       : "",
        p.alamat_kecamatan ? `Kecamatan ${p.alamat_kecamatan}` : "",
        p.alamat_kota      ? `Kota ${p.alamat_kota}`           : "",
        p.alamat_provinsi  ? `Provinsi ${p.alamat_provinsi}`   : "",
      ].filter(Boolean).join(" ");
      setF(prev => ({
        ...prev,
        nomor_kwitansi:       p.nomor_kwitansi        || prev.nomor_kwitansi,
        tanggal_kwitansi:     p.tanggal_kwitansi      || prev.tanggal_kwitansi,
        nomor_risalah_lelang: p.nomor_risalah_lelang  || prev.nomor_risalah_lelang,
        tanggal_risalah:      p.tanggal_risalah        || prev.tanggal_risalah,
        nama_bank:            p.nama_bank              || prev.nama_bank,
        luas:                 p.luas                   || prev.luas,
        lokasi_asset:         lokasiParts              || prev.lokasi_asset,
        kelurahan_asset:      p.alamat_desa            || prev.kelurahan_asset,
        kecamatan_asset:      p.alamat_kecamatan       || prev.kecamatan_asset,
        kota_asset:           p.alamat_kota            || prev.kota_asset,
        provinsi_asset:       p.alamat_provinsi        || prev.provinsi_asset,
        jenis_sertifikat:     p.jenis_sertifikat       || prev.jenis_sertifikat,
        singkatan_sertifikat: p.singkatan_sertifikat   || prev.singkatan_sertifikat,
        no_sertifikat:        p.no_sertifikat          || prev.no_sertifikat,
        nomor_nib:            p.nomor_nib              || prev.nomor_nib,
      }));
      const bad = (res.confidence ?? 0) < 45;
      const status: ScanStatus = res.status === "invalid" || bad ? "review" : (res.status ?? "review");
      setOcrW({ status, score: res.score ?? 0, confidence: res.confidence ?? 0, warnings: res.warnings ?? [], rawText: getRaw(res) });
      if (status === "review") setBanner({ type: "warn", msg: "Scan kwitansi: beberapa data perlu dicek manual." });
    } catch {
      setOcrW({ ...FRESH, status: "invalid" });
      setBanner({ type: "err", msg: "Gagal memproses kwitansi. Pastikan server OCR aktif." });
    } finally { setScanW(false); }
  };

  // ── Address refreshers ────────────────────────────────────────────────────
  const refreshP1Alamat       = () => set("p1_alamat",       buildAlamat({ alamatUtama: f.p1_alamat_utama,       rtRw: f.p1_rt_rw,       kelurahan: f.p1_kelurahan,       kecamatan: f.p1_kecamatan,       kota: f.p1_kota,       jenisKota: f.p1_jenis_kota }));
  const refreshKuasaAlamat    = () => set("kuasa_alamat",    buildAlamat({ alamatUtama: f.kuasa_alamat_utama,    rtRw: f.kuasa_rt_rw,    kelurahan: f.kuasa_kelurahan,    kecamatan: f.kuasa_kecamatan,    kota: f.kuasa_kota,    jenisKota: f.kuasa_jenis_kota }));
  const refreshPemenangAlamat = () => set("pemenang_alamat", buildAlamat({ alamatUtama: f.pemenang_alamat_utama, rtRw: f.pemenang_rt_rw, kelurahan: f.pemenang_kelurahan, kecamatan: f.pemenang_kecamatan, kota: f.pemenang_kota, jenisKota: f.pemenang_jenis_kota }));

  // ── Termin computed values ────────────────────────────────────────────────
  const t1 = computeTermin1(f.total_kompensasi, termin1Persen);
  const t2: { jumlah: number; display: string } = useMemo(() => {
    const total = parseInt(f.total_kompensasi.replace(/\D/g, ""), 10);
    if (isNaN(total) || total === 0) return { jumlah: 0, display: "" };
    const sisa = total - t1.jumlah;
    return { jumlah: sisa, display: sisa.toLocaleString("id-ID") };
  }, [f.total_kompensasi, t1.jumlah]);

  const t1PctNum = parseFloat(termin1Persen) || 0;
  const t2PctNum = Math.max(0, 100 - t1PctNum);

  // ── Validation ────────────────────────────────────────────────────────────
  const anyScan = scanP1 || scanKuasa || scanPemenang || scanW;

  const canSubmit = useMemo(() => {
    const p1   = f.p1_nama.trim()       && f.p1_nik.trim();
    const k    = f.kuasa_nama.trim()    && f.kuasa_nik.trim();
    const pm   = f.pemenang_nama.trim() && f.pemenang_nik.trim();
    const kw   = f.nomor_kwitansi.trim() && f.nomor_risalah_lelang.trim();
    const deal = f.deadline_serah_terima.trim() && f.nomor_nib.trim();
    const comp = f.total_kompensasi.trim() && t1PctNum > 0 && t1PctNum < 100;
    return Boolean(p1 && k && pm && kw && deal && comp);
  }, [f, t1PctNum]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!template || generating) return;
    setGenerating(true); setBanner(null);
    try {
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === "string") values[k] = v;
      }
      values["termin_1_persen"]  = String(t1PctNum);
      values["termin_1_jumlah"]  = t1.display;
      values["termin_2_persen"]  = String(t2PctNum.toFixed(2));
      values["termin_2_jumlah"]  = t2.display;
      values["total_kompensasi_rp"] = formatRp(f.total_kompensasi);

      const { blob, filename, isPdf } = await generateSurat(template.templateFileName, values);
      downloadBlob(blob, filename);
      if (!isPdf) setBanner({ type: "warn", msg: "LibreOffice tidak terdeteksi — file .docx berhasil diunduh." });
      onSubmit?.({ template, values });
    } catch (e) {
      setBanner({ type: "err", msg: e instanceof Error ? e.message : "Gagal generate surat. Pastikan server backend aktif." });
    } finally { setGenerating(false); }
  };

  if (!open || !template) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] sm:rounded-[28px] border border-slate-800 bg-slate-950 shadow-[0_-20px_80px_-10px_rgba(0,0,0,0.7)] max-h-[94dvh] sm:max-h-[90vh]">

        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-800 sm:hidden" />

        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
              <Handshake className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">LIT-003</p>
              <h2 className="text-[15px] font-bold leading-tight text-white">Akta Kesepakatan Bersama</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-500 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white">
            <X size={15} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {banner && (
            <div className={["flex gap-3 px-5 py-3 sm:px-7 text-sm", banner.type === "err" ? "bg-rose-500/8 text-rose-300" : "bg-amber-500/8 text-amber-300"].join(" ")}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{banner.msg}</span>
              <button onClick={() => setBanner(null)}><X size={13} className="opacity-50 hover:opacity-100" /></button>
            </div>
          )}

          <div className="divide-y divide-slate-800/50">

            {/* ═══════════════════════════════════════════════════════════
                BLOK 1 · PARA PIHAK (3 KTP)
            ═══════════════════════════════════════════════════════════ */}
            <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">
              <SectionTitle n="01" label="Para Pihak" />

              <div className="grid gap-4 sm:grid-cols-3">
                <KtpZone label="KTP Pihak Kesatu"     hint="Penghuni / Pemilik Lama"  filename={f.ktpP1}       scanning={scanP1}       ocr={ocrP1}       onFile={handleKtpP1} />
                <KtpZone label="KTP Penerima Kuasa"   hint="Advokat / Perwakilan"      filename={f.ktpKuasa}    scanning={scanKuasa}    ocr={ocrKuasa}    onFile={handleKtpKuasa} />
                <KtpZone label="KTP Pemenang Lelang"  hint="Pemberi Kuasa / Klien"     filename={f.ktpPemenang} scanning={scanPemenang} ocr={ocrPemenang} onFile={handleKtpPemenang} />
              </div>

              <DataCard label="Data Pihak Kesatu — Penghuni / Pemilik Lama" ocr={ocrP1} show={Boolean(f.ktpP1 || f.p1_nama)}>
                <KtpFieldGrid fields={[
                  { label: "Nama",          value: f.p1_nama,         key: "p1_nama",         required: true },
                  { label: "NIK",           value: f.p1_nik,          key: "p1_nik",          required: true, placeholder: "16 digit" },
                  { label: "Kota Lahir",    value: f.p1_kotalahir,    key: "p1_kotalahir" },
                  { label: "Tanggal Lahir", value: f.p1_tanggallahir, key: "p1_tanggallahir", placeholder: "cth: 02 April 1974" },
                  { label: "Jenis Kelamin", value: f.p1_kelamin,      key: "p1_kelamin" },
                  { label: "Agama",         value: f.p1_agama,        key: "p1_agama" },
                  { label: "Pekerjaan",     value: f.p1_pekerjaan,    key: "p1_pekerjaan" },
                  { label: "Status Kawin",  value: f.p1_statuskawin,  key: "p1_statuskawin" },
                ]} onChange={(k, v) => set(k as keyof Form, v)} />
                <AddressBlock utama={f.p1_alamat_utama} rtRw={f.p1_rt_rw} kelurahan={f.p1_kelurahan} kecamatan={f.p1_kecamatan} kota={f.p1_kota} jenisKota={f.p1_jenis_kota} alamat={f.p1_alamat}
                  onUtama={v => set("p1_alamat_utama", v)} onRtRw={v => set("p1_rt_rw", v)} onKelurahan={v => set("p1_kelurahan", v)} onKecamatan={v => set("p1_kecamatan", v)} onKota={v => set("p1_kota", v)} onJenisKota={v => set("p1_jenis_kota", v)} onAlamat={v => set("p1_alamat", v)} onRefresh={refreshP1Alamat} />
              </DataCard>

              <DataCard label="Data Penerima Kuasa" ocr={ocrKuasa} show={Boolean(f.ktpKuasa || f.kuasa_nama)}>
                <KtpFieldGrid fields={[
                  { label: "Nama Kuasa",    value: f.kuasa_nama,         key: "kuasa_nama",         required: true },
                  { label: "NIK",           value: f.kuasa_nik,          key: "kuasa_nik",          required: true, placeholder: "16 digit" },
                  { label: "Kota Lahir",    value: f.kuasa_kotalahir,    key: "kuasa_kotalahir" },
                  { label: "Tanggal Lahir", value: f.kuasa_tanggallahir, key: "kuasa_tanggallahir" },
                  { label: "Jenis Kelamin", value: f.kuasa_kelamin,      key: "kuasa_kelamin" },
                  { label: "Agama",         value: f.kuasa_agama,        key: "kuasa_agama" },
                  { label: "Pekerjaan",     value: f.kuasa_pekerjaan,    key: "kuasa_pekerjaan" },
                  { label: "Status Kawin",  value: f.kuasa_statuskawin,  key: "kuasa_statuskawin" },
                ]} onChange={(k, v) => set(k as keyof Form, v)} />
                <AddressBlock utama={f.kuasa_alamat_utama} rtRw={f.kuasa_rt_rw} kelurahan={f.kuasa_kelurahan} kecamatan={f.kuasa_kecamatan} kota={f.kuasa_kota} jenisKota={f.kuasa_jenis_kota} alamat={f.kuasa_alamat}
                  onUtama={v => set("kuasa_alamat_utama", v)} onRtRw={v => set("kuasa_rt_rw", v)} onKelurahan={v => set("kuasa_kelurahan", v)} onKecamatan={v => set("kuasa_kecamatan", v)} onKota={v => set("kuasa_kota", v)} onJenisKota={v => set("kuasa_jenis_kota", v)} onAlamat={v => set("kuasa_alamat", v)} onRefresh={refreshKuasaAlamat} />
              </DataCard>

              <DataCard label="Data Pemenang Lelang — Pemberi Kuasa" ocr={ocrPemenang} show={Boolean(f.ktpPemenang || f.pemenang_nama)}>
                <KtpFieldGrid fields={[
                  { label: "Nama Pemenang",  value: f.pemenang_nama,         key: "pemenang_nama",         required: true },
                  { label: "NIK",            value: f.pemenang_nik,          key: "pemenang_nik",          required: true, placeholder: "16 digit" },
                  { label: "Kota Lahir",     value: f.pemenang_kotalahir,    key: "pemenang_kotalahir" },
                  { label: "Tanggal Lahir",  value: f.pemenang_tanggallahir, key: "pemenang_tanggallahir", placeholder: "cth: 26 Januari 1962" },
                  { label: "Jenis Kelamin",  value: f.pemenang_kelamin,      key: "pemenang_kelamin" },
                  { label: "Agama",          value: f.pemenang_agama,        key: "pemenang_agama" },
                  { label: "Warga Negara",   value: f.pemenang_warga_negara, key: "pemenang_warga_negara" },
                  { label: "Pekerjaan",      value: f.pemenang_pekerjaan,    key: "pemenang_pekerjaan" },
                  { label: "Status Kawin",   value: f.pemenang_statuskawin,  key: "pemenang_statuskawin" },
                ]} onChange={(k, v) => set(k as keyof Form, v)} />
                <AddressBlock utama={f.pemenang_alamat_utama} rtRw={f.pemenang_rt_rw} kelurahan={f.pemenang_kelurahan} kecamatan={f.pemenang_kecamatan} kota={f.pemenang_kota} jenisKota={f.pemenang_jenis_kota} alamat={f.pemenang_alamat}
                  onUtama={v => set("pemenang_alamat_utama", v)} onRtRw={v => set("pemenang_rt_rw", v)} onKelurahan={v => set("pemenang_kelurahan", v)} onKecamatan={v => set("pemenang_kecamatan", v)} onKota={v => set("pemenang_kota", v)} onJenisKota={v => set("pemenang_jenis_kota", v)} onAlamat={v => set("pemenang_alamat", v)} onRefresh={refreshPemenangAlamat} />
              </DataCard>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                BLOK 2 · KWITANSI & SERTIFIKAT
            ═══════════════════════════════════════════════════════════ */}
            <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">
              <SectionTitle n="02" label="Kwitansi & Sertifikat" />
              <DocZone filename={f.kwitansiFile} scanning={scanW} ocr={ocrW} onFile={handleKwitansi} />
              {f.kwitansiFile && (
                scanW ? (
                  <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-900/50">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      <p className="text-sm font-semibold text-violet-400">Membaca dokumen kwitansi…</p>
                    </div>
                    <div className="space-y-3 p-5">
                      {[100, 78, 88, 62, 92].map((w, i) => (
                        <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-800/70" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <KwitansiDataCard f={f} ocrW={ocrW} set={set} />
                )
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                BLOK 3 · KESEPAKATAN
            ═══════════════════════════════════════════════════════════ */}
            <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">
              <SectionTitle n="03" label="Kesepakatan" />

              {/* NIB + Deadline */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-visible">
                <div className="rounded-t-2xl border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 text-violet-600" />
                    <p className="text-sm font-bold text-white">Data Objek & Batas Waktu</p>
                  </div>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <EF
                    label="Nomor NIB"
                    value={f.nomor_nib}
                    onChange={v => set("nomor_nib", v)}
                    required
                    placeholder="cth: 12.39.000032241.0"
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Deadline Serah Terima<span className="ml-0.5 text-violet-500">*</span>
                    </label>
                    <CalendarPicker
                      value={f.deadline_serah_terima}
                      onChange={v => set("deadline_serah_terima", v)}
                    />
                  </div>
                </div>
              </div>

              {/* Kompensasi + 2 Termin */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 text-violet-600" />
                    <p className="text-sm font-bold text-white">Biaya Kompensasi</p>
                  </div>
                </div>
                <div className="p-4 space-y-5">

                  {/* Total */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Total Kompensasi<span className="ml-0.5 text-violet-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatRp(f.total_kompensasi)}
                        onChange={e => set("total_kompensasi", e.target.value.replace(/\D/g, ""))}
                        placeholder="50.000.000"
                        className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20"
                      />
                    </div>
                  </div>

                  {/* Termin 2 baris */}
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Pembayaran Termin</p>

                    {/* Termin 1 */}
                    <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/30">
                      <div className="flex items-center gap-2 border-b border-slate-800/60 px-3.5 py-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-400">1</span>
                        <span className="text-xs font-semibold text-slate-400">Termin Pertama</span>
                        <span className="ml-auto text-[10px] text-slate-400">Saat penandatanganan akta</span>
                      </div>
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-32">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={termin1Persen}
                              onChange={e => setTermin1Persen(e.target.value.replace(/[^0-9.]/g, ""))}
                              placeholder="50"
                              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-2 pl-3 pr-7 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                          </div>
                        </div>
                        <span className="text-slate-700">=</span>
                        <div className={[
                          "flex-1 rounded-xl border px-3.5 py-2 text-sm font-bold transition",
                          t1.display
                            ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                            : "border-slate-800 bg-slate-900/60 text-slate-700",
                        ].join(" ")}>
                          {t1.display ? `Rp ${t1.display}` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Termin 2 — sisa otomatis */}
                    <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/30">
                      <div className="flex items-center gap-2 border-b border-slate-800/60 px-3.5 py-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-400">2</span>
                        <span className="text-xs font-semibold text-slate-400">Termin Kedua</span>
                        <span className="ml-auto text-[10px] text-slate-600">Saat objek kosong & kunci diserahkan</span>
                      </div>
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-32">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 py-2 pl-3 pr-7 text-sm font-bold text-slate-500">
                            {t2PctNum % 1 === 0 ? t2PctNum : t2PctNum.toFixed(2)}%
                          </div>
                        </div>
                        <span className="text-slate-700">=</span>
                        <div className={[
                          "flex-1 rounded-xl border px-3.5 py-2 text-sm font-bold transition",
                          t2.display
                            ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300"
                            : "border-slate-800 bg-slate-900/60 text-slate-700",
                        ].join(" ")}>
                          {t2.display ? `Rp ${t2.display}` : "— (sisa otomatis)"}
                        </div>
                      </div>
                    </div>

                    {/* Warning jika persen tidak valid */}
                    {f.total_kompensasi && t1PctNum > 0 && (t1PctNum <= 0 || t1PctNum >= 100) && (
                      <p className="text-[11px] text-amber-400">⚠ Persentase termin 1 harus antara 1% dan 99%</p>
                    )}
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4 sm:px-7 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose}
              className="h-12 rounded-2xl border border-slate-800 px-5 text-sm font-medium text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
            >
              Batal
            </button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || anyScan || generating}
              className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-[0_6px_20px_-4px_rgba(139,92,246,0.45)] transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {generating  ? <><Loader2 className="h-4 w-4 animate-spin" />Membuat Akta…</>
               : anyScan   ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses…</>
               : <><ScanLine className="h-4 w-4" />Generate Akta</>}
            </button>
          </div>
          {!canSubmit && !anyScan && (
            <p className="mt-2 text-[11px] text-slate-600">
              Lengkapi field bertanda <span className="text-violet-500">*</span> — termin 1 harus antara 1%–99%
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Kwitansi Data Card ───────────────────────────────────────────────────────

function KwitansiDataCard({ f, ocrW, set }: { f: Form; ocrW: OcrMeta; set: (k: keyof Form, v: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-5 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Hasil Scan Kwitansi</p>
        {ocrW.status !== "idle" && (
          <span className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            ocrW.status === "valid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400",
          ].join(" ")}>
            {ocrW.status === "valid" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {ocrW.status === "valid" ? "Terdeteksi" : "Perlu dicek"}
            {ocrW.confidence > 0 && <span className="opacity-60">· {Math.round(ocrW.confidence)}%</span>}
          </span>
        )}
      </div>
      {ocrW.warnings.length > 0 && (
        <div className="border-b border-slate-800 bg-amber-500/5 px-5 py-2.5 space-y-0.5">
          {ocrW.warnings.map((w, i) => <p key={i} className="text-xs text-amber-400">· {w}</p>)}
        </div>
      )}
      {/* Sertifikat */}
      <div className="border-b border-slate-800/60 px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Sertifikat</p>
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Jenis Sertifikat</label>
            <input value={f.jenis_sertifikat} onChange={e => set("jenis_sertifikat", e.target.value)} placeholder="Terisi otomatis dari OCR"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
          </div>
          {f.singkatan_sertifikat && (
            <div className="shrink-0">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Kode</label>
              <div className="inline-flex h-[42px] items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 text-sm font-black text-violet-400">{f.singkatan_sertifikat}</div>
            </div>
          )}
          <div className="w-28 shrink-0">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Luas</label>
            <div className="relative">
              <input value={f.luas} onChange={e => set("luas", e.target.value)} placeholder="0"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 pr-8 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">m²</span>
            </div>
          </div>
        </div>
        <EF label="Nomor Sertifikat" value={f.no_sertifikat} onChange={v => set("no_sertifikat", v)} placeholder="cth: 00169/wonorejo" />
      </div>
      {/* Lokasi */}
      <div className="border-b border-slate-800/60 px-5 py-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lokasi Aset</p>
        <textarea rows={2} value={f.lokasi_asset} onChange={e => set("lokasi_asset", e.target.value)}
          placeholder="Alamat lengkap objek kesepakatan"
          className="w-full resize-none rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <EF label="Kelurahan / Desa" value={f.kelurahan_asset} onChange={v => set("kelurahan_asset", v)} />
          <EF label="Kecamatan"        value={f.kecamatan_asset} onChange={v => set("kecamatan_asset", v)} />
          <EF label="Kota / Kab."      value={f.kota_asset}      onChange={v => set("kota_asset", v)} />
          <EF label="Provinsi"         value={f.provinsi_asset}  onChange={v => set("provinsi_asset", v)} />
        </div>
      </div>
      {/* Kwitansi & Risalah */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Kuitansi & Risalah Lelang</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <EF label="Nomor Kuitansi"         value={f.nomor_kwitansi}       onChange={v => set("nomor_kwitansi", v)} />
          <EF label="Tanggal Kuitansi"       value={f.tanggal_kwitansi}     onChange={v => set("tanggal_kwitansi", v)}     placeholder="cth: 22 Desember 2025" />
          <EF label="Nomor Risalah Lelang"   value={f.nomor_risalah_lelang} onChange={v => set("nomor_risalah_lelang", v)} />
          <EF label="Tanggal Risalah Lelang" value={f.tanggal_risalah}      onChange={v => set("tanggal_risalah", v)}      placeholder="cth: 18 Desember 2025" />
        </div>
        <EF label="Bank Pemohon Lelang" value={f.nama_bank} onChange={v => set("nama_bank", v)} placeholder="cth: PT. Bank Rakyat Indonesia (Persero), Tbk" />
      </div>
    </div>
  );
}

// ─── KTP Upload Zone ──────────────────────────────────────────────────────────

function KtpZone({ label, hint, filename, scanning, ocr, onFile }: { label: string; hint: string; filename: string; scanning: boolean; ocr: OcrMeta; onFile: (f: File) => void }) {
  const ref  = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const pick = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)) { alert("Format: JPG, PNG, atau WEBP"); return; }
    if (file.size > 8 * 1024 * 1024) { alert("Maksimal 8 MB"); return; }
    onFile(file);
  };
  const done    = Boolean(filename) && !scanning;
  const success = done && ocr.status === "valid";
  const warn    = done && (ocr.status === "review" || ocr.status === "invalid");
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      onClick={() => !scanning && ref.current?.click()}
      className={["relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 px-4 py-7 text-center transition-all duration-200",
        scanning ? "pointer-events-none border-violet-500/30 bg-violet-500/5"
          : drag   ? "scale-[1.015] border-violet-400 bg-violet-500/10"
          : success ? "border-violet-500/40 bg-violet-500/5 hover:border-violet-500/60"
          : warn    ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
          : filename ? "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          : "border-dashed border-slate-700 bg-slate-900/40 hover:border-violet-500/40 hover:bg-slate-900/70",
      ].join(" ")}>
      {scanning ? (
        <>
          <div className="relative text-violet-500/20"><KtpSvg className="h-14 w-auto" /></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
            <p className="text-xs font-semibold text-violet-400">Membaca KTP…</p>
          </div>
        </>
      ) : filename ? (
        <>
          <div className={["flex h-12 w-12 items-center justify-center rounded-2xl", success ? "bg-violet-500/15 text-violet-400" : warn ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400"].join(" ")}>
            {success ? <CheckCircle2 className="h-6 w-6" /> : warn ? <AlertTriangle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
          </div>
          <div>
            <p className={["text-sm font-bold", success ? "text-violet-400" : warn ? "text-amber-400" : "text-slate-200"].join(" ")}>
              {success ? "KTP Berhasil Diproses" : warn ? "Perlu Dicek Manual" : "File Terupload"}
            </p>
            <p className="mt-0.5 max-w-[140px] truncate text-xs text-slate-500">{filename}</p>
            {ocr.confidence > 0 && <p className="mt-1 text-[11px] text-slate-600">OCR {Math.round(ocr.confidence)}%</p>}
          </div>
          <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">Klik untuk ganti foto</span>
        </>
      ) : (
        <>
          <div className="text-slate-800"><KtpSvg className="h-14 w-auto" /></div>
          <div><p className="text-sm font-bold text-slate-200">{label}</p><p className="mt-0.5 text-xs text-slate-500">{hint}</p></div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-500/40 hover:text-violet-400">
            <Upload className="h-3.5 w-3.5" />Pilih Foto KTP
          </div>
          <p className="text-[11px] text-slate-700">JPG · PNG · WEBP · maks 8 MB</p>
        </>
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden"
        onChange={e => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
    </div>
  );
}

// ─── Doc Upload Zone ──────────────────────────────────────────────────────────

function DocZone({ filename, scanning, ocr, onFile }: { filename: string; scanning: boolean; ocr: OcrMeta; onFile: (f: File) => void }) {
  const ref  = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const pick = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Format: PDF"); return; }
    if (file.size > 8 * 1024 * 1024) { alert("Maksimal 8 MB"); return; }
    onFile(file);
  };
  const done    = Boolean(filename) && !scanning;
  const success = done && ocr.status === "valid";
  const warn    = done && (ocr.status === "review" || ocr.status === "invalid");
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      onClick={() => !scanning && ref.current?.click()}
      className={["flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-all duration-200",
        scanning ? "pointer-events-none border-violet-500/30 bg-violet-500/5"
          : drag    ? "scale-[1.01] border-violet-400 bg-violet-500/10"
          : success ? "border-violet-500/40 bg-violet-500/5"
          : warn    ? "border-amber-500/30 bg-amber-500/5"
          : filename ? "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          : "border-dashed border-slate-700 bg-slate-900/40 hover:border-violet-500/40",
      ].join(" ")}>
      <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        scanning ? "bg-violet-500/10 text-violet-400" : success ? "bg-violet-500/15 text-violet-400" : warn ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-500",
      ].join(" ")}>
        {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : success ? <CheckCircle2 className="h-5 w-5" /> : warn ? <AlertTriangle className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        {scanning ? <p className="text-sm font-semibold text-violet-400">Membaca kwitansi PDF…</p>
          : filename ? <><p className={["truncate text-sm font-semibold", success ? "text-violet-400" : warn ? "text-amber-400" : "text-slate-200"].join(" ")}>{filename}</p><p className="text-xs text-slate-500">Klik untuk ganti file PDF</p></>
          : <><p className="text-sm font-semibold text-slate-200">Upload Kwitansi KPKNL</p><p className="text-xs text-slate-500">Drag & drop atau klik · PDF · maks 8 MB</p></>}
      </div>
      {done && ocr.status !== "idle" && (
        <span className={["shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          success ? "border-violet-500/20 bg-violet-500/10 text-violet-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400",
        ].join(" ")}>{success ? "✓ Valid" : "⚠ Cek manual"}</span>
      )}
      <input ref={ref} type="file" accept="application/pdf" className="hidden"
        onChange={e => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
    </div>
  );
}

// ─── KTP SVG Illustration ─────────────────────────────────────────────────────

function KtpSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 128" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="196" height="124" rx="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" />
      <rect x="14" y="18" width="50" height="68" rx="5" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <circle cx="39" cy="42" r="11" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path d="M22 78 Q39 66 56 78" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      <rect x="78" y="22" width="106" height="8" rx="4" fill="currentColor" opacity="0.14" />
      <rect x="78" y="38" width="84" height="6" rx="3" fill="currentColor" opacity="0.10" />
      <rect x="78" y="51" width="94" height="6" rx="3" fill="currentColor" opacity="0.10" />
      <rect x="78" y="64" width="72" height="6" rx="3" fill="currentColor" opacity="0.10" />
      <rect x="14" y="101" width="172" height="16" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.22" />
      {[0,8,16,24,32,40,50,58,68,76,84,94,102,110,120,128,136,144,154,162,170].map((x, i) => (
        <rect key={i} x={20+x} y="106" width={i%3===0?6:4} height="6" rx="0.5" fill="currentColor" opacity="0.18" />
      ))}
    </svg>
  );
}

// ─── DataCard ─────────────────────────────────────────────────────────────────

function DataCard({ label, ocr, show, children }: { label: string; ocr: OcrMeta; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <p className="text-sm font-bold text-white">{label}</p>
        {ocr.status !== "idle" && (
          <span className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            ocr.status === "valid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400",
          ].join(" ")}>
            {ocr.status === "valid" ? <><CheckCircle2 className="h-3 w-3" />Data Valid</> : <><AlertTriangle className="h-3 w-3" />Perlu Dicek</>}
            {ocr.confidence > 0 && <span className="opacity-60">· {Math.round(ocr.confidence)}%</span>}
          </span>
        )}
      </div>
      {ocr.warnings.length > 0 && (
        <div className="border-b border-slate-800 bg-amber-500/5 px-4 py-2.5">
          {ocr.warnings.map((w, i) => <p key={i} className="text-xs text-amber-400">· {w}</p>)}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── KTP Field Grid ───────────────────────────────────────────────────────────

function KtpFieldGrid({ fields, onChange }: { fields: { label: string; value: string; key: string; required?: boolean; placeholder?: string }[]; onChange: (key: string, val: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(f => (
        <EF key={f.key} label={f.label} value={f.value} onChange={v => onChange(f.key, v)} required={f.required} placeholder={f.placeholder} />
      ))}
    </div>
  );
}

// ─── Address Block ────────────────────────────────────────────────────────────

function AddressBlock({ utama, rtRw, kelurahan, kecamatan, kota, jenisKota, alamat, onUtama, onRtRw, onKelurahan, onKecamatan, onKota, onJenisKota, onAlamat, onRefresh }: {
  utama: string; rtRw: string; kelurahan: string; kecamatan: string; kota: string; jenisKota: string; alamat: string;
  onUtama: (v: string) => void; onRtRw: (v: string) => void; onKelurahan: (v: string) => void;
  onKecamatan: (v: string) => void; onKota: (v: string) => void; onJenisKota: (v: string) => void;
  onAlamat: (v: string) => void; onRefresh: () => void;
}) {
  const [showParts, setShowParts] = useState(false);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">Alamat</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowParts(p => !p)} className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300">
            {showParts ? "Sembunyikan rincian" : "Edit rincian"}
          </button>
          <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
            <RefreshCw className="h-2.5 w-2.5" />Susun ulang
          </button>
        </div>
      </div>
      {showParts && (
        <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-2">
          <EF label="Jalan / Alamat Utama" value={utama}    onChange={onUtama} />
          <EF label="RT/RW"               value={rtRw}      onChange={onRtRw}      placeholder="003/008" />
          <EF label="Kelurahan"           value={kelurahan} onChange={onKelurahan} />
          <EF label="Kecamatan"           value={kecamatan} onChange={onKecamatan} />
          <EF label="Jenis (Kota/Kab.)"   value={jenisKota} onChange={onJenisKota} placeholder="Kota / Kabupaten" />
          <EF label="Nama Kota / Kab."    value={kota}      onChange={onKota} />
        </div>
      )}
      <textarea rows={2} value={alamat} onChange={e => onAlamat(e.target.value)} placeholder="Alamat lengkap sesuai KTP"
        className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function SectionTitle({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-black text-violet-500">{n}</span>
      <p className="text-[15px] font-bold text-white">{label}</p>
    </div>
  );
}

function EF({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="ml-0.5 text-violet-500">*</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20" />
    </div>
  );
}
