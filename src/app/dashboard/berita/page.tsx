"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Archive,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Globe2,
  Loader2,
  LockKeyhole,
  Newspaper,
  Plus,
  RefreshCw,
  SearchX,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BeritaListItem } from "@/lib/berita";
import {
  beritaPermissions,
  BERITA_STATUS_LABEL,
} from "@/lib/beritaPermissions";
import StatCard from "./components/StatCard";
import FilterBar from "./components/FilterBar";
import ArticleListItem, {
  ArticleSkeleton,
  type ArticleAction,
} from "./components/ArticleListItem";
import { SelectionCheckbox } from "./components/ArticleUI";
import WorkspaceDialog from "./components/WorkspaceDialog";
import { beritaRequest, useBeritaWorkspace } from "./components/workspace";
import styles from "./components/workspace.module.css";

const EditorModal = dynamic(() => import("./components/EditorModal"), {
  ssr: false,
});
const QuickPreviewDrawer = dynamic(
  () => import("./components/QuickPreviewDrawer"),
  { ssr: false },
);
const METRICS = [
  { label: "Total artikel", status: "", icon: Newspaper, tone: "#a6b7ca" },
  { label: "Sudah terbit", status: "PUBLISHED", icon: Globe2, tone: "#6ee7b7" },
  { label: "Dalam draf", status: "DRAFT", icon: FileText, tone: "#a5b4fc" },
  { label: "Terjadwal", status: "SCHEDULED", icon: Clock3, tone: "#fcd68b" },
];
type PendingAction = {
  ids: string[];
  action: Exclude<ArticleAction, "PIN">;
  title?: string;
};

