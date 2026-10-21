// One calendar month in WIB, including the entire cutoff date. An import or
// edit timestamp must never make an old auction eligible for recommendations.
export const AUCTION_FRESHNESS_VERSION = '2026-10-21-one-calendar-month-wib';
const WIB = 7 * 3600000;
export function auctionFreshnessCutoff(now = Date.now()) {
  const local = new Date(Number(now) + WIB);
  const month = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1));
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(local.getUTCDate(), lastDay)) - WIB);
}
export function isFreshAuction(listing, now = Date.now()) {
  if (String(listing?.jenis_transaksi ?? listing?.transaction_type).toUpperCase() !== 'LELANG') return true;
  const raw = listing.tanggal_lelang ?? listing.auction_at;
  const date = raw instanceof Date ? raw.getTime() : typeof raw === 'string' && raw.trim() ? Date.parse(raw) : NaN;
  return Number.isFinite(date) && date >= auctionFreshnessCutoff(now).getTime();
}
/** @returns {import('@prisma/client').Prisma.ListingWhereInput} */
export function freshAuctionWhere(now = Date.now()) {
  return { OR: [{ jenis_transaksi: { not: 'LELANG' } }, { jenis_transaksi: 'LELANG', tanggal_lelang: { gte: auctionFreshnessCutoff(now) } }] };
}
