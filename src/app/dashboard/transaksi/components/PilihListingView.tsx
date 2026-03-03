"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import ListingFilters, { ListingFilterState } from "./ListingFilters";
import ListingList from "./ListingList";
import RightPanel from "./RightPanel";
import MobileDetailSheet from "./MobileDetailSheet";
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

function useIsDesktopLG() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)"); // tailwind lg
    const apply = () => setIsDesktop(mq.matches);
    apply();

    if (mq.addEventListener) {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // @ts-ignore
      mq.addListener(apply);
      // @ts-ignore
      return () => mq.removeListener(apply);
    }
  }, []);

  return isDesktop;
}

export default function PilihListingView() {
  const router = useRouter(); // ✅ ADD
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

  const queryString = useMemo(() => buildListingQuery(filters), [filters]);
  const debouncedQuery = useDebouncedValue(queryString, 350);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sheet only for <lg
  const isDesktop = useIsDesktopLG();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedListing = useMemo(() => {
    if (!selectedId) return null;
    return listings.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, listings]);

  // ✅ Tutup sheet otomatis begitu masuk desktop
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // reset pagination ketika filter berubah
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setSelectedId(null);
    setListings([]);
    setMobileOpen(false);
  }, [debouncedQuery]);

  // fetch listings (append)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function run() {
      if (!hasMore && page !== 1) return;

      setLoadingListings(true);
      try {
        const url = `/api/dashboard/listings?${debouncedQuery}&page=${page}&take=${TAKE}`;
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        const text = await res.text();
        const json = safeJsonParse(text);

        if (!res.ok) {
          throw new Error(json?.error || json?.details || text || "Failed fetch listings");
        }

        const rows = (json?.data ?? []) as ListingRow[];
        if (!active) return;

        setListings((prev) => {
          const next = page === 1 ? rows : [...prev, ...rows];

          // dedupe by id
          const map = new Map<string, ListingRow>();
          for (const r of next) map.set(String(r.id), { ...r, id: String(r.id) });
          return Array.from(map.values());
        });

        setHasMore(rows.length === TAKE);

        // Auto-select first on page 1
        setSelectedId((prev) => {
          if (prev && (page === 1 ? rows : listings).some((r) => r.id === prev)) return prev;
          const first = (page === 1 ? rows : null)?.[0];
          return first ? first.id : prev;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, page, hasMore]);

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

        if (!res.ok) {
          throw new Error(json?.error || json?.details || text || "Failed fetch activities");
        }

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

  // select handler (desktop: just select, mobile/tablet: open sheet)
  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!isDesktop) setMobileOpen(true);
  };

  const handleLoadMore = () => {
    if (loadingListings) return;
    if (!hasMore) return;
    setPage((p) => p + 1);
  };

  // ✅ INI KUNCINYA: tombol Closing -> pindah halaman /closing/[id]
  const handleClosing = (id: string) => {
    if (!id) return;

    // kalau lagi di mobile sheet, tutup dulu biar state rapi
    if (!isDesktop) setMobileOpen(false);

    // optional notif
    toast.success("Masuk halaman closing", { description: `Listing ${id}` });

    // navigate
    router.push(`/closing/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
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
            onSelect={handleSelect}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />

          {loadingListings && page > 1 && (
            <div className="text-center text-xs text-zinc-400">Memuat data berikutnya…</div>
          )}
          {!hasMore && listings.length > 0 && (
            <div className="text-center text-xs text-zinc-500">Sudah semua.</div>
          )}
        </div>

        {/* Desktop: RightPanel normal */}
        <div className="lg:col-span-8 hidden lg:block">
          <RightPanel
            selectedListing={selectedListing}
            activities={activities}
            loadingActivities={loadingActivities}
            onClosing={handleClosing} // ✅ connect
            onClear={() => setSelectedId(null)}
          />
        </div>
      </div>

      {/* Mobile/Tablet: sheet */}
      <div className="lg:hidden">
        <MobileDetailSheet
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          title={selectedListing ? `Listing ${selectedListing.id}` : "Detail"}
          subtitle={
            selectedListing
              ? `${selectedListing.jenis_transaksi} • ${selectedListing.kota || "-"}`
              : undefined
          }
          actions={
            selectedListing ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                onClick={() => handleClosing(selectedListing.id)} // ✅ connect
              >
                <Icon icon="solar:check-circle-linear" className="text-lg" />
                Closing
              </button>
            ) : null
          }
        >
          {/* ✅ hide tombol Closing bawaan RightPanel di mode sheet */}
          <div className="[&_.bg-emerald-600.w-full]:hidden">
            <RightPanel
              selectedListing={selectedListing}
              activities={activities}
              loadingActivities={loadingActivities}
              onClosing={handleClosing} // ✅ connect
              onClear={() => {
                setSelectedId(null);
                setMobileOpen(false);
              }}
            />
          </div>
        </MobileDetailSheet>
      </div>
    </div>
  );
}