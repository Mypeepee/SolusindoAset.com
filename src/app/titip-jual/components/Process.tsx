"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

type Step = {
  n: string;
  icon: string;
  title: string;
  duration: string;
  desc: string;
  deliverables: string[];
  cost: "Gratis" | "Komisi" | "Notaris";
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: "solar:phone-calling-rounded-bold-duotone",
    title: "Konsultasi & Penilaian Pasar",
    duration: "1–2 hari",
    desc: "Tim kami menghubungi Anda dalam 24 jam. Survei lokasi singkat, lalu sistem OM DAS menghitung rentang harga optimal berdasarkan data transaksi sekitar.",
    deliverables: [
      "Survei lokasi & verifikasi aset",
      "Comparative Market Analysis (CMA)",
      "Rekomendasi harga jual & strategi",
    ],
    cost: "Gratis",
  },
  {
    n: "02",
    icon: "solar:document-add-bold-duotone",
    title: "Perjanjian Titip Jual",
    duration: "1 hari",
    desc: "Penandatanganan Perjanjian Pemasaran Aset di hadapan notaris mitra. Anda mendapat salinan resmi yang menjelaskan hak, kewajiban, durasi, dan ketentuan pembatalan.",
    deliverables: [
      "Akta perjanjian notaris",
      "Hak pembatalan kapan saja (kondisi tertentu)",
      "Komisi & timeline tercantum hitam-di-atas-putih",
    ],
    cost: "Notaris",
  },
  {
    n: "03",
    icon: "solar:camera-add-bold-duotone",
    title: "Persiapan Listing Premium",
    duration: "2–4 hari",
    desc: "Tim fotografer profesional & content writer kami mempersiapkan listing — foto interior/exterior, video walkthrough, floor plan, dan deskripsi yang dipoles AI untuk SEO.",
    deliverables: [
      "Fotografi profesional & drone (opsional)",
      "Video walkthrough 60 detik",
      "Floor plan & deskripsi SEO-optimized",
    ],
    cost: "Gratis",
  },
  {
    n: "04",
    icon: "solar:rocket-2-bold-duotone",
    title: "Pemasaran Multi-Channel",
    duration: "Berkelanjutan",
    desc: "Aset Anda di-broadcast ke MLS internal, jaringan 1.200+ agent, marketplace properti utama, sosial media bertarget, hingga database 266.000+ calon pembeli aktif.",
    deliverables: [
      "MLS Solusindo + portal eksternal",
      "Iklan bertarget (Meta, TikTok, Google)",
      "Open house & private viewing terjadwal",
    ],
    cost: "Gratis",
  },
  {
    n: "05",
    icon: "solar:hand-shake-bold-duotone",
    title: "Negosiasi & Closing",
    duration: "Sesuai pembeli",
    desc: "Setiap penawaran disampaikan kepada Anda dengan analisa kelayakan. Saat deal — notaris/PPAT in-house mengurus AJB, balik nama, dan pembayaran via escrow aman.",
    deliverables: [
      "Negosiasi dengan analisa pasar",
      "AJB & balik nama oleh PPAT mitra",
      "Pembayaran via rekening escrow",
    ],
    cost: "Komisi",
  },
];

const costStyle = (c: Step["cost"]) => {
  if (c === "Gratis")
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (c === "Komisi")
    return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-sky-400/30 bg-sky-400/10 text-sky-300";
};
const costLabel = (c: Step["cost"]) => {
  if (c === "Gratis") return "Tanpa biaya";
  if (c === "Komisi") return "Success fee";
  return "Biaya notaris terpisah";
};

