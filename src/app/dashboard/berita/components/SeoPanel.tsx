"use client";

import { Check, Globe2, Search } from "lucide-react";
import { ArticleCover } from "./ArticleUI";
import styles from "./workspace.module.css";

export default function SeoPanel({
  title,
  slug,
  description,
  cover,
  content,
  keyword,
  onSlug,
  onDescription,
}: {
  title: string;
  slug: string;
  description: string;
  cover: string;
  content: string;
  keyword: string;
  onSlug: (value: string) => void;
  onDescription: (value: string) => void;
}) {
  const normalized = content.toLocaleLowerCase("id-ID");
  const phrase = keyword.trim().toLocaleLowerCase("id-ID");
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const occurrences = phrase ? normalized.split(phrase).length - 1 : 0;
  const density = words
    ? ((occurrences * phrase.split(/\s+/).length) / words) * 100
    : 0;
  const checks = [
    {
      label: "Judul 30–60 karakter",
      ok: title.length >= 30 && title.length <= 60,
    },
    {
      label: "Deskripsi 120–160 karakter",
      ok: description.length >= 120 && description.length <= 160,
    },
    { label: "URL singkat dan mudah dibaca", ok: !!slug && slug.length <= 75 },
    { label: "Gambar utama tersedia", ok: !!cover },
  ];
  return (
    <section className={styles.editorPanel}>
      <h3>
        <Search size={15} /> SEO & tampilan sosial
        <span className={styles.seoScore}>
          {checks.filter((check) => check.ok).length}/4
        </span>
      </h3>
      <label className={styles.fieldLabel}>
        Slug artikel
        <span className={styles.slugField}>
          <span>/blog/</span>
          <input
            aria-label="Slug artikel"
            value={slug}
            maxLength={280}
            onChange={(event) => onSlug(event.target.value)}
            placeholder="judul-artikel"
          />
        </span>
      </label>
      <label className={styles.fieldLabel}>
        Meta description
        <span className={styles.fieldCounter}>{description.length}/160</span>
        <textarea
          value={description}
          maxLength={160}
          rows={3}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Deskripsi singkat untuk hasil pencarian dan media sosial…"
        />
      </label>
      <div className={styles.seoChecks}>
        {checks.map((check) => (
          <span
            key={check.label}
            className={check.ok ? styles.checkPassed : ""}
          >
            <Check size={12} />
            {check.label}
          </span>
        ))}
      </div>
      <p className={styles.keywordHint}>
        {phrase ? (
          <>
            Kata kunci “{keyword}”: <strong>{density.toFixed(1)}%</strong> (
            {occurrences} kemunculan). Utamakan keterbacaan.
          </>
        ) : (
          "Tambahkan tag pertama untuk melihat estimasi kepadatan kata kunci."
        )}
      </p>
      <div className={styles.socialPreview}>
        <ArticleCover
          src={cover || null}
          title="Pratinjau OpenGraph"
          sizes="300px"
        />
        <div>
          <span>
            <Globe2 size={10} /> SOLUSINDO ASET · /blog/
            {slug || "judul-artikel"}
          </span>
          <strong>{title || "Judul artikel Anda"}</strong>
          <p>
            {description ||
              "Deskripsi artikel akan tampil di sini saat dibagikan ke media sosial."}
          </p>
        </div>
      </div>
    </section>
  );
}
