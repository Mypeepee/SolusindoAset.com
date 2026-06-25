"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring" as const, stiffness: 180, damping: 22 };
const VIEWPORT = { once: true, amount: 0 } as const;

const WA_LINK = "https://wa.me/6281335716679";
const WA_DISPLAY = "+62 813-3571-6679";
const EMAIL = "closingsystem@gmail.com";
const ADDRESS = "Santorini Town Square, Jl. Ronggolawe No.2A, Surabaya 60160";
const MAP_LINK = "https://maps.google.com/?q=Santorini+Town+Square+Surabaya";
const MAP_EMBED =
  "https://www.google.com/maps?q=Santorini+Town+Square+Jl+Ronggolawe+2A+Surabaya&output=embed";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const item = (y = 20) => ({
  hidden: { opacity: 0, y, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
});

const CtaPenutup = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0 });

  return (
    <section className="py-10 md:py-14 bg-[#0F0F0F] overflow-x-clip" ref={ref}>
      <div className="container mx-auto px-4 max-w-screen-xl">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative"
        >
          {/* ambient halo — pulses when in view */}
          <motion.div
            className="pointer-events-none absolute -inset-8 rounded-[3rem] blur-3xl"
            animate={inView ? { opacity: [0.3, 0.55, 0.3] } : { opacity: 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(ellipse at 30% 60%, rgba(52,211,153,0.22), transparent 60%)",
            }}
          />

          {/* animated gradient border */}
          <motion.div
            className="relative rounded-[2rem] overflow-hidden"
            animate={inView ? { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{
              padding: "1px",
              background:
                "linear-gradient(135deg, rgba(134,239,172,0.5), rgba(255,255,255,0.06) 40%, rgba(20,184,166,0.35) 70%, rgba(134,239,172,0.5))",
              backgroundSize: "200% 200%",
            }}
          >
            <div className="relative rounded-[2rem] bg-gradient-to-br from-[#0e1d14] via-[#0b0f0d] to-[#090909] overflow-hidden">

              {/* subtle dot grid */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: "radial-gradient(circle, #86efac 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />

              {/* animated scan line */}
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-[2px] z-20"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(134,239,172,0.18) 30%, rgba(134,239,172,0.35) 50%, rgba(134,239,172,0.18) 70%, transparent)",
                }}
                animate={{ top: ["-2px", "100%", "-2px"] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                {/* ── LEFT: CTA ── */}
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  whileInView="show"
                  viewport={VIEWPORT}
                  className="relative p-8 md:p-10 lg:p-12 flex flex-col justify-center"
                >
                  {/* eyebrow badge */}
                  <motion.span
                    variants={item(8)}
                    className="inline-flex w-fit items-center gap-2 py-1.5 px-3.5 rounded-full bg-[#86efac]/10 border border-[#86efac]/30 text-[#86efac] text-[10px] font-bold tracking-[0.22em] uppercase mb-5 font-mono"
                  >
                    <motion.span
                      className="relative flex h-2 w-2"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                    </motion.span>
                    Mulai Hari Ini
                  </motion.span>

                  {/* headline */}
                  <motion.h2
                    variants={item(22)}
                    className="text-3xl md:text-4xl lg:text-[2.7rem] font-extrabold text-white leading-[1.08] mb-4"
                  >
                    Siap Punya Aset{" "}
                    <motion.span
                      className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] via-emerald-400 to-teal-400"
                      animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ backgroundSize: "200% 200%" }}
                    >
                      Impian Anda?
                    </motion.span>
                  </motion.h2>

                  <motion.p
                    variants={item(14)}
                    className="text-white/55 text-sm md:text-base leading-relaxed mb-7 max-w-md"
                  >
                    Mulai pencarian sekarang, atau langsung ngobrol dengan tim kami
                    untuk cari aset terbaik sesuai kebutuhan &amp; budget Anda.
                  </motion.p>

                  {/* buttons */}
                  <motion.div
                    variants={item(10)}
                    className="flex flex-col sm:flex-row gap-3 mb-7"
                  >
                    <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }} transition={SPRING}>
                      <Link
                        href="/properti/semua"
                        className="group/btn inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-[#86efac] hover:bg-[#6ee7b7] text-black font-bold px-6 py-3.5 rounded-full shadow-[0_0_30px_rgba(134,239,172,0.35)] hover:shadow-[0_0_52px_rgba(134,239,172,0.6)] transition-all"
                      >
                        <motion.span
                          animate={{ rotate: [0, -8, 0] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Icon icon="solar:magnifer-bold" className="text-lg" />
                        </motion.span>
                        Cari Aset Sekarang
                      </Link>
                    </motion.div>
                    <motion.a
                      href={WA_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      transition={SPRING}
                      className="inline-flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.09] text-white border border-white/15 hover:border-[#86efac]/50 font-bold px-6 py-3.5 rounded-full transition-colors"
                    >
                      <Icon icon="ic:baseline-whatsapp" className="text-lg text-[#86efac]" />
                      Chat WhatsApp
                    </motion.a>
                  </motion.div>

                  {/* contact rows */}
                  <motion.div
                    variants={item(10)}
                    className="flex flex-col gap-2.5 pt-6 border-t border-white/[0.07]"
                  >
                    {[
                      { href: WA_LINK, icon: "ic:baseline-whatsapp", label: WA_DISPLAY, isExternal: true },
                      { href: `mailto:${EMAIL}`, icon: "solar:letter-bold-duotone", label: EMAIL, isExternal: false },
                    ].map(({ href, icon, label, isExternal }) => (
                      <motion.a
                        key={label}
                        href={href}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        whileHover={{ x: 3 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="group/c flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors"
                      >
                        <span className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover/c:border-[#86efac]/40 group-hover/c:bg-[#86efac]/10 transition-all">
                          <Icon icon={icon} className="text-[#86efac]" />
                        </span>
                        <span className="font-semibold break-all">{label}</span>
                        <span className="ml-auto text-[10px] text-white/30 font-mono uppercase tracking-wider shrink-0">
                          24 Jam
                        </span>
                      </motion.a>
                    ))}
                  </motion.div>
                </motion.div>

                {/* ── RIGHT: MAP ── */}
                <motion.a
                  href={MAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
                  className="group/map relative min-h-[320px] lg:min-h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-white/[0.07]"
                >
                  {/* map iframe */}
                  <iframe
                    title="Kantor Pusat Solusindo"
                    src={MAP_EMBED}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-700 group-hover/map:scale-[1.03]"
                    style={{
                      border: 0,
                      filter: "invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(1.05)",
                    }}
                  />

                  {/* left blend edge on desktop */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(11,15,13,0.6), transparent 24%)",
                    }}
                  />

                  {/* info bar */}
                  <div className="absolute bottom-0 inset-x-0 z-10 px-4 sm:px-5 pb-5 pt-16 bg-gradient-to-t from-[#090909] via-[#090909]/96 to-transparent">
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={VIEWPORT}
                      transition={{ delay: 0.5, duration: 0.5, ease: EASE }}
                      className="inline-flex items-center gap-1.5 mb-2 text-emerald-300 text-[10px] font-bold uppercase tracking-[0.18em]"
                    >
                      <Icon icon="solar:map-point-bold" /> Kantor Pusat
                    </motion.span>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={VIEWPORT}
                      transition={{ delay: 0.58, duration: 0.5, ease: EASE }}
                      className="text-white text-[13px] sm:text-sm font-semibold leading-snug mb-2"
                    >
                      {ADDRESS}
                    </motion.p>
                    <motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={VIEWPORT}
                      transition={{ delay: 0.66 }}
                      className="inline-flex items-center gap-1.5 text-[#86efac] text-xs font-bold"
                    >
                      Buka di Google Maps
                      <motion.span
                        animate={{ x: [0, 3, 0], y: [0, -3, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Icon icon="solar:arrow-right-up-bold" />
                      </motion.span>
                    </motion.span>
                  </div>

                  {/* hover overlay shimmer */}
                  <div className="absolute inset-0 bg-[#86efac]/0 group-hover/map:bg-[#86efac]/[0.03] transition-colors duration-500 pointer-events-none" />
                </motion.a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaPenutup;
