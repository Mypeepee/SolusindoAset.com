"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { assetCheckQueue, type AssetCheckQueue as Queue } from "@/lib/chatbot/asset-checks";

const endpoint = "/api/dashboard/chatbot/checks";
const day = (value: string | number) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(new Date(value));
const notificationLabels = { pending: "Menunggu pengiriman", sending: "Sedang dikirim", retry: "Pengiriman tertunda · dicoba lagi otomatis", sent: "Pesan konfirmasi sudah dikirim", failed: "Gagal dikirim · perlu ditindaklanjuti", uncertain: "Pengiriman belum dapat dipastikan · periksa WhatsApp sebelum mencoba lagi" };
const issueLabels: Record<string, string> = { STOCK_ASSET_CHANGED: "Status atau jadwal aset sudah berubah · permintaan ini perlu diperiksa kembali", STOCK_RECIPIENT_CHANGED: "Nomor tujuan stoker sudah berubah · permintaan lama perlu diperiksa kembali", STOCK_REQUIRES_BAILEYS: "Pengiriman stok memerlukan koneksi WhatsApp Baileys", STOCK_RECIPIENT_IS_SENDER: "Nomor stoker sama dengan nomor WhatsApp pengirim · perbarui tujuan pengiriman" };

export default function AssetCheckQueue() {
  const [queue, setQueue] = useState<Queue | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [working, setWorking] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({}), [references, setReferences] = useState<Record<string, string>>({});
  const mounted = useRef(false), fetching = useRef(false);
  const mutating = useRef(false), revision = useRef(0);
  const refresh = useCallback(async () => {
    if (fetching.current || mutating.current) return;
    fetching.current = true;
    const version = revision.current;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const data = assetCheckQueue(await response.json());
      if (!data) throw new Error();
      if (mounted.current && version === revision.current) { setQueue(data); setError(""); }
    } catch { if (mounted.current && version === revision.current) setError("Antrean belum dapat dimuat. Silakan coba lagi."); }
    finally { fetching.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [refresh]);

  const complete = async (id: string) => {
    if (mutating.current) return;
    const result = verdicts[id], reference = references[id]?.trim();
    if (!result || result !== "unknown" && !reference) { setError("Pilih hasil pengecekan dan tulis sumber konfirmasi stok terlebih dahulu."); return; }
    mutating.current = true; revision.current += 1;
    setWorking(id); setError("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed",
          ...(result !== "unknown" ? { result, reference } : {}) }) });
      if (!response.ok) throw new Error();
      if (mounted.current) setQueue((current) => current ? { total: Math.max(0, current.total - 1), items: current.items.filter((item) => item.id !== id) } : current);
      mutating.current = false; await refresh();
    } catch { if (mounted.current) setError("Catatan belum dapat ditutup. Periksa kembali lalu coba lagi."); }
    finally { mutating.current = false; if (mounted.current) setWorking(null); }
  };

  const retry = async (id: string) => {
    if (mutating.current) return;
    mutating.current = true; revision.current += 1; setWorking(id); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(25000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error();
      mutating.current = false; await refresh();
    } catch { if (mounted.current) setError("Pengiriman ulang belum dapat diproses. Periksa status terbaru sebelum mencoba lagi."); }
    finally { mutating.current = false; if (mounted.current) setWorking(null); }
  };

  return <section aria-labelledby="asset-check-title" className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b100e]">
    <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-2.5 text-amber-200/80"><ClipboardList size={18} /></span>
        <div><h2 id="asset-check-title" className="text-sm font-medium text-slate-200">Perlu cek status lelang{queue && <span className="ml-2 inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">{queue.total}</span>}</h2>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-500">Permintaan dari prospek untuk aset yang jadwalnya sudah terlewat. Tim perlu memastikan hasil lelang atau rencana lelang ulang bersama pihak terkait.</p></div>
      </div>
      <button onClick={() => void refresh()} disabled={loading || !!working} aria-label="Perbarui antrean pengecekan" className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><RefreshCw size={16} className={loading ? "motion-safe:animate-spin" : ""} /></button>
    </div>
    {error && <p role="alert" className="mx-5 mb-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-3 text-xs leading-5 text-amber-100 sm:mx-6">{error}</p>}
    {loading ? <p role="status" className="flex items-center gap-2 border-t border-white/[0.06] p-5 text-xs text-slate-500"><Loader2 size={14} className="motion-safe:animate-spin" />Memuat permintaan pengecekan…</p> : queue?.items.length ? <>
      <div className="max-h-[380px] overflow-y-auto border-t border-white/[0.06]">
        {queue.items.map((item) => <div key={item.id} className="flex flex-col gap-3 border-b border-white/[0.05] p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0"><p className="break-words text-sm font-medium text-slate-200">Kode {item.asset_id}<span className="ml-2 font-normal text-slate-400">{item.location || "Lokasi belum dicantumkan"}</span></p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">Jadwal tercatat: {day(item.auction_at)} · Permintaan: {day(item.created_at)}</p>
            <p className="mt-1 break-all text-xs text-slate-400">{item.contact.startsWith("lid:") ? `Kontak WhatsApp ${item.contact}` : `Prospek +${item.contact}`}</p>
            <p className={`mt-2 text-xs leading-5 ${item.notification_status === "sent" ? "text-primary" : "text-amber-200/80"}`}>{item.notification_status ? issueLabels[item.notification_error || ""] || notificationLabels[item.notification_status] : "Catatan lama · belum ada pengiriman otomatis"}{item.notification_recipient ? ` · Stoker +${item.notification_recipient}` : ""}</p>
            {item.notification_status === "sent" && <p className="mt-1 text-[11px] leading-5 text-slate-500">Menunggu konfirmasi stok; status kirim belum berarti pesan sudah dibaca atau dijawab.</p>}</div>
          <div className="flex shrink-0 flex-col gap-2 sm:max-w-xs">
            <label className="text-xs text-slate-400">Hasil pengecekan stok
              <select value={verdicts[item.id] || ""} onChange={(event) => setVerdicts((current) => ({ ...current, [item.id]: event.target.value }))}
                disabled={!!working} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b100e] p-2 text-xs text-slate-200">
                <option value="">Pilih hasil pengecekan</option><option value="available">Dikonfirmasi masih tersedia</option>
                <option value="sold">Dikonfirmasi sudah terjual</option><option value="unknown">Tutup catatan, stok belum pasti</option>
              </select>
            </label>
            {verdicts[item.id] && verdicts[item.id] !== "unknown" && <label className="text-xs text-slate-400">Sumber konfirmasi
              <input value={references[item.id] || ""} maxLength={300} disabled={!!working}
                onChange={(event) => setReferences((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Contoh: jawaban stoker, 18 Oktober pukul 10.30"
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b100e] p-2 text-xs text-slate-200" />
            </label>}
            <div className="flex flex-wrap gap-2">
            {item.notification_status && item.notification_error !== "STOCK_ASSET_CHANGED" && ["retry", "failed", "uncertain"].includes(item.notification_status) && <button onClick={() => void retry(item.id)} disabled={!!working} className="min-h-10 rounded-xl border border-amber-200/20 px-3 text-xs text-amber-100 hover:bg-amber-100/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{working === item.id ? "Memproses…" : "Coba kirim lagi"}</button>}
            <button onClick={() => void complete(item.id)} disabled={!!working} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-primary/15 bg-primary/[0.04] px-3 text-xs font-medium text-primary transition-all duration-300 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:self-auto">{working === item.id ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <Check size={14} />}Tandai selesai</button>
            </div>
          </div>
        </div>)}
      </div>
      <p className="border-t border-white/[0.06] px-5 py-4 text-[11px] leading-5 text-slate-500 sm:px-6">Catat hasil dan sumber konfirmasi agar bot mengetahui langkah berikutnya saat prospek membalas. Tetap perbarui listing jika status atau jadwal berubah. Menutup catatan tanpa kepastian stok tidak membuka tahap DP. Tidak ada pesan proaktif yang dikirim.{queue.total > queue.items.length ? ` Menampilkan ${queue.items.length} permintaan terlama dari ${queue.total}.` : ""}</p>
    </> : queue && <p className="border-t border-white/[0.06] px-5 py-5 text-xs leading-6 text-slate-500 sm:px-6">Belum ada permintaan yang menunggu pengecekan. Permintaan dari percakapan WhatsApp akan muncul di sini; pengujian Playground tidak masuk antrean.</p>}
  </section>;
}
