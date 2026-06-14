"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

/* ────────────────────────────────────────────────────────────────────
   ListingPerformanceCard — "Performa Listing"
   Premium right-side companion to the annual sales chart. Surfaces:
   • Top Performers — listings dengan engagement tertinggi (views,
     WhatsApp click, leads, hot deal flag).
   • Butuh Perhatian — listings stagnant (umur >30 hari & tidak ada
     lead baru >21 hari) — kandidat repricing / boost.
   Designed in the same dark-glass + emerald accent language as the
   rest of the dashboard. Wired to /api/dashboard/agent/listing-performance.
   ──────────────────────────────────────────────────────────────────── */

interface ListingPerf {
  id_property: string;
  slug: string;
  id_agent: string;
  judul: string;
  kota: string;
  kecamatan: string | null;
  alamat_lengkap: string | null;
  gambar: string | null;
  harga: number;
  jenis_transaksi: string;
  kategori: string;
  kategori_label: string;
  status_tayang: string;
  luas_tanah: number;
  luas_bangunan: number;
  views: number;
  wa_clicks: number;
  lead_count: number;
  is_hot_deal: boolean;
  days_active: number;
  last_lead_days_ago: number | null;
  score: number;
  velocity: number;
}

interface ApiResp {
  ok: boolean;
  totalActive: number;
  totalHot: number;
  topPerformers: ListingPerf[];
  needsAttention: ListingPerf[];
}

type Tab = "top" | "attention";

function compactPrice(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function compactNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("id-ID");
}

function locationLabel(l: ListingPerf): string {
  if (l.kecamatan) return `${l.kecamatan}, ${l.kota}`;
  return l.kota;
}

/** Alamat utama untuk baris judul kartu. Fallback berlapis supaya tidak
 *  pernah tampil string kosong: alamat lengkap > kecamatan+kota > kota >
 *  judul listing. */
function primaryAddress(l: ListingPerf): string {
  if (l.alamat_lengkap && l.alamat_lengkap.trim()) return l.alamat_lengkap.trim();
  if (l.kecamatan && l.kota) return `${l.kecamatan}, ${l.kota}`;
  return l.kota || l.judul;
}

function formatLuas(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  // Bulatkan ke integer supaya rapi di chip kecil.
  return `${Math.round(n).toLocaleString("id-ID")} m²`;
}

/** "Rumah · 120 m² · di Surabaya" — subtitle ringkas yang dirakit dari
 *  bagian-bagian yang tersedia saja, supaya tidak ada separator nyangkut
 *  kalau salah satunya kosong. */
function propertyMeta(l: ListingPerf): string {
  const parts: string[] = [];
  if (l.kategori_label) parts.push(l.kategori_label);
  const luas = formatLuas(l.luas_tanah);
  if (luas) parts.push(luas);
  if (l.kota) parts.push(`di ${l.kota}`);
  return parts.join(" · ");
}

/** Insight per baris — beda nada per tab. Untuk "top" kita arahkan ke
 *  follow-up (lead nyangkut perlu dikejar / momentum view sedang naik);
 *  untuk "attention" kita kasih saran konkret repricing / boost. */
type RowInsight = {
  icon: string;
  text: string;
  tone: "emerald" | "amber" | "sky";
};

function topInsight(l: ListingPerf): RowInsight {
  // Prioritas 1: lead yang menunggu — paling deket ke closing
  if (l.lead_count > 0) {
    return {
      icon: "solar:phone-calling-bold-duotone",
      text:
        l.lead_count === 1
          ? "1 lead masuk — follow up sekarang"
          : `${l.lead_count} lead aktif — prioritaskan follow up`,
      tone: "emerald",
    };
  }
  // Prioritas 2: ada intent (WA click) tapi belum jadi lead
  if (l.wa_clicks > 0) {
    return {
      icon: "ic:baseline-whatsapp",
      text: `${l.wa_clicks} klik WhatsApp — buyer tertarik, sapa duluan`,
      tone: "emerald",
    };
  }
  // Prioritas 3: momentum views — pertahankan harga / boost iklan
  return {
    icon: "solar:eye-bold-duotone",
    text: `Momentum bagus — ${compactNum(l.views)} views, pertahankan harga`,
    tone: "sky",
  };
}

