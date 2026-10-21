"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Pin, Star } from "lucide-react";
import type { BeritaListItem } from "@/lib/berita";
import { BERITA_STATUS_LABEL } from "@/lib/beritaPermissions";
import styles from "./workspace.module.css";

export function StatusBadge({
  article,
}: {
  article: Pick<BeritaListItem, "status_publish" | "review_requested_at">;
}) {
  const review =
    article.status_publish === "DRAFT" && article.review_requested_at;
  return (
    <span
      className={`${styles.badge} ${styles[review ? "REVIEW" : article.status_publish]}`}
    >
      <span className={styles.statusDot} />
      {review ? "Menunggu review" : BERITA_STATUS_LABEL[article.status_publish]}
    </span>
  );
}

export const ArticleCover = memo(function ArticleCover({
  src,
  title,
  className = "",
  sizes = "160px",
}: {
  src: string | null;
  title: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  let validSource = !!src && /^\/(?!\/)/.test(src);
  if (src && !validSource) {
    try {
      validSource = ["http:", "https:"].includes(new URL(src).protocol);
    } catch {
      /* Incomplete URLs show the placeholder while the user types. */
    }
  }
  return (
    <div className={`${styles.cover} ${className}`}>
      {src && validSource && !failed ? (
        <Image
          src={src}
          alt={title}
          fill
          sizes={sizes}
          unoptimized
          loading="lazy"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.coverFallback}>
          <ImageIcon size={25} strokeWidth={1.3} />
          <span>Solusindo editorial</span>
        </div>
      )}
    </div>
  );
});

export function ArticlePins({
  article,
}: {
  article: Pick<BeritaListItem, "berita_utama" | "berita_unggulan">;
}) {
  return (
    <>
      {article.berita_utama && (
        <span className={styles.pin}>
          <Pin size={11} /> Headline
        </span>
      )}
      {article.berita_unggulan && (
        <span className={styles.featured}>
          <Star size={11} /> Pilihan redaksi
        </span>
      )}
    </>
  );
}

export function SelectionCheckbox({
  checked,
  mixed = false,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.checkbox}
      checked={checked}
      onChange={onChange}
      aria-label={label}
      disabled={disabled}
    />
  );
}
