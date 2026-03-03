"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ListingFilters, { ListingFilterState } from "./ListingFilters";
import ListingList from "./ListingList";
import RightPanel from "./RightPanel";
import { toast } from "sonner";

export type ListingRow = {
  id: string;
  judul: string;
  vendor: string | null;

  agent_nama: string | null;
  agent_kantor: string | null;

  jenis_transaksi: "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";
  kategori: string;

  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;

  tanggal_lelang?: string | null;

  alamat_lengkap: string | null;
  provinsi: string | null;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;

  luas_tanah: number | null;
  luas_bangunan: number | null;

  imageUrl: string;
  status_tayang?: string;
};

export type ActivityRow = {
  id: string;
  kode: string;
  status: string;
  date: string;
  price: number;
  listingId: string;
  addressShort: string;
  imageUrl: string;
  title: string;
};

function useDebouncedValue<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildListingQuery(filters: ListingFilterState) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  return sp.toString();
}

export default function PilihListingView() {
  const TAKE = 30;

  const [filters, setFilters] = useState<ListingFilterState>({
    q: "",
    jenis: "ALL",
    vendor: "",
    minHarga: "",
    maxHarga: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kelurahan: "",
  });

  // query primitive -> stable
  const queryString = useMemo(() => buildListingQuery(filters), [filters]);
  const debouncedQuery = useDebouncedValue(queryString, 350);

  // pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedListing = useMemo(() => {
    if (!selectedId) return null;
    return listings.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, listings]);

  // sentinel to auto-load when reaching bottom
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setSelectedId(null);
    setListings([]);
  }, [debouncedQuery]);

  // fetch listings (append)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function run() {
      // stop if no more
      if (!hasMore && page !== 1) return;

      setLoadingListings(true);
      try {
        const url = `/api/dashboard/listings?${debouncedQuery}&page=${page}&take=${TAKE}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });

        const text = await res.text();
        const json = safeJsonParse(text);

        if (!res.ok) throw new Error(json?.error || json?.details || text || "Failed fetch listings");

        const rows = (json?.data ?? []) as ListingRow[];

        if (!active) return;

        setListings((prev) => {
          // page 1 -> replace
          const next = page === 1 ? rows : [...prev, ...rows];

          // dedupe by id
          const map = new Map<string, ListingRow>();
          for (const r of next) map.set(String(r.id), { ...r, id: String(r.id) });
          return Array.from(map.values());
        });

        // hasMore based on returned rows length
        setHasMore(rows.length === TAKE);

        // select first if none
        setSelectedId((prev) => {
          if (prev && (page === 1 ? rows : listings).some((r) => r.id === prev)) return prev;
          const first = (page === 1 ? rows : null)?.[0];
          return first ? first.id : prev; // keep if already selected
        });
      } catch (e: any) {
        if (controller.signal.aborted) return;
        if (active) toast.error("Gagal memuat listing", { description: e?.message });
      } finally {
        if (active) setLoadingListings(false);
      }
    }

    run();
    return () => {
      active = false;
      controller.abort();
    };
    // IMPORTANT: do NOT depend on "listings" here, to avoid loops
  }, [debouncedQuery, page, hasMore]);

  // auto-load next page when sentinel visible
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (loadingListings) return;
        if (!hasMore) return;
        setPage((p) => p + 1);
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [loadingListings, hasMore]);

  // activities (once)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function run() {
      setLoadingActivities(true);
      try {
        const res = await fetch(`/api/dashboard/transaksi/activities?take=12`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const text = await res.text();
        const json = safeJsonParse(text);

        if (!res.ok) throw new Error(json?.error || json?.details || text || "Failed fetch activities");

        if (active) setActivities((json?.data ?? []) as ActivityRow[]);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        if (active) toast.error("Gagal memuat riwayat transaksi", { description: e?.message });
      } finally {
        if (active) setLoadingActivities(false);
      }
    }

    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // ✅ layout: filter bar full width on top, list left, detail right
  return (
    <div className="space-y-4">
      {/* Top Filter Bar (full width look) */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 backdrop-blur-xl px-4 py-4">
        <ListingFilters
          value={filters}
          onChange={setFilters}
          total={listings.length}
          loading={loadingListings && page === 1}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-3">
          <ListingList
            rows={listings}
            loading={loadingListings && page === 1}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {/* sentinel: do not remove */}
          <div ref={loadMoreRef} className="h-1 w-full" />
          {loadingListings && page > 1 && (
            <div className="text-center text-xs text-zinc-400">Memuat data berikutnya…</div>
          )}
          {!hasMore && listings.length > 0 && (
            <div className="text-center text-xs text-zinc-500">Sudah semua.</div>
          )}
        </div>

        <div className="lg:col-span-8">
          <RightPanel
            selectedListing={selectedListing}
            activities={activities}
            loadingActivities={loadingActivities}
            onPickActivity={(listingId) => setSelectedId(listingId)}
            onClosing={(id) =>
              toast.success("Masuk flow closing", {
                description: `Listing ${id} siap diproses.`,
              })
            }
            onClear={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}