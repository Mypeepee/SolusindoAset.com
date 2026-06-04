"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

const steps = [
  {
    icon: "solar:inbox-archive-bold-duotone",
    title: "Penerimaan & Konsolidasi",
    desc: "Konsolidasi aset dari pihak pemohon dilakukan dengan dokumentasi lengkap.",
  },
  {
    icon: "solar:file-check-bold-duotone",
    title: "Verifikasi Dokumen",
    desc: "Uji kelayakan dokumen dan preparasi sampel evaluasi awal.",
  },
  {
    icon: "solar:gallery-add-bold-duotone",
    title: "Optimalisasi Aset",
    desc: "Value enhancement melalui perbaikan strategis sebelum eksekusi.",
  },
  {
    icon: "solar:magnifer-zoom-in-bold-duotone",
    title: "Due Diligence",
    desc: "Uji kelayakan tuntas dan estimasi taksiran harga yang akurat.",
  },
  {
    icon: "solar:eye-bold-duotone",
    title: "Open House",
    desc: "Eksekusi pameran untuk presentasi publik kepada calon investor.",
  },
  {
    icon: "solar:shield-warning-bold-duotone",
    title: "Asuransi & Risiko",
    desc: "Penataan asuransi dan manajemen risiko aset selama proses.",
  },
  {
    icon: "solar:smartphone-bold-duotone",
    title: "Kampanye Pemasaran",
    desc: "Digital marketing masif dan katalog eksekutif berkelas premium.",
  },
  {
    icon: "solar:signpost-bold-duotone",
    title: "Perikatan Hukum",
    desc: "Penyusunan perikatan hukum yang sah dengan pemohon.",
  },
];

const PraLelang: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#070A12]">
      <AmbientBackdrop variant="emerald" intensity="high" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Produk Layanan Jasa</PillLabel>
          <SectionTitle
            title={
              <>
                8 Langkah Strategis{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  Jasa Pra Lelang.
                </span>
              </>
            }
            subtitle="Operasional kami merujuk pada PMK No. 122/2023 dan KMK No. 36/KMK.04/2002 — setiap langkah berlandaskan kepastian hukum yang ketat."
          />
        </div>

        {/* Timeline */}
        <div className="mt-16 relative">
          {/* Central line desktop */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#86efac]/30 to-transparent" />

          <div className="space-y-6 lg:space-y-12">
            {steps.map((s, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05, duration: 0.55 }}
                  className={`lg:grid lg:grid-cols-2 lg:gap-12 items-center ${
                    isLeft ? "" : "lg:[&>*:first-child]:order-2"
                  }`}
                >
                  {/* Card */}
                  <div
                    className={`group relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 hover:border-[#86efac]/30 transition-all duration-500 ${
                      isLeft ? "lg:text-right" : ""
                    }`}
                  >
                    <div
                      className={`flex items-start gap-4 ${
                        isLeft ? "lg:flex-row-reverse lg:text-right" : ""
                      }`}
                    >
                      <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0">
                        <Icon icon={s.icon} className="text-2xl text-[#86efac]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#86efac]">
                          Langkah 0{i + 1}
                        </div>
                        <h3 className="mt-1.5 text-white font-bold text-lg">
                          {s.title}
                        </h3>
                        <p className="mt-1.5 text-white/55 text-sm leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dot + spacer */}
                  <div className="hidden lg:flex items-center justify-center">
                    <div className="relative">
                      <div className="h-5 w-5 rounded-full bg-[#86efac] shadow-[0_0_24px_rgba(134,239,172,0.7)]" />
                      <div className="absolute inset-0 h-5 w-5 rounded-full bg-[#86efac]/40 animate-ping" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mt-14 mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#F5C56A]/30 bg-[#F5C56A]/5">
            <Icon icon="solar:scale-balanced-bold" className="text-[#F5C56A] text-base" />
            <span className="text-[11px] tracking-widest uppercase font-bold text-[#F5C56A]">
              Berlandaskan PMK 122/2023 & KMK 36/KMK.04/2002
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PraLelang;
