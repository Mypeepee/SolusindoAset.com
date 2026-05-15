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
    <aside
      className="
        hidden md:flex w-72 flex-col
        border-r border-white/5 bg-[#040608] px-5 py-6
        overflow-y-auto
      "
    >
      {/* Logo */}
      <Link
        href="/"
        className="
          group relative
          mb-8 flex items-center gap-2.5 px-1
          rounded-2xl
          transition-all duration-300
        "
      >
        <div className="relative">
          <div
            className="
              pointer-events-none absolute inset-0
              rounded-full
              bg-emerald-500/0
              blur-2xl
              transition-all duration-500
              group-hover:bg-emerald-500/35
              group-hover:scale-125
            "
          />
          <Image
            src="/images/logo/logopremier.svg"
            alt="Logo Premier"
            width={40}
            height={40}
            className="
              relative z-10 w-10 h-10 object-contain
              transition-transform duration-300
              group-hover:scale-105
            "
          />
        </div>

        <span
          className="
            text-2xl font-bold tracking-tight
            transition-colors duration-300
            group-hover:text-white
          "
        >
          <span className="text-white">Premier</span>
          <span className="ml-1 text-[#86efac] group-hover:text-emerald-300">
            Asset
          </span>
        </span>

        <div
          className="
            pointer-events-none absolute inset-0 -z-10
            opacity-0 group-hover:opacity-100
            transition-opacity duration-500
          "
        >
          <div className="mx-0.5 mt-1 h-9 rounded-2xl bg-emerald-500/6" />
        </div>
      </Link>

      {/* HOME SECTION */}
      <SectionLabel>Homepage</SectionLabel>
      <nav className="mb-6 space-y-1.5">
        {homepageMenu.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* APPS SECTION */}
      <SectionLabel>Apps</SectionLabel>
      <nav className="mb-2 space-y-1.5">
        {appsMenu.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      {/* SPACER */}
      <div className="flex-1" />

      {/* EXIT TO HOME */}
      <div className="pt-4 mt-4 border-t border-white/5">
        <Link
          href="/"
          className="
            group relative flex items-center gap-3
            px-3.5 py-3 rounded-2xl
            border border-emerald-500/20
            bg-emerald-500/5
            hover:bg-emerald-500/12 hover:border-emerald-400/40
            transition-all duration-300
            overflow-hidden
          "
        >
          {/* scanning light sweep */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent" />

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-400/30 group-hover:bg-emerald-500/20 transition-colors shrink-0">
            <Icon icon="solar:home-smile-angle-bold-duotone" className="text-emerald-400 text-[20px]" />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-[0.85rem] font-semibold text-emerald-300 leading-tight">Kembali ke Beranda</span>
            <span className="text-[10px] text-slate-500 leading-tight">Keluar dari dashboard</span>
          </div>

          <Icon
            icon="solar:arrow-right-up-linear"
            className="ml-auto text-[15px] text-emerald-500/40 group-hover:text-emerald-400 transition-colors shrink-0"
          />
        </Link>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-2 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {children}
    </p>
  );
}

function SidebarItem({
  item,
  active,
}: {
  item: MenuItem;
  active?: boolean;
}) {
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
          className={
            active
              ? "text-emerald-300 text-[20px]"
              : "text-slate-400 group-hover:text-emerald-300 text-[20px]"
          }
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
    return (
      <Link href={item.href!} className={`${base} ${state}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={`${base} ${state}`}>
      {content}
    </button>
  );
}
