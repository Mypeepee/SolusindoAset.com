"use client";

import { useMemo, useState } from "react";
import { Building2, MapPinned, Ruler, ShieldCheck } from "lucide-react";
import type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "../../types";
import {
  formatCategoryLabel,
  formatTransactionLabel,
  normalizeImageUrl,
} from "../../utils";

type Props = {
  selectedListing: ListingOption | null;
  form: CreateProjectFormValues;
  theme: ModalTierTheme;
  hargaPembelianComputed: number;
  profitComputed: number;
  roiPercent: number;
};

function formatArea(value?: number | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "-";

  return (
    new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    }).format(numeric) + " m²"
  );
}

function formatLegalitas(value?: string | null) {
  if (!value) return "-";

  return value
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryImage(
  listing: ListingOption | null,
  fallback?: string | null
): string {
  return normalizeImageUrl(
    listing?.gambar_thumbnail || listing?.gambar || fallback || ""
  );
}

export default function SummaryPanel({
  selectedListing,
  form,
  theme,
}: Props) {
  const ThemeIcon = theme.icon;
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = useMemo(
    () => getPrimaryImage(selectedListing, form.gambar_thumbnail),
    [selectedListing, form.gambar_thumbnail]
  );

  const alamatLengkap =
    selectedListing?.alamat_lengkap ||
    selectedListing?.alamat_property ||
    form.alamat_property?.trim() ||
    "Belum ada property yang dipilih";

  const lokasiLengkap = [
    selectedListing?.kelurahan || form.kelurahan || "",
    selectedListing?.kecamatan || form.kecamatan || "",
    selectedListing?.kota || form.kota || "",
    selectedListing?.provinsi || form.provinsi || "",
  ].filter(Boolean);

  const isLelang = selectedListing?.jenis_transaksi === "LELANG";

  const detailItems = [
    {
      key: "luas_tanah",
      label: "Luas Tanah",
      value: formatArea(selectedListing?.luas_tanah),
      icon: Ruler,
    },
    ...(!isLelang
      ? [
          {
            key: "luas_bangunan",
            label: "Luas Bangunan",
            value: formatArea(selectedListing?.luas_bangunan),
            icon: Ruler,
          },
        ]
      : []),
    {
      key: "legalitas",
      label: "Legalitas",
      value: formatLegalitas(selectedListing?.legalitas),
      icon: ShieldCheck,
    },
  ];

  return (
    <aside className="min-w-0">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,22,33,0.96),rgba(24,33,47,0.88)_45%,rgba(14,21,31,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-4 xl:sticky xl:top-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(96,165,250,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[27px] border border-white/[0.04]" />

        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <ThemeIcon className="h-4 w-4 text-white" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                Preview Property
              </p>
              <p className="text-xs text-slate-400">
                Ringkasan aset terpilih.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
              <div className="relative h-[150px] w-full overflow-hidden bg-black/20">
                {imageUrl && !imageFailed ? (
                  <img
                    src={imageUrl}
                    alt={alamatLengkap}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-slate-500">
                    <Building2 className="h-7 w-7" />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,18,0.02),rgba(5,10,18,0.14)_48%,rgba(5,10,18,0.60)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedListing ? (
                      <>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          {formatCategoryLabel(selectedListing.kategori)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          {formatTransactionLabel(selectedListing.jenis_transaksi)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                          ID #{form.id_listing || selectedListing.id_listing}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                        Belum dipilih
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
              <div className="flex items-start gap-2">
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.17em] text-slate-500">
                    Alamat Lengkap
                  </p>
                  <p className="mt-2 break-words text-[14px] font-semibold leading-7 text-white">
                    {alamatLengkap}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.17em] text-slate-500">
                Lokasi
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {lokasiLengkap.length > 0 ? (
                  lokasiLengkap.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">
                    Lokasi belum tersedia.
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-black/10 p-3">
              <div className="grid gap-2">
                {detailItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.025] px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04]">
                          <Icon className="h-4 w-4 text-slate-400" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}