function attentionInsight(l: ListingPerf): RowInsight {
  const days = l.last_lead_days_ago ?? l.days_active;
  // Belum pernah ada lead sama sekali → perlu intervensi paling agresif
  if (l.lead_count === 0) {
    return {
      icon: "solar:tuning-square-bold-duotone",
      text: `Belum ada lead ${days}h — coba turunkan harga atau tandai Hot Deal`,
      tone: "amber",
    };
  }
  // Pernah ramai tapi sekarang sepi
  if (l.views >= 50) {
    return {
      icon: "solar:refresh-bold-duotone",
      text: `Sepi ${days}h padahal sempat ${compactNum(l.views)} views — refresh foto & repricing`,
      tone: "amber",
    };
  }
  return {
    icon: "solar:rocket-bold-duotone",
    text: `Stagnan ${days}h — pertimbangkan boost iklan atau Hot Deal`,
    tone: "amber",
  };
}

/** Gold / silver / bronze gradients for top-3 ranks; subtle for the rest. */
const RANK_STYLES: Record<number, { bg: string; text: string; glow: string; label: string }> = {
  1: {
    bg: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
    text: "text-amber-950",
    glow: "shadow-[0_4px_14px_-4px_rgba(245,158,11,0.7)]",
    label: "GOLD",
  },
  2: {
    bg: "linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%)",
    text: "text-slate-900",
    glow: "shadow-[0_4px_14px_-4px_rgba(148,163,184,0.6)]",
    label: "SILVER",
  },
  3: {
    bg: "linear-gradient(135deg, #fdba74 0%, #c2410c 100%)",
    text: "text-orange-50",
    glow: "shadow-[0_4px_14px_-4px_rgba(234,88,12,0.6)]",
    label: "BRONZE",
  },
};

const SUBTLE_RANK = {
  bg: "linear-gradient(135deg, rgba(148,163,184,0.18), rgba(71,85,105,0.25))",
  text: "text-slate-200",
  glow: "",
};

