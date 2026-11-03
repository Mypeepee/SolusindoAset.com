"use client";
import { useEffect, useRef, useState } from "react";
import {
  campaignAppliedBrief,
  campaignPeriodEnded,
  type CampaignRecord,
} from "@/lib/marketing/campaign";
import { jakartaDate } from "@/lib/marketing/domain";
import type { CampaignQueue } from "@/lib/marketing/campaign-queue";
import { Action, date, number } from "./ui";
import { CalendarClock, Instagram, Loader2, RefreshCw } from "./MarketingIcons";
import { CampaignSurface } from "./CampaignVisual";
import { campaignApi } from "./campaign-api";
import CampaignStockCards, { stockDate, stockTime } from "./CampaignStockCards";
import useMarketingClock from "./useMarketingClock";
import CampaignInventoryStatus from "./CampaignInventoryStatus";

/** Actual assignments from the same jobs as Planner, grouped into dated batches. */
export default function CampaignReadyAssets({
  campaign,
  disabled,
  onEdit,
  onPlanner,
  onQueueChange,
}: {
  campaign: CampaignRecord;
  disabled: boolean;
  onEdit: () => void;
  onPlanner: (when?: string) => void;
  onQueueChange: () => Promise<void>;
}) {
  const now = useMarketingClock(),
    today = jakartaDate(now);
  const ended = campaignPeriodEnded(campaignAppliedBrief(campaign), now);
  const [result, setResult] = useState<CampaignQueue | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const forced = useRef(false),
    change = useRef(onQueueChange);
  change.current = onQueueChange;
  useEffect(() => {
    if (ended) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const force = forced.current;
    forced.current = false;
    void campaignApi(
      { action: "refresh-queue", id: campaign.id, force },
      "",
      controller.signal,
    )
      .then(async (queue: CampaignQueue) => {
        if (controller.signal.aborted) return;
        setResult(queue);
        if (queue.revision !== campaign.revision) await change.current();
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const timer = window.setTimeout(() => setRefresh((n) => n + 1), 60000);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [campaign.id, campaign.revision, refresh, today, ended]);
  const data = result?.campaignId === campaign.id ? result : null;
  const slots = data?.days.flatMap((day) => day.slots) || [];
  const filled = slots.filter((slot) => slot.asset).length;
  return (
    <CampaignSurface
      className={
        ended
          ? "campaign-ended-panel"
          : "campaign-ready-assets campaign-live-queue"
      }
      tone="mint"
    >
      <div className="marketing-panel-heading">
        <div>
          <h3>
            <Instagram size={20} />
            {ended ? "Periode campaign berakhir" : "Antrean properti"}
          </h3>
          <p>
            {data?.campaignName || campaign.brief.name}
            {data?.batch
              ? ` · ${stockDate(data.batch.startDate + "T12:00:00+07:00")}–${stockDate(data.batch.endDate + "T12:00:00+07:00")}`
              : ""}
          </p>
        </div>
        <div className="campaign-actions">
          {!ended && (
            <Action
              aria-label="Perbarui antrean properti"
              disabled={disabled || loading}
              onClick={() => {
                forced.current = true;
                setRefresh((n) => n + 1);
              }}
            >
              <RefreshCw size={16} />
            </Action>
          )}
          <Action disabled={disabled} onClick={onEdit}>
            {ended ? "Ubah periode campaign" : "Edit campaign"}
          </Action>
        </div>
      </div>
      {ended ? (
        <p className="marketing-footnote">
          Tidak ada antrean aktif di luar periode campaign. Riwayat tayang tetap
          ada di Planner.
        </p>
      ) : (
        <>
          <div className="campaign-queue-summary" role="status">
            <strong>
              {data
                ? `${number(filled)} properti · ${number(slots.length)} sesi`
                : "Menyiapkan antrean dua hari…"}
            </strong>
            <span>
              {data && !data.active
                ? "Belum diterapkan ke Planner"
                : data?.batch?.nextRefreshAt
                  ? `Batch berikutnya disiapkan ${stockDate(data.batch.nextRefreshAt)}`
                  : data?.batch
                    ? "Batch terakhir dalam periode campaign"
                    : "Mengikuti periode dan jam campaign"}
            </span>
          </div>
          {loading && !data && (
            <p className="campaign-progress">
              <Loader2 size={16} className="animate-spin" />
              Mencari properti sesuai filter dan tanggal lelang…
            </p>
          )}
          {error && (
            <p className="marketing-warning" role="alert">
              {error}{" "}
              <Action
                disabled={loading}
                onClick={() => setRefresh((n) => n + 1)}
              >
                Coba kembali
              </Action>
            </p>
          )}
          {data && !data.active && (
            <p className="marketing-warning">
              {data.inventory?.eligible === 0
                ? "Campaign masih draf dan stok siap tayang kosong. Perbarui data sumber atau sesuaikan filter, lalu simpan ke Planner."
                : data.inventory
                  ? `Campaign masih draf. ${number(data.inventory.eligible)} properti memenuhi syarat. Simpan ke Planner untuk menugaskannya ke sesi.`
                  : "Campaign masih draf. Properti belum ditugaskan ke sesi Planner."}
            </p>
          )}
          {data?.inventory && (
            <CampaignInventoryStatus
              data={{
                diagnostics: data.inventory.diagnostics,
                recommendation: { target: data.inventory.upcomingSlots },
              }}
            />
          )}
          {data?.inventoryError && (
            <p className="marketing-warning" role="alert">
              Ketersediaan properti belum berhasil diperiksa. Perbarui antrean
              untuk mencoba kembali.
            </p>
          )}
          {data?.days.map((day, index) => {
            const assigned = day.slots.filter((slot) => slot.asset);
            const assets = assigned.map((slot) => slot.asset!);
            const gaps = day.slots.filter((slot) => !slot.asset);
            return (
              <section
                className="campaign-batch-day"
                key={day.date}
                data-batch-day={day.date}
                aria-label={`Gerbong ${index + 1}, ${day.date}`}
              >
                <div className="campaign-batch-heading">
                  <div>
                    <span className="campaign-batch-number">
                      <CalendarClock size={16} />
                      {index + 1}
                    </span>
                    <h4>{stockDate(day.date + "T12:00:00+07:00")}</h4>
                    <span>
                      {assets.length}/{day.slots.length} sesi terisi
                    </span>
                  </div>
                  <Action
                    disabled={disabled}
                    onClick={() => onPlanner(day.slots[0]?.scheduledFor)}
                  >
                    Buka Planner
                  </Action>
                </div>
                {!!assets.length && (
                  <CampaignStockCards
                    assets={assets}
                    loading={loading}
                    assignments={assigned.map((slot) => ({
                      assetId: slot.asset!.id,
                      when: slot.scheduledFor,
                      status: slot.status,
                    }))}
                  />
                )}
                {!!gaps.length && (
                  <div className="campaign-batch-gaps">
                    <p>
                      {!data.active
                        ? "Properti belum ditugaskan karena campaign masih draf."
                        : assets.length
                          ? `${gaps.length} sesi masih menunggu properti lain.`
                          : "Sesi belum memiliki properti. Periksa ketersediaan stok dan rincian di atas."}
                    </p>
                    <ol>
                      {gaps.map((slot) => (
                        <li key={slot.scheduledFor}>
                          <time dateTime={slot.scheduledFor}>
                            {stockTime(slot.scheduledFor)} WIB
                          </time>
                          <span>
                            {new Date(slot.scheduledFor) <= now
                              ? "Waktu lewat"
                              : data.active
                                ? "Menunggu aset"
                                : "Draf"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>
            );
          })}
          {data && (
            <p className="marketing-footnote campaign-queue-footer">
              Properti terbit tidak dipilih kembali. Prioritas lelang, bukti
              harga murah, dan batas H−5 diperiksa setiap pencarian.
              {data.checkedAt
                ? ` Diperiksa ${date(data.checkedAt, true)} WIB.`
                : ""}
            </p>
          )}
        </>
      )}
    </CampaignSurface>
  );
}
