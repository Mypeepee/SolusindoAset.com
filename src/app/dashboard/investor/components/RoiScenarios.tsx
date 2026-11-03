"use client";
import {
  formatPercent,
  formatRupiah,
  rentalPeriodLabel,
  type CmaValidationProof,
  type InvestorListing,
} from "@/lib/investor-deals";
import { calculateResaleScenario } from "@/lib/investor-roi";

export function ResaleScenario({
  title,
  pricePerSqm,
  listing,
  total,
}: {
  title: string;
  pricePerSqm?: number | null;
  listing: InvestorListing;
  total: number | null;
}) {
  const result = calculateResaleScenario(
    total,
    pricePerSqm,
    listing.landAreaSqm,
  );
  return (
    <article className="investor-roi-scenario" data-scenario={title}>
      <h4>{title}</h4>
      <p className="investor-roi-caption">
        {pricePerSqm
          ? `${formatRupiah(pricePerSqm)} / m²`
          : "Pembanding belum tersedia"}
      </p>
      <dl>
        <div>
          <dt>Estimasi harga jual</dt>
          <dd data-value="resale">
            {result ? formatRupiah(result.resalePrice) : "—"}
          </dd>
        </div>
        <div>
          <dt>Laba setelah biaya pembelian</dt>
          <dd
            data-value="profit"
            className={
              result && result.profit < 0 ? "text-rose-300" : "text-emerald-200"
            }
          >
            {result ? formatRupiah(result.profit) : "—"}
          </dd>
        </div>
        <div className="investor-roi-return">
          <dt>ROI</dt>
          <dd
            data-value="roi"
            className={
              result && result.roi < 0 ? "text-rose-300" : "text-emerald-200"
            }
          >
            {result ? `${formatPercent(result.roi)}%` : "—"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function RentalComparison({
  listing,
  proof,
}: {
  listing: InvestorListing;
  proof: CmaValidationProof | null;
}) {
  const land = listing.landAreaSqm,
    benchmark = proof?.benchmark;
  const valid = !!listing.rentalPeriod && !!land && land > 0 && !!benchmark;
  return (
    <aside className="investor-roi-financials">
      <section className="investor-roi-purchase">
        <h3>Perbandingan tarif sewa</h3>
        <p className="investor-roi-caption">
          Per {rentalPeriodLabel(listing.rentalPeriod)} ·{" "}
          {listing.propertyType.toLowerCase()}
        </p>
        <dl className="investor-roi-cost-lines">
          <div>
            <dt>Tarif aset ini</dt>
            <dd>{formatRupiah(listing.currentAuctionPrice)}</dd>
          </div>
          <div>
            <dt>Acuan rata-rata</dt>
            <dd>
              {valid ? formatRupiah(benchmark!.avgPricePerSqm * land!) : "—"}
            </dd>
          </div>
          <div>
            <dt>Acuan termurah</dt>
            <dd>
              {valid && proof?.minBaselinePricePerSqm
                ? formatRupiah(proof.minBaselinePricePerSqm * land!)
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="investor-roi-footnote">
          {valid
            ? "Pembanding memakai jenis properti dan periode sewa yang sama, berdasarkan luas tanah."
            : "Perbandingan menunggu luas tanah, periode sewa, dan benchmark terverifikasi."}{" "}
          Analisis sewa tidak memuat biaya pembelian atau simulasi jual kembali.
        </p>
      </section>
    </aside>
  );
}
