import "server-only";
import { withInvestorRead } from "@/lib/investor-read.server";
import { getMarketingInvestorCandidates } from "@/lib/investor-cma-legacy.server";
import { formatAuctionDate, formatRupiah, type InvestorListing } from "@/lib/investor-deals";
import { isMailConfigured, sendInvestorOwnerEmail, type InvestorOwnerEmailOpts } from "@/lib/mailer";
import { siapkanFotoInline, type FotoInline } from "@/lib/fotoListing";
import { URL_PUBLIK } from "@/lib/site";
import { investorAlertStore, type AlertClaim } from "./investor-owner-alert-store.server";
import {
  INVESTOR_ALERT_BATCH_SIZE,
  INVESTOR_ALERT_THRESHOLD,
  OWNER_ALERT_FILTERS,
  ownerAlertAssetKey,
  ownerAlertDropLabel,
  qualifiesForOwnerAlert,
} from "./investor-owner-alerts";

export function ownerAlertEmailOptions(
  ownerName: string,
  items: readonly InvestorListing[],
  photos: Map<string, FotoInline>,
): InvestorOwnerEmailOpts {
  return {
    ownerName,
    investorUrl: `${URL_PUBLIK}/dashboard/investor?data=all&category=LELANG&sort=drop`,
    lampiran: [...photos.values()],
    aset: items.map((item) => ({
      judul: item.title,
      url: new URL(item.listingUrl, URL_PUBLIK).href,
      gambar: photos.has(item.id) ? `cid:${photos.get(item.id)!.cid}` : `${URL_PUBLIK}/api/foto/${encodeURIComponent(item.id)}`,
      hargaTampil: formatRupiah(item.currentAuctionPrice),
      hargaSebelumnya: `Limit awal: ${formatRupiah(item.initialAuctionPrice!)}`,
      frasaTurun: `Turun lelang ${ownerAlertDropLabel(item.metricAuctionDropPct!)}`,
      lokasi: [item.address, item.kelurahanName, item.districtName, item.cityName].filter(Boolean).join(", "),
      spesifikasi: [item.landAreaSqm === null ? null : `Tanah ${item.landAreaSqm.toLocaleString("id-ID")} m²`, `Lelang ${formatAuctionDate(item.auctionDate)}`].filter(Boolean).join(" · "),
      badge: `LELANG · ${item.propertyType.replaceAll("_", " ")}`,
    })),
  };
}

const dependencies = {
  store: investorAlertStore,
  configured: isMailConfigured,
  candidates: (excluded: Set<string>, now: Date, fresh: boolean) => withInvestorRead((tx) =>
    getMarketingInvestorCandidates(tx, OWNER_ALERT_FILTERS, excluded, 0, INVESTOR_ALERT_BATCH_SIZE,
      (item) => qualifiesForOwnerAlert(item, now), fresh)),
  photos: (items: readonly InvestorListing[]) => siapkanFotoInline(
    items.map((item) => ({ id_property: item.id, gambar: item.imageUrl || null })), INVESTOR_ALERT_BATCH_SIZE),
  send: sendInvestorOwnerEmail,
};

/** Production invokes this through the secret-protected cron; previews never claim or send. */
export async function runInvestorOwnerAlerts(
  { dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {},
  deps = dependencies,
) {
  const result = { ready: await deps.store.ready(), configured: deps.configured(), dryRun,
    threshold: INVESTOR_ALERT_THRESHOLD, owners: 0, matches: 0, emailsSent: 0, assetsSent: 0,
    skipped: 0, retry: 0, uncertain: 0, failed: 0 };
  if (!result.ready || (!result.configured && !dryRun)) return result;
  const owners = await deps.store.owners();
  result.owners = owners.length;
  let fresh = true;
  for (const owner of owners) {
    let claim: AlertClaim | null = null;
    let startedSending = false;
    try {
      const candidates = await deps.candidates(await deps.store.excluded(owner.id), now, fresh);
      fresh = false;
      result.matches = Math.max(result.matches, candidates.total);
      // Recheck even injected/shared candidate readers at the dispatch boundary.
      const seen = new Set<string>();
      const items = candidates.items.filter((item) => {
        const key = ownerAlertAssetKey(item);
        if (!qualifiesForOwnerAlert(item, now) || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, INVESTOR_ALERT_BATCH_SIZE);
      if (dryRun || !items.length) continue;
      claim = await deps.store.claim(owner, items, now);
      if (!claim) { result.skipped++; continue; }
      const selected = items.filter((item) => claim!.keys.includes(ownerAlertAssetKey(item)));
      const photos = await deps.photos(selected);
      // Revalidate the recipient's current role/email and the actual source after slow photo fetches.
      if (!await deps.store.current(owner, selected, new Date())) {
        await deps.store.release(claim, "SOURCE_OR_RECIPIENT_CHANGED", new Date());
        result.skipped++;
        continue;
      }
      const email = ownerAlertEmailOptions(owner.name, selected, photos);
      if (!await deps.store.begin(claim, new Date())) { result.skipped++; continue; }
      startedSending = true;
      const delivery = await deps.send(owner.email, email, claim.deliveryId);
      const state = delivery.state === "unconfigured" ? "retry" : delivery.state;
      await deps.store.finish(claim, { ...delivery, state }, new Date());
      if (state === "sent") {
        result.emailsSent++;
        result.assetsSent += selected.length;
      } else result[state]++;
    } catch (error) {
      // Once SMTP starts, a lost response/DB connection must never trigger blind delivery again.
      if (claim && !startedSending)
        await deps.store.release(claim, "PREPARATION_FAILED", new Date()).catch(() => {});
      if (startedSending) result.uncertain++;
      else result.failed++;
      console.error("[investor-owner-alerts]", error instanceof Error ? error.name : "ALERT_FAILED");
    }
  }
  return result;
}
