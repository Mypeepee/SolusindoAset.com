"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

const points = [
  {
    icon: "solar:cpu-bolt-bold-duotone",
    title: "Sistem AI OM DAS 24/7",
    desc: "Dukungan teknologi mutakhir & sistem manajemen AI yang beroperasi tanpa henti.",
  },
  {
    icon: "solar:video-frame-play-horizontal-bold-duotone",
    title: "Ruang Media & Broadcast",
    desc: "Studio super lengkap untuk promosi digital aset secara masif dan profesional.",
  },
  {
    icon: "solar:users-group-two-rounded-bold-duotone",
    title: "60+ Tenaga Ahli",
    desc: "Diperkuat tim ahli dan tim pemasaran profesional terbaik di kelasnya.",
  },
  {
    icon: "solar:bank-bold-duotone",
    title: "Vendor Bank Nasional",
    desc: "Kemitraan kokoh dengan berbagai vendor bank tersohor berskala nasional.",
  },
  {
    icon: "solar:layers-minimalistic-bold-duotone",
    title: "Jaringan Listing Eksklusif",
    desc: "Jaringan listing properti dan aset terbanyak serta eksklusif di kelasnya.",
  },
  {
    icon: "solar:medal-ribbons-star-bold-duotone",
    title: "Rekam Jejak Cemerlang",
    desc: "Ribuan kepuasan klien atas setiap transaksi yang berhasil dieksekusi.",
  },
];

const Infrastructure: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#05070D]">
      <AmbientBackdrop variant="emerald" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Infrastruktur & Teknologi</PillLabel>
          <SectionTitle
            title={
              <>
                Aset Dikelola Tanpa Asumsi —{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  Hanya Data.
                </span>
              </>
            }
            subtitle="Sistem database yang kuat, pemasaran berbasis data, dan integrasi teknologi memastikan setiap transaksi berjalan sukses, cepat, dan transparan."
          />
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {points.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.1, duration: 0.55 }}
              className="group relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-7 hover:border-[#86efac]/30 transition-all duration-500 overflow-hidden"
            >
              <div className="absolute top-0 right-0 h-28 w-28 rounded-full bg-[#86efac]/5 blur-2xl group-hover:bg-[#86efac]/15 transition-all duration-700 -mr-6 -mt-6" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
                    <Icon icon={p.icon} className="text-2xl text-[#86efac]" />
                  </div>
                  <div className="text-2xl font-extrabold text-white/[0.06]">
                    0{i + 1}
                  </div>
                </div>
                <h3 className="mt-5 text-white font-bold text-lg">{p.title}</h3>
                <p className="mt-2 text-white/55 text-sm leading-relaxed">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Infrastructure;
