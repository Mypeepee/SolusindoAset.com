import {
  ArrowRight,
  Bookmark,
  Calculator,
  MapPin,
  Ruler,
} from "lucide-react";
import { CalendarIcon, CheckCircledIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Icon } from "@iconify/react";
import { investorCardIcons } from "./investor-card-icons";
import { PropertyCardFrame } from "@/components/property/PropertyCardFrame";
import {
  formatAuctionDate,
  formatRupiah,
  rentalPeriodLabel,
  type InvestorListing,
  type DealMetrics as Metrics,
} from "@/lib/investor-deals";
import {
  investorAuctionCountdown,
  investorCertificateLabel,
} from "@/lib/investor-presentation";
import InvestorPhotoGallery from "./InvestorPhotoGallery";
import LocationStatus from "./LocationStatus";
import { CompactDealMetrics } from "./DealMetrics";

export interface DealActions {
  onAnalyze: (listing: InvestorListing) => void;
  onView: (listing: InvestorListing) => void;
  onBookmark: (id: string) => void;
  onMarkSold: (listing: InvestorListing) => void;
  markingSold: boolean;
  onCorrectLocation?: (listing: InvestorListing) => void;
}

const normalizedLocation = (value: string) =>
  value
    .replace(
      /^(?:kota|kabupaten|kab\.?|kecamatan|kec\.?|kelurahan|kel\.?)\s+/i,
      "",
    )
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Preserve the street address, adding only location context absent from it. */
function fullListingAddress(listing: InvestorListing) {
  const parts = [listing.address.trim()].filter(Boolean);
  for (const region of [
    listing.kelurahanName,
    listing.districtName,
    listing.cityName,
  ]) {
    if (
      region?.trim() &&
      !` ${normalizedLocation(parts.join(" "))} `.includes(
        ` ${normalizedLocation(region)} `,
      )
    )
      parts.push(region.trim());
  }
  return parts.join(", ") || "Alamat belum tersedia";
}

