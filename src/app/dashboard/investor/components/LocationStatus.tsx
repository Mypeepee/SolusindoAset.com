import type { InvestorListing } from "@/lib/investor-deals";
export default function LocationStatus({
  listing,
  onCorrect,
  variant = "default",
}: {
  listing: InvestorListing;
  onCorrect?: () => void;
  variant?: "default" | "card";
}) {
  if (
    listing.kelurahanVerified ??
    Boolean(listing.kelurahanId && listing.kelurahanName)
  )
    return null;
  return (
    <div
      className={
        variant === "card"
          ? "investor-card-location"
          : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/15 bg-amber-200/[0.035] px-3 py-2"
      }
    >
      <span className="text-[11px] leading-4 text-amber-100/90">
        Data Kelurahan Belum Terverifikasi
      </span>
      {onCorrect && (
        <button
          type="button"
          className="text-xs font-medium text-emerald-200 underline underline-offset-4 hover:text-white"
          aria-label="Pilih kelurahan"
          onClick={onCorrect}
        >
          {variant === "card" ? "Pilih" : "Pilih kelurahan"}
        </button>
      )}
    </div>
  );
}
