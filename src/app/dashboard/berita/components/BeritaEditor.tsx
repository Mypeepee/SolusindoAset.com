"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Loader2,
  Pin,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BeritaDetail } from "@/lib/berita";
import { beritaPermissions } from "@/lib/beritaPermissions";
import {
  BERITA_KATEGORI,
  readingMinutes,
  slugify,
  type BeritaStatus,
} from "@/lib/beritaUi";
import { beritaRequest } from "./workspace";
import MarkdownEditor from "./MarkdownEditor";
import MediaUploader from "./MediaUploader";
import SeoPanel from "./SeoPanel";
import PublishingTimer from "./PublishingTimer";
import styles from "./workspace.module.css";

type EditorForm = {
  judul: string;
  slug: string;
  ringkasan: string;
  isi_berita: string;
  gambar_utama: string;
  kategori: string;
  tag: string;
  penulis: string;
  sumber_berita: string;
  meta_description: string;
  status_publish: BeritaStatus;
  berita_utama: boolean;
  berita_unggulan: boolean;
  tanggal_publish: string;
  requested_publish_at: string;
};
const EMPTY: EditorForm = {
  judul: "",
  slug: "",
  ringkasan: "",
  isi_berita: "",
  gambar_utama: "",
  kategori: BERITA_KATEGORI[0],
  tag: "",
  penulis: "",
  sumber_berita: "",
  meta_description: "",
  status_publish: "DRAFT",
  berita_utama: false,
  berita_unggulan: false,
  tanggal_publish: "",
  requested_publish_at: "",
};

// The publication controls always represent Asia/Jakarta, regardless of the device timezone.
export function toJakartaInput(iso?: string | null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  return new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
}
const fromJakartaInput = (value: string) =>
  value ? new Date(`${value}:00+07:00`).toISOString() : null;

type Props = {
  id?: string;
  embedded?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};
