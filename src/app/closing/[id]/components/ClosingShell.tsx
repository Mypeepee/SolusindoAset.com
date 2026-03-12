"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ClosingTabs from "./ClosingTabs.client";
import type { Listing, Agent, TeamLeader } from "../page";
import Money from "./ui/Money";
import { Icon } from "@iconify/react";

function safe(s?: string | null) {
  return (s ?? "").trim();
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function transaksiLabel(j: Listing["jenis_transaksi"]) {
  const map: Record<Listing["jenis_transaksi"], string> = {
    PRIMARY: "Primary",
    SECONDARY: "Secondary",
    LELANG: "Lelang",
    SEWA: "Sewa",
  };
  return map[j] ?? j;
}

/**
 * ✅ Robust image URL picker
 * Supports:
 * - listing.imageUrl (preferred)
 * - comma-separated URL string: "url1,url2,..."
 * - direct URL string
 * - JSON string array: ["url1", ...] or [{url:"..."}, ...]
 * - array directly
 * - object {url:"..."} or {src:"..."}
 */
function pickFirstImageUrl(gambar: any): string | null {
  const asUrlFromItem = (it: any): string | null => {
    if (!it) return null;
    if (typeof it === "string") return safe(it) || null;
    if (typeof it === "object") {
      const u = safe(it.url ?? it.src ?? it.imageUrl ?? it.href);
      return u || null;
    }
    return null;
  };

  if (!gambar) return null;

  // array directly
  if (Array.isArray(gambar)) {
    return asUrlFromItem(gambar[0]);
  }

  // object directly
  if (typeof gambar === "object") {
    return asUrlFromItem(gambar);
  }

  // string
  const raw = safe(String(gambar));
  if (!raw) return null;

  // ✅ FIX UTAMA: comma-separated URL => ambil url pertama
  if (raw.includes(",")) {
    const first = safe(raw.split(",")[0]);
    return first || null;
  }

  // try parse JSON string
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return asUrlFromItem(parsed[0]);
    if (parsed && typeof parsed === "object") return asUrlFromItem(parsed);
  } catch {
    // ignore
  }

  // direct url
  return raw;
}

type Skema = "PERSENTASE" | "SELISIH";

function skemaLabel(k: Skema) {
  return k === "PERSENTASE" ? "Persentase Komisi" : "Selisih Harga";
}

function skemaDesc(k: Skema) {
  return k === "PERSENTASE"
    ? "Hitung komisi berdasarkan persentase dari harga deal/closing."
    : "Hitung komisi dari selisih harga jual vs harga limit/acuannya.";
}

