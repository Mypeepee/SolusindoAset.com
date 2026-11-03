"use client";

import { useId, useState } from "react";
import { monthDays } from "@/lib/marketing/planner";
import { metricSummary, metricValue, publishedDay, rankPosts, type AnalyticsMetric, type AnalyticsPost } from "@/lib/marketing/analytics";
import { AnalyticsEmpty, AnalyticsPanel, AnalyticsTag, analyticNumber, metricLabel, shortNumber } from "./AnalyticsPrimitives";
import { Chart, Eye, Heart, MessageCircle, Layers, ArrowRight } from "./MarketingIcons";

export default function AnalyticsOverview({ posts, month, whatsapp, onInspect }: {
  posts: AnalyticsPost[]; month: string; whatsapp: boolean; onInspect: (id: string) => void;
}) {
  const [metric, setMetric] = useState<AnalyticsMetric>("views");
  const [selected, setSelected] = useState<string | null>(null);
  const gradient = useId().replace(/:/g, "");
  const measured = metricSummary(posts, metric);
  const days = monthDays(month).map((day) => ({ day, ...metricSummary(posts.filter((post) => publishedDay(post) === day), metric) }));
  const max = Math.max(1, ...days.map((d) => d.total ?? 0));
  const active = days.find((d) => d.day === selected) || [...days].reverse().find((d) => d.total !== null);
  const leader = rankPosts(posts, metric).find((post) => metricValue(post, metric) !== null);
  const metrics = [
    { label: "Konten terbit", value: posts.length, count: posts.length, tone: "mint", Icon: Layers, note: "Publikasi pada bulan ini" },
    ...(["views", "likes", "comments"] as const).map((key, index) => ({ label: metricLabel(key, whatsapp), value: metricSummary(posts, key).total,
      count: metricSummary(posts, key).count, tone: ["sky", "rose", "violet"][index], Icon: [Eye, Heart, MessageCircle][index], note: "" })),
  ];
  return <>
    <dl className="analytics-kpis">{metrics.map(({ label, value, count, tone, Icon, note }) => <div className="analytics-kpi-shell" key={label} data-tone={tone}>
      <div className="analytics-kpi"><div className="analytics-kpi-label"><dt>{label}</dt><span className="analytics-icon-disc"><Icon size={18} /></span></div>
        <dd className={value === null ? "is-unavailable" : ""}>{value === null ? "Belum tersedia" : analyticNumber(value)}</dd>
        <p>{note || `${count} dari ${posts.length} posting terukur`}</p></div>
    </div>)}</dl>
    <div className="analytics-overview-grid">
      <AnalyticsPanel className="analytics-trend" tone={metric === "views" ? "sky" : metric === "likes" ? "rose" : "violet"}>
        <div className="analytics-section-heading"><div><span className="analytics-eyebrow">Distribusi performa</span><h3>Respons sepanjang bulan</h3></div>
          <div className="analytics-segments" aria-label="Metrik grafik">{(["views", "likes", "comments"] as const).map((key) => <button type="button" key={key} aria-pressed={metric === key}
            onClick={() => { setMetric(key); setSelected(null); }}>{metricLabel(key, whatsapp).replace(" teramati", "")}</button>)}</div></div>
        <div className="analytics-chart-summary"><strong>{analyticNumber(measured.total)}</strong><span>{metricLabel(metric, whatsapp).toLowerCase()}<small>{measured.count}/{posts.length} posting terukur</small></span></div>
        {measured.count === 0 ? <div className="analytics-chart-empty"><div className="analytics-chart-grid" aria-hidden="true" /><AnalyticsEmpty title="Grafik menunggu data">
          {posts.length ? "Metrik belum diterima. Perbarui metrik pada posting yang sudah terbit." : "Setelah konten terbit, lihat tanggal mana yang menghasilkan respons terbesar."}</AnalyticsEmpty></div>
          : <div className="analytics-chart-area">
            <div className="analytics-y-axis" aria-hidden="true">{[1, .5, 0].map((factor) => <span key={factor}>{shortNumber(max * factor)}</span>)}</div>
            <div className="analytics-chart-body" onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const index = Math.max(0, Math.min(days.length - 1, Math.floor((event.clientX - rect.left) / rect.width * days.length)));
              setSelected(days[index].day);
            }}><svg viewBox="0 0 700 165" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--analytics-tone)" stopOpacity=".95" /><stop offset="100%" stopColor="var(--analytics-tone)" stopOpacity=".25" /></linearGradient></defs>
              {[8, 80, 152].map((y) => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5" />)}
              {days.map((day, index) => day.total === null ? null : <rect key={day.day} x={index * 700 / days.length + 4} y={day.total === 0 ? 150 : 152 - day.total / max * 142}
                width={Math.max(4, 700 / days.length - 8)} height={Math.max(2, day.total / max * 142)} rx="3" fill={`url(#${gradient})`} opacity={active?.day === day.day ? 1 : .65} />)}
            </svg>
            <div className="analytics-x-axis" aria-hidden="true"><span>01</span><span>{Math.ceil(days.length / 2)}</span><span>{days.length}</span></div>
            </div>
            <input className="analytics-date-slider" type="range" min={0} max={days.length - 1} step={1}
              value={Math.max(0, days.findIndex((day) => day.day === active?.day))} aria-label="Tanggal pada grafik performa"
              aria-valuetext={active ? `${Number(active.day.slice(-2))}: ${analyticNumber(active.total)} ${metricLabel(metric, whatsapp).toLowerCase()}, ${active.count} posting terukur` : "Belum ada data"}
              onChange={(event) => setSelected(days[Number(event.target.value)].day)} />
            <p className="analytics-chart-detail" aria-live="polite">{active ? <><b>{Number(active.day.slice(-2))} {new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).format(new Date(active.day + "T12:00:00+07:00"))}</b><span>{analyticNumber(active.total)} {metricLabel(metric, whatsapp).toLowerCase()} · {active.count} posting terukur</span></> : "Pilih tanggal untuk melihat detail."}</p>
          </div>}
        <p className="analytics-caption">Metrik kumulatif terbaru, dikelompokkan menurut tanggal terbit. Bukan pertambahan harian. Data kosong tidak dianggap nol.</p>
      </AnalyticsPanel>
      <AnalyticsPanel className="analytics-spotlight" tone="amber">
        <div className="analytics-section-heading"><span className="analytics-icon-disc"><Chart size={19} /></span><AnalyticsTag tone="amber">Sorotan konten</AnalyticsTag></div>
        <h3>{leader ? `Paling banyak ${metric === "views" ? "dilihat" : metric === "likes" ? whatsapp ? "mendapat reaksi" : "mendapat like" : whatsapp ? "mendapat balasan" : "dikomentari"}` : "Temukan konten andalan Anda"}</h3>
        {leader ? <><div className="analytics-spotlight-value">{analyticNumber(metricValue(leader, metric))}<span>{metricLabel(metric, whatsapp).toLowerCase()}</span></div>
          <p className="analytics-spotlight-property">{leader.asset.propertyType || "Properti"} · {leader.asset.city || "Lokasi belum tercatat"}</p><p className="analytics-spotlight-address">{leader.asset.address || leader.asset.title || "Alamat belum tercatat"}</p>
          <button type="button" className="analytics-text-action" onClick={() => onInspect(leader.id)}>Lihat performa posting <span><ArrowRight size={16} /></span></button>
          <p className="analytics-caption">Peringkat dari {measured.count} posting dengan metrik tersedia. Usia tayang dapat berbeda.</p></>
          : <><p className="analytics-spotlight-description">Satu tempat untuk mengetahui properti yang menarik perhatian dan mengundang percakapan.</p>
            <ol className="analytics-onboarding"><li><span>1</span>Terbitkan konten dari Planner</li><li><span>2</span>Kumpulkan views dan interaksi</li><li><span>3</span>Bandingkan pola respons audiens</li></ol>
            <p className="analytics-caption">Sorotan muncul otomatis setelah metrik tersedia.</p></>}
      </AnalyticsPanel>
    </div>
  </>;
}
