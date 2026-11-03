import type { AssetSnapshot } from "./domain";
import { jakartaDate } from "./domain";

export const AUCTION_LEAD_DAYS = 5;
export const AUCTION_LEAD_HOURS = AUCTION_LEAD_DAYS * 24;
export const URGENT_AUCTION_DAYS = 14;
export const CAMPAIGN_POLICY_VERSION = 5;
const DAY = 86400000;
export const FRESH_DAYS = 14;

/** A campaign needs time for a buyer to act before the auction starts. */
export function campaignAssetAvailable(
  asset: AssetSnapshot,
  when = new Date(),
) {
  if (!asset.images.length) return false;
  if (asset.category !== "LELANG") return true;
  const auction = Date.parse(asset.auctionDate || "");
  return (
    Number.isFinite(auction) &&
    auction - when.getTime() >= AUCTION_LEAD_HOURS * 3600000
  );
}

export function freshAssetOrder(assets: AssetSnapshot[]) {
  const listed = (asset: AssetSnapshot) => {
    const time = Date.parse(asset.sourceListedAt || "");
    return Number.isFinite(time) ? time : 0;
  };
  // Stable sorting retains Investor rank / the owner's order when dates tie.
  return [...assets].sort((a, b) => listed(b) - listed(a));
}

export function assetFreshnessLabel(asset: AssetSnapshot, now = new Date()) {
  const age = now.getTime() - Date.parse(asset.sourceListedAt || "");
  return age >= 0 && age <= FRESH_DAYS * 86400000
    ? "Baru masuk · " + Math.floor(age / 86400000) + " hari"
    : Number.isFinite(age) && asset.sourceListedAt
      ? "Masuk " +
        new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }).format(new Date(asset.sourceListedAt))
      : "Tanggal masuk belum tersedia";
}

export type CampaignExposure = { count: number; lastAt: number };
type ExposureJob = {
  assetKey: string | null;
  scheduledFor: Date | string;
  status: string;
  publications: { state: string; publishedAt?: Date | string | null }[];
};

/** Count one exposure per job, across channels. Missed/unattempted history is not exposure. */
export function campaignExposureHistory(
  jobs: readonly ExposureJob[],
  now = new Date(),
) {
  const events = jobs.flatMap((job) => {
    if (!job.assetKey) return [];
    const published = job.publications.flatMap((p) =>
      p.state === "published" && p.publishedAt
        ? [new Date(p.publishedAt).getTime()]
        : [],
    );
    const planned = new Date(job.scheduledFor).getTime();
    const ambiguous = job.publications.some((p) =>
      ["sending", "uncertain"].includes(p.state),
    );
    const reserved =
      ["queued", "paused", "preparing", "publishing"].includes(job.status) &&
      planned >= now.getTime();
    const time = published.length
      ? Math.max(...published)
      : ambiguous || reserved
        ? planned
        : NaN;
    return Number.isFinite(time) ? [{ key: job.assetKey, time }] : [];
  });
  return (when: Date) => {
    const history = new Map<string, CampaignExposure>();
    for (const event of events) {
      if (event.time > when.getTime()) continue;
      const previous = history.get(event.key);
      history.set(event.key, {
        count: (previous?.count || 0) + 1,
        lastAt: Math.max(previous?.lastAt || 0, event.time),
      });
    }
    return history;
  };
}

/** Reserve a daily share for coverage, rounded to whole sessions. */
export function campaignDailyAllocation(sessions: number) {
  const total = Math.max(1, Math.min(12, Math.trunc(sessions) || 1));
  const coverage = total === 1 ? 0 : Math.max(1, Math.round(total / 3));
  return { total, urgent: total - coverage, coverage };
}

export function campaignAllocationLabel(sessions: number) {
  const { total, urgent, coverage } = campaignDailyAllocation(sessions);
  return total === 1
    ? "1 sesi per hari · prioritas lelang dekat dan pemerataan bergilir antarhari."
    : `${total} sesi per hari · ${urgent} prioritas lelang dekat + ${coverage} pemerataan aset.`;
}

