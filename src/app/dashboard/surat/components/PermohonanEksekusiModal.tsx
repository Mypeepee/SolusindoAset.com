"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { DialogFrame } from "@/components/ui/dialog";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";
import {
  ktpSuratPatch,
  kuitansiSuratPatch,
  nomorSuratKuasaDefault,
  suratErrors,
  suratFields,
  tanggalWib,
  type SuratField,
  type SuratValues,
} from "@/lib/suratGeneration";
import type { SuratTemplate } from "./data";

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit: (payload: { template: SuratTemplate; values: SuratValues }) => Promise<void> | void;
};

type DocumentKey = "pemohon" | "kuasa" | "risalah" | "kuitansi";
type DocumentInfo = { name: string; preview: string };
type ScanState = "idle" | "scanning" | "valid" | "review" | "invalid";
type Accent = "amber" | "cyan" | "violet" | "emerald";

const ID = "permohonan-eksekusi-pn";
const A: Record<Accent, {
  text: string; ring: string; bg: string; btnBg: string; btnHov: string; border: string; cardBg: string;
  dropHover: string; dropDrag: string; dragGlow: string; sweep: string; iconRing: string; iconText: string; spinner: string;
}> = {
  amber: {
    text: "text-amber-300", ring: "ring-amber-400/35", bg: "bg-amber-500/12",
    btnBg: "bg-amber-500/15", btnHov: "hover:bg-amber-500/25", border: "border-amber-500/20", cardBg: "bg-amber-500/[0.025]",
    dropHover: "hover:border-amber-400/60 hover:bg-amber-500/[0.035]", dropDrag: "border-amber-400/90 bg-amber-500/[0.07]",
    dragGlow: "shadow-[0_0_60px_rgba(245,158,11,0.22)]", sweep: "from-amber-400/40", iconRing: "bg-amber-500/12 ring-1 ring-amber-400/30",
    iconText: "text-amber-300", spinner: "border-t-amber-400",
  },
  cyan: {
    text: "text-cyan-300", ring: "ring-cyan-400/35", bg: "bg-cyan-500/12",
    btnBg: "bg-cyan-500/15", btnHov: "hover:bg-cyan-500/25", border: "border-cyan-500/20", cardBg: "bg-cyan-500/[0.025]",
    dropHover: "hover:border-cyan-400/60 hover:bg-cyan-500/[0.035]", dropDrag: "border-cyan-400/90 bg-cyan-500/[0.07]",
    dragGlow: "shadow-[0_0_60px_rgba(6,182,212,0.22)]", sweep: "from-cyan-400/40", iconRing: "bg-cyan-500/12 ring-1 ring-cyan-400/30",
    iconText: "text-cyan-300", spinner: "border-t-cyan-400",
  },
  violet: {
    text: "text-violet-300", ring: "ring-violet-400/35", bg: "bg-violet-500/12",
    btnBg: "bg-violet-500/15", btnHov: "hover:bg-violet-500/25", border: "border-violet-500/20", cardBg: "bg-violet-500/[0.02]",
    dropHover: "hover:border-violet-400/60 hover:bg-violet-500/[0.035]", dropDrag: "border-violet-400/90 bg-violet-500/[0.07]",
    dragGlow: "shadow-[0_0_60px_rgba(139,92,246,0.22)]", sweep: "from-violet-400/40", iconRing: "bg-violet-500/12 ring-1 ring-violet-400/30",
    iconText: "text-violet-300", spinner: "border-t-violet-400",
  },
  emerald: {
    text: "text-emerald-300", ring: "ring-emerald-400/35", bg: "bg-emerald-500/12",
    btnBg: "bg-emerald-500/15", btnHov: "hover:bg-emerald-500/25", border: "border-emerald-500/20", cardBg: "bg-emerald-500/[0.02]",
    dropHover: "hover:border-emerald-400/60 hover:bg-emerald-500/[0.035]", dropDrag: "border-emerald-400/90 bg-emerald-500/[0.07]",
    dragGlow: "shadow-[0_0_60px_rgba(16,185,129,0.22)]", sweep: "from-emerald-400/40", iconRing: "bg-emerald-500/12 ring-1 ring-emerald-400/30",
    iconText: "text-emerald-300", spinner: "border-t-emerald-400",
  },
};

const STEPS = [
  { title: "Pemohon / Kuasa", sub: "Scan identitas", accent: "cyan", icon: "solar:users-group-two-rounded-bold-duotone" },
  { title: "Risalah & Aset", sub: "Dokumen lelang", accent: "amber", icon: "solar:document-text-bold-duotone" },
  { title: "Kuitansi & Lelang", sub: "Bukti pembayaran", accent: "violet", icon: "solar:bill-list-bold-duotone" },
  { title: "Data Surat", sub: "Generate PDF", accent: "emerald", icon: "solar:document-add-bold-duotone" },
] as const;

