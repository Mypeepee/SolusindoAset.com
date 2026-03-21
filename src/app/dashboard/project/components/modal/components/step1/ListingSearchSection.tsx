"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import type { ListingOption } from "../../types";
import {
  formatCategoryLabel,
  formatCurrency,
  formatTransactionLabel,
  normalizeImageUrl,
} from "../../utils";

type Props = {
  listingQuery: string;
  setListingQuery: (value: string) => void;
  listingLoading: boolean;
  listingError: string;
  listingResults: ListingOption[];
  selectedId: string | number | null;
  selectedListing?: ListingOption | null;
  onSelect: (item: ListingOption) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  inputClassName?: string;
};

function getAddressLabel(item?: ListingOption | null) {
  if (!item) return "";
  return (
    item.alamat_property ||
    item.alamat_lengkap ||
    `Property #${item.id_listing}`
  );
}

function getLocationLabel(item?: ListingOption | null) {
  if (!item) return "";
  return [item.kelurahan, item.kecamatan, item.kota, item.provinsi]
    .filter(Boolean)
    .join(" • ");
}

function extractGoogleDriveId(rawUrl: string) {
  if (!rawUrl) return null;

  const patterns = [
    /[?&]id=([^&#]+)/i,
    /\/file\/d\/([^/]+)/i,
    /\/d\/([^/]+)/i,
    /\/thumbnail\?id=([^&#]+)/i,
    /\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawUrl.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function getImageCandidates(...rawValues: Array<string | null | undefined>) {
  const set = new Set<string>();

  for (const raw of rawValues) {
    if (!raw) continue;

    const normalized = normalizeImageUrl(raw);
    if (normalized) set.add(normalized);

    const driveId = extractGoogleDriveId(raw);
    if (driveId) {
      set.add(`https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`);
      set.add(`https://drive.google.com/uc?export=view&id=${driveId}`);
      set.add(`https://lh3.googleusercontent.com/d/${driveId}=w1200`);
    }
  }

  return Array.from(set);
}

function SmartListingImage({ item }: { item: ListingOption }) {
  const candidates = useMemo(
    () => getImageCandidates(item.gambar_thumbnail, item.gambar),
    [item.gambar_thumbnail, item.gambar]
  );

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(candidates.length === 0);
  }, [candidates]);

  const src = candidates[index];

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-slate-500">
        <Building2 className="h-6 w-6" />
      </div>
    );
  }

  return (
    <img
      key={`${item.id_listing}-${src}`}
      src={src}
      alt={getAddressLabel(item)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

export default function ListingSearchSection({
  listingQuery,
  setListingQuery,
  listingLoading,
  listingError,
  listingResults,
  selectedId,
  selectedListing,
  onSelect,
  onLoadMore,
  hasMore = false,
  inputClassName = "",
}: Props) {
  const selectedIdValue =
    selectedId === null || selectedId === undefined ? null : String(selectedId);

  const resolvedSelectedListing = useMemo(() => {
    if (selectedListing) return selectedListing;
    if (!selectedIdValue) return null;

    return (
      listingResults.find(
        (item) => String(item.id_listing) === String(selectedIdValue)
      ) ?? null
    );
  }, [selectedListing, listingResults, selectedIdValue]);

  const [pickerOpen, setPickerOpen] = useState(!selectedIdValue);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPickerOpen(!selectedIdValue);
  }, [selectedIdValue]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = loadMoreRef.current;

    if (!pickerOpen || !hasMore || !onLoadMore || listingLoading) return;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !listingLoading) {
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: "120px",
        threshold: 0.01,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [pickerOpen, hasMore, onLoadMore, listingLoading, listingResults.length]);

  const selectedAddress = getAddressLabel(resolvedSelectedListing);
  const selectedLocation = getLocationLabel(resolvedSelectedListing);
  const hasSelected = !!selectedIdValue;

  function handleSelect(item: ListingOption) {
    onSelect(item);
    setPickerOpen(false);
    setListingQuery("");
  }

  return (
    <section className="relative min-w-0 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(7,18,34,0.92),rgba(8,18,30,0.78)_40%,rgba(10,18,26,0.88))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.04),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[29px] border border-white/[0.04]" />
      <div className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-0 h-28 w-28 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.22)]">
            <div className="absolute inset-0 rounded-[20px] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.12),transparent_45%)]" />
            <Search className="relative h-6 w-6 text-white/95" />
          </div>

          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold tracking-tight text-white sm:text-[19px]">
              Pilih Property
            </h3>
            <p className="mt-1 text-[15px] leading-7 text-slate-300/85">
              Cari berdasarkan ID property, alamat, kota, atau kecamatan.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {hasSelected && !pickerOpen ? (
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.08),transparent_35%,transparent_65%,rgba(255,255,255,0.03))]" />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group relative flex h-[86px] w-full min-w-0 items-center gap-3 overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] px-4 py-3 text-left transition duration-200 hover:border-white/15 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]"
              >
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Search className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      ID #{selectedIdValue}
                    </span>

                    {selectedAddress ? (
                      <span
                        className="block min-w-0 flex-1 truncate text-[15px] font-semibold text-white/95 sm:text-[16px]"
                        title={selectedAddress}
                      >
                        {selectedAddress}
                      </span>
                    ) : (
                      <span className="block min-w-0 flex-1 truncate text-[15px] font-medium text-slate-300">
                        Property terpilih
                      </span>
                    )}
                  </div>

                  {selectedLocation ? (
                    <p
                      className="mt-2 block truncate text-[13px] text-slate-300/80"
                      title={selectedLocation}
                    >
                      {selectedLocation}
                    </p>
                  ) : null}
                </div>

                <div className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-white/20">
                  <span>Ganti</span>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))]" />

              <div className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                    placeholder="Cari ID property / alamat / kota / kecamatan..."
                    className={`h-13 w-full rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] ${inputClassName}`}
                  />
                </div>

                <div
                  ref={scrollRef}
                  className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1"
                >
                  {listingLoading && listingResults.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Mengambil listing...</span>
                    </div>
                  ) : listingError ? (
                    <div className="rounded-[18px] border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                      {listingError}
                    </div>
                  ) : listingResults.length > 0 ? (
                    <>
                      {listingResults.map((item) => {
                        const active =
                          String(item.id_listing) === String(selectedIdValue);
                        const isLelang = item.jenis_transaksi === "LELANG";
                        const address = getAddressLabel(item);
                        const locationBits = [
                          item.kelurahan,
                          item.kecamatan,
                          item.kota,
                          item.provinsi,
                        ].filter(Boolean) as string[];

                        return (
                          <button
                            key={item.id_listing}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className={`group w-full overflow-hidden rounded-[22px] border text-left transition duration-200 ${
                              active
                                ? "border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] shadow-[0_14px_40px_rgba(0,0,0,0.18)]"
                                : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] hover:border-white/15 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))]"
                            }`}
                          >
                            <div className="flex items-stretch gap-3 p-3">
                              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-28 sm:w-36">
                                <SmartListingImage item={item} />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.22))]" />
                              </div>

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-100">
                                    Property #{item.id_listing}
                                  </span>

                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                                    {formatCategoryLabel(item.kategori)}
                                  </span>

                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                      isLelang
                                        ? "border-amber-300/20 bg-amber-400/10 text-amber-200"
                                        : "border-sky-300/20 bg-sky-400/10 text-sky-200"
                                    }`}
                                  >
                                    {formatTransactionLabel(item.jenis_transaksi)}
                                  </span>
                                </div>

                                <p
                                  className="mt-2 line-clamp-2 text-[14px] font-semibold leading-6 text-white sm:text-[15px]"
                                  title={address}
                                >
                                  {address}
                                </p>

                                {locationBits.length > 0 ? (
                                  <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-slate-400">
                                    {locationBits.map((part, index) => (
                                      <span
                                        key={`${item.id_listing}-${part}-${index}`}
                                      >
                                        {index === 0 ? part : `• ${part}`}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="mt-3 text-[12px] sm:text-[13px]">
                                  {isLelang ? (
                                    <div>
                                      <span className="text-slate-500">
                                        Limit lelang:{" "}
                                      </span>
                                      <span className="font-semibold text-white">
                                        {formatCurrency(
                                          Number(item.nilai_limit_lelang ?? 0)
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-slate-500">
                                        Harga:{" "}
                                      </span>
                                      <span className="font-semibold text-white">
                                        {formatCurrency(Number(item.harga ?? 0))}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="hidden items-center sm:flex">
                                <span
                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-[14px] border transition ${
                                    active
                                      ? "border-white/20 bg-white/[0.08] text-white"
                                      : "border-white/10 bg-white/[0.04] text-slate-400 group-hover:border-white/15 group-hover:text-slate-200"
                                  }`}
                                >
                                  {active ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {hasMore ? (
                        <div ref={loadMoreRef} className="h-6 w-full" />
                      ) : null}

                      {listingLoading && listingResults.length > 0 ? (
                        <div className="flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Memuat property berikutnya...</span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                      Tidak ada listing yang cocok.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}