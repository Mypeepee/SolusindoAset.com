"use client";

import Link from "next/link";
import { ArrowUpRight, Check, CircleHelp, Database, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import type { ClientProbe } from "@/lib/chatbot/client-status";
import type { ClientCaptureController } from "./useClientCapture";

const date = (value: number | string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) + " WIB";
const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("id-ID");
const checkMessage = (probe: ClientProbe) => probe.status === "passed" ? "" :
  probe.error === "CLIENT_AUTH_FAILED" ? "Izin penyimpanan belum sesuai. Konfigurasi layanan perlu diperiksa." :
  probe.error === "UPSTREAM_TIMEOUT" ? "Pemeriksaan melewati batas waktu. Coba lagi sebentar." :
  "Uji penyimpanan belum berhasil. Periksa koneksi layanan dan database, lalu coba lagi.";

export default function ClientCapturePanel({ whatsappConnected, controller }: { whatsappConnected: boolean; controller: ClientCaptureController }) {
  const { data, error, loading, checking, refreshing, refresh, runCheck } = controller;
  const backend = data?.backend, probe = backend?.probe;
  const ready = !!backend?.configured, retrying = Number(backend?.retrying || 0) > 0;
  const passed = probe?.status === "passed" && ready && data?.crm.available && !error && !retrying;
  const label = loading ? "Memeriksa status" : error || !data?.crm.available || !backend ? "Status perlu diperiksa" : !ready ? "Belum dikonfigurasi" : retrying ? "Ada penyimpanan tertunda" : probe?.status === "failed" ? "Uji belum berhasil" : passed ? "Uji penyimpanan lulus" : "Belum diuji";
  return <section id="penyimpanan-klien" aria-labelledby="client-capture-title" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-primary/15 bg-[#0b100e]">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="flex items-start gap-3"><span className="rounded-xl border border-primary/15 bg-primary/[0.06] p-2.5 text-primary"><Database size={18} /></span>
        <div><h2 id="client-capture-title" className="text-sm font-medium text-slate-100">Penyimpanan klien otomatis</h2>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400">Setelah kebutuhan pencarian lengkap, nomor WhatsApp dan kriterianya masuk ke CRM dengan penanggung jawab AG108.</p>
          <p role="status" aria-live="polite" className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${passed ? "border-primary/20 bg-primary/[0.06] text-primary" : "border-white/10 bg-white/[0.03] text-slate-300"}`}>
            {loading || checking ? <Loader2 size={12} className="motion-safe:animate-spin" /> : passed ? <Check size={12} /> : <CircleHelp size={12} />}{checking ? "Menguji penyimpanan…" : label}
          </p></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={() => void refresh()} disabled={refreshing || checking} aria-label="Perbarui status penyimpanan klien" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><RefreshCw size={15} className={refreshing ? "motion-safe:animate-spin" : ""} /></button>
        <button onClick={() => void runCheck()} disabled={loading || checking || !ready} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50">
          {checking ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <FlaskConical size={14} />}Uji penyimpanan</button>
      </div>
    </div>
    {error && <p role="alert" className="mx-5 mb-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-3 text-xs leading-5 text-amber-100 sm:mx-6">{error}</p>}
    {probe?.status === "failed" && <p role="alert" className="mx-5 mb-4 text-xs leading-5 text-amber-100 sm:mx-6">{checkMessage(probe)}</p>}
    {retrying && <p className="mx-5 mb-4 text-xs leading-5 text-amber-100 sm:mx-6">Ada data yang belum berhasil disimpan. Sistem akan mencoba kembali secara otomatis; klien tersebut belum dihitung sebagai keberhasilan baru.</p>}
    <div className="grid gap-px border-y border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
      {[{ label: "Klien dari WhatsApp di CRM", value: data?.crm.count }, { label: "Menunggu disimpan", value: backend?.pending }, { label: "Menunggu percobaan ulang", value: backend?.retrying }].map((metric) =>
        <div key={metric.label} className="bg-[#0b100e] px-5 py-4 sm:px-6"><p className="text-[11px] text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-medium tabular-nums text-slate-100">{number(metric.value)}</p></div>)}
    </div>
    <div className="space-y-3 px-5 py-5 text-xs leading-6 text-slate-400 sm:px-6">
      {!ready && backend && <p>Penyimpanan otomatis belum dikonfigurasi. Lengkapi koneksi layanan sebelum menerima prospek.</p>}
      {probe?.status === "passed" && <div><p className="flex items-center gap-1.5 text-primary"><Check size={14} />Tulis, baca kembali, dan pembaruan tanpa duplikasi berhasil diuji.</p><p className="text-[11px] text-slate-500">Terakhir diuji {date(probe.checked_at)}. Data uji dibersihkan setelah pemeriksaan.</p></div>}
      {data?.crm.available === false && <p>Data klien di CRM belum dapat diperiksa. Angka yang belum diketahui ditampilkan sebagai “—”.</p>}
      {data?.crm.available && data.crm.count === 0 && <p>{whatsappConnected ? "WhatsApp sudah terhubung. Setelah pelanggan menyelesaikan funnel, klien pertamanya akan muncul di sini." : "Belum diuji melalui percakapan WhatsApp nyata. Uji database dapat dijalankan sekarang; tautkan WhatsApp untuk menguji penerimaan nomor pengirim."}</p>}
      <p className="text-[11px] text-slate-500">Playground menyimulasikan percakapan dan tidak menambah klien nyata. Status ini diperbarui otomatis setiap 30 detik saat halaman terbuka.</p>
      {data?.crm.last && <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"><p className="text-slate-200">Terakhir tersimpan: {data.crm.last.name} · {data.crm.last.phone_masked}</p><p className="text-[11px] text-slate-500">{data.crm.last.id} · {date(data.crm.last.saved_at)}</p></div>}
      {data?.can_open_crm && <Link href="/dashboard/crm" className="inline-flex min-h-8 items-center gap-1.5 font-medium text-primary hover:underline">Buka dashboard klien<ArrowUpRight size={13} /></Link>}
    </div>
  </section>;
}