const INPUT_IDS: Record<DocumentKey, string> = {
  pemohon: "scan-pemenang-lelang",
  kuasa: "scan-penerima-kuasa",
  risalah: "scan-risalah-eksekusi",
  kuitansi: "scan-kuitansi-eksekusi",
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asScanState(value: unknown): ScanState {
  return value === "valid" || value === "invalid" ? value : "review";
}

function withDate(value: string): string {
  const match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return match ? `${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}-${match[3]}` : value;
}

function certificateData(raw: string) {
  const clean = raw.replace(/^Sertifikat\s+/i, "").trim();
  const code = clean.match(/\b(SHM|SHGB|SHGU|HGB|HGU|HP|HMSRS|HM)\b/i)?.[1]?.toUpperCase() ?? clean;
  const labels: Record<string, string> = {
    SHM: "Sertifikat Hak Milik", HM: "Sertifikat Hak Milik",
    SHGB: "Sertifikat Hak Guna Bangunan", HGB: "Sertifikat Hak Guna Bangunan",
    SHGU: "Sertifikat Hak Guna Usaha", HGU: "Sertifikat Hak Guna Usaha",
    HP: "Sertifikat Hak Pakai", HMSRS: "Sertifikat Hak Milik atas Satuan Rumah Susun",
  };
  return { label: labels[code] ?? (raw ? (raw.startsWith("Sertifikat") ? raw : `Sertifikat ${raw}`) : ""), code };
}

function sectionForStep(step: number, fields: SuratField[]): SuratField[] {
  const included = step === 0
    ? ["Data pemohon", "Data kuasa"]
    : step === 1
      ? ["Data aset", "Data risalah lelang"]
      : step === 2
        ? ["Data lelang"]
        : ["Data surat", "Data surat kuasa", "Data debitur"];
  return fields.filter((field) => included.includes(field.section));
}

function stepForField(field: SuratField): number {
  if (field.section === "Data pemohon" || field.section === "Data kuasa") return 0;
  if (field.section === "Data aset" || field.section === "Data risalah lelang") return 1;
  if (field.section === "Data lelang") return 2;
  return 3;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{children}</span>;
}

function FieldInput({
  field, value, error, disabled, onChange, idPrefix = "surat",
}: {
  field: SuratField;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  const controlClass = "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white placeholder:text-zinc-600 outline-none transition-all focus:border-amber-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <label className="block min-w-0" htmlFor={id}>
      <FieldLabel>{field.label}{field.required && " *"}</FieldLabel>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.key}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={2}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
          className={`${controlClass} resize-none leading-relaxed`}
        />
      ) : (
        <input
          id={id}
          name={field.key}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          disabled={disabled}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          min={field.type === "number" ? "0" : undefined}
          step={field.type === "number" ? "any" : undefined}
          inputMode={field.key.startsWith("nik_") ? "numeric" : undefined}
          maxLength={field.key.startsWith("nik_") ? 16 : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
          className={controlClass}
        />
      )}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-rose-300">{error}</p>}
    </label>
  );
}

