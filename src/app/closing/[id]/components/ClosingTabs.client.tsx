"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import type { Listing, Agent, TeamLeader } from "../page";
import TabTransaksi, { type SkemaPenjualan } from "./tabs/TabTransaksi.client";
import TabAgent, { type AgentSelection } from "./tabs/TabAgent";
import TabPembagian from "./tabs/TabPembagian.client";
import TabKlien, { type KlienData } from "./tabs/TabKlien";

/* ─────────────────────────────────────────────────────────────
   Step definitions
───────────────────────────────────────────────────────────── */
type WizardStep = 1 | 2 | 3 | 4;

const STEPS_SEMUA = [
  {
    num: 1 as const,
    icon: "solar:users-group-rounded-bold-duotone",
    title: "Pilih Klien",
    sub: "Identitas & data KTP klien",
  },
  {
    num: 2 as const,
    icon: "solar:user-rounded-bold-duotone",
    title: "Pilih Agent",
    sub: "Agent closing & Team Leader",
  },
  {
    num: 3 as const,
    icon: "solar:document-add-bold-duotone",
    title: "Data Transaksi",
    sub: "Harga, skema & kalkulasi fee",
  },
  {
    num: 4 as const,
    icon: "solar:pie-chart-2-bold-duotone",
    title: "Pembagian Fee",
    sub: "Split komisi & simpan",
  },
] as const;

// Status yang menampilkan step 4 (Pembagian Fee)
const STATUS_DENGAN_PEMBAGIAN = new Set([
  "closing",
  "pengurusan_kuitansi",
  "kuitansi_selesai",
  "pengurusan_risalah_lelang",
  "risalah_lelang_selesai",
  "pengurusan_balik_nama",
  "balik_nama_selesai",
  "mediasi",
  "mediasi_gagal",
  "permohonan_eksekusi",
  "aanmaning",
  "penetapan",
  "rakor",
  "pelaksanaan_eksekusi",
  "serah_terima_kunci",
  "selesai",
]);

