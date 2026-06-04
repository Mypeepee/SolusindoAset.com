"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

type Pillar = {
  icon: string;
  title: string;
  desc: string;
  proof: string;
};

const PILLARS: Pillar[] = [
  {
    icon: "solar:document-text-bold-duotone",
    title: "Perjanjian Resmi Notaris",
    desc: "Setiap titip jual dibingkai dalam Perjanjian Pemasaran Aset yang ditandatangani di hadapan notaris mitra kami.",
    proof: "Notaris & PPAT mitra resmi",
  },
  {
    icon: "solar:wallet-money-bold-duotone",
    title: "Tanpa Biaya di Muka",
    desc: "Anda tidak membayar sepeserpun di awal. Komisi hanya dipotong setelah transaksi closing dan dana cair.",
    proof: "0% upfront · komisi success-fee",
  },
  {
    icon: "solar:shield-keyhole-minimalistic-bold-duotone",
    title: "Sertifikat Tetap di Tangan Anda",
    desc: "Asli sertifikat tetap dipegang pemilik. Kami hanya membutuhkan salinan untuk verifikasi & pemasaran.",
    proof: "Zero dokumen asli berpindah tangan",
  },
  {
    icon: "solar:users-group-two-rounded-bold-duotone",
    title: "Jaringan 266.000+ Listing & 1.200+ Agent",
    desc: "Aset Anda diekspos ke database calon pembeli aktif, MLS internal, dan jaringan agent profesional se-Jawa Timur.",
    proof: "AREBI DPD Jawa Timur",
  },
  {
    icon: "solar:graph-new-up-bold-duotone",
    title: "Pricing Dipandu Data, Bukan Tebak-tebakan",
    desc: "Penilaian harga menggunakan AI OM DAS — membandingkan ribuan transaksi sejenis di area Anda untuk hasil optimal.",
    proof: "Powered by OM DAS AI",
  },
  {
    icon: "solar:bell-bing-bold-duotone",
    title: "Laporan Mingguan Otomatis",
    desc: "Anda menerima ringkasan via WhatsApp & email: jumlah tayangan, calon pembeli, showing, dan penawaran masuk.",
    proof: "Dashboard akses 24/7",
  },
];

const TrustPillars: React.FC = () => {
  return (
    <section
      id="kenapa-titip-jual"
      className="relative w-full bg-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 80%)",
        }}
      />

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>6 Alasan Mengapa Aman</PillLabel>
          <SectionTitle
            title={
              <>
                Kepercayaan Bukan Kata-kata,
                <br />
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Tapi Sistem yang Terukur.
                </span>
              </>
            }
            subtitle="Kami merancang setiap titik kontak agar Anda — pemilik aset — selalu memegang kendali penuh. Berikut enam pilar yang menjadi kontrak tak tertulis kami dengan setiap klien."
          />
        </div>

        <div className="mt-7 sm:mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                type: "spring",
                stiffness: 120,
                damping: 22,
                delay: i * 0.055,
              }}
              whileHover={{ y: -5 }}
              className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/20 via-white/[0.04] to-transparent hover:from-emerald-400/60 hover:via-emerald-400/15 transition-all duration-500"
            >
              <div className="relative h-full rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl p-5 sm:p-6 overflow-hidden">
                {/* corner glow follows hover */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-400/[0.05] blur-3xl group-hover:bg-emerald-400/25 transition-all duration-700" />

                {/* Top sweep line on hover */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/0 to-transparent group-hover:via-emerald-400/60 transition-all duration-500" />

                {/* Index */}
                <div className="absolute top-4 right-4 text-[10.5px] font-bold tracking-[0.25em] text-white/20 tabular-nums group-hover:text-emerald-300/40 transition-colors">
                  0{i + 1}
                </div>

                {/* Icon */}
                <div className="h-11 w-11 rounded-2xl bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-400/20 group-hover:border-emerald-400/45 transition-all duration-300">
                  <Icon icon={p.icon} className="text-emerald-300 text-xl" />
                </div>

                <h3 className="mt-4 text-white text-[16.5px] sm:text-[17px] font-bold leading-snug">
                  {p.title}
                </h3>
                <p className="mt-2 text-white/60 text-[13px] leading-relaxed">
                  {p.desc}
                </p>

                {/* Proof footer */}
                <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center gap-2">
                  <Icon
                    icon="solar:verified-check-bold"
                    className="text-emerald-400/80 text-sm shrink-0"
                  />
                  <span className="text-[10.5px] uppercase tracking-[0.16em] text-emerald-300/80 font-bold">
                    {p.proof}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustPillars;
