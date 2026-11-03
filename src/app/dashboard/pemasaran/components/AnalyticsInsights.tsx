"use client";

import { useState } from "react";
import SearchSelect from "@/components/search/SearchSelect";
import { audienceSegments, distinctProperties, forecastRange, type AnalyticsDimension, type AnalyticsPost } from "@/lib/marketing/analytics";
import { AnalyticsEmpty, AnalyticsPanel, AnalyticsTag, analyticNumber, tones } from "./AnalyticsPrimitives";
import { Chart, ArrowRight, Eye, Layers, CircleAlert } from "./MarketingIcons";

const dimensions = [{ value: "type", label: "Jenis properti" }, { value: "city", label: "Lokasi" }, { value: "price", label: "Harga" }, { value: "land", label: "Luas tanah" }] as const;

export default function AnalyticsInsights({ posts, history, fetchedAt, historyStart, month, whatsapp, onSegment }: {
  posts: AnalyticsPost[]; history: AnalyticsPost[]; fetchedAt: string; historyStart: string; month: string; whatsapp: boolean;
  onSegment: (dimension: AnalyticsDimension, label: string) => void;
}) {
  const [dimension, setDimension] = useState<AnalyticsDimension>("type");
  const [order, setOrder] = useState<"volume" | "response">("volume");
  const [forecastType, setForecastType] = useState("");
  const [forecastOpen, setForecastOpen] = useState(false);
  const groups = audienceSegments(posts, dimension);
  const sorted = order === "volume" ? groups : [...groups].sort((a, b) => {
    const ar = a.responseCount >= 3 ? a.rate : null, br = b.responseCount >= 3 ? b.rate : null;
    return Number(br !== null) - Number(ar !== null) || (br ?? 0) - (ar ?? 0) || b.count - a.count;
  });
  const historyGroups = audienceSegments(history.filter((post) => post.asset.propertyType?.trim()), "type");
  const chosen = historyGroups.find((group) => group.label === forecastType) || historyGroups[0];
  const forecast = forecastRange(chosen?.posts || [], fetchedAt);
  const comparable = groups.filter((group) => group.responseCount >= 3 && distinctProperties(group.posts) >= 2 && !group.label.includes("belum tercatat"));
  const strongest = [...comparable].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
  const hasComparison = comparable.length >= 2 && strongest && (strongest.rate ?? 0) > 0;
  const max = Math.max(1, ...groups.map((group) => group.count));
  const dateRange = `${new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(historyStart + "-01T12:00:00+07:00"))} – ${new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(month + "-01T12:00:00+07:00"))}`;
  return <div className="analytics-insights-grid">
    <AnalyticsPanel className="analytics-audience" tone="violet">
      <div className="analytics-section-heading"><div><span className="analytics-eyebrow">Kenali pola audiens</span><h3>Properti apa yang menarik perhatian?</h3></div><AnalyticsTag tone="violet">{posts.length} posting</AnalyticsTag></div>
      <div className="analytics-dimensions" aria-label="Dimensi analisis">{dimensions.map((item) => <button type="button" key={item.value} aria-pressed={dimension === item.value} onClick={() => setDimension(item.value)}>{item.label}</button>)}</div>
      <div className="analytics-audience-toolbar"><p>{order === "volume" ? "Distribusi konten yang diterbitkan" : "Median respons per posting"}</p><div className="analytics-segments" aria-label="Urutan segmen"><button type="button" aria-pressed={order === "volume"} onClick={() => setOrder("volume")}>Terbanyak</button><button type="button" aria-pressed={order === "response"} onClick={() => setOrder("response")}>Respons</button></div></div>
      {!groups.length ? <AnalyticsEmpty title="Pola audiens belum terbentuk" icon={<Layers size={23} />}>Bandingkan jenis, lokasi, harga, dan luas properti setelah konten dipublikasikan.</AnalyticsEmpty>
        : <div className="analytics-audience-scroll" tabIndex={groups.length > 6 ? 0 : undefined} aria-label="Perbandingan segmen properti">
          <div className="analytics-audience-head"><span>Segmen / jumlah posting</span><span>Median views</span><span>Respons</span></div>
          {sorted.map((group, index) => <div className="analytics-audience-row" key={group.label} data-tone={tones[index % tones.length]}>
            <div><button type="button" className="analytics-segment-link" onClick={() => onSegment(dimension, group.label)} title={`Lihat posting ${group.label}`}>{group.label}<ArrowRight size={13} /></button>
              <div className="analytics-volume"><span style={{ transform: `scaleX(${group.count / max})` }} /><small>{group.count} posting</small></div></div>
            <div className="analytics-audience-number">{group.medianViews === null ? <span className="analytics-unknown">Belum tersedia</span> : analyticNumber(group.medianViews, 1)}<small>{group.measured} terukur</small></div>
            <div className="analytics-audience-number">{group.rate === null ? <span className="analytics-unknown">Belum tersedia</span> : `${analyticNumber(group.rate, 2)}%`}<small>{group.responseCount < 3 ? "Sampel terbatas" : `${group.responseCount} terukur`}</small></div>
          </div>)}
        </div>}
      <div className="analytics-insight-note" data-tone={hasComparison ? "mint" : "amber"}><span className="analytics-icon-disc">{hasComparison ? <Chart size={17} /> : <CircleAlert size={17} />}</span>
        <div><b>{hasComparison ? `${strongest.label} memimpin respons` : "Volume unggahan berbeda dari minat audiens"}</b><p>{hasComparison ? `Median ${analyticNumber(strongest.rate, 2)}% dari ${strongest.responseCount} posting terukur. Uji satu variasi konten serupa dan bandingkan hasilnya.` : "Segmen yang sering diunggah belum tentu paling disukai. Minimal 3 posting terukur per segmen diperlukan untuk perbandingan respons."}</p></div></div>
      <p className="analytics-caption">Respons = ({whatsapp ? "reaksi + balasan" : "like + komentar"}) ÷ views × 100, lalu diambil median per posting. Hanya metrik lengkap dengan views &gt; 0. Ini sinyal interaksi, bukan bukti niat membeli.</p>
    </AnalyticsPanel>
    <AnalyticsPanel className="analytics-forecast" tone="teal">
      <div className="analytics-section-heading"><span className="analytics-icon-disc"><Eye size={19} /></span><AnalyticsTag tone="teal">Perencanaan konten</AnalyticsTag></div>
      <h3>Proyeksi posting berikutnya</h3><p className="analytics-panel-description">Gunakan pola historis untuk menetapkan ekspektasi yang realistis.</p>
      {historyGroups.length > 0 && <SearchSelect label="Jenis properti untuk proyeksi" compact value={chosen?.label || ""} options={historyGroups.map((group) => ({ value: group.label, label: group.label }))}
        icon={<Layers size={16} />} open={forecastOpen} onOpenChange={setForecastOpen} onChange={setForecastType}
        triggerClassName="analytics-select" contentClassName="analytics-select-popup" />}
      {forecast.ready ? <><div className="analytics-forecast-result"><span>Kisaran {whatsapp ? "views teramati" : "views"} per posting</span><strong>{analyticNumber(Math.floor(forecast.low!))}<i>–</i>{analyticNumber(Math.ceil(forecast.high!))}</strong><small>Median historis {analyticNumber(forecast.median, 1)} views</small></div>
        <p className="analytics-forecast-basis">Dari {forecast.count} posting · {forecast.assets} properti · rentang {forecast.span} hari</p>
        <div className="analytics-experiment"><b>Uji konten berikutnya</b><p>Pilih properti {chosen?.label.toLowerCase()} dengan karakteristik serupa. Ubah satu hal, misalnya foto sampul, lalu bandingkan setelah waktu tayang yang sama.</p></div></>
        : <div className="analytics-forecast-waiting"><span className="analytics-forecast-symbol"><Chart size={28} /></span><h4>Menunggu dasar proyeksi</h4><p>Kumpulkan variasi properti dan beri konten waktu untuk memperoleh respons.</p>
          <ul><li><span>Posting berusia ≥72 jam</span><b>{forecast.count} / 5</b></li><li><span>Properti berbeda</span><b>{forecast.assets} / 3</b></li><li><span>Rentang tanggal terbit</span><b>{forecast.span} / 14 hari</b></li></ul></div>}
      <p className="analytics-caption">Riwayat {dateRange}. Kisaran adalah persentil 25–75 views kumulatif pada konten sejenis berusia ≥72 jam, bukan jaminan hasil. Usia tayang berbeda; konten terhapus dikecualikan. Tidak memprediksi penjualan.</p>
    </AnalyticsPanel>
  </div>;
}
