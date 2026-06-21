"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, useScroll, useTransform } from "framer-motion";

// 4 pasar dalam 1 akses
const markets: {
  label: string;
  desc: string;
  icon?: string;
  highlight?: boolean;
  img?: boolean;
}[] = [
  { label: "Beli Baru", desc: "Rumah developer", icon: "solar:home-2-bold-duotone" },
  { label: "Beli Second", desc: "Hunian bekas pilihan", icon: "solar:key-minimalistic-square-bold-duotone" },
  { label: "Sewa", desc: "Unit siap huni", icon: "solar:calendar-mark-bold-duotone" },
  { label: "Lelang Bank", desc: "Di bawah harga pasar", img: true, highlight: true },
];

// Yang kami urus di proses lelang (end-to-end)
const lelangSteps = [
  "Cek Legalitas",
  "Proses Bidding",
  "Balik Nama",
  "Pengosongan",
  "Serah Terima",
];

// Poin kepercayaan pendukung
const trust = [
  {
    icon: "solar:shield-check-bold-duotone",
    title: "Anti-Fake Listing",
    desc: "Tiap listing dikurasi — tanpa harga pancingan, tanpa foto tipuan.",
  },
  {
    icon: "solar:users-group-rounded-bold-duotone",
    title: "Dikawal Sampai Akad",
    desc: "Agen tersertifikasi mendampingi dari survei hingga akad.",
  },
  {
    icon: "solar:buildings-3-bold-duotone",
    title: "Mitra Bank Resmi",
    desc: "Aset lelang langsung dari bank-bank terpercaya di Indonesia.",
  },
];

/** Ikon timbangan (lelang) dari /images/logo/balance.png — PNG hitam.
    Diwarnai via CSS mask supaya mengikuti warna teks (currentColor). */
const BalanceIcon = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden
    className={`inline-block ${className}`}
    style={{
      backgroundColor: "currentColor",
      WebkitMaskImage: "url(/images/logo/balance.png)",
      maskImage: "url(/images/logo/balance.png)",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
    }}
  />
);

// ── Animation helpers ───────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const VIEWPORT = { once: true, amount: 0 } as const;

/** Reveal naik + fade untuk elemen tunggal (dengan delay opsional). */
const reveal = (delay = 0, y = 26) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { duration: 0.6, ease: EASE, delay },
});

/** Kontainer stagger — anak-anaknya muncul beruntun. */
const staggerGroup = {
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: VIEWPORT,
  variants: { hidden: {}, show: { transition: { staggerChildren: 0.09 } } },
};
const groupItem = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

