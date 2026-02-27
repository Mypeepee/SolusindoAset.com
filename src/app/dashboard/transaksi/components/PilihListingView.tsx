"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ListingFilters, { ListingFilterState } from "./ListingFilters";
import ListingList from "./ListingList";
import RightPanel from "./RightPanel";
import { toast } from "sonner";

export type ListingRow = {
  id: string; // id_property string
  judul: string;

  vendor: string | null;

  agent_nama: string | null;
  agent_kantor: string | null;

  jenis_transaksi: "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";
  kategori: string;

  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;

  alamat_lengkap: string | null;
  provinsi: string | null;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;

  luas_tanah: number | null;
  luas_bangunan: number | null;

  imageUrl: string; // raw url dari API (sudah first image)
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

/** Debounce primitive (string) -> paling stabil untuk dependency effect */
function useDebouncedValue<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function proxifyImage(url: string) {
  const u = (url || "").trim();
  if (!u) return "/images/listing/placeholder.jpg";
  if (u.startsWith("http://") || u.startsWith("https://")) {
    return `/api/img?url=${encodeURIComponent(u)}`;
  }
  return u; // local / relative
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Build query string from filter state (only include non-empty values) */
function buildListingQuery(filters: ListingFilterState, take = 30) {
  const sp = new URLSearchParams();

  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined) continue;

    // semua filter kamu string/enum -> aman
    const s = String(v).trim();
    if (!s) continue;

    sp.set(k, s);
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

  /**
   * ✅ Kunci stabil:
   * - ubah filters -> queryString (memo)
   * - debounce queryString (primitive)
   * - effect fetch bergantung ke debouncedQuery (primitive)
   */
  const queryString = useMemo(() => buildListingQuery(filters, 30), [filters]);
  const debouncedQuery = useDebouncedValue(queryString, 350);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // prevent race conditions
  const listingsReqId = useRef(0);

  const selectedListing = useMemo(() => {
    if (!selectedId) return null;
    return listings.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, listings]);

  // =========================
  // ✅ Fetch listings (stable)
  // =========================
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const reqId = ++listingsReqId.current;

    async function run() {
      setLoadingListings(true);

      try {
        const res = await fetch(`/api/dashboard/listings?${debouncedQuery}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const text = await res.text();
        const json = safeJsonParse(text);

        if (!res.ok) {
          const msg =
            json?.error ||
            json?.details ||
            (typeof text === "string" ? text.slice(0, 160) : "") ||
            "Failed fetch listings";
          throw new Error(msg);
        }

        // ignore stale response
        if (!active || reqId !== listingsReqId.current) return;

        const rowsRaw = (json?.data ?? []) as ListingRow[];

        // normalize images so list & detail consistent
        const rows: ListingRow[] = rowsRaw.map((x) => ({
          ...x,
          id: String(x.id), // harden
          imageUrl: proxifyImage(x.imageUrl),
        }));

        setListings(rows);

        // ✅ smart auto-select (functional update avoids stale closure)
        setSelectedId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows.length ? rows[0].id : null;
        });
      } catch (e: any) {
        if (controller.signal.aborted) return;

        if (active) {
          toast.error("Gagal memuat listing", { description: e?.message });
          setListings([]); // reset supaya UI gak nahan data lama
          setSelectedId(null);
        }
      } finally {
        if (active) setLoadingListings(false);
      }
    }

    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  // =========================
  // ✅ Fetch activities (once)
  // =========================
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
          const msg =
            json?.error ||
            json?.details ||
            (typeof text === "string" ? text.slice(0, 160) : "") ||
            "Failed fetch activities";
          throw new Error(msg);
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* LEFT (1/3): filters + list */}
      <aside className="space-y-4 lg:col-span-4">
        <div className="space-y-4 lg:sticky lg:top-20">
          <ListingFilters
            value={filters}
            onChange={setFilters}
            total={listings.length}
            loading={loadingListings}
          />

          <ListingList
            rows={listings}
            loading={loadingListings}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </aside>

      {/* RIGHT (2/3): detail + activity */}
      <main className="space-y-4 lg:col-span-8">
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

        <div className="hidden rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-xs text-zinc-400 lg:block">
          Tip: gunakan <span className="font-semibold text-zinc-200">Search</span> untuk alamat/vendor,
          dan <span className="font-semibold text-emerald-300">Sort</span> untuk cari listing paling murah /
          prioritas lelang.
        </div>
      </main>
    </div>
  );
}