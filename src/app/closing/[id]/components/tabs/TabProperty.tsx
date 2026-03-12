"use client";

import { useEffect, useMemo, useState } from "react";
import type { Listing } from "../../page";
import SectionCard from "../ui/SectionCard";
import Field from "../ui/Field";
import { CalendarDays, Hash, Landmark, Sparkles } from "lucide-react";

function safe(s: any) {
  const v = (s ?? "").toString().trim();
  return v || "-";
}

function formatIDR(n: any) {
  if (n === null || n === undefined) return "-";
  const num = typeof n === "number" ? n : Number(n?.toString?.() ?? n);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(d?: any) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
}

function GlowBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "active";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border backdrop-blur-xl";
  const styles =
    tone === "active"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
      : "border-white/10 bg-white/5 text-zinc-200";
  return <span className={`${base} ${styles}`}>{children}</span>;
}

function MiniChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] text-zinc-400">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-white">{value}</div>
    </div>
  );
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="relative rounded-[26px] border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="h-7 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-white/10 animate-pulse" />
      </div>

      <div className="mt-4 flex gap-4">
        <div className="h-20 w-20 rounded-2xl bg-white/10 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-44 rounded bg-white/10 animate-pulse" />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
            <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
            <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />
          </div>
          <div className="mt-3 h-4 w-40 rounded bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function TimelineNode({ active }: { active: boolean }) {
  return (
    <div className="relative grid place-items-center">
      <span
        className={[
          "h-3.5 w-3.5 rounded-full border",
          active
            ? "border-emerald-300/50 bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.9)]"
            : "border-white/15 bg-zinc-700",
        ].join(" ")}
      />
      {active ? (
        <span className="absolute h-9 w-9 rounded-full bg-emerald-400/12 blur-xl" />
      ) : null}
    </div>
  );
}

