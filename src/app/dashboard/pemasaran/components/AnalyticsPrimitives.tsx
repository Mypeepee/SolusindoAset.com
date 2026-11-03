"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import type { AnalyticsMetric } from "@/lib/marketing/analytics";
import { Chart } from "./MarketingIcons";

export const analyticNumber = (n: number | null | undefined, decimals = 0) => n == null
  ? "Belum tersedia" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: decimals }).format(n);
export const shortNumber = (n: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const metricLabel = (metric: AnalyticsMetric, whatsapp: boolean) => metric === "views"
  ? whatsapp ? "Views teramati" : "Views" : metric === "likes" ? whatsapp ? "Reaksi teramati" : "Like" : whatsapp ? "Balasan teramati" : "Komentar";
export const tones = ["mint", "sky", "rose", "violet", "amber", "teal"] as const;

export function AnalyticsPanel({ children, className = "", tone, label }: {
  children: ReactNode; className?: string; tone?: string; label?: string;
}) {
  const reduced = useReducedMotionPreference();
  return <motion.section className={`analytics-panel ${className}`} data-tone={tone} aria-label={label}
    initial={reduced ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: .05 }} transition={{ duration: .8, ease: [.22, 1, .36, 1] }}>
    <div className="analytics-panel-core">{children}</div>
  </motion.section>;
}
export function AnalyticsEmpty({ title, children, icon = <Chart size={23} /> }: {
  title: string; children: ReactNode; icon?: ReactNode;
}) {
  return <div className="analytics-empty"><span className="analytics-empty-icon">{icon}</span><h4>{title}</h4><p>{children}</p></div>;
}
export function AnalyticsTag({ children, tone = "mint" }: { children: ReactNode; tone?: string }) {
  return <span className="analytics-tag" data-tone={tone}>{children}</span>;
}