const Process: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 80%", "end 60%"],
  });
  const spineScale = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.6,
  });
  const spineOpacity = useTransform(scrollYProgress, [0, 0.05, 1], [0.2, 0.8, 1]);

  return (
    <section
      id="cara-kerja"
      className="relative w-full bg-gradient-to-b from-[#05070D] via-[#070A12] to-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-teal-500/[0.05] blur-[120px]" />

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Cara Kerja Sistem</PillLabel>
          <SectionTitle
            title={
              <>
                Dari Konsultasi sampai Tanda Tangan{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  AJB.
                </span>
              </>
            }
            subtitle="Lima langkah yang sudah diterapkan pada ribuan transaksi. Tidak ada langkah tersembunyi, tidak ada biaya kejutan."
          />
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="mt-7 sm:mt-9 relative">
          {/* Static rail (background) */}
          <div className="absolute left-[1.375rem] sm:left-[1.75rem] top-2 bottom-2 w-px bg-white/[0.06]" />
          {/* Animated progress spine — fills as user scrolls */}
          <motion.div
            style={{ scaleY: spineScale, opacity: spineOpacity, originY: 0 }}
            className="absolute left-[1.375rem] sm:left-[1.75rem] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400 via-emerald-400/80 to-teal-400/60 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
          />

          <div className="space-y-3.5 sm:space-y-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  type: "spring",
                  stiffness: 110,
                  damping: 22,
                  delay: i * 0.07,
                }}
                className="relative pl-12 sm:pl-16"
              >
                {/* Node */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 18,
                    delay: i * 0.07 + 0.1,
                  }}
                  className="absolute left-0 top-1 flex items-center justify-center"
                >
                  <div className="relative h-11 w-11 sm:h-14 sm:w-14 rounded-2xl border border-emerald-400/30 bg-[#0B0F17] flex items-center justify-center shadow-[0_0_24px_rgba(52,211,153,0.22)]">
                    <Icon
                      icon={s.icon}
                      className="text-emerald-300 text-xl sm:text-2xl"
                    />
                  </div>
                </motion.div>

                {/* Card */}
                <div className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/22 via-white/[0.04] to-transparent hover:from-emerald-400/45 transition-all duration-500">
                  <div className="relative rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl p-4 sm:p-5 lg:p-6 overflow-hidden">
                    {/* Sweep highlight on hover */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent group-hover:via-emerald-400/60 transition-all duration-500" />
                    {/* Step number watermark */}
                    <div className="absolute -top-4 -right-2 text-[5rem] sm:text-[7rem] font-black text-white/[0.025] leading-none tabular-nums select-none">
                      {s.n}
                    </div>

                    <div className="relative flex flex-col lg:flex-row lg:items-start lg:gap-8">
                      {/* Left meta */}
                      <div className="lg:w-1/3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-emerald-300/90">
                            Langkah {s.n}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-[0.12em] uppercase text-white/45">
                            <Icon
                              icon="solar:clock-circle-bold"
                              className="text-xs"
                            />
                            {s.duration}
                          </span>
                        </div>
                        <h3 className="mt-2 text-white font-bold text-xl sm:text-2xl leading-tight">
                          {s.title}
                        </h3>
                        <p className="mt-3 text-white/60 text-[13.5px] sm:text-sm leading-relaxed">
                          {s.desc}
                        </p>

                        <div
                          className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-bold tracking-[0.14em] uppercase ${costStyle(
                            s.cost
                          )}`}
                        >
                          <Icon
                            icon={
                              s.cost === "Gratis"
                                ? "solar:gift-bold"
                                : s.cost === "Komisi"
                                ? "solar:hand-money-bold"
                                : "solar:scale-balanced-bold"
                            }
                            className="text-sm"
                          />
                          {costLabel(s.cost)}
                        </div>
                      </div>

                      {/* Right deliverables */}
                      <div className="lg:flex-1 mt-5 lg:mt-0">
                        <div className="text-[10.5px] font-bold tracking-[0.22em] uppercase text-white/45 mb-3">
                          Yang Anda Terima
                        </div>
                        <ul className="space-y-2.5">
                          {s.deliverables.map((d) => (
                            <li
                              key={d}
                              className="flex items-start gap-2.5 text-[13.5px] sm:text-sm text-white/80"
                            >
                              <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-emerald-400/15 border border-emerald-400/40 flex items-center justify-center">
                                <Icon
                                  icon="solar:check-read-bold"
                                  className="text-emerald-300 text-[10px]"
                                />
                              </span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA bar after timeline */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="mt-6 sm:mt-8 rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/[0.06] via-emerald-400/[0.02] to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Icon
                icon="solar:clock-square-bold-duotone"
                className="text-emerald-300 text-xl"
              />
            </div>
            <div>
              <div className="text-white font-bold text-sm sm:text-base">
                Estimasi total proses listing siap pasar
              </div>
              <div className="text-white/55 text-[12.5px] sm:text-[13px]">
                4–7 hari kerja dari konsultasi pertama
              </div>
            </div>
          </div>
          <a
            href="#form-titip-jual"
            className="sm:ml-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] font-bold text-[13px] tracking-wide shadow-[0_8px_30px_rgba(52,211,153,0.25)] hover:shadow-[0_12px_40px_rgba(52,211,153,0.45)] active:scale-[0.98] transition-all"
          >
            Mulai Langkah 01 Sekarang
            <Icon icon="solar:arrow-right-bold" className="text-lg" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Process;
