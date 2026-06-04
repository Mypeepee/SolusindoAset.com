"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

const Node: React.FC<{
  role: string;
  name: string;
  tone?: "gold" | "emerald" | "white";
  delay?: number;
}> = ({ role, name, tone = "white", delay = 0 }) => {
  const ring =
    tone === "gold"
      ? "border-[#F5C56A]/40 from-[#F5C56A]/15 to-transparent"
      : tone === "emerald"
      ? "border-[#86efac]/40 from-[#86efac]/15 to-transparent"
      : "border-white/15 from-white/10 to-transparent";
  const accent =
    tone === "gold"
      ? "text-[#F5C56A]"
      : tone === "emerald"
      ? "text-[#86efac]"
      : "text-white/70";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className={`min-w-[14rem] rounded-2xl border bg-gradient-to-b ${ring} backdrop-blur-md px-5 py-4 text-center`}
    >
      <div className={`text-[9px] font-bold tracking-[0.3em] uppercase ${accent}`}>
        {role}
      </div>
      <div className="mt-1.5 text-white font-bold text-sm md:text-base leading-tight">
        {name}
      </div>
    </motion.div>
  );
};

const Connector: React.FC<{ vertical?: boolean; className?: string }> = ({
  vertical = false,
  className = "",
}) => (
  <div
    className={`${
      vertical ? "w-px h-8" : "h-px w-full"
    } bg-gradient-to-r from-transparent via-[#86efac]/40 to-transparent ${className}`}
  />
);

const OrgChart: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#05070D]">
      <AmbientBackdrop variant="navy" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Struktur Organisasi</PillLabel>
          <SectionTitle
            title={
              <>
                Hierarki yang{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  Jelas & Akuntabel.
                </span>
              </>
            }
            subtitle="Setiap peran memiliki tanggung jawab spesifik untuk memastikan tata kelola yang transparan."
          />
        </div>

        <div className="mt-16 flex flex-col items-center gap-0">
          <Node
            role="Komisaris"
            name="Grace Coresy Marshasulistio"
            tone="gold"
            delay={0}
          />
          <Connector vertical />
          <Node
            role="Direktur"
            name="Jason Christopher Liendo"
            tone="gold"
            delay={0.1}
          />
          <Connector vertical />

          {/* Two parallel lines */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            <Node role="Principal" name="Grace Kumalasutji" tone="emerald" delay={0.15} />
            <Node
              role="Tenaga Ahli"
              name="Markus Diyanto Lie (Lie Ming)"
              tone="emerald"
              delay={0.2}
            />
          </div>

          <Connector vertical />

          {/* Associates */}
          <div className="grid md:grid-cols-3 gap-5 w-full max-w-4xl">
            <Node
              role="Associate Direktur"
              name="Stella J. Thomas"
              delay={0.25}
            />
            <Node
              role="Associate Direktur"
              name="Caterina Agnesia"
              delay={0.3}
            />
            <Node
              role="Associate Direktur"
              name="Shintya Resti"
              delay={0.35}
            />
          </div>
        </div>

        <div className="mt-12 mx-auto max-w-2xl flex items-center justify-center gap-2 text-[10px] tracking-widest uppercase text-white/40">
          <Icon icon="solar:shield-check-bold" className="text-[#86efac] text-base" />
          Audited governance • PT Solusi Tangguh Rejeki
        </div>
      </div>
    </section>
  );
};

export default OrgChart;
