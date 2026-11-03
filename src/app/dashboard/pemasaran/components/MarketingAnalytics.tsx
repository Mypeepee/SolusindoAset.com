"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shiftMonth } from "@/lib/marketing/planner";
import { metricSummary, publishedDay, type AnalyticsDataset, type AnalyticsDimension } from "@/lib/marketing/analytics";
import { Action, date, type Data } from "./ui";
import { ChevronLeft, ChevronRight, Instagram, WhatsApp, RefreshCw, Chart, CircleAlert, CheckCircle } from "./MarketingIcons";
import AnalyticsOverview from "./AnalyticsOverview";
import AnalyticsInsights from "./AnalyticsInsights";
import AnalyticsPosts, { defaultAnalyticsFilters, filteredPosts, type AnalyticsFilters } from "./AnalyticsPosts";
import { AnalyticsPanel, AnalyticsTag } from "./AnalyticsPrimitives";
import "./marketing-analytics.css";

function initialFilters(): AnalyticsFilters {
  if (typeof window === "undefined") return defaultAnalyticsFilters;
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("analyticsSort"), dimension = params.get("analyticsDimension");
  return { query: (params.get("analyticsQuery") || "").slice(0, 100),
    sort: sort === "likes" || sort === "comments" || sort === "response" ? sort : "views",
    dimension: dimension === "city" || dimension === "price" || dimension === "land" ? dimension : "type",
    segment: (params.get("analyticsSegment") || "").slice(0, 200), page: Math.min(10000, Math.max(1, Math.floor(Number(params.get("analyticsPage")) || 1))) };
}
export default function MarketingAnalytics({ data, month, editable, onMonth, onSync, onComments }: {
  data: Data; month: string; editable: boolean; onMonth: (month: string) => void;
  onSync: (id: string) => void; onComments: (publication: { id: string }) => void;
}) {
  const [channel, setChannel] = useState<"instagram" | "whatsapp">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("analyticsChannel") === "whatsapp" ? "whatsapp" : "instagram");
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [dataset, setDataset] = useState<AnalyticsDataset | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const updateFilters = useCallback((patch: Partial<AnalyticsFilters>) => {
    setFilters((previous) => {
      const next = { ...previous, ...patch };
      const url = new URL(window.location.href);
      const entries = { analyticsQuery: next.query, analyticsSort: next.sort === "views" ? "" : next.sort,
        analyticsDimension: next.dimension === "type" ? "" : next.dimension, analyticsSegment: next.segment, analyticsPage: next.page === 1 ? "" : String(next.page) };
      for (const [key, value] of Object.entries(entries)) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
      window.history.replaceState(null, "", url);
      return next;
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; controller.abort(); }, 30000);
    setLoading(true); setError("");
    void fetch("/api/dashboard/pemasaran?mode=analytics&month=" + month, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 401 ? "Sesi berakhir. Masuk kembali untuk melihat analitik." : response.status === 403 ? "Analitik hanya tersedia untuk OWNER aktif." : "Data analitik belum dapat dimuat. Coba perbarui kembali.");
        if (result.month !== month || !Array.isArray(result.posts)) throw new Error("Respons analitik belum lengkap. Coba perbarui kembali.");
        if (active && !controller.signal.aborted) setDataset(result);
      }).catch((issue: Error) => {
        if (active && (!controller.signal.aborted || timeout)) setError(timeout ? "Pengambilan data terlalu lama. Periksa koneksi lalu coba kembali." : issue instanceof TypeError || issue instanceof SyntaxError ? "Data analitik belum dapat dibaca. Periksa koneksi lalu coba kembali." : issue.message);
      }).finally(() => { clearTimeout(timer); if (active && (!controller.signal.aborted || timeout)) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [month, data, retry]);
  const current = dataset?.month === month ? dataset : null;
  const history = useMemo(() => current?.posts.filter((post) => post.channel === channel) || [], [current, channel]);
  const posts = useMemo(() => history.filter((post) => publishedDay(post).startsWith(month)), [history, month]);
  const measured = metricSummary(posts, "views").count;
  const title = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(month + "-01T12:00:00+07:00"));
  const resetInspected = useCallback(() => setInspectedId(null), []);
  function inspect(id: string) {
    const defaults = { ...defaultAnalyticsFilters, sort: filters.sort };
    const index = filteredPosts(posts, defaults).findIndex((post) => post.id === id);
    updateFilters({ ...defaults, page: Math.floor(Math.max(0, index) / 10) + 1 }); setInspectedId(id);
  }
  function inspectSegment(dimension: AnalyticsDimension, segment: string) {
    updateFilters({ dimension, segment, query: "", page: 1 });
    document.querySelector(".analytics-posts")?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  return <div className="marketing-analytics-workspace" aria-busy={loading}>
    <header className="analytics-header"><div><span className="analytics-page-label"><Chart size={14} />Analitik pemasaran</span><h2>Kenali konten. Pahami audiens.</h2><p>Ubah performa posting menjadi arah konten properti berikutnya.</p></div>
      <div className="analytics-period"><Action aria-label="Bulan analitik sebelumnya" title="Bulan sebelumnya" disabled={month === "2000-01"} onClick={() => { updateFilters({ page: 1 }); onMonth(shiftMonth(month, -1)); }}><ChevronLeft size={16} /></Action><span>{title}</span><Action aria-label="Bulan analitik berikutnya" title="Bulan berikutnya" disabled={month === "2100-12"} onClick={() => { updateFilters({ page: 1 }); onMonth(shiftMonth(month, 1)); }}><ChevronRight size={16} /></Action></div>
    </header>
    <div className="analytics-channel-toolbar"><div className="analytics-channel-switch" aria-label="Kanal analitik">{(["instagram", "whatsapp"] as const).map((name) => <button type="button" key={name} aria-pressed={channel === name} onClick={() => {
      setChannel(name); updateFilters({ page: 1, query: "", segment: "" }); const url = new URL(window.location.href); url.searchParams.set("analyticsChannel", name); window.history.replaceState(null, "", url);
    }}>{name === "instagram" ? <Instagram size={17} /> : <WhatsApp size={17} />}<span>{name === "instagram" ? "Instagram" : "Status WhatsApp"}</span></button>)}</div>
      <div className="analytics-data-toolbar"><span>{loading ? "Mengambil data…" : current ? `Dibaca ${date(current.fetchedAt)} WIB` : "Data belum dimuat"}</span><Action disabled={loading} aria-label="Perbarui data analitik" title="Baca ulang data analitik tersimpan" onClick={() => setRetry((n) => n + 1)}><RefreshCw size={15} /></Action></div>
    </div>
    {error && <div role="alert" className="analytics-error"><CircleAlert size={18} /><div><b>{error}</b>{current && <p>Data terakhir tetap ditampilkan. Angka belum mencerminkan pembaruan terbaru.</p>}</div><Action onClick={() => setRetry((n) => n + 1)} disabled={loading}>Coba kembali</Action></div>}
    {!current ? <AnalyticsPanel className="analytics-loading"><div role="status"><span className="analytics-loading-symbol"><Chart size={30} /></span><h3>{loading ? "Menyiapkan analisis konten" : "Analitik belum tersedia"}</h3><p>{loading ? "Mengambil riwayat publikasi dan metrik dari penyimpanan Pemasaran." : "Gunakan Coba kembali untuk memuat bulan yang dipilih."}</p></div></AnalyticsPanel>
      : <div key={`${month}-${channel}`} className="analytics-content">
        <AnalyticsOverview posts={posts} month={month} whatsapp={channel === "whatsapp"} onInspect={inspect} />
        <div className="analytics-coverage"><span className="analytics-coverage-icon">{measured === posts.length && posts.length > 0 ? <CheckCircle size={17} /> : <CircleAlert size={17} />}</span><p><b>{posts.length ? `${measured} dari ${posts.length} posting memiliki data views.` : "Belum ada konten terbit pada periode ini."}</b> {channel === "whatsapp" ? "WhatsApp hanya mencatat interaksi yang teramati." : "Like dan komentar adalah sinyal respons; simpan dan bagikan tersedia pada detail posting."}</p><AnalyticsTag tone={measured < posts.length ? "amber" : "mint"}>{!posts.length ? "Menunggu publikasi" : measured < posts.length ? "Data sebagian" : "Views lengkap"}</AnalyticsTag></div>
        <AnalyticsInsights posts={posts} history={history} month={month} fetchedAt={current.fetchedAt} historyStart={current.historyStart} whatsapp={channel === "whatsapp"} onSegment={inspectSegment} />
        <AnalyticsPosts posts={posts} month={month} whatsapp={channel === "whatsapp"} filters={filters} onFilters={updateFilters} editable={editable && !loading} onSync={onSync} onComments={onComments} inspectedId={inspectedId} onInspected={resetInspected} />
        <details className="analytics-methodology"><summary>Bagaimana membaca analisis ini?</summary><div><p><b>Cakupan.</b> Konten properti yang dipublikasikan melalui Pemasaran, berdasarkan tanggal terbit dalam WIB. Unggahan manual di luar Pemasaran tidak termasuk; kelola melalui tab Instagram. Metrik disinkronkan setiap 30 menit saat layanan berjalan. Tombol perbarui di atas membaca penyimpanan; Perbarui pada detail posting meminta sinkronisasi kanal.</p><p><b>Perbandingan.</b> Views, like, dan komentar merupakan hitungan kumulatif terakhir, bukan pengunjung unik atau hasil penjualan. Median membantu mengurangi pengaruh satu posting yang sangat tinggi. Data yang belum tersedia tidak dihitung sebagai nol. Respons mengukur interaksi per views, bukan persentase orang unik.</p><p><b>Proyeksi.</b> Menggunakan bulan terpilih dan dua bulan sebelumnya, kanal dan jenis properti yang sama. Minimal 5 posting berusia 72 jam, 3 properti berbeda, dan rentang tanggal terbit 14 hari. Kisaran historis ini belum mengendalikan iklan, musim, jam, atau usia tayang. Validasi dengan eksperimen konten sebelum mengubah strategi.</p></div></details>
      </div>}
  </div>;
}
