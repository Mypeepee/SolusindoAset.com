"use client";

import { useState } from "react";
import { ArrowUpRight, Bot, CheckCheck, Loader2, RefreshCw, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import type { Conversation, ConversationsController } from "./useConversations";
import { secondaryButton } from "./integration-ui";

const updated = (timestamp: number) => new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(timestamp));

const clockTime = (timestamp: number) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
function conversationStatus(row: Conversation) {
  if (row.blocked_reason === "bot_control_contact") return "Nomor kontrol bot · gunakan #boton atau #botoff di WhatsApp";
  if (row.blocked_reason === "internal_stock_contact") return "Nomor petugas cek stok · balasan bot dikecualikan";
  if (row.blocked_reason === "connected_account") return "Akun WhatsApp terhubung · gunakan nomor lain untuk tes";
  if (row.reply_state === "processing") return "Asisten aktif · sedang menyiapkan balasan";
  if (row.reply_state === "delivery_failed") return "Asisten aktif · pengiriman balasan terakhir gagal";
  if (row.reply_state === "waiting_connection") return "Asisten aktif · balasan menunggu WhatsApp terhubung";
  if (row.is_bot_active) return "Asisten aktif";
  if (row.resume_at) return `Jeda balasan manual · kembali aktif ${clockTime(row.resume_at)} WIB`;
  if (row.reason === "manual_cs") return "Dijeda manual · aktifkan saat ingin bot melanjutkan";
  if (row.reason === "purchase_documents_pending_review") return "Menunggu pemeriksaan dokumen oleh agent";
  return "Dialihkan ke agent · perlu diaktifkan kembali secara manual";
}

