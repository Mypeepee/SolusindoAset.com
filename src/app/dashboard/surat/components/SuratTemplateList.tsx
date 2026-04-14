"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Eye,
  FilePenLine,
  Lock,
  ChevronRight,
  Layers3,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { SuratTemplate } from "./data";
import { suratPhases, type SuratPhase } from "./data";

type Props = {
  templates: SuratTemplate[];
  onUseTemplate?: (template: SuratTemplate) => void;
  onPreviewTemplate?: (template: SuratTemplate) => void;
};

function StatusBadge({ status }: { status: SuratTemplate["status"] }) {
  const cls =
    status === "Populer"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : status === "Baru"
      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
      : "border-slate-700 bg-slate-800/80 text-slate-400";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export function SuratTemplateList({
  templates,
  onUseTemplate,
  onPreviewTemplate,
}: Props) {
  const [activePhase, setActivePhase] = useState<SuratPhase>("eksekusi");

  const activePhaseConfig = suratPhases.find((p) => p.id === activePhase)!;
  const phaseTemplates = templates.filter((t) => t.phase === activePhase);
  const totalActive = templates.filter((t) => !t.comingSoon).length;

  return (
    <section className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Dokumen Hukum
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
            Template Surat
          </h2>
          <p className="mt-1 max-w-lg text-sm text-slate-500">
            Kelola dokumen dari pra-kesepakatan hingga eksekusi pengosongan
            dalam satu alur kerja
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-slate-400">{totalActive} aktif</span>
          <span className="text-slate-700">·</span>
          <span>{templates.length} total</span>
        </div>
      </div>

      {/* ── Phase Pipeline ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {suratPhases.map((phase, index) => {
          const isActive = phase.id === activePhase;
          const count = templates.filter((t) => t.phase === phase.id).length;
          const activeCount = templates.filter(
            (t) => t.phase === phase.id && !t.comingSoon
          ).length;

          return (
            <div key={phase.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActivePhase(phase.id)}
                className={[
                  "group w-full rounded-[22px] border p-5 text-left transition-all duration-300",
                  isActive
                    ? `${phase.activeBorder} ${phase.activeBg} ${phase.activeGlow}`
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900",
                ].join(" ")}
              >
                {/* Number + Active badge */}
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={[
                      "text-3xl font-black tracking-tighter transition-colors duration-300",
                      isActive
                        ? phase.numberColor
                        : "text-slate-700 group-hover:text-slate-600",
                    ].join(" ")}
                  >
                    {phase.number}
                  </span>
                  {isActive && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${phase.badgeClasses}`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      Aktif
                    </span>
                  )}
                </div>

                {/* Title + subtitle */}
                <div className="mt-2.5">
                  <p
                    className={[
                      "text-sm font-semibold leading-tight transition-colors duration-300",
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-400",
                    ].join(" ")}
                  >
                    {phase.title}
                  </p>
                  <p
                    className={[
                      "mt-0.5 text-xs transition-colors duration-300",
                      isActive ? "text-slate-400" : "text-slate-700",
                    ].join(" ")}
                  >
                    {phase.subtitle}
                  </p>
                </div>

                {/* Template count indicator */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: count }).map((_, i) => (
                      <span
                        key={i}
                        className={[
                          "h-1 w-4 rounded-full transition-colors duration-300",
                          isActive
                            ? i < activeCount
                              ? phase.dotColor
                              : "bg-slate-700"
                            : "bg-slate-800",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                  <span
                    className={[
                      "text-[11px] transition-colors duration-300",
                      isActive ? "text-slate-500" : "text-slate-700",
                    ].join(" ")}
                  >
                    {count} template
                  </span>
                </div>
              </button>

              {/* Connector */}
              {index < suratPhases.length - 1 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-700" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active Phase Banner ──────────────────────────────────────────── */}
      <div
        className={[
          "rounded-[18px] border p-4 transition-all duration-300",
          activePhaseConfig.activeBorder,
          activePhaseConfig.activeBg,
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border text-xs font-black",
              activePhaseConfig.iconClasses,
            ].join(" ")}
          >
            {activePhaseConfig.number}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {activePhaseConfig.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {activePhaseConfig.description}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
            {phaseTemplates.length} template
          </span>
        </div>
      </div>

      {/* ── Template Grid ────────────────────────────────────────────────── */}
      {phaseTemplates.length === 0 ? (
        <div className="rounded-[24px] border border-slate-800 bg-slate-900/50 p-16 text-center">
          <p className="text-sm text-slate-500">
            Belum ada template di fase ini.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {phaseTemplates.map((template) => {
            const Icon = template.icon;
            const phase = suratPhases.find((p) => p.id === template.phase)!;
            const isComingSoon = Boolean(template.comingSoon);

            return (
              <article
                key={template.id}
                className={[
                  "group relative overflow-hidden rounded-[22px] border bg-slate-900/80 p-5 transition-all duration-300",
                  isComingSoon
                    ? "border-slate-800 opacity-50"
                    : `border-slate-800 ${phase.cardHover}`,
                ].join(" ")}
              >
                {/* Phase accent line at top */}
                {!isComingSoon && (
                  <div
                    className={`absolute inset-x-0 top-0 h-[2px] ${phase.accentLine}`}
                  />
                )}

                {/* Icon + badges row */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={[
                      "rounded-[14px] border p-2.5 transition-colors",
                      isComingSoon
                        ? "border-slate-700 bg-slate-800/50 text-slate-600"
                        : phase.iconClasses,
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isComingSoon && (
                      <Lock className="h-3.5 w-3.5 text-slate-600" />
                    )}
                    <StatusBadge status={template.status} />
                  </div>
                </div>

                {/* Content */}
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <Layers3 className="h-3 w-3" />
                    {template.code}
                  </span>

                  <h3 className="mt-3 text-base font-semibold leading-snug text-white">
                    {template.title}
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {template.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-5 flex items-center gap-2">
                  {isComingSoon ? (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs font-semibold text-slate-600">
                      <Clock className="h-3.5 w-3.5" />
                      Segera Hadir
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onUseTemplate?.(template)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-[0_12px_30px_-16px_rgba(16,185,129,0.6)] transition hover:bg-emerald-400"
                      >
                        <FilePenLine className="h-3.5 w-3.5" />
                        Gunakan Template
                      </button>

                      <button
                        type="button"
                        onClick={() => onPreviewTemplate?.(template)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => onUseTemplate?.(template)}
                        className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80 text-slate-300 transition hover:border-slate-700 hover:text-white"
                        aria-label={`Buka template ${template.title}`}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
