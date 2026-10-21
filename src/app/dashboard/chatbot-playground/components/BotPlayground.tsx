"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, Check, CheckCheck, ChevronRight, Code2, FlaskConical,
  LockKeyhole, MapPin, MessageSquare, Plus, RotateCcw, Send,
  ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles,
} from "lucide-react";
import { propertyTemplate, playgroundHistory, isPlaygroundResponse, type PlaygroundProperty, type PlaygroundAttachment } from "@/lib/chatbot/playground";
import { playgroundFailure, playgroundErrorMessage } from "@/lib/chatbot/playground-errors";
import EmojiText from "./EmojiText";

type Message = { id: number; role: "user" | "assistant"; text: string; time: string; attachments?: PlaygroundAttachment[]; documentError?: boolean };

export const PROPERTY_TEMPLATE = `Halo Jason Christopher Liendo 👋

Saya tertarik dengan properti lelang berikut, apakah masih tersedia?

🔨 *Tanah & Bangunan · LT 72 m²*
📍 Candi, Sidoarjo
💰 *Rp110.000.000*
🔖 Kode: *169312*

Mohon infonya, terima kasih! 🙏`;

export const SANDBOX_PERSONA = `Asisten Virtual Properti resmi Solusindo Aset, mewakili Jason Christopher Liendo.

MODE KONSULTATIF DAN RESPONSIF
Bantu permintaan pencarian properti secara aktif, termasuk tanpa kode atau link. Konfirmasi area, lengkapi anggaran dan tujuan yang belum diketahui, lalu tampilkan pilihan dari database. Bahasa informal ditanggapi dengan klarifikasi, bukan penghentian percakapan.

KUNCI KONTEKS
Jawab hanya aset yang dipilih: ketersediaan, harga limit, luas, lokasi dan alur dasar lelang. Aset lain hanya jika diminta secara eksplisit.

PENGECUALIAN JADWAL TERLEWAT
Jika aset Tersedia tetapi jadwal lelangnya terlewat, jelaskan perlunya konfirmasi status lalu tanyakan area pencarian untuk opsi cadangan. Setelah area dijawab, lengkapi budget/tujuan yang belum diketahui. Jangan mengulang pertanyaan atau menawarkan daftar sebelum kriterianya cukup. Jika pelanggan menolak alternatif, tetap fokus pada aset awal.

BATAS KEWENANGAN
Tidak menawar, mengubah limit, menyetujui transaksi atau memastikan status hukum. Negosiasi, survei/viewing dan dokumen SHM/Grosse dialihkan ke Jason; bot berhenti membalas sampai manusia mengaktifkannya kembali. Maksud yang belum jelas ditanyakan dengan sopan.

DATA DAN SESI
Hanya data properti publik, tanpa password atau keuangan perusahaan. Data yang belum ada perlu konfirmasi agen. Grup, broadcast dan status diabaikan. Konteks direset setelah 45 menit tanpa pesan pelanggan; handoff tetap berhenti sampai diaktifkan manusia.`;

const SCENARIOS = [
  { label: "Cari Manukan", text: "Bisa tolong carikan saya aset di Manukan kah pak?" },
  { label: "Cari Citraland", text: "Cari rumah di Citraland." },
  { label: "Cari Northwest", text: "Cari properti di Northwest." },
  { label: "Detail lokasi", text: "Alamat lengkap aset ini di mana?" },
  { label: "Fasilitas sekitar", text: "Aset ini dekat apa saja? Sertakan jarak yang tercatat." },
  { label: "Tujuan investasi", text: "Saya tertarik untuk investasi. Apa saja yang perlu saya pertimbangkan?" },
  { label: "Survei lokasi", text: "Saya ingin survei lokasi bersama agent." },
];

