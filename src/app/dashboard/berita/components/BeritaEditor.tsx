"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import markdownToHtml from "@/utils/markdownToHtml";
import {
  BERITA_KATEGORI,
  readingMinutes,
  slugify,
} from "@/lib/beritaUi";

type FormState = {
  judul: string;
  slug: string;
  ringkasan: string;
  isi_berita: string;
  gambar_utama: string;
  kategori: string;
  tag: string; // comma separated in UI
  penulis: string;
  sumber_berita: string;
  status_publish: string;
  berita_unggulan: boolean;
  berita_utama: boolean;
  tanggal_publish: string; // datetime-local value
};

const EMPTY: FormState = {
  judul: "",
  slug: "",
  ringkasan: "",
  isi_berita: "",
  gambar_utama: "",
  kategori: BERITA_KATEGORI[0],
  tag: "",
  penulis: "",
  sumber_berita: "",
  status_publish: "DRAFT",
  berita_unggulan: false,
  berita_utama: false,
  tanggal_publish: "",
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draf", icon: "solar:document-linear", hint: "Tersimpan, belum tayang" },
  { value: "PUBLISHED", label: "Terbitkan", icon: "solar:check-circle-bold", hint: "Tayang publik sekarang" },
  { value: "SCHEDULED", label: "Terjadwal", icon: "solar:clock-circle-linear", hint: "Tayang pada tanggal tertentu" },
  { value: "ARCHIVED", label: "Arsip", icon: "solar:archive-linear", hint: "Disembunyikan dari publik" },
];

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BeritaEditor({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState("");
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Load existing record in edit mode.
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/berita/admin/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const { item } = await res.json();
        if (!alive) return;
        setForm({
          judul: item.judul || "",
          slug: item.slug || "",
          ringkasan: item.ringkasan || "",
          isi_berita: item.isi_berita || "",
          gambar_utama: item.gambar_utama || "",
          kategori: item.kategori || BERITA_KATEGORI[0],
          tag: Array.isArray(item.tag) ? item.tag.join(", ") : "",
          penulis: item.penulis || "",
          sumber_berita: item.sumber_berita || "",
          status_publish: item.status_publish || "DRAFT",
          berita_unggulan: !!item.berita_unggulan,
          berita_utama: !!item.berita_utama,
          tanggal_publish: toDatetimeLocal(item.tanggal_publish),
        });
        setSlugTouched(true);
      } catch {
        toast.error("Gagal memuat berita");
        router.push("/dashboard/berita");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isEdit, router]);

  // Auto-slug from title until the user edits the slug manually.
  useEffect(() => {
    if (!slugTouched) set("slug", slugify(form.judul));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.judul, slugTouched]);

  // Render markdown preview.
  useEffect(() => {
    if (tab !== "preview") return;
    let alive = true;
    markdownToHtml(form.isi_berita || "_Belum ada konten._").then((html) => {
      if (alive) setPreviewHtml(html);
    });
    return () => {
      alive = false;
    };
  }, [tab, form.isi_berita]);

  const readMins = useMemo(() => readingMinutes(form.isi_berita), [form.isi_berita]);
  const words = useMemo(
    () => form.isi_berita.trim().split(/\s+/).filter(Boolean).length,
    [form.isi_berita]
  );

  // Markdown toolbar — wraps selection or inserts a snippet.
  const applyMd = useCallback(
    (kind: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      const sel = value.slice(start, end);
      let insert = sel;
      let cursorOffset = 0;

      switch (kind) {
        case "bold":
          insert = `**${sel || "teks tebal"}**`;
          break;
        case "italic":
          insert = `*${sel || "teks miring"}*`;
          break;
        case "h2":
          insert = `\n## ${sel || "Sub Judul"}\n`;
          break;
        case "h3":
          insert = `\n### ${sel || "Sub-sub Judul"}\n`;
          break;
        case "quote":
          insert = `\n> ${sel || "Kutipan penting"}\n`;
          break;
        case "ul":
          insert = `\n- ${sel || "Poin pertama"}\n- Poin kedua\n`;
          break;
        case "ol":
          insert = `\n1. ${sel || "Langkah pertama"}\n2. Langkah kedua\n`;
          break;
        case "link":
          insert = `[${sel || "teks tautan"}](https://)`;
          cursorOffset = insert.length - 1;
          break;
        case "image":
          insert = `![${sel || "deskripsi"}](https://)`;
          cursorOffset = insert.length - 1;
          break;
        case "hr":
          insert = `\n\n---\n\n`;
          break;
        default:
          return;
      }

      const next = value.slice(0, start) + insert + value.slice(end);
      set("isi_berita", next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + (cursorOffset || insert.length);
        ta.setSelectionRange(pos, pos);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/berita/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengunggah");
      set("gambar_utama", data.url);
      toast.success("Gambar diunggah");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.judul.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    if (!form.isi_berita.trim()) {
      toast.error("Isi berita wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tag: form.tag,
        tanggal_publish: form.tanggal_publish
          ? new Date(form.tanggal_publish).toISOString()
          : null,
      };
      const res = await fetch(
        isEdit ? `/api/berita/admin/${id}` : "/api/berita/admin",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      toast.success(isEdit ? "Perubahan disimpan" : "Berita dibuat");
      router.push("/dashboard/berita");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menyimpan berita");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Icon icon="solar:refresh-linear" className="animate-spin text-2xl text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl py-6">
      {/* HEADER BAR */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/berita"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
          >
            <Icon icon="solar:arrow-left-linear" className="text-lg" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              {isEdit ? "Edit Berita" : "Tulis Berita Baru"}
            </h1>
            <p className="text-xs text-slate-500">
              {words} kata • {readMins} menit baca
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {form.slug && (
            <Link
              href={`/blog/${form.slug}`}
              target="_blank"
              className="hidden items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:text-white sm:inline-flex"
            >
              <Icon icon="solar:eye-linear" /> Lihat
            </Link>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-2.5 text-sm font-extrabold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300 active:scale-95 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Icon icon="solar:refresh-linear" className="animate-spin" /> Menyimpan…
              </>
            ) : (
              <>
                <Icon icon="solar:diskette-bold" /> Simpan
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* MAIN COLUMN */}
        <div className="space-y-5 lg:col-span-2">
          {/* Title */}
          <Field>
            <textarea
              value={form.judul}
              onChange={(e) => set("judul", e.target.value)}
              placeholder="Judul berita yang menarik…"
              rows={2}
              className="w-full resize-none bg-transparent text-2xl font-extrabold leading-tight text-white placeholder:text-slate-600 focus:outline-none"
            />
          </Field>

          {/* Excerpt */}
          <Field label="Ringkasan" hint={`${form.ringkasan.length}/500`}>
            <textarea
              value={form.ringkasan}
              onChange={(e) => set("ringkasan", e.target.value.slice(0, 500))}
              placeholder="Ringkasan singkat yang muncul di kartu & hasil pencarian…"
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none"
            />
          </Field>

          {/* Content editor */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0d10]">
            {/* tabs + toolbar */}
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="flex gap-1">
                <TabBtn active={tab === "write"} onClick={() => setTab("write")} icon="solar:pen-2-linear">
                  Tulis
                </TabBtn>
                <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon="solar:eye-linear">
                  Pratinjau
                </TabBtn>
              </div>
              {tab === "write" && (
                <div className="flex flex-wrap items-center gap-0.5">
                  <TbBtn onClick={() => applyMd("bold")} icon="solar:text-bold-bold" title="Tebal" />
                  <TbBtn onClick={() => applyMd("italic")} icon="solar:text-italic-bold" title="Miring" />
                  <Sep />
                  <TbBtn onClick={() => applyMd("h2")} icon="solar:text-field-focus-linear" title="Sub Judul" label="H2" />
                  <TbBtn onClick={() => applyMd("h3")} icon="solar:text-field-linear" title="Sub-sub" label="H3" />
                  <Sep />
                  <TbBtn onClick={() => applyMd("ul")} icon="solar:list-bold" title="Bullet" />
                  <TbBtn onClick={() => applyMd("ol")} icon="solar:list-arrow-down-bold" title="Numbered" />
                  <TbBtn onClick={() => applyMd("quote")} icon="solar:quote-up-bold" title="Kutipan" />
                  <Sep />
                  <TbBtn onClick={() => applyMd("link")} icon="solar:link-bold" title="Tautan" />
                  <TbBtn onClick={() => applyMd("image")} icon="solar:gallery-add-bold" title="Gambar" />
                  <TbBtn onClick={() => applyMd("hr")} icon="solar:minus-square-linear" title="Garis" />
                </div>
              )}
            </div>

            {tab === "write" ? (
              <textarea
                ref={textareaRef}
                value={form.isi_berita}
                onChange={(e) => set("isi_berita", e.target.value)}
                placeholder={"Tulis isi berita di sini (mendukung Markdown)…\n\n## Sub judul\n\nParagraf pembuka yang kuat.\n\n- Poin penting\n- Poin lainnya\n\n> Kutipan menonjol"}
                rows={22}
                className="w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
            ) : (
              <div
                className="article-body min-h-[400px] px-5 py-5"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:markdown-bold" /> Markdown didukung
              </span>
              <span>{words} kata</span>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-5">
          {/* Publish box */}
          <Panel title="Publikasi" icon="solar:rocket-2-bold">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => set("status_publish", s.value)}
                  title={s.hint}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition-all ${
                    form.status_publish === s.value
                      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  <Icon icon={s.icon} className="text-sm" />
                  {s.label}
                </button>
              ))}
            </div>

            {form.status_publish === "SCHEDULED" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Tanggal Tayang
                </label>
                <input
                  type="datetime-local"
                  value={form.tanggal_publish}
                  onChange={(e) => set("tanggal_publish", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-emerald-400/50 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 space-y-2.5 border-t border-white/5 pt-3.5">
              <Toggle
                label="Jadikan Headline"
                hint="Tampil besar di atas blog"
                checked={form.berita_utama}
                onChange={(v) => set("berita_utama", v)}
              />
              <Toggle
                label="Artikel Unggulan"
                hint="Ditandai sebagai pilihan redaksi"
                checked={form.berita_unggulan}
                onChange={(v) => set("berita_unggulan", v)}
              />
            </div>
          </Panel>

          {/* Cover image */}
          <Panel title="Gambar Utama" icon="solar:gallery-bold">
            <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {form.gambar_utama ? (
                <Image
                  src={form.gambar_utama}
                  alt="Cover"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-600">
                  <Icon icon="solar:gallery-broken" className="text-3xl" />
                  <span className="text-[11px]">Belum ada gambar</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Icon icon="solar:refresh-linear" className="animate-spin text-xl text-emerald-400" />
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-60"
              >
                <Icon icon="solar:upload-minimalistic-bold" /> Unggah
              </button>
              {form.gambar_utama && (
                <button
                  onClick={() => set("gambar_utama", "")}
                  className="flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 transition-colors hover:border-rose-400/40 hover:text-rose-300"
                >
                  <Icon icon="solar:trash-bin-trash-linear" />
                </button>
              )}
            </div>
            <input
              value={form.gambar_utama}
              onChange={(e) => set("gambar_utama", e.target.value)}
              placeholder="atau tempel URL gambar…"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
            />
          </Panel>

          {/* Meta */}
          <Panel title="Detail" icon="solar:settings-bold">
            <SideField label="Kategori">
              <select
                value={form.kategori}
                onChange={(e) => set("kategori", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none"
              >
                {BERITA_KATEGORI.map((k) => (
                  <option key={k} value={k} className="bg-[#0a0d10]">
                    {k}
                  </option>
                ))}
              </select>
            </SideField>

            <SideField label="Slug (URL)">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 focus-within:border-emerald-400/50">
                <span className="text-xs text-slate-600">/blog/</span>
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                />
              </div>
            </SideField>

            <SideField label="Penulis">
              <input
                value={form.penulis}
                onChange={(e) => set("penulis", e.target.value)}
                placeholder="Default: nama Anda"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
              />
            </SideField>

            <SideField label="Tag" hint="pisahkan dengan koma">
              <input
                value={form.tag}
                onChange={(e) => set("tag", e.target.value)}
                placeholder="lelang, kpr, investasi"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
              />
            </SideField>

            <SideField label="Sumber (opsional)">
              <input
                value={form.sumber_berita}
                onChange={(e) => set("sumber_berita", e.target.value)}
                placeholder="mis. KPKNL, BPS"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
              />
            </SideField>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ── tiny presentational helpers ─────────────────────────────── */
function Field({
  children,
  label,
  hint,
}: {
  children: React.ReactNode;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0d10] px-4 py-3.5">
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          {hint && <span className="text-[11px] text-slate-600">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0d10] p-4">
      <h3 className="mb-3.5 flex items-center gap-2 text-sm font-bold text-white">
        <Icon icon={icon} className="text-emerald-400" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function SideField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {hint && <span className="font-normal normal-case text-slate-600">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-emerald-400/15 text-emerald-300" : "text-slate-400 hover:text-white"
      }`}
    >
      <Icon icon={icon} /> {children}
    </button>
  );
}

function TbBtn({
  onClick,
  icon,
  title,
  label,
}: {
  onClick: () => void;
  icon: string;
  title: string;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      type="button"
      className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-emerald-300"
    >
      <Icon icon={icon} className="text-base" />
      {label && <span className="text-[10px] font-bold">{label}</span>}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-white/10" />;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-200">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-400" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[1.15rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