/** Allocate the actual daily sessions; expiry, cooldown and reservations stay mandatory. */
export function selectCampaignAssets(
  candidates: AssetSnapshot[],
  dates: Date[],
  cooldownDays: number,
  reserved: (when: Date) => Set<string>,
  blocked: (when: Date) => boolean,
  order: "fresh" | "manual" = "fresh",
  historyAt: (when: Date) => Map<string, CampaignExposure> = () => new Map(),
  rhythm?: { schedules: readonly string[]; noRepeat?: boolean },
) {
  const ordered = order === "fresh" ? freshAssetOrder(candidates) : candidates;
  const parcels = new Map<string, AssetSnapshot>();
  for (const asset of ordered)
    if (!parcels.has(asset.assetKey)) parcels.set(asset.assetKey, asset);
  const assets = [...parcels.values()];
  const rank = new Map(assets.map((asset, index) => [asset.id, index]));
  const uses = new Map<string, number>(),
    last = new Map<string, number>();
  const phase = dates.length
    ? [...historyAt(dates[0]).values()].reduce(
        (sum, item) => sum + item.count,
        0,
      )
    : 0;
  let cursor = 0,
    assigned = 0;
  const daySlots = new Map<string, Date[]>();
  for (const when of dates) {
    const day = jakartaDate(when);
    daySlots.set(day, [...(daySlots.get(day) || []), when]);
  }
  return dates.map((when, slotIndex) => {
    if (blocked(when))
      return { when, asset: null, reason: "CAMPAIGN_SLOT_CONFLICT" };
    const excluded = reserved(when),
      history = historyAt(when);
    const count = (asset: AssetSnapshot) =>
      (uses.get(asset.assetKey) || 0) +
      (history.get(asset.assetKey)?.count || 0);
    const lastAt = (asset: AssetSnapshot) =>
      Math.max(
        last.get(asset.assetKey) || 0,
        history.get(asset.assetKey)?.lastAt || 0,
      );
    const deadline = (asset: AssetSnapshot) =>
      asset.category === "LELANG"
        ? Date.parse(asset.auctionDate || "") - AUCTION_LEAD_DAYS * DAY
        : Infinity;
    const urgent = (asset: AssetSnapshot) =>
      asset.category === "LELANG" &&
      Date.parse(asset.auctionDate || "") - when.getTime() <=
        URGENT_AUCTION_DAYS * DAY;
    const available = assets.filter(
      (asset) =>
        campaignAssetAvailable(asset, when) &&
        (!rhythm?.noRepeat || !uses.has(asset.assetKey)) &&
        !excluded.has(asset.assetKey) &&
        (!lastAt(asset) || when.getTime() - lastAt(asset) > cooldownDays * DAY),
    );
    let asset: AssetSnapshot | undefined,
      reason = "CAMPAIGN_NO_ELIGIBLE_ASSET";
    if (order === "fresh") {
      const day = daySlots.get(jakartaDate(when))!;
      const allocation = campaignDailyAllocation(
        rhythm?.schedules.length || day.length,
      );
      const time = new Date(when.getTime() + 7 * 3600000)
        .toISOString()
        .slice(11, 16);
      const position = rhythm
        ? rhythm.schedules.indexOf(time)
        : day.indexOf(when);
      // Keep a partially elapsed day's original session positions on regeneration.
      // One-session campaigns carry their coverage turn across days/rebuilds.
      const coverageTurn =
        allocation.total === 1
          ? (assigned + phase) % 3 === 2
          : Math.floor(
              ((position + 1) * allocation.coverage) / allocation.total,
            ) > Math.floor((position * allocation.coverage) / allocation.total);
      const tie = (a: AssetSnapshot, b: AssetSnapshot) =>
        (rank.get(a.id) || 0) - (rank.get(b.id) || 0);
      const urgency = (a: AssetSnapshot, b: AssetSnapshot) =>
        count(a) - count(b) || deadline(a) - deadline(b) || tie(a, b);
      const waiting = (a: AssetSnapshot, b: AssetSnapshot) =>
        count(a) - count(b) ||
        lastAt(a) - lastAt(b) ||
        (Date.parse(a.sourceListedAt || "") || Infinity) -
          (Date.parse(b.sourceListedAt || "") || Infinity) ||
        tie(a, b);
      const near = available.filter(urgent).sort(urgency);
      const next = dates.slice(slotIndex + 1).find((date) => !blocked(date));
      const lastChance = near
        .filter(
          (item) =>
            count(item) === 0 &&
            deadline(item) < (next?.getTime() ?? when.getTime() + DAY),
        )
        .sort((a, b) => deadline(a) - deadline(b) || tie(a, b));
      const farUnseen = available.filter(
        (item) => !urgent(item) && count(item) === 0,
      );
      const unseen = available.filter((item) => count(item) === 0);
      const far = available.filter((item) => !urgent(item));
      const coverage = [
        ...(farUnseen.length
          ? farUnseen
          : unseen.length
            ? unseen
            : far.length
              ? far
              : available),
      ].sort(waiting)[0];
      if (lastChance.length) {
        asset = lastChance[0];
        reason =
          "Kesempatan terakhir sebelum batas H−5 · belum mendapat giliran";
      } else if (!coverageTurn) {
        asset =
          near[0] ||
          [...available].sort((a, b) => count(a) - count(b) || tie(a, b))[0];
        reason = near.length
          ? "Lelang terdekat · sisa 5–14 hari · giliran tayang diperhitungkan"
          : "Aset fresh · giliran tayang diperhitungkan";
      } else {
        asset = coverage || near[0];
        reason =
          "Pemerataan tayang · aset yang belum atau paling lama tidak mendapat giliran";
      }
    } else {
      for (let n = 0; n < assets.length; n++) {
        const index = (cursor + n) % assets.length;
        if (available.includes(assets[index])) {
          asset = assets[index];
          cursor = (index + 1) % assets.length;
          break;
        }
      }
      reason = "Mengikuti urutan pilihan dan jeda tayang";
    }
    if (asset) {
      last.set(asset.assetKey, when.getTime());
      uses.set(asset.assetKey, (uses.get(asset.assetKey) || 0) + 1);
      assigned++;
    }
    return {
      when,
      asset: asset || null,
      reason: asset ? reason : "CAMPAIGN_NO_ELIGIBLE_ASSET",
    };
  });
}
