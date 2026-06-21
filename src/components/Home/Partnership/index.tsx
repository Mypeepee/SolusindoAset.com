"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

// ============================================================================
// DATA PARTNERS
// ============================================================================
const partners = [
  { name: "BCA", logo: "/images/logo/BCA.png" },
  { name: "BNI", logo: "/images/logo/BNI.png" },
  { name: "BRI", logo: "/images/logo/BRI.svg.webp" },
  { name: "BTN", logo: "/images/logo/btn.svg.png" },
  { name: "Bukopin", logo: "/images/logo/Bukopin.svg.png" },
  { name: "JTrust", logo: "/images/logo/jtrust.svg.png" },
  { name: "Mandiri", logo: "/images/logo/mandiri.svg.png" },
  { name: "Permata", logo: "/images/logo/Permata.svg.png" },
];

// 2 salinan → loop seamless saat track digeser -50%.
const loop = [...partners, ...partners];

// Kecepatan: ~2.5 dtk per logo (kalem & terbaca, bukan ngebut).
const DURATION = `${partners.length * 2.5}s`;

/**
 * Satu baris logo yang bergeser. `colored=false` → versi putih monokrom
 * (terlihat di dark mode). `colored=true` → warna asli (dipakai layer atas
 * yang di-mask ke tengah, jadi hanya logo di tengah yang berwarna).
 */
const Track = ({ colored }: { colored: boolean }) => (
  <div
    className="flex w-max items-center py-8 animate-logo-marquee will-change-transform"
    style={{ animationDuration: DURATION }}
    aria-hidden={colored ? true : undefined}
  >
    {loop.map((p, i) => (
      <div
        key={`${p.name}-${i}`}
        className="mx-6 sm:mx-9 shrink-0 inline-flex items-center justify-center"
      >
        <span className="relative h-10 w-32 sm:h-14 sm:w-44">
          <Image
            src={p.logo}
            alt={colored || i >= partners.length ? "" : p.name}
            fill
            sizes="200px"
            className={`object-contain ${colored ? "" : "brightness-0 invert opacity-50"}`}
          />
        </span>
      </div>
    ))}
  </div>
);

const Partnership = () => {
  return (
    <section className="relative w-full pt-4 pb-10 overflow-hidden bg-[#0F0F0F] border-t border-white/5 z-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(52,211,153,0.06), transparent 70%)",
        }}
      />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-widest mb-2"
          >
            EKOSISTEM KAMI
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl font-bold text-white"
          >
            Dipercaya oleh{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] via-emerald-400 to-teal-400">
              Pemimpin Industri
            </span>
          </motion.h2>
        </div>

        {/* Marquee track */}
        <div className="relative mt-10 sm:mt-12 overflow-hidden">
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-[#0F0F0F] via-[#0F0F0F]/85 to-transparent z-20" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-[#0F0F0F] via-[#0F0F0F]/85 to-transparent z-20" />

          {/* Center spotlight band (penanda zona "menyala") */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-44 sm:w-60 z-[1]">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/[0.05] to-transparent" />
            <div className="absolute inset-y-3 left-0 w-px bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
            <div className="absolute inset-y-3 right-0 w-px bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
          </div>

          {/* LAYER 1: logo putih monokrom (selalu terlihat di dark mode) */}
          <Track colored={false} />

          {/* LAYER 2: logo warna asli, di-mask ke tengah → otomatis menyala
              saat melintasi pusat. Animasi identik dengan layer 1 → sinkron. */}
          <div className="marquee-color-mask absolute inset-0 z-[2] overflow-hidden">
            <Track colored={true} />
          </div>
        </div>

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-6 sm:mt-8 text-center"
        >
          <p className="inline-flex items-center gap-2 text-[11px] sm:text-[12px] text-white/40 tracking-wide">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Bersama lebih dari{" "}
            <span className="text-white font-bold">20+ institusi</span> di
            Indonesia.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Partnership;
