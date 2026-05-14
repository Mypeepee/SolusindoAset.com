export const KATEGORI_ICONS: Record<string, string> = {
  RUMAH:           "solar:home-smile-bold-duotone",
  APARTEMEN:       "solar:city-bold-duotone",
  RUKO:            "solar:shop-bold-duotone",
  TANAH:           "solar:map-point-wave-bold-duotone",
  GUDANG:          "solar:box-bold-duotone",
  HOTEL_DAN_VILLA: "solar:bed-bold-duotone",
  TOKO:            "solar:bag-heart-bold-duotone",
  PABRIK:          "solar:garage-bold-duotone",
};

export const SORT_OPTIONS = [
  { value: "terbaru",    label: "Terbaru",         icon: "solar:sort-by-time-bold-duotone"              },
  { value: "terpopuler", label: "Terpopuler",       icon: "solar:fire-bold-duotone"                      },
  { value: "termurah",   label: "Termurah",         icon: "solar:tag-price-bold-duotone"                 },
  { value: "termahal",   label: "Termahal",         icon: "solar:crown-bold-duotone"                     },
  { value: "luas-asc",   label: "Luasan Terkecil",  icon: "solar:minimize-square-3-bold-duotone"         },
  { value: "luas-desc",  label: "Luasan Terbesar",  icon: "solar:maximize-square-3-bold-duotone"         },
] as const;

export const TAB_KEYS = ["semua", "jual", "lelang", "sewa"] as const;
export type TabKey = typeof TAB_KEYS[number];
