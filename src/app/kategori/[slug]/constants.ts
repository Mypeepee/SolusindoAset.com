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
  { value: "terbaru",    label: "Terbaru"    },
  { value: "termurah",   label: "Termurah"   },
  { value: "termahal",   label: "Termahal"   },
  { value: "terpopuler", label: "Terpopuler" },
] as const;

export const TAB_KEYS = ["semua", "jual", "lelang", "sewa"] as const;
export type TabKey = typeof TAB_KEYS[number];
