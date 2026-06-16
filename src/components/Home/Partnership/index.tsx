"use client";

import React, { useEffect, useRef } from "react";
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

const row = [...partners, ...partners, ...partners];

const Partnership = () => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = trackRef.current;
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll<HTMLElement>("[data-logo]")
    );
    if (!items.length) return;

    let raf = 0;
    let last: HTMLElement | null = null;

    const tick = () => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const el of items) {
        const r = el.getBoundingClientRect();
        const ic = r.left + r.width / 2;
        const d = Math.abs(ic - cx);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
      if (best !== last) {
        last?.classList.remove("is-focus");
        best?.classList.add("is-focus");
        last = best;
      }
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

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
        <div
          ref={trackRef}
          className="relative mt-10 sm:mt-12 overflow-hidden"
        >
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-[#0F0F0F] via-[#0F0F0F]/85 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-[#0F0F0F] via-[#0F0F0F]/85 to-transparent z-10" />

          {/* Center spotlight band */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-40 sm:w-56 z-[1]">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/[0.05] to-transparent" />
            <div className="absolute inset-y-2 left-0 w-px bg-gradient-to-b from-transparent via-emerald-400/30 to-transparent" />
            <div className="absolute inset-y-2 right-0 w-px bg-gradient-to-b from-transparent via-emerald-400/30 to-transparent" />
          </div>

          <motion.div
            animate={{ x: ["0%", "-33.333%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex items-center gap-10 sm:gap-14 whitespace-nowrap will-change-transform py-8"
          >
            {row.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                data-logo={`${p.name}-${i}`}
                className="logo-item shrink-0 inline-flex items-center justify-center grayscale opacity-40 transition-[filter,opacity,transform] duration-500 ease-out hover:grayscale-0 hover:opacity-100 hover:scale-110 [&.is-focus]:grayscale-0 [&.is-focus]:opacity-100 [&.is-focus]:scale-110"
              >
                <span className="relative h-10 w-32 sm:h-14 sm:w-44">
                  <Image
                    src={p.logo}
                    alt={p.name}
                    fill
                    sizes="200px"
                    className="object-contain"
                  />
                </span>
              </div>
            ))}
          </motion.div>
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
