"use client";

import { ArrowUpRight } from "lucide-react";
import {
  formatAuctionDate,
  formatRupiah,
  rentalPeriodLabel,
  type CmaValidationProof,
} from "@/lib/investor-deals";
import ListingImage from "./ListingImage";

export default function CmaEvidenceTable({
  proof,
}: {
  proof: CmaValidationProof;
}) {
  const { listing, benchmark } = proof;
  const rent = listing.transactionType === "SEWA";
  const targetSqm =
    listing.landAreaSqm && listing.landAreaSqm > 0
      ? listing.currentAuctionPrice / listing.landAreaSqm
      : null;
  const rows = [
    {
      id: listing.id,
      target: true,
      location: listing.address || listing.title,
      imageUrl: listing.imageUrl,
      listingUrl: listing.listingUrl,
      price: listing.currentAuctionPrice,
      land: listing.landAreaSqm,
      sqm: targetSqm,
      category: listing.listingCategory,
    },
    ...proof.samples
      .filter(
        (peer) =>
          peer.id !== listing.id && peer.assetCode !== listing.assetCode,
      )
      .sort(
        (a, b) =>
          b.baselinePricePerSqm - a.baselinePricePerSqm ||
          a.assetCode.localeCompare(b.assetCode),
      )
      .slice(0, 9)
      .map((peer) => ({
        id: peer.id,
        target: false,
        location: peer.locationSummary,
        imageUrl: peer.imageUrl || "",
        listingUrl: peer.listingUrl,
        price: peer.initialAuctionPrice,
        land: peer.landAreaSqm,
        sqm: peer.baselinePricePerSqm,
        category: peer.listingCategory,
      })),
  ].sort(
    (a, b) =>
      (b.sqm ?? -Infinity) - (a.sqm ?? -Infinity) ||
      Number(b.target) - Number(a.target) ||
      a.id.localeCompare(b.id),
  );
  const scope = `Kelurahan ${listing.kelurahanName || "belum terverifikasi"}`;
  return (
    <section aria-labelledby="investor-proof-title">
      <div className="investor-roi-section-heading">
        <h3 id="investor-proof-title">Pembanding {scope}</h3>
        <span className="investor-roi-caption">
          {benchmark?.sampleCount ?? 0} sampel valid
        </span>
      </div>
      {benchmark && benchmark.sampleCount < 3 && (
        <p className="investor-roi-notice">
          Sampel terbatas · {benchmark.sampleCount} pembanding di kelurahan yang
          sama. Benchmark tetap memakai kelurahan ini.
        </p>
      )}
      <div className="investor-cma-stats">
        <div>
          <span>
            Rata-rata / m²
            {rent ? ` / ${rentalPeriodLabel(listing.rentalPeriod)}` : ""}
          </span>
          <strong>
            {benchmark ? formatRupiah(benchmark.avgPricePerSqm) : "—"}
          </strong>
        </div>
        <div>
          <span>
            Termurah / m²
            {rent ? ` / ${rentalPeriodLabel(listing.rentalPeriod)}` : ""}
          </span>
          <strong>
            {proof.minBaselinePricePerSqm
              ? formatRupiah(proof.minBaselinePricePerSqm)
              : "—"}
          </strong>
        </div>
      </div>
      <div
        className="investor-cma-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tabel pembanding CMA, geser horizontal untuk seluruh kolom"
      >
        <table className="investor-table investor-proof-table w-full text-left">
          <caption className="sr-only">
            Aset ini dan hingga sembilan pembanding dengan harga per meter
            tertinggi, diurutkan dari harga per meter termahal. Rata-rata dan
            minimum memakai seluruh pembanding valid tanpa aset ini.
          </caption>
          <thead>
            <tr>
              <th scope="col">Foto</th>
              <th scope="col">Lokasi</th>
              <th scope="col">{rent ? "Tarif periode" : "Harga"}</th>
              <th scope="col">Luas tanah</th>
              <th scope="col">Harga/m²</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-target={row.target || undefined}
                data-price-per-sqm={row.sqm ?? ""}
              >
                <td>
                  <a
                    className="investor-cma-photo"
                    href={row.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buka foto dan listing ${row.target ? "aset ini" : row.location}`}
                  >
                    <ListingImage
                      key={row.imageUrl}
                      src={row.imageUrl}
                      alt=""
                      sizes="48px"
                      className="object-cover"
                    />
                  </a>
                </td>
                <th scope="row">
                  <a
                    href={row.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={row.location}
                    className="investor-cma-location"
                  >
                    {row.target && (
                      <span className="investor-cma-target-label">
                        Aset ini
                      </span>
                    )}
                    <span className="line-clamp-2">{row.location}</span>
                  </a>
                </th>
                <td>
                  <strong>{formatRupiah(row.price)}</strong>
                  <span className="investor-cma-price-source">
                    {rent
                      ? `Per ${rentalPeriodLabel(listing.rentalPeriod)}`
                      : row.category === "LELANG" || !row.category
                        ? row.target
                          ? "Limit saat ini"
                          : "Limit awal"
                        : "Harga penawaran"}
                  </span>
                </td>
                <td>
                  {row.land && row.land > 0
                    ? `${row.land.toLocaleString("id-ID")} m²`
                    : "—"}
                </td>
                <td className="investor-cma-sqm">
                  {row.sqm ? formatRupiah(row.sqm) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!proof.samples.length && (
        <p className="investor-roi-caption mt-3">
          Belum ada pembanding yang memenuhi syarat. Aset ini tetap ditampilkan
          sebagai referensi.
        </p>
      )}
      <p className="investor-roi-footnote">
        {rows.length} baris ditampilkan, termasuk aset ini. Rata-rata dan
        minimum dihitung dari seluruh {benchmark?.sampleCount ?? 0} pembanding
        valid, tanpa aset ini. Jenis properti dan transaksi sama; satu aset
        dihitung sekali.{" "}
        {rent
          ? "Tarif dibandingkan pada periode yang sama."
          : "Lelang memakai limit pertama; Primary/Secondary memakai harga penawaran."}{" "}
        Seluruh valuasi memakai luas tanah. Snapshot{" "}
        {formatAuctionDate(proof.version)}.
      </p>
      {proof.cheapestPeer && (
        <a
          className="investor-roi-source"
          href={proof.cheapestPeer.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={proof.cheapestPeer.locationSummary}
        >
          Sumber harga/m² termurah <ArrowUpRight size={13} strokeWidth={1.5} />
        </a>
      )}
    </section>
  );
}
