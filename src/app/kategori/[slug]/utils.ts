import type { PropertyItem } from "./types";

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);

export const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export const getPropertyUrl = (item: PropertyItem): string => {
  const t  = item.jenis_transaksi?.toUpperCase();
  const id = `${item.slug}-${item.id_property}`;
  if (t === "SEWA")   return `/Sewa/${id}`;
  if (t === "LELANG") return `/Lelang/${id}`;
  return `/Jual/${id}`;
};