export default function ClosingShell({
  listing,
  agent,
  leader,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
}) {
  const city = safe(listing.kota) || "-";
  const jenis = transaksiLabel(listing.jenis_transaksi);

  const alamat = safe((listing as any).alamat_lengkap) || "-";
  const judul = safe(listing.judul) || "Detail Closing";

  // NOTE: schema agent kamu tidak punya field "nama"
  // jadi pakai nama_lengkap dari pengguna (kalau ada)
  const agentName =
    safe((agent as any)?.pengguna?.nama_lengkap) ||
    safe((agent as any)?.nama_kantor) ||
    "-";

  const leaderName =
    safe((leader as any)?.pengguna?.nama_lengkap) ||
    safe((leader as any)?.nama_kantor) ||
    "-";

  const priceMain = listing.harga_promo ?? listing.harga;
  const hasPromo = !!listing.harga_promo && Number(listing.harga_promo) > 0;

  // ✅ Prioritas: listing.imageUrl (kalau API sudah kasih), kalau tidak ambil dari gambar
  const imgUrl =
    safe((listing as any).imageUrl) ||
    pickFirstImageUrl((listing as any).gambar);

  const isLelang = listing.jenis_transaksi === "LELANG";
  const skemaOptions: Skema[] = useMemo(
    () => (isLelang ? ["PERSENTASE", "SELISIH"] : ["PERSENTASE"]),
    [isLelang]
  );

  const [skema, setSkema] = useState<Skema>(skemaOptions[0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSkema(skemaOptions[0]);
    setOpen(false);
  }, [skemaOptions]);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 360,
  });

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: Math.round(r.bottom + 10),
      left: Math.round(r.left),
      width: Math.round(r.width),
    });
  };

  useEffect(() => {
    if (!open) return;
    computePos();

    const onResize = () => computePos();
    const onScroll = () => computePos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const copyId = async () => {
    try {
      await navigator.clipboard?.writeText(String(listing.id_property));
    } catch {
      // no-op
    }
  };

  return (
    <div className="relative">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute -top-40 left-[-220px] h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -top-44 right-[-240px] h-[620px] w-[620px] rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[20%] h-[520px] w-[520px] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/55" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Icon icon="solar:home-2-linear" className="text-sm" />
                Dashboard
              </span>
              <span className="text-zinc-600">/</span>
              <span className="truncate">Closing</span>
              <span className="text-zinc-600">/</span>
              <span className="font-semibold text-zinc-200 truncate">
                #{Number(listing.id_property)}
              </span>
            </div>

            <div className="mt-1 text-[11px] text-zinc-500">
              Input dari kiri ke kanan:{" "}
              <span className="text-zinc-300">Transaksi</span> →{" "}
              <span className="text-zinc-300">Pembagian</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyId}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 active:scale-[0.99] transition"
            >
              <Icon icon="solar:copy-linear" className="text-base" />
              Copy ID
            </button>

            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 active:scale-[0.99] transition"
            >
              <Icon icon="solar:arrow-left-linear" className="text-base" />
              Kembali
            </a>
          </div>
        </div>

        {/* HERO CARD */}
        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="h-[3px] w-full rounded-t-[28px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

          <div className="p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-12">
              {/* LEFT */}
              <div className="lg:col-span-8 min-w-0">
                <div className="flex gap-4">
                  {/* ✅ image */}
                  <div className="relative h-[92px] w-[124px] sm:h-[104px] sm:w-[140px] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/30">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt={alamat || judul}
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
                    ) : (
                      <div className="grid h-full w-full place-items-center text-zinc-400">
                        <Icon icon="solar:gallery-linear" className="text-2xl" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent" />
                  </div>

                  {/* text */}
                  <div className="min-w-0 flex-1">
                    {/* chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/90 shadow-[0_0_10px_rgba(16,185,129,0.85)]" />
                        Ready for Closing
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                        <Icon icon="solar:tag-linear" className="text-sm" />
                        {jenis}
                      </span>
                    </div>

                    <div className="mt-3 text-[18px] sm:text-[22px] font-semibold leading-snug text-white">
                      {alamat !== "-" ? alamat : (
                        <span className="text-zinc-400">Alamat belum tersedia</span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-zinc-400 truncate">{judul}</div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-2">
                        <Icon icon="solar:user-rounded-linear" className="text-sm" />
                        Agent:{" "}
                        <span className="text-zinc-200 font-semibold">{agentName}</span>
                      </span>
                      <span className="hidden sm:inline text-zinc-600">•</span>
                      <span className="inline-flex items-center gap-2">
                        <Icon icon="solar:users-group-rounded-linear" className="text-sm" />
                        TL:{" "}
                        <span className="text-zinc-200 font-semibold">{leaderName}</span>
                      </span>
                    </div>

                    {/* dropdown pill */}
                    <div className="mt-4 max-w-[560px]">
                      <div className="text-[11px] text-zinc-400 mb-1">
                        Skema Penjualan
                      </div>

                      <button
                        ref={btnRef}
                        type="button"
                        onClick={() => {
                          if (skemaOptions.length === 1) return;
                          setOpen((v) => !v);
                        }}
                        className={[
                          "group relative flex w-full items-center justify-between rounded-full border px-4 py-2 text-sm font-semibold",
                          "border-emerald-400/25 bg-gradient-to-r from-emerald-500/12 via-white/5 to-cyan-500/12 text-white",
                          "backdrop-blur-xl transition hover:border-emerald-300/45",
                          "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
                          skemaOptions.length === 1 ? "cursor-default" : "cursor-pointer",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.85)]" />
                          <span className="text-zinc-200">Skema:</span>
                          <span className="text-white">{skemaLabel(skema)}</span>
                        </div>

                        {skemaOptions.length > 1 ? (
                          <Icon
                            icon="solar:alt-arrow-down-linear"
                            className={[
                              "text-lg text-zinc-300 transition-transform",
                              open ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        ) : (
                          <span className="text-[11px] text-zinc-400">default</span>
                        )}
                      </button>
                    </div>

                    {open &&
                      typeof document !== "undefined" &&
                      createPortal(
                        <div className="fixed inset-0 z-[9999]">
                          <button
                            type="button"
                            className="absolute inset-0 cursor-default"
                            onClick={() => setOpen(false)}
                            aria-label="Close dropdown"
                          />

                          <div
                            className="absolute"
                            style={{
                              top: pos.top,
                              left: pos.left,
                              width: pos.width,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/92 shadow-[0_28px_90px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
                              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                                <div className="text-[12px] text-zinc-300">
                                  Pilih skema yang dipakai untuk closing
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpen(false)}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-zinc-100 hover:bg-white/10 transition"
                                >
                                  Tutup
                                </button>
                              </div>

                              <div className="p-2">
                                {skemaOptions.map((k) => {
                                  const active = k === skema;
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => {
                                        setSkema(k);
                                        setOpen(false);
                                      }}
                                      className={[
                                        "w-full rounded-2xl px-3 py-3 text-left transition",
                                        active
                                          ? "bg-gradient-to-r from-emerald-500/18 via-emerald-500/10 to-cyan-500/12 border border-emerald-400/20"
                                          : "hover:bg-white/5 border border-transparent",
                                      ].join(" ")}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={[
                                            "mt-1.5 h-2.5 w-2.5 rounded-full",
                                            active
                                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.95)]"
                                              : "bg-zinc-600",
                                          ].join(" ")}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div
                                            className={[
                                              "flex items-center justify-between gap-3",
                                              active ? "text-emerald-100" : "text-zinc-100",
                                            ].join(" ")}
                                          >
                                            <div className="text-base font-semibold">
                                              {skemaLabel(k)}
                                            </div>
                                            {active ? (
                                              <Icon
                                                icon="solar:check-circle-linear"
                                                className="text-2xl text-emerald-200"
                                              />
                                            ) : null}
                                          </div>
                                          <div className="mt-1 text-[12px] text-zinc-400">
                                            {skemaDesc(k)}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="lg:col-span-4">
                <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/15 bg-gradient-to-br from-emerald-500/12 via-white/5 to-cyan-500/10 p-4 sm:p-5">
                  <div className="pointer-events-none absolute -top-16 -right-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
                  <div className="pointer-events-none absolute inset-0 bg-zinc-950/20" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-zinc-300/80">Harga acuan</div>
                        <div className="mt-1 text-2xl font-semibold text-white tracking-tight">
                          <Money value={priceMain} />
                        </div>
                        {hasPromo ? (
                          <div className="mt-1 text-xs text-zinc-300/70">
                            Harga normal:{" "}
                            <span className="line-through">
                              <Money value={listing.harga} />
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/5 h-11 w-11 text-emerald-100">
                        <Icon icon="solar:wallet-money-linear" className="text-2xl" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                        <div className="text-[11px] text-zinc-300/70">Transaksi</div>
                        <div className="mt-1 text-sm font-semibold text-white truncate">
                          {jenis}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                        <div className="text-[11px] text-zinc-300/70">Lokasi</div>
                        <div className="mt-1 text-sm font-semibold text-white truncate">
                          {toTitleCase(city)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-5">
          <ClosingTabs listing={listing} agent={agent} leader={leader} skemaPenjualan={skema} />
        </div>
      </div>
    </div>
  );
}