function MessageText({ text }: { text: string }) {
  // Render text as React nodes, never HTML; only HTTP(S) links are clickable.
  return <>{text.split(/(https?:\/\/[^\s<>*"']+|\*[^*\n]+\*)/g).map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,!?;:)]+$/, "");
      return <Fragment key={index}><a href={href} target="_blank" rel="noopener noreferrer"
        className="rounded-sm font-medium underline decoration-current/40 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#77b98c]"
        aria-label={`Buka tautan ${href}`}>{/\/(?:Lelang|Jual|Sewa)\//i.test(href) ? "Buka detail properti ↗" : href}</a>{part.slice(href.length)}</Fragment>;
    }
    return part.startsWith("*") && part.endsWith("*")
      ? <strong key={index} className="font-semibold"><EmojiText text={part.slice(1, -1)} /></strong> : <EmojiText key={index} text={part} />;
  })}</>;
}

function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl border border-[#b5d5bd] bg-gradient-to-br from-[#e0f3e4] to-[#c5e7cc] text-[#285638] ${small ? "h-8 w-8 rounded-xl" : "h-11 w-11"}`}>
      <Sparkles size={small ? 15 : 21} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5" role="status" aria-label="Bot is typing...">
      <BotAvatar small />
      <div className="rounded-2xl rounded-bl-md border border-[#e6ece8] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(25,50,34,0.03)]">
        <span className="mb-2 block text-[10px] font-medium text-[#819087]">Bot is typing...</span>
        <div className="flex h-3 items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-[#6b8c74] motion-safe:animate-bounce [animation-duration:1.2s]" style={{ animationDelay: `${dot * 160}ms` }} />)}
        </div>
      </div>
    </div>
  );
}

