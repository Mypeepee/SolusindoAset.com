"use client";

import React from "react";
import { motion } from "framer-motion";

/* =========================================================
   Shared visual primitives for Solusindo Premier
   Company Profile — ultra-premium / web3-inspired
   ========================================================= */

/** Ambient background: animated orbs + subtle grid */
export const AmbientBackdrop: React.FC<{
  variant?: "emerald" | "gold" | "navy";
  intensity?: "low" | "high";
}> = ({ variant = "emerald", intensity = "low" }) => {
  const palette = {
    emerald: { a: "#86efac", b: "#14b8a6" },
    gold: { a: "#F5C56A", b: "#B98A2D" },
    navy: { a: "#3B82F6", b: "#0F172A" },
  }[variant];

  const opacity = intensity === "high" ? 0.18 : 0.1;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {/* Orb A */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: opacity, scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full blur-[120px]"
        style={{ background: palette.a }}
      />
      {/* Orb B */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: opacity * 0.85, scale: [1.05, 1, 1.05] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 -right-20 h-[32rem] w-[32rem] rounded-full blur-[140px]"
        style={{ background: palette.b }}
      />
    </div>
  );
};

/** Premium pill label above section titles */
export const PillLabel: React.FC<{
  children: React.ReactNode;
  tone?: "emerald" | "gold";
}> = ({ children, tone = "emerald" }) => {
  const color =
    tone === "gold" ? "text-[#F5C56A] border-[#F5C56A]/30 bg-[#F5C56A]/5" : "text-[#86efac] border-[#86efac]/20 bg-[#86efac]/5";
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`inline-flex items-center gap-2 py-1.5 px-3 rounded-full border ${color} text-[10px] font-bold tracking-[0.25em] uppercase`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </motion.span>
  );
};

/** Section title with gradient highlight */
export const SectionTitle: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
}> = ({ title, subtitle, align = "center" }) => (
  <div
    className={`max-w-3xl ${
      align === "center" ? "mx-auto text-center" : "text-left"
    }`}
  >
    <motion.h2
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05, duration: 0.6 }}
      className="text-3xl md:text-5xl font-extrabold leading-[1.1] text-white mt-4"
    >
      {title}
    </motion.h2>
    {subtitle ? (
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="text-white/55 text-sm md:text-base leading-relaxed mt-5"
      >
        {subtitle}
      </motion.p>
    ) : null}
  </div>
);

/** Gradient-bordered card wrapper (web3 feel) */
export const GradientCard: React.FC<{
  className?: string;
  children: React.ReactNode;
  glow?: "emerald" | "gold" | "blue" | "red";
}> = ({ className = "", children, glow = "emerald" }) => {
  const glowClass = {
    emerald: "from-[#86efac]/40 via-white/5 to-transparent",
    gold: "from-[#F5C56A]/40 via-white/5 to-transparent",
    blue: "from-blue-400/40 via-white/5 to-transparent",
    red: "from-red-400/40 via-white/5 to-transparent",
  }[glow];

  return (
    <div
      className={`group relative rounded-3xl p-[1px] bg-gradient-to-br ${glowClass} ${className}`}
    >
      <div className="relative h-full w-full rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
};

/** Tiny gold rule */
export const GoldRule: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`block h-[2px] w-12 rounded-full bg-gradient-to-r from-[#F5C56A] via-[#F5C56A]/60 to-transparent ${className}`}
  />
);
