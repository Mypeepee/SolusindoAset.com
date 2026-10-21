"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Bot, Check, CheckCheck, CircleHelp, Link2Off, Loader2,
  LockKeyhole, MessageCircle, QrCode, RefreshCw, ShieldCheck, Smartphone, Wifi, X,
} from "lucide-react";
import { needsNewSession } from "@/lib/chatbot/types";
import { useWhatsAppConnection } from "./useWhatsAppConnection";
import { primaryButton as primary, secondaryButton as secondary, destructiveButton } from "./integration-ui";
import styles from "./integration.module.css";
import WhatsAppPhoneForm from "./WhatsAppPhoneForm";

export type WhatsAppController = ReturnType<typeof useWhatsAppConnection>;

function ConnectionVisual({ connected }: { connected: boolean }) {
  return <div aria-hidden="true" className="relative mx-auto flex h-[230px] w-full max-w-[260px] items-center justify-center">
    <div className="absolute h-56 w-56 rounded-full border border-emerald-300/[0.06]" />
    <div className="absolute h-40 w-40 rounded-full border border-emerald-300/10 bg-emerald-300/[0.025]" />
    <div className="relative flex h-[190px] w-[112px] -rotate-6 flex-col rounded-[25px] border border-white/20 bg-gradient-to-br from-[#242c29] to-[#101713] p-2 shadow-[12px_18px_40px_-12px_rgba(0,0,0,0.9)]">
      <div className="mx-auto h-1 w-7 rounded-full bg-black/60" />
      <div className="mx-auto mt-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-emerald-300/15 text-emerald-300"><MessageCircle size={25} strokeWidth={1.5} /></div>
      <div className="mt-5 space-y-2 px-1"><div className="h-3 w-12 rounded-full bg-white/10" /><div className="ml-auto h-5 w-16 rounded-md rounded-br-none bg-emerald-300/20" /><div className="h-3 w-14 rounded-full bg-white/[0.08]" /></div>
      <div className="mx-auto mt-auto h-0.5 w-8 rounded-full bg-white/20" />
    </div>
    <div className="absolute left-0 top-11 hidden items-center gap-2.5 rounded-xl border border-white/10 bg-[#151b18]/95 p-2.5 shadow-xl backdrop-blur-sm sm:flex"><span className="rounded-lg bg-emerald-300/10 p-2 text-emerald-300"><Bot size={17} strokeWidth={1.5} /></span><div><p className="text-[10px] font-medium text-zinc-200">Asisten AI</p><p className="mt-1 text-[9px] text-emerald-300">{connected ? "Siap membantu" : "Siap terhubung"}</p></div></div>
    <div className="absolute bottom-9 right-0 hidden items-center gap-1.5 rounded-lg border border-emerald-300/15 bg-[#122019]/95 px-2.5 py-2 text-[10px] font-medium text-emerald-300 backdrop-blur-sm sm:flex">{connected ? <CheckCheck size={14} /> : <QrCode size={14} />}{connected ? "Koneksi aktif" : "Satu scan, siap mulai"}</div>
  </div>;
}

