"use client";

import LocationStatus from "./LocationStatus";
import ListingImage from "./ListingImage";
import CmaValidationPanel from "./CmaValidationPanel";
import { ArrowUpRight, Calculator, MapPin } from "lucide-react";
import { DialogFrame } from "@/components/ui/dialog";
import {
  formatAuctionDate,
  formatRupiah,
  auctionScheduleLabel,
  type DealMetrics as Metrics,
  type InvestorListing,
  rentalPeriodLabel,
} from "@/lib/investor-deals";
import { MarketGauge, MetricBadges } from "./DealMetrics";

export type DealDialogState = {
  kind: "roi" | "listing";
  listing: InvestorListing;
};

function ListingDetails({
  listing,
  metrics,
  onAnalyze,
  onCorrectLocation,
}: {
  listing: InvestorListing;
  metrics: Metrics;
  onAnalyze: () => void;
  onCorrectLocation?: () => void;
}) {
  return (
    <>
      <div className="relative aspect-[2/1] shrink-0 overflow-hidden rounded-t-3xl">
        <ListingImage
          src={listing.imageUrl}
          alt={`Foto ${listing.title}`}
          sizes="600px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1018] to-transparent" />
        <span className="absolute bottom-4 left-5 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white">
          Listing dari database
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="text-[11px] text-emerald-200">
            {listing.id} · {listing.propertyType} ·{" "}
            {listing.transactionType === "SEWA"
              ? "SEWA"
              : listing.listingCategory}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {listing.title}
          </h2>
          <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-400">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {listing.address}, {listing.cityName}, {listing.provinceName}
          </p>
        </div>
        <MetricBadges
          metrics={metrics}
          auctionEnabled={
            listing.transactionType !== "SEWA" &&
            (!listing.listingCategory || listing.listingCategory === "LELANG")
          }
          onValidate={onAnalyze}
        />
        <LocationStatus listing={listing} onCorrect={onCorrectLocation} />
        <MarketGauge metrics={metrics} />
        <dl className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-slate-400">Harga saat ini</dt>
            <dd className="mt-1 text-lg text-white">
              {formatRupiah(listing.currentAuctionPrice)}
              {listing.transactionType === "SEWA" &&
                ` / ${rentalPeriodLabel(listing.rentalPeriod)}`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Luas tanah</dt>
            <dd className="mt-1 text-lg text-white">
              {listing.landAreaSqm ?? "—"} m²
            </dd>
          </div>
          {listing.listingCategory === "LELANG" &&
            listing.transactionType !== "SEWA" && (
              <div>
                <dt className="text-slate-400">Jadwal tercatat</dt>
                <dd className="mt-1 text-slate-200">
                  {formatAuctionDate(listing.auctionDate)}
                </dd>
              </div>
            )}
          {listing.listingCategory === "LELANG" &&
            listing.transactionType !== "SEWA" && (
              <div>
                <dt className="text-slate-400">Status jadwal</dt>
                <dd className="mt-1 text-slate-200">
                  {auctionScheduleLabel(listing)}
                </dd>
              </div>
            )}
        </dl>
        {listing.listingCategory === "LELANG" &&
          listing.transactionType !== "SEWA" && (
            <section className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-medium text-white">
                Riwayat harga lelang
              </h3>
              <ol className="mt-3 space-y-3">
                {[
                  ...listing.auctionHistory,
                  {
                    round: listing.auctionRound,
                    date: listing.auctionDate,
                    limitPrice: listing.currentAuctionPrice,
                  },
                ]
                  .sort((a, b) => a.round - b.round)
                  .map((event) => (
                    <li
                      key={event.round}
                      className="flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="text-slate-400">
                        Putaran {event.round}
                        <span className="mt-1 block text-[10px]">
                          {formatAuctionDate(event.date)}
                        </span>
                      </span>
                      <strong
                        className={
                          event.round === listing.auctionRound
                            ? "font-medium text-emerald-200"
                            : "font-normal text-slate-300"
                        }
                      >
                        {formatRupiah(event.limitPrice)}
                      </strong>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        {metrics.benchmark && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-5 text-slate-400">
            CMA memakai {metrics.benchmark.sampleCount} aset aktif unik dengan
            jenis yang sama di {metrics.benchmark.kelurahanName}.{" "}
            {listing.transactionType === "SEWA"
              ? "Tarif sewa dibandingkan pada periode yang sama."
              : "Baseline lelang memakai harga pertama tercatat; Primary dan Secondary memakai harga penawaran aktif."}{" "}
            Seluruh harga/m² memakai luas tanah. Lihat sampel sumber dan cakupan
            wilayah melalui Analisis ROI.
          </p>
        )}
        <button
          type="button"
          className="investor-primary w-full"
          onClick={onAnalyze}
        >
          <Calculator size={16} />
          {listing.transactionType === "SEWA"
            ? "Analisis sewa"
            : "Analisis ROI"}
          <ArrowUpRight size={15} />
        </button>
        <a
          className="investor-button w-full text-xs"
          href={listing.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buka listing asli
          <ArrowUpRight size={15} />
        </a>
      </div>
    </>
  );
}

export default function DealDialogs({
  state,
  metrics,
  onClose,
  onAnalyze,
  onRefresh,
  onCorrectLocation,
}: {
  state: DealDialogState | null;
  metrics: Metrics | null;
  onClose: () => void;
  onAnalyze: (listing: InvestorListing) => void;
  onRefresh: () => void;
  onCorrectLocation?: (listing: InvestorListing) => void;
}) {
  return (
    <DialogFrame
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        state?.kind === "roi"
          ? state.listing.transactionType === "SEWA"
            ? "Validasi CMA Sewa"
            : "Validasi CMA dan Analisis ROI"
          : "Detail listing"
      }
      description="Perbandingan aset sejenis berdasarkan luas tanah dan data listing aktif."
      contentClassName={`investor-surface investor-dialog ${state?.kind === "roi" ? "investor-roi-dialog" : ""}`}
      overlayClassName="investor-dialog-overlay"
      closeClassName="investor-dialog-close"
      focusFallbackId="investor-heading"
    >
      {state &&
        metrics &&
        (state.kind === "roi" ? (
          <CmaValidationPanel
            key={state.listing.id}
            listing={state.listing}
            onRefresh={onRefresh}
            onCorrectLocation={onCorrectLocation}
          />
        ) : (
          <ListingDetails
            listing={state.listing}
            metrics={metrics}
            onAnalyze={() => onAnalyze(state.listing)}
            onCorrectLocation={
              onCorrectLocation
                ? () => onCorrectLocation(state.listing)
                : undefined
            }
          />
        ))}
    </DialogFrame>
  );
}
