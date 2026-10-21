"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ArrowUpRight, Clock3, Eye, Pencil } from "lucide-react";
import type { BeritaDetail, BeritaListItem } from "@/lib/berita";
import { formatTanggal } from "@/lib/beritaUi";
import markdownToHtml from "@/utils/markdownToHtml";
import { beritaRequest } from "./workspace";
import { ArticleCover, ArticlePins, StatusBadge } from "./ArticleUI";
import WorkspaceDialog from "./WorkspaceDialog";
import styles from "./workspace.module.css";

export default function QuickPreviewDrawer({
  article,
  onClose,
  onEdit,
}: {
  article: BeritaListItem | null;
  onClose: () => void;
  onEdit: (article: BeritaListItem) => void;
}) {
  const { data, error, isLoading, mutate } = useSWR<{ item: BeritaDetail }>(
    article ? `/api/berita/admin/${article.id}` : null,
    beritaRequest,
  );
  const [html, setHtml] = useState("");
  useEffect(() => {
    let alive = true;
    setHtml("");
    if (data?.item)
      markdownToHtml(data.item.isi_berita).then((value) => {
        if (alive) setHtml(value);
      });
    return () => {
      alive = false;
    };
  }, [data]);
  return (
    <WorkspaceDialog
      open={!!article}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Pratinjau artikel"
      description="Baca dan periksa artikel sebelum publikasi."
      variant="drawer"
    >
      {article && (
        <>
          <div className={styles.drawerHeader}>
            <span className={styles.eyebrow}>
              <Eye size={14} /> PRATINJAU ARTIKEL
            </span>
          </div>
          <div className={styles.previewScroll}>
            <ArticleCover
              src={article.gambar_utama}
              title={article.judul}
              className={styles.previewCover}
              sizes="(max-width: 640px) 100vw, 640px"
            />
            <div className={styles.previewBody}>
              <div className={styles.articleBadges}>
                <StatusBadge article={article} />
                <span className={styles.category}>{article.kategori}</span>
                <ArticlePins article={article} />
              </div>
              <h2>{article.judul}</h2>
              <p className={styles.previewExcerpt}>{article.ringkasan}</p>
              <div className={styles.previewMeta}>
                <span>{article.penulis}</span>
                <span>
                  {formatTanggal(
                    article.tanggal_publish || article.tanggal_dibuat,
                  )}
                </span>
                <span>
                  <Clock3 size={13} /> {article.readMinutes} menit baca
                </span>
              </div>
              {error ? (
                <div className={styles.inlineError}>
                  Konten gagal dimuat.
                  <button onClick={() => mutate()}>Coba lagi</button>
                </div>
              ) : isLoading || !html ? (
                <div className="space-y-3" aria-label="Memuat isi artikel">
                  {[1, 2, 3, 4, 5].map((line) => (
                    <div
                      key={line}
                      className={`${styles.skeleton} h-4 w-full`}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={`${styles.articleBody} article-body`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
              {data?.item.requested_publish_at && (
                <p className={styles.reviewNotice}>
                  Usulan jadwal:{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(data.item.requested_publish_at))}{" "}
                  WIB
                </p>
              )}
            </div>
          </div>
          <div className={styles.drawerFooter}>
            <span className={styles.muted}>
              Hanya Anda yang melihat pratinjau ini.
            </span>
            {article.status_publish === "PUBLISHED" && (
              <a
                href={`/blog/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.iconButton}
                aria-label="Buka artikel publik"
              >
                <ArrowUpRight size={17} />
              </a>
            )}
            <button
              className={styles.primaryButton}
              onClick={() => onEdit(article)}
            >
              <Pencil size={14} /> Edit artikel
            </button>
          </div>
        </>
      )}
    </WorkspaceDialog>
  );
}