function AuctionCard({
  idx,
  row,
  isCurrent,
}: {
  idx: number;
  row: any;
  isCurrent: boolean;
}) {
  const date = row.tanggal_lelang ?? row.tanggal_dibuat;
  const thumb = row.imageUrl || "/placeholder.jpg";

  return (
    <div className="relative">
      {/* rail + node */}
      <div className="absolute left-0 top-0 bottom-0 hidden sm:flex w-10 justify-center">
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="sticky top-4 pt-6">
            <TimelineNode active={isCurrent} />
          </div>
        </div>
      </div>

      <div
        className={[
          "group relative overflow-hidden rounded-[26px] border backdrop-blur-xl",
          "bg-gradient-to-br from-white/7 via-white/5 to-white/3",
          "shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
          "transition hover:-translate-y-[1px] hover:border-white/15",
          isCurrent ? "border-emerald-400/25" : "border-white/10",
          "sm:ml-10",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
        <div
          className={[
            "pointer-events-none absolute -top-20 -right-24 h-72 w-72 rounded-full blur-3xl",
            isCurrent ? "bg-emerald-400/12" : "bg-white/6",
          ].join(" ")}
        />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <GlowBadge tone={isCurrent ? "active" : "default"}>
              <Landmark className="h-3.5 w-3.5" />
              Lelang ke-{idx + 1}
              {isCurrent ? " • Current" : ""}
            </GlowBadge>

            <div className="inline-flex items-center gap-1 text-xs text-zinc-400">
              <Hash className="h-3.5 w-3.5" />
              <span className="text-zinc-500">ID:</span>
              <span className="font-semibold text-zinc-200">
                {String(row.id_property)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb}
                alt={`Lelang ke-${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <CalendarDays className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-400">Tanggal:</span>
                <span className="font-semibold text-white">
                  {formatDate(date)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StatBlock label="Harga limit" value={formatIDR(row.nilai_limit_lelang)} />
                <StatBlock label="Uang jaminan" value={formatIDR(row.uang_jaminan)} />
                <StatBlock label="CO PIC" value={safe(row.agent_nama)} />
              </div>

              <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TabProperty({ listing }: { listing: Listing }) {
  const address =
    safe(listing.alamat_lengkap) !== "-"
      ? safe(listing.alamat_lengkap)
      : [listing.kelurahan, listing.kecamatan, listing.kota, listing.provinsi]
          .map(safe)
          .filter((x) => x !== "-")
          .join(", ") || listing.kota;

  const isLelang = listing.jenis_transaksi === "LELANG";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let active = true;

    async function run() {
      if (!isLelang) return;

      setLoading(true);
      setErrMsg("");

      try {
        const url = `/api/closing/listing/${listing.id_property}/auction-history`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Fetch failed");

        if (!active) return;
        setRows(Array.isArray(json?.rows) ? json.rows : []);
      } catch (e: any) {
        if (!active) return;
        setErrMsg(String(e?.message ?? e));
        setRows([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [isLelang, listing.id_property]);

  const displayRows = useMemo(() => rows ?? [], [rows]);

  const currentIndex = useMemo(() => {
    const i = displayRows.findIndex(
      (r) => String(r.id_property) === String(listing.id_property)
    );
    return i >= 0 ? i + 1 : null;
  }, [displayRows, listing.id_property]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* LEFT */}
      <div className="lg:col-span-7 space-y-4">
        {isLelang ? (
          <SectionCard
            title="Riwayat Lelang"
            subtitle="History lelang untuk aset yang sama (urut dari paling awal)"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <MiniChip label="Total lelang" value={String(displayRows.length || 0)} />
              <MiniChip
                label="Posisi current"
                value={currentIndex ? `Lelang ke-${currentIndex}` : "-"}
              />
              <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-zinc-400">
                <Sparkles className="h-4 w-4 text-emerald-300/80" />
                <span>Timeline view</span>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : errMsg ? (
              <div className="rounded-[26px] border border-red-500/20 bg-red-500/10 p-5">
                <div className="text-sm font-semibold text-red-200">
                  Gagal ambil riwayat lelang
                </div>
                <div className="mt-1 text-xs text-red-200/70 break-words">
                  {errMsg}
                </div>
              </div>
            ) : displayRows.length <= 1 ? (
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-sm font-semibold text-white">
                  Belum ada riwayat lelang lain untuk properti ini.
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  Kalau nanti ada listing lelang lain dengan aset yang sama, otomatis muncul di sini.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {displayRows.map((row, idx) => (
                  <AuctionCard
                    key={String(row.id_property)}
                    idx={idx}
                    row={row}
                    isCurrent={
                      String(row.id_property) === String(listing.id_property)
                    }
                  />
                ))}
              </div>
            )}
          </SectionCard>
        ) : (
          <>
            <SectionCard title="Identitas properti" subtitle="Informasi inti untuk closing">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ID Property" value={String(listing.id_property)} />
                <Field label="Judul" value={safe(listing.judul)} />
                <Field label="Jenis transaksi" value={safe(listing.jenis_transaksi)} />
                <Field label="Status tayang" value={safe(listing.status_tayang)} />
                <Field label="Vendor" value={safe(listing.vendor)} />
                <Field label="Alamat" value={address} full />
              </div>
            </SectionCard>

            <SectionCard title="Spesifikasi" subtitle="Luas & detail fisik">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Luas tanah"
                  value={safe(listing.luas_tanah) !== "-" ? `${safe(listing.luas_tanah)} m²` : "-"}
                />
                <Field
                  label="Luas bangunan"
                  value={safe(listing.luas_bangunan) !== "-" ? `${safe(listing.luas_bangunan)} m²` : "-"}
                />
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* RIGHT */}
      <div className="lg:col-span-5 space-y-4">
        <SectionCard title="Ringkasan Properti" subtitle="Info cepat untuk verifikasi">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ID Property" value={String(listing.id_property)} />
              <Field label="Jenis transaksi" value={safe(listing.jenis_transaksi)} />
            </div>

            <Field label="Judul" value={safe(listing.judul)} full />
            <Field label="Alamat" value={address} full />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kota" value={safe(listing.kota)} />
              <Field label="Provinsi" value={safe(listing.provinsi)} />
              <Field label="Kecamatan" value={safe(listing.kecamatan)} />
              <Field label="Kelurahan" value={safe(listing.kelurahan)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Luas tanah"
                value={safe(listing.luas_tanah) !== "-" ? `${safe(listing.luas_tanah)} m²` : "-"}
              />
              <Field
                label="Luas bangunan"
                value={safe(listing.luas_bangunan) !== "-" ? `${safe(listing.luas_bangunan)} m²` : "-"}
              />
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}