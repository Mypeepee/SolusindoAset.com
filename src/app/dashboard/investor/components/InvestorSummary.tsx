import { BadgePercent, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardKpiIcon } from "@/components/dashboard/DashboardKpiSurface";
import {
  formatPercent,
  type InvestorFeed,
  type InvestorListing,
} from "@/lib/investor-deals";
import { useMemo } from "react";
import QuickSuggestionCarousel from "./QuickSuggestionCarousel";

export default function InvestorSummary({
  data,
  onView,
  unavailable = false,
  isRent = false,
  paused = false,
}: {
  data: InvestorFeed | null;
  onView: (listing: InvestorListing) => void;
  unavailable?: boolean;
  isRent?: boolean;
  paused?: boolean;
}) {
  const summary = data?.summary;
  const suggestions = useMemo(() => {
    if (!summary?.topDeal) return [];
    const seen = new Set<string>();
    return [summary.topDeal, ...(summary.suggestedDeals || [])]
      .filter((listing) => {
        const identity = listing.assetCode || listing.id;
        if (
          seen.has(identity) ||
          (listing.transactionType === "SEWA") !== isRent
        )
          return false;
        seen.add(identity);
        return true;
      })
      .slice(0, 5);
  }, [summary, isRent]);
  const spread = summary?.avgMarketSpread;
  const ratio = summary?.activeListings
    ? Math.min(
        100,
        Math.max(0, (summary.worthItCount / summary.activeListings) * 100),
      )
    : 0;
  const pending = unavailable ? "Data belum dapat dimuat" : "Memuat data…";
  const SpreadIcon = spread != null && spread < 0 ? TrendingUp : TrendingDown;
  return (
    <section aria-label="Ringkasan pasar wilayah" className="investor-summary">
      <article
        className="investor-summary-card investor-summary-stat"
        data-dashboard-accent="emerald"
      >
        <div className="investor-summary-label">
          <DashboardKpiIcon accent="emerald" className="investor-summary-icon">
            <BadgePercent size={21} />
          </DashboardKpiIcon>
          <h2>{isRent ? "Worth-it sewa" : "Worth-it deals"}</h2>
        </div>
        <div className="investor-summary-number">
          <strong className="investor-summary-value investor-total-deals">
            {summary?.worthItCount.toLocaleString("id-ID") ?? "—"}
          </strong>
          <p className="investor-summary-caption">
            {summary ? (
              <>
                dari{" "}
                <span className="investor-total-assets">
                  {summary.activeListings.toLocaleString("id-ID")}
                </span>{" "}
                aset
              </>
            ) : (
              pending
            )}
          </p>
        </div>
        <div className="investor-summary-bottom">
          <div
            className="investor-ratio"
            role={summary && summary.activeListings > 0 ? "meter" : undefined}
            aria-hidden={
              !summary || summary.activeListings === 0 ? true : undefined
            }
            aria-label={
              summary && summary.activeListings > 0
                ? "Porsi aset worth-it"
                : undefined
            }
            aria-valuemin={
              summary && summary.activeListings > 0 ? 0 : undefined
            }
            aria-valuemax={
              summary && summary.activeListings > 0 ? 100 : undefined
            }
            aria-valuenow={
              summary && summary.activeListings > 0 ? ratio : undefined
            }
            aria-valuetext={
              summary && summary.activeListings > 0
                ? `${summary.worthItCount.toLocaleString("id-ID")} dari ${summary.activeListings.toLocaleString("id-ID")} aset`
                : undefined
            }
          >
            <span style={{ width: `${ratio}%` }} />
          </div>
          <p className="investor-summary-footnote">
            {summary
              ? summary.activeListings > 0
                ? `${formatPercent(ratio)}% memenuhi kriteria`
                : "Belum ada aset aktif"
              : "Sesuai kriteria diskon"}
          </p>
        </div>
      </article>
      <article
        className={`investor-summary-card investor-summary-stat ${spread != null && spread < 0 ? "is-negative" : ""}`}
        data-dashboard-accent="sky"
      >
        <div className="investor-summary-label">
          <DashboardKpiIcon accent="sky" className="investor-summary-icon">
            <SpreadIcon size={21} />
          </DashboardKpiIcon>
          <h2>{isRent ? "Selisih tarif sewa" : "Rata-rata spread"}</h2>
        </div>
        <div className="investor-summary-number">
          <strong className="investor-summary-value investor-average-spread">
            {spread == null ? "—" : `${formatPercent(spread)}%`}
          </strong>
          <p className="investor-summary-caption">
            {summary
              ? spread == null
                ? "Pembanding belum tersedia"
                : spread < 0
                  ? "Di atas pembanding lokal"
                  : spread === 0
                    ? "Setara pembanding lokal"
                    : "Di bawah pembanding lokal"
              : pending}
          </p>
        </div>
        <p className="investor-summary-bottom investor-summary-footnote">
          {summary
            ? `${summary.benchmarkCoverage.toLocaleString("id-ID")} aset dibandingkan`
            : "Berbasis luas tanah"}
        </p>
      </article>
      <QuickSuggestionCarousel
        listings={suggestions}
        onView={onView}
        paused={paused}
        emptyMessage={
          data ? "Belum ada aset yang memenuhi kriteria diskon." : pending
        }
      />
    </section>
  );
}