export default function BotPlayground() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [injected, setInjected] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "config">("chat");
  const [announcement, setAnnouncement] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const previousId = useRef<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const [property, setProperty] = useState<PlaygroundProperty | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [propertyError, setPropertyError] = useState("");
  const [error, setError] = useState("");
  const [failedDraft, setFailedDraft] = useState("");
  const [retryUntil, setRetryUntil] = useState(0), [clock, setClock] = useState(0);
  const [generationMode, setGenerationMode] = useState("");
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - clock) / 1000));
  const activeRequestId = useRef<string | null>(null);
  const cancellation = useRef<Promise<unknown>>(Promise.resolve());
  const [knowledgeStatus, setKnowledgeStatus] = useState("");
  const botPaused = ["handover_simulated", "human_handoff_paused"].includes(knowledgeStatus);
  const injectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);
  const sending = useRef(false);
  const followLatest = useRef(false);

  const cancelOnServer = (id: string | null) => {
    if (!id) return;
    const request = fetch("/api/dashboard/chatbot/playground", { method: "DELETE", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id }), signal: AbortSignal.timeout(8000) }).catch(() => undefined);
    cancellation.current = Promise.allSettled([cancellation.current, request]);
  };

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
    cancelOnServer(activeRequestId.current); activeRequestId.current = null;
    if (injectTimer.current) clearTimeout(injectTimer.current);
  }, []);

  useEffect(() => {
    if (!retryUntil) return;
    setClock(Date.now());
    const timer = setInterval(() => { const time = Date.now(); setClock(time); if (time >= retryUntil) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [retryUntil]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/chatbot/playground", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) setProperty(data.property || null); })
      .catch(() => { if (!controller.signal.aborted) setPropertyError("Data contoh belum dapat dimuat. Anda tetap bisa menguji dengan mengetik kode aset."); })
      .finally(() => { if (!controller.signal.aborted) setPropertyLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "0px";
    composer.style.height = `${Math.min(Math.max(composer.scrollHeight, 46), 156)}px`;
  }, [draft, mobilePanel]);

  useEffect(() => {
    const log = logRef.current;
    if (log && followLatest.current) log.scrollTo({ top: log.scrollHeight, behavior: "auto" });
  }, [messages, typing, mobilePanel]);

  const inject = (text = property ? propertyTemplate(property) : PROPERTY_TEMPLATE) => {
    setDraft(text);
    setMobilePanel("chat");
    setInjected(true);
    setAnnouncement("Pesan contoh sudah diisi. Tinjau lalu tekan Kirim.");
    if (injectTimer.current) clearTimeout(injectTimer.current);
    injectTimer.current = setTimeout(() => setInjected(false), 2200);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || botPaused || sending.current || text.length > 4000 || retryUntil > Date.now()) return;
    sending.current = true;
    const controller = new AbortController(); requestRef.current = controller;
    const requestId = crypto.randomUUID(); activeRequestId.current = requestId;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); cancelOnServer(requestId); }, 70000);
    const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const message = { id: nextId.current++, role: "user" as const, text, time };
    const conversation = [...messages, message];
    setMessages(conversation);
    setDraft(""); setTyping(true); setInjected(false); setError(""); setFailedDraft(""); followLatest.current = true;
    setAnnouncement("Membaca data properti dan menyiapkan jawaban AI.");
    composerRef.current?.focus();
    try {
      await cancellation.current;
      if (controller.signal.aborted || requestRef.current !== controller) return;
      const history = playgroundHistory(conversation);
      const response = await fetch("/api/dashboard/chatbot/playground", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ history, previousId: previousId.current, requestId, conversationId: conversationId.current ||= crypto.randomUUID() }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!response.ok) {
        const failure = playgroundFailure(response.status, result, response.headers.get("retry-after"));
        if (failure.retry_after_seconds) { const time = Date.now(); setClock(time); setRetryUntil(time + failure.retry_after_seconds * 1000); }
        throw new Error(playgroundErrorMessage(failure.error));
      }
      if (!isPlaygroundResponse(result)) throw new Error("Jawaban AI belum lengkap. Pesan Anda disimpan untuk dicoba kembali.");
      const replyTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      if (result.reply !== null) {
        const replies = (result.replies || [result.reply]).map((text, index) => ({ id: nextId.current++, role: "assistant" as const, text, time: replyTime,
          ...(index === 0 ? { attachments: result.attachments, documentError: !!result.document_error } : {}) }));
        setMessages((current) => [...current, ...replies]);
      }
      previousId.current = result.session ? result.session.asset_id : result.asset?.id || (result.knowledge.status === "restricted" ? previousId.current : null);
      if (result.asset) { setProperty(result.asset); setPropertyError(""); }
      setKnowledgeStatus(result.knowledge.status);
      setGenerationMode(result.generation?.mode || "");
      setAnnouncement(result.suppressed ? "Bot tidak mengirim balasan pada pesan ini." : "Jawaban AI diterima.");
    } catch (problem) {
      if (requestRef.current !== controller || (controller.signal.aborted && !timedOut)) return;
      setMessages((current) => current.filter((m) => m.id !== message.id));
      setDraft((current) => current.trim() ? current : text); setFailedDraft(text);
      setError(timedOut ? playgroundErrorMessage("SANDBOX_TIMEOUT") : problem instanceof TypeError ? playgroundErrorMessage("SERVICE_UNAVAILABLE") : problem instanceof Error ? problem.message : "Pesan belum diproses. Silakan coba lagi.");
      setAnnouncement("Pesan belum diproses. Isi pesan dikembalikan ke kolom input.");
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { setTyping(false); sending.current = false; requestRef.current = null; activeRequestId.current = null; }
    }
  };

  const reset = () => {
    requestRef.current?.abort();
    cancelOnServer(activeRequestId.current); activeRequestId.current = null;
    if (injectTimer.current) clearTimeout(injectTimer.current);
    requestRef.current = null; previousId.current = null; conversationId.current = null; injectTimer.current = null; sending.current = false;
    setMessages([]); setDraft(""); setTyping(false); setInjected(false); setError((current) => retryUntil > Date.now() ? current : ""); setKnowledgeStatus(""); setFailedDraft(""); setGenerationMode("");
    setAnnouncement("Percakapan direset. Mulai simulasi baru.");
    composerRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-[1380px] pb-5 pt-5 text-slate-100 sm:pt-7">
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-[11px] text-slate-500">
        <a href="/dashboard" className="transition-colors hover:text-slate-200">Workspace</a>
        <ChevronRight size={12} /><a href="/dashboard/chatbot-integration" className="transition-colors hover:text-slate-200">Chatbot</a>
        <ChevronRight size={12} /><span className="text-slate-300">Playground</span>
      </nav>

      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-primary/80"><FlaskConical size={12} />Agent workspace</div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] sm:text-[30px]">AI Bot Playground<span className="text-primary">.</span></h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-400">Rasakan percakapannya. Sempurnakan pengalaman sebelum terhubung.</p>
        </div>
        <a href="/dashboard/chatbot-integration" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.025] px-4 text-xs font-medium text-slate-200 transition-all duration-300 hover:border-primary/30 hover:bg-primary/[0.06] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto">WhatsApp Integration<ArrowRight size={14} /></a>
      </header>

      <p className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs leading-6 text-slate-400">Percakapan Playground tidak menambah klien CRM. Untuk memeriksa penyimpanan sebelum menautkan WhatsApp, buka <a href="/dashboard/chatbot-integration#penyimpanan-klien" className="font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Uji penyimpanan klien</a>.</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1 lg:hidden" role="group" aria-label="Panel playground">
        {([['chat', 'Chat Sandbox', MessageSquare], ['config', 'Bot Configuration', SlidersHorizontal]] as const).map(([value, label, Icon]) => (
          <button key={value} onClick={() => setMobilePanel(value)} aria-pressed={mobilePanel === value} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mobilePanel === value ? "bg-primary/10 text-primary shadow-sm" : "text-slate-400 hover:text-slate-200"}`}><Icon size={14} />{label}</button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside aria-label="Bot configuration and context" className={`${mobilePanel === "config" ? "block" : "hidden"} min-w-0 space-y-4 lg:block`}>
          <section className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0c120f] shadow-[0_8px_30px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h2 className="flex items-center gap-2 text-xs font-medium text-slate-200"><SlidersHorizontal size={14} className="text-slate-500" />Bot Configuration</h2>
              <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">v1.0</span>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">Environment</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-medium text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Testing Mode</span>
              </div>
              <div className="flex gap-3 rounded-xl border border-primary/10 bg-primary/[0.035] p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary"><Bot size={18} strokeWidth={1.5} /></span>
                <div><p className="text-[12px] font-medium leading-5 text-slate-200">Asisten Properti · Konsultatif</p><p className="mt-0.5 text-[10px] text-slate-500">Solusindo Aset · AI + database properti</p></div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-2"><label htmlFor="sandbox-system-prompt" className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300"><Code2 size={13} className="text-slate-500" />System Prompt / Bot Persona</label><span className="flex shrink-0 items-center gap-1 text-[9px] text-slate-500"><LockKeyhole size={9} />Read-only</span></div>
                <textarea id="sandbox-system-prompt" value={SANDBOX_PERSONA} readOnly spellCheck={false} className="h-[252px] w-full resize-none rounded-xl border border-white/[0.06] bg-[#080d0a] p-3.5 font-mono text-[10.5px] leading-[1.9] text-slate-400 [scrollbar-color:#2e4034_transparent] [scrollbar-width:thin] focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10" />
              </div>
              <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-slate-500"><ShieldCheck size={13} className="shrink-0 text-primary/60" />Percakapan ini hanya ada di sandbox.</div>
            </div>
          </section>

          <section className="rounded-[20px] border border-white/[0.08] bg-gradient-to-br from-[#122018] to-[#0c120f] p-5">
            {propertyError && <p className="mb-3 text-xs leading-5 text-amber-200/80">{propertyError}</p>}
            <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-xs font-medium text-slate-200">Property Context</h2><span className="rounded-md border border-primary/15 bg-primary/[0.05] px-1.5 py-0.5 text-[9px] text-primary/80">{propertyLoading ? "MEMUAT" : property ? "DATABASE" : "BELUM DIPILIH"}</span></div>
            <div className="mb-4"><p className="text-[13px] font-medium text-slate-100">{property?.name || "Pilih aset untuk diuji"}</p><p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={11} />{property?.location || "Ketik kode aset pada percakapan"}{property?.land_area_m2 != null && <><span className="mx-1 text-slate-700">·</span>{property.land_area_m2} m²</>}</p></div>
            <div className="mb-5 flex items-end justify-between border-t border-white/[0.06] pt-3"><span className="text-xl font-medium tracking-tight text-primary">{property?.price_display || "—"}</span><span className="rounded-md bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-400">#{property?.id || "—"}</span></div>
            <div className="group relative">
              <button onClick={() => inject()} disabled={!property || propertyLoading} aria-describedby="property-inject-tooltip" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-[11px] font-semibold text-[#173421] shadow-[0_4px_18px_-8px_rgba(153,227,158,0.3)] transition-all duration-300 hover:scale-[1.015] hover:bg-[#b3edb8] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#0c120f]">{injected ? <Check size={15} /> : <WandSparkles size={15} />}{injected ? "Template siap dikirim" : "Quick Inject: Property Template"}</button>
              <span id="property-inject-tooltip" role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-[230px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#24372b] px-3 py-2.5 text-center text-[10px] leading-5 text-slate-200 opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">Mengisi pesan dari data aset yang ditampilkan di kartu ini</span>
            </div>
          </section>

          <section className="px-1 pb-2">
            <h2 className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Coba skenario lain</h2>
            <div className="flex flex-wrap gap-2">{SCENARIOS.map((scenario) => <button key={scenario.label} onClick={() => inject(scenario.text)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 text-[10px] text-slate-400 transition-all duration-300 hover:border-primary/25 hover:bg-primary/[0.04] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus size={11} />{scenario.label}</button>)}</div>
          </section>
        </aside>

        <section aria-label="Chat Sandbox" className={`${mobilePanel === "chat" ? "flex" : "hidden"} h-[720px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e4ebe6] bg-[#f3f6f4] text-[#21362a] shadow-[0_16px_60px_-30px_rgba(0,0,0,0.5)] lg:flex lg:h-[calc(100dvh-240px)] lg:min-h-[650px] lg:max-h-[850px]`}>
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e6ece8] bg-white px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3"><div className="relative"><BotAvatar /><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[3px] border-white bg-[#7caf88]" /></div><div className="min-w-0"><h2 className="truncate text-[13px] font-semibold tracking-[-0.015em] sm:text-[14px]">AI Sales Assistant <span className="font-normal text-[#97a49b]">– Staging</span></h2><p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#86958b]"><span className="h-1 w-1 rounded-full bg-[#a7b8ac]" />Asisten Properti · Konsultatif</p></div></div>
            <button onClick={reset} disabled={!messages.length && !draft && !typing} aria-label="Reset Conversation" title="Reset Conversation" className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#e6ece8] bg-white px-2.5 text-[10px] font-medium text-[#74867a] transition-all duration-300 hover:border-[#c4d8ca] hover:bg-[#f3f8f4] hover:text-[#2d593b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99e39e] disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw size={14} /><span className="hidden xl:inline">Reset Conversation</span></button>
          </header>

          <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-[#e6ece8] bg-[#edf3ef] px-3 py-2 text-[9px] tracking-wide text-[#7c8d81]"><FlaskConical size={11} /><span>AI + database properti publik · Tidak mengirim WhatsApp</span></div>

          <div ref={logRef} role="log" aria-label="Riwayat percakapan simulasi" aria-live="polite" aria-relevant="additions" onScroll={() => { const log = logRef.current; if (log) followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80; }} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top_right,rgba(189,219,197,0.12),transparent_65%)] px-4 py-6 shadow-[inset_0_2px_8px_rgba(25,50,34,0.025)] [scrollbar-color:#c8d8cc_transparent] [scrollbar-width:thin] sm:px-6">
            {messages.length > 0 && <div className="mb-5 flex items-center justify-center gap-3"><span className="h-px w-9 bg-[#dde6e0]" /><span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#a2afa6]">Sesi pengujian Anda</span><span className="h-px w-9 bg-[#dde6e0]" /></div>}
            {!messages.length && <div className="flex h-full flex-col items-center justify-center px-3 text-center"><span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#dce8df] bg-white text-[#7da989] shadow-[0_4px_20px_-8px_rgba(48,83,58,0.1)]"><MessageSquare size={27} strokeWidth={1.3} /></span><h3 className="text-lg font-medium tracking-tight text-[#35533f]">Percakapan baru. Peluang baru.</h3><p className="mt-2 max-w-[250px] text-xs leading-6 text-[#90a094]">Mulai dengan pesan Anda, atau gunakan template properti untuk mencoba alurnya.</p><button onClick={() => inject()} className="mt-5 flex min-h-10 items-center gap-2 rounded-xl border border-[#c9dfcf] bg-[#e8f3eb] px-4 text-xs font-medium text-[#436c4d] transition-all duration-300 hover:scale-[1.02] hover:bg-[#dcefe1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#99e39e]"><WandSparkles size={14} />{property ? "Gunakan aset dari database" : "Gunakan template contoh"}</button></div>}

            {messages.map((message) => <div key={message.id} className={`flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <BotAvatar small />}
              <article aria-label={message.role === "user" ? "Pesan Anda" : "Balasan bot"} className={`max-w-[90%] rounded-2xl px-4 py-3.5 sm:max-w-[85%] sm:px-5 ${message.role === "user" ? "rounded-br-md border border-[#a7d9b1] bg-[#cef0d5] text-[#24462e] shadow-[0_2px_6px_rgba(25,50,34,0.02)]" : "rounded-bl-md border border-[#e7ece9] bg-white text-[#4c5f53] shadow-[0_2px_10px_rgba(25,50,34,0.035)]"}`}>
                <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.75] [overflow-wrap:anywhere]"><MessageText text={message.text} /></p>
                {message.attachments?.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-xl border border-[#c9dfcf] bg-[#edf5ef] p-3 text-xs text-[#35533f] hover:bg-[#e0eee4]">
                  <strong className="block break-all">PDF · {file.filename}</strong>
                  <span className="mt-1 block">Draf untuk dipelajari · Unduh PDF · Tersedia 15 menit</span>
                  {file.caption && <span className="mt-2 block leading-relaxed">{file.caption}</span>}
                </a>)}
                {message.documentError && <p className="mt-3 text-xs text-amber-800">PDF belum berhasil dibuat. Ketik “kirim ulang PDF MOU” untuk mencoba kembali.</p>}
                <div className={`mt-2 flex items-center justify-end gap-1 text-[9px] ${message.role === "user" ? "text-[#7aa686]" : "text-[#a3afa7]"}`}><span>{message.time}</span>{message.role === "user" && <CheckCheck size={12} strokeWidth={1.5} />}</div>
              </article>
            </div>)}
            {typing && <TypingIndicator />}
          </div>

          <div className="shrink-0 border-t border-[#e4ebe6] bg-white px-4 pb-3 pt-4 sm:px-5">
            {error && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{error}</p>}
            {error && failedDraft && failedDraft !== draft && <details className="mb-3 text-xs text-[#5d7465]"><summary className="cursor-pointer py-1">Lihat pesan yang belum terkirim</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[#f2f6f3] p-3">{failedDraft}</p></details>}
            {retrySeconds > 0 && <p role="status" className="mb-3 text-xs leading-5 text-amber-700">Coba kirim lagi: {retrySeconds < 60 ? `${retrySeconds} detik` : `${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(retryUntil))} WIB`}. Isi pesan tetap tersimpan.</p>}
            {generationMode === "fallback" && <p className="mb-2 flex items-center gap-1.5 text-[10px] text-[#5e8968]"><ShieldCheck size={12} />Balasan menggunakan AI cadangan karena model utama sedang tidak tersedia.</p>}
            {knowledgeStatus === "matched" && <p className="mb-2 flex items-center gap-1.5 text-[10px] text-[#5e8968]"><ShieldCheck size={12} />Jawaban menggunakan data aset #{property?.id}</p>}
            {knowledgeStatus === "auction_check_needed" && <p role="status" className="mb-2 flex items-center gap-1.5 text-[10px] text-amber-700"><ShieldCheck size={12} />Jadwal terlewat · Pengecekan hanya disimulasikan di Playground</p>}
            {["context_required", "waiting_for_property"].includes(knowledgeStatus) && <p role="status" className="mb-2 text-[11px] text-[#5e8968]">Sebutkan area pencarian atau kirim kode/link properti yang ingin dibahas.</p>}
            {botPaused && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><p>Pengujian dijeda setelah percakapan dialihkan ke agen. Mulai percakapan baru untuk mencoba pencarian atau pertanyaan lain.</p><button type="button" onClick={reset} className="mt-2 min-h-9 rounded-lg border border-amber-300 bg-white px-3 font-medium hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">Mulai percakapan baru</button></div>}
            <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2 rounded-2xl border border-[#e1e9e3] bg-[#fafcfb] p-2 shadow-[0_1px_4px_rgba(25,50,34,0.02)] transition-all duration-300 focus-within:border-[#94c8a0] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#99e39e]/10">
              <label htmlFor="sandbox-message" className="sr-only">Pesan untuk simulator</label>
              <textarea ref={composerRef} id="sandbox-message" value={draft} maxLength={4000} rows={1} disabled={botPaused} placeholder={botPaused ? "Mulai percakapan baru untuk melanjutkan…" : "Tulis pesan untuk mencoba asisten…"} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} className="max-h-[156px] min-h-[46px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-3 text-[13px] leading-[22px] text-[#3d5545] placeholder:text-[#a2afa6] focus:outline-none [scrollbar-width:thin]" />
              <button type="submit" disabled={botPaused || !draft.trim() || typing || retrySeconds > 0} aria-label="Kirim pesan" className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#99e39e] text-[#245b32] shadow-[0_3px_10px_-4px_rgba(72,129,84,0.25)] transition-all duration-300 hover:scale-105 hover:bg-[#89d991] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#64a972] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"><Send size={18} strokeWidth={1.7} /></button>
            </form>
            <div className="mt-2.5 flex items-center justify-between gap-3 px-1 text-[9px] text-[#a5b1a9]"><span>Jawaban AI · Data properti dari database</span><span className="hidden sm:inline">Enter untuk kirim<span className="mx-1.5 text-[#d4ddd7]">·</span>Shift + Enter untuk baris baru</span>{draft.length > 3600 && <span className="tabular-nums">{draft.length}/4000</span>}</div>
          </div>
        </section>
      </div>
      <footer className="mt-4 flex items-center justify-between gap-3 px-1 text-[10px] text-slate-600"><span className="flex items-center gap-1.5"><LockKeyhole size={10} />Sesi sementara · Tidak disimpan ke database</span><span className="hidden sm:inline">Solusindo Aset · Sandbox</span></footer>
    </div>
  );
}
