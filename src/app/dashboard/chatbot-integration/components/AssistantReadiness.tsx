"use client";

import { Bot, Database, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { needsNewSession } from "@/lib/chatbot/types";
import type { WhatsAppController } from "./WhatsAppConnection";
import type { ClientCaptureController } from "./useClientCapture";

type Readiness = { label: string; tone: "ready" | "neutral" | "attention"; checking?: boolean };
const checking: Readiness = { label: "Memeriksa", tone: "neutral", checking: true };
const unverified: Readiness = { label: "Belum terverifikasi", tone: "neutral" };
const tones = {
  ready: "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-300",
  neutral: "border-white/[0.07] bg-white/[0.02] text-zinc-400",
  attention: "border-amber-300/15 bg-amber-300/[0.04] text-amber-200",
};

function whatsappReadiness({ loading, online, status }: WhatsAppController): Readiness {
  if (loading) return checking;
  if (!online || !status) return unverified;
  if (status.connected) return { label: "Terhubung", tone: "ready" };
  if (needsNewSession(status.status)) return { label: "Tautkan ulang", tone: "attention" };
  if (["awaiting_scan", "awaiting_code"].includes(status.status)) return { label: "Menunggu tautan", tone: "neutral" };
  if (["connecting", "pairing", "reconnecting", "requesting_code"].includes(status.status)) return { label: "Menghubungkan", tone: "neutral" };
  return { label: "Belum terhubung", tone: "neutral" };
}

function botReadiness({ loading, online, status }: WhatsAppController): Readiness {
  if (loading) return checking;
  if (!online || status?.bot_accepting == null) return unverified;
  return status.bot_accepting ? { label: "Berjalan", tone: "ready" } : { label: "Tidak aktif", tone: "attention" };
}

function storageReadiness({ loading, checking: testing, error, data }: ClientCaptureController): Readiness {
  if (testing) return { label: "Menguji", tone: "neutral", checking: true };
  if (loading) return checking;
  if (error || !data?.backend || !data.crm.available) return { label: "Perlu diperiksa", tone: "attention" };
  const backend = data.backend;
  if (!backend.configured) return { label: "Belum disiapkan", tone: "neutral" };
  if (backend.probe?.status === "failed") return { label: "Uji gagal", tone: "attention" };
  if (Number(backend.retrying) > 0) return { label: "Tertunda", tone: "attention" };
  if (Number(backend.pending) > 0) return { label: "Dalam antrean", tone: "attention" };
  if (backend.probe?.status === "passed") return { label: "Uji lulus", tone: "ready" };
  return { label: "Belum diuji", tone: "neutral" };
}

export default function AssistantReadiness({ connection, capture }: {
  connection: WhatsAppController;
  capture: ClientCaptureController;
}) {
  const rows = [
    { name: "WhatsApp", icon: MessageCircle, status: whatsappReadiness(connection) },
    { name: "Layanan bot", icon: Bot, status: botReadiness(connection) },
    { name: "Penyimpanan prospek", icon: Database, status: storageReadiness(capture) },
  ];

  return (
    <section aria-labelledby="readiness-title" className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#0c0e10]/90 p-4">
      <h2 id="readiness-title" className="flex items-center gap-2 text-xs font-medium text-zinc-200">
        <ShieldCheck size={15} strokeWidth={1.6} className="shrink-0 text-emerald-300/80" aria-hidden="true" />
        Kesiapan Asisten
      </h2>
      <ul aria-live="polite" className="mt-2 flex flex-1 flex-col justify-between gap-1">
        {rows.map(({ name, icon: Icon, status }) => (
          <li key={name} className="flex min-h-6 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-zinc-400">
              <Icon size={13} strokeWidth={1.6} className="shrink-0 text-zinc-500" aria-hidden="true" />
              {name}
            </span>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] leading-4 ${tones[status.tone]}`}>
              {status.checking ? <Loader2 size={10} className="motion-safe:animate-spin" aria-hidden="true" /> : <span className="h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" />}
              {status.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
