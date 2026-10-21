"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { BERITA_KATEGORI } from "@/lib/beritaUi";
import type { WorkspaceData, Filters } from "./workspace";
import styles from "./workspace.module.css";

const TABS = [
  { value: "", label: "Semua" },
  { value: "PUBLISHED", label: "Terbit" },
  { value: "DRAFT", label: "Draf" },
  { value: "SCHEDULED", label: "Terjadwal" },
  { value: "ARCHIVED", label: "Arsip" },
];

export default function FilterBar({
  filters,
  onChange,
  data,
  view,
  onView,
  reset,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  data?: WorkspaceData;
  view: "list" | "grid";
  onView: (view: "list" | "grid") => void;
  reset: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, []);
  const activeFilters = [
    filters.kategori,
    filters.penulis,
    filters.from || filters.to,
    filters.review,
  ].filter(Boolean).length;
  return (
    <div className={styles.filterBar}>
      <div className={styles.tabRow} role="tablist" aria-label="Status berita">
        {TABS.map((tab, index) => (
          <button
            type="button"
            id={`berita-tab-${tab.value || "all"}`}
            key={tab.value}
            role="tab"
            aria-selected={filters.status === tab.value}
            aria-controls="berita-results"
            tabIndex={filters.status === tab.value ? 0 : -1}
            className={`${styles.tab} ${filters.status === tab.value ? styles.tabActive : ""}`}
            onClick={() => onChange({ status: tab.value, review: "" })}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? TABS.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        TABS.length) %
                      TABS.length;
              onChange({ status: TABS[next].value, review: "" });
              document
                .getElementById(`berita-tab-${TABS[next].value || "all"}`)
                ?.focus();
            }}
          >
            {tab.label}
            <span>
              {data
                ? (tab.value
                    ? data.statusCounts[
                        tab.value as keyof typeof data.statusCounts
                      ] || 0
                    : Object.values(data.statusCounts).reduce(
                        (sum, count) => sum + (count || 0),
                        0,
                      )
                  ).toLocaleString("id-ID")
                : "—"}
            </span>
          </button>
        ))}
        <span className={styles.tabSpacer} />
        <span className={styles.collectionLabel}>KOLEKSI ARTIKEL</span>
      </div>
      <div className={styles.controls}>
        <div className={styles.search}>
          <Search size={16} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Cari artikel berdasarkan judul, kategori, atau penulis"
            placeholder="Cari judul, kategori, atau penulis…"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
          />
          <kbd>{shortcut}</kbd>
        </div>
        <div className={styles.selectWrap}>
          <select
            aria-label="Filter kategori"
            value={filters.kategori}
            onChange={(event) => onChange({ kategori: event.target.value })}
          >
            <option value="">Semua kategori</option>
            {BERITA_KATEGORI.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="advanced-berita-filters"
          className={`${styles.secondaryButton} ${activeFilters || expanded ? styles.filterActive : ""}`}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={15} /> Filter{" "}
          {activeFilters > 0 && (
            <span className={styles.filterCount}>{activeFilters}</span>
          )}
        </button>
        <div
          className={styles.viewToggle}
          role="group"
          aria-label="Tampilan artikel"
        >
          <button
            type="button"
            aria-label="Tampilan daftar"
            aria-pressed={view === "list"}
            onClick={() => onView("list")}
          >
            <List size={17} />
          </button>
          <button
            type="button"
            aria-label="Tampilan grid"
            aria-pressed={view === "grid"}
            onClick={() => onView("grid")}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className={styles.advancedFilters} id="advanced-berita-filters">
          <label>
            Penulis
            <select
              value={filters.penulis}
              onChange={(event) => onChange({ penulis: event.target.value })}
            >
              <option value="">Semua penulis</option>
              {data?.authors.map((author) => (
                <option key={author}>{author}</option>
              ))}
            </select>
          </label>
          <label>
            <span>
              <CalendarDays size={12} /> Dibuat mulai (WIB)
            </span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => onChange({ from: event.target.value })}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => onChange({ to: event.target.value })}
            />
          </label>
          <label>
            Review
            <select
              value={filters.review}
              onChange={(event) =>
                onChange({
                  review: event.target.value,
                  status: event.target.value ? "DRAFT" : filters.status,
                })
              }
            >
              <option value="">Semua artikel</option>
              <option value="true">Menunggu review</option>
            </select>
          </label>
        </div>
      )}
      {(activeFilters > 0 || filters.q) && (
        <div className={styles.activeFilters}>
          <span>Filter aktif</span>
          {filters.kategori && (
            <button onClick={() => onChange({ kategori: "" })}>
              {filters.kategori}
              <X size={11} />
            </button>
          )}
          {filters.penulis && (
            <button onClick={() => onChange({ penulis: "" })}>
              {filters.penulis}
              <X size={11} />
            </button>
          )}
          {(filters.from || filters.to) && (
            <button onClick={() => onChange({ from: "", to: "" })}>
              {filters.from || "Awal"} — {filters.to || "Hari ini"}
              <X size={11} />
            </button>
          )}
          {filters.review && (
            <button onClick={() => onChange({ review: "" })}>
              Menunggu review
              <X size={11} />
            </button>
          )}
          <button className={styles.resetFilters} onClick={reset}>
            Reset semua
          </button>
        </div>
      )}
    </div>
  );
}