export default function PropertyDealCard({
  listing,
  metrics,
  saved,
  markingSold,
  ...actions
}: {
  listing: InvestorListing;
  metrics: Metrics;
  saved: boolean;
  rank: number;
} & DealActions) {
  const rent = listing.transactionType === "SEWA";
  const auction =
    !rent && (!listing.listingCategory || listing.listingCategory === "LELANG");
  const countdown = auction ? investorAuctionCountdown(listing.auctionDate) : null;
  const address = fullListingAddress(listing);
  const certificate = investorCertificateLabel(listing.certificateType);
  const assetIcon =
    investorCardIcons[listing.propertyType as keyof typeof investorCardIcons] ||
    investorCardIcons.RUMAH;
  const categoryIcon = auction
    ? investorCardIcons.auction
    : rent
      ? investorCardIcons.rent
      : listing.listingCategory === "PRIMARY"
        ? investorCardIcons.primary
        : investorCardIcons.secondary;
  const photos = [
    ...new Set(
      (listing.imageUrls?.length
        ? listing.imageUrls
        : [listing.imageUrl]
      ).filter(Boolean),
    ),
  ];
  const compactPhoto =
    !listing.kelurahanId ||
    !listing.kelurahanName ||
    (rent && !listing.rentalPeriod);

  return (
    <PropertyCardFrame
      as="article"
      className="investor-property"
      aria-labelledby={`address-${listing.id}`}
      data-listing-id={listing.id}
      data-compact-photo={compactPhoto || undefined}
    >
      <div className="investor-card-core">
        <InvestorPhotoGallery
          images={photos}
          title={listing.title}
          key={`${listing.id}:${photos.join("|")}`}
        >
          <span
            className={`investor-card-category ${auction ? "is-auction" : rent ? "is-rent" : "is-buy"}`}
          >
            <Icon
              ssr
              icon={categoryIcon}
              width={16}
              height={16}
              aria-hidden="true"
            />
            {rent ? "SEWA" : listing.listingCategory || "LELANG"}
          </span>
          {countdown && (
            <time
              className={`investor-card-auction-date is-${countdown.state}`}
              dateTime={listing.auctionDate!}
              title={`Lelang ${formatAuctionDate(listing.auctionDate)} · ${countdown.label}`}
              aria-label={`Lelang ${formatAuctionDate(listing.auctionDate)}, ${countdown.label}`}
            >
              <CalendarIcon aria-hidden="true" />
              <span>{countdown.label}</span>
            </time>
          )}
          <div className="investor-card-photo-meta">
            <span className="investor-card-type">
              <Icon
                ssr
                icon={assetIcon}
                width={16}
                height={16}
                aria-hidden="true"
              />
              {listing.propertyType}
            </span>
            <span
              className="investor-card-certificate"
              aria-label={`Jenis sertifikat: ${certificate || "belum tersedia"}`}
              title={certificate || "Jenis sertifikat belum tersedia"}
            >
              {certificate || "Sertifikat —"}
            </span>
          </div>
        </InvestorPhotoGallery>
        <div className="investor-card-body">
          <div className="investor-card-price-row">
            <div className="investor-card-price-block">
              <span className="investor-card-eyebrow">
                {auction
                  ? "Nilai limit"
                  : rent
                    ? "Harga sewa"
                    : "Harga properti"}
              </span>
              <p className="investor-card-price">
                <strong>{formatRupiah(listing.currentAuctionPrice)}</strong>
                {rent && listing.rentalPeriod && (
                  <span>/{rentalPeriodLabel(listing.rentalPeriod)}</span>
                )}
              </p>
            </div>
            <div className="investor-card-land">
              <span className="investor-card-eyebrow">
                <Ruler size={12} aria-hidden="true" />
                Luas tanah
              </span>
              <strong>
                {listing.landAreaSqm === null
                  ? "—"
                  : listing.landAreaSqm.toLocaleString("id-ID")}
                {listing.landAreaSqm !== null && <small> m²</small>}
              </strong>
            </div>
          </div>
          {rent && !listing.rentalPeriod && (
            <p className="mt-1 text-xs leading-4 text-amber-200">
              Periode sewa belum terverifikasi
            </p>
          )}
          <h3 id={`address-${listing.id}`} className="investor-card-address">
            <MapPin size={16} aria-hidden="true" />
            <button
              type="button"
              className="investor-card-title-link"
              aria-label={`Lihat detail ${address}: ${listing.title}`}
              title={address}
              aria-haspopup="dialog"
              onClick={() => actions.onView(listing)}
            >
              {address}
            </button>
          </h3>
          <CompactDealMetrics
            metrics={metrics}
            auctionEnabled={auction}
            onValidate={() => actions.onAnalyze(listing)}
          />
          <LocationStatus
            listing={listing}
            variant="card"
            onCorrect={
              actions.onCorrectLocation
                ? () => actions.onCorrectLocation!(listing)
                : undefined
            }
          />
          <div className="investor-card-actions">
            <button
              type="button"
              className="investor-primary"
              aria-haspopup="dialog"
              onClick={() => actions.onAnalyze(listing)}
            >
              <span className="investor-action-icon">
                <Calculator size={14} aria-hidden="true" />
              </span>
              <span className="investor-action-label">
                {rent ? "Analisis sewa" : "Analisis ROI"}
              </span>
            </button>
            <button
              type="button"
              className={`investor-bookmark ${saved ? "is-saved" : ""}`}
              aria-label={`Bookmark ${listing.title}`}
              aria-pressed={saved}
              onClick={() => actions.onBookmark(listing.id)}
            >
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
            </button>
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="investor-button"
              aria-label="Lihat detail (tab baru)"
            >
              <span className="investor-action-label">Lihat detail</span>
              <span className="investor-action-icon">
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
            <button
              type="button"
              className="investor-sold-action"
              disabled={markingSold}
              aria-busy={markingSold}
              aria-haspopup="dialog"
              aria-label={`Tandai terjual: ${address}`}
              onClick={() => actions.onMarkSold(listing)}
            >
              <span className="investor-sold-label">
                {markingSold ? "Menyimpan…" : "Tandai terjual"}
              </span>
              <span className="investor-sold-icon" aria-hidden="true">
                {markingSold ? (
                  <UpdateIcon className="investor-sold-spinner" />
                ) : (
                  <CheckCircledIcon />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </PropertyCardFrame>
  );
}
