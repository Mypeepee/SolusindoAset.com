"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Clock3, MessageSquare, ScanSearch, Sparkles, UserRoundCheck, Zap } from "lucide-react";
import type { WhatsAppController } from "./WhatsAppConnection";
import type { ConversationsController } from "./useConversations";

const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("id-ID");
const estimatedTime = (sent: number) => sent * 2 >= 60
  ? `${(sent * 2 / 60).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`
  : `${sent * 2} menit`;

type AnalyticsProps = { connection: WhatsAppController; conversations: ConversationsController };

export function JarvisInsight({ connection, conversations }: AnalyticsProps) {
  const sent = connection.online ? connection.status?.sent : null;
  const attention = conversations.error ? null : conversations.data?.attention;
  return <aside aria-labelledby="jarvis-title" className="relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0e10]/90 p-5 backdrop-blur-sm">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-emerald-300"><Sparkles size={16} strokeWidth={1.7} /><h2 id="jarvis-title" className="text-[10px] font-semibold uppercase tracking-[0.2em]">Jarvis mode</h2></div><span className="rounded-md border border-white/[0.07] px-1.5 py-1 font-mono text-[9px] tracking-wide text-zinc-500">INSIGHT</span></div>
    <div className="mt-3 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-300"><Zap size={20} strokeWidth={1.4} aria-hidden="true" /></span>
      <div className="min-w-0"><h3 className="text-lg font-medium leading-6 tracking-[-0.035em] text-zinc-100 sm:text-xl">Asisten bekerja.</h3><p className="mt-0.5 text-xs leading-5 text-zinc-500">Anda selangkah di depan.</p></div>
    </div>
    <div aria-live="polite" className="mt-3 text-[13px] leading-6 text-zinc-400">
      {connection.loading ? <p>Menyiapkan ringkasan aktivitas asisten Anda…</p> : sent == null ? <p>Ringkasan tersedia saat layanan dapat dijangkau. Hubungkan WhatsApp untuk mulai menerima pesan.</p> : sent === 0 && connection.status?.received === 0 && attention === 0 ? <p>{connection.status?.connected ? "Belum ada pesan masuk. Asisten siap menyambut pertanyaan pertama." : "Hubungkan WhatsApp untuk mulai menerima pesan dan mengenali kebutuhan prospek."}</p> : <p>Sejak layanan dimulai: <strong className="font-medium text-white">{number(sent)} balasan</strong>, dengan estimasi penghematan <strong className="font-medium text-emerald-300">{estimatedTime(sent)}</strong>.{attention == null ? " Status perhatian agent sedang diperiksa." : attention > 0 ? <> <strong className="font-medium text-amber-200">{number(attention)} percakapan</strong> membutuhkan Anda.</> : " Semua percakapan saat ini tertangani."}</p>}
    </div>
    {attention != null && attention > 0 ? <a href="#prospects" className="mt-3 inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Lihat yang perlu perhatian<ArrowRight size={15} /></a> : <p className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${connection.online && connection.status?.connected ? "bg-emerald-300" : "bg-zinc-600"}`} />{connection.online && connection.status?.connected ? "Siap menyambut peluang berikutnya" : "Siap saat WhatsApp terhubung"}</p>}
    <ul aria-label="Fungsi asisten" className="mt-3 grid grid-cols-3 gap-2">
      {[
        { icon: MessageSquare, label: "Jawab pertanyaan" },
        { icon: ScanSearch, label: "Kenali kebutuhan" },
        { icon: UserRoundCheck, label: "Alihkan ke agent" },
      ].map(({ icon: Icon, label }) => <li key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5 text-center"><Icon size={18} strokeWidth={1.5} className="shrink-0 text-emerald-300/80" aria-hidden="true" /><span className="max-w-[90px] text-[11px] leading-4 text-zinc-300">{label}</span></li>)}
    </ul>
    <p className="mt-3 text-[10px] leading-4 text-zinc-500">{sent != null ? "Estimasi waktu berdasarkan asumsi 2 menit per balasan." : "Ringkasan bersumber dari aktivitas WhatsApp Anda."}</p>
  </aside>;
}

function Sparkline({ values, label, muted = false }: { values: number[]; label: string; muted?: boolean }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return <div className="flex h-12 items-end" aria-label="Grafik menunggu sampel berikutnya"><span className="h-px w-full bg-white/10" /></div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coordinates = values.map((value, index) => `${index * 240 / (values.length - 1)},${42 - (value - min) / span * 32}`);
  const path = `M${coordinates.join(" L")}`;
  return <svg viewBox="0 0 240 48" preserveAspectRatio="none" className={`h-12 w-full ${muted ? "text-zinc-400" : "text-emerald-300"}`} role="img" aria-label={`${label}: ${values.join(", ")}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.14" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <path d={`${path} L240,48 L0,48 Z`} fill={`url(#${id})`} /><path d={path} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function JarvisAnalytics({ connection }: AnalyticsProps) {
  const [samples, setSamples] = useState<{ received: number; sent: number }[]>([]);
  const { status, online } = connection;
  useEffect(() => {
    if (!online || !status) return;
    setSamples((previous) => {
      const last = previous[previous.length - 1];
      const next = { received: status.received, sent: status.sent };
      // A service/session reset begins a new series; do not draw a false drop.
      return last && (next.received < last.received || next.sent < last.sent) ? [next] : [...previous.slice(-19), next];
    });
  }, [status, online]);
  const received = online ? status?.received : null;
  const sent = online ? status?.sent : null;
  // A volume ratio, not a claim that each incoming message received a reply.
  // Multiple outgoing messages may follow one incoming message.
  const responseRatio = received && sent != null ? Math.round(sent / received * 100) : null;

  return <section aria-labelledby="analytics-title">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="analytics-title" className="text-sm font-medium text-zinc-200">Setiap percakapan, lebih berarti.</h2><p className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Clock3 size={12} />Pesan sejak layanan dimulai</p></div>
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
      <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e10]/90 p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs text-zinc-400">Pesan masuk</h3><ArrowDownLeft size={15} className="text-zinc-500" /></div>
        <p className="mt-5 text-[34px] font-medium leading-none tracking-[-0.05em] tabular-nums text-white">{number(received)}</p>
        <div className="mt-3"><Sparkline values={online ? samples.map((sample) => sample.received) : []} label="Pesan diterima" muted /></div>
        <p className="mt-2 text-[10px] leading-5 text-zinc-500">{samples.length > 1 ? "Tren selama halaman terbuka" : "Grafik menunggu sampel berikutnya"}</p>
      </article>
      <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e10]/90 p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs text-zinc-400">Balasan terkirim</h3><ArrowUpRight size={15} className="text-emerald-300/70" /></div>
        <p className="mt-5 text-[34px] font-medium leading-none tracking-[-0.05em] tabular-nums text-emerald-300">{number(sent)}</p>
        <div className="mt-3"><Sparkline values={online ? samples.map((sample) => sample.sent) : []} label="Balasan terkirim" /></div>
        <p className="mt-2 text-[10px] leading-5 text-zinc-500">Berhasil dikirim melalui WhatsApp</p>
      </article>
      <article className="flex min-w-0 flex-col rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.06] to-[#0c0e10] p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs text-zinc-400">Waktu untuk Anda</h3><Clock3 size={15} className="text-emerald-300/70" /></div>
        <p className="mt-5 text-[30px] font-medium leading-none tracking-[-0.05em] tabular-nums text-white">{sent == null ? "—" : <><span className="mr-1 text-xl text-emerald-300/60">≈</span>{estimatedTime(sent)}</>}</p>
        <div className="my-5 flex items-center gap-2 text-emerald-300/70"><span className="h-px flex-1 bg-emerald-300/15" /><Sparkles size={15} /><span className="h-px flex-1 bg-emerald-300/15" /></div>
        <p className="mt-auto text-[10px] leading-5 text-zinc-500">Estimasi 2 menit per balasan.<br />Lebih banyak ruang untuk closing.</p>
      </article>
      <article className="min-w-0 rounded-2xl border border-white/10 bg-[#0c0e10]/90 p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs text-zinc-400">Rasio balasan</h3><MessageSquare size={15} className="text-zinc-500" /></div>
        <div className="relative mx-auto my-4 h-[88px] w-[88px]" role="img" aria-label={responseRatio == null ? "Rasio balasan belum tersedia" : `Rasio volume balasan ${responseRatio} persen: ${sent} balasan per ${received} pesan masuk. Cincin maksimal 100 persen.`}>
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="44" cy="44" r="37" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5" /><circle cx="44" cy="44" r="37" fill="none" stroke="#6ee7b7" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${Math.min(responseRatio ?? 0, 100) / 100 * 232.48} 232.48`} /></svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-medium tracking-tight tabular-nums text-white">{responseRatio == null ? "—" : `${responseRatio}%`}</span>
        </div>
        <p className="text-center text-[10px] leading-5 text-zinc-500">{responseRatio == null ? "Menunggu pesan masuk" : `${number(sent)} balasan / ${number(received)} pesan masuk`}</p>
        <p className="mt-1 text-center text-[9px] leading-4 text-zinc-500">{responseRatio != null && responseRatio > 100 ? "Beberapa balasan dapat mengikuti satu pesan." : "Perbandingan volume, bukan respons per kontak."}</p>
      </article>
    </div>
  </section>;
}
