"use client";

import React, { useRef, useState } from "react";
import { useSession } from "next-auth/react";

import HeroSection from "./components/hero";
import BenefitsSection from "./components/benefits";
import AgentApplyForm, { type PrefillAgentLite } from "./components/form";

type AppSessionUser = {
  id?: string;
  role?: "USER" | "AGENT";
  agentId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  nomor_telepon?: string | null;
};

export default function GabungJadiAgentPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as AppSessionUser | undefined) ?? undefined;

  const isLoading = status === "loading";
  const isAuthed = status === "authenticated";
  const isAlreadyAgent = user?.role === "AGENT" && Boolean(user?.agentId);

  // Modal login tetap di Form (seperti sebelumnya), tapi Hero butuh trigger open
  const [loginOpen, setLoginOpen] = useState(false);

  // Untuk scroll "Mulai Pendaftaran" -> form
  const formRef = useRef<HTMLDivElement | null>(null);
  function goToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Status pendaftaran untuk kartu di HERO (prefillLoading + existingAgent)
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [existingAgent, setExistingAgent] = useState<PrefillAgentLite | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] p-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-black/30 p-6 text-white">
          Memuat...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050807] text-white pt-24 md:pt-28">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-40 right-[-12rem] h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-12rem] h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-16">
        {/* HERO */}
        <HeroSection
          isAuthed={isAuthed}
          onStart={() => {
            if (!isAuthed) return setLoginOpen(true);
            goToForm();
          }}
          prefillLoading={prefillLoading}
          existingAgentStatus={existingAgent?.status_keanggotaan ?? null}
        />

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left */}
          <BenefitsSection />

          {/* Form */}
          <section className="lg:col-span-7">
            <AgentApplyForm
              formRef={formRef}
              // auth/session flags
              isAuthed={isAuthed}
              isAlreadyAgent={isAlreadyAgent}
              user={user}
              // login modal control (dipakai di Form & tombol login)
              loginOpen={loginOpen}
              setLoginOpen={setLoginOpen}
              // untuk HERO status card (prefill)
              onPrefillStateChange={(s) => {
                setPrefillLoading(s.prefillLoading);
                setExistingAgent(s.existingAgent);
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
