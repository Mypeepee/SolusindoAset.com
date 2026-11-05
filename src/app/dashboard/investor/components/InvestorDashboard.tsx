"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  CircleHelp,
  LoaderCircle,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateDealMetrics,
  DEFAULT_DEAL_THRESHOLD,
  formatAuctionDate,
  toDealView,
  type TransactionType,
  type InvestorListing,
} from "@/lib/investor-deals";
import InvestorPagination from "./InvestorPagination";
import PropertyDealCard from "./PropertyDealCard";
import DealDialogs, { type DealDialogState } from "./DealDialogs";
import InvestorFilters from "./InvestorFilters";
import LocationCorrectionDialog from "./LocationCorrectionDialog";
import MarkSoldDialog from "./MarkSoldDialog";
import InvestorSummary from "./InvestorSummary";
import { useInvestorState } from "./useInvestorState";
import { useInvestorFeed } from "./useInvestorFeed";
import InvestorResultControls from "./InvestorResultControls";
import "../investor.css";
export default function InvestorDashboard({
  bookmarkScope,
}: {
  bookmarkScope: string;
}) {
  const {
    filters,
    page,
    savedIds,
    bookmarksReady,
    updateFilters,
    toggleBookmark,
    setPage,
  } = useInvestorState(bookmarkScope);
  const {
    data,
    metadata,
    loading,
    error,
    refresh,
    setComposing,
    submitSearch,
  } = useInvestorFeed(filters, page, savedIds, bookmarksReady, bookmarkScope);
  const [dialog, setDialog] = useState<DealDialogState | null>(null);
  const [locationTarget, setLocationTarget] = useState<InvestorListing | null>(
    null,
  );
  const resultsRef = useRef<HTMLElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);
  const [soldTarget, setSoldTarget] = useState<InvestorListing | null>(null);
  const [soldError, setSoldError] = useState<string | null>(null);
  const savingSoldRef = useRef(false);
  const [recoveredSearch, setRecoveredSearch] = useState<string | null>(null);
  const searchKey = JSON.stringify({ ...filters, dataState: undefined });
  const scopeRecovered =
    recoveredSearch === searchKey && filters.dataState === "all";
  useEffect(() => {
    if (
      !loading &&
      !error &&
      data?.total === 0 &&
      filters.dataState === "deals" &&
      (data.summary.matchingListingsCount ?? data.summary.activeListings) > 0
    ) {
      // An old URL can retain Worth-it even after the default changes. Recover
      // with the same real filters; the visible scope and notice explain it.
      setRecoveredSearch(searchKey);
      updateFilters({ dataState: "all" });
    }
  }, [data, error, loading, filters.dataState, searchKey, updateFilters]);
  const deals = useMemo(() => data?.items.map(toDealView) ?? [], [data]);
  const actions = {
    onAnalyze: (listing: InvestorListing) =>
      setDialog({ kind: "roi", listing }),
    onView: (listing: InvestorListing) =>
      setDialog({ kind: "listing", listing }),
    onBookmark: toggleBookmark,
    onMarkSold: (listing: InvestorListing) => {
      if (savingSoldRef.current) return;
      setSoldError(null);
      setSoldTarget(listing);
    },
    onCorrectLocation: (listing: InvestorListing) => {
      setDialog(null);
      setLocationTarget(listing);
    },
  };
  const confirmSold = async () => {
    if (!soldTarget || savingSoldRef.current) return;
    const listing = soldTarget;
    savingSoldRef.current = true;
    setSoldError(null);
    setMarkingSoldId(listing.id);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(
        `/api/dashboard/investor/${encodeURIComponent(listing.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "TERJUAL" }),
          signal: controller.signal,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Gagal menandai aset terjual.");
      toast.success(result.message || "Aset berhasil ditandai terjual.");
      setSoldTarget(null);
      refresh();
    } catch (error) {
      setSoldError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "Permintaan melewati batas waktu. Muat ulang untuk memeriksa status aset.",
      );
    } finally {
      window.clearTimeout(timeout);
      savingSoldRef.current = false;
      setMarkingSoldId(null);
    }
  };
  const changeTransaction = (transactionType: TransactionType) => {
    setDialog(null);
    updateFilters({
      transactionType,
      listingCategory: "ALL",
      dataState: "all",
      upcomingOnly: false,
      sort: "score",
      minPrice: undefined,
      maxPrice: undefined,
      minLand: undefined,
      maxLand: undefined,
      rentalPeriod: "",
      propertyTypes: [],
    });
  };
  const goToPage = (next: number) => {
    setPage(next);
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    resultsRef.current?.focus({ preventScroll: true });
  };
  const reset = () =>
    updateFilters({
      query: "",
      city: "",
      locations: [],
      propertyTypes: [],
      minPrice: undefined,
      maxPrice: undefined,
      minLand: undefined,
      maxLand: undefined,
      rentalPeriod: "",
      listingCategory: "ALL",
      dataState: "all",
      minDrop: DEFAULT_DEAL_THRESHOLD,
      minSpread: DEFAULT_DEAL_THRESHOLD,
      savedOnly: false,
      upcomingOnly: false,
    });
  const resetAdditionalFilters = () =>
    updateFilters({
      listingCategory: "ALL",
      dataState: "all",
      minPrice: undefined,
      maxPrice: undefined,
      minLand: undefined,
      maxLand: undefined,
      rentalPeriod: "",
      minDrop: DEFAULT_DEAL_THRESHOLD,
      minSpread: DEFAULT_DEAL_THRESHOLD,
      savedOnly: false,
      upcomingOnly: false,
    });
  return (
    <main className="investor-surface investor-dashboard mx-auto max-w-[1600px] py-6 sm:py-8">
      <h1 className="sr-only" id="investor-heading" tabIndex={-1}>
        Investor Deals
      </h1>
      <InvestorSummary
        data={data}
        isRent={filters.transactionType === "SEWA"}
        onView={actions.onView}
        unavailable={Boolean(error) && !loading}
        paused={
          loading ||
          Boolean(error) ||
          Boolean(dialog || locationTarget || soldTarget) ||
          advancedOpen
        }
      />
      <InvestorFilters
        filters={filters}
        metadata={metadata}
        updateFilters={updateFilters}
        onTransactionChange={changeTransaction}
        setComposing={setComposing}
        submitSearch={submitSearch}
        searching={loading}
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        savedCount={bookmarksReady ? savedIds.length : null}
      >
        <InvestorResultControls
          filters={filters}
          data={data}
          loading={loading}
          error={Boolean(error)}
          updateFilters={updateFilters}
          onRefresh={refresh}
        />
      </InvestorFilters>
      <section
        ref={resultsRef}
        tabIndex={-1}
        className="investor-results scroll-mt-4 outline-none"
        aria-label="Daftar properti"
      >
        {scopeRecovered && data && !loading && !error && (
          <div className="investor-scope-recovery">
            <p role="status">
              <CircleHelp size={16} aria-hidden="true" />
              <span>
                Belum ada yang lolos ambang diskon. Menampilkan{" "}
                {data.total.toLocaleString("id-ID")} properti tersedia
                {filters.listingCategory && filters.listingCategory !== "ALL"
                  ? ` · ${filters.listingCategory === "SECONDARY" ? "Secondary" : filters.listingCategory === "PRIMARY" ? "Primary" : "Lelang"}`
                  : ""}
                .
              </span>
            </p>
            <button
              type="button"
              className="investor-button"
              onClick={resetAdditionalFilters}
            >
              Hapus filter tambahan
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="investor-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-amber-100"
          >
            <p className="flex items-center gap-2">
              <TriangleAlert size={16} />
              {error.message}
              {data && " Menampilkan snapshot terakhir; data belum diperbarui."}
            </p>
            {error.status === 401 ? (
              <a href="/?auth=required" className="investor-button">
                Masuk kembali
              </a>
            ) : error.status === 403 ? (
              <a href="/dashboard" className="investor-button">
                Kembali ke dashboard
              </a>
            ) : (
              <button
                type="button"
                className="investor-button"
                onClick={refresh}
              >
                Coba lagi
              </button>
            )}
          </div>
        )}
        {!data && loading ? (
          <div
            role="status"
            className="investor-panel flex min-h-[360px] items-center justify-center gap-3 text-sm text-slate-300"
          >
            <LoaderCircle
              size={20}
              className="animate-spin motion-reduce:animate-none text-emerald-300"
            />
            Memuat listing dan analisis CMA…
          </div>
        ) : !data ? (
          <div className="investor-panel flex min-h-[360px] items-center justify-center px-6 text-center text-sm text-slate-400">
            {error
              ? "Filter tetap tersimpan. Data akan ditampilkan setelah permintaan berhasil."
              : "Menunggu data listing…"}
          </div>
        ) : !deals.length ? (
          <div className="investor-panel flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <span className="investor-empty-icon">
              <Search size={25} />
            </span>
            <h3 className="mt-4 text-lg text-white">
              {filters.savedOnly && !savedIds.length
                ? "Belum ada properti tersimpan"
                : filters.dataState === "deals"
                  ? "Belum ada yang memenuhi ambang diskon"
                  : "Tidak ada properti yang cocok"}
            </h3>
            <p className="mt-2 max-w-md text-xs leading-6 text-slate-400">
              {filters.savedOnly && !savedIds.length
                ? "Simpan listing melalui ikon bookmark untuk membuat daftar pantauan."
                : filters.dataState === "deals" &&
                    data.summary.activeListings > 0
                  ? `${data.summary.activeListings.toLocaleString("id-ID")} properti aktif dalam pilihan wilayah dan kategori. Pilih Semua listing untuk melihat properti di luar ambang diskon.`
                  : "Coba ubah kota, kelurahan, jenis properti atau rentang pencarian."}
            </p>
            <button
              type="button"
              className="investor-primary mt-5"
              onClick={
                filters.dataState === "deals" &&
                data.summary.activeListings > 0 &&
                !filters.savedOnly
                  ? () => updateFilters({ dataState: "all" })
                  : reset
              }
            >
              {filters.dataState === "deals" &&
              data.summary.activeListings > 0 &&
              !filters.savedOnly
                ? "Lihat semua listing"
                : "Reset pencarian"}
            </button>
          </div>
        ) : (
          <div className="investor-property-grid" aria-busy={loading}>
            {deals.map(({ listing, metrics }, index) => (
              <PropertyDealCard
                key={listing.id}
                listing={listing}
                metrics={metrics}
                rank={(data.page - 1) * data.pageSize + index + 1}
                saved={savedIds.includes(listing.id)}
                markingSold={markingSoldId === listing.id}
                {...actions}
              />
            ))}
          </div>
        )}
        {data && data.total > 0 && (
          <InvestorPagination
            page={data.page}
            pageSize={data.pageSize}
            pageCount={data.pageCount}
            total={data.total}
            loading={loading}
            onPage={goToPage}
          />
        )}
      </section>
      <footer className="mt-7 border-t border-white/[0.07] pt-4">
        <details className="investor-method">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-[11px] text-slate-300 hover:text-emerald-200">
            <CircleHelp size={14} />
            Bagaimana nilai deal dihitung?
            <ChevronRight size={12} className="investor-method-chevron" />
          </summary>
          <div className="mt-3 grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-[11px] leading-6 text-slate-400 md:grid-cols-2">
            <p>
              <strong className="font-medium text-emerald-200">
                Spread pasar
              </strong>
              <br />
              (rata-rata pembanding − harga/m² listing) ÷ rata-rata pembanding ×
              100%. Luas tanah saja; jenis properti dan transaksi harus sama.
              Baseline BELI: harga pertama untuk Lelang, penawaran aktif untuk
              Primary/Secondary. SEWA memakai tarif pada periode yang sama.
              Kelurahan kosong dikeluarkan. Pembanding hanya berasal dari
              kelurahan yang sama, termasuk saat hanya satu pembanding tersedia.
              Aset target tidak ikut dalam rata-rata.
            </p>
            {filters.transactionType !== "SEWA" && (
              <p>
                <strong className="font-medium text-amber-200">
                  Penurunan lelang
                </strong>
                <br />
                (harga lelang awal tercatat − harga saat ini) ÷ harga awal ×
                100%. Aset dicocokkan memakai sertifikat dan cakupan bidang yang
                sama; harga awal adalah riwayat tertua yang tersedia. Peringkat
                menggabungkan kedua diskon dengan presisi penuh. Lolos jika
                salah satu metrik mencapai ambangnya. Metrik tanpa bukti tetap
                “—”.
              </p>
            )}
          </div>
        </details>
        <p className="mt-3 text-[10px] leading-5 text-slate-400">
          CMA dimuat otomatis dari data listing; dashboard memuat ulang setiap
          60 detik saat halaman terlihat.{" "}
          {data &&
            `Snapshot ${formatAuctionDate(data.generatedAt)}, ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(data.generatedAt))} WIB. `}
          CMA merupakan pembanding listing, bukan appraisal. Bookmark tersimpan
          per akun di browser ini.
        </p>
      </footer>
      {soldTarget && (
        <MarkSoldDialog
          key={soldTarget.id}
          listing={soldTarget}
          saving={markingSoldId !== null}
          error={soldError}
          onConfirm={confirmSold}
          onClose={() => {
            if (!savingSoldRef.current) setSoldTarget(null);
          }}
        />
      )}
      <LocationCorrectionDialog
        listing={locationTarget}
        onClose={() => setLocationTarget(null)}
        onSaved={() => {
          setLocationTarget(null);
          refresh();
          resultsRef.current?.focus({ preventScroll: true });
        }}
      />
      <DealDialogs
        state={dialog}
        metrics={dialog ? calculateDealMetrics(dialog.listing) : null}
        onClose={() => setDialog(null)}
        onAnalyze={actions.onAnalyze}
        onCorrectLocation={actions.onCorrectLocation}
        onRefresh={() => {
          setDialog(null);
          refresh();
        }}
      />
    </main>
  );
}
