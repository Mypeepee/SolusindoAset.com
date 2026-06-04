"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

type Person = {
  name: string;
  role: string;
  desc: string;
  initial: string;
  highlight?: boolean;
  tier: "executive" | "associate";
};

const leaders: Person[] = [
  {
    name: "Jason Christopher Liendo",
    role: "Direktur Utama",
    desc: "Memegang kendali penuh atas visi strategis dan kepemimpinan operasional Solusindo Premier. Dengan ketajaman analisis bisnis dan kemampuan manajerial yang progresif, memastikan setiap langkah penanganan portofolio properti lelang serta resolusi NPL berjalan dengan kepastian hukum yang ketat.",
    initial: "JC",
    highlight: true,
    tier: "executive",
  },
  {
    name: "Grace Kumalasutji",
    role: "Principal",
    desc: "Mengarahkan kebijakan strategis pemasaran agensi dan merawat eksklusivitas kemitraan dengan institusi keuangan. Berperan krusial dalam menetapkan standar kualitas layanan tertinggi.",
    initial: "GK",
    tier: "executive",
  },
  {
    name: "Markus Diyanto Lie",
    role: "Tenaga Ahli",
    desc: "Pakar resolusi aset dengan jam terbang tinggi. Bertanggung jawab atas analisis teknis dan taktis dalam perumusan skema mitigasi sengketa, baik melalui eksekusi Hak Tanggungan maupun likuidasi lelang.",
    initial: "ML",
    tier: "executive",
  },
];

const associates: Person[] = [
  {
    name: "Stella J. Thomas",
    role: "Associate Direktur",
    desc: "Mengawal eksekusi pemasaran dan operasional cabang, memastikan kepuasan klien dalam proses Auction, Sell, Buy & Rent.",
    initial: "ST",
    tier: "associate",
  },
  {
    name: "Caterina Agnesia Tri Mariana",
    role: "Associate Direktur",
    desc: "Fokus pada optimalisasi relasi vendor dan memonitor administrasi penyelesaian Hak Tanggungan sesuai target waktu perbankan.",
    initial: "CA",
    tier: "associate",
  },
  {
    name: "Shintya Resty Rahayu",
    role: "Associate Direktur",
    desc: "Memperluas jangkauan operasional lelang dan memperkuat jaringan kemitraan strategis dengan investor potensial di berbagai wilayah.",
    initial: "SR",
    tier: "associate",
  },
];

const PersonCard: React.FC<{ p: Person; index: number }> = ({ p, index }) => {
  const accent = p.highlight ? "#F5C56A" : "#86efac";
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent hover:from-white/20 transition-all"
    >
      <div className="rounded-3xl bg-[#0B0F17]/95 p-7 h-full">
        <div className="flex items-center gap-4">
          <div
            className="relative h-16 w-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
              border: `1px solid ${accent}40`,
              color: accent,
            }}
          >
            {p.initial}
            {p.highlight && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#F5C56A] flex items-center justify-center shadow-[0_0_12px_rgba(245,197,106,0.6)]">
                <Icon icon="solar:crown-bold" className="text-[10px] text-[#05070D]" />
              </span>
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg leading-tight">{p.name}</h3>
            <div
              className="mt-1 text-[10px] uppercase tracking-[0.25em] font-bold"
              style={{ color: accent }}
            >
              {p.role}
            </div>
          </div>
        </div>
        <p className="mt-5 text-white/55 text-sm leading-relaxed">{p.desc}</p>
      </div>
    </motion.div>
  );
};

const Leadership: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#070A12]">
      <AmbientBackdrop variant="gold" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel tone="gold">Profil Manajemen</PillLabel>
          <SectionTitle
            title={
              <>
                Integritas,{" "}
                <span className="bg-gradient-to-r from-[#F5C56A] to-[#FFE6A6] bg-clip-text text-transparent">
                  Dedikasi
                </span>
                , dan Kepakaran.
              </>
            }
            subtitle="Keberhasilan resolusi aset dan manajemen lelang kami dibangun di atas para eksekutif berpengalaman yang menjaga setiap detail di balik layar."
          />
        </div>

        <div className="mt-14">
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#F5C56A] mb-5 text-center">
            ━ Board of Directors ━
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            {leaders.map((l, i) => (
              <PersonCard key={l.name} p={l} index={i} />
            ))}
          </div>
        </div>

        <div className="mt-16">
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#86efac] mb-5 text-center">
            ━ Associate Directors ━
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            {associates.map((a, i) => (
              <PersonCard key={a.name} p={a} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Leadership;
