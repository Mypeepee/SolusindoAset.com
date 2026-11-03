import type { AuctionHistoryItem } from "@/lib/auctionHistory";

type AuctionDate = Date | string | null | undefined;
type DatedAuction = {
  id_property: bigint | string;
  tanggal_lelang?: AuctionDate;
};

function auctionTime(value: AuctionDate): number {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Infinity;
}

/** Oldest auction first. Missing dates follow dated events; IDs only break ties. */
export function compareAuctionHistoryDates(
  a: DatedAuction,
  b: DatedAuction,
): number {
  const timeA = auctionTime(a.tanggal_lelang);
  const timeB = auctionTime(b.tanggal_lelang);
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  const idA = BigInt(a.id_property);
  const idB = BigInt(b.id_property);
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

type TimelineEntry = Pick<
  AuctionHistoryItem,
  "id_property" | "tanggal_lelang" | "harga_efektif" | "cakupan"
>;

/** Keep displayed rounds and price changes aligned with the chronological order. */
export function orderAuctionHistoryItems<T extends TimelineEntry>(
  items: readonly T[],
): Array<T & { urutan: number; delta_persen: number | null }> {
  let previousPrice: number | null = null;
  return [...items].sort(compareAuctionHistoryDates).map((item, index) => {
    const price = item.harga_efektif;
    let delta: number | null = null;
    if (
      item.cakupan === "SAMA" &&
      price !== null &&
      Number.isFinite(price) &&
      price > 0
    ) {
      if (previousPrice !== null) {
        delta = ((price - previousPrice) / previousPrice) * 100;
      }
      previousPrice = price;
    }
    return { ...item, urutan: index + 1, delta_persen: delta };
  });
}
