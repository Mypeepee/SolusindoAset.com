"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel } from "./_shared";

const agents = [
  { icon: "solar:branching-paths-up-bold", label: "Lead Scraper" },
  { icon: "solar:document-text-bold", label: "Doc Verifier" },
  { icon: "solar:gallery-edit-bold", label: "Asset Imaging" },
  { icon: "solar:graph-up-bold", label: "Price Estimator" },
  { icon: "solar:shield-check-bold", label: "Legal Auditor" },
  { icon: "solar:tag-price-bold", label: "Auction Bot" },
  { icon: "solar:dialog-2-bold", label: "Buyer Concierge" },
  { icon: "solar:bell-bing-bold", label: "Notifier" },
];

const OMDAS: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-gradient-to-b from-[#05070D] via-[#070A12] to-[#05070D]">
      <AmbientBackdrop variant="emerald" intensity="high" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — narrative */}
          <div>
            <PillLabel>Filosofi AI</PillLabel>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mt-4 text-4xl md:text-6xl font-extrabold leading-[1.05] text-white"
            >
              OM{" "}
              <span className="bg-gradient-to-r from-[#86efac] via-[#FFE6A6] to-[#F5C56A] bg-clip-text text-transparent">
                DAS
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mt-3 text-[#86efac] text-sm md:text-base font-semibold tracking-wide italic"
            >
              Orchestrated Multi-agent Driven Autonomous Swarm
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mt-7 text-white/65 text-[15px] md:text-base leading-relaxed max-w-xl"
            >
              Sebuah orkestrasi bot AI otonom yang didesain bukan sekadar untuk
              efisiensi, melainkan sebagai{" "}
              <span className="text-white font-semibold">
                pilar integritas dan penjaga kepercayaan klien
              </span>{" "}
              Anda di setiap transaksi. Beroperasi 24/7, terintegrasi dengan
              sistem perbankan, dan auditable secara end-to-end.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="mt-8 grid grid-cols-3 gap-3 max-w-md"
            >
              {[
                { v: "24/7", l: "Operasional" },
                { v: "8+", l: "AI Agents" },
                { v: "End-to-End", l: "Auditable" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-center"
                >
                  <div className="text-base font-bold text-[#86efac]">{s.v}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40 mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </motion.div>

            <a
              href="https://omdas.id"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-[#86efac] text-sm font-bold tracking-wide hover:gap-3 transition-all"
            >
              Kunjungi omdas.id
              <Icon icon="solar:arrow-right-up-bold" className="text-lg" />
            </a>
          </div>

          {/* Right — orbital swarm visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative aspect-square w-full max-w-xl mx-auto"
          >
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-white/5"
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            >
              {agents.slice(0, 8).map((a, i) => {
                const angle = (i / 8) * Math.PI * 2;
                const x = 50 + 47 * Math.cos(angle);
                const y = 50 + 47 * Math.sin(angle);
                return (
                  <motion.div
                    key={a.label}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    animate={{ rotate: -360 }}
                    transition={{
                      duration: 80,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <div className="group flex flex-col items-center">
                      <div className="h-12 w-12 rounded-2xl border border-[#86efac]/25 bg-[#0B0F17] flex items-center justify-center shadow-[0_0_24px_rgba(134,239,172,0.15)]">
                        <Icon
                          icon={a.icon}
                          className="text-xl text-[#86efac]"
                        />
                      </div>
                      <div className="mt-1.5 text-[9px] tracking-wider uppercase text-white/40 font-semibold whitespace-nowrap">
                        {a.label}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Middle ring */}
            <motion.div
              className="absolute inset-[18%] rounded-full border border-dashed border-[#86efac]/20"
              animate={{ rotate: -360 }}
              transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            />

            {/* Core */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-[34%] rounded-full bg-gradient-to-br from-[#86efac] via-[#FFE6A6] to-[#F5C56A] shadow-[0_0_60px_rgba(245,197,106,0.5)] flex items-center justify-center"
            >
              <div className="h-[80%] w-[80%] rounded-full bg-[#05070D] flex flex-col items-center justify-center">
                <Icon
                  icon="solar:cpu-bolt-bold-duotone"
                  className="text-3xl text-[#F5C56A]"
                />
                <div className="mt-1 text-[10px] tracking-[0.3em] uppercase text-white/50 font-bold">
                  Orchestrator
                </div>
              </div>
            </motion.div>

            {/* Connecting lines */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 h-px w-[44%] origin-left bg-gradient-to-r from-[#86efac]/40 to-transparent"
                style={{ transform: `rotate(${i * 45}deg)` }}
                animate={{ opacity: [0.2, 0.7, 0.2] }}
                transition={{
                  duration: 3,
                  delay: i * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default OMDAS;