export default function BeritaDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const permissions = beritaPermissions(session?.user?.jabatan);
  const workspace = useBeritaWorkspace(
    sessionStatus === "authenticated" && permissions.canEdit,
  );
  const { data, filters, selected, view } = workspace;
  const [editor, setEditor] = useState<{ id?: string } | null>(null);
  const [preview, setPreview] = useState<BeritaListItem | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const total = Object.values(data?.statusCounts || {}).reduce(
    (sum, count) => sum + (count || 0),
    0,
  );
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== "sort" && !!value,
  );
  const skeletonCount = data?.items.length || 6;

  useEffect(() => {
    if (data && !workspace.refreshing && workspace.page > data.totalPages)
      workspace.changePage(data.totalPages);
  }, [data, workspace.refreshing, workspace.page]); // eslint-disable-line react-hooks/exhaustive-deps

  const editArticle = useCallback((article: BeritaListItem) => {
    setPreview(null);
    setEditor({ id: article.id });
  }, []);
  const onAction = useCallback(
    async (article: BeritaListItem, action: ArticleAction) => {
      if (action !== "PIN") {
        setPending({ ids: [article.id], action, title: article.judul });
        return;
      }
      setBusy(true);
      try {
        await beritaRequest(`/api/berita/admin/${article.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ berita_utama: !article.berita_utama }),
        });
        toast.success(
          article.berita_utama ? "Headline dilepas." : "Headline diperbarui.",
        );
        await workspace.mutate();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memperbarui headline.",
        );
      } finally {
        setBusy(false);
      }
    },
    [workspace.mutate],
  );

  const confirmAction = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result = await beritaRequest<{ count: number }>(
        "/api/berita/admin/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: pending.ids, action: pending.action }),
        },
      );
      toast.success(
        `${result.count} artikel ${pending.action === "DELETE" ? "dihapus" : pending.action === "ARCHIVED" ? "diarsipkan" : pending.action === "PUBLISHED" ? "diterbitkan" : "dikembalikan ke draf"}.`,
      );
      setPending(null);
      workspace.clearSelection();
      await workspace.mutate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Aksi gagal. Silakan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (sessionStatus !== "loading" && !permissions.canEdit)
    return (
      <div className={`${styles.workspace} ${styles.accessDenied}`}>
        <LockKeyhole size={32} />
        <h1>Akses redaksi terbatas</h1>
        <p>Workspace ini tersedia untuk Admin dan Owner.</p>
        <Link href="/dashboard" className={styles.secondaryButton}>
          Kembali ke dashboard <ArrowRight size={14} />
        </Link>
      </div>
    );

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <h1 id="berita-workspace-heading" tabIndex={-1}>
            Kelola Berita<span className={styles.titleDot}>.</span>
          </h1>
          <p>Dari ide menjadi cerita. Kelola setiap tahap publikasi Anda.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.helpButton}
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={15} />
            <span>Panduan redaksi</span>
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setEditor({})}
            disabled={sessionStatus === "loading"}
          >
            <Plus size={17} /> Tulis Berita
            <span className={styles.buttonArrow}>
              <ArrowUpRight size={15} />
            </span>
          </button>
        </div>
      </header>
      <section className={styles.statsGrid} aria-label="Ringkasan artikel">
        {METRICS.map((metric) => (
          <StatCard
            key={metric.status}
            {...metric}
            value={
              metric.status
                ? data?.statusCounts[
                    metric.status as keyof typeof data.statusCounts
                  ] || 0
                : total
            }
            active={filters.status === metric.status && !filters.review}
            onClick={() =>
              workspace.updateFilters({ status: metric.status, review: "" })
            }
            activity={data?.activity || []}
            loading={workspace.loading}
          />
        ))}
      </section>
      <div className={styles.libraryHeader}>
        <div>
          <h2>
            Pustaka artikel
            <span>{data ? total.toLocaleString("id-ID") : "—"}</span>
          </h2>
          <p>Semua cerita Anda, dalam satu ruang kerja.</p>
        </div>
        <div className={styles.libraryMeta}>
          {!!data?.reviewCount && (
            <button
              onClick={() =>
                workspace.updateFilters({ status: "DRAFT", review: "true" })
              }
              className={styles.reviewChip}
            >
              <span />
              {data.reviewCount} menunggu review
              <ArrowRight size={12} />
            </button>
          )}
          <span className={styles.roleChip}>
            <ShieldCheck size={12} />
            {session?.user?.jabatan || "REDAKSI"}
          </span>
          <button
            className={styles.iconButton}
            aria-label="Muat ulang artikel"
            title="Muat ulang artikel"
            disabled={workspace.refreshing}
            onClick={() => workspace.mutate()}
          >
            <RefreshCw
              size={14}
              className={workspace.refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>
      <section
        className={styles.library}
        aria-label="Daftar dan pengaturan artikel"
      >
        <FilterBar
          filters={filters}
          onChange={workspace.updateFilters}
          data={data}
          view={view}
          onView={workspace.changeView}
          reset={workspace.resetFilters}
        />
        <div className={styles.listHeading}>
          <div>
            {permissions.canPublish && (
              <SelectionCheckbox
                label="Pilih semua artikel di halaman ini"
                checked={workspace.allSelected}
                mixed={selected.size > 0 && !workspace.allSelected}
                onChange={workspace.toggleAll}
                disabled={
                  workspace.loading ||
                  workspace.refreshing ||
                  busy ||
                  !data?.items.length
                }
              />
            )}
            <span>
              {selected.size ? `${selected.size} artikel dipilih` : "ARTIKEL"}
            </span>
          </div>
          <span className={styles.resultCount} role="status" aria-live="polite">
            {workspace.loading
              ? "Memuat artikel…"
              : workspace.refreshing
                ? "Memperbarui…"
                : `${data?.total || 0} artikel ditemukan`}
          </span>
          <div className={styles.sortControl}>
            <ArrowDownUp size={12} />
            <select
              value={filters.sort}
              aria-label="Urutkan artikel"
              onChange={(event) =>
                workspace.updateFilters({ sort: event.target.value })
              }
            >
              <option value="newest">Terakhir diperbarui</option>
              <option value="oldest">Paling awal dibuat</option>
              <option value="views">Paling banyak dibaca</option>
            </select>
          </div>
        </div>
        <div
          id="berita-results"
          role="tabpanel"
          aria-labelledby={`berita-tab-${filters.status || "all"}`}
          aria-busy={workspace.loading || workspace.refreshing}
          className={`${styles.results} ${view === "grid" ? styles.gridResults : ""} ${workspace.refreshing && data ? styles.refreshing : ""}`}
        >
          {workspace.error ? (
            <div className={styles.emptyState} role="alert">
              <span className={styles.emptyIcon}>
                <RefreshCw size={25} />
              </span>
              <h3>Artikel belum berhasil dimuat.</h3>
              <p>{workspace.error.message}</p>
              <button
                className={styles.secondaryButton}
                onClick={() => workspace.mutate()}
              >
                <RefreshCw size={14} /> Coba lagi
              </button>
            </div>
          ) : workspace.loading ? (
            Array.from({ length: skeletonCount }, (_, index) => (
              <ArticleSkeleton key={index} view={view} />
            ))
          ) : !data?.items.length ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                {hasFilters ? <SearchX size={29} /> : <BookOpen size={29} />}
              </span>
              <span className={styles.eyebrow}>
                {hasFilters ? "COBA SUDUT PANDANG LAIN" : "CERITA PERTAMA ANDA"}
              </span>
              <h3>
                {hasFilters
                  ? "Belum ada artikel yang cocok."
                  : "Ruang untuk cerita selanjutnya."}
              </h3>
              <p>
                {hasFilters
                  ? "Sesuaikan kata kunci atau filter untuk menemukan artikel Anda."
                  : "Bagikan wawasan, kabar terbaru, dan ide yang layak dibaca."}
              </p>
              <button
                className={styles.primaryButton}
                onClick={
                  hasFilters ? workspace.resetFilters : () => setEditor({})
                }
              >
                {hasFilters ? (
                  <>
                    <X size={14} /> Hapus filter
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Tulis berita pertama
                  </>
                )}
              </button>
            </div>
          ) : (
            data.items.map((article) => (
              <ArticleListItem
                key={article.id}
                article={article}
                view={view}
                selected={selected.has(article.id)}
                selectable={permissions.canPublish}
                owner={permissions.canPublish}
                busy={busy || workspace.refreshing}
                onSelect={workspace.toggle}
                onPreview={setPreview}
                onEdit={editArticle}
                onAction={onAction}
              />
            ))
          )}
        </div>
        <footer className={styles.pagination}>
          <span>
            {data?.total ? (
              <>
                Menampilkan{" "}
                <strong>
                  {(workspace.page - 1) * data.pageSize + 1}–
                  {Math.min(workspace.page * data.pageSize, data.total)}
                </strong>{" "}
                dari <strong>{data.total}</strong> artikel
              </>
            ) : (
              "Belum ada artikel untuk ditampilkan"
            )}
          </span>
          <div>
            <button
              type="button"
              disabled={workspace.page <= 1 || workspace.refreshing}
              onClick={() => workspace.changePage(workspace.page - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              Halaman <strong>{workspace.page}</strong> /{" "}
              {data?.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={
                workspace.page >= (data?.totalPages || 1) ||
                workspace.refreshing
              }
              onClick={() => workspace.changePage(workspace.page + 1)}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </section>
      <footer className={styles.workspaceFooter}>
        <span>
          <ShieldCheck size={13} />
          {permissions.canPublish
            ? "Anda memegang kendali penuh atas publikasi."
            : "Artikel Anda ditinjau Owner sebelum dipublikasikan."}
        </span>
        {permissions.canAssignRoles && (
          <Link href="/dashboard/human-resource-management">
            <Users size={13} /> Kelola tim & peran <ArrowUpRight size={12} />
          </Link>
        )}
      </footer>
      {selected.size > 0 && permissions.canPublish && (
        <div
          className={styles.bulkBar}
          role="region"
          aria-label="Aksi massal artikel"
        >
          <span className={styles.bulkSelected}>
            <span>
              <Check size={13} />
            </span>
            {selected.size} artikel dipilih
          </span>
          <div className={styles.bulkActions}>
            <button
              disabled={busy || workspace.refreshing}
              onClick={() =>
                setPending({ ids: [...selected], action: "PUBLISHED" })
              }
            >
              <Send size={14} />
              <span>Terbitkan</span>
            </button>
            <button
              disabled={busy || workspace.refreshing}
              onClick={() =>
                setPending({ ids: [...selected], action: "DRAFT" })
              }
            >
              <FileText size={14} />
              <span>Jadikan draf</span>
            </button>
            <button
              disabled={busy || workspace.refreshing}
              onClick={() =>
                setPending({ ids: [...selected], action: "ARCHIVED" })
              }
            >
              <Archive size={14} />
              <span>Arsipkan</span>
            </button>
            <button
              disabled={busy || workspace.refreshing}
              className={styles.dangerAction}
              onClick={() =>
                setPending({ ids: [...selected], action: "DELETE" })
              }
            >
              <Trash2 size={14} />
              <span>Hapus</span>
            </button>
          </div>
          <button
            className={styles.iconButton}
            onClick={workspace.clearSelection}
            aria-label="Batalkan pilihan artikel"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <QuickPreviewDrawer
        article={preview}
        onClose={() => setPreview(null)}
        onEdit={editArticle}
      />
      {editor && (
        <EditorModal
          target={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            workspace.mutate();
          }}
        />
      )}
      <WorkspaceDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
        title={
          pending?.action === "DELETE"
            ? "Hapus artikel permanen?"
            : "Konfirmasi perubahan artikel"
        }
        description="Periksa perubahan yang akan diterapkan pada artikel terpilih."
        hideClose={busy}
      >
        <div className={styles.confirmBody}>
          <span
            className={`${styles.confirmIcon} ${pending?.action === "DELETE" ? styles.confirmDanger : ""}`}
          >
            {pending?.action === "DELETE" ? (
              <Trash2 size={25} />
            ) : pending?.action === "ARCHIVED" ? (
              <Archive size={25} />
            ) : (
              <Send size={25} />
            )}
          </span>
          <h2>
            {pending?.action === "DELETE"
              ? "Hapus cerita ini?"
              : pending?.action === "PUBLISHED"
                ? "Siap untuk dibaca dunia?"
                : pending?.action === "ARCHIVED"
                  ? "Pindahkan ke arsip?"
                  : "Kembalikan ke draf?"}
          </h2>
          <p>
            {pending?.title
              ? `“${pending.title}”`
              : `${pending?.ids.length || 0} artikel terpilih`}
            {pending?.action === "DELETE"
              ? " akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
              : pending?.action === "PUBLISHED"
                ? " akan langsung tersedia untuk publik."
                : " akan disembunyikan dari halaman publik."}
          </p>
          <div className={styles.confirmButtons}>
            <button
              disabled={busy}
              className={styles.secondaryButton}
              onClick={() => setPending(null)}
            >
              Batal
            </button>
            <button
              disabled={busy}
              className={
                pending?.action === "DELETE"
                  ? styles.dangerButton
                  : styles.primaryButton
              }
              onClick={confirmAction}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {pending?.action === "DELETE"
                ? "Hapus permanen"
                : pending?.action === "PUBLISHED"
                  ? "Terbitkan sekarang"
                  : pending?.action === "ARCHIVED"
                    ? "Arsipkan artikel"
                    : `Simpan sebagai ${BERITA_STATUS_LABEL.DRAFT.toLowerCase()}`}
            </button>
          </div>
        </div>
      </WorkspaceDialog>
      <WorkspaceDialog
        open={help}
        onOpenChange={setHelp}
        title="Panduan ruang redaksi"
        description="Cara menulis, meninjau, dan menerbitkan artikel."
      >
        <div className={styles.helpBody}>
          <span className={styles.eyebrow}>ALUR KERJA REDAKSI</span>
          <h2>Cerita bagus. Alur yang jelas.</h2>
          <p>
            Ruang bersama untuk menyusun dan menerbitkan wawasan Solusindo Aset.
          </p>
          {[
            {
              icon: FileText,
              title: "01 · Tulis & sempurnakan",
              text: "Buat draf, tambahkan gambar, dan periksa SEO. Gunakan Ctrl / ⌘ S untuk menyimpan.",
            },
            {
              icon: ShieldCheck,
              title: "02 · Tinjau bersama",
              text: "Admin mengajukan draf dan usulan jadwal. Owner memeriksa artikel melalui pratinjau cepat.",
            },
            {
              icon: Send,
              title: "03 · Terbitkan dengan kendali",
              text: "Owner menerbitkan, menjadwalkan, memilih headline, dan mengelola arsip. Pilih beberapa artikel untuk aksi massal.",
            },
          ].map((step) => (
            <div key={step.title}>
              <span>
                <step.icon size={17} />
              </span>
              <section>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </section>
            </div>
          ))}
          <button
            className={styles.primaryButton}
            onClick={() => setHelp(false)}
          >
            Mulai berkarya <ArrowRight size={14} />
          </button>
        </div>
      </WorkspaceDialog>
    </div>
  );
}
