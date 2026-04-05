"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { kuasaOptions } from "./data";
import { ocrKTP } from "@/lib/ocrKtp";
import { parseKtpIndonesia } from "@/lib/parseKtp";
import { parseRisalah } from "@/lib/parseRisalah";

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit?: (payload: {
    template: SuratTemplate;
    values: Record<string, string>;
  }) => void;
};

type FormValues = {
  ktpDebitur: string;
  risalahFile: string;
  ktpPemohon: string;

  selectedKuasa: string;
  bertindakSebagai: "kuasa" | "sendiri";

  nama_debitur: string;
  nik_debitur: string;
  alamat_debitur: string;

  nama_pemohon: string;
  nik_pemohon: string;
  kotalahir_pemohon: string;
  tanggallahir_pemohon: string;
  kelamin_pemohon: string;
  agama_pemohon: string;
  alamat_pemohon: string;
  pekerjaan_pemohon: string;
  statuskawin_pemohon: string;

  nomor_risalah: string;
  tanggal_risalah: string;
  nama_bank: string;

  nomor_kwitansi: string;
  nomor_kutipan: string;
  nomor_aktegrosse: string;
  nomor_nib: string;
  lokasi_asset: string;
};

type KtpScanStatus = "idle" | "valid" | "review" | "invalid";

const initialValues: FormValues = {
  ktpDebitur: "",
  risalahFile: "",
  ktpPemohon: "",

  selectedKuasa: "",
  bertindakSebagai: "kuasa",

  nama_debitur: "",
  nik_debitur: "",
  alamat_debitur: "",

  nama_pemohon: "",
  nik_pemohon: "",
  kotalahir_pemohon: "",
  tanggallahir_pemohon: "",
  kelamin_pemohon: "",
  agama_pemohon: "",
  alamat_pemohon: "",
  pekerjaan_pemohon: "",
  statuskawin_pemohon: "",

  nomor_risalah: "",
  tanggal_risalah: "",
  nama_bank: "",

  nomor_kwitansi: "",
  nomor_kutipan: "",
  nomor_aktegrosse: "",
  nomor_nib: "",
  lokasi_asset: "",
};

