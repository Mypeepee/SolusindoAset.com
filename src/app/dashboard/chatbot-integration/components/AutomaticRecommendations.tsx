"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recommendationStatus, type RecommendationStatus } from "@/lib/chatbot/recommendation-status";
const endpoint = "/api/dashboard/chatbot/recommendations";
const time = (v: number) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(v) + " WIB";
export default function AutomaticRecommendations() {
  const [data, setData] = useState<RecommendationStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0), changing = useRef(false);
  const refresh = useCallback(async () => {
    if (document.hidden || changing.current) return;
    const version = revision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const status = response.ok ? recommendationStatus(await response.json()) : null;
      if (!status) throw new Error();
      if (version === revision.current) { setData(status); setError(""); }
    } catch { if (version === revision.current) setError("Status rekomendasi belum dapat diperiksa."); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 30000); return () => { revision.current++; clearInterval(timer); }; }, [refresh]);
  const update = async (body: object) => {
    if (!data?.configured || changing.current) return;
    changing.current = true; revision.current++; setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
      const status = response.ok ? recommendationStatus(await response.json()) : null;
      if (!status) throw new Error();
      setData(status);
    } catch { setError("Pengaturan belum tersimpan. Silakan coba lagi."); }
    finally { changing.current = false; setBusy(false); }
  };
  return <section aria-label="Rekomendasi aset otomatis" className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-white">Rekomendasi aset otomatis</h2><p className="mt-1 text-slate-400">Setiap pukul 08.00 WIB, cari aset yang cocok dengan preferensi CRM dan belum pernah dikirim. Listing baru juga diperiksa sepanjang jam kirim.</p></div>
      {data?.configured && <button type="button" role="switch" aria-label="Pengiriman rekomendasi otomatis" aria-checked={data.enabled} disabled={busy} onClick={() => update({ enabled: !data.enabled })} className="rounded-xl border border-white/15 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Menyimpan…" : data.enabled ? "Aktif · Jeda" : "Dijeda · Aktifkan"}</button>}
    </div>
    {error && <p role="alert" className="mt-3 text-amber-200">{error}</p>}
    {!data && !error && <p className="mt-3">Memeriksa pengiriman otomatis…</p>}
    {data?.configured === false && <p className="mt-3 text-amber-200">Layanan rekomendasi otomatis belum dikonfigurasi.</p>}
    {data?.configured && <>
      <p className="mt-3">Empat aset per pesan jika tersedia; bila yang cocok lebih sedikit, kirim sesuai jumlah sebenarnya. Satu pesan per nomor dalam 24 jam, pukul 08.00–20.00 WIB. Chat yang dijeda atau sedang ditangani agen akan ditunggu. Klien bisa mengetik “berhenti rekomendasi”.</p>
      <p className="mt-2 text-slate-400">Lelang boleh ditawarkan sampai satu bulan setelah tanggal lelang. Jadwal yang sudah lewat tetap memerlukan konfirmasi stok dan jadwal ulang; yang lebih lama dilewati.</p>
      {!data.whatsapp_connected && <p role="alert" className="mt-3 text-amber-200">WhatsApp belum terhubung ({data.whatsapp_status === "logged_out" ? "logout; perlu dipasangkan kembali" : data.whatsapp_status}). Rekomendasi tidak dapat dikirim sebelum koneksi aktif.</p>}
      {data.daily_day && <p className="mt-2">Pemeriksaan pagi {data.daily_day}: {data.daily_checked} klien diperiksa, {data.daily_matched} memiliki aset yang memenuhi syarat{data.daily_completed_at ? ". Selesai." : ". Masih berjalan."}</p>}
      {data.daily_completed_at && data.daily_matched === 0 && <p className="mt-2 text-slate-400">Belum ada aset yang memenuhi seluruh kriteria dan belum pernah dikirim. Lelang lebih dari satu bulan sejak tanggal lelang tidak dikirim otomatis.</p>}
      {data.next_daily_at && <p className="mt-1 text-xs text-slate-400">Pemeriksaan pagi berikutnya {time(data.next_daily_at)}. Jika server sempat berhenti, pemeriksaan dilanjutkan saat aktif kembali dalam jam kirim.</p>}
      <p className="mt-2">{data.delivered} aset sudah dikirim · {data.pending} aset dalam antrean{data.awaiting_ack > 0 ? ` · ${data.awaiting_ack} kiriman menunggu pencatatan CRM` : ""}.</p>
      <p className="mt-1 text-xs text-slate-400">{data.last_scan_at ? `Terakhir diperiksa ${time(data.last_scan_at)}.` : "Pemeriksaan pertama dimulai setelah WhatsApp terhubung."}{data.last_sent_at ? ` Terakhir dikirim ${time(data.last_sent_at)}.` : ""}</p>
      {data.last_error && <p className="mt-3 text-amber-200">Pemeriksaan sedang terkendala. Antrean tersimpan dan akan diperiksa kembali.</p>}
      {data.uncertain > 0 && <p role="alert" className="mt-3 text-amber-200">{data.uncertain} kiriman perlu diperiksa di WhatsApp karena status pengirimannya belum pasti. Kiriman tersebut tidak diulang otomatis.</p>}
      {data.needs_review.map(row => <div key={row.id} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/20 p-3">
        <span>+{row.contact} · {time(row.created_at)}</span>
        <a href={`https://wa.me/${row.contact}`} target="_blank" rel="noopener noreferrer" className="underline">Periksa chat</a>
        <button type="button" disabled={busy} onClick={() => update({ delivery_id: row.id, resolution: "delivered" })} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-50">Sudah terkirim</button>
        <button type="button" disabled={busy} onClick={() => update({ delivery_id: row.id, resolution: "skipped" })} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-50">Lewati kiriman</button>
      </div>)}
    </>}
  </section>;
}
