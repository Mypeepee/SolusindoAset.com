import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import CoverImage from "@/components/Blog/CoverImage";
import { getBySlug, getRelated, incrementViews } from "@/lib/berita";
import { renderArticle } from "@/lib/renderArticle";
import { accentFor, formatTanggal } from "@/lib/beritaUi";
import {
  ReadingProgress,
  ShareRail,
  ShareBarMobile,
  TableOfContents,
} from "./ArticleClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getBySlug(decodeURIComponent(params.slug));
  if (!post) return { title: "Artikel tidak ditemukan | Solusindo Aset" };
  return {
    title: `${post.judul} | Solusindo Aset`,
    description: post.ringkasan || undefined,
    openGraph: {
      title: post.judul,
      description: post.ringkasan || undefined,
      type: "article",
      images: post.gambar_utama ? [{ url: post.gambar_utama }] : undefined,
      publishedTime: post.tanggal_publish || undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const post = await getBySlug(slug);
  if (!post || post.status_publish !== "PUBLISHED") notFound();

  const [{ html, toc }, related] = await Promise.all([
    renderArticle(post.isi_berita),
    getRelated(post.slug, post.kategori, 3),
  ]);

  // Count the read (non-blocking failure handled inside).
  await incrementViews(slug);

  const accent = accentFor(post.kategori);
  const publishedLabel = formatTanggal(post.tanggal_publish || post.tanggal_dibuat);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.judul,
    description: post.ringkasan || undefined,
    image: post.gambar_utama ? [post.gambar_utama] : undefined,
    datePublished: post.tanggal_publish || post.tanggal_dibuat,
    dateModified: post.tanggal_diupdate,
    author: { "@type": "Person", name: post.penulis },
    publisher: { "@type": "Organization", name: "Solusindo Aset" },
    articleSection: post.kategori,
  };

  return (
    <main className="relative min-h-screen bg-darkmode text-white">
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(90%_70%_at_50%_-10%,rgba(16,185,129,0.14),transparent_60%)]" />

      {/* HEADER */}
      <header className="relative mx-auto max-w-3xl px-4 pt-20 text-center sm:pt-24 lg:pt-28">
        <div className="mb-5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          <Link href="/blog" className="transition-colors hover:text-emerald-300">
            Blog
          </Link>
          <Icon icon="solar:alt-arrow-right-linear" />
          <span className={accent.text}>{post.kategori}</span>
        </div>

        <h1 className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-[3.25rem]">
          {post.judul}
        </h1>

        {post.ringkasan && (
          <p className="mx-auto mt-5 max-w-2xl text-base text-gray-400 sm:text-lg">
            {post.ringkasan}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-400">
          <span className="flex items-center gap-2 font-bold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/25">
              <Icon icon="solar:user-rounded-bold" className="text-xs text-emerald-400" />
            </span>
            {post.penulis}
          </span>
          <span className="h-1 w-1 rounded-full bg-gray-600" />
          <span>{publishedLabel}</span>
          <span className="h-1 w-1 rounded-full bg-gray-600" />
          <span className="flex items-center gap-1.5">
            <Icon icon="solar:clock-circle-bold" className="text-emerald-400" />
            {post.readMinutes} min baca
          </span>
          {post.views > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-gray-600" />
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:eye-bold" className="text-emerald-400" />
                {post.views.toLocaleString("id-ID")}
              </span>
            </>
          )}
        </div>
      </header>

      {/* COVER */}
      <div className="mx-auto mt-10 max-w-5xl px-4">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[1.5rem] border border-white/10 shadow-2xl sm:aspect-[2/1]">
          <CoverImage
            src={post.gambar_utama}
            alt={post.judul}
            priority
            sizes="(max-width:1024px) 100vw, 1024px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
        {post.sumber_berita && (
          <p className="mt-2.5 text-center text-xs text-gray-600">
            Sumber: {post.sumber_berita}
          </p>
        )}
      </div>

      {/* BODY */}
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* SHARE RAIL */}
          <aside className="hidden lg:col-span-1 lg:block">
            <ShareRail title={post.judul} />
          </aside>

          {/* ARTICLE */}
          <article className="lg:col-span-8">
            <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />

            {/* TAGS */}
            {post.tag.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-2">
                <Icon icon="solar:tag-horizontal-bold" className="text-emerald-400" />
                {post.tag.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-400"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* MOBILE SHARE */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <ShareBarMobile title={post.judul} />
            </div>

            {/* AUTHOR BOX */}
            <div className="mt-12 flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-7 text-center sm:flex-row sm:items-start sm:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-400/25">
                <Icon icon="solar:user-rounded-bold" className="text-3xl text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Ditulis oleh
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-white">{post.penulis}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
                  Redaksi Solusindo Aset — praktisi properti, analis pasar, dan
                  konsultan investasi yang berkomitmen menghadirkan informasi
                  akurat dan terpercaya.
                </p>
              </div>
            </div>
          </article>

          {/* TOC */}
          <aside className="hidden lg:col-span-3 lg:block">
            <TableOfContents items={toc} />
          </aside>
        </div>

        {/* RELATED */}
        {related.length > 0 && (
          <section className="mt-20">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-white">
                <span className="h-5 w-1 rounded-full bg-emerald-400" />
                Artikel Terkait
              </h2>
              <Link
                href="/blog"
                className="flex items-center gap-1.5 text-sm font-bold text-emerald-300 hover:text-emerald-200"
              >
                Semua artikel
                <Icon icon="solar:arrow-right-linear" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {related.map((rp) => {
                const a = accentFor(rp.kategori);
                return (
                  <Link
                    key={rp.id}
                    href={`/blog/${rp.slug}`}
                    className={`group overflow-hidden rounded-2xl border border-white/10 bg-[#101010] transition-all hover:-translate-y-1 ${a.ring}`}
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      <CoverImage
                        src={rp.gambar_utama}
                        alt={rp.judul}
                        sizes="(max-width:640px) 100vw, 33vw"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <span
                        className={`absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ${a.chip}`}
                      >
                        {rp.kategori}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="mb-1.5 text-[11px] text-gray-500">
                        {formatTanggal(rp.tanggal_publish || rp.tanggal_dibuat)}
                      </p>
                      <h4 className="text-sm font-bold leading-snug text-white line-clamp-2 transition-colors group-hover:text-emerald-300">
                        {rp.judul}
                      </h4>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
