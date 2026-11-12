"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { ChartNoAxesCombined, History, Loader2, RefreshCw } from "lucide-react";
import {
  formatRupiah,
  rentalPeriodLabel,
  type CmaValidationProof,
  type InvestorListing,
} from "@/lib/investor-deals";
import CmaEvidenceTable from "./CmaEvidenceTable";
import ListingImage from "./ListingImage";
import LocationStatus from "./LocationStatus";
import RoiPurchaseAnalysis from "./RoiPurchaseAnalysis";
import { RentalComparison } from "./RoiScenarios";

const RiwayatLelang = dynamic(
  () => import("@/app/Lelang/[slugId]/[agentId]/components/RiwayatLelang"),
  {
    loading: () => (
      <div role="status" className="investor-roi-loading">
        <Loader2
          size={18}
          className="animate-spin motion-reduce:animate-none"
        />
        Memuat riwayat lelang…
      </div>
    ),
  },
);

export default function CmaValidationPanel({
  listing,
  onRefresh,
  onCorrectLocation,
}: {
  listing: InvestorListing;
  onRefresh: () => void;
  onCorrectLocation?: (listing: InvestorListing) => void;
}) {
  const [proof, setProof] = useState<CmaValidationProof | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState("cma");
  const [historyVisited, setHistoryVisited] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setProof(null);
    setError("");
    setStatus(0);
    (async () => {
      try {
        const response = await fetch(
          `/api/dashboard/investor/${encodeURIComponent(listing.id)}/validation`,
          { signal: controller.signal, cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok) {
          if (active) setStatus(response.status);
          throw new Error(body.error || "Analisis belum dapat dimuat.");
        }
        if (!body.listing || !Array.isArray(body.samples))
          throw new Error("Respons analisis tidak lengkap.");
        if (active) setProof(body);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error && err.name !== "AbortError"
              ? err.message
              : "Koneksi terlalu lama. Coba lagi.",
          );
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [listing.id, attempt]);

  const current = proof?.listing || listing;
  const rent = current.transactionType === "SEWA";
  const auction =
    !rent && (!current.listingCategory || current.listingCategory === "LELANG");
  const unavailable = [401, 403, 404].includes(status);
  const tabs = auction ? ["cma", "history"] : ["cma"];
  const chooseTab = (value: string) => {
    setTab(value);
    if (value === "history") setHistoryVisited(true);
  };
  const navigateTabs = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    chooseTab(tabs[next]);
    tabRefs.current[next]?.focus();
  };
  const address = current.address || current.title;
  const changed =
    proof &&
    (listing.currentAuctionPrice !== current.currentAuctionPrice ||
      listing.benchmark?.avgPricePerSqm !== proof.benchmark?.avgPricePerSqm ||
      listing.benchmark?.sampleCount !== proof.benchmark?.sampleCount);
  return (
    <>
      <header className="investor-roi-header">
        <div className="investor-roi-header-photo">
          <ListingImage
            key={current.imageUrl}
            src={current.imageUrl}
            alt={`Foto ${current.title}`}
            sizes="72px"
            className="object-cover"
          />
        </div>
        <div className="investor-roi-header-info">
          <p className="investor-roi-eyebrow">
            {current.propertyType} ·{" "}
            {rent ? "SEWA" : current.listingCategory || "LELANG"}
          </p>
          <h2>{rent ? "Analisis sewa" : "Analisis ROI"}</h2>
          <a
            href={current.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={address}
            className="line-clamp-2"
          >
            {address}
          </a>
          <p className="investor-roi-caption">
            {current.cityName} · Tanah{" "}
            {current.landAreaSqm
              ? `${current.landAreaSqm.toLocaleString("id-ID")} m²`
              : "belum tersedia"}
          </p>
        </div>
        <div className="investor-roi-header-price">
          <span>
            {rent
              ? `Tarif / ${rentalPeriodLabel(current.rentalPeriod)}`
              : auction
                ? "Nilai limit aktif"
                : "Harga properti"}
          </span>
          <strong>{formatRupiah(current.currentAuctionPrice)}</strong>
        </div>
      </header>
      <div className="investor-roi-layout">
        <div className="investor-roi-evidence">
          <div
            className="investor-roi-tabs"
            role="tablist"
            aria-label="Bukti analisis"
          >
            {tabs.map((value, index) => (
              <button
                key={value}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`investor-tab-${value}`}
                aria-controls={`investor-panel-${value}`}
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => chooseTab(value)}
                onKeyDown={(event) => navigateTabs(event, index)}
              >
                {value === "cma" ? (
                  <ChartNoAxesCombined size={16} strokeWidth={1.5} />
                ) : (
                  <History size={16} strokeWidth={1.5} />
                )}
                {value === "cma" ? "CMA" : "Riwayat Lelang"}
              </button>
            ))}
          </div>
          <div
            id="investor-panel-cma"
            role="tabpanel"
            aria-labelledby="investor-tab-cma"
            tabIndex={0}
            hidden={tab !== "cma"}
            className="investor-roi-tab-content"
            aria-busy={!proof && !error}
          >
            {!proof && !error && (
              <div role="status" className="investor-roi-loading">
                <Loader2
                  size={18}
                  className="animate-spin motion-reduce:animate-none"
                />
                Memuat bukti CMA…
              </div>
            )}
            {error && (
              <div role="alert" className="investor-roi-error">
                <p>{error}</p>
                {status === 404 ? (
                  <button
                    type="button"
                    className="investor-button"
                    onClick={onRefresh}
                  >
                    Perbarui dashboard
                  </button>
                ) : status === 401 ? (
                  <a href="/signin" className="investor-button">
                    Masuk kembali
                  </a>
                ) : status !== 403 ? (
                  <button
                    type="button"
                    className="investor-button"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    <RefreshCw size={14} />
                    Coba lagi CMA
                  </button>
                ) : null}
                <p className="investor-roi-caption">
                  {auction && !unavailable
                    ? "Riwayat lelang dapat dibuka secara terpisah."
                    : "Skenario menunggu benchmark terverifikasi."}
                </p>
              </div>
            )}
            {proof && (
              <>
                {changed && (
                  <p role="status" className="investor-roi-caption mb-3">
                    Harga atau pembanding diperbarui sejak dashboard dimuat.
                  </p>
                )}
                <LocationStatus
                  listing={current}
                  onCorrect={
                    onCorrectLocation
                      ? () => onCorrectLocation(current)
                      : undefined
                  }
                />
                {!current.kelurahanVerified && (
                  <p className="investor-roi-notice">
                    Market spread dikecualikan sampai kelurahan diverifikasi.
                  </p>
                )}
                {rent && !current.rentalPeriod && (
                  <p className="investor-roi-notice">
                    Periode sewa belum terverifikasi. Tidak ada perbandingan
                    tarif lintas periode.
                  </p>
                )}
                <CmaEvidenceTable proof={proof} />
              </>
            )}
          </div>
          {auction && (
            <div
              id="investor-panel-history"
              role="tabpanel"
              aria-labelledby="investor-tab-history"
              tabIndex={0}
              hidden={tab !== "history"}
              className="investor-roi-tab-content investor-roi-history"
            >
              {historyVisited &&
                (unavailable ? (
                  <p className="investor-roi-notice">
                    Muat ulang listing sebelum membuka riwayat.
                  </p>
                ) : (
                  <RiwayatLelang idProperty={current.id} canViewHistory />
                ))}
            </div>
          )}
        </div>
        {rent ? (
          <RentalComparison listing={current} proof={proof} />
        ) : (
          <RoiPurchaseAnalysis
            key={`${current.id}-${current.currentAuctionPrice}-${current.listingCategory || "LELANG"}`}
            listing={current}
            proof={proof}
            unavailable={unavailable}
          />
        )}
      </div>
    </>
  );
}
