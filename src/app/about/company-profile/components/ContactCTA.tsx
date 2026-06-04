"use client";

import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel } from "./_shared";

type Contact = {
  icon: string;
  label: string;
  value: string;
  href: string;
  meta?: string;
  action: string;
};

const contacts: Contact[] = [
  {
    icon: "solar:phone-calling-bold-duotone",
    label: "Telepon",
    value: "+62 813-3571-6679",
    href: "tel:+6281335716679",
    meta: "Jam kerja · Senin – Sabtu",
    action: "Hubungi",
  },
  {
    icon: "solar:letter-bold-duotone",
    label: "Email",
    value: "closingsystem@gmail.com",
    href: "mailto:closingsystem@gmail.com",
    meta: "Respon < 24 jam",
    action: "Kirim Email",
  },
  {
    icon: "solar:map-point-bold-duotone",
    label: "Kantor Pusat",
    value: "Santorini Town Square, Jl. Ronggolawe No.2A, Surabaya 60160",
    href: "https://maps.google.com/?q=Santorini+Town+Square+Surabaya",
    meta: "Buka di Google Maps",
    action: "Lihat Lokasi",
  },
];

/* ────────── Contact Card with spotlight + HUD ticks ────────── */
const ContactCard: React.FC<{ c: Contact; index: number }> = ({ c, index }) => {
  const ref = useRef<HTMLAnchorElement>(null);
  const sx = useMotionValue(-9999);
  const sy = useMotionValue(-9999);
  const spotlight = useTransform(
    [sx, sy] as unknown as MotionValue<number>[],
    ([x, y]: number[]) =>
      `radial-gradient(320px circle at ${x}px ${y}px, rgba(52,211,153,0.16), transparent 60%)`
  );

  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    sx.set(e.clientX - r.left);
    sy.set(e.clientY - r.top);
  };
  const handleLeave = () => {
    sx.set(-9999);
    sy.set(-9999);
  };

  return (
    <motion.a
      ref={ref}
      href={c.href}
      target={c.label === "Kantor Pusat" ? "_blank" : undefined}
      rel="noopener noreferrer"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        delay: index * 0.08,
        duration: 0.55,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      whileHover={{ y: -3 }}
      className="group/c relative rounded-2xl p-[1px] bg-gradient-to-br from-emerald-400/30 via-white/[0.05] to-transparent hover:from-emerald-400/60 transition-all duration-500"
    >
      <div className="relative rounded-2xl bg-[#0B0F17]/95 p-6 h-full overflow-hidden flex flex-col">
        {/* Spotlight */}
        <motion.div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{ background: spotlight }}
        />

        {/* HUD ticks */}
        <span className="pointer-events-none absolute top-2.5 left-2.5 h-2 w-2 border-l border-t border-emerald-400/40 opacity-50 group-hover/c:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute top-2.5 right-2.5 h-2 w-2 border-r border-t border-emerald-400/40 opacity-50 group-hover/c:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-2 w-2 border-l border-b border-emerald-400/40 opacity-50 group-hover/c:opacity-100 transition-opacity" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-2 w-2 border-r border-b border-emerald-400/40 opacity-50 group-hover/c:opacity-100 transition-opacity" />

        {/* Top corner glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full blur-3xl bg-emerald-400/[0.08] group-hover/c:bg-emerald-400/20 transition-colors duration-700" />

        {/* Icon */}
        <div className="relative h-12 w-12 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] flex items-center justify-center group-hover/c:border-emerald-400/55 group-hover/c:bg-emerald-400/[0.12] group-hover/c:shadow-[0_0_22px_rgba(52,211,153,0.25)] transition-all duration-500">
          <Icon icon={c.icon} className="text-2xl text-emerald-300" />
        </div>

        {/* Label */}
        <div className="relative mt-5 text-[10px] tracking-[0.3em] uppercase font-mono font-bold text-emerald-300/85">
          {c.label}
        </div>

        {/* Value */}
        <div className="relative mt-1.5 text-white font-bold text-[14px] sm:text-sm leading-relaxed">
          {c.value}
        </div>

        {/* Meta */}
        {c.meta && (
          <div className="relative mt-1 text-white/40 text-[11px] sm:text-xs">
            {c.meta}
          </div>
        )}

        {/* Animated underline */}
        <div className="relative mt-4 h-px w-8 overflow-hidden bg-white/10">
          <motion.div
            className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2 + (index % 3) * 0.4,
            }}
          />
        </div>

        {/* Action */}
        <div className="relative mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] uppercase font-mono text-white/40 group-hover/c:text-emerald-300 transition-colors">
          {c.action}
          <Icon
            icon="solar:arrow-right-up-bold"
            className="text-base group-hover/c:translate-x-0.5 group-hover/c:-translate-y-0.5 transition-transform"
          />
        </div>
      </div>
    </motion.a>
  );
};

