"use client";

import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { MapPin, RefreshCw } from "lucide-react";
import { formatCompactRupiah, type DealViewItem } from "@/lib/investor-deals";
import type { DealActions } from "./PropertyDealCard";
import "leaflet/dist/leaflet.css";

type Deals = DealViewItem[];
function MapBounds({ deals }: { deals: Deals }) {
  const map = useMap();
  useEffect(() => {
    const points = deals.flatMap(({ listing }) =>
      listing.coordinates
        ? [
            [listing.coordinates.latitude, listing.coordinates.longitude] as [
              number,
              number,
            ],
          ]
        : [],
    );
    if (points.length)
      map.fitBounds(latLngBounds(points), {
        padding: [65, 65],
        maxZoom: 14,
        animate: false,
      });
    map.invalidateSize();
  }, [deals, map]);
  return null;
}

export default function DealMap({
  deals,
  onView,
}: { deals: Deals } & Pick<DealActions, "onView">) {
  const [tileFailed, setTileFailed] = useState(false);
  const [tileKey, setTileKey] = useState(0);
  const pins = useMemo(
    () =>
      deals.filter(
        ({ listing }) =>
          listing.coordinates &&
          Number.isFinite(listing.coordinates.latitude) &&
          Math.abs(listing.coordinates.latitude) <= 90 &&
          Number.isFinite(listing.coordinates.longitude) &&
          Math.abs(listing.coordinates.longitude) <= 180,
      ),
    [deals],
  );
  return (
    <div className="investor-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-300">
        <span className="flex items-center gap-2">
          <MapPin size={14} className="text-emerald-300" />
          {pins.length} properti di peta
        </span>
        <span className="text-slate-400">
          Koordinat dari listing · Pilih harga untuk detail
        </span>
      </div>
      <div
        className="investor-map relative h-[480px]"
        onMouseDownCapture={(event) => {
          // Leaflet 1.9 preserves window scrolling when it focuses the map,
          // but this dashboard scrolls inside a panel. Avoid moving the panel
          // between pointer-down and pointer-up, which can swallow marker clicks.
          event.currentTarget
            .querySelector<HTMLElement>(".leaflet-container")
            ?.focus({ preventScroll: true });
        }}
      >
        <MapContainer
          center={[-7.28, 112.73]}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
          aria-label="Peta peluang investasi"
        >
          <TileLayer
            key={tileKey}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileFailed(true) }}
          />
          <MapBounds deals={pins} />
          {pins.map(({ listing }) => (
            <Marker
              key={listing.id}
              position={[
                listing.coordinates!.latitude,
                listing.coordinates!.longitude,
              ]}
              title={`${listing.title}, ${formatCompactRupiah(listing.currentAuctionPrice)}`}
              alt={listing.title}
              riseOnHover
              eventHandlers={{
                click: () => onView(listing),
                keydown: (event) => {
                  if (
                    event.originalEvent.key === "Enter" ||
                    event.originalEvent.key === " "
                  ) {
                    event.originalEvent.preventDefault();
                    onView(listing);
                  }
                },
              }}
              icon={divIcon({
                className: "investor-map-pin",
                html: `<span>${formatCompactRupiah(listing.currentAuctionPrice)}</span>`,
                iconSize: [106, 32],
                iconAnchor: [53, 16],
              })}
            />
          ))}
        </MapContainer>
        {tileFailed && (
          <div
            role="status"
            className="absolute bottom-8 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/20 bg-slate-950/95 p-3 text-xs text-amber-100"
          >
            <span>
              Peta dasar belum dapat dimuat. Marker properti tetap tersedia.
            </span>
            <button
              type="button"
              className="investor-button"
              onClick={() => {
                setTileFailed(false);
                setTileKey((key) => key + 1);
              }}
            >
              <RefreshCw size={12} />
              Coba lagi
            </button>
          </div>
        )}
      </div>
      {pins.length < deals.length && (
        <p className="px-4 py-3 text-xs text-amber-200">
          {deals.length - pins.length} properti belum memiliki koordinat. Buka
          tampilan kartu atau tabel untuk melihatnya.
        </p>
      )}
    </div>
  );
}
