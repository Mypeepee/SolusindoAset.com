"use client";

import { useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { Layers3 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { formatIDR, formatPercent, safeDivide, toNumber } from "./utils";
import { EmptyState, SectionCard } from "./shared";

type AllocationTone = {
  dot: string;
  bar: string;
  text: string;
  border: string;
  soft: string;
  ring: string;
};

type BaseItem = {
  id: string;
  label: string;
  value: number;
  description: string;
};

type AllocationItem = BaseItem & {
  ratio: number;
  displayRatio: number;
  tone: AllocationTone;
};

type HoveredState = {
  item: AllocationItem;
  x: number;
};

const TOOLTIP_WIDTH = 260;
const TOOLTIP_HALF = TOOLTIP_WIDTH / 2;

const TONES: AllocationTone[] = [
  {
    dot: "bg-[#d9b46b]",
    bar: "from-[#b88b43] via-[#cfab67] to-[#e2c68f]",
    text: "text-[#e7cb98]",
    border: "border-[#d9b46b]/20",
    soft: "bg-[#d9b46b]/[0.06]",
    ring: "shadow-[0_0_24px_rgba(217,180,107,0.14)]",
  },
  {
    dot: "bg-[#83a7c2]",
    bar: "from-[#5f7f98] via-[#7f9db5] to-[#abc4d6]",
    text: "text-[#b7cfde]",
    border: "border-[#83a7c2]/20",
    soft: "bg-[#83a7c2]/[0.06]",
    ring: "shadow-[0_0_24px_rgba(131,167,194,0.12)]",
  },
  {
    dot: "bg-[#88aa97]",
    bar: "from-[#5f7d6a] via-[#7ea18c] to-[#a8c1b2]",
    text: "text-[#bad2c1]",
    border: "border-[#88aa97]/20",
    soft: "bg-[#88aa97]/[0.06]",
    ring: "shadow-[0_0_24px_rgba(136,170,151,0.12)]",
  },
  {
    dot: "bg-[#9a8ab3]",
    bar: "from-[#6e638a] via-[#8a7aa8] to-[#b3a5c9]",
    text: "text-[#c7bdd8]",
    border: "border-[#9a8ab3]/20",
    soft: "bg-[#9a8ab3]/[0.06]",
    ring: "shadow-[0_0_24px_rgba(154,138,179,0.11)]",
  },
  {
    dot: "bg-[#b58d87]",
    bar: "from-[#8a6761] via-[#a9817a] to-[#cfaaa2]",
    text: "text-[#dcc0bb]",
    border: "border-[#b58d87]/20",
    soft: "bg-[#b58d87]/[0.06]",
    ring: "shadow-[0_0_24px_rgba(181,141,135,0.10)]",
  },
  {
    dot: "bg-[#8f98a6]",
    bar: "from-[#65707f] via-[#8590a1] to-[#b5bfcb]",
    text: "text-[#c6cfda]",
    border: "border-[#8f98a6]/20",
    soft: "bg-[#8f98a6]/[0.06]",
    ring: "shadow-[0_0_22px_rgba(143,152,166,0.10)]",
  },
];

function formatCompactMoney(value: number) {
  if (value >= 1_000_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2,
    }).format(value / 1_000_000_000)} M`;
  }

  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(value / 1_000_000)} jt`;
  }

  if (value >= 1_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(value / 1_000)} rb`;
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function clampTooltipX(center: number, containerWidth: number) {
  if (containerWidth <= TOOLTIP_WIDTH) {
    return containerWidth / 2;
  }

  return Math.min(Math.max(center, TOOLTIP_HALF), containerWidth - TOOLTIP_HALF);
}

function Tooltip({ hovered }: { hovered: HoveredState | null }) {
  if (!hovered) return null;

  const { item, x } = hovered;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[999] -translate-x-1/2 -translate-y-[calc(100%+14px)] transition-all duration-150"
      style={{ left: x, width: TOOLTIP_WIDTH }}
    >
      <div className="relative isolate overflow-hidden rounded-[18px] border border-white/12 bg-[#0b1017] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.72)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.008))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.tone.dot}`} />
            <div className="truncate text-sm font-medium text-white">{item.label}</div>
          </div>

          <div className="font-mono text-sm text-white">{formatIDR(item.value)}</div>

          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span>{formatCompactMoney(item.value)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span className={item.tone.text}>{formatPercent(item.ratio)} dari target</span>
          </div>

          <div className="my-3 h-px bg-white/8" />

          <div className="text-xs leading-relaxed text-slate-300">{item.description}</div>
        </div>
      </div>
    </div>
  );
}