export default function BeritaEditor({
  id,
  embedded = false,
  onSaved,
  onCancel,
  onDirtyChange,
  onSavingChange,
}: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const permissions = beritaPermissions(session?.user?.jabatan);
  const [form, setForm] = useState<EditorForm>(EMPTY);
  const [initial, setInitial] = useState(JSON.stringify(EMPTY));
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [revision, setRevision] = useState(false);
  const [requested, setRequested] = useState(false);
  const [retry, setRetry] = useState(0);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const dirty = JSON.stringify(form) !== initial;
  const words = form.isi_berita.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    onDirtyChange?.(dirty || mediaBusy);
  }, [dirty, mediaBusy, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || mediaBusy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, mediaBusy]);

  useEffect(() => {
    if (!id || sessionStatus !== "authenticated") return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    beritaRequest<{ item: BeritaDetail }>(`/api/berita/admin/${id}`, {
      signal: controller.signal,
    })
      .then(({ item }) => {
        const copy = !permissions.canPublish && item.status_publish !== "DRAFT";
        const next: EditorForm = {
          judul: item.judul,
          slug: copy ? "" : item.slug,
          ringkasan: item.ringkasan || "",
          isi_berita: item.isi_berita,
          gambar_utama: item.gambar_utama || "",
          kategori: item.kategori,
          tag: item.tag.join(", "),
          penulis: item.penulis,
          sumber_berita: item.sumber_berita || "",
          meta_description: item.meta_description || "",
          status_publish: copy ? "DRAFT" : item.status_publish,
          berita_utama: copy ? false : item.berita_utama,
          berita_unggulan: copy ? false : item.berita_unggulan,
          tanggal_publish: toJakartaInput(item.tanggal_publish),
          requested_publish_at: toJakartaInput(item.requested_publish_at),
        };
        setForm(next);
        setInitial(JSON.stringify(next));
        setSlugTouched(!copy);
        setRevision(copy);
        setRequested(!!item.review_requested_at);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, permissions.canPublish, retry, sessionStatus]);

  const update = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "judul" && !slugTouched
        ? { slug: slugify(String(value)) }
        : {}),
    }));
  const cancel = () => {
    if (saving) return;
    if (onCancel) onCancel();
    else if (
      !dirty ||
      window.confirm("Tutup editor? Perubahan yang belum disimpan akan hilang.")
    )
      router.push("/dashboard/berita");
  };

  const save = useCallback(
    async (submitReview = false) => {
      if (saving || mediaBusy) return;
      if (!form.judul.trim() || !form.isi_berita.trim()) {
        toast.error("Judul dan isi artikel wajib diisi.");
        titleRef.current?.focus();
        return;
      }
      const schedule =
        permissions.canPublish && form.status_publish === "SCHEDULED"
          ? form.tanggal_publish
          : submitReview
            ? form.requested_publish_at
            : "";
      if (
        (permissions.canPublish &&
          form.status_publish === "SCHEDULED" &&
          !schedule) ||
        (schedule && Date.parse(`${schedule}:00+07:00`) <= Date.now())
      ) {
        toast.error("Pilih waktu penayangan di masa mendatang (WIB).");
        return;
      }
      setSaving(true);
      onSavingChange?.(true);
      try {
        const payload = {
          ...form,
          slug: slugify(form.slug || form.judul),
          status_publish: permissions.canPublish
            ? form.status_publish
            : "DRAFT",
          berita_utama: permissions.canPublish ? form.berita_utama : undefined,
          berita_unggulan: permissions.canPublish
            ? form.berita_unggulan
            : undefined,
          tanggal_publish:
            permissions.canPublish &&
            ["PUBLISHED", "SCHEDULED"].includes(form.status_publish)
              ? fromJakartaInput(form.tanggal_publish)
              : null,
          submit_review: submitReview,
          requested_publish_at: submitReview
            ? fromJakartaInput(form.requested_publish_at)
            : null,
        };
        await beritaRequest(
          id && !revision ? `/api/berita/admin/${id}` : "/api/berita/admin",
          {
            method: id && !revision ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        setInitial(JSON.stringify(form));
        onDirtyChange?.(false);
        toast.success(
          submitReview
            ? "Artikel diajukan untuk review Owner."
            : revision
              ? "Revisi tersimpan sebagai draf baru."
              : "Artikel berhasil disimpan.",
        );
        if (onSaved) onSaved();
        else {
          router.push("/dashboard/berita");
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan artikel.",
        );
      } finally {
        setSaving(false);
        onSavingChange?.(false);
      }
    },
    [
      form,
      id,
      mediaBusy,
      onDirtyChange,
      onSavingChange,
      onSaved,
      permissions.canPublish,
      revision,
      router,
      saving,
    ],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [save]);

  if (!permissions.canEdit && sessionStatus !== "loading")
    return (
      <div className={styles.accessDenied}>
        <ShieldCheck size={30} />
        <h2>Akses redaksi terbatas</h2>
        <p>Masuk sebagai Admin atau Owner untuk menulis berita.</p>
      </div>
    );
  if (loading || sessionStatus === "loading")
    return (
      <div className={styles.editorLoading} role="status">
        <Loader2 className="animate-spin" size={24} />
        <span>Menyiapkan ruang menulis…</span>
      </div>
    );
  if (loadError)
    return (
      <div className={styles.editorLoading} role="alert">
        <p>{loadError}</p>
        <button
          className={styles.primaryButton}
          onClick={() => setRetry(retry + 1)}
        >
          Coba lagi
        </button>
        <button className={styles.secondaryButton} onClick={cancel}>
          Kembali
        </button>
      </div>
    );

  return (
    <div
      className={`${styles.editorWorkspace} ${!embedded ? styles.standaloneEditor : ""}`}
    >
      <header className={styles.editorHeader}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={cancel}
          aria-label="Tutup editor"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className={styles.eyebrow}>RUANG REDAKSI</span>
          <h2>
            {id
              ? revision
                ? "Revisi artikel"
                : "Edit berita"
              : "Tulis berita"}
          </h2>
        </div>
        <span className={styles.saveState}>
          {dirty ? (
            <>
              <span /> Perubahan belum disimpan
            </>
          ) : (
            <>
              <Check size={13} />
              {id ? "Tersimpan" : "Draf baru"}
            </>
          )}
        </span>
        <div className={styles.editorHeaderActions}>
          <button
            disabled={saving || mediaBusy}
            className={
              permissions.canPublish
                ? styles.primaryButton
                : styles.secondaryButton
            }
            onClick={() => save()}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            <span>
              {permissions.canPublish
                ? form.status_publish === "SCHEDULED"
                  ? "Jadwalkan"
                  : form.status_publish === "PUBLISHED"
                    ? "Simpan & terbitkan"
                    : "Simpan artikel"
                : "Simpan draf"}
            </span>
          </button>
          {!permissions.canPublish && (
            <button
              disabled={saving || mediaBusy}
              className={styles.primaryButton}
              onClick={() => save(true)}
            >
              <Send size={14} />
              <span>Ajukan review</span>
            </button>
          )}
          <button
            disabled={saving}
            className={styles.iconButton}
            onClick={cancel}
            aria-label="Tutup ruang menulis"
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className={styles.editorScroll}>
        <div className={styles.editorColumns}>
          <main className={styles.writingColumn}>
            {revision && (
              <p className={styles.reviewNotice}>
                <ShieldCheck size={16} /> Revisi disimpan sebagai draf baru
                untuk ditinjau Owner. Artikel yang sedang tayang tetap tersedia.
              </p>
            )}
            {requested && (
              <p className={styles.reviewNotice}>
                <Clock3 size={15} /> Artikel ini menunggu review Owner.
              </p>
            )}
            <div className={styles.writingPaper}>
              <div className={styles.writingEyebrow}>
                <FileText size={13} /> ARTIKEL BARU
                <span>{readingMinutes(form.isi_berita)} menit baca</span>
              </div>
              <label className="sr-only" htmlFor="article-title">
                Judul artikel
              </label>
              <textarea
                ref={titleRef}
                id="article-title"
                autoFocus={!id}
                className={styles.titleInput}
                value={form.judul}
                maxLength={255}
                rows={2}
                placeholder="Tuliskan judul yang berarti."
                onChange={(event) => update("judul", event.target.value)}
              />
              <label className="sr-only" htmlFor="article-summary">
                Ringkasan artikel
              </label>
              <textarea
                id="article-summary"
                className={styles.summaryInput}
                value={form.ringkasan}
                maxLength={500}
                rows={3}
                placeholder="Tambahkan ringkasan yang mengundang pembaca untuk tahu lebih jauh…"
                onChange={(event) => update("ringkasan", event.target.value)}
              />
              <MarkdownEditor
                value={form.isi_berita}
                onChange={(value) => update("isi_berita", value)}
              />
            </div>
            <div className={styles.writingFooter}>
              <span>
                {words.toLocaleString("id-ID")} kata ·{" "}
                {readingMinutes(form.isi_berita)} menit baca
              </span>
              <span>Ctrl / ⌘ S untuk menyimpan</span>
            </div>
          </main>
          <aside
            className={styles.editorSidebar}
            aria-label="Pengaturan artikel"
          >
            <section className={styles.editorPanel}>
              <h3>
                <Send size={15} />
                {permissions.canPublish
                  ? "Pengaturan publikasi"
                  : "Pengajuan publikasi"}
                <span className={styles.ownerLabel}>
                  {permissions.canPublish ? "OWNER" : "ADMIN"}
                </span>
              </h3>
              {permissions.canPublish ? (
                <>
                  <label className={styles.fieldLabel}>
                    Status artikel
                    <span className={styles.selectWrap}>
                      <select
                        value={form.status_publish}
                        onChange={(event) =>
                          update(
                            "status_publish",
                            event.target.value as BeritaStatus,
                          )
                        }
                      >
                        <option value="DRAFT">
                          Draf — belum dipublikasikan
                        </option>
                        <option value="PUBLISHED">
                          Terbit — tayang sekarang
                        </option>
                        <option value="SCHEDULED">
                          Terjadwal — atur waktu tayang
                        </option>
                        <option value="ARCHIVED">
                          Arsip — simpan di arsip
                        </option>
                      </select>
                      <ChevronDown size={13} />
                    </span>
                  </label>
                  {form.status_publish === "SCHEDULED" && (
                    <label className={styles.fieldLabel}>
                      Waktu penayangan · WIB
                      <input
                        aria-label="Jadwal publikasi WIB"
                        type="datetime-local"
                        min={toJakartaInput(new Date().toISOString())}
                        value={form.tanggal_publish}
                        onChange={(event) =>
                          update("tanggal_publish", event.target.value)
                        }
                      />
                      <PublishingTimer value={form.tanggal_publish} />
                    </label>
                  )}
                  {requested && form.requested_publish_at && (
                    <button
                      className={styles.useSchedule}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          tanggal_publish: current.requested_publish_at,
                          status_publish: "SCHEDULED",
                        }))
                      }
                    >
                      Gunakan usulan jadwal:{" "}
                      {form.requested_publish_at.replace("T", " ")} WIB
                    </button>
                  )}
                  <div className={styles.editorToggles}>
                    <label>
                      <span>
                        <Pin size={14} /> Jadikan headline
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={form.berita_utama}
                        onChange={(event) =>
                          update("berita_utama", event.target.checked)
                        }
                      />
                    </label>
                    <label>
                      <span>
                        <Sparkles size={14} /> Pilihan redaksi
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={form.berita_unggulan}
                        onChange={(event) =>
                          update("berita_unggulan", event.target.checked)
                        }
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.panelHint}>
                    Simpan draf kapan saja. Owner meninjau dan menyetujui
                    publikasi artikel Anda.
                  </p>
                  <label className={styles.fieldLabel}>
                    Usulan jadwal · WIB (opsional)
                    <input
                      type="datetime-local"
                      value={form.requested_publish_at}
                      min={toJakartaInput(new Date().toISOString())}
                      onChange={(event) =>
                        update("requested_publish_at", event.target.value)
                      }
                    />
                  </label>
                </>
              )}
            </section>
            <section className={styles.editorPanel}>
              <h3>
                <Settings2 size={15} /> Detail artikel
              </h3>
              <label className={styles.fieldLabel}>
                Kategori
                <select
                  value={form.kategori}
                  onChange={(event) => update("kategori", event.target.value)}
                >
                  {BERITA_KATEGORI.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Penulis
                <input
                  value={form.penulis}
                  maxLength={100}
                  placeholder={session?.user?.name || "Tim Redaksi"}
                  onChange={(event) => update("penulis", event.target.value)}
                />
              </label>
              <label className={styles.fieldLabel}>
                Tag & kata kunci
                <input
                  value={form.tag}
                  maxLength={220}
                  placeholder="properti, investasi, lelang"
                  onChange={(event) => update("tag", event.target.value)}
                />
                <small>
                  Pisahkan dengan koma. Tag pertama menjadi kata kunci SEO.
                </small>
              </label>
              <label className={styles.fieldLabel}>
                Sumber (opsional)
                <input
                  value={form.sumber_berita}
                  maxLength={200}
                  placeholder="Nama sumber / referensi"
                  onChange={(event) =>
                    update("sumber_berita", event.target.value)
                  }
                />
              </label>
            </section>
            <section className={styles.editorPanel}>
              <h3>
                <Sparkles size={15} /> Gambar utama
              </h3>
              <MediaUploader
                value={form.gambar_utama}
                onChange={(value) => update("gambar_utama", value)}
                onBusyChange={setMediaBusy}
              />
            </section>
            <SeoPanel
              title={form.judul}
              slug={form.slug}
              description={form.meta_description}
              cover={form.gambar_utama}
              content={form.isi_berita}
              keyword={form.tag.split(",")[0] || ""}
              onSlug={(value) => {
                setSlugTouched(true);
                update("slug", value);
              }}
              onDescription={(value) => update("meta_description", value)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
