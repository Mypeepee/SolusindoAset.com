"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DetailItem = { role: string; agentNama: string; pendapatan: number };

type TransaksiRow = {
  id: string;
  kode: string;
  status: string;
  jenis: string;
  tipeKomisi: string;
  hargaDeal: number;
  hargaPromoDeal: number;
  hargaBidding: number;
  nilaiTransaksi: number;
  tanggal: string;
  agentNama: string;
  agentKantor: string;
  agentFoto: string;
  klienNama: string | null;
  listingJudul: string;
  listingGambar: string;
  listingAlamat: string;
  listingKota: string;
  pendapatanKantor: number;
  thcAgent: number;
  komisiPersentase: number;
  biayaBaliknama: number;
  biayaPengosongan: number;
  royaltyFee: number;
  cobrokeFee: number;
  catatan: string | null;
  rating: number | null;
  comment: string | null;
  detail: DetailItem[];
};

type Stats = {
  total: number;
  totalNilai: number;
  inProgress: number;
  selesai: number;
};

// ── Stage pipeline config ─────────────────────────────────────────────────────

type StageItem = { id: string; label: string; icon: string };

const STAGES_UMUM: StageItem[] = [
  { id: "CLOSING",            label: "Closing",            icon: "solar:handshake-bold-duotone" },
  { id: "VERIFIKASI_DOKUMEN", label: "Verifikasi Dokumen", icon: "solar:document-add-bold-duotone" },
  { id: "AJB",                label: "AJB",                icon: "solar:document-text-bold-duotone" },
  { id: "SELESAI",            label: "Selesai",            icon: "solar:verified-check-bold-duotone" },
];

const STAGES_LELANG: StageItem[] = [
  { id: "CLOSING",               label: "Closing",               icon: "solar:handshake-bold-duotone" },
  { id: "PENGURUSAN_DOKUMEN",    label: "Pengurusan Dokumen",    icon: "solar:folder-open-bold-duotone" },
  { id: "EKSEKUSI_PENGOSONGAN",  label: "Eksekusi Pengosongan",  icon: "solar:home-2-bold-duotone" },
  { id: "SELESAI",               label: "Selesai",               icon: "solar:verified-check-bold-duotone" },
];

function getStages(jenis: string): StageItem[] {
  return jenis === "LELANG" ? STAGES_LELANG : STAGES_UMUM;
}

function getStageIdx(stages: StageItem[], status: string): number {
  const idx = stages.findIndex((s) => s.id === status.toUpperCase());
  return idx >= 0 ? idx : 0;
}

// Stage pills definition per jenis
type PillItem = { id: string; label: string };

function getStagePills(jenis: string): PillItem[] {
  const base: PillItem[] = [{ id: "ALL", label: "Semua" }];
  if (jenis === "LELANG") {
    return [
      ...base,
      { id: "CLOSING",              label: "Closing" },
      { id: "PENGURUSAN_DOKUMEN",   label: "Pengurusan Dokumen" },
      { id: "EKSEKUSI_PENGOSONGAN", label: "Eksekusi Pengosongan" },
      { id: "SELESAI",              label: "Selesai" },
    ];
  }
  return [
    ...base,
    { id: "CLOSING",            label: "Closing" },
    { id: "VERIFIKASI_DOKUMEN", label: "Verifikasi Dokumen" },
    { id: "AJB",                label: "AJB" },
    { id: "SELESAI",            label: "Selesai" },
  ];
}

// ── Jenis dropdown config ─────────────────────────────────────────────────────

type JenisKey = "ALL" | "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA";

