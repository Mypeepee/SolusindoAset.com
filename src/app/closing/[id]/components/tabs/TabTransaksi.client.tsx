"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "../../page";
import Money from "../ui/Money";
import { Icon } from "@iconify/react";

/* =========================================
  Types
========================================= */
export type SkemaPenjualan = "PERSENTASE" | "SELISIH";

/* =========================================
  Utils: formatting & parsing
========================================= */
const fmt = new Intl.NumberFormat("id-ID");

function nonNeg(v: number) {
  return v < 0 ? 0 : v;
}
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function formatInt(v: number) {
  return fmt.format(Number.isFinite(v) ? Math.trunc(v) : 0);
}
function parseDigits(raw: string) {
  let d = (raw ?? "").replace(/[^\d]/g, "");
  d = d.replace(/^0+(?=\d)/, "");
  if (!d) return 0;
  const val = parseInt(d, 10);
  return Number.isFinite(val) ? val : 0;
}

// percent: allow 2,5 or 2.5 (keep display with comma)
function sanitizePercent(raw: string) {
  let s = (raw ?? "").trim();
  s = s.replace(/[^\d.,]/g, "");

  const sep = s.search(/[.,]/);
  if (sep >= 0) {
    const head = s.slice(0, sep);
    let tail = s.slice(sep + 1).replace(/[.,]/g, "");
    tail = tail.slice(0, 2);
    s = head + "," + tail;
  }

  if (s.includes(",")) {
    const [a, b] = s.split(",");
    const a2 = a.replace(/^0+(?=\d)/, "") || "0";
    s = a2 + "," + b;
  } else {
    s = s.replace(/^0+(?=\d)/, "");
    if (!s) s = "0";
  }
  return s;
}
function percentToNumber(s: string) {
  const val = Number((s ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(val) ? val : 0;
}

function pct2(v: number) {
  const s = (v * 100).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function autoBalikNama(base: number) {
  // 8.5% + 7jt
  if (!base || base <= 0) return 0;
  return Math.round(base * 0.085) + 7_000_000;
}

/* =========================================
  Persistence (localStorage)
========================================= */
type PersistedState = {
  step: 1 | 2 | 3;
  deal: number;
  bidding: number;
  komisiStr: string;

  balikNamaMode: "AUTO" | "MANUAL";
  balikNama: number;
  eksekusi: number;

  includeBalikNama: boolean;
  includeEksekusi: boolean;

  cobroke: number;
};

function storageKey(listing: Listing) {
  return `closing:transaksi:${String(
    (listing as any)?.id_property ?? listing?.id_property ?? ""
  )}`;
}

/* =========================================
  UI building blocks (premium / futuristic)
========================================= */
function ShellCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[32px] border border-white/10",
        "bg-white/[0.035] backdrop-blur-2xl",
        "shadow-[0_40px_120px_rgba(0,0,0,0.65)]",
        className,
      ].join(" ")}
    >
      {/* subtle grid + sheen */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -top-40 right-[-180px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/45" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
      </div>

      <div className="relative p-5 sm:p-6">{children}</div>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { k: 1, t: "Transaksi", d: "Harga & komisi" },
    { k: 2, t: "Biaya", d: "Balik nama & eksekusi" },
    { k: 3, t: "Review", d: "Fee kantor & ringkasan" },
  ] as const;

  const pct = step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        {items.map((it) => {
          const active = it.k === step;
          const done = it.k < step;

          return (
            <div key={it.k} className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "grid h-9 w-9 place-items-center rounded-2xl border text-xs font-semibold",
                    done
                      ? "border-emerald-400/25 bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                      : active
                      ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/5 text-zinc-400",
                  ].join(" ")}
                >
                  {done ? (
                    <Icon icon="solar:check-circle-linear" className="text-xl" />
                  ) : (
                    it.k
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className={
                      active
                        ? "text-white font-semibold"
                        : "text-zinc-300 font-semibold"
                    }
                  >
                    {it.t}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {it.d}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* progress bar */}
      <div className="mt-4 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className={[
            "h-full rounded-full bg-gradient-to-r from-emerald-300/60 to-emerald-400/30",
            pct,
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[12px] font-semibold text-zinc-200">
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[11px] text-zinc-500">{children}</div>;
}

function RpInput({
  value,
  onChange,
  placeholder = "0",
  disabled,
  inputRef,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border backdrop-blur-2xl",
        disabled
          ? "border-white/8 bg-white/[0.03] opacity-60"
          : "border-white/10 bg-white/[0.04] hover:border-white/15",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent opacity-0 transition group-focus-within:opacity-100" />

      <div className="relative flex h-12">
        <div className="flex w-14 items-center justify-center border-r border-white/10 bg-black/25 text-zinc-200">
          Rp
        </div>
        <input
          ref={inputRef as any}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ? formatInt(value) : ""}
          onChange={(e) => onChange(parseDigits(e.target.value))}
          placeholder={placeholder}
          className="h-full w-full bg-transparent px-4 text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

function PercentInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border backdrop-blur-2xl",
        disabled
          ? "border-white/8 bg-white/[0.03] opacity-60"
          : "border-white/10 bg-white/[0.04] hover:border-white/15",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent opacity-0 transition group-focus-within:opacity-100" />

      <div className="relative flex h-12">
        <input
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(sanitizePercent(e.target.value))}
          className="h-full w-full bg-transparent px-4 text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
          placeholder="0"
          inputMode="decimal"
        />
        <div className="flex w-14 items-center justify-center border-l border-white/10 bg-black/25 text-zinc-200">
          %
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "group w-full rounded-3xl border p-4 text-left transition backdrop-blur-2xl",
        disabled
          ? "border-white/8 bg-white/[0.03] opacity-60 cursor-not-allowed"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.055] hover:border-white/15",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{label}</div>
          {desc ? (
            <div className="mt-1 text-[12px] text-zinc-500">{desc}</div>
          ) : null}
        </div>

        <div
          className={[
            "relative h-7 w-12 rounded-full border transition",
            checked
              ? "border-emerald-400/25 bg-emerald-500/15"
              : "border-white/10 bg-black/25",
          ].join(" ")}
        >
          <div
            className={[
              "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full transition",
              checked
                ? "left-[26px] bg-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.45)]"
                : "left-[4px] bg-white/70",
            ].join(" ")}
          />
        </div>
      </div>
    </button>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div className="flex items-start gap-2">
        <Icon
          icon="solar:danger-triangle-linear"
          className="mt-[2px] text-lg text-amber-200"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* =========================================
  Main Component
========================================= */
export default function TabTransaksi({
  listing,
  skemaPenjualan,
}: {
  listing: Listing;
  skemaPenjualan: SkemaPenjualan;
}) {
  const isLelang = listing.jenis_transaksi === "LELANG";
  const isSelisih = isLelang && skemaPenjualan === "SELISIH";
  const isPersen = isLelang && skemaPenjualan === "PERSENTASE";

  const limit = n(listing.nilai_limit_lelang);

  // ---------- local state (persisted) ----------
  const key = storageKey(listing);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [deal, setDeal] = useState(0);
  const [bidding, setBidding] = useState(0);
  const [komisiStr, setKomisiStr] = useState("2,5");

  const [balikNamaMode, setBalikNamaMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [balikNama, setBalikNama] = useState(0);
  const [eksekusi, setEksekusi] = useState(0);

  const [includeBalikNama, setIncludeBalikNama] = useState(true);
  const [includeEksekusi, setIncludeEksekusi] = useState(true);

  const [cobroke, setCobroke] = useState(0);

  // ---------- hydrate from localStorage ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;

      if (parsed?.step) setStep(parsed.step);
      setDeal(n(parsed.deal));
      setBidding(n(parsed.bidding));
      setKomisiStr(typeof parsed.komisiStr === "string" ? parsed.komisiStr : "2,5");

      setBalikNamaMode(parsed.balikNamaMode === "MANUAL" ? "MANUAL" : "AUTO");
      setBalikNama(n(parsed.balikNama));
      setEksekusi(n(parsed.eksekusi));

      setIncludeBalikNama(!!parsed.includeBalikNama);
      setIncludeEksekusi(!!parsed.includeEksekusi);

      setCobroke(n(parsed.cobroke));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ---------- persist to localStorage ----------
  useEffect(() => {
    const payload: PersistedState = {
      step,
      deal,
      bidding,
      komisiStr,
      balikNamaMode,
      balikNama,
      eksekusi,
      includeBalikNama,
      includeEksekusi,
      cobroke,
    };

    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 120);

    return () => window.clearTimeout(t);
  }, [
    key,
    step,
    deal,
    bidding,
    komisiStr,
    balikNamaMode,
    balikNama,
    eksekusi,
    includeBalikNama,
    includeEksekusi,
    cobroke,
  ]);

  // ---------- auto balik nama ----------
  const baseBalikNama = useMemo(
    () => (isSelisih ? deal : bidding),
    [isSelisih, deal, bidding]
  );
  useEffect(() => {
    if (balikNamaMode === "AUTO") setBalikNama(autoBalikNama(baseBalikNama));
  }, [balikNamaMode, baseBalikNama]);

  // ---------- computed ----------
  const komisiPct = useMemo(() => percentToNumber(komisiStr), [komisiStr]);

  const biayaIncluded = useMemo(() => {
    if (!isSelisih) return 0;
    return (includeBalikNama ? nonNeg(balikNama) : 0) + (includeEksekusi ? nonNeg(eksekusi) : 0);
  }, [isSelisih, includeBalikNama, includeEksekusi, balikNama, eksekusi]);

  // VALIDATION: deal/bidding must not be < limit (lelang)
  const warnDealBelowLimit = isSelisih && limit > 0 && deal > 0 && deal < limit;
  const warnBidBelowLimit = isLelang && limit > 0 && bidding > 0 && bidding < limit;

  const step1Valid = useMemo(() => {
    if (!isLelang) return true;
    if (isSelisih) return deal > 0 && bidding > 0 && !warnDealBelowLimit && !warnBidBelowLimit;
    if (isPersen) return bidding > 0 && !warnBidBelowLimit && komisiPct >= 0;
    return true;
  }, [isLelang, isSelisih, isPersen, deal, bidding, warnDealBelowLimit, warnBidBelowLimit, komisiPct]);

  const selisihKotor = useMemo(() => {
    if (!isLelang) return 0;
    if (isSelisih) return nonNeg(deal - bidding);
    if (isPersen) return nonNeg(bidding - limit);
    return 0;
  }, [isLelang, isSelisih, isPersen, deal, bidding, limit]);

  const selisihSebelumRoyalty = useMemo(() => {
    if (!isLelang) return 0;
    if (isSelisih) return nonNeg(selisihKotor - biayaIncluded);
    return selisihKotor; // persentase: toggle biaya tidak pengaruh
  }, [isLelang, isSelisih, selisihKotor, biayaIncluded]);

  // Royalty fee: selisih_bersih * 3% * 10% = 0.003
  const royaltyFee = useMemo(() => {
    return Math.round(nonNeg(selisihSebelumRoyalty) * 0.003);
  }, [selisihSebelumRoyalty]);

  const selisihFinal = useMemo(() => {
    return nonNeg(selisihSebelumRoyalty - royaltyFee - nonNeg(cobroke));
  }, [selisihSebelumRoyalty, royaltyFee, cobroke]);

  // ✅ FINAL REVISION: Komisi Agent = 40% dari Selisih Final
  const komisiAgent = useMemo(() => {
    return Math.round(nonNeg(selisihFinal) * 0.4);
  }, [selisihFinal]);

  // Pendapatan bersih kantor = 39.2% dari selisih final
  const pendapatanBersihKantor = useMemo(() => {
    return Math.round(nonNeg(selisihFinal) * 0.392);
  }, [selisihFinal]);

  const kenaikanDariLimit = useMemo(() => {
    if (!isLelang || limit <= 0) return 0;
    const pembanding = isSelisih ? deal : bidding;
    if (pembanding <= 0) return 0;
    return (pembanding - limit) / limit;
  }, [isLelang, isSelisih, deal, bidding, limit]);

  const next = () => setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
  const back = () => setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));

  const disableNext = step === 1 && !step1Valid;

  // Autofocus first field each step
  const refFirst = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    refFirst.current?.focus?.();
  }, [step]);

  /* =========================================
    Breakdown UI
  ========================================= */
  const Breakdown = () => {
    const parts: Array<{
      label: string;
      value: number;
      color: string;
      show: boolean;
      prefix?: string;
    }> = [
      {
        label: "Biaya Balik Nama",
        value: includeBalikNama ? balikNama : 0,
        color: "text-amber-300",
        show: isSelisih && includeBalikNama && balikNama > 0,
        prefix: "-",
      },
      {
        label: "Biaya Eksekusi",
        value: includeEksekusi ? eksekusi : 0,
        color: "text-rose-300",
        show: isSelisih && includeEksekusi && eksekusi > 0,
        prefix: "-",
      },
      {
        label: "Royalty Fee",
        value: royaltyFee,
        color: "text-sky-300",
        show: royaltyFee > 0,
        prefix: "-",
      },
      {
        label: "Cobroke Fee",
        value: cobroke,
        color: "text-violet-300",
        show: cobroke > 0,
        prefix: "-",
      },
    ];

    return (
      <div className="mt-4 rounded-3xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] uppercase tracking-[0.14em] text-zinc-400">
            Breakdown Selisih
          </div>
          <div className="text-[11px] text-zinc-500">
            {isSelisih ? "Deal - Bidding" : "Bidding - Limit"}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-zinc-400">Selisih</div>
          <div className="mt-1 text-2xl font-semibold text-white">
            <Money value={selisihFinal} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold text-zinc-200">
              <span className="text-zinc-400">Base</span>
              <Money value={selisihKotor} />
            </span>

            {parts
              .filter((p) => p.show)
              .map((p) => (
                <span
                  key={p.label}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-semibold",
                    p.color,
                  ].join(" ")}
                >
                  <span className="text-zinc-400">{p.label}</span>
                  <span className={p.color}>
                    {p.prefix}
                    <Money value={p.value} />
                  </span>
                </span>
              ))}
          </div>

          <div className="mt-3 text-[12px] text-zinc-500">
            {isSelisih ? (
              <>
                Selisih final = (Deal - Bidding)
                {includeBalikNama ? " - Balik Nama" : ""}
                {includeEksekusi ? " - Eksekusi" : ""}
                {" - Royalty - Cobroke"}
              </>
            ) : (
              <>Selisih final = (Bidding - Limit) - Royalty - Cobroke</>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* LEFT: Wizard */}
      <div className="lg:col-span-7 order-1">
        <ShellCard>
          <Stepper step={step} />

          {/* STEP 1 */}
          {step === 1 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Harga & Komisi</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Isi yang inti dulu. Ringkasan & perhitungan selalu update.
                  </div>
                </div>

                {isLelang ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
                    Skema: {isSelisih ? "Selisih Harga" : "Persentase Komisi"}
                  </span>
                ) : null}
              </div>

              {isSelisih ? (
                <div>
                  <Label>Harga Deal</Label>
                  <RpInput value={deal} onChange={setDeal} inputRef={refFirst} />
                  <Hint>Minimal harus ≥ limit lelang.</Hint>
                  {warnDealBelowLimit ? (
                    <Warning>
                      Harga Deal lebih kecil dari Limit Lelang. Naikkan minimal ke{" "}
                      <span className="font-semibold text-amber-100">
                        <Money value={limit} />
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              ) : (
                <div>
                  <Label>Harga Bidding</Label>
                  <RpInput value={bidding} onChange={setBidding} inputRef={refFirst} />
                  <Hint>Minimal harus ≥ limit lelang.</Hint>
                  {warnBidBelowLimit ? (
                    <Warning>
                      Harga Bidding lebih kecil dari Limit Lelang. Naikkan minimal ke{" "}
                      <span className="font-semibold text-amber-100">
                        <Money value={limit} />
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              )}

              {isSelisih ? (
                <div>
                  <Label>Harga Bidding</Label>
                  <RpInput value={bidding} onChange={setBidding} />
                  <Hint>Minimal harus ≥ limit lelang.</Hint>
                  {warnBidBelowLimit ? (
                    <Warning>
                      Harga Bidding lebih kecil dari Limit Lelang. Naikkan minimal ke{" "}
                      <span className="font-semibold text-amber-100">
                        <Money value={limit} />
                      </span>
                      .
                    </Warning>
                  ) : null}
                </div>
              ) : null}

              {isPersen ? (
                <div>
                  <Label>Komisi (%)</Label>
                  <PercentInput value={komisiStr} onChange={setKomisiStr} />
                  <Hint>Disimpan untuk data transaksi (contoh: 2,5). Komisi agent real-time mengikuti 40% selisih final.</Hint>
                </div>
              ) : null}

              {/* Mobile nav (sticky bottom) */}
              <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-500 cursor-not-allowed"
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={next}
                  disabled={disableNext}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold transition",
                    disableNext
                      ? "border border-white/10 bg-white/5 text-zinc-500 cursor-not-allowed"
                      : "border border-emerald-400/20 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/16",
                  ].join(" ")}
                >
                  Next
                  <Icon icon="solar:arrow-right-linear" className="text-lg" />
                </button>
              </div>
            </div>
          ) : null}

          {/* STEP 2 */}
          {step === 2 ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Biaya Transaksi</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Balik nama auto tapi bisa override.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBalikNamaMode("AUTO")}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                    balikNamaMode === "AUTO"
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 cursor-default"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  <Icon icon="solar:refresh-linear" className="text-base" />
                  Auto Balik Nama
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label>Biaya Balik Nama</Label>
                  <RpInput
                    value={balikNama}
                    onChange={(v) => {
                      setBalikNamaMode("MANUAL");
                      setBalikNama(v);
                    }}
                    inputRef={refFirst}
                  />
                  <Hint>{balikNamaMode === "AUTO" ? "Mode: Auto" : "Mode: Manual"}</Hint>
                </div>

                <div>
                  <Label>Biaya Eksekusi</Label>
                  <RpInput value={eksekusi} onChange={setEksekusi} />
                  <Hint>Biaya pengosongan/eksekusi.</Hint>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Toggle
                  checked={includeBalikNama}
                  onChange={setIncludeBalikNama}
                  label="Balik Nama termasuk transaksi"
                  desc={
                    isSelisih
                      ? "Jika ON, selisih akan berkurang."
                      : "Tidak mempengaruhi selisih di skema persentase."
                  }
                  disabled={!isSelisih}
                />
                <Toggle
                  checked={includeEksekusi}
                  onChange={setIncludeEksekusi}
                  label="Eksekusi termasuk transaksi"
                  desc={
                    isSelisih
                      ? "Jika ON, selisih akan berkurang."
                      : "Tidak mempengaruhi selisih di skema persentase."
                  }
                  disabled={!isSelisih}
                />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition"
                >
                  Next
                  <Icon icon="solar:arrow-right-linear" className="text-lg" />
                </button>
              </div>
            </div>
          ) : null}

          {/* STEP 3 */}
          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <div className="text-white font-semibold text-lg">Review & Fee</div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Royalty otomatis (0,3%). Cobroke diinput.
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[12px] uppercase tracking-[0.14em] text-zinc-400">
                    Royalty Fee
                  </div>
                  <div className="mt-2 text-xl font-semibold text-sky-200">
                    <Money value={royaltyFee} />
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    selisih bersih × 3% × 10%
                  </div>
                </div>

                <div>
                  <Label>Cobroke Fee</Label>
                  <RpInput value={cobroke} onChange={setCobroke} inputRef={refFirst} />
                  <Hint>Memotong selisih final.</Hint>
                </div>
              </div>

              <Breakdown />

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  <Icon icon="solar:arrow-left-linear" className="text-lg" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // submit nanti sambung API
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition"
                >
                  Simpan Transaksi
                  <Icon icon="solar:diskette-linear" className="text-lg" />
                </button>
              </div>
            </div>
          ) : null}
        </ShellCard>
      </div>

      {/* RIGHT: Summary Panel */}
      <div className="lg:col-span-5 order-2">
        <div className="lg:sticky lg:top-4 space-y-6">
          <ShellCard className="p-0">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-lg">Ringkasan</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Bagus di mobile juga — ringkasan tetap kebaca.
                  </div>
                </div>

                <div className="grid place-items-center h-11 w-11 rounded-2xl border border-white/10 bg-white/5 text-emerald-100">
                  <Icon icon="solar:chart-2-linear" className="text-2xl" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    Selisih Final
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    <Money value={selisihFinal} />
                  </div>
                  <div className="mt-2 text-[12px] text-zinc-500">
                    {isSelisih
                      ? "Dipengaruhi include biaya (balik nama/eksekusi)."
                      : "Tidak dipengaruhi toggle biaya."}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    Kenaikan dari Limit
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {kenaikanDariLimit ? `${pct2(kenaikanDariLimit)}%` : "0%"}
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Basis: {isSelisih ? "Harga Deal" : "Harga Bidding"}
                  </div>
                </div>

                {/* ✅ Komisi Agent: 40% selisih final */}
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    Komisi Agent
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    <Money value={komisiAgent} />
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    40% × Selisih Final
                  </div>
                </div>

                <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 via-white/5 to-transparent p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-300/80">
                    Pendapatan Bersih Kantor
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-100">
                    <Money value={pendapatanBersihKantor} />
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-400">
                    39,2% × Selisih Final
                  </div>
                </div>
              </div>

              {(warnDealBelowLimit || warnBidBelowLimit) ? (
                <div className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      icon="solar:danger-triangle-linear"
                      className="mt-[2px] text-lg text-amber-200"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-amber-100">
                        Perbaiki input limit dulu
                      </div>
                      <div className="mt-1 text-[12px] text-amber-100/80">
                        Deal/Bidding tidak boleh lebih kecil dari limit lelang.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </ShellCard>
        </div>
      </div>
    </div>
  );
}