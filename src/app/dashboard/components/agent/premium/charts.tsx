"use client";

import { useState, useMemo, useRef } from "react";

/* ───────────────────────────────────────────────────────────────────
   Pure-SVG chart primitives for the premium agent dashboard.
   Dark-mode, emerald-only palette. No external deps.
   ─────────────────────────────────────────────────────────────────── */

export const EMERALD = {
  primary:   "#34d399", // emerald-400
  bright:    "#10b981", // emerald-500
  deep:      "#047857", // emerald-700
  pale:      "#a7f3d0", // emerald-200
  glass:     "rgba(52,211,153,0.10)",
  grid:      "rgba(255,255,255,0.05)",
  axis:      "rgba(148,163,184,0.45)", // slate-400 dim
  red:       "#f87171",
  rose:      "rgba(248,113,113,0.85)",
};

/* Catmull-Rom → cubic Bezier path (smooth curves) ─────────────────── */
export function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ─── Multi-line smooth chart ──────────────────────────────────────── */
export function MultiLineChart({
  series,
  labels,
  height = 220,
  yTicks = 4,
}: {
  series: { name: string; color: string; data: number[] }[];
  labels: string[];
  height?: number;
  yTicks?: number;
}) {
  const W = 520;
  const H = height;
  const padL = 32;
  const padR = 12;
  const padT = 16;
  const padB = 28;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = series.flatMap((s) => s.data);
  const maxV = Math.max(...all, 1);
  const niceMax = Math.ceil(maxV / 100) * 100 || maxV;

  const xFor = (i: number) => padL + (i / (labels.length - 1)) * innerW;
  const yFor = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((niceMax / yTicks) * i)
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      {/* y-grid */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke={EMERALD.grid}
            strokeDasharray="2 4"
          />
          <text
            x={padL - 6}
            y={yFor(t) + 3}
            textAnchor="end"
            className="fill-slate-600"
            fontSize="9"
          >
            {t}
          </text>
        </g>
      ))}

      {/* x-labels */}
      {labels.map((l, i) => (
        <text
          key={l + i}
          x={xFor(i)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-600"
          fontSize="9"
        >
          {l}
        </text>
      ))}

      {/* lines */}
      {series.map((s) => {
        const pts = s.data.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
        return (
          <g key={s.name}>
            <path d={smoothPath(pts)} fill="none" stroke={s.color} strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Area chart (Last vs This month) ─────────────────────────────── */
export function AreaCompareChart({
  current,
  previous,
  labels,
  height = 200,
}: {
  current: number[];
  previous: number[];
  labels: string[];
  height?: number;
}) {
  const W = 480;
  const H = height;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...current, ...previous, 1);
  const xFor = (i: number) => padL + (i / (labels.length - 1)) * innerW;
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  const curPts = current.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const prevPts = previous.map((v, i) => ({ x: xFor(i), y: yFor(v) }));

  const curArea = `${smoothPath(curPts)} L ${xFor(curPts.length - 1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
  const prevArea = `${smoothPath(prevPts)} L ${xFor(prevPts.length - 1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="area-cur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={EMERALD.primary} stopOpacity="0.45" />
          <stop offset="100%" stopColor={EMERALD.primary} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="area-prev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={EMERALD.deep} stopOpacity="0.32" />
          <stop offset="100%" stopColor={EMERALD.deep} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH * p}
          y2={padT + innerH * p}
          stroke={EMERALD.grid}
          strokeDasharray="2 4"
        />
      ))}

      <path d={prevArea} fill="url(#area-prev)" />
      <path d={smoothPath(prevPts)} fill="none" stroke={EMERALD.deep} strokeWidth="2" strokeDasharray="4 3" />

      <path d={curArea} fill="url(#area-cur)" />
      <path d={smoothPath(curPts)} fill="none" stroke={EMERALD.primary} strokeWidth="2.2" />

      {/* dots on current */}
      {curPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0c1014" stroke={EMERALD.primary} strokeWidth="1.6" />
      ))}

      {labels.map((l, i) => (
        <text
          key={l + i}
          x={xFor(i)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-600"
          fontSize="9"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

/* ─── Grouped bar chart (online vs offline) ───────────────────────── */
export function GroupedBarChart({
  categories,
  groups,
  height = 220,
}: {
  categories: string[];
  groups: { name: string; color: string; data: number[] }[];
  height?: number;
}) {
  const W = 520;
  const H = height;
  const padL = 32;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...groups.flatMap((g) => g.data), 1);
  const niceMax = Math.ceil(max / 5) * 5;

  const groupWidth = innerW / categories.length;
  const barCount = groups.length;
  const gap = 4;
  const barWidth = (groupWidth - gap * (barCount + 1)) / barCount;

  const yFor = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(niceMax * p));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        {groups.map((g, i) => (
          <linearGradient key={i} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={g.color} stopOpacity="1" />
            <stop offset="100%" stopColor={g.color} stopOpacity="0.55" />
          </linearGradient>
        ))}
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke={EMERALD.grid}
            strokeDasharray="2 4"
          />
          <text
            x={padL - 6}
            y={yFor(t) + 3}
            textAnchor="end"
            className="fill-slate-600"
            fontSize="9"
          >
            {t >= 1000 ? `${t / 1000}k` : t}
          </text>
        </g>
      ))}

      {categories.map((c, i) => {
        const gx = padL + i * groupWidth;
        return (
          <g key={c}>
            {groups.map((g, gi) => {
              const v = g.data[i] ?? 0;
              const h = (v / niceMax) * innerH;
              const x = gx + gap + gi * (barWidth + gap);
              const y = padT + innerH - h;
              return (
                <rect
                  key={gi}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx="3"
                  fill={`url(#bar-${gi})`}
                />
              );
            })}
            <text
              x={gx + groupWidth / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="9"
            >
              {c}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Target vs Reality bar chart ─────────────────────────────────── */
export function TargetRealityBars({
  categories,
  reality,
  target,
  height = 220,
}: {
  categories: string[];
  reality: number[];
  target: number[];
  height?: number;
}) {
  const W = 480;
  const H = height;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...reality, ...target, 1);
  const groupWidth = innerW / categories.length;
  const barWidth = groupWidth * 0.32;
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="real-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={EMERALD.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={EMERALD.primary} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="targ-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={EMERALD.pale} stopOpacity="0.85" />
          <stop offset="100%" stopColor={EMERALD.pale} stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((p) => (
        <line
          key={p}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH * p}
          y2={padT + innerH * p}
          stroke={EMERALD.grid}
          strokeDasharray="2 4"
        />
      ))}

      {categories.map((c, i) => {
        const cx = padL + i * groupWidth + groupWidth / 2;
        const realH = (reality[i] / max) * innerH;
        const targH = (target[i] / max) * innerH;
        return (
          <g key={c}>
            <rect
              x={cx - barWidth - 2}
              y={padT + innerH - realH}
              width={barWidth}
              height={realH}
              rx="3"
              fill="url(#real-bar)"
            />
            <rect
              x={cx + 2}
              y={padT + innerH - targH}
              width={barWidth}
              height={targH}
              rx="3"
              fill="url(#targ-bar)"
            />
            <text
              x={cx}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="9"
            >
              {c}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Stacked bar (Volume vs Service) ─────────────────────────────── */
export function StackedBarChart({
  categories,
  bottom,
  top,
  bottomColor = EMERALD.primary,
  topColor = EMERALD.deep,
  height = 220,
}: {
  categories: string[];
  bottom: number[];
  top: number[];
  bottomColor?: string;
  topColor?: string;
  height?: number;
}) {
  const W = 480;
  const H = height;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const totals = categories.map((_, i) => bottom[i] + top[i]);
  const max = Math.max(...totals, 1);
  const groupWidth = innerW / categories.length;
  const barWidth = groupWidth * 0.55;
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="stk-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bottomColor} stopOpacity="1" />
          <stop offset="100%" stopColor={bottomColor} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="stk-t" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topColor} stopOpacity="1" />
          <stop offset="100%" stopColor={topColor} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((p) => (
        <line
          key={p}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH * p}
          y2={padT + innerH * p}
          stroke={EMERALD.grid}
          strokeDasharray="2 4"
        />
      ))}

      {categories.map((c, i) => {
        const cx = padL + i * groupWidth + groupWidth / 2;
        const bH = (bottom[i] / max) * innerH;
        const tH = (top[i] / max) * innerH;
        const bY = padT + innerH - bH;
        const tY = bY - tH;
        return (
          <g key={c}>
            <rect x={cx - barWidth / 2} y={tY} width={barWidth} height={tH} rx="3" fill="url(#stk-t)" />
            <rect x={cx - barWidth / 2} y={bY} width={barWidth} height={bH} rx="3" fill="url(#stk-b)" />
            <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500" fontSize="9">
              {c}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Annual Sales Chart (premium, interactive) ───────────────────────
   Smooth area + previous-year baseline + crosshair + tooltip.
   Dipakai pada kartu "Total Penjualan" tahunan.
   ─────────────────────────────────────────────────────────────────── */
export function AnnualSalesChart({
  current,
  previous,
  labels,
  height = 260,
  currentYearLabel = "Tahun ini",
  previousYearLabel = "Tahun lalu",
  formatValue,
  yTickFormat,
}: {
  current: number[];
  previous: number[];
  labels: string[];
  height?: number;
  currentYearLabel?: string;
  previousYearLabel?: string;
  formatValue?: (v: number) => string;
  yTickFormat?: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const padL = 44;
  const padR = 20;
  const padT = 28;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const rawMax = Math.max(...current, ...previous, 0);

  // ── Auto-fit Y-axis dengan log-scale "nice ceil" + headroom. ──
  // Bin step lama (25/100/200/...) terlalu kasar untuk agent yang
  // pendapatannya masih kecil — peak Rp 1,5 jt ke-render seperti datar
  // di scale 0–25 jt. Algoritma ini cari step yang menghasilkan ~5 tick
  // line dengan kelipatan "bulat" (1, 2, 2.5, 5, 10) × 10^n, lalu
  // tambah 10% headroom supaya peak tidak nempel ke atas chart.
  // Hasilnya: peak Rp 1,5 jt sekarang nge-render fill ~75% tinggi
  // chart — visualnya terasa SUBSTANTIAL, bukan datar.
  const niceMax = useMemo(() => {
    if (rawMax <= 0) return 1;
    const padded = rawMax * 1.1; // 10% headroom
    const targetTicks = 5;
    const rough = padded / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / magnitude;
    const stepFactor =
      norm <= 1 ? 1 :
      norm <= 2 ? 2 :
      norm <= 2.5 ? 2.5 :
      norm <= 5 ? 5 :
      10;
    const step = stepFactor * magnitude;
    return Math.ceil(padded / step) * step;
  }, [rawMax]);

  const xFor = (i: number) =>
    padL + (i / Math.max(labels.length - 1, 1)) * innerW;
  const yFor = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const curPts = current.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const prevPts = previous.map((v, i) => ({ x: xFor(i), y: yFor(v) }));

  const curArea =
    `${smoothPath(curPts)} L ${xFor(curPts.length - 1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  // Tick values di-leave sebagai float; formatter (yTickFormat) yang
  // tau cara nampilin "0,5 jt" vs "500 rb" vs "1,5 M". Math.round lama
  // bikin tick 0.5 / 1.5 collapse ke int — ngebreak axis di scale kecil.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => niceMax * p);

  const peakIdx = current.indexOf(Math.max(...current));
  const avg = current.reduce((a, b) => a + b, 0) / Math.max(current.length, 1);
  const avgY = yFor(avg);

  const fmtTick = yTickFormat ?? ((v: number) => String(v));
  const fmtVal = formatValue ?? ((v: number) => String(v));

  const updateHover = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (clientX - rect.left) * scaleX;
    if (mx < padL - 4 || mx > W - padR + 4) {
      setHoverIdx(null);
      return;
    }
    const ratio = (mx - padL) / innerW;
    const idx = Math.round(ratio * (labels.length - 1));
    setHoverIdx(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  const tooltipX = hoverIdx !== null ? (xFor(hoverIdx) / W) * 100 : 0;
  const flipLeft = hoverIdx !== null && hoverIdx > labels.length * 0.65;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none touch-none"
        onMouseMove={(e) => updateHover(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => updateHover(e.touches[0].clientX)}
        onTouchMove={(e) => updateHover(e.touches[0].clientX)}
        // Sengaja TIDAK clear hover di touchEnd supaya tooltip nempel
        // setelah tap di mobile/tablet — user butuh waktu baca angkanya
        // tanpa harus tahan jari di chart. Tap di luar data area atau
        // tap bulan lain otomatis akan update / clear lewat updateHover.
      >
        <defs>
          <linearGradient id="annual-cur-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={EMERALD.primary} stopOpacity="0.55" />
            <stop offset="60%"  stopColor={EMERALD.primary} stopOpacity="0.18" />
            <stop offset="100%" stopColor={EMERALD.primary} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="annual-cur-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={EMERALD.bright} />
            <stop offset="100%" stopColor={EMERALD.primary} />
          </linearGradient>
          <filter id="annual-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* horizontal grid + y-axis labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="2 6"
            />
            <text
              x={padL - 10}
              y={yFor(t) + 3}
              textAnchor="end"
              fontSize="9"
              className="fill-slate-600"
              style={{ letterSpacing: "0.04em" }}
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {/* average reference line */}
        <line
          x1={padL}
          x2={W - padR}
          y1={avgY}
          y2={avgY}
          stroke={EMERALD.primary}
          strokeOpacity="0.28"
          strokeDasharray="1 4"
          strokeWidth="1"
        />
        <text
          x={W - padR - 4}
          y={avgY - 4}
          textAnchor="end"
          fontSize="8.5"
          className="fill-emerald-400/60"
          style={{ letterSpacing: "0.1em" }}
        >
          AVG
        </text>

        {/* previous year (dashed line, no fill) */}
        <path
          d={smoothPath(prevPts)}
          fill="none"
          stroke="rgba(148,163,184,0.55)"
          strokeWidth="1.4"
          strokeDasharray="4 4"
        />

        {/* current year area + line */}
        <path d={curArea} fill="url(#annual-cur-area)" />
        <path
          d={smoothPath(curPts)}
          fill="none"
          stroke="url(#annual-cur-stroke)"
          strokeWidth="2.4"
          strokeLinecap="round"
          filter="url(#annual-glow)"
        />

        {/* peak month annotation */}
        {peakIdx >= 0 && (
          <g>
            <circle
              cx={xFor(peakIdx)}
              cy={yFor(current[peakIdx])}
              r="6"
              fill="none"
              stroke={EMERALD.primary}
              strokeOpacity="0.35"
              strokeWidth="6"
            />
            <circle
              cx={xFor(peakIdx)}
              cy={yFor(current[peakIdx])}
              r="3.6"
              fill="#0c1014"
              stroke={EMERALD.bright}
              strokeWidth="2"
            />
          </g>
        )}

        {/* hover crosshair */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={padT}
              y2={padT + innerH}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={xFor(hoverIdx)}
              cy={yFor(current[hoverIdx])}
              r="9"
              fill={EMERALD.primary}
              fillOpacity="0.18"
            />
            <circle
              cx={xFor(hoverIdx)}
              cy={yFor(current[hoverIdx])}
              r="4"
              fill="#0c1014"
              stroke={EMERALD.bright}
              strokeWidth="2"
            />
            <circle
              cx={xFor(hoverIdx)}
              cy={yFor(previous[hoverIdx])}
              r="3"
              fill="#0c1014"
              stroke="rgba(148,163,184,0.7)"
              strokeWidth="1.4"
            />
          </g>
        )}

        {/* x labels */}
        {labels.map((l, i) => {
          const isActive = hoverIdx === i;
          const isPeak = i === peakIdx && hoverIdx === null;
          return (
            <text
              key={l + i}
              x={xFor(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize={isActive ? "10" : "9"}
              fontWeight={isActive || isPeak ? 700 : 500}
              className={
                isActive
                  ? "fill-emerald-300"
                  : isPeak
                  ? "fill-emerald-400/80"
                  : "fill-slate-500"
              }
              style={{ letterSpacing: "0.08em", transition: "all 200ms" }}
            >
              {l.toUpperCase()}
            </text>
          );
        })}
      </svg>

      {/* tooltip overlay */}
      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${tooltipX}%`,
            top: 8,
            transform: flipLeft
              ? "translate(calc(-100% + 16px), 0)"
              : "translate(-50%, 0)",
          }}
        >
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0f12]/95 px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-md min-w-[170px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {labels[hoverIdx]}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-[10px] text-slate-400">{currentYearLabel}</span>
              </div>
              <span className="text-xs font-bold text-emerald-300 tabular-nums">
                {fmtVal(current[hoverIdx])}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-2.5 rounded-full bg-slate-500" />
                <span className="text-[10px] text-slate-400">{previousYearLabel}</span>
              </div>
              <span className="text-xs font-semibold text-slate-300 tabular-nums">
                {fmtVal(previous[hoverIdx])}
              </span>
            </div>
            {previous[hoverIdx] > 0 && (
              <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    current[hoverIdx] >= previous[hoverIdx]
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {current[hoverIdx] >= previous[hoverIdx] ? "▲" : "▼"}{" "}
                  {Math.abs(
                    ((current[hoverIdx] - previous[hoverIdx]) /
                      previous[hoverIdx]) *
                      100
                  ).toFixed(1)}
                  %
                </span>
                <span className="ml-1 text-[10px] text-slate-500">
                  vs {previousYearLabel.toLowerCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   MonthlyBarsCompare — grouped vertical bars per month untuk dua tahun.
   Mirip "volume bar" di trading view (Binance/Stockbit): tiap bulan
   punya sepasang bar berdampingan, bar "current" diberi emerald glow,
   bar "previous" silver halus. Hover crosshair menampilkan tooltip
   ringkas dengan delta YoY per bulan.
   ──────────────────────────────────────────────────────────────────── */
export function MonthlyBarsCompare({
  current,
  previous,
  labels,
  height = 220,
  currentYearLabel = "Tahun ini",
  previousYearLabel = "Tahun lalu",
  formatValue,
  yTickFormat,
}: {
  current: number[];
  previous: number[];
  labels: string[];
  height?: number;
  currentYearLabel?: string;
  previousYearLabel?: string;
  formatValue?: (v: number) => string;
  yTickFormat?: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height;
  const padL = 40;
  const padR = 16;
  const padT = 24;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(labels.length, 1);

  const max = Math.max(...current, ...previous, 1);
  const niceMax = useMemo(() => {
    const step =
      max <= 100 ? 25 :
      max <= 500 ? 100 :
      max <= 1000 ? 200 :
      max <= 5000 ? 500 :
      1000;
    return Math.ceil(max / step) * step;
  }, [max]);

  const slot = innerW / n;
  // 70% of slot dipakai untuk bar pair, sisanya gap antar bulan
  const barPairW = slot * 0.7;
  const barW = barPairW / 2 - 1;
  const xLeft = (i: number) => padL + slot * i + (slot - barPairW) / 2;
  const yFor = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const ticks = [0, 0.5, 1].map((p) => Math.round(niceMax * p));

  const fmtTick = yTickFormat ?? ((v: number) => String(v));
  const fmtVal = formatValue ?? ((v: number) => String(v));

  const updateHover = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (clientX - rect.left) * scaleX;
    if (mx < padL - 4 || mx > W - padR + 4) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.floor((mx - padL) / slot);
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  };

  const tooltipX = hoverIdx !== null ? ((xLeft(hoverIdx) + barPairW / 2) / W) * 100 : 0;
  const flipLeft = hoverIdx !== null && hoverIdx > n * 0.65;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none touch-none"
        onMouseMove={(e) => updateHover(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => updateHover(e.touches[0].clientX)}
        onTouchMove={(e) => updateHover(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="bars-cur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={EMERALD.deep} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="bars-prev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(148,163,184,0.65)" />
            <stop offset="100%" stopColor="rgba(71,85,105,0.45)" />
          </linearGradient>
          <filter id="bars-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* horizontal grid */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="2 6"
            />
            <text
              x={padL - 8}
              y={yFor(t) + 3}
              textAnchor="end"
              fontSize="9"
              className="fill-slate-600"
              style={{ letterSpacing: "0.04em" }}
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {/* hover slot highlight — vertical strip per bulan */}
        {hoverIdx !== null && (
          <rect
            x={padL + slot * hoverIdx}
            y={padT}
            width={slot}
            height={innerH}
            fill="rgba(52,211,153,0.05)"
            rx="3"
          />
        )}

        {/* paired bars per month */}
        {labels.map((_, i) => {
          const isHover = hoverIdx === i;
          const c = current[i] ?? 0;
          const p = previous[i] ?? 0;
          const cH = (c / niceMax) * innerH;
          const pH = (p / niceMax) * innerH;
          const baseY = padT + innerH;
          return (
            <g key={i}>
              {/* previous (left) */}
              <rect
                x={xLeft(i)}
                y={baseY - pH}
                width={Math.max(barW, 1)}
                height={Math.max(pH, p > 0 ? 1 : 0)}
                fill="url(#bars-prev)"
                rx="1.5"
                opacity={isHover ? 1 : 0.85}
              />
              {/* current (right) */}
              <rect
                x={xLeft(i) + barW + 2}
                y={baseY - cH}
                width={Math.max(barW, 1)}
                height={Math.max(cH, c > 0 ? 1 : 0)}
                fill="url(#bars-cur)"
                rx="1.5"
                filter={isHover ? "url(#bars-glow)" : undefined}
              />
              {/* highlight cap on current bar when this is highest */}
              {c === Math.max(...current) && c > 0 && (
                <rect
                  x={xLeft(i) + barW + 2}
                  y={baseY - cH - 2}
                  width={Math.max(barW, 1)}
                  height={2.5}
                  fill={EMERALD.bright}
                  rx="1"
                />
              )}
            </g>
          );
        })}

        {/* x labels */}
        {labels.map((l, i) => {
          const isActive = hoverIdx === i;
          return (
            <text
              key={l + i}
              x={xLeft(i) + barPairW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize={isActive ? "10" : "9"}
              fontWeight={isActive ? 700 : 500}
              className={isActive ? "fill-emerald-300" : "fill-slate-500"}
              style={{ letterSpacing: "0.08em", transition: "all 200ms" }}
            >
              {l.toUpperCase()}
            </text>
          );
        })}
      </svg>

      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${tooltipX}%`,
            top: 4,
            transform: flipLeft
              ? "translate(calc(-100% + 16px), 0)"
              : "translate(-50%, 0)",
          }}
        >
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0f12]/95 px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-md min-w-[170px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {labels[hoverIdx]}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <span className="text-[10px] text-slate-400">{currentYearLabel}</span>
              </div>
              <span className="text-xs font-bold text-emerald-300 tabular-nums">
                {fmtVal(current[hoverIdx])}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-slate-500" />
                <span className="text-[10px] text-slate-400">{previousYearLabel}</span>
              </div>
              <span className="text-xs font-semibold text-slate-300 tabular-nums">
                {fmtVal(previous[hoverIdx])}
              </span>
            </div>
            {previous[hoverIdx] > 0 && (
              <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    current[hoverIdx] >= previous[hoverIdx]
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {current[hoverIdx] >= previous[hoverIdx] ? "▲" : "▼"}{" "}
                  {Math.abs(
                    ((current[hoverIdx] - previous[hoverIdx]) /
                      previous[hoverIdx]) *
                      100
                  ).toFixed(1)}
                  %
                </span>
                <span className="ml-1 text-[10px] text-slate-500">
                  vs {previousYearLabel.toLowerCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
