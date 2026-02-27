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

  agent_nama?: string | null;
  agent_kantor?: string | null;

  jenis_transaksi: "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";

  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;

  tanggal_lelang?: string | null;

  alamat_lengkap: string | null;

  provinsi: string | null;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;

  kategori: string;
  luas: number;

  luas_tanah?: number | null;
  luas_bangunan?: number | null;

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

/** Debounce value (object-safe) */
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function buildQueryString(filters: ListingFilterState, take = 30) {
  const sp = new URLSearchParams();

  // penting: masukkan hanya yang truthy dan stringified
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    sp.set(k, String(v));
  }

  sp.set("take", String(take));
  return sp.toString();
}

export default function PilihListingView() {
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

  const debounced = useDebounced(filters, 350);

  const queryString = useMemo(() => buildQueryString(debounced, 30), [debounced]);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedListing = useMemo(() => {
    if (!selectedId) return null;
    return listings.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, listings]);

  // ================
  // Fetch listings (ONLY fetch + setListings)
  // ================
  const listingsReqId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const reqId = ++listingsReqId.current;

    async function run() {
      setLoadingListings(true);
      try {
        const res = await fetch(`/api/dashboard/listings?${queryString}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Failed fetch listings");
        }

        const json = await res.json();
        const rows = (json.data ?? []) as ListingRow[];

        // pastiin request terbaru yang menang
        if (!cancelled && reqId === listingsReqId.current) {
          setListings(rows);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast.error("Gagal memuat listing", { description: e?.message });
          setListings([]); // biar UI konsisten
        }
      } finally {
        if (!cancelled && reqId === listingsReqId.current) {
          setLoadingListings(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  // ================
  // Reconcile selection when listings change (NO FETCH HERE)
  // ================
  useEffect(() => {
    if (listings.length === 0) {
      // kalau listing kosong, selected di-reset
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    // kalau belum ada selected, pilih pertama
    if (!selectedId) {
      setSelectedId(listings[0].id);
      return;
    }

    // kalau selectedId sudah tidak ada di results, pindah ke first
    const exists = listings.some((x) => x.id === selectedId);
    if (!exists) setSelectedId(listings[0].id);
  }, [listings, selectedId]);

  // ================
  // Fetch activities (once)
  // ================
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadingActivities(true);
      try {
        const res = await fetch(`/api/dashboard/transaksi/activities?take=12`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Failed fetch activities");
        }

        const json = await res.json();
        if (!cancelled) setActivities(json.data ?? []);
      } catch (e: any) {
        if (!cancelled) toast.error("Gagal memuat riwayat transaksi", { description: e?.message });
      } finally {
        if (!cancelled) setLoadingActivities(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* ✅ FULL-BLEED FILTER BAR */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
        <div className="px-4 md:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <ListingFilters
              value={filters}
              onChange={setFilters}
              total={listings.length}
              loading={loadingListings}
            />
          </div>
        </div>
      </div>

      {/* ✅ BELOW: normal centered workspace */}
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <ListingList
              rows={listings}
              loading={loadingListings}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="md:col-span-8">
            <RightPanel
              selectedListing={selectedListing as any}
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
    </div>
  );
}