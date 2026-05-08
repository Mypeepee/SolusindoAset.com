"use client";

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
