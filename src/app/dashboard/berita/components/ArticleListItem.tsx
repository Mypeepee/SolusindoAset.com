"use client";

import { memo } from "react";
import {
  Archive,
  ArrowUpRight,
  Clock3,
  Eye,
  FileText,
  Pencil,
  Pin,
  Send,
  Trash2,
} from "lucide-react";
import type { BeritaListItem } from "@/lib/berita";
import { accentFor, formatTanggal } from "@/lib/beritaUi";
import {
  ArticleCover,
  ArticlePins,
  SelectionCheckbox,
  StatusBadge,
} from "./ArticleUI";
import styles from "./workspace.module.css";

export type ArticleAction =
  "PUBLISHED" | "DRAFT" | "ARCHIVED" | "DELETE" | "PIN";

export default memo(function ArticleListItem({
  article,
  view,
  selected,
  selectable,
  owner,
  busy,
  onSelect,
  onPreview,
  onEdit,
  onAction,
}: {
  article: BeritaListItem;
  view: "list" | "grid";
  selected: boolean;
  selectable: boolean;
  owner: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onPreview: (item: BeritaListItem) => void;
  onEdit: (item: BeritaListItem) => void;
  onAction: (item: BeritaListItem, action: ArticleAction) => void;
}) {
  return (
    <article
      className={`${styles.article} ${view === "grid" ? styles.articleGrid : ""} ${selected ? styles.articleSelected : ""}`}
    >
      {selectable && (
        <div className={styles.articleSelection}>
          <SelectionCheckbox
            checked={selected}
            onChange={() => onSelect(article.id)}
            label={`Pilih artikel ${article.judul}`}
            disabled={busy}
          />
        </div>
      )}
      <button
        className={styles.coverButton}
        onClick={() => onPreview(article)}
        aria-label={`Pratinjau ${article.judul}`}
      >
        <ArticleCover
          src={article.gambar_utama}
          title={article.judul}
          sizes={view === "grid" ? "(max-width: 640px) 100vw, 33vw" : "144px"}
        />
        <span className={styles.coverPreview}>
          <Eye size={17} />
        </span>
      </button>
      <div className={styles.articleContent}>
        <div className={styles.articleBadges}>
          <StatusBadge article={article} />
          <span
            className={`${styles.category} ${accentFor(article.kategori).text}`}
          >
            {article.kategori}
          </span>
          <ArticlePins article={article} />
        </div>
        <h3>
          <button onClick={() => onEdit(article)}>{article.judul}</button>
        </h3>
        <p className={styles.articleExcerpt}>
          {article.ringkasan ||
            "Ringkasan belum ditambahkan. Buka editor untuk melengkapi artikel."}
        </p>
        <div className={styles.articleMeta}>
          <span className={styles.authorAvatar}>
            {(article.penulis || "R")
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span className={styles.authorName}>{article.penulis}</span>
          <span className={styles.metaDot}>·</span>
          <span>
            <Clock3 size={12} />
            {article.readMinutes} mnt baca
          </span>
          <span className={styles.metaDot}>·</span>
          <time dateTime={article.tanggal_publish || article.tanggal_dibuat}>
            {formatTanggal(article.tanggal_publish || article.tanggal_dibuat)}
          </time>
        </div>
      </div>
      <div className={styles.articleEnd}>
        <span className={styles.articleViews}>
          <Eye size={14} />
          <strong>{article.views.toLocaleString("id-ID")}</strong>
          <span>tayangan</span>
        </span>
        <div
          className={styles.quickActions}
          aria-label={`Aksi untuk ${article.judul}`}
        >
          <button
            type="button"
            title="Pratinjau cepat"
            aria-label={`Pratinjau cepat ${article.judul}`}
            onClick={() => onPreview(article)}
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            title="Edit artikel"
            aria-label={`Edit ${article.judul}`}
            onClick={() => onEdit(article)}
          >
            <Pencil size={14} />
          </button>
          {owner && (
            <>
              <button
                disabled={busy}
                type="button"
                title={
                  article.status_publish === "PUBLISHED"
                    ? "Kembalikan ke draf"
                    : "Terbitkan sekarang"
                }
                aria-label={`${article.status_publish === "PUBLISHED" ? "Jadikan draf" : "Terbitkan"} ${article.judul}`}
                onClick={() =>
                  onAction(
                    article,
                    article.status_publish === "PUBLISHED"
                      ? "DRAFT"
                      : "PUBLISHED",
                  )
                }
              >
                {article.status_publish === "PUBLISHED" ? (
                  <FileText size={14} />
                ) : (
                  <Send size={14} />
                )}
              </button>
              <button
                disabled={busy}
                type="button"
                title={
                  article.berita_utama ? "Lepas headline" : "Jadikan headline"
                }
                aria-label={`${article.berita_utama ? "Lepas" : "Pasang"} headline ${article.judul}`}
                aria-pressed={article.berita_utama}
                onClick={() => onAction(article, "PIN")}
              >
                <Pin size={14} />
              </button>
              <button
                disabled={busy || article.status_publish === "ARCHIVED"}
                type="button"
                title="Arsipkan"
                aria-label={`Arsipkan ${article.judul}`}
                onClick={() => onAction(article, "ARCHIVED")}
              >
                <Archive size={14} />
              </button>
              <button
                disabled={busy}
                type="button"
                className={styles.dangerAction}
                title="Hapus permanen"
                aria-label={`Hapus ${article.judul}`}
                onClick={() => onAction(article, "DELETE")}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {article.status_publish === "SCHEDULED" && (
        <span className={styles.scheduledTime}>
          <Clock3 size={11} />
          {new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }).format(
            new Date(article.tanggal_publish || article.tanggal_dibuat),
          )}{" "}
          WIB
          <ArrowUpRight size={11} />
        </span>
      )}
    </article>
  );
});

export function ArticleSkeleton({ view }: { view: "list" | "grid" }) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.article} ${view === "grid" ? styles.articleGrid : ""} ${styles.articleSkeleton}`}
    >
      <div className={`${styles.skeleton} ${styles.skeletonCover}`} />
      <div className={styles.articleContent}>
        <div className={`${styles.skeleton} mb-3 h-4 w-36`} />
        <div className={`${styles.skeleton} mb-2 h-5 w-4/5`} />
        <div className={`${styles.skeleton} mb-4 h-3 w-3/5`} />
        <div className={`${styles.skeleton} h-4 w-48 max-w-full`} />
      </div>
      <div className={`${styles.skeleton} hidden h-5 w-16 sm:block`} />
    </div>
  );
}
