"use client";

import { Fragment, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import SearchSelect from "@/components/search/SearchSelect";
import { errorLabels } from "@/lib/marketing/domain";
import { metricValue, rankPosts, responseRate, segmentLabel, type AnalyticsDimension, type AnalyticsMetric, type AnalyticsPost } from "@/lib/marketing/analytics";
import { Action, date, imageUrl } from "./ui";
import { AnalyticsEmpty, AnalyticsPanel, AnalyticsTag, analyticNumber, metricLabel } from "./AnalyticsPrimitives";
import { Chart, Search, Close, Layers, RefreshCw, ExternalLink, MessageCircle, ChevronLeft, ChevronRight, ImageIcon, ArrowDown } from "./MarketingIcons";

export type AnalyticsFilters = { query: string; sort: AnalyticsMetric | "response"; dimension: AnalyticsDimension; segment: string; page: number };
export const defaultAnalyticsFilters: AnalyticsFilters = { query: "", sort: "views", dimension: "type", segment: "", page: 1 };
export function filteredPosts(posts: AnalyticsPost[], filters: AnalyticsFilters) {
  const query = filters.query.trim().toLocaleLowerCase("id-ID");
  return rankPosts(posts.filter((post) => (!filters.segment || segmentLabel(post, filters.dimension).toLocaleLowerCase("id-ID") === filters.segment.toLocaleLowerCase("id-ID")) &&
    (!query || [post.asset.address, post.asset.title, post.asset.city, post.asset.propertyType].filter(Boolean).join(" ").toLocaleLowerCase("id-ID").includes(query))), filters.sort);
}
function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return '"' + (/^[\s]*[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
}
export function exportAnalyticsCsv(posts: AnalyticsPost[], month: string, whatsapp: boolean) {
  const headers = ["Tanggal terbit (WIB)", "Jenis", "Lokasi", "Alamat", "Harga", "Luas tanah", metricLabel("views", whatsapp), metricLabel("likes", whatsapp), metricLabel("comments", whatsapp), "Jangkauan", "Disimpan", "Dibagikan", "Respons (%)", "Sinkronisasi terakhir", "Status"];
  const rows = posts.map((post) => [new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }).format(new Date(post.publishedAt)), post.asset.propertyType, post.asset.city, post.asset.address,
    post.asset.price, post.asset.landArea, metricValue(post, "views"), metricValue(post, "likes"), metricValue(post, "comments"), post.values.reach, post.values.saved, post.values.shares, responseRate(post), post.lastSyncedAt,
    post.errorCode === "MEDIA_DELETED" ? "Dihapus (riwayat)" : post.metricReason ? errorLabels[post.metricReason] || "Metrik sebagian belum tersedia" : "Terbit"]);
  const blob = new Blob(["\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `analitik-${whatsapp ? "whatsapp" : "instagram"}-${month}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnalyticsPosts({ posts, whatsapp, month, filters, onFilters, editable, onSync, onComments, inspectedId, onInspected }: {
  posts: AnalyticsPost[]; whatsapp: boolean; month: string; filters: AnalyticsFilters; onFilters: (patch: Partial<AnalyticsFilters>) => void;
  editable: boolean; onSync: (id: string) => void; onComments: (publication: { id: string }) => void;
  inspectedId: string | null; onInspected: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = filteredPosts(posts, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(pages, Math.max(1, filters.page));
  const types = [...new Set(posts.map((post) => segmentLabel(post, "type")))].sort((a, b) => a.localeCompare(b, "id-ID"));
  useEffect(() => {
    if (!inspectedId) return;
    setExpanded(inspectedId);
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`analytics-post-${inspectedId}`);
      target?.scrollIntoView({ block: "nearest", behavior: "auto" });
      target?.querySelector<HTMLButtonElement>(".analytics-post-toggle")?.focus({ preventScroll: true });
      onInspected();
    });
    return () => cancelAnimationFrame(frame);
  }, [inspectedId, onInspected]);
  return <AnalyticsPanel className="analytics-posts" label="Performa per posting">
    <div className="analytics-section-heading"><div><span className="analytics-eyebrow">Dari angka ke konten</span><h3>Performa per posting</h3><p className="analytics-panel-description">Temukan konten dengan views, like, atau percakapan terbanyak.</p></div>
      <Action className="analytics-export" disabled={!filtered.length} onClick={() => exportAnalyticsCsv(filtered, month, whatsapp)}><ArrowDown size={15} />Ekspor CSV</Action></div>
    <div className="analytics-post-filters">
      <div className="analytics-search"><Search size={16} /><Input type="search" aria-label="Cari posting" placeholder="Cari properti atau lokasi…" maxLength={100} value={filters.query} onChange={(event) => onFilters({ query: event.target.value, page: 1 })} />
        {filters.query && <button type="button" aria-label="Hapus pencarian posting" onClick={() => onFilters({ query: "", page: 1 })}><Close size={15} /></button>}</div>
      <SearchSelect label="Filter jenis properti" compact value={filters.dimension === "type" && filters.segment ? filters.segment : "all"}
        options={[{ value: "all", label: "Semua jenis" }, ...types.map((type) => ({ value: type, label: type }))]} icon={<Layers size={15} />} open={typeOpen} onOpenChange={setTypeOpen}
        onChange={(value) => onFilters({ dimension: "type", segment: value === "all" ? "" : value, page: 1 })} triggerClassName="analytics-select" contentClassName="analytics-select-popup" />
      <SearchSelect label="Urutkan performa posting" compact value={filters.sort} options={[
        { value: "views", label: "Views tertinggi" }, { value: "likes", label: whatsapp ? "Reaksi terbanyak" : "Like terbanyak" }, { value: "comments", label: whatsapp ? "Balasan terbanyak" : "Komentar terbanyak" }, { value: "response", label: "Respons tertinggi" },
      ]} icon={<Chart size={15} />} open={sortOpen} onOpenChange={setSortOpen} onChange={(value) => onFilters({ sort: value as AnalyticsFilters["sort"], page: 1 })}
        triggerClassName="analytics-select" contentClassName="analytics-select-popup" />
    </div>
    <div className="analytics-results-meta" aria-live="polite"><span>{filtered.length} dari {posts.length} posting{filters.segment ? ` · ${filters.segment}` : ""}</span>
      {(filters.query || filters.segment) && <button type="button" onClick={() => onFilters({ query: "", segment: "", page: 1 })}>Hapus filter <Close size={12} /></button>}</div>
    {!filtered.length ? <AnalyticsEmpty title={posts.length ? "Tidak ada posting yang cocok" : "Belum ada publikasi bulan ini"} icon={<ImageIcon size={23} />}>
      {posts.length ? "Coba kata kunci lain atau hapus filter untuk melihat semua posting." : "Pilih bulan lain atau siapkan konten melalui Planner. Metrik akan muncul setelah publikasi."}</AnalyticsEmpty>
      : <div className="analytics-table-wrap"><table className="analytics-table"><caption className="sr-only">Peringkat konten, diurutkan menurut {filters.sort === "response" ? "respons" : metricLabel(filters.sort, whatsapp)} tertinggi</caption>
        <thead><tr><th scope="col">Konten</th>{(["views", "likes", "comments"] as const).map((key) => <th key={key} scope="col" aria-sort={filters.sort === key ? "descending" : "none"}><button type="button" onClick={() => onFilters({ sort: key, page: 1 })}>{metricLabel(key, whatsapp).replace(" teramati", "")}{filters.sort === key && <ArrowDown size={12} />}</button></th>)}<th scope="col" aria-sort={filters.sort === "response" ? "descending" : "none"}><button type="button" onClick={() => onFilters({ sort: "response", page: 1 })}>Respons{filters.sort === "response" && <ArrowDown size={12} />}</button></th><th scope="col"><span className="sr-only">Detail posting</span></th></tr></thead>
        <tbody>{filtered.slice((page - 1) * 10, page * 10).map((post, index) => <Fragment key={post.id}><tr id={`analytics-post-${post.id}`} data-expanded={expanded === post.id}>
          <th scope="row"><div className="analytics-post-identity"><span className="analytics-post-rank">{String((page - 1) * 10 + index + 1).padStart(2, "0")}</span>
            <span className="analytics-post-photo"><ImageIcon size={18} /><img src={imageUrl(post.jobId)} alt="" width="46" height="56" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /></span>
            <div><b>{post.asset.propertyType || "Properti"} · {post.asset.city || "Lokasi belum tercatat"}</b><span title={post.asset.address}>{post.asset.address || post.asset.title || "Alamat belum tercatat"}</span><small>{date(post.publishedAt)} WIB{post.errorCode === "MEDIA_DELETED" ? " · Dihapus (riwayat)" : ""}</small></div></div></th>
          {(["views", "likes", "comments"] as const).map((key) => <td key={key} data-label={metricLabel(key, whatsapp).replace(" teramati", "")} data-tone={key === "views" ? "sky" : key === "likes" ? "rose" : "violet"}><span className={metricValue(post, key) === null ? "analytics-unknown" : "analytics-metric-number"}>{analyticNumber(metricValue(post, key))}</span></td>)}
          <td data-label="Respons"><span className={responseRate(post) === null ? "analytics-unknown" : "analytics-metric-number"}>{responseRate(post) === null ? "Belum tersedia" : `${analyticNumber(responseRate(post), 2)}%`}</span></td>
          <td className="analytics-post-toggle-cell"><button className="analytics-post-toggle" type="button" aria-expanded={expanded === post.id} aria-controls={`analytics-detail-${post.id}`} aria-label={`${expanded === post.id ? "Tutup" : "Lihat"} detail ${post.asset.address || post.asset.title || "posting"}`}
            onClick={() => setExpanded(expanded === post.id ? null : post.id)}>Detail <ChevronRight size={14} /></button></td>
        </tr><tr className="analytics-detail-row" hidden={expanded !== post.id}><td colSpan={6}><div className="analytics-post-detail" id={`analytics-detail-${post.id}`}>
          <div className="analytics-detail-top"><p>{post.asset.address || post.asset.title || "Alamat belum tercatat"}</p><AnalyticsTag tone={post.errorCode === "MEDIA_DELETED" ? "amber" : "mint"}>{post.errorCode === "MEDIA_DELETED" ? "Riwayat terhapus" : "Terbit"}</AnalyticsTag></div>
          {!whatsapp && <dl className="analytics-additional-metrics">{[["reach", "Jangkauan"], ["saved", "Disimpan"], ["shares", "Dibagikan"]].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{analyticNumber(post.values[key as "reach" | "saved" | "shares"])}</dd></div>)}</dl>}
          <div className="analytics-detail-bottom"><div><p>Diperbarui {date(post.lastSyncedAt)}{post.lastSyncedAt ? " WIB" : ""}</p>{(post.errorCode || post.metricReason) && <p className="analytics-metric-issue">{errorLabels[post.errorCode || post.metricReason || ""] || "Sebagian metrik belum tersedia dari kanal ini."}</p>}</div>
            <div className="analytics-post-actions"><Action disabled={!editable || post.errorCode === "MEDIA_DELETED"} onClick={() => onSync(post.id)} aria-label={`Perbarui metrik ${post.asset.address || "posting"}`}><RefreshCw size={14} />Perbarui</Action>
              {!whatsapp && post.errorCode !== "MEDIA_DELETED" && <Action disabled={!editable} onClick={() => onComments({ id: post.id })}><MessageCircle size={14} />Komentar</Action>}
              {post.permalink && /^https:\/\//.test(post.permalink) && post.errorCode !== "MEDIA_DELETED" && <a className="analytics-post-link" href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label="Buka posting di tab baru"><ExternalLink size={16} /></a>}</div></div>
        </div></td></tr></Fragment>)}</tbody>
      </table></div>}
    {filtered.length > 0 && <nav className="analytics-pagination" aria-label="Halaman performa posting"><p>{(page - 1) * 10 + 1}–{Math.min(page * 10, filtered.length)} dari {filtered.length} posting</p><div><Action disabled={page <= 1} onClick={() => onFilters({ page: page - 1 })} aria-label="Halaman posting sebelumnya"><ChevronLeft size={15} /></Action><span aria-live="polite">{page} / {pages}</span><Action disabled={page >= pages} onClick={() => onFilters({ page: page + 1 })} aria-label="Halaman posting berikutnya"><ChevronRight size={15} /></Action></div></nav>}
  </AnalyticsPanel>;
}
