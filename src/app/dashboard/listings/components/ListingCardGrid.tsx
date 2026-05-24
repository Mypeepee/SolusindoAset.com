"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import PropertyCard from "@/app/properti/[slug]/components/PropertyCard";
import ListingFilters, {
  ListingFilterState,
} from "@/app/dashboard/transaksi/components/ListingFilters";
import type { Listing } from "./listings-table";
import type { PropertyItem } from "@/app/properti/[slug]/types";

const PAGE_SIZE = 12;

const formatViews = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n || 0);

function toPropertyItem(l: Listing): PropertyItem {
  return {
    id_property: l.id,
    slug: l.rawSlug,
    judul: l.title,
    kota: l.city,
    harga: l.priceRaw,
    harga_promo: l.pricePromo,
    jenis_transaksi: l.transactionType,
    kategori: l.category,
    gambar: l.thumbnailUrl || "/images/hero/banner.jpg",
    foto_list: l.photos,
    luas_tanah: l.luasTanah,
    luas_bangunan: l.luasBangunan,
    kamar_tidur: l.kamarTidur,
    kamar_mandi: l.kamarMandi,
    tanggal_lelang: l.tanggalLelang,
    agent_name: l.agentName,
    agent_photo: l.agentPhoto,
    agent_office: l.agentOffice,
  };
}

function clean(s: string) {
  return s.trim().toLowerCase();
}

interface ListingCardGridProps {
  listings: Listing[];
  currentAgentId?: string | null;
}

const INITIAL_FILTERS: ListingFilterState = {
  q: "",
  vendor: "",
  jenis: "ALL",
  kategori: "ALL",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kelurahan: "",
};

export default function ListingCardGrid({
  listings,
  currentAgentId,
}: ListingCardGridProps) {
  const [filters, setFilters] = useState<ListingFilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── client-side filter ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return listings.filter((item) => {
      const q = clean(filters.q);
      if (
        q &&
        !clean(item.title).includes(q) &&
        !clean(item.address).includes(q) &&
        !item.id.includes(q)
      )
        return false;

      if (
        filters.jenis !== "ALL" &&
        item.transactionType.toUpperCase() !== filters.jenis
      )
        return false;

      if (
        filters.kategori !== "ALL" &&
        item.category.toUpperCase() !== filters.kategori
      )
        return false;

      const locQuery = clean(
        filters.kelurahan ||
          filters.kecamatan ||
          filters.kota ||
          filters.provinsi
      );
      if (locQuery) {
        const haystack = clean(
          `${item.address} ${item.city} ${item.area} ${item.provinsi} ${item.kecamatan} ${item.kelurahan}`
        );
        if (!haystack.includes(locQuery)) return false;
      }

      return true;
    });
  }, [listings, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterChange = (next: ListingFilterState) => {
    setFilters(next);
    setPage(1);
  };

  // ── selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const visibleIds = paginated.map((l) => l.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Hapus ${selectedIds.length} listing?`)) return;
    setSelectedIds([]);
    window.location.reload();
  };

  // ── pagination pages to show ───────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    )
      pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-5">
      {/* ── Filter bar ── */}
      <ListingFilters
        value={filters}
        onChange={handleFilterChange}
        total={filtered.length}
        hideVendor
      />

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0 accent-emerald-400 cursor-pointer"
            />
            <span>Pilih semua</span>
          </label>
          <span className="text-zinc-600">|</span>
          <span>
            <span className="text-emerald-400 font-semibold">
              {filtered.length}
            </span>{" "}
            listing
            {selectedIds.length > 0 && (
              <span className="ml-1.5 text-zinc-500">
                · {selectedIds.length} dipilih
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon="solar:trash-bin-minimalistic-linear" className="text-xs" />
            Hapus terpilih ({selectedIds.length})
          </button>

          <Link
            href="/tambah-property"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-1.5 text-[11px] font-bold text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all hover:border-emerald-300 hover:bg-emerald-500/25 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="text-sm text-emerald-300" />
            Tambah property
          </Link>
        </div>
      </div>

      {/* ── Grid ── */}
      {paginated.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-y-2 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {paginated.map((listing) => {
            const isSelected = selectedIds.includes(listing.id);
            const editUrl = `/tambah-property?id=${listing.id}&mode=edit`;

            return (
              <div key={listing.id} className="flex flex-col">

                {/* ── PropertyCard (completely unchanged) ── */}
                <div className={`relative z-10 transition-all duration-200 ${
                  isSelected
                    ? "drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]"
                    : ""
                }`}>
                  <PropertyCard item={toPropertyItem(listing)} />
                </div>

                {/* ── Action bar — slides under card's rounded bottom ── */}
                <div
                  className={`-mt-4 flex items-center justify-between rounded-b-2xl border-x border-b px-4 pb-3 pt-6 transition-all duration-200 ${
                    isSelected
                      ? "border-emerald-400/40 bg-[#020d08]"
                      : "border-white/8 bg-zinc-950/95"
                  }`}
                >
                  {/* Left: checkbox + divider + views */}
                  <div className="flex items-center gap-3">
                    {/* Custom checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(listing.id)}
                      aria-label={isSelected ? "Batalkan pilih" : "Pilih listing"}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                          : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 10" fill="none" className="h-2.5 w-2.5 shrink-0">
                          <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <div className="h-3 w-px bg-white/10" />

                    {/* Views */}
                    <div className="flex items-center gap-1.5">
                      <Icon
                        icon="solar:eye-bold-duotone"
                        className="text-sm text-sky-400/80"
                      />
                      <span className="text-xs font-semibold text-zinc-300">
                        {formatViews(listing.views)}
                      </span>
                    </div>

                    {/* ID — hidden on small screens */}
                    <span className="hidden font-mono text-[10px] text-zinc-600 sm:block">
                      #{listing.id}
                    </span>
                  </div>

                  {/* Right: Edit button */}
                  <Link
                    href={editUrl}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all duration-150 ${
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                        : "border-white/12 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon icon="solar:pen-new-square-linear" className="text-xs" />
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <nav
          className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between"
          aria-label="Pagination"
        >
          <span className="text-[11px] text-zinc-500">
            Halaman{" "}
            <span className="font-semibold text-zinc-200">{currentPage}</span>{" "}
            dari{" "}
            <span className="font-semibold text-zinc-200">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-sm" />
            </button>

            {pageNumbers.map((n, i) =>
              n === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-xs text-zinc-500"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(Number(n))}
                  className={`h-8 min-w-[2rem] rounded-full px-2 text-xs font-bold transition-all ${
                    n === currentPage
                      ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {n}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-sm" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-24 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(52,211,153,0.08)]">
        <Icon
          icon="solar:buildings-bold-duotone"
          className="text-4xl text-white/20"
        />
      </div>
      <h3 className="mb-2 text-base font-bold text-white/40">
        Tidak ada listing ditemukan
      </h3>
      <p className="mb-8 text-sm text-white/20">
        Coba ubah filter atau tambah listing baru
      </p>
      <Link
        href="/tambah-property"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-6 py-2.5 text-sm font-bold text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-500/25"
      >
        <Icon icon="solar:add-circle-bold-duotone" className="text-base" />
        Tambah Property
      </Link>
    </div>
  );
}
