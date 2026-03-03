"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { ListingRow } from "./PilihListingView";
import { Badge } from "./ui";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function safeText(s?: string | null) {
  return (s ?? "").trim();
}

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop stop-color='#070b0a' offset='0'/>
        <stop stop-color='#0f1714' offset='1'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <path d='M52 176l44-50 32 36 24-26 52 60H52z' fill='#1d2a24'/>
    <circle cx='94' cy='92' r='18' fill='#1d2a24'/>
  </svg>
`);

function buildLocation(item: ListingRow) {
  const full = safeText((item as any).alamat_lengkap);
  if (full) return full;

  const parts = [(item as any).kelurahan, (item as any).kecamatan, (item as any).kota, (item as any).provinsi]
    .map((x) => safeText(x))
    .filter(Boolean);

  return parts.join(", ") || safeText((item as any).kota) || "-";
}

function sortPrice(item: ListingRow) {
  const base =
    item.jenis_transaksi === "LELANG"
      ? item.nilai_limit_lelang ?? item.harga
      : item.harga_promo && item.harga_promo > 0
      ? item.harga_promo
      : item.harga;

  return Number(base ?? 0);
}

function idNum(id: string) {
  const n = Number(String(id).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type SortKey = "TERBARU" | "TERMURAH" | "TERMAHAL" | "LOKASI_AZ" | "LOKASI_ZA" | "LELANG_DULU";

const SORT_LABEL: Record<SortKey, string> = {
  TERBARU: "Terbaru",
  TERMURAH: "Paling murah",
  TERMAHAL: "Paling mahal",
  LOKASI_AZ: "Lokasi A–Z",
  LOKASI_ZA: "Lokasi Z–A",
  LELANG_DULU: "Prioritas lelang",
};

export default function ListingList({
  rows,
  loading,
  selectedId,
  onSelect,
  hasMore = false,
  onLoadMore,
}: {
  rows: ListingRow[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("TERBARU");

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      switch (sort) {
        case "TERMURAH":
          return sortPrice(a) - sortPrice(b);
        case "TERMAHAL":
          return sortPrice(b) - sortPrice(a);
        case "LOKASI_AZ":
          return buildLocation(a).toLowerCase().localeCompare(buildLocation(b).toLowerCase());
        case "LOKASI_ZA":
          return buildLocation(b).toLowerCase().localeCompare(buildLocation(a).toLowerCase());
        case "LELANG_DULU": {
          const pa = a.jenis_transaksi === "LELANG" ? 0 : 1;
          const pb = b.jenis_transaksi === "LELANG" ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return idNum(String(b.id)) - idNum(String(a.id));
        }
        case "TERBARU":
        default:
          return idNum(String(b.id)) - idNum(String(a.id));
      }
    });
    return arr;
  }, [rows, sort]);

  return (
    <div
      className={cx(
        "h-[calc(100vh-220px)] overflow-hidden rounded-3xl border",
        "border-zinc-800 bg-zinc-950/35",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
        "flex flex-col"
      )}
    >
      {/* ✨ Futuristic top glow */}
      <div className="pointer-events-none absolute hidden" />

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/75 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white">Daftar Listing</div>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-xs font-semibold text-zinc-200">
                {loading ? "…" : `${rows.length}`}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Klik listing untuk lihat detail di kanan.
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 px-2 py-2">
              <Icon icon="solar:sort-linear" className="text-base text-zinc-300" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer bg-transparent text-xs font-semibold text-zinc-100 outline-none"
              >
                {Object.entries(SORT_LABEL).map(([k, v]) => (
                  <option key={k} value={k} className="bg-zinc-950 text-zinc-100">
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content (scroll area) */}
      <div className="flex-1 overflow-y-auto p-3 pb-[max(4rem,env(safe-area-inset-bottom))]">
        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-zinc-800 bg-zinc-950/30 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 rounded-3xl bg-zinc-900/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 rounded bg-zinc-900/60" />
                    <div className="h-3 w-64 rounded bg-zinc-900/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950/40 text-emerald-300">
              <Icon icon="solar:magnifer-linear" className="text-2xl" />
            </div>
            <div className="text-sm font-semibold text-white">Tidak ada listing</div>
            <p className="mt-1 text-xs text-zinc-400">Coba ubah filter/search.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((item) => {
              const isSelected = selectedId === item.id;
              const loc = buildLocation(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cx(
                    "group w-full rounded-3xl border p-3 text-left transition",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                    isSelected
                      ? "border-emerald-600/40 bg-emerald-500/[0.06] shadow-[0_0_0_1px_rgba(16,185,129,0.16)]"
                      : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumb */}
                    <div
                      className={cx(
                        "relative h-16 w-16 overflow-hidden rounded-3xl border bg-zinc-900/40",
                        isSelected ? "border-emerald-700/50" : "border-zinc-800"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={(item as any).imageUrl || FALLBACK_IMG}
                        alt={(item as any).judul}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (img.dataset.fallbackApplied === "1") return;
                          img.dataset.fallbackApplied = "1";
                          img.src = FALLBACK_IMG;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight text-white">{item.id}</span>
                        <Badge jenis={item.jenis_transaksi} />
                      </div>

                      <div className="mt-2 flex items-start gap-2 text-sm text-zinc-200">
                        <Icon icon="solar:map-point-linear" className="mt-0.5 text-base text-emerald-300/90" />
                        <div className="min-w-0">
                          <div className="whitespace-normal break-words leading-snug">{loc}</div>
                          <div className="mt-0.5 text-[11px] text-zinc-500">Klik untuk lihat detail</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 shrink-0 text-zinc-500 transition group-hover:text-zinc-300">
                      <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="pt-2 text-[11px] text-zinc-500">
              Total tampil: <span className="text-zinc-300">{rows.length}</span>
            </div>

            {/* Load more inside scroll area (nice for non-technical users) */}
            {(hasMore || loading) && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onLoadMore?.()}
                  disabled={loading || !hasMore || !onLoadMore}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    "border-zinc-800 bg-zinc-950/40 text-zinc-100",
                    "hover:bg-zinc-900/40",
                    "disabled:opacity-50 disabled:hover:bg-zinc-950/40"
                  )}
                >
                  {loading ? "Memuat..." : hasMore ? "Muat lagi" : "Sudah semua"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer gradient so bottom content never feels cut */}
      <div className="pointer-events-none h-8 bg-gradient-to-t from-zinc-950/80 to-transparent" />
    </div>
  );
}