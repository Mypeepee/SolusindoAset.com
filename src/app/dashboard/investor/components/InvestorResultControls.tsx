"use client";

import { useState } from "react";
import {
  ArrowDownWideNarrow,
  BadgeCheck,
  CircleHelp,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import SearchSelect from "@/components/search/SearchSelect";
import type { DealFilters, DealSort, InvestorFeed } from "@/lib/investor-deals";

const SORTS: { value: DealSort; label: string; shortLabel?: string }[] = [
  { value: "score", label: "Paling worth-it" },
  {
    value: "spread",
    label: "Diskon kelurahan tertinggi",
    shortLabel: "Diskon kelurahan",
  },
  {
    value: "drop",
    label: "Penurunan lelang tertinggi",
    shortLabel: "Turun lelang",
  },
  { value: "price", label: "Harga/m² terendah" },
  { value: "auctionDate", label: "Jadwal lelang terdekat" },
];

/** Scope, status and sorting share one compact row with the Filter trigger. */
export default function InvestorResultControls({
  filters,
  data,
  loading,
  error,
  updateFilters,
  onRefresh,
}: {
  filters: DealFilters;
  data: InvestorFeed | null;
  loading: boolean;
  error: boolean;
  updateFilters: (patch: Partial<DealFilters>) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="investor-toolbar-select investor-toolbar-scope">
        <SearchSelect
          label="Cakupan listing"
          value={filters.dataState || "all"}
          icon={<BadgeCheck size={15} />}
          compact
          open={open === "scope"}
          onOpenChange={(value) => setOpen(value ? "scope" : null)}
          onChange={(value) =>
            updateFilters({ dataState: value as DealFilters["dataState"] })
          }
          options={[
            {
              value: "deals",
              label: "Worth-it",
              icon: <BadgeCheck size={15} />,
              id: "investor-scope-deals",
            },
            {
              value: "all",
              label: "Semua listing",
              shortLabel: "Semua",
              icon: <ListFilter size={15} />,
              id: "investor-scope-all",
            },
            {
              value: "unverified",
              label: `Perlu verifikasi${data ? ` (${data.summary.missingKelurahanCount || 0})` : ""}`,
              shortLabel: "Verifikasi",
              icon: <CircleHelp size={15} />,
              id: "investor-scope-unverified",
            },
          ]}
        />
      </div>
      <p
        className="investor-toolbar-count"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading
          ? "Memuat…"
          : data
            ? `${data.total.toLocaleString("id-ID")} properti${filters.savedOnly ? " tersimpan" : ""}`
            : error
              ? "Data belum dimuat"
              : "—"}
      </p>
      <div className="investor-toolbar-select investor-toolbar-sort">
        <SearchSelect
          label="Urutkan peluang"
          value={filters.sort}
          icon={<ArrowDownWideNarrow size={16} />}
          compact
          open={open === "sort"}
          onOpenChange={(value) => setOpen(value ? "sort" : null)}
          onChange={(value) => updateFilters({ sort: value as DealSort })}
          options={SORTS.filter(
            (item) =>
              filters.transactionType !== "SEWA" ||
              (item.value !== "drop" && item.value !== "auctionDate"),
          ).map((item) => ({ ...item, id: `investor-sort-${item.value}` }))}
        />
      </div>
      <button
        type="button"
        className="investor-toolbar-refresh"
        aria-label="Perbarui data Investor"
        title="Perbarui data Investor"
        disabled={loading}
        aria-busy={loading}
        onClick={onRefresh}
      >
        <RefreshCw
          size={16}
          className={loading ? "animate-spin motion-reduce:animate-none" : ""}
        />
      </button>
    </>
  );
}
