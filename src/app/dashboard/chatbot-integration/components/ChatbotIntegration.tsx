"use client";

import { useRef, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, CircleHelp, LockKeyhole, SlidersHorizontal } from "lucide-react";
import AssetCheckQueue from "./AssetCheckQueue";
import AssistantReadiness from "./AssistantReadiness";
import ClientCapturePanel from "./ClientCapturePanel";
import ConversationControls from "./ConversationControls";
import AutomaticRecommendations from "./AutomaticRecommendations";
import JarvisAnalytics, { JarvisInsight } from "./JarvisAnalytics";
import WhatsAppConnection from "./WhatsAppConnection";
import { useWhatsAppConnection } from "./useWhatsAppConnection";
import { useConversations } from "./useConversations";
import { useClientCapture } from "./useClientCapture";
import styles from "./integration.module.css";

export default function ChatbotIntegration() {
  const [pairingOpen, setPairingOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const guideRef = useRef<HTMLDetailsElement>(null);
  const reducedMotion = useReducedMotion();
  const connection = useWhatsAppConnection(pairingOpen);
  const conversations = useConversations();
  const capture = useClientCapture();
  const connected = connection.online && !!connection.status?.connected;
  const showGuide = () => {
    setGuideOpen(true);
    requestAnimationFrame(() => guideRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" }));
  };

  return <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.7 }}>
    <motion.main aria-label="Integrasi WhatsApp" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className={`${styles.root} mx-auto min-w-0 max-w-[1240px] space-y-6 pb-6 pt-4 sm:space-y-7 sm:pt-5`}>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <WhatsAppConnection connection={connection} open={pairingOpen} setOpen={setPairingOpen} onGuide={showGuide} />
        <div className="flex min-w-0 flex-col gap-4">
          <JarvisInsight connection={connection} conversations={conversations} />
          <AssistantReadiness connection={connection} capture={capture} />
        </div>
      </div>
      <JarvisAnalytics connection={connection} conversations={conversations} />
      <ConversationControls controller={conversations} />
      <AutomaticRecommendations />
      <AssetCheckQueue />

      <details open={operationsOpen} onToggle={(event) => setOperationsOpen(event.currentTarget.open)} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-5 text-xs font-medium text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 [&::-webkit-details-marker]:hidden"><SlidersHorizontal size={16} className="shrink-0 text-zinc-500" /><span>Penyimpanan klien otomatis</span><ChevronDown size={15} className="ml-auto shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" /></summary>
        {operationsOpen && <div className="border-t border-white/[0.06] px-3 pb-3 sm:px-5 sm:pb-5"><ClientCapturePanel whatsappConnected={connected} controller={capture} /></div>}
      </details>
      <details ref={guideRef} open={guideOpen} onToggle={(event) => setGuideOpen(event.currentTarget.open)} className="group scroll-mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.015]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-5 text-xs font-medium text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 [&::-webkit-details-marker]:hidden"><CircleHelp size={16} className="shrink-0 text-zinc-500" /><span>Pastikan asisten siap membantu</span><ChevronDown size={15} className="ml-auto shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" /></summary>
        <div className="space-y-3 border-t border-white/[0.06] p-5 text-xs leading-7 text-zinc-400"><p>Kirim “Halo, saya tertarik properti lelang” dari <strong className="font-medium text-zinc-200">nomor WhatsApp lain</strong> ke nomor yang terhubung. Tunggu balasan, lalu perhatikan angka pesan di halaman ini bertambah.</p><p>Untuk mencoba pengalihan ke agent, kirim “survei lokasi”. Bot mengirim pemberitahuan pengalihan lalu berhenti menjawab kontak itu. Lanjutkan percakapan langsung dari WhatsApp Anda.</p></div>
      </details>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-1 pt-5 text-[10px] leading-5 text-zinc-500"><span>Solusindo Aset <span className="mx-1.5 text-zinc-700">/</span> Your next opportunity, connected.</span><span className="flex items-center gap-1.5"><LockKeyhole size={11} />Akses dilindungi akun Anda</span></footer>
    </motion.main>
  </MotionConfig>;
}
