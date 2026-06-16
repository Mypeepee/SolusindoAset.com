"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

function fmt(ms: number) {
  const a = Math.abs(ms);
  const m = Math.floor(a / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h}j ${mm}m` : `${h}j`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d}h ${hh}j` : `${d}h`;
}

/**
 * Live SLA countdown derived from a real deadline (ISO). Ticks every 30s.
 * Color escalates as the deadline approaches, turns red & pulses when overdue.
 */
export function SlaBadge({ deadline, size = "sm" }: { deadline: string; size?: "sm" | "md" }) {
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (Number.isNaN(target)) return null;
  const diff = target - now;
  const overdue = diff < 0;
  const mins = diff / 60_000;

  const cls = overdue
    ? "border-rose-400/40 bg-rose-500/[0.12] text-rose-300"
    : mins < 60
    ? "border-amber-400/40 bg-amber-500/[0.12] text-amber-300"
    : mins < 360
    ? "border-sky-400/30 bg-sky-500/[0.1] text-sky-300"
    : "border-white/[0.1] bg-white/[0.03] text-slate-400";

  const pad = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[9.5px]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border font-extrabold tabular-nums ${cls} ${pad}`}>
      <Icon
        icon={overdue ? "solar:alarm-bold" : "solar:clock-circle-bold"}
        className={`${size === "md" ? "text-sm" : "text-[11px]"} ${overdue ? "animate-pulse" : ""}`}
      />
      {overdue ? `Lewat ${fmt(diff)}` : `Sisa ${fmt(diff)}`}
    </span>
  );
}
