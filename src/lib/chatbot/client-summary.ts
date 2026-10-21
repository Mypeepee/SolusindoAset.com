import type { BuyerCriteria } from "./property-knowledge";

export function clientFunnelSummary(c: BuyerCriteria) {
  const title = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (v) => v.toUpperCase());
  const money = (n: number) => `Rp ${Number(n).toLocaleString("id-ID")}`;
  const range = (min: number | null | undefined, max: number | null | undefined, format: (n: number) => string) =>
    min && max ? `${format(min)} – ${format(max)}` : max ? `Maks. ${format(max)}` : min ? `Min. ${format(min)}` : "Bebas";
  const types = (c.categories || (c.category ? [c.category] : [])).map(title);
  return {
    lokasi: c.location || c.city || "—", types: types.length ? types : ["Semua tipe"],
    transaksi: (c.transaction_types || (c.transaction_type ? [c.transaction_type] : [])).map(title).join(" / "),
    budget: range(c.min_price, c.max_price, money) + (c.rental_period ? c.transaction_type === "SEWA" ? ` / ${title(c.rental_period)}` : ` (sewa ${title(c.rental_period)})` : ""),
    luas: range(c.min_land_area_m2, c.max_land_area_m2, (n) => `${n.toLocaleString("id-ID")} m²`),
    landmark: c.nearby ? `${c.nearby.query}${c.nearby.radius_m ? ` · maks. ${c.nearby.radius_m.toLocaleString("id-ID")} m` : ""}` : null,
  };
}