const WhyKosku = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  // Parallax halus pada glow ambient → kedalaman saat scroll.
  const glowY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section ref={sectionRef} className="py-10 md:py-14 bg-[#0F0F0F] relative">
      {/* ambient glow (parallax) */}
      <motion.div
        style={{ y: glowY }}
        className="pointer-events-none absolute inset-0 opacity-60"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(52,211,153,0.07), transparent 70%)",
          }}
        />
      </motion.div>

      <div className="container mx-auto px-4 max-w-screen-xl relative z-10">
        {/* HEADER */}
        <div className="text-center mb-8 md:mb-10 max-w-2xl mx-auto">
          <motion.span
            {...reveal(0)}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-3 uppercase"
          >
            Kenapa Solusindo Aset
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            className="text-3xl md:text-[2.6rem] font-extrabold text-white leading-tight mb-4"
          >
            Dua Keunggulan yang{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">
              Tak Ada di Tempat Lain
            </span>
          </motion.h2>
          <motion.p
            {...reveal(0.18)}
            className="text-white/50 text-sm md:text-base leading-relaxed"
          >
            Marketplace lain berhenti di daftar listing. Kami beri akses ke pasar
            yang tak tersentuh — dan mengurus prosesnya sampai Anda pegang kunci.
          </motion.p>
        </div>

        {/* ===== DUA KARTU USP UTAMA ===== */}
        <div className="grid lg:grid-cols-2 gap-5 md:gap-6">
          {/* CARD A — SPESIALIS LELANG BANK (masuk dari kiri) */}
          <motion.div
            initial={{ opacity: 0, x: -44, y: 16 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE }}
            className="group relative flex flex-col rounded-3xl p-7 md:p-8 overflow-hidden border border-white/10 bg-gradient-to-b from-[#171717] to-[#0e0e0e] hover:border-[#86efac]/40 transition-colors duration-500"
          >
            <div className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full blur-[90px] bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-all duration-700" />

            <div className="relative z-10 flex flex-col h-full">
              <motion.span
                {...reveal(0.15, 14)}
                className="inline-flex w-fit items-center gap-1.5 mb-5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-300/30 text-amber-200 text-[10px] font-bold uppercase tracking-wider"
              >
                <Icon icon="solar:crown-star-bold" className="text-xs" /> Keunggulan Utama
              </motion.span>

              <motion.div {...reveal(0.22, 14)} className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <BalanceIcon className="w-6 h-6 text-[#86efac]" />
                </div>
                <h3 className="text-2xl font-extrabold text-white">Spesialis Lelang Bank</h3>
              </motion.div>

              <motion.p {...reveal(0.28, 14)} className="text-white/55 text-sm leading-relaxed mb-6">
                Beli properti{" "}
                <strong className="text-white">20–40% di bawah harga pasar</strong>{" "}
                lewat lelang resmi bank — dan kami yang urus seluruh prosesnya.
              </motion.p>

              {/* Value gap visual — bar tumbuh saat masuk view */}
              <motion.div
                {...reveal(0.32, 14)}
                className="rounded-2xl bg-black/40 border border-white/5 p-4 mb-6"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/40">Harga Pasar</span>
                  <span className="text-[11px] text-red-400 line-through tabular-nums">Rp 2,5 M</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 mb-3 overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={VIEWPORT}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.45 }}
                    style={{ transformOrigin: "left" }}
                    className="h-full w-full rounded-full bg-red-400/40"
                  />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-white/40">Harga Lelang</span>
                  <span className="text-[11px] font-bold text-[#86efac] tabular-nums">Rp 1,4 M</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={VIEWPORT}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}
                    style={{ transformOrigin: "left" }}
                    className="h-full w-[56%] rounded-full bg-[#86efac] relative"
                  >
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#86efac]" />
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.4, ease: EASE, delay: 1.05 }}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#86efac]"
                >
                  <Icon icon="solar:tag-price-bold" /> Hemat hingga 44%
                </motion.div>
              </motion.div>

              {/* Checklist end-to-end — mengalir satu per satu */}
              <motion.p {...reveal(0.4, 10)} className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2.5">
                Kami urus untuk Anda
              </motion.p>
              <motion.div {...staggerGroup} className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
                {lelangSteps.map((s) => (
                  <motion.span
                    key={s}
                    variants={groupItem}
                    className="inline-flex items-center gap-1.5 text-[12px] text-white/70"
                  >
                    <Icon icon="solar:check-circle-bold" className="text-[#86efac] text-sm shrink-0" />
                    {s}
                  </motion.span>
                ))}
              </motion.div>

              <motion.div {...reveal(0.5, 10)} className="mt-auto">
                <Link
                  href="/Lelang"
                  className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#86efac] transition-colors"
                >
                  Pelajari Lelang
                  <Icon icon="solar:arrow-right-linear" className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* CARD B — 4 PASAR, 1 AKSES (masuk dari kanan) */}
          <motion.div
            initial={{ opacity: 0, x: 44, y: 16 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="group relative flex flex-col rounded-3xl p-7 md:p-8 overflow-hidden border border-white/10 bg-gradient-to-b from-[#171717] to-[#0e0e0e] hover:border-[#86efac]/40 transition-colors duration-500"
          >
            <div className="pointer-events-none absolute -bottom-24 -left-20 w-80 h-80 rounded-full blur-[90px] bg-teal-500/10 group-hover:bg-teal-500/20 transition-all duration-700" />

            <div className="relative z-10 flex flex-col h-full">
              <motion.span
                {...reveal(0.25, 14)}
                className="inline-flex w-fit items-center gap-1.5 mb-5 px-3 py-1 rounded-full bg-[#86efac]/10 border border-[#86efac]/30 text-[#86efac] text-[10px] font-bold uppercase tracking-wider"
              >
                <Icon icon="solar:widget-5-bold" className="text-xs" /> Satu Akses
              </motion.span>

              <motion.div {...reveal(0.32, 14)} className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <Icon icon="solar:layers-minimalistic-bold-duotone" className="text-2xl text-[#86efac]" />
                </div>
                <h3 className="text-2xl font-extrabold text-white">4 Pasar, 1 Pencarian</h3>
              </motion.div>

              <motion.p {...reveal(0.38, 14)} className="text-white/55 text-sm leading-relaxed mb-6">
                Tak perlu pindah-pindah aplikasi. Rumah baru, hunian second, unit
                sewa, sampai aset lelang bank — semua dalam satu kali cari.
              </motion.p>

              {/* 2x2 market tiles — mengalir berurutan */}
              <motion.div {...staggerGroup} className="grid grid-cols-2 gap-3 mb-6">
                {markets.map((m) => (
                  <motion.div
                    key={m.label}
                    variants={groupItem}
                    className={`rounded-2xl p-4 border flex items-center gap-3 transition-colors ${
                      m.highlight
                        ? "bg-[#86efac]/10 border-[#86efac]/30"
                        : "bg-white/[0.03] border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        m.highlight ? "bg-[#86efac]/15" : "bg-white/5"
                      }`}
                    >
                      {m.img ? (
                        <BalanceIcon
                          className={`w-5 h-5 ${m.highlight ? "text-[#86efac]" : "text-white/70"}`}
                        />
                      ) : (
                        <Icon
                          icon={m.icon as string}
                          className={`text-xl ${m.highlight ? "text-[#86efac]" : "text-white/70"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${m.highlight ? "text-[#86efac]" : "text-white"}`}>
                        {m.label}
                      </p>
                      <p className="text-[11px] text-white/40 truncate">{m.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div {...reveal(0.5, 10)} className="mt-auto">
                <Link
                  href="/properti/semua"
                  className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#86efac] transition-colors"
                >
                  Jelajahi Semua Aset
                  <Icon icon="solar:arrow-right-linear" className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* ===== TRUST STRIP — mengalir berurutan ===== */}
        <motion.div {...staggerGroup} className="grid sm:grid-cols-3 gap-4 mt-5 md:mt-6">
          {trust.map((t) => (
            <motion.div
              key={t.title}
              variants={groupItem}
              className="rounded-2xl bg-[#141414] border border-white/10 p-5 flex items-start gap-3 hover:border-white/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Icon icon={t.icon} className="text-xl text-[#86efac]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{t.title}</p>
                <p className="text-[12px] text-white/45 leading-snug">{t.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhyKosku;