export function ListingPerformanceCard() {
  const router = useRouter();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("top");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/agent/listing-performance", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResp = await res.json();
        if (!alive) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo<ListingPerf[]>(() => {
    if (!data) return [];
    return tab === "top" ? data.topPerformers : data.needsAttention;
  }, [data, tab]);

  const goToListing = (l: ListingPerf) => {
    const jenis = l.jenis_transaksi?.toUpperCase();
    const slugId = `${l.slug}-${l.id_property}`;

    if (jenis === "SEWA") router.push(`/Sewa/${l.id_property}`);
    else if (jenis === "LELANG") router.push(`/Lelang/${slugId}/${l.id_agent}`);
    else router.push(`/Jual/${slugId}/${l.id_agent}`);
  };

  const goToAll = () => {
    router.push("/dashboard/listings");
  };

  return (
    <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b] lg:h-full lg:min-h-0">
      {/* top hairline */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      {/* ambient orb */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 65%)",
        }}
      />

      {/* ─── Header ─── */}
      <div className="relative flex items-start justify-between gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-sky-300/25 shadow-[0_10px_28px_-10px_rgba(56,189,248,0.6)]"
            style={{ background: "linear-gradient(135deg, #38bdf8, #0369a1)" }}
          >
            <Icon icon="solar:chart-square-bold-duotone" className="text-xl text-white drop-shadow" />
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent opacity-60" />
            <div className="pointer-events-none absolute inset-1 rounded-xl ring-1 ring-white/15" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold tracking-tight text-white">
              Performa Listing
            </h3>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">
              {loading
                ? "Memuat ranking…"
                : !data
                ? "Belum ada data"
                : tab === "top"
                ? `${data.totalActive} aktif · ${data.totalHot} engagement tinggi`
                : `${data.needsAttention.length} listing perlu di-boost`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={goToAll}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 transition hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-200"
        >
          Semua
          <Icon icon="solar:alt-arrow-right-bold" className="text-[10px]" />
        </button>
      </div>

      {/* ─── Purpose banner — jelaskan kegunaan card supaya agent tahu
              "kerjaan saya di sini ngapain" ─── */}
      <div className="relative mx-4 sm:mx-5 lg:mx-6 mb-2.5 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
        <Icon
          icon={
            tab === "top"
              ? "solar:target-bold-duotone"
              : "solar:lightbulb-bold-duotone"
          }
          className={`mt-px shrink-0 text-[14px] ${
            tab === "top" ? "text-emerald-300" : "text-amber-300"
          }`}
        />
        <p className="text-[10.5px] leading-snug text-slate-400">
          {tab === "top"
            ? "Properti dengan momentum tinggi — fokus follow-up di sini supaya peluang closing maksimal."
            : "Properti yang lambat closing — saran konkret di tiap kartu (repricing, Hot Deal, refresh foto) untuk dibangkitkan lagi."}
        </p>
      </div>

      {/* ─── Segmented tabs ─── */}
      <div className="relative mx-4 sm:mx-5 lg:mx-6 mb-3 inline-flex items-center overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-0.5 backdrop-blur-md">
        {[
          { key: "top" as const, label: "Top Perform", icon: "solar:cup-star-bold-duotone" },
          { key: "attention" as const, label: "Butuh Perhatian", icon: "solar:bell-bing-bold-duotone" },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                active
                  ? t.key === "top"
                    ? "bg-emerald-500/15 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_-4px_rgba(52,211,153,0.4)]"
                    : "bg-amber-500/15 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_-4px_rgba(251,191,36,0.4)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon
                icon={t.icon}
                className={`text-[13px] ${
                  active
                    ? t.key === "top"
                      ? "text-emerald-300"
                      : "text-amber-300"
                    : "text-slate-500"
                }`}
              />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── List ───
          Pakai pola "absolute inside relative flex-1" supaya konten list
          tidak ngalahin intrinsic Penjualan di grid row sizing. Outer
          `flex-1 min-h-0` ngambil sisa space di flex column tapi
          intrinsic-nya 0 (karena anak absolute keluar dari flow). Inner
          `absolute inset-0 overflow-y-auto` yang sebenarnya scroll +
          render konten list — dia ngisi 100% outer dan scroll kalau
          baris > tinggi available. Hasilnya: tinggi Listing dikendalikan
          oleh tinggi Penjualan, list scroll internal. */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 space-y-2 overflow-y-auto px-2.5 pb-4 sm:px-3 lg:px-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-2.5"
              >
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-white/[0.05]" />
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-white/[0.05]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                  <div className="h-2 w-2/3 animate-pulse rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10">
              <Icon icon="solar:danger-triangle-bold-duotone" className="text-2xl text-rose-300" />
            </div>
            <p className="mt-3 text-sm font-semibold text-rose-200">
              Gagal memuat performa
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Coba refresh halaman</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06]">
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-500/[0.08] blur-md" />
              <Icon
                icon={
                  tab === "top"
                    ? "solar:rocket-bold-duotone"
                    : "solar:check-circle-bold-duotone"
                }
                className="relative text-3xl text-emerald-300/80"
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">
              {tab === "top"
                ? "Belum ada listing yang trending"
                : "Semua listing sehat"}
            </p>
            <p className="mt-1 max-w-[240px] text-[11px] text-slate-500">
              {tab === "top"
                ? "Performa listing akan muncul setelah ada views, klik WA, atau leads masuk."
                : "Tidak ada listing yang stagnan. Pertahankan!"}
            </p>
          </div>
        ) : (
          rows.map((l, idx) => {
            const rank = idx + 1;
            const rankStyle = RANK_STYLES[rank] ?? SUBTLE_RANK;

            // Status badge
            const isStagnant = tab === "attention";
            const isHot = !isStagnant && (l.is_hot_deal || rank === 1);
            const stagnantDays =
              l.last_lead_days_ago === null ? l.days_active : l.last_lead_days_ago;

            return (
              <article
                key={l.id_property}
                role="button"
                tabIndex={0}
                onClick={() => goToListing(l)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToListing(l);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border outline-none backdrop-blur-sm transition hover:-translate-y-[1px] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                  isStagnant
                    ? "border-amber-400/20 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent"
                    : rank === 1
                    ? "border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent"
                    : "border-white/[0.06] bg-white/[0.015]"
                }`}
              >
                {/* Left accent bar */}
                <span
                  className={`absolute inset-y-0 left-0 w-[3px] ${
                    isStagnant
                      ? "bg-gradient-to-b from-amber-300 via-orange-500 to-rose-500"
                      : rank === 1
                      ? "bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700"
                      : rank === 2
                      ? "bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600"
                      : rank === 3
                      ? "bg-gradient-to-b from-orange-300 via-orange-500 to-orange-700"
                      : "bg-slate-700/60"
                  }`}
                />

                {/* Top-right corner badge */}
                {isHot && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-200 ring-1 ring-emerald-400/40">
                    <Icon
                      icon={l.is_hot_deal ? "solar:fire-bold" : "solar:cup-star-bold"}
                      className="text-[10px]"
                    />
                    {l.is_hot_deal ? "Hot Deal" : "Top"}
                  </span>
                )}

                {isStagnant && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-200 ring-1 ring-amber-400/40">
                    <Icon icon="solar:hourglass-line-bold-duotone" className="text-[10px]" />
                    {stagnantDays}d
                  </span>
                )}

                <div className="flex gap-2.5 p-2.5 pl-3 pr-3 sm:gap-3 sm:p-3 sm:pl-4 sm:pr-4">
                  {/* Rank pill */}
                  <div
                    className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-lg text-[11px] font-extrabold leading-none tabular-nums ${rankStyle.text} ${rankStyle.glow}`}
                    style={{ background: rankStyle.bg }}
                  >
                    <span className="relative z-10">#{rank}</span>
                    <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/35 to-transparent opacity-50" />
                  </div>

                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-white/[0.08] sm:h-16 sm:w-16">
                    {l.gambar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.gambar}
                        alt={primaryAddress(l)}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          // Sembunyikan <img> kalau gagal load (mis. Drive ID
                          // private / link lelang expired) supaya fallback
                          // icon di belakangnya yang kelihatan.
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : null}
                    {/* Fallback icon di belakang — selalu render, ke-cover sama
                        <img> kalau berhasil load. Hindari layout shift saat
                        gambar gagal. */}
                    <div className="absolute inset-0 -z-[1] grid place-items-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                      <Icon
                        icon="solar:home-bold-duotone"
                        className="text-2xl text-slate-500"
                      />
                    </div>
                    {/* glass overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    {/* price overlay */}
                    <span className="absolute bottom-1 left-1 right-1 truncate text-[8.5px] font-bold text-white drop-shadow">
                      {compactPrice(l.harga)}
                    </span>
                  </div>

                  {/* Body — Alamat di atas, baru di bawah: tipe · luas · kota */}
                  <div className="min-w-0 flex-1 pr-12">
                    <p
                      title={primaryAddress(l)}
                      className="line-clamp-2 text-[13px] font-bold leading-snug text-white"
                    >
                      {primaryAddress(l)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[10.5px] text-slate-400">
                      {propertyMeta(l)}
                    </p>

                    {/* Metric chips */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <MetricChip
                        icon="solar:eye-bold-duotone"
                        value={compactNum(l.views)}
                        tint="sky"
                        title={`${l.views.toLocaleString("id-ID")} views`}
                      />
                      <MetricChip
                        icon="ic:baseline-whatsapp"
                        value={compactNum(l.wa_clicks)}
                        tint="emerald"
                        title={`${l.wa_clicks.toLocaleString("id-ID")} klik WhatsApp`}
                      />
                      <MetricChip
                        icon="solar:users-group-rounded-bold-duotone"
                        value={compactNum(l.lead_count)}
                        tint="violet"
                        title={`${l.lead_count.toLocaleString("id-ID")} leads`}
                      />
                    </div>
                  </div>
                </div>

                {/* ─── Insight banner — saran konkret untuk meningkatkan
                        peluang closing. Untuk top-perform diarahkan ke
                        follow-up; untuk butuh-perhatian diarahkan ke
                        repricing / Hot Deal / refresh foto. ─── */}
                <InsightBanner
                  insight={isStagnant ? attentionInsight(l) : topInsight(l)}
                />

                {/* hairline at top on hover */}
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </article>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}

function MetricChip({
  icon,
  value,
  tint,
  title,
}: {
  icon: string;
  value: string;
  tint: "sky" | "emerald" | "violet";
  title?: string;
}) {
  const palette = {
    sky: {
      border: "border-sky-400/15",
      bg: "bg-sky-500/[0.08]",
      icon: "text-sky-300",
      text: "text-sky-100",
    },
    emerald: {
      border: "border-emerald-400/15",
      bg: "bg-emerald-500/[0.08]",
      icon: "text-emerald-300",
      text: "text-emerald-100",
    },
    violet: {
      border: "border-violet-400/15",
      bg: "bg-violet-500/[0.08]",
      icon: "text-violet-300",
      text: "text-violet-100",
    },
  }[tint];

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums ${palette.border} ${palette.bg} ${palette.text}`}
    >
      <Icon icon={icon} className={`text-[11px] ${palette.icon}`} />
      {value}
    </span>
  );
}

function InsightBanner({ insight }: { insight: RowInsight }) {
  const palette = {
    emerald: {
      border: "border-emerald-400/15",
      bg: "bg-emerald-500/[0.06]",
      text: "text-emerald-100",
      icon: "text-emerald-300",
    },
    amber: {
      border: "border-amber-400/15",
      bg: "bg-amber-500/[0.06]",
      text: "text-amber-100",
      icon: "text-amber-300",
    },
    sky: {
      border: "border-sky-400/15",
      bg: "bg-sky-500/[0.06]",
      text: "text-sky-100",
      icon: "text-sky-300",
    },
  }[insight.tone];

  return (
    <div
      className={`flex items-center gap-1.5 border-t px-3 py-1.5 sm:px-4 ${palette.border} ${palette.bg}`}
    >
      <Icon
        icon={insight.icon}
        className={`shrink-0 text-[12px] ${palette.icon}`}
      />
      <p className={`min-w-0 truncate text-[10.5px] font-semibold ${palette.text}`}>
        {insight.text}
      </p>
    </div>
  );
}

export default ListingPerformanceCard;
