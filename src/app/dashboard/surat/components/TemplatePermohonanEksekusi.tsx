"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Upload,
  X,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";
import { generateSurat, downloadBlob } from "@/lib/generateSurat";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

export type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit?: (payload: { template: SuratTemplate; values: Record<string, string> }) => void;
};

type ScanStatus = "idle" | "valid" | "review" | "invalid";

type OcrKtpParsed = {
  nama_pemohon?: string; nik_pemohon?: string;
  kotalahir_pemohon?: string; tanggallahir_pemohon?: string;
  kelamin_pemohon?: string; agama_pemohon?: string;
  alamat_pemohon?: string; alamat_utama_pemohon?: string;
  kelurahan_pemohon?: string; kecamatan_pemohon?: string;
  kota_pemohon?: string; jenis_kota_pemohon?: string;
  rt_rw_pemohon?: string; pekerjaan_pemohon?: string;
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

type OcrMeta = { status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string };
const FRESH: OcrMeta = { status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" };

type Form = {
  mode: "sendiri" | "kuasa";
  // Pemohon
  ktpPemohon: string;
  nama_pemohon: string; nik_pemohon: string;
  kotalahir_pemohon: string; tanggallahir_pemohon: string;
  kelamin_pemohon: string; agama_pemohon: string;
  warga_negara: string; pekerjaan_pemohon: string;
  statuskawin_pemohon: string;
  alamat_utama_pemohon: string; rt_rw_pemohon: string;
  kelurahan_pemohon: string; kecamatan_pemohon: string;
  kota_pemohon: string; jenis_kota_pemohon: string;
  alamat_pemohon: string;
  // Kuasa
  ktpKuasa: string;
  nama_kuasa: string; nik_kuasa: string;
  kotalahir_kuasa: string; tanggallahir_kuasa: string;
  kelamin_kuasa: string; agama_kuasa: string;
  pekerjaan_kuasa: string; statuskawin_kuasa: string; alamat_kuasa: string;
  // Kwitansi & Sertifikat (auto dari OCR)
  kwitansiFile: string;
  nomor_kwitansi: string; tanggal_kwitansi: string;
  nomor_risalah_lelang: string; tanggal_risalah: string;
  nama_bank: string;
  jenis_sertifikat: string; singkatan_sertifikat: string;
  no_sertifikat: string; luas: string; lokasi_asset: string;
  kelurahan_asset: string; kecamatan_asset: string; kota_asset: string;
  // Data Tambahan (input manual)
  nama_debitur: string;
  nomor_aktegrosse: string; nomor_nib: string;
};

const BLANK: Form = {
  mode: "sendiri",
  ktpPemohon: "", nama_pemohon: "", nik_pemohon: "",
  kotalahir_pemohon: "", tanggallahir_pemohon: "",
  kelamin_pemohon: "", agama_pemohon: "",
  warga_negara: "Indonesia", pekerjaan_pemohon: "",
  statuskawin_pemohon: "",
  alamat_utama_pemohon: "", rt_rw_pemohon: "",
  kelurahan_pemohon: "", kecamatan_pemohon: "",
  kota_pemohon: "", jenis_kota_pemohon: "", alamat_pemohon: "",
  ktpKuasa: "", nama_kuasa: "", nik_kuasa: "",
  kotalahir_kuasa: "", tanggallahir_kuasa: "",
  kelamin_kuasa: "", agama_kuasa: "",
  pekerjaan_kuasa: "", statuskawin_kuasa: "", alamat_kuasa: "",
  kwitansiFile: "",
  nomor_kwitansi: "", tanggal_kwitansi: "",
  nomor_risalah_lelang: "", tanggal_risalah: "",
  nama_bank: "",
  jenis_sertifikat: "", singkatan_sertifikat: "",
  no_sertifikat: "", luas: "", lokasi_asset: "",
  kelurahan_asset: "", kecamatan_asset: "", kota_asset: "",
  nama_debitur: "",
  nomor_aktegrosse: "", nomor_nib: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAlamat(p: { alamatUtama?: string; rtRw?: string; kelurahan?: string; kecamatan?: string; kota?: string; jenisKota?: string }) {
  const parts: string[] = [];
  if (p.alamatUtama?.trim()) parts.push(p.alamatUtama.trim());
  if (p.rtRw?.trim()) parts.push(`RT/RW ${p.rtRw.trim()}`);
  if (p.kelurahan?.trim()) parts.push(`Kel. ${p.kelurahan.trim()}`);
  if (p.kecamatan?.trim()) parts.push(`Kec. ${p.kecamatan.trim()}`);
  if (p.kota?.trim()) {
    const pre = p.jenisKota === "Kota" ? "Kota" : p.jenisKota === "Kabupaten" ? "Kabupaten" : "";
    parts.push(pre ? `${pre} ${p.kota.trim()}` : p.kota.trim());
  }
  return parts.join(", ");
}

function getRaw(r: OcrKtpResult | OcrRisalahResult) {
  return r.cleaned_text || r.cleanedText || r.raw_text || r.rawText || "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatePermohonanEksekusi({ open, template, onClose, onSubmit }: Props) {
  const [f, setF] = useState<Form>(BLANK);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));

  const [scanP, setScanP] = useState(false);
  const [scanK, setScanK] = useState(false);
  const [scanW, setScanW] = useState(false);

  const [ocrP, setOcrP] = useState<OcrMeta>(FRESH);
  const [ocrK, setOcrK] = useState<OcrMeta>(FRESH);
  const [ocrW, setOcrW] = useState<OcrMeta>(FRESH);

  const [banner, setBanner] = useState<{ type: "warn" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (!open) { setF(BLANK); setScanP(false); setScanK(false); setScanW(false); setOcrP(FRESH); setOcrK(FRESH); setOcrW(FRESH); setBanner(null); }
  }, [open]);

  // KTP OCR
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
      const p = res.parsed ?? {};
      const alamat = buildAlamat({ alamatUtama: p.alamat_utama_pemohon, rtRw: p.rt_rw_pemohon, kelurahan: p.kelurahan_pemohon, kecamatan: p.kecamatan_pemohon, kota: p.kota_pemohon, jenisKota: p.jenis_kota_pemohon }) || p.alamat_pemohon || "";
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

  const handleKtpPemohon = (file: File) => {
    set("ktpPemohon", file.name);
    void runKtpOcr(file, setScanP, setOcrP, (p, alamat) => setF(prev => ({
      ...prev,
      nama_pemohon: p.nama_pemohon || prev.nama_pemohon,
      nik_pemohon: p.nik_pemohon || prev.nik_pemohon,
      kotalahir_pemohon: p.kotalahir_pemohon || prev.kotalahir_pemohon,
      tanggallahir_pemohon: p.tanggallahir_pemohon || prev.tanggallahir_pemohon,
      kelamin_pemohon: p.kelamin_pemohon || prev.kelamin_pemohon,
      agama_pemohon: p.agama_pemohon || prev.agama_pemohon,
      warga_negara: p.warga_negara || prev.warga_negara || "Indonesia",
      pekerjaan_pemohon: p.pekerjaan_pemohon || prev.pekerjaan_pemohon,
      statuskawin_pemohon: p.statuskawin_pemohon || prev.statuskawin_pemohon,
      alamat_utama_pemohon: p.alamat_utama_pemohon || prev.alamat_utama_pemohon,
      rt_rw_pemohon: p.rt_rw_pemohon || prev.rt_rw_pemohon,
      kelurahan_pemohon: p.kelurahan_pemohon || prev.kelurahan_pemohon,
      kecamatan_pemohon: p.kecamatan_pemohon || prev.kecamatan_pemohon,
      kota_pemohon: p.kota_pemohon || prev.kota_pemohon,
      jenis_kota_pemohon: p.jenis_kota_pemohon || prev.jenis_kota_pemohon,
      alamat_pemohon: alamat || prev.alamat_pemohon,
    })), "KTP Pemohon");
  };

  const handleKtpKuasa = (file: File) => {
    set("ktpKuasa", file.name);
    void runKtpOcr(file, setScanK, setOcrK, (p, alamat) => setF(prev => ({
      ...prev,
      nama_kuasa: p.nama_pemohon || prev.nama_kuasa,
      nik_kuasa: p.nik_pemohon || prev.nik_kuasa,
      kotalahir_kuasa: p.kotalahir_pemohon || prev.kotalahir_kuasa,
      tanggallahir_kuasa: p.tanggallahir_pemohon || prev.tanggallahir_kuasa,
      kelamin_kuasa: p.kelamin_pemohon || prev.kelamin_kuasa,
      agama_kuasa: p.agama_pemohon || prev.agama_kuasa,
      pekerjaan_kuasa: p.pekerjaan_pemohon || prev.pekerjaan_kuasa,
      statuskawin_kuasa: p.statuskawin_pemohon || prev.statuskawin_kuasa,
      alamat_kuasa: alamat || prev.alamat_kuasa,
    })), "KTP Kuasa");
  };

  const handleKwitansi = async (file: File) => {
    set("kwitansiFile", file.name);
    setBanner(null); setScanW(true); setOcrW(FRESH);
    try {
      const res = (await ocrRisalah(file)) as OcrRisalahResult;
      const p = res.parsed ?? {};
      const newJenis = p.jenis_sertifikat || "";
      const newSingkatan = p.singkatan_sertifikat || "";
      const lokasiParts = [
        p.alamat_desa ? `Desa/Kel ${p.alamat_desa}` : "",
        p.alamat_kecamatan ? `Kecamatan ${p.alamat_kecamatan}` : "",
        p.alamat_kota ? `Kota ${p.alamat_kota}` : "",
        p.alamat_provinsi ? `Provinsi ${p.alamat_provinsi}` : "",
      ].filter(Boolean).join(" ");
      setF(prev => ({
        ...prev,
        nomor_kwitansi: p.nomor_kwitansi || prev.nomor_kwitansi,
        tanggal_kwitansi: p.tanggal_kwitansi || prev.tanggal_kwitansi,
        nomor_risalah_lelang: p.nomor_risalah_lelang || prev.nomor_risalah_lelang,
        tanggal_risalah: p.tanggal_risalah || prev.tanggal_risalah,
        nama_bank: p.nama_bank || prev.nama_bank,
        luas: p.luas || prev.luas,
        lokasi_asset: lokasiParts || prev.lokasi_asset,
        kelurahan_asset: p.alamat_desa || prev.kelurahan_asset,
        kecamatan_asset: p.alamat_kecamatan || prev.kecamatan_asset,
        kota_asset: p.alamat_kota || prev.kota_asset,
        jenis_sertifikat: newJenis || prev.jenis_sertifikat,
        singkatan_sertifikat: newSingkatan || prev.singkatan_sertifikat,
        no_sertifikat: p.no_sertifikat || prev.no_sertifikat,
        nomor_nib: p.nomor_nib || prev.nomor_nib,
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

  const refreshPemohonAlamat = () =>
    set("alamat_pemohon", buildAlamat({ alamatUtama: f.alamat_utama_pemohon, rtRw: f.rt_rw_pemohon, kelurahan: f.kelurahan_pemohon, kecamatan: f.kecamatan_pemohon, kota: f.kota_pemohon, jenisKota: f.jenis_kota_pemohon }));

  const templateFile = f.mode === "kuasa"
    ? "Template_permohonan_PN_DenganKuasa.docx"
    : "Template_permohonan_PN_LangsungPemohon.docx";

  const [generating, setGenerating] = useState(false);

  const anyScan = scanP || scanK || scanW;

  const canSubmit = useMemo(() => {
    const p = f.nama_pemohon.trim() && f.nik_pemohon.trim();
    const k = f.mode !== "kuasa" || f.nama_kuasa.trim();
    const w = f.nomor_kwitansi.trim() && f.nama_debitur.trim();
    const s = f.nomor_aktegrosse.trim() && f.nomor_nib.trim();
    return Boolean(p && k && w && s);
  }, [f]);

  const handleSubmit = async () => {
    if (!template || generating) return;
    setGenerating(true);
    setBanner(null);
    try {
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === "string") values[k] = v;
      }
      values.templateFileName = templateFile;
      const { blob, filename, isPdf } = await generateSurat(templateFile, values);
      downloadBlob(blob, filename);
      if (!isPdf) {
        setBanner({ type: "warn", msg: "LibreOffice tidak terdeteksi — file .docx berhasil diunduh. Buka dengan Word/LibreOffice untuk melihat hasilnya." });
      }
      onSubmit?.({ template, values });
    } catch (e) {
      setBanner({ type: "err", msg: e instanceof Error ? e.message : "Gagal generate surat. Pastikan server backend aktif." });
    } finally {
      setGenerating(false);
    }
  };

  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] sm:rounded-[28px] border border-slate-800 bg-slate-950 shadow-[0_-20px_80px_-10px_rgba(0,0,0,0.7)] max-h-[94dvh] sm:max-h-[90vh]">

        {/* Emerald accent bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-800 sm:hidden" />

        {/* ─── HEADER ────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">LIT-001</p>
              <h2 className="text-[15px] font-bold leading-tight text-white">Permohonan Eksekusi ke Pengadilan Negeri</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-500 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white">
            <X size={15} />
          </button>
        </div>

        {/* ─── BODY ──────────────────────────────────────────────────────── */}
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

              {/* Step label + small toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle n="01" label="Pemohon" />
                {/* Compact segmented control */}
                <div className="flex overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-sm">
                  <button
                    type="button"
                    onClick={() => set("mode", "sendiri")}
                    className={["px-4 py-2 font-medium transition-all", f.mode === "sendiri" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"].join(" ")}
                  >
                    Langsung Pemohon
                  </button>
                  <button
                    type="button"
                    onClick={() => set("mode", "kuasa")}
                    className={["px-4 py-2 font-medium transition-all", f.mode === "kuasa" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"].join(" ")}
                  >
                    Dengan Kuasa
                  </button>
                </div>
              </div>

              {/* Upload zones */}
              <div className={f.mode === "kuasa" ? "grid gap-4 md:grid-cols-2" : ""}>
                <KtpZone
                  label="KTP Pemohon"
                  hint={f.mode === "kuasa" ? "Pihak yang memberi kuasa" : "Pihak yang mengajukan eksekusi"}
                  filename={f.ktpPemohon}
                  scanning={scanP}
                  ocr={ocrP}
                  onFile={handleKtpPemohon}
                />
                {f.mode === "kuasa" && (
                  <KtpZone
                    label="KTP Kuasa Pemohon"
                    hint="Advokat / penerima kuasa"
                    filename={f.ktpKuasa}
                    scanning={scanK}
                    ocr={ocrK}
                    onFile={handleKtpKuasa}
                  />
                )}
              </div>

              {/* Data Pemohon fields */}
              <DataCard label="Data Pemohon" ocr={ocrP} show={Boolean(f.ktpPemohon || f.nama_pemohon)}>
                <KtpFieldGrid
                  fields={[
                    { label: "Nama", value: f.nama_pemohon, key: "nama_pemohon", required: true },
                    { label: "NIK", value: f.nik_pemohon, key: "nik_pemohon", required: true, placeholder: "16 digit" },
                    { label: "Kota Lahir", value: f.kotalahir_pemohon, key: "kotalahir_pemohon" },
                    { label: "Tanggal Lahir", value: f.tanggallahir_pemohon, key: "tanggallahir_pemohon", placeholder: "cth: 18 Oktober 1983" },
                    { label: "Jenis Kelamin", value: f.kelamin_pemohon, key: "kelamin_pemohon" },
                    { label: "Agama", value: f.agama_pemohon, key: "agama_pemohon" },
                    { label: "Warga Negara", value: f.warga_negara, key: "warga_negara" },
                    { label: "Pekerjaan", value: f.pekerjaan_pemohon, key: "pekerjaan_pemohon" },
                    { label: "Status Kawin", value: f.statuskawin_pemohon, key: "statuskawin_pemohon" },
                  ]}
                  onChange={(k, v) => set(k as keyof Form, v)}
                />
                <AddressBlock
                  utama={f.alamat_utama_pemohon} rtRw={f.rt_rw_pemohon}
                  kelurahan={f.kelurahan_pemohon} kecamatan={f.kecamatan_pemohon}
                  kota={f.kota_pemohon} jenisKota={f.jenis_kota_pemohon}
                  alamat={f.alamat_pemohon}
                  onUtama={v => set("alamat_utama_pemohon", v)}
                  onRtRw={v => set("rt_rw_pemohon", v)}
                  onKelurahan={v => set("kelurahan_pemohon", v)}
                  onKecamatan={v => set("kecamatan_pemohon", v)}
                  onKota={v => set("kota_pemohon", v)}
                  onJenisKota={v => set("jenis_kota_pemohon", v)}
                  onAlamat={v => set("alamat_pemohon", v)}
                  onRefresh={refreshPemohonAlamat}
                />
              </DataCard>

              {/* Data Kuasa fields */}
              {f.mode === "kuasa" && (
                <DataCard label="Data Kuasa Pemohon" ocr={ocrK} show={Boolean(f.ktpKuasa || f.nama_kuasa)}>
                  <KtpFieldGrid
                    fields={[
                      { label: "Nama Kuasa", value: f.nama_kuasa, key: "nama_kuasa", required: true },
                      { label: "NIK", value: f.nik_kuasa, key: "nik_kuasa", required: true, placeholder: "16 digit" },
                      { label: "Kota Lahir", value: f.kotalahir_kuasa, key: "kotalahir_kuasa" },
                      { label: "Tanggal Lahir", value: f.tanggallahir_kuasa, key: "tanggallahir_kuasa" },
                      { label: "Jenis Kelamin", value: f.kelamin_kuasa, key: "kelamin_kuasa" },
                      { label: "Agama", value: f.agama_kuasa, key: "agama_kuasa" },
                      { label: "Pekerjaan", value: f.pekerjaan_kuasa, key: "pekerjaan_kuasa" },
                      { label: "Status Kawin", value: f.statuskawin_kuasa, key: "statuskawin_kuasa" },
                    ]}
                    onChange={(k, v) => set(k as keyof Form, v)}
                  />
                  <div className="mt-3">
                    <ETA label="Alamat Kuasa" value={f.alamat_kuasa} onChange={v => set("alamat_kuasa", v)} rows={2} />
                  </div>
                </DataCard>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                BLOK 2 · KWITANSI & SERTIFIKAT
            ════════════════════════════════════════════════════════════════ */}
            <div className="px-5 py-6 sm:px-7 sm:py-7 space-y-5">
              <SectionTitle n="02" label="Kwitansi & Sertifikat" />

              {/* PDF Upload */}
              <DocZone
                filename={f.kwitansiFile}
                scanning={scanW}
                ocr={ocrW}
                onFile={handleKwitansi}
              />

              {/* OCR Result Card — skeleton saat scan, data setelah selesai */}
              {f.kwitansiFile && (
                scanW ? (
                  <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900/50">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 px-5 py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                      <p className="text-sm font-semibold text-emerald-400">Membaca dokumen kwitansi…</p>
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

              {/* Manual Input Section */}
              <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40">
                <div className="border-b border-slate-800 bg-slate-900/80 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-black text-amber-400">✎</div>
                    <p className="text-sm font-bold text-white">Isi Manual</p>
                  </div>
                  <p className="mt-0.5 pl-[34px] text-xs text-slate-500">Data yang tidak terbaca dari kwitansi — wajib diisi</p>
                </div>
                <div className="p-5 space-y-4">
                  <EF
                    label="Nama Debitur / Termohon"
                    value={f.nama_debitur}
                    onChange={v => set("nama_debitur", v)}
                    required
                    placeholder="Nama sesuai akta / pemilik awal"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <EF
                      label="Nomor Akte Grosse"
                      value={f.nomor_aktegrosse}
                      onChange={v => set("nomor_aktegrosse", v)}
                      required
                      placeholder="cth: 123/2024"
                    />
                    <EF
                      label="Nomor NIB"
                      value={f.nomor_nib}
                      onChange={v => set("nomor_nib", v)}
                      required
                      placeholder="Nomor Identifikasi Bidang"
                    />
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* ─── FOOTER ────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 px-5 py-4 sm:px-7 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose}
              className="h-12 rounded-2xl border border-slate-800 px-5 text-sm font-medium text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
            >
              Batal
            </button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || anyScan || generating}
              className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-6 text-sm font-bold text-slate-950 shadow-[0_6px_20px_-4px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Membuat PDF…</>
                : anyScan
                ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses…</>
                : <><ScanLine className="h-4 w-4" />Generate Surat</>
              }
            </button>
          </div>
          {!canSubmit && !anyScan && (
            <p className="mt-2 text-[11px] text-slate-600">
              Lengkapi field bertanda <span className="text-emerald-600">*</span> untuk melanjutkan
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Kwitansi Data Card (OCR result display) ─────────────────────────────────

function KwitansiDataCard({ f, ocrW, set }: {
  f: Form;
  ocrW: OcrMeta;
  set: (k: keyof Form, v: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-5 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Hasil Scan Kwitansi</p>
        {ocrW.status !== "idle" && (
          <span className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            ocrW.status === "valid"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/10 text-amber-400",
          ].join(" ")}>
            {ocrW.status === "valid"
              ? <CheckCircle2 className="h-3 w-3" />
              : <AlertTriangle className="h-3 w-3" />}
            {ocrW.status === "valid" ? "Terdeteksi" : "Perlu dicek"}
            {ocrW.confidence > 0 && (
              <span className="opacity-60">· {Math.round(ocrW.confidence)}%</span>
            )}
          </span>
        )}
      </div>

      {/* Warnings */}
      {ocrW.warnings.length > 0 && (
        <div className="border-b border-slate-800 bg-amber-500/5 px-5 py-2.5 space-y-0.5">
          {ocrW.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">· {w}</p>
          ))}
        </div>
      )}

      {/* ── Sertifikat ── */}
      <div className="border-b border-slate-800/60 px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Sertifikat</p>
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Jenis Sertifikat</label>
            <input
              value={f.jenis_sertifikat}
              onChange={e => set("jenis_sertifikat", e.target.value)}
              placeholder="Terisi otomatis dari OCR"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
            />
          </div>
          {f.singkatan_sertifikat && (
            <div className="shrink-0">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Kode</label>
              <div className="inline-flex h-[42px] items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-black text-emerald-400">
                {f.singkatan_sertifikat}
              </div>
            </div>
          )}
          <div className="w-28 shrink-0">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Luas</label>
            <div className="relative">
              <input
                value={f.luas}
                onChange={e => set("luas", e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 pr-8 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">m²</span>
            </div>
          </div>
        </div>
        <EF label="Nomor Sertifikat" value={f.no_sertifikat} onChange={v => set("no_sertifikat", v)} placeholder="cth: 00169/tambakrejo" />
      </div>

      {/* ── Lokasi Aset ── */}
      <div className="border-b border-slate-800/60 px-5 py-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lokasi Aset</p>
        <textarea
          rows={2}
          value={f.lokasi_asset}
          onChange={e => set("lokasi_asset", e.target.value)}
          placeholder="Alamat lengkap objek eksekusi"
          className="w-full resize-none rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
        />
        <div className="grid grid-cols-3 gap-2">
          <EF label="Kelurahan / Desa" value={f.kelurahan_asset} onChange={v => set("kelurahan_asset", v)} />
          <EF label="Kecamatan" value={f.kecamatan_asset} onChange={v => set("kecamatan_asset", v)} />
          <EF label="Kota / Kab." value={f.kota_asset} onChange={v => set("kota_asset", v)} />
        </div>
      </div>

      {/* ── Kuitansi & Risalah Lelang ── */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Kuitansi & Risalah Lelang</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <EF label="Nomor Kuitansi" value={f.nomor_kwitansi} onChange={v => set("nomor_kwitansi", v)} />
          <EF label="Tanggal Kuitansi" value={f.tanggal_kwitansi} onChange={v => set("tanggal_kwitansi", v)} placeholder="cth: 22 Desember 2025" />
          <EF label="Nomor Risalah Lelang" value={f.nomor_risalah_lelang} onChange={v => set("nomor_risalah_lelang", v)} />
          <EF label="Tanggal Risalah Lelang" value={f.tanggal_risalah} onChange={v => set("tanggal_risalah", v)} placeholder="cth: 18 Desember 2025" />
        </div>
        <EF label="Bank Pemohon Lelang" value={f.nama_bank} onChange={v => set("nama_bank", v)} placeholder="cth: PT. Bank Rakyat Indonesia (Persero), Tbk" />
      </div>
    </div>
  );
}

// ─── KTP Upload Zone ──────────────────────────────────────────────────────────

function KtpZone({ label, hint, filename, scanning, ocr, onFile }: {
  label: string; hint: string;
  filename: string; scanning: boolean; ocr: OcrMeta;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  const pick = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) { alert("Format: JPG, PNG, atau WEBP"); return; }
    if (file.size > 8 * 1024 * 1024) { alert("Maksimal 8 MB"); return; }
    onFile(file);
  };

  const done = Boolean(filename) && !scanning;
  const success = done && ocr.status === "valid";
  const warn = done && (ocr.status === "review" || ocr.status === "invalid");

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      onClick={() => !scanning && ref.current?.click()}
      className={[
        "relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 px-5 py-8 text-center transition-all duration-200",
        scanning
          ? "pointer-events-none border-emerald-500/30 bg-emerald-500/5"
          : drag
          ? "scale-[1.015] border-emerald-400 bg-emerald-500/10"
          : success
          ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60"
          : warn
          ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
          : filename
          ? "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          : "border-dashed border-slate-700 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900/70",
      ].join(" ")}
    >
      {scanning ? (
        <>
          <div className="relative text-emerald-500/20"><KtpSvg className="h-16 w-auto" /></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">Membaca KTP…</p>
          </div>
        </>
      ) : filename ? (
        <>
          <div className={[
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            success ? "bg-emerald-500/15 text-emerald-400" : warn ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400",
          ].join(" ")}>
            {success ? <CheckCircle2 className="h-6 w-6" /> : warn ? <AlertTriangle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
          </div>
          <div>
            <p className={["text-sm font-bold", success ? "text-emerald-400" : warn ? "text-amber-400" : "text-slate-200"].join(" ")}>
              {success ? "KTP Berhasil Diproses" : warn ? "Perlu Dicek Manual" : "File Terupload"}
            </p>
            <p className="mt-0.5 max-w-[160px] truncate text-xs text-slate-500">{filename}</p>
            {ocr.confidence > 0 && <p className="mt-1 text-[11px] text-slate-600">OCR {Math.round(ocr.confidence)}%</p>}
          </div>
          <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
            Klik untuk ganti foto
          </span>
        </>
      ) : (
        <>
          <div className="text-slate-800"><KtpSvg className="h-16 w-auto" /></div>
          <div>
            <p className="text-sm font-bold text-slate-200">{label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-400">
            <Upload className="h-3.5 w-3.5" />
            Pilih Foto KTP
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

function DocZone({ filename, scanning, ocr, onFile }: { filename: string; scanning: boolean; ocr: OcrMeta; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);

  const pick = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Format: PDF"); return; }
    if (file.size > 8 * 1024 * 1024) { alert("Maksimal 8 MB"); return; }
    onFile(file);
  };

  const done = Boolean(filename) && !scanning;
  const success = done && ocr.status === "valid";
  const warn = done && (ocr.status === "review" || ocr.status === "invalid");

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      onClick={() => !scanning && ref.current?.click()}
      className={[
        "flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-all duration-200",
        scanning
          ? "pointer-events-none border-emerald-500/30 bg-emerald-500/5"
          : drag
          ? "scale-[1.01] border-emerald-400 bg-emerald-500/10"
          : success
          ? "border-emerald-500/40 bg-emerald-500/5"
          : warn
          ? "border-amber-500/30 bg-amber-500/5"
          : filename
          ? "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          : "border-dashed border-slate-700 bg-slate-900/40 hover:border-emerald-500/40",
      ].join(" ")}
    >
      <div className={[
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        scanning ? "bg-emerald-500/10 text-emerald-400"
          : success ? "bg-emerald-500/15 text-emerald-400"
          : warn ? "bg-amber-500/15 text-amber-400"
          : "bg-slate-800 text-slate-500",
      ].join(" ")}>
        {scanning ? <Loader2 className="h-5 w-5 animate-spin" />
          : success ? <CheckCircle2 className="h-5 w-5" />
          : warn ? <AlertTriangle className="h-5 w-5" />
          : <Upload className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        {scanning
          ? <p className="text-sm font-semibold text-emerald-400">Membaca kwitansi PDF…</p>
          : filename
          ? <>
              <p className={["truncate text-sm font-semibold", success ? "text-emerald-400" : warn ? "text-amber-400" : "text-slate-200"].join(" ")}>{filename}</p>
              <p className="text-xs text-slate-500">Klik untuk ganti file PDF</p>
            </>
          : <>
              <p className="text-sm font-semibold text-slate-200">Upload Kwitansi KPKNL</p>
              <p className="text-xs text-slate-500">Drag & drop atau klik · PDF · maks 8 MB</p>
            </>
        }
      </div>
      {done && ocr.status !== "idle" && (
        <span className={[
          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          success ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/20 bg-amber-500/10 text-amber-400",
        ].join(" ")}>
          {success ? "✓ Valid" : "⚠ Cek manual"}
        </span>
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
      {[0,8,16,24,32,40,50,58,68,76,84,94,102,110,120,128,136,144,154,162,170].map((x,i) => (
        <rect key={i} x={20+x} y="106" width={i%3===0?6:4} height="6" rx="0.5" fill="currentColor" opacity="0.18" />
      ))}
    </svg>
  );
}

// ─── DataCard (shows after KTP upload) ───────────────────────────────────────

function DataCard({ label, ocr, show, children }: { label: string; ocr: OcrMeta; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <p className="text-sm font-bold text-white">{label}</p>
        {ocr.status !== "idle" && (
          <span className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            ocr.status === "valid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/10 text-amber-400",
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

// ─── Field Group ──────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-sm font-bold text-white">{label}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── KTP Field Grid ───────────────────────────────────────────────────────────

function KtpFieldGrid({ fields, onChange }: {
  fields: { label: string; value: string; key: string; required?: boolean; placeholder?: string }[];
  onChange: (key: string, val: string) => void;
}) {
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
        <FieldLabel label="Alamat" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowParts(p => !p)}
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300">
            {showParts ? "Sembunyikan rincian" : "Edit rincian"}
          </button>
          <button type="button" onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
            <RefreshCw className="h-2.5 w-2.5" />Susun ulang
          </button>
        </div>
      </div>
      {showParts && (
        <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-2">
          <EF label="Jalan / Alamat Utama" value={utama} onChange={onUtama} />
          <EF label="RT/RW" value={rtRw} onChange={onRtRw} placeholder="003/008" />
          <EF label="Kelurahan" value={kelurahan} onChange={onKelurahan} />
          <EF label="Kecamatan" value={kecamatan} onChange={onKecamatan} />
          <EF label="Jenis (Kota/Kab.)" value={jenisKota} onChange={onJenisKota} placeholder="Kota / Kabupaten" />
          <EF label="Nama Kota / Kab." value={kota} onChange={onKota} />
        </div>
      )}
      <textarea
        rows={2}
        value={alamat}
        onChange={e => onAlamat(e.target.value)}
        placeholder="Alamat lengkap sesuai KTP"
        className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
      />
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function SectionTitle({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-black text-emerald-500">{n}</span>
      <p className="text-[15px] font-bold text-white">{label}</p>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <p className="text-xs font-medium text-slate-500">{label}</p>;
}

function EF({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="ml-0.5 text-emerald-500">*</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
      />
    </div>
  );
}

function ETA({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20"
      />
    </div>
  );
}
