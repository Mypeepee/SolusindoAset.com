import { HeaderItem } from "@/types/menu";

export const headerData: HeaderItem[] = [
  // 1. CARI PROPERTI (Revisi: 3 Kategori Utama)
  {
    label: "Cari Properti",
    href: "/PrimarySecondary", // Fallback link jika menu utama diklik
    submenu: [
      {
        label: "Semua Kategori",
        href: "/kategori/semua",
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

  // ... (Menu Agent, Tentang Kami, dll tetap sama)
  {
    label: "Agent Kami",
    href: "/agent",
  },
  {
    label: "Tentang Kami",
    href: "/about",
    submenu: [
      {
        label: "Profil Perusahaan",
        href: "/about/profile",
        icon: "solar:buildings-2-bold",
      },
      {
        label: "Gabung Jadi Agent",
        href: "/gabung-jadi-agent",
        icon: "solar:user-hand-up-bold",
      },
      {
        label: "Titip Jual Properti",
        href: "/titip-jual",
        icon: "solar:hand-shake-bold",
      },
    ],
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