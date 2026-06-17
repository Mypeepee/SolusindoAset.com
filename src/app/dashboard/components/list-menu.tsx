// src/app/dashboard/components/list-menu.tsx

export interface MenuItem {
    label: string;
    icon: string;
    href?: string;
  }
  
  export const homepageMenu: MenuItem[] = [
    { label: "Dashboard", icon: "solar:widget-5-linear", href: "/dashboard" },
    {
      label: "Listings",
      icon: "solar:buildings-3-linear",
      href: "/dashboard/listings",
    },
    {
      label: "Agents", 
      icon: "solar:user-id-linear", 
      href: "/dashboard/human-resource-management",
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
    {
      label: "Surat",
      icon: "solar:document-text-linear",
      href: "/dashboard/surat",
    },
    {
      label: "Tugas",
      icon: "solar:clipboard-check-linear",
      href: "/dashboard/tugas",
    },
    {
      label: "CRM",
      icon: "solar:users-group-rounded-linear",
      href: "/dashboard/crm",
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
    crm: { label: "CRM", icon: "solar:users-group-rounded-linear", href: "/dashboard/crm" },
    project: { label: "Project", icon: "solar:presentation-graph-linear", href: "/dashboard/project" },
  };

  export type DashboardMenu = { homepage: MenuItem[]; apps: MenuItem[] };

  /**
   * Menu sidebar sesuai jabatan agent.
   * - OWNER          : lihat semuanya (homepage + apps lengkap)
   * - PRINCIPAL      : + menu Agents (dibatasi kantor sendiri di halaman HRM)
   * - AGENT/STOKER/ADMIN/TEAMLEADER : tanpa menu Agents
   */
  export function getDashboardMenu(jabatan?: string | null): DashboardMenu {
    const j = (jabatan || "").toUpperCase();

    if (j === "OWNER") {
      return { homepage: homepageMenu, apps: appsMenu };
    }

    if (j === "PRINCIPAL") {
      return {
        homepage: [
          MENU.dashboard,
          MENU.tugas,
          MENU.listings,
          MENU.agents,
          MENU.transaksi,
          MENU.crm,
          MENU.project,
        ],
        apps: [],
      };
    }

    // AGENT, STOKER, ADMIN, TEAMLEADER (default)
    return {
      homepage: [
        MENU.dashboard,
        MENU.tugas,
        MENU.listings,
        MENU.transaksi,
        MENU.crm,
        MENU.project,
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
      label: "E-commerce",
      icon: "solar:bag-4-linear",
      href: "/dashboard/e-commerce"
    },
    { 
      label: "Invoice", 
      icon: "solar:bill-list-linear",
      href: "/dashboard/invoice"
    },
    { 
      label: "E-mail", 
      icon: "solar:letter-linear",
      href: "/dashboard/email"
    },
    { 
      label: "Kanban", 
      icon: "solar:rows-3-linear",
      href: "/dashboard/kanban"
    },
    { 
      label: "Hiring", 
      icon: "solar:briefcase-linear",
      href: "/dashboard/hiring"
    },
    { 
      label: "Chat", 
      icon: "solar:chat-round-dots-linear",
      href: "/dashboard/chat"
    },
    { 
      label: "Social", 
      icon: "solar:share-circle-linear",
      href: "/dashboard/social"
    },
  ];
  