export function SuratTemplateModal({
  open,
  template,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<FormValues>(initialValues);

  const [isParsingKtpDebitur, setIsParsingKtpDebitur] = useState(false);
  const [isParsingRisalah, setIsParsingRisalah] = useState(false);
  const [isParsingKtpPemohon, setIsParsingKtpPemohon] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [ktpDebiturRawText, setKtpDebiturRawText] = useState("");
  const [ktpDebiturOcrConfidence, setKtpDebiturOcrConfidence] = useState(0);
  const [ktpDebiturScore, setKtpDebiturScore] = useState(0);
  const [ktpDebiturStatus, setKtpDebiturStatus] =
    useState<KtpScanStatus>("idle");
  const [ktpDebiturWarnings, setKtpDebiturWarnings] = useState<string[]>([]);

  const [ktpPemohonRawText, setKtpPemohonRawText] = useState("");
  const [ktpPemohonOcrConfidence, setKtpPemohonOcrConfidence] = useState(0);
  const [ktpPemohonScore, setKtpPemohonScore] = useState(0);
  const [ktpPemohonStatus, setKtpPemohonStatus] =
    useState<KtpScanStatus>("idle");
  const [ktpPemohonWarnings, setKtpPemohonWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setValues(initialValues);

      setIsParsingKtpDebitur(false);
      setIsParsingRisalah(false);
      setIsParsingKtpPemohon(false);

      setErrorMessage("");

      setKtpDebiturRawText("");
      setKtpDebiturOcrConfidence(0);
      setKtpDebiturScore(0);
      setKtpDebiturStatus("idle");
      setKtpDebiturWarnings([]);

      setKtpPemohonRawText("");
      setKtpPemohonOcrConfidence(0);
      setKtpPemohonScore(0);
      setKtpPemohonStatus("idle");
      setKtpPemohonWarnings([]);
    }
  }, [open, template?.id]);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const selectedKuasaLabel = useMemo(() => {
    return (
      kuasaOptions.find((item) => item.id === values.selectedKuasa)?.label ?? ""
    );
  }, [values.selectedKuasa]);

  const canSubmit = useMemo(() => {
    const hasDebitur = Boolean(
      values.nama_debitur.trim() &&
        values.nik_debitur.trim() &&
        values.alamat_debitur.trim()
    );

    const hasCoreData = Boolean(
      values.nomor_kwitansi.trim() &&
        values.nomor_kutipan.trim() &&
        values.nomor_aktegrosse.trim() &&
        values.nomor_nib.trim() &&
        values.lokasi_asset.trim()
    );

    const hasActor =
      values.bertindakSebagai === "kuasa"
        ? Boolean(values.selectedKuasa)
        : Boolean(
            values.ktpPemohon &&
              values.nama_pemohon.trim() &&
              values.nik_pemohon.trim()
          );

    return hasDebitur && hasCoreData && hasActor;
  }, [values]);

  const handleKtpDebitur = async (file: File) => {
    update("ktpDebitur", file.name);
    setErrorMessage("");
    setIsParsingKtpDebitur(true);

    setKtpDebiturRawText("");
    setKtpDebiturOcrConfidence(0);
    setKtpDebiturScore(0);
    setKtpDebiturStatus("idle");
    setKtpDebiturWarnings([]);

    try {
      const ocr = await ocrKTP(file);
      const parsed = parseKtpIndonesia(ocr.cleanedText);

      setKtpDebiturRawText(ocr.cleanedText || ocr.rawText || "");
      setKtpDebiturOcrConfidence(Number(ocr.confidence || 0));
      setKtpDebiturScore(parsed.score || 0);
      setKtpDebiturStatus(parsed.status || "invalid");
      setKtpDebiturWarnings(parsed.warnings || []);

      update("nama_debitur", parsed.data.nama_pemohon || "");
      update("nik_debitur", parsed.data.nik_pemohon || "");
      update("alamat_debitur", parsed.data.alamat_pemohon || "");

      const ocrTooLow = Number(ocr.confidence || 0) < 45;
      const nikInvalid = !/^\d{16}$/.test(parsed.data.nik_pemohon || "");

      if (parsed.status === "invalid" || ocrTooLow || nikInvalid) {
        setKtpDebiturStatus("review");
        setErrorMessage(
          "Hasil scan KTP debitur perlu dicek manual. Pastikan foto terang, lurus, tidak blur, dan seluruh KTP terlihat."
        );
      }
    } catch (err) {
      console.error("OCR KTP Debitur gagal:", err);
      setKtpDebiturStatus("invalid");
      setErrorMessage(
        "Gagal membaca KTP debitur. Coba gunakan gambar yang lebih jelas."
      );
    } finally {
      setIsParsingKtpDebitur(false);
    }
  };

  const handleRisalah = async (file: File) => {
    update("risalahFile", file.name);
    setErrorMessage("");
    setIsParsingRisalah(true);

    try {
      const ocr = await ocrKTP(file);
      const parsed = parseRisalah(ocr.cleanedText || ocr.rawText || "");

      update("nomor_risalah", parsed.nomor_risalah || "");
      update("tanggal_risalah", parsed.tanggal_risalah || "");
      update("nama_bank", parsed.nama_bank || "");
    } catch (err) {
      console.error("OCR Risalah gagal:", err);
      setErrorMessage(
        "Gagal membaca kutipan risalah. Coba upload ulang dengan gambar yang lebih jelas."
      );
    } finally {
      setIsParsingRisalah(false);
    }
  };

  const handleKtpPemohon = async (file: File) => {
    update("ktpPemohon", file.name);
    setErrorMessage("");
    setIsParsingKtpPemohon(true);

    setKtpPemohonRawText("");
    setKtpPemohonOcrConfidence(0);
    setKtpPemohonScore(0);
    setKtpPemohonStatus("idle");
    setKtpPemohonWarnings([]);

    try {
      const ocr = await ocrKTP(file);
      const parsed = parseKtpIndonesia(ocr.cleanedText);

      setKtpPemohonRawText(ocr.cleanedText || ocr.rawText || "");
      setKtpPemohonOcrConfidence(Number(ocr.confidence || 0));
      setKtpPemohonScore(parsed.score || 0);
      setKtpPemohonStatus(parsed.status || "invalid");
      setKtpPemohonWarnings(parsed.warnings || []);

      update("nama_pemohon", parsed.data.nama_pemohon || "");
      update("nik_pemohon", parsed.data.nik_pemohon || "");
      update("kotalahir_pemohon", parsed.data.kotalahir_pemohon || "");
      update("tanggallahir_pemohon", parsed.data.tanggallahir_pemohon || "");
      update("kelamin_pemohon", parsed.data.kelamin_pemohon || "");
      update("agama_pemohon", parsed.data.agama_pemohon || "");
      update("alamat_pemohon", parsed.data.alamat_pemohon || "");
      update("pekerjaan_pemohon", parsed.data.pekerjaan_pemohon || "");
      update("statuskawin_pemohon", parsed.data.statuskawin_pemohon || "");

      const ocrTooLow = Number(ocr.confidence || 0) < 45;
      const nikInvalid = !/^\d{16}$/.test(parsed.data.nik_pemohon || "");

      if (parsed.status === "invalid" || ocrTooLow || nikInvalid) {
        setKtpPemohonStatus("review");
        setErrorMessage(
          "Hasil scan KTP pemohon perlu dicek manual. Pastikan foto terang, lurus, tidak blur, dan seluruh KTP terlihat."
        );
      }
    } catch (err) {
      console.error("OCR KTP Pemohon gagal:", err);
      setKtpPemohonStatus("invalid");
      setErrorMessage(
        "Gagal membaca KTP pemohon. Coba upload ulang dengan gambar yang lebih jelas."
      );
    } finally {
      setIsParsingKtpPemohon(false);
    }
  };

  const handleSubmit = () => {
    if (!template) return;

    const payload: Record<string, string> = {
      ktpDebitur: values.ktpDebitur,
      risalahFile: values.risalahFile,
      ktpPemohon: values.ktpPemohon,

      selectedKuasa: values.selectedKuasa,
      bertindakSebagai: values.bertindakSebagai,

      nama_debitur: values.nama_debitur,
      nik_debitur: values.nik_debitur,
      alamat_debitur: values.alamat_debitur,

      nama_pemohon: values.nama_pemohon,
      nik_pemohon: values.nik_pemohon,
      kotalahir_pemohon: values.kotalahir_pemohon,
      tanggallahir_pemohon: values.tanggallahir_pemohon,
      kelamin_pemohon: values.kelamin_pemohon,
      agama_pemohon: values.agama_pemohon,
      alamat_pemohon: values.alamat_pemohon,
      pekerjaan_pemohon: values.pekerjaan_pemohon,
      statuskawin_pemohon: values.statuskawin_pemohon,

      nomor_risalah: values.nomor_risalah,
      tanggal_risalah: values.tanggal_risalah,
      nama_bank: values.nama_bank,

      nomor_kwitansi: values.nomor_kwitansi,
      nomor_kutipan: values.nomor_kutipan,
      nomor_aktegrosse: values.nomor_aktegrosse,
      nomor_nib: values.nomor_nib,
      lokasi_asset: values.lokasi_asset,
    };

    onSubmit?.({
      template,
      values: payload,
    });
  };

  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {template.title}
            </h2>
            <p className="text-sm text-slate-400">
              Upload dokumen dan isi data inti saja.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-6 overflow-y-auto p-6">
          {errorMessage ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <KtpDropzone
              label="Upload KTP Debitur"
              filename={values.ktpDebitur}
              loading={isParsingKtpDebitur}
              onFile={handleKtpDebitur}
              helperText="Drag & drop atau klik. Disarankan foto close-up, terang, lurus, dan tidak blur."
            />

            <KtpDropzone
              label="Upload Kutipan Risalah"
              filename={values.risalahFile}
              loading={isParsingRisalah}
              onFile={handleRisalah}
              helperText="Upload foto atau scan kutipan risalah dengan tulisan yang jelas."
            />
          </div>

          {values.ktpDebitur ? (
            <ScanResultCard
              title="Hasil Scan KTP Debitur"
              status={ktpDebiturStatus}
              score={ktpDebiturScore}
              confidence={ktpDebiturOcrConfidence}
              warnings={ktpDebiturWarnings}
              rawText={ktpDebiturRawText}
              fields={[
                { label: "Nama Debitur", value: values.nama_debitur },
                { label: "NIK", value: values.nik_debitur },
                { label: "Alamat", value: values.alamat_debitur, full: true },
              ]}
            />
          ) : null}

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="text-sm font-medium text-slate-300">
              Bertindak sebagai
            </label>

            <div className="flex flex-wrap gap-4 text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="bertindak-sebagai"
                  checked={values.bertindakSebagai === "sendiri"}
                  onChange={() => update("bertindakSebagai", "sendiri")}
                />
                <span>Atas Nama Sendiri</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="bertindak-sebagai"
                  checked={values.bertindakSebagai === "kuasa"}
                  onChange={() => update("bertindakSebagai", "kuasa")}
                />
                <span>Menggunakan Kuasa</span>
              </label>
            </div>

            {values.bertindakSebagai === "kuasa" ? (
              <div className="space-y-2">
                <select
                  value={values.selectedKuasa}
                  onChange={(e) => update("selectedKuasa", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="">Pilih Kuasa</option>
                  {kuasaOptions.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>

                {selectedKuasaLabel ? (
                  <p className="text-xs text-slate-400">
                    Kuasa terpilih: {selectedKuasaLabel}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <KtpDropzone
                  label="Upload KTP Pemohon"
                  filename={values.ktpPemohon}
                  loading={isParsingKtpPemohon}
                  onFile={handleKtpPemohon}
                  helperText="Upload KTP pemohon bila bertindak atas nama sendiri."
                />

                {values.ktpPemohon ? (
                  <ScanResultCard
                    title="Hasil Scan KTP Pemohon"
                    status={ktpPemohonStatus}
                    score={ktpPemohonScore}
                    confidence={ktpPemohonOcrConfidence}
                    warnings={ktpPemohonWarnings}
                    rawText={ktpPemohonRawText}
                    fields={[
                      { label: "Nama", value: values.nama_pemohon },
                      { label: "NIK", value: values.nik_pemohon },
                      {
                        label: "TTL",
                        value:
                          values.kotalahir_pemohon || values.tanggallahir_pemohon
                            ? `${values.kotalahir_pemohon || "-"}, ${
                                values.tanggallahir_pemohon || "-"
                              }`
                            : "",
                        full: true,
                      },
                      {
                        label: "Jenis Kelamin",
                        value: values.kelamin_pemohon,
                      },
                      { label: "Agama", value: values.agama_pemohon },
                      {
                        label: "Status Kawin",
                        value: values.statuskawin_pemohon,
                      },
                      { label: "Pekerjaan", value: values.pekerjaan_pemohon },
                      {
                        label: "Alamat",
                        value: values.alamat_pemohon,
                        full: true,
                      },
                    ]}
                  />
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nomor Kwitansi"
              value={values.nomor_kwitansi}
              onChange={(v) => update("nomor_kwitansi", v)}
            />

            <Input
              label="Nomor Kutipan"
              value={values.nomor_kutipan}
              onChange={(v) => update("nomor_kutipan", v)}
            />

            <Input
              label="Nomor Akte Grosse"
              value={values.nomor_aktegrosse}
              onChange={(v) => update("nomor_aktegrosse", v)}
            />

            <Input
              label="Nomor NIB"
              value={values.nomor_nib}
              onChange={(v) => update("nomor_nib", v)}
            />

            <Input
              label="Nomor Risalah"
              value={values.nomor_risalah}
              onChange={(v) => update("nomor_risalah", v)}
            />

            <Input
              label="Tanggal Risalah"
              value={values.tanggal_risalah}
              onChange={(v) => update("tanggal_risalah", v)}
            />

            <Input
              label="Nama Bank"
              value={values.nama_bank}
              onChange={(v) => update("nama_bank", v)}
            />

            <div className="md:col-span-2">
              <label className="text-sm text-slate-300">Lokasi Asset</label>
              <textarea
                rows={3}
                value={values.lokasi_asset}
                onChange={(e) => update("lokasi_asset", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !canSubmit ||
              isParsingKtpDebitur ||
              isParsingRisalah ||
              isParsingKtpPemohon
            }
            className="rounded-xl bg-emerald-500 px-5 py-2 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Surat
          </button>
        </div>
      </div>
    </div>
  );
}

function KtpDropzone({
  label,
  onFile,
  filename,
  loading = false,
  helperText = "Drag & drop file di sini atau klik untuk memilih file",
}: {
  label: string;
  onFile: (file: File) => void | Promise<void>;
  filename?: string;
  loading?: boolean;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    const maxSizeMb = 8;

    if (!allowedTypes.includes(file.type)) {
      alert("Format file harus JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      alert("Ukuran file maksimal 8MB.");
      return;
    }

    await onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        void handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={[
        "group cursor-pointer rounded-2xl border border-dashed p-6 text-center transition",
        dragging
          ? "border-emerald-400 bg-emerald-500/10"
          : "border-slate-700 bg-slate-900/50 hover:border-emerald-400 hover:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-emerald-400" />
        ) : (
          <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-950 p-3 transition group-hover:border-emerald-400/60">
            <Upload className="h-5 w-5 text-slate-300" />
          </div>
        )}

        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">{helperText}</p>

        {filename ? (
          <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{filename}</span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Klik atau jatuhkan file di sini
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFile(file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-300">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-400"
      />
    </div>
  );
}

function ScanResultCard({
  title,
  status,
  score,
  confidence,
  warnings,
  rawText,
  fields,
}: {
  title: string;
  status: KtpScanStatus;
  score: number;
  confidence: number;
  warnings: string[];
  rawText: string;
  fields: Array<{
    label: string;
    value?: string;
    full?: boolean;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>

        {status === "valid" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid
          </span>
        )}

        {status === "review" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Review Manual
          </span>
        )}

        {status === "invalid" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Tidak Terbaca
          </span>
        )}

        {score > 0 && (
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            Parse Score {score}
          </span>
        )}

        {confidence > 0 && (
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            OCR {Math.round(confidence)}%
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={`${field.label}-${field.value ?? ""}`}
            className={field.full ? "md:col-span-2" : ""}
          >
            <InfoItem label={field.label} value={field.value} />
          </div>
        ))}
      </div>

      {warnings.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-amber-300">
            Catatan Verifikasi
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-200">
            {warnings.map((warning, idx) => (
              <li key={`${warning}-${idx}`}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-slate-400">
          Lihat hasil OCR mentah
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-slate-300">
          {rawText || "-"}
        </pre>
      </details>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-200">
        {value?.trim() ? value : "-"}
      </p>
    </div>
  );
}