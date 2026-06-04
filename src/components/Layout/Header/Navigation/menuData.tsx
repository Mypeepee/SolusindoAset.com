import { HeaderItem } from "@/types/menu";

export const headerData: HeaderItem[] = [
  // 1. CARI PROPERTI (Revisi: 3 Kategori Utama)
  {
    label: "Cari Properti",
    href: "/PrimarySecondary", // Fallback link jika menu utama diklik
    submenu: [
      {
        label: "Semua Kategori",
        href: "/properti/semua",
        description: "Jelajahi semua jenis properti sekaligus",
        icon: "solar:map-point-rotate-bold-duotone",
      },
      {
        label: "Jual Beli (Primary & Second)",
        href: "/Jual",
        description: "Proyek baru developer & rumah siap huni",
        icon: "solar:home-smile-bold",
      },
      {
        label: "Aset Lelang",
        href: "/Lelang",
        description: "Aset investasi di bawah harga pasar",
        icon: "solar:tag-price-bold",
      },
      {
        label: "Sewa",
        href: "/Sewa",
        description: "Pilihan properti sewa",
        icon: "solar:key-minimalistic-square-bold",
      },
    ],
  },

  // 2. TITIP JUAL — sisi supply, menu utama (pair dengan "Cari Properti")
  {
    label: "Titip Jual",
    href: "/titip-jual",
  },

  // ... (Menu Agent, Tentang Kami, dll tetap sama)
  {
    label: "Agent Kami",
    href: "/agent",
    submenu: [
      {
        label: "Lihat Daftar Agent",
        href: "/agent",
        description: "Jelajahi 1.200+ agent profesional kami",
        icon: "solar:users-group-rounded-bold",
      },
      {
        label: "Gabung Jadi Agent",
        href: "/gabung-jadi-agent",
        description: "Bangun karier sebagai agent Solusindo Premier",
        icon: "solar:user-hand-up-bold",
      },
    ],
  },
  {
    label: "Tentang Kami",
    href: "/about/company-profile",
  },
  {
    label: "Blog",
    href: "/blog",
  },
  {
    label: "Bantuan",
    href: "/help",
  },
];