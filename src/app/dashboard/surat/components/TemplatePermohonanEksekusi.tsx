"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { kuasaOptions } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit?: (payload: {
    template: SuratTemplate;
    values: Record<string, string>;
  }) => void;
};

type ScanStatus = "idle" | "valid" | "review" | "invalid";

type OcrKtpParsed = {
  nama_pemohon?: string;
  nik_pemohon?: string;
  kotalahir_pemohon?: string;
  tanggallahir_pemohon?: string;
  kelamin_pemohon?: string;
  agama_pemohon?: string;
  alamat_pemohon?: string;
  alamat_utama_pemohon?: string;
  kelurahan_pemohon?: string;
  kecamatan_pemohon?: string;
  kota_pemohon?: string;
  jenis_kota_pemohon?: string;
  rt_rw_pemohon?: string;
  pekerjaan_pemohon?: string;
  statuskawin_pemohon?: string;
  warga_negara?: string;
};

type OcrKtpResult = {
  raw_text?: string;
  cleaned_text?: string;
  rawText?: string;
  cleanedText?: string;
  confidence?: number;
  parsed?: OcrKtpParsed;
  score?: number;
  status?: ScanStatus;
  warnings?: string[];
};

type OcrRisalahParsed = {
  nomor_risalah?: string;
  nomor_kwitansi?: string;
  nomor_risalah_lelang?: string;
  tanggal_risalah?: string;
  tanggal_kwitansi?: string;
  luas?: string;
  alamat_desa?: string;
  alamat_kecamatan?: string;
  alamat_kota?: string;
  alamat_provinsi?: string;
  no_sertifikat?: string;
  uraian?: string;
  nama_bank?: string;
};

type OcrRisalahResult = {
  raw_text?: string;
  cleaned_text?: string;
  rawText?: string;
  cleanedText?: string;
  confidence?: number;
  parsed?: OcrRisalahParsed;
  score?: number;
  status?: ScanStatus;
  warnings?: string[];
};

type FormValues = {
  // Upload files
  ktpDebitur: string;
  kwitansiFile: string;
  ktpPemohon: string;
  ktpKuasa: string;

  // Mode
  bertindakSebagai: "sendiri" | "kuasa";
  selectedKuasaId: string;

  // Debitur
  nama_debitur: string;
  nik_debitur: string;
  kotalahir_debitur: string;
  tanggallahir_debitur: string;
  kelamin_debitur: string;
  pekerjaan_debitur: string;
  statuskawin_debitur: string;
  alamat_utama_debitur: string;
  rt_rw_debitur: string;
  kelurahan_debitur: string;
  kecamatan_debitur: string;
  kota_debitur: string;
  jenis_kota_debitur: string;
  alamat_debitur: string;

  // Pemohon
  nama_pemohon: string;
  nik_pemohon: string;
  kotalahir_pemohon: string;
  tanggallahir_pemohon: string;
  kelamin_pemohon: string;
  agama_pemohon: string;
  pekerjaan_pemohon: string;
  statuskawin_pemohon: string;
  warga_negara: string;
  alamat_utama_pemohon: string;
  rt_rw_pemohon: string;
  kelurahan_pemohon: string;
  kecamatan_pemohon: string;
  kota_pemohon: string;
  jenis_kota_pemohon: string;
  alamat_pemohon: string;

  // Kuasa
  nama_kuasa: string;
  nik_kuasa: string;
  kotalahir_kuasa: string;
  tanggallahir_kuasa: string;
  kelamin_kuasa: string;
  agama_kuasa: string;
  pekerjaan_kuasa: string;
  statuskawin_kuasa: string;
  alamat_kuasa: string;

  // Kwitansi / Risalah
  nomor_kwitansi: string;
  tanggal_kwitansi: string;
  nomor_risalah: string;
  tanggal_risalah: string;
  nomor_risalah_lelang: string;
  uraian_risalah: string;
  nama_bank: string;
  luas: string;
  alamat_desa: string;
  alamat_kecamatan: string;
  alamat_kota: string;
  alamat_provinsi: string;
  no_sertifikat: string;

  // Data Surat
  nomor_aktegrosse: string;
  nomor_nib: string;
  lokasi_asset: string;
  nomor_kutipan: string;
};

