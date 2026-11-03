import { ArrowDown, ArrowUpRight, Bookmark, Calculator } from "lucide-react";
import {
  formatCompactRupiah,
  formatPercent,
  rentalPeriodLabel,
  type DealSort,
  type DealViewItem,
} from "@/lib/investor-deals";
import type { DealActions } from "./PropertyDealCard";
import CmaProofTrigger from "./CmaProofTrigger";
import LocationStatus from "./LocationStatus";
export default function DealTable({
  deals,
  sort,
  onSort,
  savedIds,
  ...actions
}: {
  deals: DealViewItem[];
  sort: DealSort;
  onSort: (value: DealSort) => void;
  savedIds: string[];
} & DealActions) {
  const rent = deals[0]?.listing.transactionType === "SEWA";
  const columns: { label: string; key: DealSort }[] = [
    { label: "Harga/m² tanah", key: "price" },
    { label: rent ? "Spread tarif" : "Market spread", key: "spread" },
    ...(!rent ? [{ label: "Auction drop", key: "drop" as const }] : []),
    { label: "Poin", key: "score" },
  ];
  return (
    <div className="investor-panel min-h-[550px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="investor-table w-full text-left text-xs">
          <caption className="sr-only">
            Listing investasi. Seluruh perbandingan per meter menggunakan luas
            tanah.
          </caption>
          <thead>
            <tr>
              <th scope="col">Properti</th>
              <th scope="col">Luas tanah</th>
              <th scope="col">{rent ? "Tarif" : "Harga aktif"}</th>
              {columns.map((c) => (
                <th
                  scope="col"
                  key={c.key}
                  aria-sort={
                    sort === c.key
                      ? c.key === "price"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="flex items-center gap-1.5 hover:text-emerald-200"
                    onClick={() => onSort(c.key)}
                  >
                    {c.label}
                    {sort === c.key && (
                      <ArrowDown
                        size={12}
                        className={c.key === "price" ? "rotate-180" : ""}
                      />
                    )}
                  </button>
                </th>
              ))}
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(({ listing, metrics }) => (
              <tr key={listing.id}>
                <th scope="row" className="min-w-[240px]">
                  <button
                    type="button"
                    className="text-left font-medium text-white hover:text-emerald-200"
                    onClick={() => actions.onView(listing)}
                  >
                    {listing.title}
                    <span className="mt-1 block text-[10px] font-normal text-slate-400">
                      {listing.kelurahanName ||
                        listing.districtName ||
                        "Lokasi belum terverifikasi"}{" "}
                      · {listing.listingCategory || "Sewa"}
                    </span>
                  </button>
                  <div className="mt-2">
                    <LocationStatus
                      listing={listing}
                      onCorrect={
                        actions.onCorrectLocation
                          ? () => actions.onCorrectLocation!(listing)
                          : undefined
                      }
                    />
                  </div>
                </th>
                <td className="whitespace-nowrap">
                  {listing.landAreaSqm === null
                    ? "—"
                    : `${listing.landAreaSqm.toLocaleString("id-ID")} m²`}
                </td>
                <td className="whitespace-nowrap text-white">
                  {formatCompactRupiah(listing.currentAuctionPrice)}
                  {rent && (
                    <span className="mt-1 block text-[10px] text-slate-400">
                      / {rentalPeriodLabel(listing.rentalPeriod)}
                    </span>
                  )}
                  {listing.listingCategory === "LELANG" &&
                    listing.initialAuctionPrice !== null && (
                      <del className="mt-1 block text-[10px] text-slate-500">
                        {formatCompactRupiah(listing.initialAuctionPrice)}
                      </del>
                    )}
                </td>
                <td className="whitespace-nowrap">
                  {metrics.pricePerSqm === null
                    ? "—"
                    : formatCompactRupiah(metrics.pricePerSqm)}
                </td>
                <td>
                  <CmaProofTrigger
                    onOpen={() => actions.onAnalyze(listing)}
                    label={`Validasi Market Spread ${listing.title}`}
                    className={
                      metrics.marketSpread !== null && metrics.marketSpread < 0
                        ? "text-rose-300"
                        : "text-emerald-200"
                    }
                  >
                    {metrics.marketSpread === null
                      ? "—"
                      : `${formatPercent(metrics.marketSpread)}%`}
                  </CmaProofTrigger>
                </td>
                {!rent && (
                  <td className="text-amber-200">
                    {metrics.auctionDrop === null
                      ? "—"
                      : `${formatPercent(metrics.auctionDrop)}%`}
                  </td>
                )}
                <td className="font-semibold text-emerald-200">
                  {metrics.primaryScore === null
                    ? "—"
                    : `${formatPercent(metrics.primaryScore)} poin`}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="investor-icon-button"
                      aria-label={`Analisis ${listing.title}`}
                      onClick={() => actions.onAnalyze(listing)}
                    >
                      <Calculator size={15} />
                    </button>
                    <button
                      type="button"
                      className="investor-icon-button"
                      aria-label={`Lihat listing ${listing.title}`}
                      onClick={() => actions.onView(listing)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="investor-icon-button"
                      aria-label={`Bookmark ${listing.title}`}
                      aria-pressed={savedIds.includes(listing.id)}
                      onClick={() => actions.onBookmark(listing.id)}
                    >
                      <Bookmark
                        size={15}
                        fill={
                          savedIds.includes(listing.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