const ContactCTA: React.FC = () => {
  return (
    <section
      id="contact"
      className="relative w-full pt-6 sm:pt-8 md:pt-10 pb-14 sm:pb-16 md:pb-20 overflow-hidden bg-[#05070D]"
    >
      <AmbientBackdrop variant="emerald" intensity="high" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <PillLabel>Hubungi Kami</PillLabel>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-4 text-3xl sm:text-4xl md:text-6xl font-extrabold leading-[1.05] text-white tracking-tight"
          >
            Mari{" "}
            <span className="bg-gradient-to-r from-[#86efac] via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Berkolaborasi
            </span>
            .
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-5 text-white/60 text-[14px] sm:text-base leading-relaxed max-w-2xl mx-auto"
          >
            Tim kami siap membantu — dari konsultasi awal hingga eksekusi
            penuh.
          </motion.p>
        </div>

        {/* Contact cards */}
        <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {contacts.map((c, i) => (
            <ContactCard key={c.label} c={c} index={i} />
          ))}
        </div>

        {/* Final CTA panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="relative mt-10 sm:mt-12 mx-auto max-w-4xl"
        >
          {/* Outer halo */}
          <div
            className="pointer-events-none absolute -inset-6 rounded-[2.5rem] blur-3xl opacity-50"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(52,211,153,0.18), transparent 65%)",
            }}
          />

          <div className="relative rounded-[1.75rem] sm:rounded-[2rem] p-[1px] bg-gradient-to-br from-emerald-400/40 via-white/[0.06] to-teal-400/30 overflow-hidden">
            <div className="relative rounded-[1.7rem] sm:rounded-[1.95rem] bg-[#0B0F17]/95 backdrop-blur-xl p-8 sm:p-10 md:p-12 text-center overflow-hidden">
              {/* HUD corner ticks */}
              <span className="pointer-events-none absolute top-3 left-3 h-3 w-3 border-l border-t border-emerald-400/50" />
              <span className="pointer-events-none absolute top-3 right-3 h-3 w-3 border-r border-t border-emerald-400/50" />
              <span className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-l border-b border-emerald-400/50" />
              <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-r border-b border-emerald-400/50" />

              {/* Scan line */}
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent"
                animate={{ top: ["-2%", "102%"] }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Eyebrow */}
              <div className="relative flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-emerald-400/40" />
                <span className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase font-bold font-mono text-emerald-300">
                  Beyond Expectations
                </span>
                <span className="h-px w-8 bg-emerald-400/40" />
              </div>

              <h3 className="relative mt-5 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-[1.1] tracking-tight">
                Siap mempercayakan aset Anda kepada{" "}
                <span className="bg-gradient-to-r from-[#86efac] via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  profesional?
                </span>
              </h3>

              <p className="relative mt-4 text-white/60 text-[13px] sm:text-sm md:text-[15px] max-w-2xl mx-auto leading-relaxed">
                Konsultasi awal{" "}
                <span className="text-white font-semibold">gratis</span> untuk
                evaluasi portofolio dan strategi resolusi. Tim kami merespon{" "}
                <span className="text-emerald-300 font-semibold">dalam 24 jam</span>{" "}
                pada hari kerja.
              </p>

              {/* CTA buttons */}
              <div className="relative mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <a
                  href="https://wa.me/6281335716679"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/wa inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] font-bold text-sm tracking-wide shadow-[0_8px_30px_rgba(52,211,153,0.3)] hover:shadow-[0_14px_44px_rgba(52,211,153,0.5)] active:scale-[0.98] transition-all"
                >
                  <Icon icon="ic:baseline-whatsapp" className="text-lg" />
                  Chat WhatsApp
                  <Icon
                    icon="solar:arrow-right-bold"
                    className="text-base group-hover/wa:translate-x-0.5 transition-transform"
                  />
                </a>
                <a
                  href="mailto:closingsystem@gmail.com"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-full border border-emerald-400/25 bg-white/[0.04] backdrop-blur-md text-white text-sm font-semibold hover:bg-white/[0.08] hover:border-emerald-400/40 transition-all"
                >
                  <Icon
                    icon="solar:letter-bold-duotone"
                    className="text-lg text-emerald-300"
                  />
                  Kirim Email
                </a>
              </div>

              {/* Brand line */}
              <div className="relative mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-center gap-2 text-[10px] tracking-[0.35em] uppercase font-mono text-white/30">
                <span className="h-px w-8 bg-white/15" />
                PT Solusi Tangguh Rejeki · Solusindo Premier
                <span className="h-px w-8 bg-white/15" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactCTA;
