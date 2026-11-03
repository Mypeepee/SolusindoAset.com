"use client";
import { useEffect, useRef, useState } from "react";
import {
  campaignCriteria,
  campaignInventorySchema,
  campaignPeriodEnded,
  type CampaignBrief,
  type CampaignInventory,
} from "@/lib/marketing/campaign";
import { campaignAllocationLabel } from "@/lib/marketing/campaign-selection";
import { Action, number } from "./ui";
import { Layers, Loader2, RefreshCw } from "./MarketingIcons";
import CampaignInventoryStatus from "./CampaignInventoryStatus";
import CampaignStockCards from "./CampaignStockCards";
import { CampaignSectionHeading } from "./CampaignVisual";
import { campaignApi } from "./campaign-api";
import useMarketingClock from "./useMarketingClock";

/** Filters are the only asset input. Inventory and the saved draft share one recommendation. */
export default function CampaignAssets({
  brief,
  disabled,
  onChange,
  onValidChange,
  campaignId,
}: {
  brief: CampaignBrief;
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onValidChange?: (valid: boolean) => void;
  campaignId?: string;
}) {
  const now = useMarketingClock();
  const ended = campaignPeriodEnded(brief, now);
  const [result, setResult] = useState<{
    scope: string;
    inventory: CampaignInventory;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const change = useRef(onChange);
  const selection = useRef(brief.listingIds);
  change.current = onChange;
  selection.current = brief.listingIds;
  const scope = JSON.stringify({
    criteria: campaignCriteria(brief),
    startDate: brief.startDate,
    endDate: brief.endDate,
    schedules: brief.schedules,
    campaignId,
    listingIds: [],
    query: "",
    offset: 0,
  });
  const valid = campaignInventorySchema.safeParse(JSON.parse(scope)).success;
  useEffect(() => {
    setResult(null);
    setError("");
    if (!valid || ended) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      void campaignApi(
        { action: "inventory", inventory: JSON.parse(scope) },
        "",
        controller.signal,
      )
        .then((result: CampaignInventory) => {
          if (controller.signal.aborted) return;
          setResult({ scope, inventory: result });
          const assets = result.recommendation?.assets ?? result.items;
          const ids = assets.map((asset) => asset.id);
          if (JSON.stringify(ids) !== JSON.stringify(selection.current))
            change.current(ids);
        })
        .catch((failure: Error) => {
          if (!controller.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [scope, retry, valid, ended]);
  const data = result?.scope === scope ? result.inventory : null;
  const assets = data?.recommendation?.assets ?? data?.items ?? [];
  const idsMatch =
    JSON.stringify(assets.map((asset) => asset.id)) ===
    JSON.stringify(brief.listingIds);
  const ready =
    !ended &&
    valid &&
    !loading &&
    !error &&
    !!data &&
    assets.length > 0 &&
    idsMatch;
  useEffect(() => onValidChange?.(ready), [ready, onValidChange]);
  return (
    <section
      className="campaign-assets campaign-auto-assets"
      aria-label="Aset otomatis dari filter"
      aria-busy={loading}
    >
      <div className="campaign-auto-heading">
        <CampaignSectionHeading
          icon={<Layers size={19} />}
          title="Aset mengikuti filter"
        >
          Minimal H−5. {campaignAllocationLabel(brief.schedules.length)}
        </CampaignSectionHeading>
        <Action
          aria-label="Periksa ketersediaan aset"
          disabled={disabled || loading || ended || !valid}
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={16} />
        </Action>
      </div>
      {ended ? (
        <p className="marketing-footnote">
          Periode sudah berakhir. Ubah tanggal untuk memeriksa aset bagi jadwal
          baru.
        </p>
      ) : !valid ? (
        <p className="marketing-footnote">
          Lengkapi tanggal, filter, dan jam yang valid untuk memeriksa aset.
        </p>
      ) : loading ? (
        <p className="campaign-progress" role="status">
          <Loader2 size={16} className="animate-spin" /> Memeriksa aset sesuai
          filter…
        </p>
      ) : error ? (
        <p className="marketing-error" role="alert">
          {error}{" "}
          <Action onClick={() => setRetry((n) => n + 1)}>Coba kembali</Action>
        </p>
      ) : (
        data && (
          <>
            <div className="campaign-auto-summary" role="status">
              <strong>{number(assets.length)} aset dipilih otomatis</strong>
              {data.recommendation && (
                <span>
                  {number(data.recommendation.filled)} dari{" "}
                  {number(data.recommendation.target)} slot dapat diisi
                </span>
              )}
            </div>
            {!!data.recommendation?.coverage?.remaining && (
              <p className="marketing-footnote">
                {number(data.recommendation.coverage.remaining)} properti lain
                sesuai filter belum mendapat slot. Tambah intensitas atau
                periode untuk memperluas cakupan.
              </p>
            )}
            {assets.length ? (
              <>
                <CampaignStockCards assets={assets.slice(0, 6)} />
                <p className="marketing-footnote">
                  {assets.length > 6
                    ? `Menampilkan 6 contoh dari ${number(assets.length)} aset. `
                    : ""}
                  Lelang dekat didahulukan tanpa meninggalkan aset lain. Riwayat
                  tayang, batas H−5, jeda pengulangan, dan benturan diperiksa
                  pada setiap slot.
                </p>
              </>
            ) : (
              <p className="marketing-footnote">
                Belum ada aset layak untuk jadwal ini. Periksa periode dan
                filter, atau perbarui sumber lelang jika datanya sudah lewat.
              </p>
            )}
            <details className="campaign-history-disclosure">
              <summary>Rincian ketersediaan aset</summary>
              <CampaignInventoryStatus data={data} />
            </details>
          </>
        )
      )}
    </section>
  );
}
