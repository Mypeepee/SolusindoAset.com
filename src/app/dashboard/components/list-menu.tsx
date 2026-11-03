// src/app/dashboard/components/list-menu.tsx
import type { IconifyIcon } from "@iconify/react";
import { marketingMenuIcon } from "./marketing-menu-icon";

export interface MenuItem {
    label: string;
    icon: string | IconifyIcon;
    href?: string;
  }
  
  /* URUTAN MENU — satu tulang punggung untuk semua jabatan:
     Dashboard → Pemasaran (OWNER) → Tugas → Client → Listings → Transaksi → Project.
     Urutannya mengikuti alur kerja harian agent, bukan abjad atau kebetulan:
     buka dashboard, lihat tugas hari ini, urus klien, baru cari/urus aset,
     lalu transaksi yang berjalan, dan project di belakang karena bukan
     pekerjaan harian. Item khusus jabatan (Agents, Surat, Survei, Berita)
     menempel di belakang tulang punggung ini supaya posisi enam menu utama
     tidak pernah bergeser saat agent naik jabatan. */
  export const homepageMenu: MenuItem[] = [
    { label: "Dashboard", icon: "solar:widget-5-linear", href: "/dashboard" },
    { label: "Pemasaran", icon: marketingMenuIcon, href: "/dashboard/pemasaran" },
    {
      label: "Tugas",
      icon: "solar:clipboard-check-linear",
      href: "/dashboard/tugas",
    },
    {
      label: "Client",
      icon: "solar:users-group-rounded-linear",
      href: "/dashboard/crm",
    },
    {
      label: "Listings",
      icon: "solar:buildings-3-linear",
      href: "/dashboard/listings",
    },
    {
      label: "Transaksi",
      icon: "solar:hand-money-linear",
      href: "/dashboard/transaksi",
    },
    {
      label: "Project",
      icon: "solar:presentation-graph-linear",
      href: "/dashboard/project"
    },
    { label: "Chatbot", icon: "solar:chat-round-dots-linear", href: "/dashboard/chatbot-integration" },
    { label: "AI Bot Playground", icon: "solar:code-square-linear", href: "/dashboard/chatbot-playground" },
    {
      label: "Agents",
      icon: "solar:user-id-linear",
      href: "/dashboard/human-resource-management",
    },
    {
      label: "Surat",
      icon: "solar:document-text-linear",
      href: "/dashboard/surat",
    },
    {
      label: "Jadwal Survei",
      icon: "solar:map-point-wave-linear",
      href: "/dashboard/survei",
    },
  ];

  // ── Menu per-jabatan ────────────────────────────────────────────
  // Item dasar dipakai untuk membangun menu sesuai jabatan agent.
  const MENU: Record<string, MenuItem> = {
    dashboard: { label: "Dashboard", icon: "solar:widget-5-linear", href: "/dashboard" },
    tugas: { label: "Tugas", icon: "solar:clipboard-check-linear", href: "/dashboard/tugas" },
    listings: { label: "Listings", icon: "solar:buildings-3-linear", href: "/dashboard/listings" },
    agents: { label: "Agents", icon: "solar:user-id-linear", href: "/dashboard/human-resource-management" },
    transaksi: { label: "Transaksi", icon: "solar:hand-money-linear", href: "/dashboard/transaksi" },
    crm: { label: "Client", icon: "solar:users-group-rounded-linear", href: "/dashboard/crm" },
    project: { label: "Project", icon: "solar:presentation-graph-linear", href: "/dashboard/project" },
    berita: { label: "Berita", icon: "solar:notebook-linear", href: "/dashboard/berita" },
    chatbot: { label: "Chatbot", icon: "solar:chat-round-dots-linear", href: "/dashboard/chatbot-integration" },
    playground: { label: "AI Bot Playground", icon: "solar:code-square-linear", href: "/dashboard/chatbot-playground" },
  };

  // Jabatan yang boleh mengelola berita (sinkron dengan API + middleware).
  const BERITA_EDITORS = ["OWNER", "ADMIN", "PRINCIPAL"];

  export type DashboardMenu = { homepage: MenuItem[]; apps: MenuItem[] };

  /**
   * Menu sidebar sesuai jabatan agent.
   * - OWNER          : homepage + Jadwal & Acara, Scrape, Investor
   * - PRINCIPAL      : + menu Agents (dibatasi kantor sendiri di halaman HRM)
   * - AGENT/STOKER/ADMIN/TEAMLEADER : tanpa menu Agents
   */
  export function getDashboardMenu(jabatan?: string | null): DashboardMenu {
    const j = (jabatan || "").toUpperCase();

    const canBerita = BERITA_EDITORS.includes(j);

    if (j === "OWNER") {
      return {
        homepage: canBerita ? [...homepageMenu, MENU.berita] : homepageMenu,
        apps: appsMenu,
      };
    }

    if (j === "PRINCIPAL") {
      return {
        homepage: [
          MENU.dashboard,
          MENU.tugas,
          MENU.crm,
          MENU.listings,
          MENU.transaksi,
          MENU.project,
          MENU.agents,
          ...(canBerita ? [MENU.berita] : []),
        ],
        apps: [],
      };
    }

    // AGENT, STOKER, ADMIN, TEAMLEADER (default)
    return {
      homepage: [
        MENU.dashboard,
        MENU.tugas,
        MENU.crm,
        MENU.listings,
        MENU.transaksi,
        MENU.project,
        ...(canBerita ? [MENU.berita] : []),
      ],
      apps: [],
    };
  }

  export const appsMenu: MenuItem[] = [
    {
      label: "Jadwal & Acara",
      icon: "solar:calendar-linear",
      href: "/dashboard/jadwal-acara"
    },
    {
      label: "Scrape",
      icon: "solar:cloud-plus-linear",
      href: "/dashboard/scrape"
    },
    {
      label: "Investor",
      icon: "solar:chart-square-linear",
      href: "/dashboard/investor"
    },
  ];
