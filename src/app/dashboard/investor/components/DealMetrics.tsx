import CmaProofTrigger from "./CmaProofTrigger";
import { investorDiscountTone } from "@/lib/investor-presentation";
import {
  ArrowDownRight,
  BadgePercent,
  History,
  TrendingDown,
} from "lucide-react";
import {
  formatCompactRupiah,
  formatPercent,
  type DealMetrics as Metrics,
} from "@/lib/investor-deals";

/** One quiet comparison strip; savings intensity is shared by both drivers. */
export function CompactDealMetrics({
  metrics,
  auctionEnabled,
  onValidate,
}: {
  metrics: Metrics;
  auctionEnabled: boolean;
  onValidate: () => void;
}) {
  const market = metrics.marketSpread;
  const auction = metrics.auctionDrop;
  const scope = "kelurahan";
  const marketLabel =
    market !== null && market < 0
      ? `Di atas ${scope}`
      : market === 0
        ? `Setara ${scope}`
        : `Diskon ${scope}`;
  const auctionLabel =
    auction !== null && auction < 0
      ? "Naik lelang"
      : auction === 0
        ? "Lelang tetap"
        : "Turun lelang";
  const percentage = (value: number | null) =>
    value === null ? "—" : `${formatPercent(Math.abs(value))}%`;
  return (
    <div
      className={`investor-card-metrics ${auctionEnabled ? "has-auction" : ""}`}
    >
      <CmaProofTrigger
        onOpen={onValidate}
        label={`Validasi data Market Spread: ${marketLabel}, ${market === null ? "pembanding belum tersedia" : `${percentage(market)}${market > 50 ? ", diskon sangat besar" : ""}`}`}
        className={`investor-card-metric investor-card-market discount-${investorDiscountTone(market)}`}
      >
        <span className="investor-card-metric-label">
          <BadgePercent size={13} aria-hidden="true" />
          {marketLabel}
        </span>
        <strong>{percentage(market)}</strong>
      </CmaProofTrigger>
      {auctionEnabled && (
        <div
          className={`investor-card-metric investor-card-auction discount-${investorDiscountTone(auction)}`}
        >
          <span className="investor-card-metric-label">
            <History size={13} aria-hidden="true" />
            {auctionLabel}
          </span>
          <strong>{percentage(auction)}</strong>
          <span className="sr-only">
            {auction === null
              ? "Riwayat belum tersedia"
              : auction > 50
                ? "Diskon sangat besar"
                : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export function MetricBadges({
  metrics,
  onValidate,
  auctionEnabled = true,
}: {
  metrics: Metrics;
  onValidate?: () => void;
  auctionEnabled?: boolean;
}) {
  const scope = "kelurahan";
  const marketContent = (
    <>
      {" "}
      <span className="flex items-center gap-1.5 text-[11px] font-medium">
        <ArrowDownRight size={13} aria-hidden="true" /> Market spread
      </span>
      <strong className="mt-1 block text-[23px] leading-tight tracking-tight">
        {metrics.marketSpread === null
          ? "—"
          : `${formatPercent(Math.abs(metrics.marketSpread))}%`}
      </strong>
      <span className="mt-1 block text-[10px] leading-4">
        {metrics.marketSpread === null
          ? "Benchmark belum tersedia"
          : metrics.marketSpread >= 0
            ? `di bawah baseline ${scope}`
            : `di atas baseline ${scope}`}
      </span>
    </>
  );
  const marketClass = `text-left investor-metric investor-metric-market ${metrics.marketSpread !== null && metrics.marketSpread < 0 ? "investor-metric-above" : ""}`;
  return (
    <div
      className={`grid gap-2 ${auctionEnabled ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {onValidate ? (
        <CmaProofTrigger
          onOpen={onValidate}
          label="Validasi data Market Spread"
          className={marketClass}
        >
          {marketContent}
        </CmaProofTrigger>
      ) : (
        <div className={marketClass}>{marketContent}</div>
      )}
      {auctionEnabled && (
        <div className="investor-metric investor-metric-auction">
          <span className="flex items-center gap-1.5 text-[11px] font-medium">
            <TrendingDown size={13} aria-hidden="true" /> Auction drop
          </span>
          <strong className="mt-1 block text-[23px] leading-tight tracking-tight">
            {metrics.auctionDrop === null
              ? "—"
              : `${formatPercent(Math.abs(metrics.auctionDrop))}%`}
          </strong>
          <span className="mt-1 block text-[10px] leading-4">
            {metrics.auctionDrop === null
              ? "Riwayat pembanding belum tersedia"
              : metrics.auctionDrop === 0
                ? "sama dengan lelang awal tercatat"
                : metrics.auctionDrop > 0
                  ? "turun dari lelang awal tercatat"
                  : "naik dari lelang awal tercatat"}
          </span>
        </div>
      )}
    </div>
  );
}

export function MarketGauge({ metrics }: { metrics: Metrics }) {
  if (!metrics.benchmark || metrics.pricePerSqm === null) {
    return (
      <p className="min-h-[57px] text-xs text-slate-400">
        Perbandingan harga/m² belum tersedia.
      </p>
    );
  }
  const ratio = metrics.pricePerSqm / metrics.benchmark.avgPricePerSqm;
  return (
    <div className="min-h-[57px]">
      <div className="mb-2 flex justify-between gap-2 text-[10px] text-slate-400">
        <span>
          Harga/m²{" "}
          <strong className="font-medium text-slate-200">
            {formatCompactRupiah(metrics.pricePerSqm)}
          </strong>
        </span>
        <span>
          CMA{" "}
          <strong className="font-medium text-slate-200">
            {formatCompactRupiah(metrics.benchmark.avgPricePerSqm)}
          </strong>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Harga listing dibanding rata-rata baseline lelang"
        aria-valuemin={0}
        aria-valuemax={Math.max(100, Math.ceil(ratio * 100))}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuetext={`${formatPercent(ratio * 100)}% dari rata-rata baseline CMA`}
        className="investor-gauge"
      >
        <span
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
          className={ratio > 1 ? "investor-gauge-above" : ""}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Basis luas tanah · {metrics.benchmark.kelurahanName} ·{" "}
        {metrics.benchmark.sampleCount} sampel
        {metrics.benchmark.sampleCount < 3 ? " · terbatas" : ""}
      </p>
    </div>
  );
}