const JENIS_OPTS: Array<{
  id: JenisKey;
  label: string;
  desc: string;
  icon: string;
  dot: string;
  activeBg: string;
  activeText: string;
  activeRing: string;
  optBg: string;
  optText: string;
}> = [
  {
    id: "ALL", label: "Semua Jenis", desc: "Tampilkan semua jenis",
    icon: "solar:layers-bold-duotone",
    dot: "bg-zinc-400", activeBg: "bg-zinc-800", activeText: "text-zinc-200", activeRing: "ring-zinc-600/40",
    optBg: "hover:bg-zinc-800/60", optText: "text-zinc-200",
  },
  {
    id: "PRIMARY", label: "Primary", desc: "Properti baru dari developer",
    icon: "solar:home-2-bold-duotone",
    dot: "bg-emerald-400", activeBg: "bg-emerald-500/18", activeText: "text-emerald-200", activeRing: "ring-emerald-500/30",
    optBg: "hover:bg-emerald-500/10", optText: "text-emerald-200",
  },
  {
    id: "SECONDARY", label: "Secondary", desc: "Properti bekas / resale",
    icon: "solar:buildings-3-bold-duotone",
    dot: "bg-blue-400", activeBg: "bg-blue-500/18", activeText: "text-blue-200", activeRing: "ring-blue-500/30",
    optBg: "hover:bg-blue-500/10", optText: "text-blue-200",
  },
  {
    id: "LELANG", label: "Lelang", desc: "Properti lelang / auction",
    icon: "solar:tag-price-bold-duotone",
    dot: "bg-amber-400", activeBg: "bg-amber-500/18", activeText: "text-amber-200", activeRing: "ring-amber-500/30",
    optBg: "hover:bg-amber-500/10", optText: "text-amber-200",
  },
  {
    id: "SEWA", label: "Sewa", desc: "Properti sewa / rental",
    icon: "solar:key-bold-duotone",
    dot: "bg-violet-400", activeBg: "bg-violet-500/18", activeText: "text-violet-200", activeRing: "ring-violet-500/30",
    optBg: "hover:bg-violet-500/10", optText: "text-violet-200",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtShort(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}Jt`;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}


function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Jenis badge config ────────────────────────────────────────────────────────

const JENIS: Record<string, { label: string; cls: string }> = {
  PRIMARY:   { label: "Primary",   cls: "bg-emerald-400/12 text-emerald-200 ring-emerald-500/20" },
  SECONDARY: { label: "Secondary", cls: "bg-blue-400/12 text-blue-200 ring-blue-500/20" },
  LELANG:    { label: "Lelang",    cls: "bg-amber-400/12 text-amber-200 ring-amber-500/20" },
  SEWA:      { label: "Sewa",      cls: "bg-purple-400/12 text-purple-200 ring-purple-500/20" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: "cyan" | "emerald" | "amber" | "violet";
}) {
  const c = {
    cyan: {
      bg:      "bg-gradient-to-br from-cyan-500/[0.22] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-cyan-500/25",
      glow:    "bg-cyan-400/30",
      iconBg:  "bg-cyan-500/20 ring-1 ring-cyan-400/30",
      iconTxt: "text-cyan-300",
      val:     "text-cyan-100",
      subTxt:  "text-cyan-300/50",
    },
    emerald: {
      bg:      "bg-gradient-to-br from-emerald-500/[0.22] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-emerald-500/25",
      glow:    "bg-emerald-400/30",
      iconBg:  "bg-emerald-500/20 ring-1 ring-emerald-400/30",
      iconTxt: "text-emerald-300",
      val:     "text-emerald-100",
      subTxt:  "text-emerald-300/50",
    },
    amber: {
      bg:      "bg-gradient-to-br from-amber-500/[0.20] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-amber-500/22",
      glow:    "bg-amber-400/28",
      iconBg:  "bg-amber-500/20 ring-1 ring-amber-400/28",
      iconTxt: "text-amber-300",
      val:     "text-amber-100",
      subTxt:  "text-amber-300/50",
    },
    violet: {
      bg:      "bg-gradient-to-br from-violet-500/[0.20] via-zinc-900/80 to-zinc-950/90",
      ring:    "ring-1 ring-violet-500/22",
      glow:    "bg-violet-400/28",
      iconBg:  "bg-violet-500/20 ring-1 ring-violet-400/28",
      iconTxt: "text-violet-300",
      val:     "text-violet-100",
      subTxt:  "text-violet-300/50",
    },
  }[color];

  return (
    <div className={cx("relative overflow-hidden rounded-2xl p-4", c.bg, c.ring)}>
      {/* Corner glow */}
      <div className={cx("pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-70", c.glow)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
          <p className={cx("mt-2 text-[22px] font-black leading-none", c.val)}>{value}</p>
          {sub && <p className={cx("mt-1.5 text-[11px] font-semibold", c.subTxt)}>{sub}</p>}
        </div>
        <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", c.iconBg)}>
          <Icon icon={icon} className={cx("text-2xl", c.iconTxt)} />
        </div>
      </div>
    </div>
  );
}

function StageStepper({
  stages,
  status,
  onChange,
}: {
  stages: StageItem[];
  status: string;
  onChange: (s: string) => void;
}) {
  const currentIdx = getStageIdx(stages, status);
  const batal = status.toUpperCase() === "BATAL";

  return (
    <div>
      <div className="flex items-start">
        {stages.map((stage, idx) => {
          const done    = !batal && idx < currentIdx;
          const active  = !batal && idx === currentIdx;
          const last    = idx === stages.length - 1;

          return (
            <div key={stage.id} className="flex flex-1 min-w-0 items-start">
              <div className="flex flex-1 min-w-0 flex-col items-center">
                {/* Connector + node row */}
                <div className="flex w-full items-center">
                  {/* left connector */}
                  <div
                    className={cx(
                      "h-0.5 flex-1 transition-all duration-500",
                      idx === 0 ? "invisible" : done || active ? "bg-gradient-to-r from-emerald-500/50 to-emerald-400/30" : "bg-zinc-800/80",
                    )}
                  />

                  {/* node */}
                  <button
                    type="button"
                    onClick={() => !batal && onChange(stage.id)}
                    title={`Tandai: ${stage.label}`}
                    className={cx(
                      "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                      done    ? "cursor-pointer bg-emerald-500 hover:bg-emerald-400" : "",
                      active  ? "cursor-pointer bg-cyan-500 ring-4 ring-cyan-400/25 shadow-[0_0_18px_rgba(34,211,238,0.40)] hover:bg-cyan-400" : "",
                      !done && !active && !batal ? "cursor-pointer border-2 border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800" : "",
                      batal   ? "cursor-not-allowed border-2 border-zinc-800 bg-zinc-900 opacity-35" : "",
                    )}
                  >
                    {done ? (
                      <Icon icon="solar:check-bold" className="text-sm text-white" />
                    ) : (
                      <Icon
                        icon={stage.icon}
                        className={cx("text-sm", active ? "text-white" : "text-zinc-500")}
                      />
                    )}
                    {active && !batal && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
                    )}
                  </button>

                  {/* right connector */}
                  <div
                    className={cx(
                      "h-0.5 flex-1 transition-all duration-500",
                      last ? "invisible" : done ? "bg-gradient-to-r from-emerald-400/30 to-emerald-500/50" : "bg-zinc-800/80",
                    )}
                  />
                </div>

                {/* label */}
                <div
                  className={cx(
                    "mt-1.5 px-0.5 text-center text-[10px] font-black leading-tight",
                    done    ? "text-emerald-300" : "",
                    active  ? "text-cyan-300"    : "",
                    !done && !active ? "text-zinc-600" : "",
                  )}
                >
                  {stage.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {batal && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
          <Icon icon="solar:close-circle-bold-duotone" className="shrink-0 text-base text-red-400" />
          <span className="text-xs font-black text-red-300">Transaksi dibatalkan</span>
        </div>
      )}
    </div>
  );
}


function TransaksiCard({
  row,
  selected,
  onClick,
}: {
  row: TransaksiRow;
  selected: boolean;
  onClick: () => void;
}) {
  const stages   = getStages(row.jenis);
  const stageIdx = getStageIdx(stages, row.status);
  const batal    = row.status.toUpperCase() === "BATAL";
  const selesai  = row.status.toUpperCase() === "SELESAI";
  const jenis    = JENIS[row.jenis] ?? { label: row.jenis, cls: "bg-zinc-500/12 text-zinc-200 ring-zinc-500/20" };
  const progress = batal ? 0 : (stageIdx / (stages.length - 1)) * 100;

  // Harga sesuai aturan bisnis
  const isLelangPersentase = row.jenis === "LELANG" && row.tipeKomisi.toUpperCase() === "PERSENTASE";
  const displayPrice       = isLelangPersentase ? row.hargaBidding : row.hargaDeal;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group w-full rounded-2xl border p-3.5 text-left transition-all",
        selected
          ? "border-cyan-400/30 bg-gradient-to-b from-cyan-400/[0.08] to-zinc-950/60 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_8px_28px_rgba(34,211,238,0.08)]"
          : "border-zinc-800/70 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-900/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail — lebih besar */}
        <div className="relative h-[76px] w-[84px] shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.listingGambar}
            alt={row.listingJudul}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent" />
          {/* Jenis badge di atas thumbnail */}
          <span className={cx(
            "absolute left-1.5 top-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black ring-1",
            jenis.cls,
          )}>
            {jenis.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Baris 1: kode + tanggal */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-zinc-300">{row.kode}</span>
            <span className="shrink-0 text-[10px] text-zinc-500">{fmtDate(row.tanggal)}</span>
          </div>

          {/* Baris 2: judul properti */}
          <div className="mt-0.5 truncate text-[12px] font-bold text-white">{row.listingJudul}</div>

          {/* Baris 3: ID properti + kota */}
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="font-mono">#{row.listingId}</span>
            <span className="text-zinc-700">·</span>
            <Icon icon="solar:map-point-linear" className="shrink-0 text-[11px] text-emerald-400/70" />
            <span className="truncate">{row.listingKota}</span>
          </div>

          {/* Baris 4: harga + stage */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-black text-white">{fmtFull(displayPrice)}</span>
            {batal ? (
              <span className="text-[10px] font-black text-red-400">BATAL</span>
            ) : (
              <span className={cx(
                "text-[10px] font-black",
                selesai ? "text-emerald-300" : "text-cyan-300",
              )}>
                {selesai ? "✓ Selesai" : (stages[stageIdx]?.label ?? row.status)}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!batal && (
            <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className={cx(
                  "h-full rounded-full transition-all duration-700",
                  selesai ? "bg-emerald-500" : "bg-gradient-to-r from-cyan-500 to-blue-400",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function AgentAvatar({ foto, nama }: { foto: string; nama: string }) {
  const initials = nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt={nama}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-emerald-400/30"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/25">
      <span className="text-sm font-black text-emerald-300">{initials || "AG"}</span>
    </div>
  );
}

function DetailPanel({
  row,
  onStageChange,
}: {
  row: TransaksiRow;
  onStageChange: (id: string, status: string) => void;
}) {
  const jenis = JENIS[row.jenis] ?? { label: row.jenis, cls: "bg-zinc-500/12 text-zinc-200 ring-zinc-500/20" };

  return (
    <div className="space-y-3">
      {/* ── Property image card ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ height: 200 }}>
        {row.listingGambar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.listingGambar}
            alt={row.listingJudul}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900">
            <Icon icon="solar:home-2-bold-duotone" className="text-5xl text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {/* Overlay content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Title + jenis */}
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black leading-tight text-white">
                {row.listingJudul}
              </h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-zinc-300">
                <Icon icon="solar:map-point-linear" className="shrink-0 text-emerald-400" />
                <span className="truncate">{row.listingKota}</span>
              </div>
            </div>
            <span
              className={cx(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1",
                jenis.cls,
              )}
            >
              {jenis.label}
            </span>
          </div>

          {/* Agent info + date strip */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AgentAvatar foto={row.agentFoto} nama={row.agentNama} />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-black text-white">{row.agentNama}</div>
                {row.agentKantor && (
                  <div className="truncate text-[10px] text-zinc-400">{row.agentKantor}</div>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-bold text-zinc-300">{fmtDate(row.tanggal)}</div>
              <div className="text-[10px] font-mono text-zinc-500">{row.kode}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage stepper card ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/60 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/25">
              <Icon icon="solar:diagram-up-bold-duotone" className="text-sm text-cyan-300" />
            </div>
            <span className="text-xs font-black text-zinc-200">Stage Transaksi</span>
          </div>
          <span className={cx(
            "rounded-full px-2.5 py-0.5 text-[10px] font-black",
            row.status === "SELESAI" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" :
            row.status === "BATAL"   ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/20" :
                                       "bg-cyan-500/12 text-cyan-300 ring-1 ring-cyan-500/20",
          )}>
            {row.status}
          </span>
        </div>
        <StageStepper
          stages={getStages(row.jenis)}
          status={row.status}
          onChange={(s) => onStageChange(row.id, s)}
        />
        <p className="mt-3 text-[10px] text-zinc-600">Klik stage untuk memperbarui status transaksi.</p>
      </div>
    </div>
  );
}

// ── Jenis Dropdown ────────────────────────────────────────────────────────────

function JenisDropdown({
  value,
  onChange,
}: {
  value: JenisKey;
  onChange: (v: JenisKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = JENIS_OPTS.find((o) => o.id === value) ?? JENIS_OPTS[0];

  return (
    <div className="relative shrink-0">
      {/* Trigger — icon+dot always, label hanya md+ */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cx(
          "flex h-[38px] items-center gap-1.5 rounded-xl border px-2.5 font-black transition-all focus:outline-none",
          open || value !== "ALL"
            ? cx("border-zinc-700", current.activeBg, current.activeText, "ring-1", current.activeRing)
            : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white",
        )}
      >
        <span className={cx("h-2 w-2 shrink-0 rounded-full", current.dot)} />
        <Icon icon={current.icon} className="shrink-0 text-base" />
        {/* Label hanya tampil di md ke atas */}
        <span className="hidden text-sm md:block">{current.label}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-[10px] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel — lebar max 240px, tidak overflow layar */}
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.72)] ring-1 ring-white/5"
               style={{ maxWidth: "min(240px, calc(100vw - 24px))" }}>
            <div className="border-b border-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jenis Transaksi</p>
            </div>
            <div className="p-1.5">
              {JENIS_OPTS.map((opt) => {
                const active = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { onChange(opt.id); setOpen(false); }}
                    className={cx(
                      "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all",
                      active ? cx(opt.activeBg, "ring-1", opt.activeRing) : opt.optBg,
                    )}
                  >
                    <div className={cx(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 transition-all",
                      active ? cx(opt.activeBg, opt.activeRing) : "bg-zinc-900/60 ring-zinc-800",
                    )}>
                      {/* Icon selalu berwarna sesuai jenis — bukan cuma hover */}
                      <Icon icon={opt.icon} className={cx("text-sm", opt.activeText)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cx("text-[12px] font-black leading-tight", active ? opt.activeText : "text-zinc-200")}>
                        {opt.label}
                      </div>
                      <div className="truncate text-[10px] text-zinc-500">{opt.desc}</div>
                    </div>
                    {active && <Icon icon="solar:check-bold" className={cx("shrink-0 text-xs", opt.activeText)} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Stage pills dropdown (< lg) ───────────────────────────────────────────────

function StagePillsDropdown({
  pills,
  value,
  onChange,
}: {
  pills: PillItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = pills.find((p) => p.id === value) ?? pills[0];
  const isFiltered = value !== "ALL";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cx(
          "flex h-[38px] items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-black transition-all",
          isFiltered
            ? "bg-cyan-500/18 text-cyan-200 ring-1 ring-cyan-500/30"
            : "border border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white",
        )}
      >
        <Icon icon="solar:tuning-2-bold-duotone" className="shrink-0 text-sm" />
        {/* Label — max 80px agar tidak overflow */}
        <span className="max-w-[80px] truncate">{current.label}</span>
        <Icon
          icon="solar:alt-arrow-down-bold"
          className={cx("shrink-0 text-[10px] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel — right-0 supaya tidak overflow kanan layar */}
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.72)] ring-1 ring-white/5"
               style={{ width: "min(220px, calc(100vw - 24px))" }}>
            <div className="border-b border-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stage</p>
            </div>
            <div className="p-1.5">
              {pills.map((pill) => {
                const active = value === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => { onChange(pill.id); setOpen(false); }}
                    className={cx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-black transition-all",
                      active
                        ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25"
                        : "text-zinc-300 hover:bg-zinc-800/60",
                    )}
                  >
                    {pill.label}
                    {active && <Icon icon="solar:check-bold" className="shrink-0 text-[10px] text-cyan-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex items-start gap-3">
        <div className="h-[52px] w-[60px] shrink-0 rounded-xl bg-zinc-800/60" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-20 rounded bg-zinc-800/60" />
            <div className="h-3 w-14 rounded bg-zinc-800/40" />
          </div>
          <div className="h-3 w-40 rounded bg-zinc-800/60" />
          <div className="h-2.5 w-28 rounded bg-zinc-800/40" />
          <div className="h-[3px] w-full rounded bg-zinc-800/50" />
        </div>
      </div>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-20 rounded bg-zinc-800/60" />
          <div className="h-6 w-28 rounded bg-zinc-800/60" />
          <div className="h-2 w-16 rounded bg-zinc-800/40" />
        </div>
        <div className="h-10 w-10 rounded-2xl bg-zinc-800/50" />
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ProgressTransaksiView() {
  const [rows, setRows]         = useState<TransaksiRow[]>([]);
  const [stats, setStats]       = useState<Stats>({ total: 0, totalNilai: 0, inProgress: 0, selesai: 0 });
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<TransaksiRow | null>(null);
  const [jenisFilter, setJenisFilter] = useState<JenisKey>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [search, setSearch]     = useState("");
  const [sheetVisible, setSheetVisible]   = useState(false);
  const [sheetAnimated, setSheetAnimated] = useState(false);

  // Reset stage pill when jenis changes
  function handleJenisChange(jenis: JenisKey) {
    setJenisFilter(jenis);
    setStageFilter("ALL");
  }

  // Fetch effect
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ take: "50", q: search });
        if (jenisFilter !== "ALL") params.set("jenis", jenisFilter);
        if (stageFilter !== "ALL") params.set("status", stageFilter);
        const res = await fetch(`/api/dashboard/transaksi/progress?${params}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data: TransaksiRow[] = json.data ?? [];
        if (!cancelled) {
          setRows(data);
          setStats(json.stats ?? { total: 0, totalNilai: 0, inProgress: 0, selesai: 0 });
          setSelected((prev) => {
            if (!prev) return data[0] ?? null;
            return data.find((r) => r.id === prev.id) ?? data[0] ?? null;
          });
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, search ? 350 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, jenisFilter, stageFilter]);

  async function handleStageChange(id: string, status: string) {
    const update = (r: TransaksiRow) => (r.id === id ? { ...r, status } : r);
    setRows((prev) => prev.map(update));
    setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
    if (status === "SELESAI") {
      setStats((prev) => ({ ...prev, selesai: prev.selesai + 1, inProgress: Math.max(0, prev.inProgress - 1) }));
    }
    await fetch("/api/dashboard/transaksi/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  function openDetail(row: TransaksiRow) {
    setSelected(row);
    setSheetVisible(true);
    // dua rAF: pastikan DOM mount dulu, baru trigger transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetAnimated(true));
    });
  }

  function closeSheet() {
    setSheetAnimated(false);
    setTimeout(() => setSheetVisible(false), 320);
  }

  const stagePills = getStagePills(jenisFilter);

  return (
    <div className="space-y-4">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <KpiCard
              icon="solar:dollar-minimalistic-bold-duotone"
              label="Total Nilai Deal"
              value={fmtShort(stats.totalNilai)}
              sub={`${stats.total} transaksi`}
              color="cyan"
            />
            <KpiCard
              icon="solar:bill-list-bold-duotone"
              label="Total Closing"
              value={String(stats.total)}
              sub="keseluruhan"
              color="violet"
            />
            <KpiCard
              icon="solar:layers-bold-duotone"
              label="Dalam Proses"
              value={String(stats.inProgress)}
              sub="sedang berjalan"
              color="amber"
            />
            <KpiCard
              icon="solar:verified-check-bold-duotone"
              label="Selesai"
              value={String(stats.selesai)}
              sub="terjual / akad"
              color="emerald"
            />
          </>
        )}
      </div>

      {/* ── Filter row — satu baris di semua ukuran ─────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Search — flex-1, placeholder pendek supaya tidak sesak */}
        <div className="relative min-w-0 flex-1">
          <Icon
            icon="solar:magnifer-linear"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari…"
            className="h-[38px] w-full rounded-xl border border-zinc-800 bg-zinc-950/60 pl-8 pr-7 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-zinc-200"
            >
              <Icon icon="solar:close-circle-linear" className="text-sm" />
            </button>
          )}
        </div>

        {/* Jenis dropdown — dot+icon selalu, label md+ */}
        <JenisDropdown value={jenisFilter} onChange={handleJenisChange} />

        {/* lg+: pills inline, tidak wrap */}
        <div className="hidden items-center gap-1 lg:flex">
          {stagePills.map((pill) => {
            const active = stageFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStageFilter(pill.id)}
                className={cx(
                  "whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-black transition-all",
                  active
                    ? "bg-cyan-500/18 text-cyan-200 ring-1 ring-cyan-500/30"
                    : "bg-zinc-900/60 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200",
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* < lg: pills jadi dropdown */}
        <div className="lg:hidden">
          <StagePillsDropdown
            pills={stagePills}
            value={stageFilter}
            onChange={setStageFilter}
          />
        </div>

      </div>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Left: transaction list */}
        <div
          className={cx(
            "flex flex-col gap-2 overflow-y-auto",
            selected ? "w-full lg:w-80 xl:w-96 lg:shrink-0" : "w-full",
          )}
          style={{ maxHeight: "calc(100vh - 300px)", minHeight: 200 }}
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : rows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/30 p-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl border border-zinc-800 bg-zinc-950/40">
                <Icon icon="solar:bill-list-bold-duotone" className="text-3xl text-zinc-400" />
              </div>
              <div className="mt-3 text-sm font-black text-white">Tidak ada transaksi</div>
              <p className="mt-1 text-xs text-zinc-500">
                {search ? `Tidak ditemukan hasil untuk "${search}".` : "Belum ada transaksi yang tersimpan."}
              </p>
            </div>
          ) : (
            rows.map((row) => (
              <TransaksiCard
                key={row.id}
                row={row}
                selected={selected?.id === row.id}
                onClick={() => openDetail(row)}
              />
            ))
          )}
        </div>

        {/* Right: detail panel — desktop only */}
        {selected && (
          <div className="hidden flex-1 min-w-0 lg:block">
            <DetailPanel row={selected} onStageChange={handleStageChange} />
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheet ──────────────────────────────────────────── */}
      {sheetVisible && selected && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop — fade in/out */}
          <div
            className="absolute inset-0 backdrop-blur-[6px]"
            style={{
              backgroundColor: "rgba(4,4,8,0.78)",
              opacity: sheetAnimated ? 1 : 0,
              transition: sheetAnimated
                ? "opacity 300ms ease-out"
                : "opacity 240ms ease-in",
            }}
            onClick={closeSheet}
          />

          {/* Sheet — spring slide-up/down */}
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-zinc-800/80 bg-[#0a0a0f] shadow-[0_-32px_80px_rgba(0,0,0,0.72)]"
            style={{
              transform: sheetAnimated ? "translateY(0)" : "translateY(100%)",
              transition: sheetAnimated
                ? "transform 420ms cubic-bezier(0.32,0.72,0,1)"
                : "transform 300ms cubic-bezier(0.55,0,1,0.45)",
            }}
          >
            {/* Handle + close */}
            <div className="relative flex shrink-0 items-center justify-center px-4 py-3">
              <div className="h-1 w-10 rounded-full bg-zinc-700/80" />
              <button
                type="button"
                onClick={closeSheet}
                className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
              >
                <Icon icon="solar:close-linear" className="text-base" />
              </button>
            </div>

            {/* Thin separator */}
            <div className="mx-4 h-px shrink-0 bg-zinc-800/60" />

            {/* Scrollable content */}
            <div className="overflow-y-auto px-4 pb-10 pt-4">
              <DetailPanel row={selected} onStageChange={handleStageChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
