const DAY = 86400000;
const WIB = 7 * 3600000;
const calendarDay = timestamp => Math.floor((timestamp + WIB) / DAY);
const dateLabel = timestamp => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(timestamp);

// The auction instant determines expiry; WIB calendar dates determine the
// customer-facing day count. Server timezone and model arithmetic play no role.
export function auctionTimeline(asset, now = Date.now()) {
  const at = Date.parse(asset?.auction_at);
  if (!Number.isFinite(at) || !Number.isFinite(now)) return { status: 'unknown', at: null, date: null, days_until: null };
  const status = at <= now ? 'elapsed' : 'upcoming';
  return { status, at: new Date(at).toISOString(), date: dateLabel(at),
    days_until: status === 'upcoming' ? Math.max(0, calendarDay(at) - calendarDay(now)) : null };
}