export default function ConversationControls({ controller }: { controller: ConversationsController }) {
  const { data, loading, refreshing, error, busy, refresh, toggle } = controller;
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const attention = data?.attention ?? 0;
  const rows = data?.items.filter((row) => filter === "all" || !row.is_bot_active && !row.blocked_reason) ?? [];
  const pauseSeconds = data?.manual_pause_seconds ?? 300;
  const pauseDescription = pauseSeconds < 0 ? "Balasan manual menjeda bot sampai Anda mengaktifkannya kembali."
    : pauseSeconds === 0 ? "Setelah balasan manual, bot kembali menjawab pada pesan klien berikutnya."
      : `Balasan manual menjeda bot ${pauseSeconds >= 60 ? `${Math.ceil(pauseSeconds / 60)} menit` : `${pauseSeconds} detik`} sejak balasan Anda yang terakhir; pesan klien tidak memperpanjang jeda.`;

  return (
    <section id="prospects" aria-labelledby="prospects-title" className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-[#0c0e10]/90 ${attention ? "border-amber-300/20" : "border-white/10"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${attention ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-200" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}><UserRound size={18} /></span>
          <div><h2 id="prospects-title" className="text-sm font-semibold text-white">Kendali percakapan</h2><p className="mt-1.5 text-xs leading-5 text-zinc-400">Lihat alasan jeda, waktu bot kembali, dan pesan yang menunggu.</p></div>
        </div>
        <div className="flex items-center gap-2">
          {data && <span className={`rounded-full border px-2.5 py-1 text-xs tabular-nums ${attention ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-200" : "border-white/10 text-zinc-400"}`}>{attention} percakapan</span>}
          <button type="button" onClick={() => void refresh()} disabled={refreshing || !!busy} aria-label="Perbarui percakapan" className={`${secondaryButton} !min-h-11 !px-3`}><RefreshCw size={15} className={refreshing ? "motion-safe:animate-spin" : ""} /></button>
        </div>
      </div>
      <div className="flex gap-1 border-y border-white/[0.06] px-4" role="group" aria-label="Filter percakapan">
        {([{ value: "attention", label: "Perlu perhatian" }, { value: "all", label: "Semua percakapan" }] as const).map((tab) => <button type="button" key={tab.value} aria-pressed={filter === tab.value} onClick={() => setFilter(tab.value)} className={`relative min-h-12 px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:px-3 ${filter === tab.value ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
          {tab.label}{filter === tab.value && <motion.span layoutId="conversation-filter" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-300" />}
        </button>)}
      </div>
      {error && <p role="alert" className="m-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100">{error}{data && " Data terakhir mungkin belum terkini."}</p>}
      {loading ? <p role="status" className="flex items-center gap-2 p-6 text-sm text-zinc-400"><Loader2 size={16} className="motion-safe:animate-spin" />Memuat percakapan…</p> : !rows.length && data ? <div className="flex flex-col items-center px-5 py-10 text-center"><span className="mb-3 rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-emerald-300"><CheckCheck size={22} strokeWidth={1.5} /></span><p className="text-sm font-medium text-zinc-200">{filter === "attention" ? "Semua tertangani." : "Percakapan pertama dimulai di sini."}</p><p className="mt-2 max-w-sm text-xs leading-6 text-zinc-400">{filter === "attention" ? "Percakapan yang dialihkan ke agent akan muncul di sini." : "Setelah ada pesan WhatsApp masuk, Anda dapat mengatur bot untuk setiap kontak."}</p></div> : <div className="max-h-[420px] overflow-y-auto">
        {rows.map((row) => <div key={row.contact} className={`flex flex-col gap-4 border-b border-white/[0.05] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${row.is_bot_active ? "" : "bg-amber-300/[0.025]"}`}>
          <div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium ${row.is_bot_active ? "bg-emerald-300/[0.08] text-emerald-300" : "bg-amber-300/[0.08] text-amber-200"}`}><UserRound size={17} /></span><div className="min-w-0"><p className="break-all text-sm font-medium tabular-nums text-zinc-200">{row.contact.startsWith("lid:") ? `Kontak WhatsApp ${row.contact.slice(4)}` : `+${row.contact}`}</p><p className={`mt-1 text-[11px] leading-5 ${row.is_bot_active ? "text-emerald-300/80" : "text-amber-200/90"}`}>{conversationStatus(row)}<span className="text-zinc-500"> · {updated(row.updated_at)}</span></p>{row.pending_reply && !row.blocked_reason && <p className="mt-1 text-[11px] leading-5 text-zinc-400">Pesan terakhir klien akan dilanjutkan saat bot kembali aktif.</p>}</div></div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!row.contact.startsWith("lid:") && <a href={`https://wa.me/${row.contact}`} target="_blank" rel="noopener noreferrer" className={`${secondaryButton} !text-xs`} aria-label={`Buka WhatsApp +${row.contact}`}>Buka chat<ArrowUpRight size={14} /></a>}
            {!row.blocked_reason && <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} disabled={!!busy} onClick={() => void toggle(row)} className={`${secondaryButton} !text-xs`}>{busy === row.contact ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <Bot size={14} />}{row.is_bot_active ? "Jeda bot" : row.pending_reply ? "Aktifkan & lanjutkan" : "Aktifkan bot"}</motion.button>}
          </div>
        </div>)}
      </div>}
      <p className="border-t border-white/[0.06] px-5 py-4 text-[11px] leading-5 text-zinc-500 sm:px-6">{pauseDescription} Dari WhatsApp agen yang terhubung, kirim <span className="font-mono text-zinc-300">#boton nomor_klien</span> ke <span className="font-mono text-zinc-300">+{data?.bot_control_phone || "6282266100102"}</span> untuk mengaktifkan bot. <span className="font-mono text-zinc-300">#botoff nomor_klien</span> menjeda tanpa batas waktu. Konfirmasi masuk ke chat kontrol. Tombol Jeda bot dan handover khusus tetap memerlukan aktivasi manual.{data && data.total > data.items.length ? ` Menampilkan ${data.items.length} dari ${data.total} percakapan; prioritas untuk yang membutuhkan agent.` : ""}</p>
    </section>
  );
}