function FieldsGrid({
  fields, values, errors, disabled, onChange, person = false,
}: {
  fields: SuratField[];
  values: SuratValues;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  person?: boolean;
}) {
  return (
    <div className={person ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {fields.map((field) => {
        const pairedBirthday = field.key.startsWith("tempatlahir_") || field.key.startsWith("tanggallahir_");
        const full = field.type === "textarea" || (person && !pairedBirthday);
        return (
          <div key={field.key} className={full ? "col-span-2" : "min-w-0"}>
            <FieldInput
              field={field}
              value={values[field.key] ?? ""}
              error={errors[field.key]}
              disabled={disabled}
              onChange={onChange}
            />
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  accent, icon, title, subtitle, children,
}: { accent: Accent; icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  const ac = A[accent];
  return (
    <section className={`overflow-hidden rounded-2xl border ${ac.border} ${ac.cardBg}`}>
      <div className={`flex items-center gap-2.5 border-b px-4 py-3 ${ac.border} ${ac.bg}`}>
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/20 ring-1 ${ac.ring}`}>
          <Icon icon={icon} className={`text-sm ${ac.text}`} />
        </div>
        <div>
          <p className="text-[12px] font-black text-white">{title}</p>
          {subtitle && <p className="text-[10px] text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ScanBadge({ status, warnings }: { status: ScanState; warnings: string[] }) {
  if (status === "idle" || status === "scanning") return null;
  const cfg = {
    valid: { label: "Terbaca Jelas", icon: "solar:check-circle-bold-duotone", cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20" },
    review: { label: "Perlu Dicek", icon: "solar:danger-triangle-bold-duotone", cls: "text-amber-300 bg-amber-500/10 ring-amber-500/20" },
    invalid: { label: "Tidak Terbaca", icon: "solar:close-circle-bold-duotone", cls: "text-red-300 bg-red-500/10 ring-red-500/20" },
  }[status];
  return (
    <div className="mt-2 space-y-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${cfg.cls}`}>
        <Icon icon={cfg.icon} className="text-xs" />{cfg.label}
      </span>
      {warnings.map((warning, index) => (
        <p key={`${warning}-${index}`} className="flex items-start gap-1 text-[10.5px] text-amber-400/80">
          <Icon icon="solar:point-on-map-bold" className="mt-px shrink-0 text-[9px]" />{warning}
        </p>
      ))}
    </div>
  );
}

function UploadArea({
  inputId, title, helper, dropTitle, dropHint, dropHintLead, dropHintEmphasis, dropHintTail, file, scanState, scanMessage, warnings,
  disabled, dragging, accent, kind, onChoose, onFile, onDrag,
}: {
  inputId: string;
  title: string;
  helper: string;
  dropTitle: string;
  dropHint?: string;
  dropHintLead?: string;
  dropHintEmphasis?: string;
  dropHintTail?: string;
  file?: DocumentInfo;
  scanState: ScanState;
  scanMessage?: string;
  warnings: string[];
  disabled: boolean;
  dragging: boolean;
  accent: Accent;
  kind: "ktp" | "document";
  onChoose: () => void;
  onFile: (file: File | undefined) => void;
  onDrag: (dragging: boolean) => void;
}) {
  const ac = A[accent];
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault(); onDrag(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onChoose();
  };

  return !file ? (
    <div
      className={`group relative select-none overflow-hidden rounded-3xl border border-dashed border-white/[0.10] bg-white/[0.02] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${disabled ? "cursor-not-allowed opacity-50" : `cursor-pointer ${dragging ? `${ac.dropDrag} ${ac.dragGlow}` : ac.dropHover}`}`}
      onClick={disabled ? undefined : onChoose}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) onDrag(true); }}
      onDragLeave={() => onDrag(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Pilih atau jatuhkan file: ${title}`}
      aria-disabled={disabled}
      aria-controls={inputId}
    >
      <span
        className={`akta-scan pointer-events-none absolute inset-x-6 top-0 h-8 bg-gradient-to-b to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 ${ac.sweep}`}
        style={{ animation: dragging ? "aktaScan 1.4s linear infinite" : undefined }}
      />
      <div className={`relative flex flex-col items-center gap-3.5 px-5 text-center ${kind === "document" ? "py-10" : "py-9"}`}>
        <div className={`grid place-items-center rounded-3xl ring-1 transition-transform duration-300 ${kind === "document" ? "h-16 w-16" : "h-14 w-14"} ${ac.iconRing} ${dragging ? "scale-110" : "group-hover:scale-105"}`}>
          <Icon
            icon={kind === "ktp" ? "solar:camera-add-bold-duotone" : "solar:document-add-bold-duotone"}
            className={`text-[26px] transition-colors duration-300 ${dragging ? ac.iconText : "text-zinc-500 group-hover:text-zinc-300"}`}
          />
        </div>
        <div className="space-y-1">
          <p className={kind === "document" ? "text-[14px] font-black text-white" : "text-[13px] font-black text-white"}>{dropTitle}</p>
          <p className={kind === "document" ? "text-[11.5px] leading-relaxed text-zinc-500" : "text-[11px] leading-relaxed text-zinc-500"}>
            {dropHintLead ? <>{dropHintLead}<span className={ac.text}>{dropHintEmphasis}</span>{dropHintTail}</> : dropHint}
          </p>
        </div>
        <span className={`rounded-full text-[10px] font-black tracking-wide ring-1 ${kind === "document" ? "px-3.5 py-1.5" : "px-3 py-1"} ${ac.bg} ${ac.text} ${ac.ring}`}>
          {helper}
        </span>
      </div>
    </div>
  ) : (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 transition-colors ${scanState === "scanning" ? `${ac.border} ${ac.cardBg}` : "border-white/[0.07] bg-white/[0.02]"}`}>
      <div className={`relative h-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/[0.06] ${kind === "document" ? "w-16" : "w-24"}`}>
        {file.preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={file.preview} alt={kind === "ktp" ? "KTP" : title} className="h-full w-full object-cover" />
          : <div className="grid h-full w-full place-items-center"><Icon icon="solar:file-text-bold-duotone" className={`text-[26px] ${ac.text}`} /></div>}
        {scanState === "scanning" && <>
          <div className={`absolute inset-0 ${ac.bg} opacity-60`} />
          <span className={`akta-scan absolute inset-x-0 top-0 h-6 bg-gradient-to-b to-transparent ${ac.sweep}`} style={{ animation: "aktaScan 1.3s linear infinite" }} />
        </>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold text-white">{file.name}</p>
        {scanState === "scanning" ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent motion-reduce:animate-none ${ac.spinner}`} />
            <p className={`text-[11px] font-semibold ${ac.text}`}>Membaca {kind === "ktp" ? "KTP" : "dokumen"}…</p>
          </div>
        ) : scanState !== "idle" ? <ScanBadge status={scanState} warnings={warnings} /> : <p className="mt-1 text-[11px] text-zinc-500">File terupload</p>}
        {scanMessage && scanState !== "scanning" && <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-400">{scanMessage}</p>}
      </div>
      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        className="shrink-0 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.10] hover:text-white disabled:opacity-40"
      >Ganti</button>
    </div>
  );
}

function PersonPanel({
  accent, title, subtitle, file, scanState, scanMessage, warnings, fields, values, errors, disabled,
  inputId, onChoose, onFile, dragging, onDrag, onChange,
}: {
  accent: Accent;
  title: string;
  subtitle: string;
  file?: DocumentInfo;
  scanState: ScanState;
  scanMessage?: string;
  warnings: string[];
  fields: SuratField[];
  values: SuratValues;
  errors: Record<string, string>;
  disabled: boolean;
  inputId: string;
  onChoose: () => void;
  onFile: (file: File | undefined) => void;
  dragging: boolean;
  onDrag: (dragging: boolean) => void;
  onChange: (key: string, value: string) => void;
}) {
  const ac = A[accent];
  return (
    <section className={`flex flex-col gap-3.5 overflow-hidden rounded-2xl border p-4 ${ac.border} ${ac.cardBg}`}>
      <div className="flex items-center gap-2.5">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ${ac.bg} ${ac.ring}`}>
          <Icon icon="solar:card-2-bold-duotone" className={`text-base ${ac.text}`} />
        </div>
        <div>
          <p className="text-[12px] font-black text-white">{title}</p>
          <p className="text-[10px] text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <UploadArea
        inputId={inputId} title={title} helper="JPG · PNG · WEBP · maks 10 MB"
        dropTitle="Scan KTP" dropHint="" dropHintLead="Tarik & lepas atau klik — " dropHintEmphasis="nama, NIK & data" dropHintTail=" terisi otomatis"
        file={file} scanState={scanState} scanMessage={scanMessage} warnings={warnings}
        disabled={disabled} dragging={dragging} accent={accent} kind="ktp"
        onChoose={onChoose} onFile={onFile} onDrag={onDrag}
      />
      <FieldsGrid fields={fields} values={values} errors={errors} disabled={disabled} onChange={onChange} person />
    </section>
  );
}

function FieldsSection({
  fields, values, errors, disabled, onChange,
}: {
  fields: SuratField[];
  values: SuratValues;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const sections = [...new Set(fields.map((field) => field.section))];
  const meta: Record<string, { accent: Accent; icon: string; title: string; subtitle: string }> = {
    "Data aset": { accent: "violet", icon: "solar:home-2-bold-duotone", title: "Data Objek Lelang", subtitle: "Identitas sertifikat & lokasi — terisi dari scan" },
    "Data risalah lelang": { accent: "amber", icon: "solar:clipboard-text-bold-duotone", title: "Kutipan Risalah Lelang", subtitle: "Nomor dan tanggal dokumen lelang" },
    "Data lelang": { accent: "violet", icon: "solar:bill-list-bold-duotone", title: "Data Lelang", subtitle: "Informasi kuitansi dan kantor lelang" },
    "Data surat": { accent: "emerald", icon: "solar:document-text-bold-duotone", title: "Data Surat", subtitle: "Informasi tujuan dan penandatanganan" },
    "Data surat kuasa": { accent: "amber", icon: "solar:document-add-bold-duotone", title: "Surat Kuasa Khusus", subtitle: "Nomor dan tanggal surat kuasa" },
    "Data debitur": { accent: "amber", icon: "solar:user-bold-duotone", title: "Data Debitur / Termohon", subtitle: "Pihak yang menempati aset" },
  };
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const config = meta[section] ?? { accent: "amber" as const, icon: "solar:document-text-bold-duotone", title: section, subtitle: undefined };
        return (
          <SectionCard key={section} {...config}>
            <FieldsGrid fields={fields.filter((field) => field.section === section)} values={values} errors={errors} disabled={disabled} onChange={onChange} />
          </SectionCard>
        );
      })}
    </div>
  );
}

export function PermohonanEksekusiModal({ open, template, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<SuratValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [files, setFiles] = useState<Partial<Record<DocumentKey, DocumentInfo>>>({});
  const [scanStates, setScanStates] = useState<Record<DocumentKey, ScanState>>({
    pemohon: "idle", kuasa: "idle", risalah: "idle", kuitansi: "idle",
  });
  const [scanMessages, setScanMessages] = useState<Partial<Record<DocumentKey, string>>>({});
  const [scanWarnings, setScanWarnings] = useState<Partial<Record<DocumentKey, string[]>>>({});
  const [dragging, setDragging] = useState<DocumentKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locked = useRef(false);
  const generation = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const previewUrls = useRef<Partial<Record<DocumentKey, string>>>({});
  const fileInputs = useRef<Partial<Record<DocumentKey, HTMLInputElement | null>>>({});

  const kuasa = values.bertindakSebagai === "kuasa";
  const fields = useMemo(() => suratFields(ID, values), [values]);
  const visibleFields = useMemo(() => sectionForStep(step, fields), [step, fields]);
  const stepKeys = useMemo(() => visibleFields.map((field) => field.key), [visibleFields]);
  const allErrors = useMemo(() => suratErrors(ID, values), [values]);

  useEffect(() => {
    generation.current++;
    locked.current = false;
    setStep(0);
    setDir(1);
    const today = tanggalWib();
    setValues({
      tanggal_surat: today,
      tanggal_surat_kuasa: today,
      nomor_surat_kuasa: nomorSuratKuasaDefault(today),
      bertindakSebagai: "sendiri",
    });
    setErrors({}); setError(""); setBusy(""); setIsSubmitting(false);
    setDirty(false); setConfirmClose(false); setFiles({});
    setScanStates({ pemohon: "idle", kuasa: "idle", risalah: "idle", kuitansi: "idle" });
    setScanMessages({}); setScanWarnings({}); setDragging(null);
    for (const url of Object.values(previewUrls.current)) if (url) URL.revokeObjectURL(url);
    previewUrls.current = {};
  }, [open, template?.id]);

  useEffect(() => () => {
    generation.current++;
    for (const url of Object.values(previewUrls.current)) if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => { body.current?.scrollTo({ top: 0, behavior: "auto" }); }, [step]);
  useEffect(() => { if (confirmClose) keepEditing.current?.focus(); }, [confirmClose]);

  function update(key: string, value: string) {
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      const letterDateFollowsMain = key === "tanggal_surat"
        && (!previous.tanggal_surat_kuasa || previous.tanggal_surat_kuasa === previous.tanggal_surat);
      if (letterDateFollowsMain) next.tanggal_surat_kuasa = value;

      const dateChanged = key === "tanggal_surat_kuasa" || letterDateFollowsMain;
      if (dateChanged) {
        const previousLetterDate = previous.tanggal_surat_kuasa || previous.tanggal_surat || "";
        const previousDefaultNumber = nomorSuratKuasaDefault(previousLetterDate);
        if (!previous.nomor_surat_kuasa || previous.nomor_surat_kuasa === previousDefaultNumber)
          next.nomor_surat_kuasa = nomorSuratKuasaDefault(key === "tanggal_surat_kuasa" ? value : next.tanggal_surat_kuasa);
      }
      return next;
    });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      if (key === "tanggal_surat" || key === "tanggal_surat_kuasa") {
        delete next.nomor_surat_kuasa;
        delete next.tanggal_surat_kuasa;
      }
      return next;
    });
    setError(""); setDirty(true);
  }

  function requestClose() {
    if (locked.current) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function saveFile(key: DocumentKey, file: File) {
    const isKtp = key === "pemohon" || key === "kuasa";
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const acceptedImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const max = isKtp ? 10 : 20;
    if (file.size > max * 1024 * 1024) {
      setError(`Ukuran file maksimal ${max} MB.`);
      return;
    }
    if ((!isKtp && !isPdf && !acceptedImage) || (isKtp && !acceptedImage)) {
      setError(isKtp ? "Gunakan foto KTP JPG, PNG, atau WebP." : "Gunakan JPG, PNG, WebP, atau PDF.");
      return;
    }

    const oldUrl = previewUrls.current[key];
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const preview = isPdf ? "" : URL.createObjectURL(file);
    previewUrls.current[key] = preview;
    setFiles((previous) => ({ ...previous, [key]: { name: file.name, preview } }));
    setScanStates((previous) => ({ ...previous, [key]: "scanning" }));
    setScanMessages((previous) => ({ ...previous, [key]: "" }));
    setScanWarnings((previous) => ({ ...previous, [key]: [] }));
    setError(""); setDirty(true);

    void scanFile(key, file);
  }

  async function scanFile(key: DocumentKey, file: File) {
    if (locked.current) return;
    const current = generation.current;
    locked.current = true;
    setBusy(key);
    try {
      let patch: SuratValues = {};
      let message = "";
      let status: ScanState = "review";
      let warnings: string[] = [];
      if (key === "pemohon" || key === "kuasa") {
        const result = await ocrKTP(file);
        patch = ktpSuratPatch(result.parsed as unknown as Record<string, unknown>, key);
        status = Object.keys(patch).length ? asScanState(result.status) : "invalid";
        warnings = result.warnings ?? [];
        message = Object.keys(patch).length
          ? "Identitas terbaca. Periksa kembali hasil scan."
          : "Data belum terbaca. Isi data secara manual.";
      } else if (key === "risalah") {
        const result = await ocrRisalah(file);
        const parsed = (result.parsed ?? {}) as Record<string, unknown>;
        status = Object.keys(parsed).some((name) => asText(parsed[name])) ? asScanState(result.status) : "invalid";
        warnings = Array.isArray(result.warnings) ? result.warnings : [];
        const hak = asText(parsed.jenis_hak);
        const certificate = certificateData(hak);
        patch = Object.fromEntries(Object.entries({
          nomor_risalah: asText(parsed.nomor_risalah),
          tanggal_risalah: withDate(asText(parsed.tanggal_risalah)),
          jenis_sertifikat: certificate.label,
          singkatan_sertifikat: certificate.code,
          nomor_nib: asText(parsed.nomor_sertifikat),
          LT: asText(parsed.luas),
          lokasi_asset: asText(parsed.alamat_obyek),
          kelurahan_asset: asText(parsed.kelurahan),
          kecamatan_asset: asText(parsed.kecamatan),
          kota_asset: asText(parsed.kabupaten),
          kantor_lelang: asText(parsed.kantor_lelang),
        }).filter(([, value]) => value));
        message = Object.keys(patch).length
          ? "Data risalah terisi. Periksa jenis hak, luas, dan alamat aset."
          : "Data belum terbaca. Isi data secara manual.";
      } else {
        const result = await ocrRisalah(file);
        patch = kuitansiSuratPatch(asText(result.raw_text));
        status = Object.keys(patch).length === 2 ? "valid" : Object.keys(patch).length ? "review" : "invalid";
        if (status !== "valid") warnings = ["Periksa kembali nomor dan tanggal kuitansi."];
        message = Object.keys(patch).length
          ? "Nomor dan tanggal kuitansi terbaca. Periksa kembali hasil scan."
          : "Nomor atau tanggal belum terbaca. Isi data secara manual.";
      }

      if (generation.current !== current) return;
      setValues((previous) => ({ ...previous, ...patch }));
      setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in patch))));
      setDirty(true);
      setScanStates((previous) => ({ ...previous, [key]: status }));
      setScanMessages((previous) => ({ ...previous, [key]: message }));
      setScanWarnings((previous) => ({ ...previous, [key]: warnings }));
    } catch (cause) {
      if (generation.current === current) {
        setScanStates((previous) => ({ ...previous, [key]: "invalid" }));
        const message = cause instanceof Error && cause.name !== "TimeoutError"
          ? cause.message
          : "Scan belum selesai. Coba unggah ulang atau isi data secara manual.";
        setScanMessages((previous) => ({ ...previous, [key]: message }));
        setScanWarnings((previous) => ({ ...previous, [key]: [] }));
      }
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(""); }
    }
  }

  function validateStep() {
    const scoped = Object.fromEntries(Object.entries(allErrors).filter(([key]) => stepKeys.includes(key)));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of stepKeys) delete next[key];
      return { ...next, ...scoped };
    });
    if (!Object.keys(scoped).length) return true;
    setError("Lengkapi data wajib di tahap ini untuk melanjutkan.");
    requestAnimationFrame(() => {
      const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus(); first?.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return false;
  }

  function next() {
    if (locked.current || !validateStep()) return;
    if (step < STEPS.length - 1) { setDir(1); setStep((current) => current + 1); }
  }

  function goTo(target: number) {
    if (locked.current || target < 0 || target >= STEPS.length) return;
    if (target === step) { setError(""); return; }
    if (target <= step) { setDir(-1); setStep(target); setError(""); return; }
    if (target === step + 1 && validateStep()) { setDir(1); setStep(target); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!template || locked.current) return;
    if (step < STEPS.length - 1) { next(); return; }
    const invalid = suratErrors(ID, values);
    setErrors(invalid); setError("");
    if (Object.keys(invalid).length) {
      setError("Periksa data wajib yang ditandai sebelum membuat surat.");
      const first = fields.find((field) => invalid[field.key]);
      if (first) {
        setDir(stepForField(first) < step ? -1 : 1);
        setStep(stepForField(first));
        requestAnimationFrame(() => {
          const target = form.current?.querySelector<HTMLElement>(`[name="${first.key}"]`);
          target?.focus(); target?.scrollIntoView({ block: "center", behavior: "auto" });
        });
      }
      return;
    }

    const current = generation.current;
    locked.current = true; setBusy("generate"); setIsSubmitting(true);
    try {
      await onSubmit({ template, values: { ...values } });
      if (generation.current === current) onClose();
    } catch (cause) {
      if (generation.current === current) {
        setError(cause instanceof Error ? cause.message : "Gagal membuat surat. Silakan coba lagi.");
        requestAnimationFrame(() => errorBox.current?.focus());
      }
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(""); setIsSubmitting(false); }
    }
  }

  if (!open || !template) return null;

  const documentDisabled = !!busy;
  const stepOk = stepKeys.every((key) => !allErrors[key]);
  const anim = dir === 1 ? "akta-slide-r" : "akta-slide-l";
  const applicantFields = visibleFields.filter((field) => field.section === "Data pemohon");
  const powerFields = visibleFields.filter((field) => field.section === "Data kuasa");
  const assetFields = visibleFields.filter((field) => field.section === "Data aset");
  const auctionRecordFields = visibleFields.filter((field) => field.section === "Data risalah lelang");
  const auctionFields = visibleFields.filter((field) => field.section === "Data lelang");

  return (
    <DialogFrame
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) requestClose(); }}
      title={template.title}
      description="Lengkapi identitas pemohon, dokumen lelang, dan data surat dalam empat tahap."
      hideClose={!!busy}
      contentClassName="permohonan-eksekusi-shell"
      overlayClassName="fixed inset-0 bg-black/85 backdrop-blur-xl"
      closeClassName="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-xl border border-white/[0.10] bg-white/[0.06] text-zinc-300 transition-all hover:border-white/[0.18] hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      layer={10000}
    >
      <style>{`
        .permohonan-eksekusi-shell {
          position:fixed; z-index:10001; left:50%; top:auto; bottom:0; transform:translateX(-50%);
          width:100%; height:min(96dvh,900px); max-height:96dvh; display:flex; flex-direction:column; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07); border-radius:26px 26px 0 0;
          background:#07070c; color:#fff; box-shadow:0 48px 140px rgba(0,0,0,0.95); outline:none;
        }
        .permohonan-eksekusi-shell > button svg { width:15px; height:15px }
        @media (min-width:640px) {
          .permohonan-eksekusi-shell { left:50%; top:50%; bottom:auto; transform:translate(-50%,-50%); width:min(896px,calc(100vw - 32px)); border-radius:26px; }
        }
        @keyframes aktaSlideR { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
        @keyframes aktaSlideL { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:none} }
        @keyframes aktaScan { 0%{top:-2px} 100%{top:calc(100% + 2px)} }
        @keyframes aktaOrb { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,-8px)} }
        .akta-slide-r { animation: aktaSlideR .3s cubic-bezier(.22,1,.36,1) both }
        .akta-slide-l { animation: aktaSlideL .3s cubic-bezier(.22,1,.36,1) both }
        .akta-orb { animation-fill-mode: both }
        @media (prefers-reduced-motion: reduce) {
          .akta-slide-r, .akta-slide-l, .akta-orb, .akta-scan { animation: none !important }
        }
      `}</style>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07070c]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <div className="akta-orb pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/[0.06] blur-3xl" style={{ animation: "aktaOrb 11s ease-in-out infinite" }} />
        <div className="akta-orb pointer-events-none absolute -right-28 top-28 h-64 w-64 rounded-full bg-violet-500/[0.05] blur-3xl" style={{ animation: "aktaOrb 14s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />

        <header className="relative shrink-0 px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3.5">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-700/5 ring-1 ring-amber-400/25">
                <Icon icon="solar:document-text-bold-duotone" className="text-[22px] text-amber-300" />
                <div className="absolute inset-0 rounded-2xl bg-amber-400/8 blur-sm" />
              </div>
              <div>
                <h2 className="text-[16px] font-black tracking-tight text-white">{template.title}</h2>
                <p className="text-[11px] text-zinc-500">Litigasi Perdata · Permohonan Pengadilan Negeri · auto-generate PDF</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center">
            {STEPS.map((item, index) => {
              const ac = A[item.accent];
              const done = index < step;
              const active = index === step;
              const reach = index <= step || (index === step + 1 && stepOk);
              return (
                <div key={item.title} className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    onClick={() => reach && goTo(index)}
                    disabled={!reach || documentDisabled}
                    aria-current={active ? "step" : undefined}
                    className={`group flex min-h-11 items-center gap-2 ${reach ? "cursor-pointer" : "cursor-not-allowed"}`}
                  >
                    <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl ring-1 transition-all duration-300 ${done || active ? `${ac.bg} ${ac.ring}` : "bg-white/[0.03] ring-white/[0.06]"}`}>
                      {done
                        ? <Icon icon="solar:check-circle-bold-duotone" className={`text-base ${ac.text}`} />
                        : <Icon icon={item.icon} className={`text-sm ${active ? ac.text : "text-zinc-600"}`} />}
                    </span>
                    <span className="hidden text-left lg:block">
                      <span className={`block text-[11px] font-black leading-none ${active || done ? "text-white" : "text-zinc-600"}`}>{item.title}</span>
                      <span className="mt-0.5 block text-[9.5px] text-zinc-600">{item.sub}</span>
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <span className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500" style={{ width: index < step ? "100%" : "0%" }} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </header>

        <form ref={form} onSubmit={submit} noValidate aria-busy={!!busy} className="relative flex min-h-0 flex-1 flex-col">
          <div ref={body} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div key={step} className={`relative px-6 pb-6 pt-2 ${anim}`}>
              {error && <div ref={errorBox} tabIndex={-1} role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-red-200">
                <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 shrink-0 text-base text-red-400" />
                <p className="text-[13px] leading-relaxed text-red-200">{error}</p>
              </div>}

              <fieldset disabled={!!busy} className="min-w-0 space-y-4">
                {step === 0 && <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Bertindak sebagai</span>
                    {([ ["sendiri", "Pemohon"], ["kuasa", "Kuasa"] ] as const).map(([value, label]) => {
                      const selected = values.bertindakSebagai === value;
                      return <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update("bertindakSebagai", value)}
                        className={`rounded-xl px-4 py-2 text-[12px] font-black ring-1 transition-all duration-200 ${selected ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "bg-white/[0.03] text-zinc-400 ring-white/[0.07] hover:text-white"}`}
                      >{label}</button>;
                    })}
                  </div>

                  <div className={`grid grid-cols-1 gap-4 ${kuasa ? "lg:grid-cols-2" : ""}`}>
                    <PersonPanel
                      accent="cyan"
                      title={kuasa ? "Pihak I — Pemenang Lelang" : "Pemohon"}
                      subtitle={kuasa ? "Calon pembeli / pemenang lelang" : "Bertindak atas nama sendiri"}
                      inputId={INPUT_IDS.pemohon}
                      file={files.pemohon} scanState={scanStates.pemohon} scanMessage={scanMessages.pemohon}
                      warnings={scanWarnings.pemohon ?? []} fields={applicantFields}
                      values={values} errors={errors} disabled={documentDisabled} dragging={dragging === "pemohon"}
                      onChoose={() => fileInputs.current.pemohon?.click()}
                      onFile={(file) => file && saveFile("pemohon", file)}
                      onDrag={(active) => setDragging(active ? "pemohon" : null)} onChange={update}
                    />
                    {kuasa && <PersonPanel
                      accent="amber"
                      title="Penerima Kuasa"
                      subtitle="Orang yang menerima kuasa untuk menandatangani surat"
                      inputId={INPUT_IDS.kuasa}
                      file={files.kuasa} scanState={scanStates.kuasa} scanMessage={scanMessages.kuasa}
                      warnings={scanWarnings.kuasa ?? []} fields={powerFields}
                      values={values} errors={errors} disabled={documentDisabled} dragging={dragging === "kuasa"}
                      onChoose={() => fileInputs.current.kuasa?.click()}
                      onFile={(file) => file && saveFile("kuasa", file)}
                      onDrag={(active) => setDragging(active ? "kuasa" : null)} onChange={update}
                    />}
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 shrink-0 text-base text-amber-400/70" />
                    <p className="text-[11.5px] leading-relaxed text-zinc-400">
                      Upload foto KTP untuk <span className="font-semibold text-white">auto-isi data</span> via OCR. Semua field bisa diedit manual setelah scan.
                    </p>
                  </div>
                </>}

                {step === 1 && <div className="space-y-4">
                  <SectionCard accent="amber" icon="solar:clipboard-text-bold-duotone" title="Kutipan Risalah Lelang" subtitle="Scan otomatis mengisi nomor risalah dan data aset">
                    <div className="space-y-4">
                      <UploadArea
                        inputId={INPUT_IDS.risalah} title="Kutipan Risalah Lelang" helper="PDF · JPG · PNG · maks 20 MB"
                        dropTitle="Tarik & lepas Kutipan Risalah" dropHint="" dropHintLead="atau klik untuk pilih — " dropHintEmphasis="jenis hak, luas, lokasi & tanggal" dropHintTail=" terisi otomatis"
                        file={files.risalah} scanState={scanStates.risalah} scanMessage={scanMessages.risalah} warnings={scanWarnings.risalah ?? []}
                        disabled={documentDisabled} dragging={dragging === "risalah"} accent="amber" kind="document"
                        onChoose={() => fileInputs.current.risalah?.click()}
                        onFile={(file) => file && saveFile("risalah", file)} onDrag={(active) => setDragging(active ? "risalah" : null)}
                      />
                      <FieldsGrid fields={auctionRecordFields} values={values} errors={errors} disabled={documentDisabled} onChange={update} />
                    </div>
                  </SectionCard>
                  <SectionCard accent="violet" icon="solar:home-2-bold-duotone" title="Data Objek Lelang" subtitle="Identitas sertifikat & lokasi — terisi dari scan">
                    <FieldsGrid fields={assetFields} values={values} errors={errors} disabled={documentDisabled} onChange={update} />
                  </SectionCard>
                </div>}

                {step === 2 && <SectionCard accent="violet" icon="solar:bill-list-bold-duotone" title="Kuitansi & Data Lelang" subtitle="Scan kuitansi untuk mengisi nomor dan tanggal bukti pembayaran">
                  <div className="space-y-4">
                    <UploadArea
                      inputId={INPUT_IDS.kuitansi} title="Kuitansi lelang" helper="PDF · JPG · PNG · maks 20 MB"
                      dropTitle="Tarik & lepas Kuitansi Lelang" dropHint="" dropHintLead="atau klik untuk pilih — " dropHintEmphasis="nomor dan tanggal" dropHintTail=" terisi otomatis"
                      file={files.kuitansi} scanState={scanStates.kuitansi} scanMessage={scanMessages.kuitansi} warnings={scanWarnings.kuitansi ?? []}
                      disabled={documentDisabled} dragging={dragging === "kuitansi"} accent="violet" kind="document"
                      onChoose={() => fileInputs.current.kuitansi?.click()}
                      onFile={(file) => file && saveFile("kuitansi", file)} onDrag={(active) => setDragging(active ? "kuitansi" : null)}
                    />
                    <FieldsGrid fields={auctionFields} values={values} errors={errors} disabled={documentDisabled} onChange={update} />
                  </div>
                </SectionCard>}

                {step === 3 && <>
                  <FieldsSection fields={visibleFields} values={values} errors={errors} disabled={documentDisabled} onChange={update} />
                  <button
                    type="submit"
                    disabled={documentDisabled || isSubmitting}
                    className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 py-4 text-[14px] font-black tracking-wide text-black shadow-[0_4px_24px_rgba(251,146,60,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(251,146,60,0.50)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Icon icon="solar:bolt-bold" className="text-base" />Generate Surat
                    </span>
                    <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
                  </button>
                </>}
              </fieldset>
            </div>
          </div>

          {confirmClose ? (
            <footer className="relative shrink-0 border-t border-white/[0.05] bg-[#07070c]/80 px-6 py-4 backdrop-blur-sm">
              <div role="alert" className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-amber-200">Tutup form dan hapus isian yang belum dibuat?</p>
                <div className="flex shrink-0 gap-2">
                  <button ref={keepEditing} type="button" onClick={() => setConfirmClose(false)} className="rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.10]">Lanjut mengisi</button>
                  <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-[11px] font-bold text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/10">Tutup form</button>
                </div>
              </div>
            </footer>
          ) : step < 3 && (
            <footer className="relative shrink-0 border-t border-white/[0.05] bg-[#07070c]/80 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button" onClick={() => goTo(step - 1)} disabled={step === 0 || documentDisabled}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-[12px] font-bold text-zinc-400 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Icon icon="solar:alt-arrow-left-bold" className="text-xs" />Kembali
                </button>
                <div className="flex items-center gap-1.5" aria-label={`Tahap ${step + 1} dari ${STEPS.length}`}>
                  {STEPS.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === step ? "w-6 bg-gradient-to-r from-amber-400 to-orange-400" : index < step ? "w-1.5 bg-amber-500/60" : "w-1.5 bg-white/10"}`} />)}
                </div>
                <button
                  type="button" onClick={next} disabled={!stepOk || documentDisabled}
                  className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[12px] font-black ring-1 transition-all duration-200 ${A.amber.btnBg} ${A.amber.btnHov} ${A.amber.text} ring-amber-500/25 hover:ring-amber-400/35 disabled:cursor-not-allowed disabled:opacity-30`}
                >Lanjut<Icon icon="solar:alt-arrow-right-bold" className="text-xs" /></button>
              </div>
            </footer>
          )}
        </form>

        {busy === "generate" && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#07070c]/95 backdrop-blur-sm">
          <div className="relative grid place-items-center">
            <div className="absolute h-28 w-28 animate-ping rounded-full bg-amber-500/[0.08] motion-reduce:animate-none" />
            <div className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-amber-500/25 to-amber-700/5 ring-1 ring-amber-400/30">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-400 motion-reduce:animate-none" />
              <Icon icon="solar:document-text-bold-duotone" className="text-2xl text-amber-300" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[17px] font-black text-white">Membuat Permohonan…</p>
            <p className="mt-1 text-[12px] text-zinc-500">Menyusun dokumen PDF · jangan tutup halaman ini</p>
          </div>
        </div>}
      </div>

      <div className="hidden" aria-hidden="true">
        {(["pemohon", "kuasa", "risalah", "kuitansi"] as DocumentKey[]).map((key) => {
          const isKtp = key === "pemohon" || key === "kuasa";
          return <input
            key={key}
            ref={(node) => { fileInputs.current[key] = node; }}
            id={INPUT_IDS[key]}
            type="file"
            accept={isKtp ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
            disabled={documentDisabled}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (selected) saveFile(key, selected);
            }}
          />;
        })}
      </div>
    </DialogFrame>
  );
}