function AllocationStrip({
  items,
  allocatedRatio,
  onEnter,
  onLeave,
}: {
  items: AllocationItem[];
  allocatedRatio: number;
  onEnter: (
    item: AllocationItem,
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>
  ) => void;
  onLeave: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#091018]/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="relative overflow-hidden rounded-[16px] border border-white/6 bg-[#0c131c]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_25%)] bg-[length:25%_100%]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_45%,rgba(255,255,255,0.015))]" />

        <div className="flex h-5 w-full">
          {items.map((item) => {
            const visibleWidth = Math.max(
              item.displayRatio * 100,
              item.displayRatio > 0 ? 1.65 : 0
            );

            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={(event) => onEnter(item, event)}
                onMouseMove={(event) => onEnter(item, event)}
                onFocus={(event) => onEnter(item, event)}
                onBlur={onLeave}
                onMouseLeave={onLeave}
                className={`relative h-full bg-gradient-to-r ${item.tone.bar} ${item.tone.ring} transition-all duration-200 hover:brightness-110 focus:outline-none`}
                style={{ width: `${visibleWidth}%` }}
                aria-label={`${item.label} ${formatIDR(item.value)} ${formatPercent(
                  item.ratio
                )} dari target`}
              >
                <span className="absolute inset-y-0 right-0 w-px bg-white/15" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.26em] text-slate-500">
        <span>0%</span>
        <span className="font-mono text-slate-400">
          Allocated {formatPercent(allocatedRatio)}
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

function AllocationRow({
  item,
  active,
  onEnter,
  onLeave,
}: {
  item: AllocationItem;
  active: boolean;
  onEnter: (item: AllocationItem) => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={() => onEnter(item)}
      onMouseLeave={onLeave}
      className={[
        "group rounded-[18px] border px-4 py-3 transition-all duration-200",
        active
          ? `${item.tone.border} ${item.tone.soft} ${item.tone.ring}`
          : "border-white/8 bg-[#0a1017]/86 hover:border-white/12 hover:bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.tone.dot}`} />
            <span className="truncate text-sm text-slate-100">{item.label}</span>
          </div>

          <div className="mt-2 h-px overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${item.tone.bar}`}
              style={{ width: `${Math.min(Math.max(item.ratio, 0), 1) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-w-[116px] text-right">
          <div className="font-mono text-sm text-white">{formatIDR(item.value)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Nominal
          </div>
        </div>

        <div className="min-w-[72px] text-right">
          <div className={`font-mono text-sm ${item.tone.text}`}>{formatPercent(item.ratio)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Target
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CapitalDeploymentCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const fundingTarget = toNumber(project.fundingTarget);
  const tooltipAnchorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredState | null>(null);

  const baseItems = useMemo<BaseItem[]>(
    () =>
      [
        {
          id: "auction-limit",
          label: "Nilai limit lelang",
          value: toNumber(project.auctionLimitValue),
          description: "Porsi dana utama untuk akuisisi aset pada harga limit lelang.",
        },
        {
          id: "spare-bidding",
          label: "Spare bidding",
          value: toNumber(project.spareBidding),
          description: "Ruang taktis untuk mengantisipasi kenaikan saat proses bidding.",
        },
        {
          id: "execution-cost",
          label: "Biaya eksekusi",
          value: toNumber(project.executionCost),
          description: "Biaya legal, administratif, dan operasional saat eksekusi transaksi.",
        },
        {
          id: "renovation-cost",
          label: "Biaya renovasi",
          value: toNumber(project.renovationCost),
          description: "Modal perbaikan awal agar aset lebih siap dipasarkan kembali.",
        },
        {
          id: "transfer-cost",
          label: "Biaya balik nama",
          value: toNumber(project.transferCost),
          description: "Biaya perpindahan hak dan kelengkapan dokumen kepemilikan.",
        },
        {
          id: "reserve-fund",
          label: "Dana cadangan",
          value: toNumber(project.reserveFund),
          description: "Buffer kas untuk kebutuhan tak terduga di luar komponen inti transaksi.",
        },
      ].filter((item) => item.value > 0),
    [
      project.auctionLimitValue,
      project.spareBidding,
      project.executionCost,
      project.renovationCost,
      project.transferCost,
      project.reserveFund,
    ]
  );

  const allocated = baseItems.reduce((sum, item) => sum + item.value, 0);
  const ratioBase = fundingTarget > 0 ? fundingTarget : Math.max(allocated, 1);
  const displayBase = Math.max(fundingTarget, allocated, 1);
  const allocatedRatio = safeDivide(allocated, ratioBase);

  const items = useMemo<AllocationItem[]>(
    () =>
      baseItems.map((item, index) => ({
        ...item,
        ratio: safeDivide(item.value, ratioBase),
        displayRatio: safeDivide(item.value, displayBase),
        tone: TONES[index % TONES.length],
      })),
    [baseItems, ratioBase, displayBase]
  );

  const handleSegmentHover = (
    item: AllocationItem,
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>
  ) => {
    const container = tooltipAnchorRef.current;
    const target = event.currentTarget;

    if (!container || !target) {
      setHovered({ item, x: TOOLTIP_HALF });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const center = targetRect.left - containerRect.left + targetRect.width / 2;

    setHovered({
      item,
      x: clampTooltipX(center, containerRect.width),
    });
  };

  const handleRowHover = (item: AllocationItem) => {
    const containerWidth =
      tooltipAnchorRef.current?.getBoundingClientRect().width ?? TOOLTIP_WIDTH;

    setHovered({
      item,
      x: clampTooltipX(containerWidth / 2, containerWidth),
    });
  };

  if (items.length === 0) {
    return (
      <SectionCard
        eyebrow="Capital Allocation"
        title={<span className="hidden lg:inline">Persentase alokasi dana investor</span>}
        icon={<Layers3 className="h-5 w-5" />}
      >
        <EmptyState text="Alokasi dana belum diisi, jadi investor belum bisa melihat distribusi penggunaan modal." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Capital Allocation"
      title={<span className="hidden lg:inline">Persentase alokasi dana investor</span>}
      icon={<Layers3 className="h-5 w-5" />}
      right={
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
          <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
            Target
          </span>
          <span className="font-mono text-xs text-white">{formatIDR(fundingTarget)}</span>
        </div>
      }
    >
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(184,139,67,0.08),transparent_18%),radial-gradient(circle_at_top_right,rgba(95,127,152,0.06),transparent_18%),linear-gradient(180deg,#0b1017_0%,#080d14_100%)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/6 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">
              Allocation Map
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Distribusi penggunaan dana terhadap target pendanaan.
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Allocated
            </span>
            <span className="ml-2 font-mono text-xs text-white">
              {formatPercent(allocatedRatio)}
            </span>
          </div>
        </div>

        <div
          ref={tooltipAnchorRef}
          className="relative mt-4 overflow-visible"
          onMouseLeave={() => setHovered(null)}
        >
          <Tooltip hovered={hovered} />

          <AllocationStrip
            items={items}
            allocatedRatio={allocatedRatio}
            onEnter={handleSegmentHover}
            onLeave={() => setHovered(null)}
          />
        </div>

        <div className="mt-5">
          <div className="mb-3 hidden grid-cols-[minmax(0,1fr)_116px_72px] gap-3 px-1 text-[10px] uppercase tracking-[0.26em] text-slate-500 md:grid">
            <div>Component</div>
            <div className="text-right">Nominal</div>
            <div className="text-right">% Target</div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <AllocationRow
                key={item.id}
                item={item}
                active={hovered?.item.id === item.id}
                onEnter={handleRowHover}
                onLeave={() => setHovered(null)}
              />
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}