const EMPTY: FormValues = {
  ktpDebitur: "",
  kwitansiFile: "",
  ktpPemohon: "",
  ktpKuasa: "",
  bertindakSebagai: "sendiri",
  selectedKuasaId: "",
  nama_debitur: "",
  nik_debitur: "",
  kotalahir_debitur: "",
  tanggallahir_debitur: "",
  kelamin_debitur: "",
  pekerjaan_debitur: "",
  statuskawin_debitur: "",
  alamat_utama_debitur: "",
  rt_rw_debitur: "",
  kelurahan_debitur: "",
  kecamatan_debitur: "",
  kota_debitur: "",
  jenis_kota_debitur: "",
  alamat_debitur: "",
  nama_pemohon: "",
  nik_pemohon: "",
  kotalahir_pemohon: "",
  tanggallahir_pemohon: "",
  kelamin_pemohon: "",
  agama_pemohon: "",
  pekerjaan_pemohon: "",
  statuskawin_pemohon: "",
  warga_negara: "Indonesia",
  alamat_utama_pemohon: "",
  rt_rw_pemohon: "",
  kelurahan_pemohon: "",
  kecamatan_pemohon: "",
  kota_pemohon: "",
  jenis_kota_pemohon: "",
  alamat_pemohon: "",
  nama_kuasa: "",
  nik_kuasa: "",
  kotalahir_kuasa: "",
  tanggallahir_kuasa: "",
  kelamin_kuasa: "",
  agama_kuasa: "",
  pekerjaan_kuasa: "",
  statuskawin_kuasa: "",
  alamat_kuasa: "",
  nomor_kwitansi: "",
  tanggal_kwitansi: "",
  nomor_risalah: "",
  tanggal_risalah: "",
  nomor_risalah_lelang: "",
  uraian_risalah: "",
  nama_bank: "",
  luas: "",
  alamat_desa: "",
  alamat_kecamatan: "",
  alamat_kota: "",
  alamat_provinsi: "",
  no_sertifikat: "",
  nomor_aktegrosse: "",
  nomor_nib: "",
  lokasi_asset: "",
  nomor_kutipan: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function composeAlamat({
  alamatUtama,
  rtRw,
  kelurahan,
  kecamatan,
  kota,
  jenisKota,
}: {
  alamatUtama?: string;
  rtRw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  jenisKota?: string;
}) {
  const parts: string[] = [];
  if (alamatUtama?.trim()) parts.push(alamatUtama.trim());
  if (rtRw?.trim()) parts.push(`RT/RW ${rtRw.trim()}`);
  if (kelurahan?.trim()) parts.push(`Kel. ${kelurahan.trim()}`);
  if (kecamatan?.trim()) parts.push(`Kec. ${kecamatan.trim()}`);
  if (kota?.trim()) {
    if (jenisKota === "Kota") parts.push(`Kota ${kota.trim()}`);
    else if (jenisKota === "Kabupaten") parts.push(`Kabupaten ${kota.trim()}`);
    else parts.push(kota.trim());
  }
  return parts.join(", ");
}

function getRawText(r: OcrKtpResult | OcrRisalahResult) {
  return r.cleaned_text || r.cleanedText || r.raw_text || r.rawText || "";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TemplatePermohonanEksekusi({ open, template, onClose, onSubmit }: Props) {
  const [v, setV] = useState<FormValues>(EMPTY);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  // OCR loading
  const [scanningKtpDebitur, setScanningKtpDebitur] = useState(false);
  const [scanningKwitansi, setScanningKwitansi] = useState(false);
  const [scanningKtpPemohon, setScanningKtpPemohon] = useState(false);
  const [scanningKtpKuasa, setScanningKtpKuasa] = useState(false);

  // OCR results meta
  const [ktpDebiturOcr, setKtpDebiturOcr] = useState<{ status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string }>({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
  const [kwitansiOcr, setKwitansiOcr] = useState<{ status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string }>({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
  const [ktpPemohonOcr, setKtpPemohonOcr] = useState<{ status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string }>({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
  const [ktpKuasaOcr, setKtpKuasaOcr] = useState<{ status: ScanStatus; score: number; confidence: number; warnings: string[]; rawText: string }>({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });

  const [errorMsg, setErrorMsg] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setV(EMPTY);
      setScanningKtpDebitur(false);
      setScanningKwitansi(false);
      setScanningKtpPemohon(false);
      setScanningKtpKuasa(false);
      setKtpDebiturOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
      setKwitansiOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
      setKtpPemohonOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
      setKtpKuasaOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
      setErrorMsg("");
    }
  }, [open]);

  // Fill kuasa from dropdown
  const handleSelectKuasa = (id: string) => {
    set("selectedKuasaId", id);
    const k = kuasaOptions.find((o) => o.id === id);
    if (!k) return;
    set("nama_kuasa", k.nama_kuasa);
    set("nik_kuasa", k.nik_kuasa);
    set("kotalahir_kuasa", k.kotalahir_kuasa);
    set("tanggallahir_kuasa", k.tanggallahir_kuasa);
    set("kelamin_kuasa", k.kelamin_kuasa);
    set("agama_kuasa", k.agama_kuasa);
    set("alamat_kuasa", k.alamat_kuasa);
    set("pekerjaan_kuasa", k.pekerjaan_kuasa);
    set("statuskawin_kuasa", k.statuskawin_kuasa);
  };

  // OCR Handlers
  const handleKtpDebitur = async (file: File) => {
    set("ktpDebitur", file.name);
    setErrorMsg("");
    setScanningKtpDebitur(true);
    setKtpDebiturOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
    try {
      const ocr = (await ocrKTP(file)) as OcrKtpResult;
      const p = ocr.parsed ?? {};
      const alamat = composeAlamat({
        alamatUtama: p.alamat_utama_pemohon,
        rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon,
        kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon,
        jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      setV((prev) => ({
        ...prev,
        nama_debitur: p.nama_pemohon || prev.nama_debitur,
        nik_debitur: p.nik_pemohon || prev.nik_debitur,
        kotalahir_debitur: p.kotalahir_pemohon || prev.kotalahir_debitur,
        tanggallahir_debitur: p.tanggallahir_pemohon || prev.tanggallahir_debitur,
        kelamin_debitur: p.kelamin_pemohon || prev.kelamin_debitur,
        pekerjaan_debitur: p.pekerjaan_pemohon || prev.pekerjaan_debitur,
        statuskawin_debitur: p.statuskawin_pemohon || prev.statuskawin_debitur,
        alamat_utama_debitur: p.alamat_utama_pemohon || prev.alamat_utama_debitur,
        rt_rw_debitur: p.rt_rw_pemohon || prev.rt_rw_debitur,
        kelurahan_debitur: p.kelurahan_pemohon || prev.kelurahan_debitur,
        kecamatan_debitur: p.kecamatan_pemohon || prev.kecamatan_debitur,
        kota_debitur: p.kota_pemohon || prev.kota_debitur,
        jenis_kota_debitur: p.jenis_kota_pemohon || prev.jenis_kota_debitur,
        alamat_debitur: alamat || prev.alamat_debitur,
      }));
      const bad = (ocr.confidence ?? 0) < 45 || !/^\d{16}$/.test(p.nik_pemohon ?? "");
      const st: ScanStatus = (ocr.status === "invalid" || bad) ? "review" : (ocr.status ?? "review");
      setKtpDebiturOcr({ status: st, score: ocr.score ?? 0, confidence: ocr.confidence ?? 0, warnings: ocr.warnings ?? [], rawText: getRawText(ocr) });
      if (st === "review") setErrorMsg("Hasil scan KTP debitur perlu dicek. Pastikan foto terang, lurus, dan seluruh KTP terlihat.");
    } catch {
      setKtpDebiturOcr({ status: "invalid", score: 0, confidence: 0, warnings: [], rawText: "" });
      setErrorMsg("Gagal membaca KTP debitur. Pastikan backend OCR aktif.");
    } finally {
      setScanningKtpDebitur(false);
    }
  };

  const handleKwitansi = async (file: File) => {
    set("kwitansiFile", file.name);
    setErrorMsg("");
    setScanningKwitansi(true);
    setKwitansiOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
    try {
      const ocr = (await ocrRisalah(file)) as OcrRisalahResult;
      const p = ocr.parsed ?? {};
      setV((prev) => ({
        ...prev,
        nomor_kwitansi: p.nomor_kwitansi || prev.nomor_kwitansi,
        tanggal_kwitansi: p.tanggal_kwitansi || prev.tanggal_kwitansi,
        nomor_risalah: p.nomor_risalah || prev.nomor_risalah,
        tanggal_risalah: p.tanggal_risalah || prev.tanggal_risalah,
        nomor_risalah_lelang: p.nomor_risalah_lelang || prev.nomor_risalah_lelang,
        uraian_risalah: p.uraian || prev.uraian_risalah,
        nama_bank: p.nama_bank || prev.nama_bank,
        luas: p.luas || prev.luas,
        alamat_desa: p.alamat_desa || prev.alamat_desa,
        alamat_kecamatan: p.alamat_kecamatan || prev.alamat_kecamatan,
        alamat_kota: p.alamat_kota || prev.alamat_kota,
        alamat_provinsi: p.alamat_provinsi || prev.alamat_provinsi,
        no_sertifikat: p.no_sertifikat || prev.no_sertifikat,
      }));
      const bad = (ocr.confidence ?? 0) < 45 || !p.nomor_risalah || !p.tanggal_risalah;
      const st: ScanStatus = (ocr.status === "invalid" || bad) ? "review" : (ocr.status ?? "review");
      setKwitansiOcr({ status: st, score: ocr.score ?? 0, confidence: ocr.confidence ?? 0, warnings: ocr.warnings ?? [], rawText: getRawText(ocr) });
      if (st === "review") setErrorMsg("Hasil scan kwitansi perlu dicek. Pastikan file PDF terbaca dengan baik.");
    } catch {
      setKwitansiOcr({ status: "invalid", score: 0, confidence: 0, warnings: [], rawText: "" });
      setErrorMsg("Gagal membaca kwitansi KPKNL. Pastikan backend OCR aktif.");
    } finally {
      setScanningKwitansi(false);
    }
  };

  const handleKtpPemohon = async (file: File) => {
    set("ktpPemohon", file.name);
    setErrorMsg("");
    setScanningKtpPemohon(true);
    setKtpPemohonOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
    try {
      const ocr = (await ocrKTP(file)) as OcrKtpResult;
      const p = ocr.parsed ?? {};
      const alamat = composeAlamat({
        alamatUtama: p.alamat_utama_pemohon,
        rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon,
        kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon,
        jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      setV((prev) => ({
        ...prev,
        nama_pemohon: p.nama_pemohon || prev.nama_pemohon,
        nik_pemohon: p.nik_pemohon || prev.nik_pemohon,
        kotalahir_pemohon: p.kotalahir_pemohon || prev.kotalahir_pemohon,
        tanggallahir_pemohon: p.tanggallahir_pemohon || prev.tanggallahir_pemohon,
        kelamin_pemohon: p.kelamin_pemohon || prev.kelamin_pemohon,
        agama_pemohon: p.agama_pemohon || prev.agama_pemohon,
        pekerjaan_pemohon: p.pekerjaan_pemohon || prev.pekerjaan_pemohon,
        statuskawin_pemohon: p.statuskawin_pemohon || prev.statuskawin_pemohon,
        warga_negara: p.warga_negara || prev.warga_negara || "Indonesia",
        alamat_utama_pemohon: p.alamat_utama_pemohon || prev.alamat_utama_pemohon,
        rt_rw_pemohon: p.rt_rw_pemohon || prev.rt_rw_pemohon,
        kelurahan_pemohon: p.kelurahan_pemohon || prev.kelurahan_pemohon,
        kecamatan_pemohon: p.kecamatan_pemohon || prev.kecamatan_pemohon,
        kota_pemohon: p.kota_pemohon || prev.kota_pemohon,
        jenis_kota_pemohon: p.jenis_kota_pemohon || prev.jenis_kota_pemohon,
        alamat_pemohon: alamat || prev.alamat_pemohon,
      }));
      const bad = (ocr.confidence ?? 0) < 45 || !/^\d{16}$/.test(p.nik_pemohon ?? "");
      const st: ScanStatus = (ocr.status === "invalid" || bad) ? "review" : (ocr.status ?? "review");
      setKtpPemohonOcr({ status: st, score: ocr.score ?? 0, confidence: ocr.confidence ?? 0, warnings: ocr.warnings ?? [], rawText: getRawText(ocr) });
      if (st === "review") setErrorMsg("Hasil scan KTP pemohon perlu dicek. Pastikan foto terang, lurus, dan seluruh KTP terlihat.");
    } catch {
      setKtpPemohonOcr({ status: "invalid", score: 0, confidence: 0, warnings: [], rawText: "" });
      setErrorMsg("Gagal membaca KTP pemohon. Pastikan backend OCR aktif.");
    } finally {
      setScanningKtpPemohon(false);
    }
  };

  const handleKtpKuasa = async (file: File) => {
    set("ktpKuasa", file.name);
    setErrorMsg("");
    setScanningKtpKuasa(true);
    setKtpKuasaOcr({ status: "idle", score: 0, confidence: 0, warnings: [], rawText: "" });
    try {
      const ocr = (await ocrKTP(file)) as OcrKtpResult;
      const p = ocr.parsed ?? {};
      const alamat = composeAlamat({
        alamatUtama: p.alamat_utama_pemohon,
        rtRw: p.rt_rw_pemohon,
        kelurahan: p.kelurahan_pemohon,
        kecamatan: p.kecamatan_pemohon,
        kota: p.kota_pemohon,
        jenisKota: p.jenis_kota_pemohon,
      }) || p.alamat_pemohon || "";
      setV((prev) => ({
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
      }));
      const bad = (ocr.confidence ?? 0) < 45 || !/^\d{16}$/.test(p.nik_pemohon ?? "");
      const st: ScanStatus = (ocr.status === "invalid" || bad) ? "review" : (ocr.status ?? "review");
      setKtpKuasaOcr({ status: st, score: ocr.score ?? 0, confidence: ocr.confidence ?? 0, warnings: ocr.warnings ?? [], rawText: getRawText(ocr) });
      if (st === "review") setErrorMsg("Hasil scan KTP kuasa perlu dicek. Pastikan foto terang, lurus, dan seluruh KTP terlihat.");
    } catch {
      setKtpKuasaOcr({ status: "invalid", score: 0, confidence: 0, warnings: [], rawText: "" });
      setErrorMsg("Gagal membaca KTP kuasa. Pastikan backend OCR aktif.");
    } finally {
      setScanningKtpKuasa(false);
    }
  };

  const refreshDebiturAlamat = () =>
    set("alamat_debitur", composeAlamat({
      alamatUtama: v.alamat_utama_debitur,
      rtRw: v.rt_rw_debitur,
      kelurahan: v.kelurahan_debitur,
      kecamatan: v.kecamatan_debitur,
      kota: v.kota_debitur,
      jenisKota: v.jenis_kota_debitur,
    }));

  const refreshPemohonAlamat = () =>
    set("alamat_pemohon", composeAlamat({
      alamatUtama: v.alamat_utama_pemohon,
      rtRw: v.rt_rw_pemohon,
      kelurahan: v.kelurahan_pemohon,
      kecamatan: v.kecamatan_pemohon,
      kota: v.kota_pemohon,
      jenisKota: v.jenis_kota_pemohon,
    }));

  // Template file based on mode
  const activeTemplateFile = useMemo(
    () =>
      v.bertindakSebagai === "kuasa"
        ? "Template_permohonan_PN_DenganKuasa.docx"
        : "Template_permohonan_PN_LangsungPemohon.docx",
    [v.bertindakSebagai]
  );

  // Submit validation
  const canSubmit = useMemo(() => {
    const debiturOk =
      v.nama_debitur.trim() &&
      v.nik_debitur.trim() &&
      v.alamat_debitur.trim();
    const coreOk =
      v.nomor_kwitansi.trim() &&
      v.nomor_aktegrosse.trim() &&
      v.nomor_nib.trim() &&
      v.lokasi_asset.trim();
    const actorOk =
      v.bertindakSebagai === "sendiri"
        ? v.ktpPemohon && v.nama_pemohon.trim() && v.nik_pemohon.trim()
        : (v.ktpPemohon || v.selectedKuasaId) &&
          v.nama_pemohon.trim() &&
          v.nama_kuasa.trim();
    return Boolean(debiturOk && coreOk && actorOk);
  }, [v]);

  const anyScan = scanningKtpDebitur || scanningKwitansi || scanningKtpPemohon || scanningKtpKuasa;

  const handleSubmit = () => {
    if (!template) return;
    const payload: Record<string, string> = {
      ...v,
      templateFileName: activeTemplateFile,
    };
    onSubmit?.({ template, values: payload });
  };

  if (!open || !template) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/75 p-0 sm:p-4 backdrop-blur-md">
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-slate-800 bg-slate-950 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(139,92,246,0.08)] max-h-[96dvh] sm:max-h-[92vh]">

        {/* Violet accent top bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-violet-500/20 bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-400">
                  LIT-001
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] text-slate-500">
                  {activeTemplateFile}
                </span>
              </div>
              <h2 className="mt-1.5 text-[15px] font-semibold leading-tight text-white">
                Permohonan Eksekusi ke Pengadilan Negeri
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Upload dokumen · isi data · generate surat dalam sekali alur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6 space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-200">{errorMsg}</p>
              <button onClick={() => setErrorMsg("")} className="ml-auto shrink-0 text-amber-500 hover:text-amber-300">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Section 1: Debitur / Termohon ─────────────────────────────── */}
          <SectionCard
            number="01"
            title="Termohon / Debitur"
            subtitle="Upload KTP untuk auto-isi data debitur"
            done={Boolean(v.nama_debitur && v.nik_debitur && v.alamat_debitur)}
          >
            <UploadZone
              label="KTP Debitur"
              helperText="Foto KTP · JPG, PNG, WEBP · maks. 8 MB"
              filename={v.ktpDebitur}
              loading={scanningKtpDebitur}
              onFile={handleKtpDebitur}
              ocrStatus={v.ktpDebitur ? ktpDebiturOcr.status : undefined}
            />

            {v.ktpDebitur && !scanningKtpDebitur && (
              <div className="mt-4 space-y-4">
                <OcrMeta ocr={ktpDebiturOcr} />
                {ktpDebiturOcr.warnings.length > 0 && (
                  <WarningList warnings={ktpDebiturOcr.warnings} />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <EF label="Nama Debitur" value={v.nama_debitur} onChange={(val) => set("nama_debitur", val)} required />
                  <EF label="NIK Debitur" value={v.nik_debitur} onChange={(val) => set("nik_debitur", val)} required />
                  <EF label="Kota Lahir" value={v.kotalahir_debitur} onChange={(val) => set("kotalahir_debitur", val)} />
                  <EF label="Tanggal Lahir" value={v.tanggallahir_debitur} onChange={(val) => set("tanggallahir_debitur", val)} />
                  <EF label="Jenis Kelamin" value={v.kelamin_debitur} onChange={(val) => set("kelamin_debitur", val)} />
                  <EF label="Pekerjaan" value={v.pekerjaan_debitur} onChange={(val) => set("pekerjaan_debitur", val)} />
                  <EF label="Status Kawin" value={v.statuskawin_debitur} onChange={(val) => set("statuskawin_debitur", val)} />
                  <EF label="Alamat Utama" value={v.alamat_utama_debitur} onChange={(val) => set("alamat_utama_debitur", val)} />
                  <EF label="RT/RW" value={v.rt_rw_debitur} onChange={(val) => set("rt_rw_debitur", val)} />
                  <EF label="Kelurahan" value={v.kelurahan_debitur} onChange={(val) => set("kelurahan_debitur", val)} />
                  <EF label="Kecamatan" value={v.kecamatan_debitur} onChange={(val) => set("kecamatan_debitur", val)} />
                  <EF label="Jenis Kota" value={v.jenis_kota_debitur} onChange={(val) => set("jenis_kota_debitur", val)} placeholder="Kota / Kabupaten" />
                  <EF label="Kota / Kab." value={v.kota_debitur} onChange={(val) => set("kota_debitur", val)} />
                  <div className="sm:col-span-2 flex justify-end">
                    <RefreshBtn label="Susun ulang alamat" onClick={refreshDebiturAlamat} />
                  </div>
                  <div className="sm:col-span-2">
                    <ETA label="Alamat Debitur" value={v.alamat_debitur} onChange={(val) => set("alamat_debitur", val)} required rows={3} />
                  </div>
                </div>
                <RawTextAccordion rawText={ktpDebiturOcr.rawText} />
              </div>
            )}

            {!v.ktpDebitur && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <EF label="Nama Debitur" value={v.nama_debitur} onChange={(val) => set("nama_debitur", val)} required placeholder="Isi manual jika tidak upload KTP" />
                <EF label="NIK Debitur" value={v.nik_debitur} onChange={(val) => set("nik_debitur", val)} required />
                <div className="sm:col-span-2">
                  <ETA label="Alamat Debitur" value={v.alamat_debitur} onChange={(val) => set("alamat_debitur", val)} required rows={2} />
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Section 2: Kwitansi KPKNL ─────────────────────────────────── */}
          <SectionCard
            number="02"
            title="Kwitansi & Data Lelang"
            subtitle="Upload kwitansi KPKNL untuk auto-isi data lelang"
            done={Boolean(v.nomor_kwitansi && v.tanggal_kwitansi)}
          >
            <UploadZone
              label="Kwitansi KPKNL"
              helperText="File PDF · maks. 8 MB"
              filename={v.kwitansiFile}
              loading={scanningKwitansi}
              onFile={handleKwitansi}
              acceptPdf
              ocrStatus={v.kwitansiFile ? kwitansiOcr.status : undefined}
            />

            {v.kwitansiFile && !scanningKwitansi && (
              <div className="mt-4 space-y-4">
                <OcrMeta ocr={kwitansiOcr} />
                {kwitansiOcr.warnings.length > 0 && (
                  <WarningList warnings={kwitansiOcr.warnings} />
                )}
                <RawTextAccordion rawText={kwitansiOcr.rawText} />
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <EF label="Nomor Kwitansi" value={v.nomor_kwitansi} onChange={(val) => set("nomor_kwitansi", val)} required />
              <EF label="Tanggal Kwitansi" value={v.tanggal_kwitansi} onChange={(val) => set("tanggal_kwitansi", val)} required placeholder="Contoh: 17 November 2025" />
              <EF label="Nomor Risalah" value={v.nomor_risalah} onChange={(val) => set("nomor_risalah", val)} />
              <EF label="Tanggal Risalah" value={v.tanggal_risalah} onChange={(val) => set("tanggal_risalah", val)} placeholder="Contoh: 17 November 2025" />
              <EF label="Nama Bank" value={v.nama_bank} onChange={(val) => set("nama_bank", val)} placeholder="Contoh: PT. Bank Rakyat Indonesia" />
              <EF label="Luas Tanah (m²)" value={v.luas} onChange={(val) => set("luas", val)} />
              <EF label="No. Sertifikat" value={v.no_sertifikat} onChange={(val) => set("no_sertifikat", val)} />
              <EF label="Nomor Risalah Lelang" value={v.nomor_risalah_lelang} onChange={(val) => set("nomor_risalah_lelang", val)} />
              <EF label="Desa / Kel. Aset" value={v.alamat_desa} onChange={(val) => set("alamat_desa", val)} />
              <EF label="Kecamatan Aset" value={v.alamat_kecamatan} onChange={(val) => set("alamat_kecamatan", val)} />
              <EF label="Kota Aset" value={v.alamat_kota} onChange={(val) => set("alamat_kota", val)} />
              <EF label="Provinsi Aset" value={v.alamat_provinsi} onChange={(val) => set("alamat_provinsi", val)} />
              <div className="sm:col-span-2">
                <ETA label="Uraian Risalah" value={v.uraian_risalah} onChange={(val) => set("uraian_risalah", val)} rows={4} />
              </div>
            </div>
          </SectionCard>

          {/* ── Section 3: Pemohon ────────────────────────────────────────── */}
          <SectionCard
            number="03"
            title="Pemohon"
            subtitle="Tentukan apakah pemohon bertindak langsung atau melalui kuasa"
            done={
              v.bertindakSebagai === "sendiri"
                ? Boolean(v.nama_pemohon && v.nik_pemohon)
                : Boolean(v.nama_pemohon && v.nama_kuasa)
            }
          >
            {/* Toggle */}
            <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-1.5">
              <ToggleBtn
                active={v.bertindakSebagai === "sendiri"}
                onClick={() => set("bertindakSebagai", "sendiri")}
                icon={<User className="h-3.5 w-3.5" />}
                label="Langsung Pemohon"
                sub="1 KTP"
              />
              <ToggleBtn
                active={v.bertindakSebagai === "kuasa"}
                onClick={() => set("bertindakSebagai", "kuasa")}
                icon={<Users className="h-3.5 w-3.5" />}
                label="Dengan Kuasa"
                sub="2 KTP"
              />
            </div>

            {/* Langsung Pemohon */}
            {v.bertindakSebagai === "sendiri" && (
              <div className="mt-4 space-y-4">
                <UploadZone
                  label="KTP Pemohon"
                  helperText="Foto KTP pemohon · JPG, PNG, WEBP · maks. 8 MB"
                  filename={v.ktpPemohon}
                  loading={scanningKtpPemohon}
                  onFile={handleKtpPemohon}
                  ocrStatus={v.ktpPemohon ? ktpPemohonOcr.status : undefined}
                />
                {v.ktpPemohon && !scanningKtpPemohon && (
                  <div className="space-y-4">
                    <OcrMeta ocr={ktpPemohonOcr} />
                    {ktpPemohonOcr.warnings.length > 0 && <WarningList warnings={ktpPemohonOcr.warnings} />}
                    <RawTextAccordion rawText={ktpPemohonOcr.rawText} />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <EF label="Nama Pemohon" value={v.nama_pemohon} onChange={(val) => set("nama_pemohon", val)} required />
                  <EF label="NIK Pemohon" value={v.nik_pemohon} onChange={(val) => set("nik_pemohon", val)} required />
                  <EF label="Kota Lahir" value={v.kotalahir_pemohon} onChange={(val) => set("kotalahir_pemohon", val)} />
                  <EF label="Tanggal Lahir" value={v.tanggallahir_pemohon} onChange={(val) => set("tanggallahir_pemohon", val)} />
                  <EF label="Jenis Kelamin" value={v.kelamin_pemohon} onChange={(val) => set("kelamin_pemohon", val)} />
                  <EF label="Agama" value={v.agama_pemohon} onChange={(val) => set("agama_pemohon", val)} />
                  <EF label="Warga Negara" value={v.warga_negara} onChange={(val) => set("warga_negara", val)} />
                  <EF label="Pekerjaan" value={v.pekerjaan_pemohon} onChange={(val) => set("pekerjaan_pemohon", val)} />
                  <EF label="Status Kawin" value={v.statuskawin_pemohon} onChange={(val) => set("statuskawin_pemohon", val)} />
                  <EF label="Alamat Utama" value={v.alamat_utama_pemohon} onChange={(val) => set("alamat_utama_pemohon", val)} />
                  <EF label="RT/RW" value={v.rt_rw_pemohon} onChange={(val) => set("rt_rw_pemohon", val)} />
                  <EF label="Kelurahan" value={v.kelurahan_pemohon} onChange={(val) => set("kelurahan_pemohon", val)} />
                  <EF label="Kecamatan" value={v.kecamatan_pemohon} onChange={(val) => set("kecamatan_pemohon", val)} />
                  <EF label="Jenis Kota" value={v.jenis_kota_pemohon} onChange={(val) => set("jenis_kota_pemohon", val)} placeholder="Kota / Kabupaten" />
                  <EF label="Kota / Kab." value={v.kota_pemohon} onChange={(val) => set("kota_pemohon", val)} />
                  <div className="sm:col-span-2 flex justify-end">
                    <RefreshBtn label="Susun ulang alamat" onClick={refreshPemohonAlamat} />
                  </div>
                  <div className="sm:col-span-2">
                    <ETA label="Alamat Pemohon" value={v.alamat_pemohon} onChange={(val) => set("alamat_pemohon", val)} rows={3} />
                  </div>
                </div>
              </div>
            )}

            {/* Dengan Kuasa */}
            {v.bertindakSebagai === "kuasa" && (
              <div className="mt-4 space-y-5">
                {/* KTP Pemohon (pemberi kuasa) */}
                <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">KTP Pemohon · Pemberi Kuasa</p>
                  <UploadZone
                    label="KTP Pemohon"
                    helperText="Foto KTP pemohon yang memberi kuasa"
                    filename={v.ktpPemohon}
                    loading={scanningKtpPemohon}
                    onFile={handleKtpPemohon}
                    ocrStatus={v.ktpPemohon ? ktpPemohonOcr.status : undefined}
                    compact
                  />
                  {v.ktpPemohon && !scanningKtpPemohon && (
                    <div className="space-y-3">
                      <OcrMeta ocr={ktpPemohonOcr} />
                      {ktpPemohonOcr.warnings.length > 0 && <WarningList warnings={ktpPemohonOcr.warnings} />}
                      <RawTextAccordion rawText={ktpPemohonOcr.rawText} />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EF label="Nama Pemohon" value={v.nama_pemohon} onChange={(val) => set("nama_pemohon", val)} required />
                    <EF label="NIK Pemohon" value={v.nik_pemohon} onChange={(val) => set("nik_pemohon", val)} required />
                    <EF label="Kota Lahir" value={v.kotalahir_pemohon} onChange={(val) => set("kotalahir_pemohon", val)} />
                    <EF label="Tanggal Lahir" value={v.tanggallahir_pemohon} onChange={(val) => set("tanggallahir_pemohon", val)} />
                    <EF label="Jenis Kelamin" value={v.kelamin_pemohon} onChange={(val) => set("kelamin_pemohon", val)} />
                    <EF label="Agama" value={v.agama_pemohon} onChange={(val) => set("agama_pemohon", val)} />
                    <EF label="Warga Negara" value={v.warga_negara} onChange={(val) => set("warga_negara", val)} />
                    <EF label="Pekerjaan" value={v.pekerjaan_pemohon} onChange={(val) => set("pekerjaan_pemohon", val)} />
                    <EF label="Status Kawin" value={v.statuskawin_pemohon} onChange={(val) => set("statuskawin_pemohon", val)} />
                    <EF label="Alamat Utama" value={v.alamat_utama_pemohon} onChange={(val) => set("alamat_utama_pemohon", val)} />
                    <EF label="RT/RW" value={v.rt_rw_pemohon} onChange={(val) => set("rt_rw_pemohon", val)} />
                    <EF label="Kelurahan" value={v.kelurahan_pemohon} onChange={(val) => set("kelurahan_pemohon", val)} />
                    <EF label="Kecamatan" value={v.kecamatan_pemohon} onChange={(val) => set("kecamatan_pemohon", val)} />
                    <EF label="Jenis Kota" value={v.jenis_kota_pemohon} onChange={(val) => set("jenis_kota_pemohon", val)} placeholder="Kota / Kabupaten" />
                    <EF label="Kota / Kab." value={v.kota_pemohon} onChange={(val) => set("kota_pemohon", val)} />
                    <div className="sm:col-span-2 flex justify-end">
                      <RefreshBtn label="Susun ulang alamat" onClick={refreshPemohonAlamat} />
                    </div>
                    <div className="sm:col-span-2">
                      <ETA label="Alamat Pemohon" value={v.alamat_pemohon} onChange={(val) => set("alamat_pemohon", val)} rows={2} />
                    </div>
                  </div>
                </div>

                {/* KTP Kuasa Pemohon */}
                <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">KTP Kuasa Pemohon · Penerima Kuasa</p>

                  {/* Quick fill from pre-defined list */}
                  <div>
                    <label className="text-[11px] text-slate-500">Isi cepat dari daftar kuasa</label>
                    <select
                      value={v.selectedKuasaId}
                      onChange={(e) => handleSelectKuasa(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20"
                    >
                      <option value="">— Pilih dari daftar —</option>
                      {kuasaOptions.map((k) => (
                        <option key={k.id} value={k.id}>{k.label} · {k.nama_kuasa}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-800" />
                    <span className="text-[11px] text-slate-600">atau scan KTP kuasa</span>
                    <div className="h-px flex-1 bg-slate-800" />
                  </div>

                  <UploadZone
                    label="KTP Kuasa Pemohon"
                    helperText="Foto KTP advokat / kuasa yang menerima kuasa"
                    filename={v.ktpKuasa}
                    loading={scanningKtpKuasa}
                    onFile={handleKtpKuasa}
                    ocrStatus={v.ktpKuasa ? ktpKuasaOcr.status : undefined}
                    compact
                  />
                  {v.ktpKuasa && !scanningKtpKuasa && (
                    <div className="space-y-3">
                      <OcrMeta ocr={ktpKuasaOcr} />
                      {ktpKuasaOcr.warnings.length > 0 && <WarningList warnings={ktpKuasaOcr.warnings} />}
                      <RawTextAccordion rawText={ktpKuasaOcr.rawText} />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EF label="Nama Kuasa" value={v.nama_kuasa} onChange={(val) => set("nama_kuasa", val)} required />
                    <EF label="NIK Kuasa" value={v.nik_kuasa} onChange={(val) => set("nik_kuasa", val)} required />
                    <EF label="Kota Lahir" value={v.kotalahir_kuasa} onChange={(val) => set("kotalahir_kuasa", val)} />
                    <EF label="Tanggal Lahir" value={v.tanggallahir_kuasa} onChange={(val) => set("tanggallahir_kuasa", val)} />
                    <EF label="Jenis Kelamin" value={v.kelamin_kuasa} onChange={(val) => set("kelamin_kuasa", val)} />
                    <EF label="Agama" value={v.agama_kuasa} onChange={(val) => set("agama_kuasa", val)} />
                    <EF label="Pekerjaan" value={v.pekerjaan_kuasa} onChange={(val) => set("pekerjaan_kuasa", val)} />
                    <EF label="Status Kawin" value={v.statuskawin_kuasa} onChange={(val) => set("statuskawin_kuasa", val)} />
                    <div className="sm:col-span-2">
                      <ETA label="Alamat Kuasa" value={v.alamat_kuasa} onChange={(val) => set("alamat_kuasa", val)} rows={2} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Section 4: Data Surat ─────────────────────────────────────── */}
          <SectionCard
            number="04"
            title="Data Surat"
            subtitle="Input nomor akte grosse, NIB, dan lokasi aset"
            done={Boolean(v.nomor_aktegrosse && v.nomor_nib && v.lokasi_asset)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <EF label="Nomor Akte Grosse" value={v.nomor_aktegrosse} onChange={(val) => set("nomor_aktegrosse", val)} required />
              <EF label="Nomor NIB" value={v.nomor_nib} onChange={(val) => set("nomor_nib", val)} required />
              <EF label="Nomor Kutipan" value={v.nomor_kutipan} onChange={(val) => set("nomor_kutipan", val)} />
              <div className="sm:col-span-2">
                <ETA label="Lokasi Aset" value={v.lokasi_asset} onChange={(val) => set("lokasi_asset", val)} required rows={3} placeholder="Alamat lengkap objek eksekusi" />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/90 px-5 py-4 sm:px-6 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[11px] text-slate-600">
                Template:{" "}
                <span className="text-slate-500">{activeTemplateFile}</span>
              </p>
              {!canSubmit && (
                <p className="mt-0.5 text-[11px] text-amber-600">
                  Lengkapi data wajib sebelum generate
                </p>
              )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-800 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200 sm:flex-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || anyScan}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.5)] transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                {anyScan ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Generate Surat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  number,
  title,
  subtitle,
  done,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-800/80 bg-slate-900/50">
      <div className="flex items-start gap-3.5 border-b border-slate-800/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border text-[11px] font-black transition-colors",
            done
              ? "border-violet-500/30 bg-violet-500/15 text-violet-400"
              : "border-slate-700 bg-slate-800/80 text-slate-500",
          ].join(" ")}
        >
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </div>
  );
}

function UploadZone({
  label,
  helperText,
  filename,
  loading,
  onFile,
  acceptPdf = false,
  ocrStatus,
  compact = false,
}: {
  label: string;
  helperText: string;
  filename?: string;
  loading?: boolean;
  onFile: (file: File) => void | Promise<void>;
  acceptPdf?: boolean;
  ocrStatus?: ScanStatus;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const allowed = acceptPdf
      ? ["application/pdf"]
      : ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert(acceptPdf ? "Format file harus PDF." : "Format file harus JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Ukuran file maksimal 8 MB.");
      return;
    }
    await onFile(file);
  };

  const statusBorderClass =
    !filename ? ""
    : ocrStatus === "valid" ? "border-emerald-500/40 bg-emerald-500/5"
    : ocrStatus === "review" ? "border-amber-500/40 bg-amber-500/5"
    : ocrStatus === "invalid" ? "border-rose-500/40 bg-rose-500/5"
    : "";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]); }}
      onClick={() => !loading && inputRef.current?.click()}
      className={[
        "group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed transition-all duration-200",
        compact ? "py-3 px-4" : "py-5 px-5",
        loading ? "pointer-events-none border-violet-500/30 bg-violet-500/5"
        : dragging ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
        : filename && statusBorderClass ? `${statusBorderClass} hover:brightness-110`
        : "border-slate-700 bg-slate-900/40 hover:border-violet-500/50 hover:bg-slate-900/60",
      ].join(" ")}
    >
      {/* Subtle animated gradient on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      </div>

      <div className={["flex items-center gap-3.5", compact ? "" : "flex-col sm:flex-row"].join(" ")}>
        <div className={[
          "flex shrink-0 items-center justify-center rounded-xl border transition-colors",
          compact ? "h-9 w-9" : "h-11 w-11",
          loading ? "border-violet-500/30 bg-violet-500/10" : "border-slate-700 bg-slate-800/80 group-hover:border-violet-500/30 group-hover:bg-violet-500/5",
        ].join(" ")}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          ) : filename ? (
            <ImageIcon className={["text-slate-400", compact ? "h-3.5 w-3.5" : "h-5 w-5"].join(" ")} />
          ) : (
            <Upload className={["text-slate-500 transition group-hover:text-violet-400", compact ? "h-3.5 w-3.5" : "h-5 w-5"].join(" ")} />
          )}
        </div>

        <div className={["min-w-0 flex-1", compact ? "" : "text-center sm:text-left"].join(" ")}>
          {loading ? (
            <p className="text-sm font-medium text-violet-300">Memproses dokumen...</p>
          ) : filename ? (
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-slate-200">{filename}</span>
                {ocrStatus === "valid" && <ScanPill status="valid" />}
                {ocrStatus === "review" && <ScanPill status="review" />}
                {ocrStatus === "invalid" && <ScanPill status="invalid" />}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Klik untuk ganti file</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-slate-300">{label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{helperText}</p>
            </div>
          )}
        </div>

        {!loading && !filename && (
          <span className={[
            "shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-400 transition group-hover:border-violet-500/30 group-hover:text-violet-300",
            compact ? "hidden" : "hidden sm:block",
          ].join(" ")}>
            Pilih file
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptPdf ? "application/pdf" : "image/png,image/jpeg,image/jpg,image/webp"}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; void handleFile(f); e.currentTarget.value = ""; }}
      />
    </div>
  );
}

function ScanPill({ status }: { status: ScanStatus }) {
  if (status === "valid")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />Valid
      </span>
    );
  if (status === "review")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
        <AlertTriangle className="h-2.5 w-2.5" />Review
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
      <AlertTriangle className="h-2.5 w-2.5" />Gagal
    </span>
  );
}

function OcrMeta({ ocr }: { ocr: { status: ScanStatus; score: number; confidence: number } }) {
  if (ocr.status === "idle") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ScanPill status={ocr.status} />
      {ocr.score > 0 && (
        <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 text-[10px] text-slate-400">
          Parse {ocr.score}
        </span>
      )}
      {ocr.confidence > 0 && (
        <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 text-[10px] text-slate-400">
          OCR {Math.round(ocr.confidence)}%
        </span>
      )}
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/8 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
        Catatan Verifikasi
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-amber-300">
        {warnings.map((w, i) => (
          <li key={i}>· {w}</li>
        ))}
      </ul>
    </div>
  );
}

function RawTextAccordion({ rawText }: { rawText: string }) {
  const [open, setOpen] = useState(false);
  if (!rawText) return null;
  return (
    <div className="rounded-xl border border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs text-slate-500 transition hover:text-slate-400"
      >
        <span>Lihat hasil OCR mentah</span>
        <ChevronDown className={["h-3.5 w-3.5 transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>
      {open && (
        <pre className="max-h-52 overflow-auto border-t border-slate-800 px-3.5 py-3 text-[11px] leading-5 text-slate-400 whitespace-pre-wrap">
          {rawText}
        </pre>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200",
        active
          ? "border border-violet-500/20 bg-violet-500/10 text-violet-300 shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]"
          : "border border-transparent text-slate-500 hover:text-slate-300",
      ].join(" ")}
    >
      <span className={active ? "text-violet-400" : "text-slate-600"}>{icon}</span>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className={["text-[10px]", active ? "text-violet-500" : "text-slate-600"].join(" ")}>{sub}</p>
      </div>
    </button>
  );
}

function RefreshBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      <RefreshCw className="h-3 w-3" />
      {label}
    </button>
  );
}

/** Editable Field */
function EF({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-violet-500">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:bg-slate-900 focus:ring-1 focus:ring-violet-400/20"
      />
    </div>
  );
}

/** Editable Textarea */
function ETA({
  label,
  value,
  onChange,
  required,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-violet-500">*</span>}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400 focus:bg-slate-900 focus:ring-1 focus:ring-violet-400/20"
      />
    </div>
  );
}
