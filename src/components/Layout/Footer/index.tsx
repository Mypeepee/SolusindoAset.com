"use client";

import React, { FC } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";

const NAV_LINKS = [
  { label: "Jual Beli Properti", href: "/Jual" },
  { label: "Aset Lelang", href: "/Lelang" },
  { label: "Sewa Properti", href: "/Sewa" },
  { label: "Agent Kami", href: "/agent" },
  { label: "Blog & Insight", href: "/blog" },
];

const INFO_LINKS = [
  { label: "Profil Perusahaan", href: "/about/company-profile" },
  { label: "Gabung Jadi Agent", href: "/gabung-jadi-agent" },
  { label: "Titip Jual Properti", href: "/titip-jual" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "#" },
];

const SOCIALS = [
  { icon: "fa6-brands:instagram", href: "#", label: "Instagram", color: "hover:text-pink-400 hover:border-pink-500/50 hover:bg-pink-500/10" },
  { icon: "fa6-brands:facebook-f", href: "#", label: "Facebook", color: "hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10" },
  { icon: "fa6-brands:whatsapp", href: "#", label: "WhatsApp", color: "hover:text-green-400 hover:border-green-500/50 hover:bg-green-500/10" },
  { icon: "fa6-brands:youtube", href: "#", label: "YouTube", color: "hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10" },
];

const Footer: FC = () => {
  return (
    <footer className="relative bg-[#070709] overflow-hidden">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/5 blur-[100px]" />
        <div className="absolute -bottom-16 right-0 w-72 h-72 rounded-full bg-emerald-400/4 blur-[80px]" />
      </div>

      {/* Top line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

      <div className="relative container mx-auto lg:max-w-screen-xl px-6 py-10">

        {/* Main grid: Brand | Nav | Info | Contact+Newsletter */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-8">

          {/* ── Brand col (4/12) ── */}
          <div className="col-span-2 md:col-span-4 lg:col-span-4 flex flex-col gap-4">

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 shrink-0 relative">
                <Image
                  src="/images/logo/LogoSolusindoPremier.png"
                  alt="Solusindo Aset Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight tracking-tight">
                  PT. Solusi Tangguh Rejeki
                </p>
                <p className="text-[9px] text-emerald-400/60 font-semibold tracking-widest uppercase leading-none mt-0.5">
                  SolusindoAset.com
                </p>
              </div>
            </div>

            <p className="text-white/35 text-xs leading-relaxed">
              Platform <span className="text-emerald-400 font-semibold">#1</span> untuk pencarian properti murah dan bersahabat di Indonesia.{" "}
              <span className="text-white/50">Aman, Mudah dan Terpercaya.</span>
            </p>

            {/* Contact info */}
            <div className="flex flex-col gap-2">
              <Link href="mailto:closingsystem@gmail.com" className="flex items-center gap-2 text-white/40 hover:text-emerald-400 transition-colors text-xs">
                <Icon icon="solar:letter-bold-duotone" className="text-emerald-400/60 text-sm shrink-0" />
                closingsystem@gmail.com
              </Link>
              <div className="flex items-start gap-2 text-white/35 text-xs">
                <Icon icon="solar:map-point-bold-duotone" className="text-emerald-400/50 text-sm shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Santorini Town Square, Jl. Ronggolawe No.2A,<br />
                  DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur
                </span>
              </div>
            </div>

          </div>

          {/* ── Navigasi (2/12) ── */}
          <div className="col-span-1 lg:col-span-2">
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-emerald-400/70 mb-4">Navigasi</p>
            <ul className="space-y-2.5">
              {NAV_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group flex items-center gap-1.5 text-white/35 hover:text-white text-xs transition-colors duration-200">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Informasi (2/12) ── */}
          <div className="col-span-1 lg:col-span-2">
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-emerald-400/70 mb-4">Informasi</p>
            <ul className="space-y-2.5">
              {INFO_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group flex items-center gap-1.5 text-white/35 hover:text-white text-xs transition-colors duration-200">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Newsletter (4/12) ── */}
          <div className="col-span-2 md:col-span-4 lg:col-span-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-emerald-400/70">Newsletter</p>
              <div className="flex gap-1.5">
                {SOCIALS.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className={`w-7 h-7 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/30 transition-all duration-200 ${s.color}`}
                  >
                    <Icon icon={s.icon} className="text-[10px]" />
                  </Link>
                ))}
              </div>
            </div>
            <p className="text-white/30 text-xs leading-relaxed mb-3">
              Dapatkan info lelang & properti terbaru langsung di inbox Anda.
            </p>
            <div className="relative">
              <input
                type="email"
                placeholder="Email Anda..."
                className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500/40 focus:outline-none rounded-xl py-2.5 pl-4 pr-11 text-xs text-white placeholder-white/20 transition-all duration-300"
              />
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-emerald-500 hover:bg-emerald-400 rounded-lg flex items-center justify-center text-black transition-colors">
                <Icon icon="solar:arrow-right-bold" className="text-xs" />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {["Aman", "Mudah", "Terpercaya"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400/60 border border-emerald-500/15 bg-emerald-500/5 px-2 py-1 rounded-full">
                  <Icon icon="solar:verified-check-bold" className="text-[10px]" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-8 pt-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white/20 text-[11px]">
              © {new Date().getFullYear()}{" "}
              <span className="text-white/35 font-medium">PT. Solusi Tangguh Rejeki</span>. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-white/20 text-[11px]">
            <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-500/40 text-sm" />
            <span>SolusindoAset.com — Terverifikasi &amp; Terlindungi</span>
          </div>
        </div>

      </div>

      {/* Bottom line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />

    </footer>
  );
};

export default Footer;
