// src/app/dashboard/components/transaksi/RightPanel.tsx
"use client";

import { Icon } from "@iconify/react";
import ActivityFeed from "./ActivityFeed";
import {
  Badge,
  PriceCell,
  GlassCard,
  CardHeader,
  InfoRow,
  StatChip,
  formatDateID,
  formatM2,
} from "./ui";
import type { ActivityRow, ListingRow } from "./PilihListingView";

function safeText(s?: string | null) {
  return (s ?? "").trim();
}

function buildAddress(l: ListingRow | null) {
  if (!l) return "-";
  const full = safeText((l as any).alamat_lengkap);
  if (full) return full;

  const parts = [l.kelurahan, l.kecamatan, l.kota, l.provinsi]
    .map((x) => safeText(x))
    .filter(Boolean);

  return parts.join(", ") || safeText(l.kota) || "-";
}

function isExternalProxy(url: string) {
  return url?.startsWith("/api/img?url=") || url?.startsWith("http");
}

export default function RightPanel({
  selectedListing,
  activities,
  loadingActivities,
  onClosing,
  onClear,
}: {
  selectedListing: ListingRow | null;
  activities: ActivityRow[];
  loadingActivities: boolean;
  onClosing: (listingId: string) => void;
  onClear: () => void;
}) {
  const addressLine = buildAddress(selectedListing);

  const isLelang = selectedListing?.jenis_transaksi === "LELANG";

  // === sesuai request kamu:
  // LELANG => vendor, tanggal lelang, luas tanah
  // NON-LELANG => luas tanah, luas bangunan, agent
  const vendor = safeText(selectedListing?.vendor);
  const tglLelang = (selectedListing as any)?.tanggal_lelang ?? null;

  const luasTanah = (selectedListing as any)?.luas_tanah ?? null;
  const luasBangunan = (selectedListing as any)?.luas_bangunan ?? null;

  const agentNama = safeText((selectedListing as any)?.agent_nama);
  const agentKantor = safeText((selectedListing as any)?.agent_kantor);

  return (
    <div className="space-y-4">
      <GlassCard>
        <CardHeader
          title="Detail"
          subtitle="Ringkas • fokus info penting"
          icon="solar:widget-linear"
          right={
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-900/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              onClick={onClear}
            >
              <Icon icon="solar:close-circle-linear" className="text-base" />
              Clear
            </button>
          }
        />

        {!selectedListing ? (
          <div className="p-5">
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950/40 text-emerald-300">
                <Icon icon="solar:cursor-square-linear" className="text-2xl" />
              </div>
              <div className="text-sm font-semibold text-white">Pilih listing</div>
              <p className="mt-1 text-xs text-zinc-400">
                Klik listing di kiri untuk melihat detail dan lanjutkan closing.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Top compact row */}
            <div className="flex items-start gap-4">
              {/* image */}
              <div className="relative h-20 w-24 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedListing.imageUrl}
                  alt={selectedListing.id}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.onerror = null;
                    img.src =
                      "data:image/svg+xml;charset=utf-8," +
                      encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#0b0f0e"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">No Image</text></svg>`
                      );
                  }}
                />
                {/* micro glow */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/45 via-transparent to-transparent" />
              </div>

              {/* title + chips */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-white">{selectedListing.id}</div>
                  <Badge jenis={selectedListing.jenis_transaksi} compact />
                  {selectedListing.kota ? (
                    <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
                      {selectedListing.kota}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-sm font-semibold text-white">
                  {safeText((selectedListing as any).alamat_lengkap) || safeText(selectedListing.judul) || "-"}
                </div>

                <div className="mt-2">
                  <PriceCell
                    jenis={selectedListing.jenis_transaksi}
                    harga={selectedListing.harga}
                    harga_promo={selectedListing.harga_promo}
                    nilai_limit_lelang={selectedListing.nilai_limit_lelang}
                    size="md"
                    showLabel
                  />
                </div>
              </div>
            </div>

            {/* Address (always) */}
            <div className="mt-4">
              <InfoRow
                icon="solar:map-point-linear"
                label="Alamat"
                value={addressLine}
              />
            </div>

            {/* IMPORTANT BLOCK (your rules) */}
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {isLelang ? (
                  <>
                    <StatChip
                      icon="solar:buildings-3-linear"
                      label="Vendor"
                      value={vendor || "-"}
                    />
                    <StatChip
                      icon="solar:calendar-linear"
                      label="Tanggal lelang"
                      value={formatDateID(tglLelang)}
                    />
                    <StatChip
                      icon="solar:ruler-linear"
                      label="Luas tanah"
                      value={formatM2(luasTanah)}
                    />
                  </>
                ) : (
                  <>
                    <StatChip
                      icon="solar:ruler-linear"
                      label="Luas tanah"
                      value={formatM2(luasTanah)}
                    />
                    <StatChip
                      icon="solar:buildings-2-linear"
                      label="Luas bangunan"
                      value={formatM2(luasBangunan)}
                    />
                    <StatChip
                      icon="solar:user-rounded-linear"
                      label="Agent"
                      value={
                        agentNama
                          ? `${agentNama}${agentKantor ? ` • ${agentKantor}` : ""}`
                          : "-"
                      }
                    />
                  </>
                )}
              </div>
            </div>

            {/* Primary action */}
            <div className="mt-5">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                onClick={() => onClosing(selectedListing.id)}
              >
                <Icon icon="solar:check-circle-linear" className="text-lg" />
                Closing
              </button>

              <div className="mt-2 text-[11px] text-zinc-500">
                Fokus: verifikasi data → komunikasi klien → pipeline deal.
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Activity feed (button riwayat sudah dihapus, feed tetap ada) */}
      <ActivityFeed rows={activities} loading={loadingActivities} onPick={() => {}} />
    </div>
  );
}