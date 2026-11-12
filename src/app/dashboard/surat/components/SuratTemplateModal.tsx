"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, ScanLine } from "lucide-react";
import { DialogFrame } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ocrKTP } from "@/lib/ocrKtp";
import { ocrRisalah } from "@/lib/ocrRisalah";
import { ktpSuratPatch, suratErrors, suratFields, tanggalWib, type SuratValues } from "@/lib/suratGeneration";
import { PermohonanEksekusiModal } from "./PermohonanEksekusiModal";
import type { SuratTemplate } from "./data";

type Props = {
  open: boolean;
  template: SuratTemplate | null;
  onClose: () => void;
  onSubmit: (payload: { template: SuratTemplate; values: SuratValues }) => Promise<void> | void;
};

const action = "min-h-11 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50";

export function SuratTemplateModal(props: Props) {
  if (props.template?.id === "permohonan-eksekusi-pn") return <PermohonanEksekusiModal {...props} />;
  return <GenericSuratTemplateModal {...props} />;
}

function GenericSuratTemplateModal({ open, template, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<SuratValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    generation.current++;
    locked.current = false;
    setValues({ tanggal_surat: tanggalWib(), bertindakSebagai: "sendiri" });
    setErrors({}); setError(""); setScanStatus(""); setBusy("");
    setFileNames({});
    setDirty(false); setConfirmClose(false);
    return () => { generation.current++; };
  }, [open, template?.id]);

  useEffect(() => {
    if (!open || !dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [open, dirty]);

  useEffect(() => { if (confirmClose) keepEditing.current?.focus(); }, [confirmClose]);

  const fields = useMemo(() => suratFields(template?.id ?? "", values), [template?.id, values]);
  const sections = [...new Set(fields.map(field => field.section))];
  const isMou = template?.id === "mou-transaksi";
  const isGrosse = template?.id === "permohonan-akte-grosse";

  function update(key: string, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    setDirty(true);
  }

  function requestClose() {
    if (locked.current) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  async function scan(file: File | undefined, pihak: string) {
    if (!file || locked.current) return;
    const risalah = pihak === "risalah";
    if (file.size > 10 * 1024 * 1024) { setError("Ukuran file maksimal 10 MB."); return; }
    const types = ["image/jpeg", "image/png", "image/webp", ...(risalah ? ["application/pdf"] : [])];
    if (!types.includes(file.type)) { setError(risalah ? "Gunakan JPG, PNG, WebP, atau PDF." : "Gunakan foto KTP JPG, PNG, atau WebP."); return; }
    const current = generation.current;
    locked.current = true;
    setFileNames(previous => ({ ...previous, [pihak]: file.name }));
    setBusy(pihak); setError(""); setScanStatus("");
    try {
      const result = risalah ? await ocrRisalah(file) : await ocrKTP(file);
      if (generation.current !== current) return;
      const parsed = result.parsed ?? {};
      const patch: SuratValues = risalah
        ? Object.fromEntries(Object.entries({
            nomor_risalah: parsed.nomor_risalah, tanggal_risalah: parsed.tanggal_risalah,
            pejabat_lelang: parsed.pejabat_lelang, pukul_lelang: parsed.pukul,
            nip_pejabat: parsed.nip, kantor_lelang: parsed.kantor_lelang, objek: parsed.objek,
          }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1].trim()))
        : ktpSuratPatch(parsed, pihak);
      setValues(previous => ({ ...previous, ...patch }));
      setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !(key in patch))));
      setDirty(true);
      setScanStatus(Object.keys(patch).length
        ? "Hasil scan terisi. Periksa dan lengkapi kembali semua data sebelum membuat surat."
        : "Data belum terbaca. Coba foto yang lebih jelas atau isi kolom secara manual.");
    } catch (cause) {
      if (generation.current === current)
        setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Scan belum selesai. Coba lagi atau isi data secara manual.");
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(""); }
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!template || locked.current) return;
    const invalid = suratErrors(template.id, values);
    setErrors(invalid); setError("");
    if (Object.keys(invalid).length) {
      setError("Periksa data wajib yang ditandai. Isian Anda tetap tersimpan di form.");
      requestAnimationFrame(() => {
        const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.focus(); first?.scrollIntoView({ block: "center", behavior: "auto" });
      });
      return;
    }
    const current = generation.current;
    locked.current = true; setBusy("generate");
    try {
      await onSubmit({ template, values: { ...values } });
    } catch (cause) {
      if (generation.current === current) {
        setError(cause instanceof Error ? cause.message : "Gagal membuat surat. Silakan coba lagi.");
        requestAnimationFrame(() => errorBox.current?.focus());
      }
    } finally {
      if (generation.current === current) { locked.current = false; setBusy(""); }
    }
  }

  if (!open || !template) return null;

  return (
    <DialogFrame open={open} onOpenChange={next => { if (!next) requestClose(); }}
      title={template.title} description="Lengkapi data surat, periksa hasil scan, lalu unduh PDF."
      hideClose={!!busy} contentStyle={{ maxWidth: 720 }} layer={10000}>
      <div className="shrink-0 border-b border-white/10 px-5 py-5 pr-16">
        <h2 className="flex items-center gap-2 text-base font-bold"><FileText size={18} className="text-emerald-300" />{template.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {isMou ? "Masukkan ID atau kode MOU dari Transaksi. Skema komisi dan nilai biaya mengikuti data MOU yang tersimpan. Identitas kosong menggunakan data MOU."
            : isGrosse ? "Isi data secara manual atau gunakan scan untuk membantu pengisian. Kolom bertanda * wajib diisi."
            : "Isi data yang diperlukan sesuai template surat. Kolom bertanda * wajib diisi."}
        </p>
      </div>
      <form ref={form} noValidate onSubmit={submit} aria-busy={!!busy} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <fieldset disabled={!!busy} className="min-w-0 space-y-6">
            {isGrosse && <div>
              <p className="mb-2 text-sm font-semibold">Bertindak sebagai</p>
              <div className="flex flex-wrap gap-2">
                {([['sendiri', 'Atas nama sendiri'], ['kuasa', 'Menggunakan kuasa']] as const).map(([value, label]) =>
                  <button key={value} type="button" aria-pressed={values.bertindakSebagai === value}
                    className={`${action} ${values.bertindakSebagai === value ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
                    onClick={() => update("bertindakSebagai", value)}>{label}</button>)}
              </div>
            </div>}
            {!isMou && <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><ScanLine size={16} />Scan dokumen (opsional)</p>
              {[
                ["pemohon", "KTP pemohon"],
                ...(isGrosse ? values.bertindakSebagai === "kuasa" ? [["kuasa", "KTP penerima kuasa"]] : [] : [["debitur", "KTP debitur"]]),
                ["risalah", "Risalah lelang"],
              ].map(([pihak, label]) => <div key={pihak}>
                <label htmlFor={`scan-${pihak}`} className="mb-1 block text-xs text-slate-300">{label}</label>
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" className={`${action} shrink-0 bg-slate-800 text-slate-100 hover:bg-slate-700`}
                    aria-label={`Pilih file ${label}`} onClick={() => document.getElementById(`scan-${pihak}`)?.click()}>Pilih file</button>
                  <span className="truncate text-xs text-slate-400">{fileNames[pihak] || "Belum ada file"}</span>
                </div>
                <input id={`scan-${pihak}`} type="file" className="hidden"
                  accept={`image/jpeg,image/png,image/webp${pihak === "risalah" ? ",application/pdf" : ""}`}
                  onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void scan(file, pihak); }} />
              </div>)}
              <p className="text-xs text-slate-400">JPG, PNG, WebP; risalah juga menerima PDF. Maksimal 10 MB per file.</p>
              {scanStatus && <p role="status" className="text-xs text-amber-200">{scanStatus}</p>}
            </div>}
            {sections.map(section => <section key={section} aria-label={section}>
              <h3 className="mb-3 text-sm font-bold text-emerald-200">{section}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fields.filter(field => field.section === section).map(field => {
                  const id = `surat-${field.key}`;
                  const common = {
                    id, name: field.key, value: values[field.key] ?? "", required: field.required,
                    placeholder: field.placeholder, "aria-invalid": !!errors[field.key],
                    "aria-describedby": errors[field.key] ? `${id}-error` : undefined,
                    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(field.key, event.target.value),
                  };
                  return <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : "min-w-0"}>
                    <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-300">{field.label}{field.required && " *"}</label>
                    {field.type === "textarea" ? <Textarea {...common} rows={3} className="min-h-[88px] resize-none" />
                      : <Input {...common} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          min={field.type === "number" ? "0" : undefined} step={field.type === "number" ? "any" : undefined}
                          inputMode={field.key.startsWith("nik_") ? "numeric" : undefined} />}
                    {errors[field.key] && <p id={`${id}-error`} className="mt-1 text-xs text-rose-300">{errors[field.key]}</p>}
                  </div>;
                })}
              </div>
            </section>)}
          </fieldset>
        </div>
        <div className="shrink-0 space-y-3 border-t border-white/10 bg-slate-950/50 px-5 py-4">
          {error && <div ref={errorBox} tabIndex={-1} role="alert" className="flex gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200 outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><p>{error}</p>
          </div>}
          {confirmClose ? <div role="alert" className="space-y-2">
            <p className="text-sm text-amber-200">Tutup form dan hapus isian yang belum dibuat?</p>
            <div className="flex justify-end gap-2">
              <button ref={keepEditing} type="button" className={`${action} bg-slate-800 hover:bg-slate-700`} onClick={() => setConfirmClose(false)}>Lanjut mengisi</button>
              <button type="button" className={`${action} text-rose-200 hover:bg-rose-400/10`} onClick={onClose}>Tutup form</button>
            </div>
          </div> : <div className="flex flex-wrap items-center justify-end gap-2">
            {busy && <span role="status" className="mr-auto flex items-center gap-2 text-xs text-emerald-200"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" />{busy === "generate" ? "Membuat PDF…" : "Membaca dokumen…"}</span>}
            <button type="button" disabled={!!busy} onClick={requestClose} className={`${action} text-slate-300 hover:bg-slate-800`}>Batal</button>
            <button type="submit" disabled={!!busy} className={`${action} min-w-[164px] bg-emerald-400 text-slate-950 hover:bg-emerald-300`}>Generate Surat</button>
          </div>}
        </div>
      </form>
    </DialogFrame>
  );
}
