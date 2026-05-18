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
      label: "Tasks",
      icon: "solar:clipboard-check-linear",
      href: "/dashboard/tasks",
    },
  ];
  
  export const appsMenu: MenuItem[] = [
    {
      label: "Jadwal & Acara",
      icon: "solar:calendar-linear",
      href: "/dashboard/jadwal-acara"
    },
    {
      label: "Scrape",
      icon: "solar:spider-linear",
      href: "/dashboard/scrape"
    },
    {
      label: "E-commerce", 
      icon: "solar:bag-4-linear",
      href: "/dashboard/e-commerce"
    },
    { 
      label: "CRM", 
      icon: "solar:card-linear",
      href: "/dashboard/crm"
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
  