/* ─────────────────────────────────────────────────────────────
   Premium Stepper
───────────────────────────────────────────────────────────── */
function PremiumStepper({
  current,
  maxUnlocked,
  onGo,
  steps,
}: {
  current: WizardStep;
  maxUnlocked: WizardStep;
  onGo: (n: WizardStep) => void;
  steps: readonly (typeof STEPS_SEMUA)[number][];
}) {
  const totalSteps = steps.length;
  const currentIdx = steps.findIndex((s) => s.num === current);
  const progressPct = totalSteps <= 1 ? 0 : Math.round((currentIdx / (totalSteps - 1)) * 100);

  return (
    <div className="px-6 py-7 sm:px-10">
      {/* ── step nodes + connector ── */}
      <div className="relative flex items-start justify-between">
        {/* connector track — from center of first icon to center of last icon only */}
        <div
          className="pointer-events-none absolute top-[22px] hidden h-[2px] overflow-hidden rounded-full bg-white/[0.07] sm:block"
          style={{ zIndex: 0, left: "22px", right: "22px" }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-in-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {steps.map((s) => {
          const done = s.num < current;
          const active = s.num === current;
          const reachable = s.num <= maxUnlocked;

          return (
            <button
              key={s.num}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGo(s.num)}
              className="group relative z-10 flex flex-col items-center gap-3 disabled:cursor-default"
            >
              {/* ── circle ── */}
              <div className="relative">
                <div
                  className={[
                    "relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300",
                    done
                      ? // DONE: solid emerald + glow
                        "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12),0_0_20px_rgba(16,185,129,0.40)]"
                      : active
                      ? // ACTIVE: border ring + inner fill + glow
                        "border-2 border-emerald-400 bg-[#0e1219] shadow-[0_0_0_5px_rgba(16,185,129,0.10),0_0_18px_rgba(16,185,129,0.25)]"
                      : reachable
                      ? "border border-white/10 bg-[#0e1219] group-hover:border-white/20"
                      : // LOCKED
                        "border border-white/[0.05] bg-[#0b0e14]",
                  ].join(" ")}
                >
                  {done ? (
                    <Icon
                      icon="solar:check-circle-bold"
                      className="text-xl text-white"
                    />
                  ) : (
                    <Icon
                      icon={s.icon}
                      className={[
                        "text-[18px] transition-colors duration-200",
                        active
                          ? "text-emerald-300"
                          : reachable
                          ? "text-zinc-400 group-hover:text-zinc-200"
                          : "text-zinc-700",
                      ].join(" ")}
                    />
                  )}
                </div>
              </div>

              {/* ── label ── */}
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span
                  className={[
                    "text-[13px] font-semibold leading-none transition-colors duration-200",
                    done
                      ? "text-emerald-400"
                      : active
                      ? "text-white"
                      : reachable
                      ? "text-zinc-500 group-hover:text-zinc-300"
                      : "text-zinc-700",
                  ].join(" ")}
                >
                  {s.title}
                </span>
                <span
                  className={[
                    "hidden text-[11px] leading-none sm:block",
                    active ? "text-zinc-500" : "text-zinc-700",
                  ].join(" ")}
                >
                  {s.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main wizard shell
───────────────────────────────────────────────────────────── */
export default function ClosingTabs({
  listing,
  agent,
  leader,
  skemaPenjualan,
  statusTransaksi,
  mouPrefill,
  isClosingMode = false,
  onAgentChange,
  onLeaderChange,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
  skemaPenjualan: SkemaPenjualan;
  statusTransaksi: string | null;
  mouPrefill?: any;
  isClosingMode?: boolean;
  onAgentChange?: (name: string) => void;
  onLeaderChange?: (name: string) => void;
}) {
  const tampilPembagian = STATUS_DENGAN_PEMBAGIAN.has(statusTransaksi ?? "");
  const STEPS = tampilPembagian ? STEPS_SEMUA : STEPS_SEMUA.slice(0, 3) as unknown as typeof STEPS_SEMUA;

  const [step, setStep] = useState<WizardStep>(1);
  const [maxUnlocked, setMaxUnlocked] = useState<WizardStep>(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const [klienData, setKlienData] = useState<KlienData>({
    id_klien: mouPrefill?.idKlien ?? null,
    nama_klien: mouPrefill?.namaKlien ?? "",
    nik_klien: mouPrefill?.nikKlien ?? "",
    alamat_klien: mouPrefill?.alamatKlien ?? "",
  });
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const initAgentId = mouPrefill?.idAgent ?? (agent as any)?.id_agent ?? null;
  const [selectedAgent, setSelectedAgent] = useState<AgentSelection | null>(
    initAgentId
      ? {
          id_agent: initAgentId,
          isLuar: !!(mouPrefill?.agentLuarNama),
          luarNama: mouPrefill?.agentLuarNama ?? undefined,
          luarKantor: mouPrefill?.agentLuarKantor ?? undefined,
          luarTelepon: mouPrefill?.agentLuarTelepon ?? undefined,
        }
      : null
  );

  function goTo(n: WizardStep) {
    setStep(n);
    if (n > maxUnlocked) setMaxUnlocked(n);
    // scroll content card into view on step change
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="space-y-3">
      {/* ── Step indicator card ── */}
      <div
        className="overflow-hidden rounded-2xl border border-white/[0.06]"
        style={{ background: "linear-gradient(180deg,#0e1219 0%,#090c12 100%)" }}
      >
        {/* top accent line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <PremiumStepper current={step} maxUnlocked={maxUnlocked} onGo={goTo} steps={STEPS} />
      </div>

      {/* ── Step content card ── */}
      <div
        ref={contentRef}
        className="overflow-hidden rounded-2xl border border-white/[0.06]"
        style={{ background: "linear-gradient(180deg,#0b0e15 0%,#080a10 100%)" }}
      >
        <div className="p-5 sm:p-6">
          {step === 1 && (
            <TabKlien
              initialData={klienData}
              onDataChange={setKlienData}
              onKtpFile={setKtpFile}
              onNext={() => goTo(2)}
              readOnly={isClosingMode}
            />
          )}

          {step === 2 && (
            <TabAgent
              agent={agent}
              leader={leader}
              initialSelectedId={mouPrefill?.idAgent ?? undefined}
              onBack={() => goTo(1)}
              onNext={() => goTo(3)}
              onAgentChange={onAgentChange}
              onLeaderChange={onLeaderChange}
              onAgentSelect={setSelectedAgent}
              readOnly={isClosingMode}
            />
          )}

          {step === 3 && (
            <TabTransaksi
              listing={listing}
              skemaPenjualan={skemaPenjualan}
              agent={selectedAgent}
              klienData={klienData}
              ktpFile={ktpFile}
              prefill={mouPrefill}
              isClosingMode={isClosingMode}
              onBack={() => goTo(2)}
              onNextToPembagian={() => goTo(4)}
            />
          )}

          {step === 4 && (
            <TabPembagian
              listing={listing}
              agent={agent}
              mouAgentId={mouPrefill?.idAgent ?? undefined}
              skemaPenjualan={skemaPenjualan}
              teamLeaderName={(leader as any)?.nama ?? ""}
              klienData={klienData}
              onBack={() => goTo(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