export default function WhatsAppConnection({ connection, open, setOpen, onGuide }: {
  connection: WhatsAppController; open: boolean; setOpen: (open: boolean) => void; onGuide: () => void;
}) {
  const [useCode, setUseCode] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const disconnectRef = useRef<HTMLButtonElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const { status, pairing, loading, working, online, error, refresh, act } = connection;
  const connected = online && !!status?.connected;
  const reset = needsNewSession(status?.status);
  const unavailable = !loading && !online;
  const showQr = !connected && !reset && !useCode && !pairing.code;
  const blocked = ["NOT_CONFIGURED", "FORBIDDEN", "UNAUTHENTICATED"].includes(error?.code || "");
  const formattedPhone = status?.phone ? `+${status.phone.replace(/^(\d{2})(\d{3})(\d{4})(\d+)$/, "$1 $2 $3 $4")}` : "WhatsApp Anda";
  const begin = async () => { setUseCode(false); setOpen(true); if (!reset) await act("connect"); };
  const disconnect = async () => { if (await act("disconnect")) setDisconnectOpen(false); };

  return <>
    <section aria-labelledby="connection-title" className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#13201a] via-[#0e1511] to-[#0b0e0c]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,rgba(110,231,183,0.07),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2.5"><span className="rounded-lg bg-emerald-300/10 p-2 text-emerald-300"><MessageCircle size={17} strokeWidth={1.6} /></span><span className="text-sm font-medium text-white">WhatsApp</span><span className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-zinc-400">CHANNEL</span></div>
        <ShieldCheck size={17} className="text-emerald-300/60" aria-label="Koneksi dilindungi" />
      </div>
      <div className="relative isolate grid flex-1 items-center gap-2 px-5 py-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] sm:px-7 sm:py-8 lg:grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="relative z-10 min-w-0">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">Koneksi yang membuka peluang</p>
          <AnimatePresence initial={false} mode="wait">
            <motion.div key={connected ? "connected" : "disconnected"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
              <h2 id="connection-title" className="text-[28px] font-medium leading-[1.18] tracking-[-0.045em] text-white sm:text-[34px]">{connected ? <>Terhubung.<br /><span className="text-emerald-300">Peluang terus berjalan.</span></> : <>Percakapan berjalan.<br /><span className="text-emerald-300">Anda fokus closing.</span></>}</h2>
              <p className="mt-4 max-w-[330px] text-[13px] leading-6 text-zinc-400">{connected ? "Asisten menyambut pertanyaan dan membantu mengenali kebutuhan prospek. Anda pegang kendali selanjutnya." : "Hubungkan WhatsApp Anda. Biarkan asisten menyambut pertanyaan dan mengenali prospek, kapan pun dibutuhkan."}</p>
              {connected && <p className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2 text-sm font-medium tabular-nums text-emerald-300"><Smartphone size={14} /><span className="break-all">{formattedPhone}</span><span className={`h-1.5 w-1.5 rounded-full bg-emerald-300 ${styles.livePulse}`} /></p>}
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <motion.button ref={connectButtonRef} type="button" onClick={connected ? onGuide : () => void begin()} disabled={loading || blocked || working} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className={`${primary} relative isolate ${!connected && !loading && !working && !blocked ? styles.connectPulse : ""}`}>{loading || working ? <Loader2 size={17} className="motion-safe:animate-spin" /> : connected ? <CheckCheck size={17} /> : <QrCode size={17} />}{connected ? "Uji koneksi" : reset ? "Hubungkan kembali" : "Hubungkan WhatsApp"}<ArrowRight size={15} /></motion.button>
            {connected && <motion.button ref={disconnectRef} type="button" onClick={() => setDisconnectOpen(true)} disabled={working} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={destructiveButton}><Link2Off size={14} />Putuskan Koneksi</motion.button>}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-zinc-500"><LockKeyhole size={11} className="mt-1 shrink-0" />{connected ? "Kelola perangkat langsung dari halaman ini." : "Tanpa salin token. Cukup pindai QR dari ponsel."}</p>
        </div>
        <div className="pointer-events-none absolute -right-10 top-1/2 w-[260px] -translate-y-1/2 select-none opacity-70 [mask-image:linear-gradient(to_right,transparent,black_30%)] sm:relative sm:right-auto sm:top-auto sm:min-w-0 sm:w-auto sm:translate-y-0 sm:opacity-100 sm:[mask-image:none] lg:hidden xl:block"><ConnectionVisual connected={connected} /></div>
      </div>
      {error && !open && !disconnectOpen && <div role="alert" className="rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4 text-xs leading-6 text-amber-100/90 mx-5 mb-4 sm:mx-7"><div className="flex items-start gap-2"><CircleHelp size={16} className="mt-1 shrink-0" /><p>{error.message} {!blocked && <button type="button" onClick={() => void refresh()} className="inline-flex min-h-11 items-center underline underline-offset-4">Coba lagi</button>}{error.code === "UNAUTHENTICATED" && <Link href="/signin" className="inline-flex min-h-11 items-center underline underline-offset-4">Masuk kembali</Link>}</p></div></div>}
      <div className="relative border-t border-white/[0.06] bg-black/10 px-5 py-4 sm:px-7">
        {connected ? <div className="flex items-start gap-2.5"><Check size={15} className="mt-0.5 shrink-0 text-emerald-300" /><p className="text-[11px] leading-5 text-zinc-400">Saat Anda mengambil alih, bot berhenti menjawab untuk kontak tersebut.</p></div> : <ol className="grid gap-3 min-[480px]:grid-cols-3">{["Buka WhatsApp", "Perangkat tertaut", "Pindai kode QR"].map((step, index) => <li key={step} className="flex items-center gap-2 text-[11px] text-zinc-400"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/15 text-[9px] tabular-nums text-emerald-300">{index + 1}</span>{step}</li>)}</ol>}
      </div>
    </section>


    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-[200] bg-[#020604]/80 backdrop-blur-md ${styles.overlay}`} />
        <Dialog.Content
          onCloseAutoFocus={(event) => { event.preventDefault(); connectButtonRef.current?.focus(); }}
          className={`${styles.modal} fixed left-1/2 top-1/2 z-[201] max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] border border-white/10 bg-[#101214] p-5 text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.6)] focus:outline-none sm:p-6 ${showQr ? "max-w-[470px] sm:max-w-[720px]" : "max-w-[470px]"}`}
        >
          <Dialog.Close aria-label="Tutup pemasangan WhatsApp" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:right-3 sm:top-3"><X size={18} /></Dialog.Close>
          <div className="flex items-center gap-3 pr-9">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">{connected ? <CheckCheck size={21} /> : <QrCode size={21} />}</span>
            <Dialog.Title className="text-lg font-medium leading-6 tracking-tight sm:text-xl">{connected ? "WhatsApp siap menemani Anda." : reset ? "Hubungkan kembali WhatsApp" : useCode || pairing.code ? "Tautkan dengan nomor" : "Satu scan. Langsung terhubung."}</Dialog.Title>
          </div>

          <div className={`mt-4 ${showQr ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-start sm:gap-6" : ""}`}>
            <div className="min-w-0">
              <Dialog.Description className="text-[13px] leading-6 text-slate-400">{connected ? "Pemasangan berhasil. Coba percakapan pertama untuk memastikan asisten merespons." : reset ? "Sesi sebelumnya sudah berakhir. Buat pemasangan baru untuk melanjutkan." : useCode || pairing.code ? "Masukkan nomor WhatsApp yang ingin Anda hubungkan." : <><span className="sm:hidden">Buka WhatsApp → Perangkat tertaut → Tautkan perangkat, lalu pindai QR.</span><span className="hidden sm:inline">Hubungkan WhatsApp dari ponsel yang ingin Anda gunakan.</span></>}</Dialog.Description>
              {error && <div role="alert" className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-3 text-xs leading-5 text-amber-100">{error.message}</div>}
              {showQr && <>
                <ol className="mt-4 hidden space-y-3 sm:block">
                  {[
                    { title: "Buka WhatsApp", detail: "Gunakan ponsel dengan akun Anda." },
                    { title: "Pilih Perangkat tertaut", detail: "Buka melalui menu atau Pengaturan." },
                    { title: "Tautkan perangkat", detail: "Arahkan kamera ke kode QR di samping." },
                  ].map((step, index) => <li key={step.title} className="flex items-start gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.04] text-[10px] text-emerald-300">{index + 1}</span><div><p className="text-xs font-medium leading-5 text-slate-200">{step.title}</p><p className="text-[11px] leading-5 text-slate-500">{step.detail}</p></div></li>)}
                </ol>
                {status?.status === "connection_failed" || unavailable
                  ? <button onClick={() => void act("connect")} disabled={working || blocked} className={`${secondary} mt-3 hidden w-full sm:inline-flex`}><RefreshCw size={15} />Coba hubungkan lagi</button>
                  : <button onClick={() => setUseCode(true)} disabled={working || status?.status !== "awaiting_scan"} className="mt-3 hidden min-h-11 items-center text-left text-xs leading-5 text-slate-400 transition-colors hover:text-emerald-300 disabled:opacity-40 sm:inline-flex"><span>Tidak bisa scan? <span className="text-emerald-300">Gunakan nomor telepon</span></span></button>}
              </>}
            </div>

            {showQr && <div className="min-w-0">
              <div className="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-white/10 bg-white p-2.5">
                {pairing.qr ? <img src={pairing.qr} alt="QR untuk menautkan WhatsApp Anda" width={220} height={220} className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-3 px-4 text-center text-[#376144]"><Loader2 size={28} strokeWidth={1.5} className="motion-safe:animate-spin" /><span className="text-xs leading-5">{status?.status === "pairing" ? "Menyelesaikan pemasangan…" : "Menyiapkan koneksi Anda…"}</span></div>}
              </div>
              <p role="status" className="mt-2 flex items-start justify-center gap-1.5 text-center text-[11px] leading-5 text-slate-400"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${pairing.qr ? "bg-emerald-300 motion-safe:animate-pulse" : "bg-amber-200"}`} /><span>{pairing.qr ? "Menunggu dipindai · QR diperbarui otomatis" : "Tunggu sebentar, tetap buka WhatsApp Anda"}</span></p>
              {status?.status === "connection_failed" || unavailable
                ? <button onClick={() => void act("connect")} disabled={working || blocked} className={`${secondary} mt-2 w-full sm:hidden`}><RefreshCw size={15} />Coba hubungkan lagi</button>
                : <button onClick={() => setUseCode(true)} disabled={working || status?.status !== "awaiting_scan"} className="mt-1 min-h-11 w-full text-xs leading-5 text-slate-400 transition-colors hover:text-emerald-300 disabled:opacity-40 sm:hidden">Tidak bisa scan? <span className="text-emerald-300">Gunakan nomor telepon</span></button>}
            </div>}
          </div>

          {connected ? <div className="mt-5 text-center"><div className={`${styles.success} mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-300`}><Check size={32} strokeWidth={1.5} /></div><p className="mt-3 text-lg font-medium text-white">{formattedPhone}</p><p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-300"><Wifi size={13} />Koneksi aktif</p><Dialog.Close className={`${primary} mt-4 w-full`}>Selesai<ArrowRight size={16} /></Dialog.Close></div>
            : reset ? <div className="mt-4"><p className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-xs leading-6 text-slate-400">Pemasangan ulang menghapus konteks percakapan dan antrean prospek sementara pada asisten. Pesan di aplikasi WhatsApp Anda tetap tersedia.</p><button className={`${primary} mt-4 w-full`} disabled={working || blocked} onClick={() => void act("pair_again")}>{working ? <Loader2 size={17} className="motion-safe:animate-spin" /> : <RefreshCw size={17} />}Pasangkan ulang</button></div>
            : useCode || pairing.code ? <div className="mt-4">{pairing.code ? <><div aria-live="polite" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] px-2 py-4 text-center font-mono text-2xl tracking-[0.15em] text-emerald-300">{pairing.code.match(/.{1,4}/g)?.join("–")}</div><p className="mt-3 text-xs leading-6 text-slate-400">Di WhatsApp, pilih <strong className="text-slate-200">Tautkan dengan nomor telepon</strong> lalu masukkan kode ini. Selesaikan konfirmasi yang muncul di ponsel.</p></> : <WhatsAppPhoneForm working={working} ready={status?.status === "awaiting_scan"} onSubmit={(phone) => void act("pairing_code", phone)} />}{!pairing.code && <button onClick={() => setUseCode(false)} className="mt-2 min-h-11 w-full text-xs text-slate-400 hover:text-emerald-300">Kembali ke QR</button>}</div> : null}
          {!connected && <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-white/[0.06] pt-3 text-[10px] leading-4 text-slate-500"><LockKeyhole size={11} className="shrink-0" />QR dan kode pemasangan hanya untuk Anda.</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={disconnectOpen} onOpenChange={(next) => { if (!working) setDisconnectOpen(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-[200] bg-black/75 backdrop-blur-md ${styles.overlay}`} />
        <Dialog.Content onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); (connected ? disconnectRef : connectButtonRef).current?.focus(); }} onEscapeKeyDown={(event) => { if (working) event.preventDefault(); }} onPointerDownOutside={(event) => { if (working) event.preventDefault(); }} className={`${styles.modal} fixed left-1/2 top-1/2 z-[201] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/10 bg-[#101214] p-6 text-zinc-100 shadow-2xl outline-none sm:p-8`}>
          <span className="mb-5 inline-flex rounded-2xl border border-red-300/15 bg-red-300/[0.06] p-3 text-red-300"><Link2Off size={23} strokeWidth={1.5} /></span>
          <Dialog.Title className="text-xl font-semibold tracking-tight">Putuskan koneksi WhatsApp?</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-zinc-400">Asisten akan berhenti menerima dan membalas pesan dari {formattedPhone}. Untuk menghubungkan kembali, Anda perlu memindai QR baru.</Dialog.Description>
          <p className="mt-3 text-xs leading-6 text-zinc-500">Pesan di ponsel dan data klien di CRM tetap tersimpan.</p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-6 text-amber-100">{error.message}</p>}
          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close ref={cancelRef} disabled={working} className={secondary}>Tetap terhubung</Dialog.Close>
            <motion.button type="button" onClick={() => void disconnect()} disabled={working} whileTap={{ scale: 0.98 }} className={`${destructiveButton} !min-h-12 !border-red-300/30 !bg-red-300/10`}>{working ? <Loader2 size={15} className="motion-safe:animate-spin" /> : <Link2Off size={15} />}{working ? "Memutuskan…" : "Putuskan Koneksi"}</motion.button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
