"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// amount:0 = trigger saat pixel pertama masuk viewport (paling kompatibel di mobile/Safari)
const VIEWPORT = { once: true, amount: 0 } as const;

/** Ikon timbangan (lelang) — PNG hitam diwarnai via CSS mask (currentColor). */
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

const steps: { title: string; desc: string; icon?: string; balance?: boolean }[] = [
  { title: "Konsultasi Gratis", desc: "Ceritakan kebutuhan, kami pilihkan aset terbaik.", icon: "solar:chat-round-line-bold-duotone" },
  { title: "Cek Legalitas", desc: "Sertifikat & dokumen diverifikasi lebih dulu.", icon: "solar:shield-check-bold-duotone" },
  { title: "Bidding Didampingi", desc: "Proses lelang resmi didampingi sampai menang.", balance: true },
  { title: "Balik Nama", desc: "Proses cepat di notaris terpercaya.", icon: "solar:document-text-bold-duotone" },
  { title: "Serah Terima", desc: "Unit dikosongkan, kunci di tangan Anda.", icon: "solar:key-minimalistic-square-bold-duotone" },
];

function StepNode({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const delay = 0.18 + index * 0.22;
  return (
    <div className="relative shrink-0 md:mb-4">
      {/* halo ping saat node muncul */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-2xl border-2 border-[#86efac]/60"
        initial={{ opacity: 0, scale: 0.85 }}
        whileInView={{ opacity: [0, 0.55, 0], scale: [0.85, 1.6, 2.1] }}
        viewport={VIEWPORT}
        transition={{ duration: 1.1, ease: "easeOut", delay: delay + 0.05 }}
      />
      {/* node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={VIEWPORT}
        transition={{ type: "spring", stiffness: 240, damping: 16, delay }}
        whileHover={{ scale: 1.08, y: -3 }}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center border border-[#86efac]/30 bg-gradient-to-b from-[#1c1c1c] to-[#111] shadow-[0_0_22px_rgba(52,211,153,0.16)] cursor-default"
      >
        <motion.span
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: index * 0.35 }}
          className="flex text-[#86efac]"
        >
          {step.balance ? (
            <BalanceIcon className="w-6 h-6" />
          ) : (
            <Icon icon={step.icon as string} className="text-2xl" />
          )}
        </motion.span>
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#86efac] text-black text-[10px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(134,239,172,0.7)]">
          {index + 1}
        </span>
      </motion.div>
    </div>
  );
}

const Proses = () => {
  return (
    <section className="py-10 md:py-14 bg-[#0F0F0F] relative">
      {/* overflow-hidden dihapus dari section agar IntersectionObserver mobile/Safari tidak terblokir */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(52,211,153,0.06), transparent 70%)",
        }}
      />
      <div className="container mx-auto px-4 max-w-screen-xl relative z-10">
        {/* HEADER */}
        <div className="text-center mb-10 md:mb-12 max-w-2xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-3 uppercase"
          >
            Proses Aman & Transparan
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE }}
            className="text-3xl md:text-[2.6rem] font-extrabold text-white leading-tight mb-4"
          >
            Tanpa Ribet,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">
              Kami Kawal Tiap Langkah
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.15 }}
            className="text-white/50 text-sm md:text-base leading-relaxed"
          >
            Dari konsultasi sampai pegang kunci — setiap tahap didampingi tim
            bersertifikat. Tidak ada langkah yang Anda hadapi sendirian.
          </motion.p>
        </div>

        {/* TIMELINE (compact) */}
        <div className="relative max-w-4xl mx-auto">
          {/* ── garis horizontal (desktop) ── */}
          <div className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-white/[0.08]" />
          <motion.div
            className="hidden md:block absolute top-7 left-[10%] h-px bg-gradient-to-r from-transparent via-[#86efac] to-[#86efac]"
            style={{ boxShadow: "0 0 12px rgba(134,239,172,0.55)" }}
            initial={{ width: 0 }}
            whileInView={{ width: "80%" }}
            viewport={VIEWPORT}
            transition={{ duration: 1.6, ease: EASE, delay: 0.15 }}
          >
            {/* comet di ujung garis */}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_14px_5px_rgba(134,239,172,0.7)]" />
          </motion.div>

          {/* ── garis vertikal (mobile) ── */}
          <div className="md:hidden absolute top-7 bottom-7 left-7 w-px bg-white/[0.08]" />
          <motion.div
            className="md:hidden absolute top-7 left-7 w-px bg-gradient-to-b from-transparent via-[#86efac] to-[#86efac]"
            style={{ boxShadow: "0 0 12px rgba(134,239,172,0.55)" }}
            initial={{ height: 0 }}
            whileInView={{ height: "85%" }}
            viewport={VIEWPORT}
            transition={{ duration: 1.6, ease: EASE, delay: 0.15 }}
          />

          {/* steps */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-y-7 md:gap-x-2">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0 text-left md:text-center"
              >
                <StepNode step={s} index={i} />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.32 + i * 0.22 }}
                  className="md:px-1.5 pt-2.5 md:pt-0"
                >
                  <h3 className="text-[15px] md:text-base font-bold text-white mb-1">{s.title}</h3>
                  <p className="text-[12px] text-white/45 leading-snug">{s.desc}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Proses;
