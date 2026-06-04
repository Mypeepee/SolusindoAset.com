"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

type Service = {
  icon?: string;
  image?: string;
  title: string;
  desc: string;
  glow: string;
  soon?: boolean;
};

const services: Service[] = [
  {
    icon: "solar:home-2-bold-duotone",
    title: "Agensi Property",
    desc: "Harga terbaik dengan negosiasi profesional dan legalitas terjamin.",
    glow: "emerald",
  },
  {
    icon: "solar:document-bold-duotone",
    title: "Notaris",
    desc: "Akta sah dengan biaya transparan — tanpa hidden fee.",
    glow: "blue",
  },
  {
    image: "/images/logo/balance.png",
    title: "Lawfirm",
    desc: "Pendampingan hukum penuh agar hak Anda terlindungi.",
    glow: "pink",
  },
  {
    icon: "solar:shield-keyhole-bold-duotone",
    title: "Eksekusi Hak Tanggungan",
    desc: "Penyelesaian NPL & eksekusi jaminan kredit secara hukum.",
    glow: "red",
  },
  {
    icon: "solar:case-minimalistic-bold-duotone",
    title: "Kurator",
    desc: "Pengurusan kepailitan oleh kurator resmi & profesional.",
    glow: "violet",
  },
  {
    icon: "solar:calculator-bold-duotone",
    title: "Konsultan Pajak",
    desc: "Optimasi struktur pajak aset & transaksi properti.",
    glow: "cyan",
  },
  {
    icon: "solar:satellite-bold-duotone",
    title: "Media Online",
    desc: "Promosi digital berbasis data dengan jangkauan masif.",
    glow: "teal",
  },
  {
    icon: "solar:tag-price-bold-duotone",
    title: "Balai Lelang",
    desc: "Manajemen lelang resmi yang transparan & akuntabel.",
    glow: "amber",
    soon: true,
  },
];

const glowMap: Record<string, string> = {
  emerald: "#86efac",
  blue: "#60a5fa",
  pink: "#f472b6",
  red: "#f87171",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  teal: "#2dd4bf",
  amber: "#f5c56a",
};

const Services: React.FC = () => {
  return (
    <section className="relative w-full pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 md:pb-10 overflow-hidden bg-[#070A12]">
      <AmbientBackdrop variant="emerald" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Ekosistem Layanan</PillLabel>
          <SectionTitle
            title={
              <>
                Solusi{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  End-to-End
                </span>{" "}
                untuk Korporat, Perbankan, dan Swasta.
              </>
            }
            subtitle="Satu institusi untuk delapan urusan paling rumit dalam transaksi properti. Anda fokus pada keputusannya, kami yang mengeksekusi — hemat waktu, hemat biaya, tanpa kejutan di belakang."
          />
        </div>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((s, i) => {
            const color = glowMap[s.glow];
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.08, duration: 0.55 }}
                className={`group relative rounded-3xl border bg-[#0B0F17] transition-all duration-500 overflow-hidden ${
                  s.soon
                    ? "border-amber-300/20 hover:border-amber-300/40"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                {/* Soft corner glow */}
                <div
                  className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl transition-opacity duration-700 opacity-15 group-hover:opacity-40"
                  style={{
                    background: `radial-gradient(circle, ${color}, transparent 70%)`,
                  }}
                />

                {/* Coming-soon distinct treatment */}
                {s.soon && (
                  <>
                    {/* Diagonal hazard stripes */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity duration-500"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, #f5c56a 0, #f5c56a 1px, transparent 1px, transparent 14px)",
                      }}
                    />
                    {/* Sweeping shimmer */}
                    <motion.div
                      className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-amber-300/[0.08] to-transparent -skew-x-12"
                      initial={{ x: "-150%" }}
                      animate={{ x: "350%" }}
                      transition={{
                        duration: 4.5,
                        repeat: Infinity,
                        repeatDelay: 1.8,
                        ease: "easeInOut",
                      }}
                    />
                    {/* Top dashed accent line */}
                    <div
                      className="pointer-events-none absolute top-0 inset-x-0 h-px"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, #f5c56a 0 6px, transparent 6px 12px)",
                        opacity: 0.5,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute bottom-0 inset-x-0 h-px"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(90deg, #f5c56a 0 6px, transparent 6px 12px)",
                        opacity: 0.5,
                      }}
                    />
                  </>
                )}

                <div className="relative p-6">
                  {/* Top row: number + soon badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`text-[10px] tracking-[0.3em] uppercase font-bold ${
                        s.soon ? "text-amber-300/60" : "text-white/30"
                      }`}
                    >
                      0{i + 1}
                    </div>
                    {s.soon && (
                      <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-300/40 bg-amber-300/[0.08] text-[9px] tracking-[0.25em] uppercase font-bold text-amber-200 shadow-[0_0_18px_rgba(245,197,106,0.18)]">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-75" />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-amber-300" />
                        </span>
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className={`relative mt-5 h-14 w-14 rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                      s.soon
                        ? "border-amber-300/25 bg-amber-300/[0.04] group-hover:scale-105"
                        : "border-white/10 bg-white/[0.03] group-hover:scale-110 group-hover:rotate-3"
                    }`}
                  >
                    {s.image ? (
                      <Image
                        src={s.image}
                        alt={s.title}
                        width={32}
                        height={32}
                        className="object-contain"
                        style={{
                          filter: "brightness(0) invert(1)",
                          opacity: 0.92,
                        }}
                      />
                    ) : (
                      <Icon
                        icon={s.icon as string}
                        className={`text-3xl ${
                          s.soon ? "text-amber-200/80" : "text-white"
                        }`}
                      />
                    )}
                    {/* Lock badge over icon for soon */}
                    {s.soon && (
                      <span className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full border border-amber-300/40 bg-[#0B0F17] flex items-center justify-center shadow-[0_0_12px_rgba(245,197,106,0.35)]">
                        <Icon
                          icon="solar:lock-keyhole-minimalistic-bold"
                          className="text-[11px] text-amber-300"
                        />
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 text-white font-bold text-base">
                    {s.title}
                  </h3>
                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      s.soon ? "text-white/45" : "text-white/55"
                    }`}
                  >
                    {s.desc}
                  </p>

                  {/* Bottom status — only for coming-soon */}
                  {s.soon && (
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase text-amber-300/80 font-bold font-mono">
                        <Icon
                          icon="solar:clock-circle-bold-duotone"
                          className="text-sm"
                        />
                        Segera Hadir
                      </div>
                      <div className="flex-1 h-px max-w-[60px] rounded-full bg-amber-300/15 overflow-hidden">
                        <motion.div
                          className="h-full w-1/2 bg-gradient-to-r from-transparent via-amber-300 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Services;
