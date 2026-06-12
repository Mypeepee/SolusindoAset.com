// src/app/dashboard/components/sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import { homepageMenu, appsMenu, type MenuItem } from "./list-menu";

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function OwnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-72 flex-col border-r border-white/5 bg-[#040608]">

      {/* ── SCROLLABLE ZONE ─────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Logo */}
        <Link
          href="/"
          className="group relative mb-8 flex items-center gap-2.5 px-1 rounded-2xl transition-all duration-300"
        >
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 rounded-full bg-emerald-500/0 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/35 group-hover:scale-125" />
            <Image
              src="/images/logo/LogoSolusindoPremier.png"
              alt="Logo Premier"
              width={40}
              height={40}
              className="relative z-10 w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <span className="text-2xl font-bold tracking-tight transition-colors duration-300 group-hover:text-white">
            <span className="text-white">Solusindo</span>
            <span className="ml-1 text-[#86efac] group-hover:text-emerald-300">Aset</span>
          </span>
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="mx-0.5 mt-1 h-9 rounded-2xl bg-emerald-500/6" />
          </div>
        </Link>

        {/* HOME SECTION */}
        <SectionLabel>Homepage</SectionLabel>
        <nav className="mb-6 space-y-1.5">
          {homepageMenu.map((item) => (
            <SidebarItem key={item.label} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* APPS SECTION */}
        <SectionLabel>Apps</SectionLabel>
        <nav className="space-y-1.5">
          {appsMenu.map((item) => (
            <SidebarItem key={item.label} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        {/* ── STICKY EXIT — tight after last item, sticks when scrolling ── */}
        <div className="sticky bottom-0 pt-3 pb-5 bg-[#040608]">
          <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
          <ExitButton />
        </div>
      </div>
    </aside>
  );
}

function ExitButton() {
  return (
    <Link
      href="/"
      className="
        group relative flex items-center gap-3.5
        px-4 py-3.5 rounded-2xl
        overflow-hidden
        transition-all duration-500
        border border-white/[0.07]
        bg-gradient-to-br from-white/[0.035] to-transparent
        hover:border-emerald-400/35
        hover:from-emerald-500/[0.09] hover:to-emerald-900/[0.04]
        hover:shadow-[0_0_28px_rgba(52,211,153,0.12),inset_0_1px_0_rgba(52,211,153,0.10)]
        active:scale-[0.985]
      "
    >
      {/* Ambient breathing glow — always on, subtle */}
      <div
        className="
          pointer-events-none absolute -inset-1 rounded-2xl
          bg-emerald-500/[0.06] blur-xl
          opacity-0 group-hover:opacity-100
          transition-opacity duration-700
        "
      />

      {/* Shimmer sweep on hover */}
      <span className="
        pointer-events-none absolute inset-0
        -translate-x-full skew-x-[-18deg]
        bg-gradient-to-r from-transparent via-white/[0.055] to-transparent
        group-hover:translate-x-full
        transition-transform duration-700
      " />

      {/* Icon orb */}
      <div className="
        relative shrink-0
        flex h-9 w-9 items-center justify-center
        rounded-xl
        border border-emerald-400/25
        bg-gradient-to-br from-emerald-500/20 to-emerald-900/10
        shadow-[0_0_14px_rgba(52,211,153,0.15)]
        group-hover:border-emerald-400/50
        group-hover:shadow-[0_0_20px_rgba(52,211,153,0.28)]
        group-hover:from-emerald-500/30
        transition-all duration-500
      ">
        <Icon
          icon="solar:home-smile-angle-bold-duotone"
          className="text-emerald-400 text-[19px] transition-transform duration-300 group-hover:scale-110"
        />
        {/* Glow dot */}
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#040608] shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span className="text-[0.84rem] font-bold text-emerald-200/90 leading-tight group-hover:text-emerald-100 transition-colors duration-300">
          Kembali ke Beranda
        </span>
        <span className="text-[10px] text-slate-500 leading-tight mt-0.5 group-hover:text-slate-400 transition-colors duration-300">
          Keluar dari dashboard
        </span>
      </div>

      {/* Arrow */}
      <div className="
        ml-auto shrink-0
        flex h-7 w-7 items-center justify-center
        rounded-lg border border-white/[0.06]
        bg-white/[0.03]
        group-hover:border-emerald-400/30
        group-hover:bg-emerald-500/10
        transition-all duration-300
      ">
        <Icon
          icon="solar:arrow-right-up-bold"
          className="text-[12px] text-slate-600 group-hover:text-emerald-400 transition-all duration-300 group-hover:translate-x-px group-hover:-translate-y-px"
        />
      </div>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-2 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

function SidebarItem({ item, active }: { item: MenuItem; active?: boolean }) {
  const isLink = Boolean(item.href);
  const base =
    "group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-150";
  const state = active
    ? "bg-emerald-500/12 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.45)] border border-emerald-400/40"
    : "text-slate-300 hover:bg-white/5 hover:text-emerald-200 border border-transparent";

  const content = (
    <>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#050608] border border-white/10 group-hover:border-emerald-400/50">
        <Icon
          icon={item.icon}
          className={active ? "text-emerald-300 text-[20px]" : "text-slate-400 group-hover:text-emerald-300 text-[20px]"}
        />
      </div>
      <span className="truncate text-[0.95rem]">{item.label}</span>
      {item.href && (
        <Icon
          icon="solar:alt-arrow-right-linear"
          className="ml-auto text-[16px] text-slate-500 group-hover:text-emerald-300"
        />
      )}
    </>
  );

  if (isLink) {
    return <Link href={item.href!} className={`${base} ${state}`}>{content}</Link>;
  }

  return <button type="button" className={`${base} ${state}`}>{content}</button>;
}
