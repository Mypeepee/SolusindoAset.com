"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  LayoutGrid,
  List,
  Search,
  ChevronRight,
  Lock,
  Clock,
  FilePenLine,
  Calendar,
  X,
  Layers,
  Menu,
} from "lucide-react";
import type { SuratTemplate, SuratPhase } from "./data";
import { suratPhases } from "./data";

// ── Phase palette ───────────────────────────────────────────────────────────

const PHASE = {
  "pra-kesepakatan": {
    num:        "text-amber-400",
    folder:     "text-amber-400",
    border:     "border-amber-500/20",
    bg:         "bg-amber-500/10",
    text:       "text-amber-300",
    dot:        "bg-amber-400",
    pill:       "border-amber-500/20 bg-amber-500/10 text-amber-300",
    topBar:     "from-amber-500/80 via-amber-400/25 to-transparent",
    glow:       "hover:shadow-[0_20px_48px_-12px_rgba(245,158,11,0.16)]",
    sideActive: "border-l-[3px] border-amber-500/60 bg-amber-500/[0.08]",
    cta:        "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
    bannerBg:   "bg-amber-500/[0.06] border-amber-500/10",
    chip:       "border-amber-500/30 bg-amber-500/15 text-amber-300",
    chipInactive:"border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
  },
  "pengurusan-dokumen": {
    num:        "text-sky-400",
    folder:     "text-sky-400",
    border:     "border-sky-500/20",
    bg:         "bg-sky-500/10",
    text:       "text-sky-300",
    dot:        "bg-sky-400",
    pill:       "border-sky-500/20 bg-sky-500/10 text-sky-300",
    topBar:     "from-sky-500/80 via-sky-400/25 to-transparent",
    glow:       "hover:shadow-[0_20px_48px_-12px_rgba(14,165,233,0.16)]",
    sideActive: "border-l-[3px] border-sky-500/60 bg-sky-500/[0.08]",
    cta:        "border-sky-500/25 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
    bannerBg:   "bg-sky-500/[0.06] border-sky-500/10",
    chip:       "border-sky-500/30 bg-sky-500/15 text-sky-300",
    chipInactive:"border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
  },
  eksekusi: {
    num:        "text-violet-400",
    folder:     "text-violet-400",
    border:     "border-violet-500/20",
    bg:         "bg-violet-500/10",
    text:       "text-violet-300",
    dot:        "bg-violet-400",
    pill:       "border-violet-500/20 bg-violet-500/10 text-violet-300",
    topBar:     "from-violet-500/80 via-violet-400/25 to-transparent",
    glow:       "hover:shadow-[0_20px_48px_-12px_rgba(139,92,246,0.16)]",
    sideActive: "border-l-[3px] border-violet-500/60 bg-violet-500/[0.08]",
    cta:        "border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
    bannerBg:   "bg-violet-500/[0.06] border-violet-500/10",
    chip:       "border-violet-500/30 bg-violet-500/15 text-violet-300",
    chipInactive:"border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
  },
} as const;

type ViewMode  = "grid" | "list";
type FilterKey = "all" | SuratPhase;

type Props = {
  templates:     SuratTemplate[];
  onUseTemplate?: (template: SuratTemplate) => void;
};

// ── Root ────────────────────────────────────────────────────────────────────

export function SuratFileManager({ templates, onUseTemplate }: Props) {
  const [view,       setView]       = useState<ViewMode>("grid");
  const [filter,     setFilter]     = useState<FilterKey>("eksekusi");
  const [search,     setSearch]     = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef                   = useRef<HTMLInputElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const changeFilter = useCallback((f: FilterKey) => {
    setFilter(f);
    setDrawerOpen(false);        // close drawer after selecting on mobile
  }, []);

  const counts = useMemo(() => ({
    all:                  templates.length,
    "pra-kesepakatan":    templates.filter((t) => t.phase === "pra-kesepakatan").length,
    "pengurusan-dokumen": templates.filter((t) => t.phase === "pengurusan-dokumen").length,
    eksekusi:             templates.filter((t) => t.phase === "eksekusi").length,
  }), [templates]);

  const visible = useMemo(() => {
    const base = filter === "all"
      ? [...templates]
      : templates.filter((t) => t.phase === filter);

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)  ||
        t.description.toLowerCase().includes(q),
    );
  }, [templates, filter, search]);

  const activePhase =
    filter !== "all" ? suratPhases.find((p) => p.id === filter) : null;

  const folderLabel =
    filter === "all"
      ? "Semua Dokumen"
      : suratPhases.find((p) => p.id === filter)?.title ?? "";

  const activeCount  = templates.filter((t) => !t.comingSoon).length;
  const soonCount    = templates.filter((t) => Boolean(t.comingSoon)).length;
  const progressPct  = Math.round((activeCount / Math.max(counts.all, 1)) * 100);

  // ── Sidebar content (shared between desktop & mobile drawer) ──────────────

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(20,184,166,0.15))" }}
        >
          <FileText className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-white">Dokumen Hukum</p>
          <p className="text-[11px] text-slate-500">{counts.all} template</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {/* Semua */}
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={() => changeFilter("all")}
            className={[
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
              filter === "all"
                ? "bg-white/[0.07] text-white"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
            ].join(" ")}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-[13px] font-medium">Semua Dokumen</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              filter === "all" ? "bg-white/10 text-white" : "text-slate-600"
            }`}>
              {counts.all}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="my-3 px-5">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Fase</span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>
        </div>

        {/* Phase folders */}
        <div className="space-y-1 px-3">
          {suratPhases.map((phase) => {
            const c        = PHASE[phase.id];
            const isActive = filter === phase.id;
            const count    = counts[phase.id as keyof typeof counts] ?? 0;

            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => changeFilter(phase.id)}
                className={[
                  "group w-full rounded-xl px-3 py-3 text-left transition-all duration-150",
                  isActive
                    ? c.sideActive
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isActive
                      ? <FolderOpen className={`h-4 w-4 ${c.folder}`} />
                      : <Folder    className="h-4 w-4 group-hover:text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span
                        className={`text-[13px] font-semibold leading-snug ${isActive ? "text-white" : ""}`}
                        style={{ whiteSpace: "normal", wordBreak: "break-word" }}
                      >
                        {phase.title}
                      </span>
                      <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? `${c.bg} ${c.text}` : "text-slate-700"
                      }`}>
                        {count}
                      </span>
                    </div>
                    <p className={`mt-0.5 text-[11px] leading-snug ${isActive ? "text-slate-400" : "text-slate-600"}`}>
                      {phase.subtitle}
                    </p>
                  </div>
                </div>
                {/* Active dots */}
                {isActive && (
                  <div className="mt-2.5 flex gap-1 pl-7">
                    {templates
                      .filter((t) => t.phase === phase.id)
                      .map((t) => (
                        <span
                          key={t.id}
                          className={`h-1 w-5 rounded-full ${t.comingSoon ? "bg-white/10" : c.dot}`}
                        />
                      ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer stats */}
      <div className="m-3 rounded-[16px] border border-white/[0.05] p-3.5" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Progress</span>
          <span className="text-[11px] font-bold text-emerald-400">{activeCount}/{counts.all}</span>
        </div>
        <div className="overflow-hidden rounded-full bg-white/[0.06]" style={{ height: 4 }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg,#10b981,#14b8a6)",
              boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-600">
          {activeCount} siap · {soonCount} segera hadir
        </p>
      </div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile Drawer (overlay, < lg) ──────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          {/* Drawer panel */}
          <aside
            className="absolute left-0 top-0 h-full w-[272px] overflow-hidden border-r border-white/[0.07] bg-[#060f1b]"
            style={{ boxShadow: "8px 0 40px rgba(0,0,0,0.5)" }}
          >
            {/* Close row */}
            <div className="flex items-center justify-end border-b border-white/[0.06] px-4 py-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-xl border border-white/[0.07] p-2 text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main shell ─────────────────────────────────────────────────────── */}
      <div
        className="flex overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#060f1b] sm:rounded-[28px]"
        style={{
          minHeight: 520,
          boxShadow: "0 40px 120px -30px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* ── Desktop Sidebar (lg+) ─────────────────────────────────────────── */}
        <aside className="hidden w-[256px] shrink-0 flex-col border-r border-white/[0.06] lg:flex">
          {SidebarContent}
        </aside>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 sm:gap-3 sm:px-5">

            {/* Mobile: hamburger */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop breadcrumb */}
            <div className="hidden min-w-0 items-center gap-1.5 text-xs lg:flex">
              <span className="shrink-0 text-slate-500">Dokumen Hukum</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />
              <span className={`truncate font-semibold ${activePhase ? PHASE[activePhase.id].text : "text-white"}`}>
                {folderLabel}
              </span>
              <span className="ml-1 shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-400">
                {visible.length}
              </span>
            </div>

            {/* Mobile: current folder name */}
            <div className="min-w-0 flex-1 lg:hidden">
              <p className={`truncate text-sm font-semibold ${activePhase ? PHASE[activePhase.id].text : "text-white"}`}>
                {folderLabel}
              </p>
              <p className="text-[11px] text-slate-500">{visible.length} dokumen</p>
            </div>

            {/* Search */}
            <div className="hidden flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 transition-all focus-within:border-white/[0.16] focus-within:bg-white/[0.06] sm:flex">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari template..."
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="shrink-0 text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mobile search icon */}
            <button
              type="button"
              onClick={() => searchRef.current?.focus()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white sm:hidden"
              aria-label="Cari"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* View toggle */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded-lg p-1.5 transition ${view === "grid" ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"}`}
                aria-label="Grid"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-lg p-1.5 transition ${view === "list" ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-400"}`}
                aria-label="List"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile search bar (below toolbar, < sm) */}
          <div className="border-b border-white/[0.05] px-4 py-2.5 sm:hidden">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari template..."
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="shrink-0 text-slate-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile & Tablet phase chips (< lg) */}
          <div className="hide-scrollbar flex gap-2 overflow-x-auto border-b border-white/[0.05] px-4 py-2.5 lg:hidden">
            {/* All chip */}
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition",
                filter === "all"
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
              ].join(" ")}
            >
              <Layers className="h-3 w-3" />
              Semua
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold">{counts.all}</span>
            </button>

            {/* Phase chips */}
            {suratPhases.map((phase) => {
              const c        = PHASE[phase.id];
              const isActive = filter === phase.id;
              const count    = counts[phase.id as keyof typeof counts] ?? 0;

              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setFilter(phase.id)}
                  className={[
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition",
                    isActive ? c.chip : c.chipInactive,
                  ].join(" ")}
                >
                  {isActive
                    ? <FolderOpen className="h-3 w-3" />
                    : <Folder     className="h-3 w-3" />}
                  {phase.title}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${isActive ? "bg-white/20" : "bg-white/[0.06]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Phase description banner */}
          {activePhase && (
            <div className={`flex items-center gap-3 border-b px-4 py-2.5 sm:px-5 ${PHASE[activePhase.id].bannerBg}`}>
              <span className={`shrink-0 font-mono text-[11px] font-black ${PHASE[activePhase.id].num}`}>
                {activePhase.number}
              </span>
              <div className="h-3 w-px bg-white/[0.1]" />
              <p className="text-[11px] leading-relaxed text-slate-400 sm:text-[12px]">
                {activePhase.description}
              </p>
            </div>
          )}

          {/* Documents */}
          <div className="custom-scrollbar flex-1 overflow-y-auto p-3 sm:p-5">
            {visible.length === 0 ? (
              <EmptyState search={search} />
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((t) => (
                  <DocCard key={t.id} template={t} onUse={onUseTemplate} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map((t) => (
                  <DocRow key={t.id} template={t} onUse={onUseTemplate} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07]"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        {search ? <Search className="h-6 w-6 text-slate-600" /> : <Folder className="h-6 w-6 text-slate-600" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-400">
          {search ? "Tidak ditemukan" : "Folder kosong"}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada template di fase ini"}
        </p>
      </div>
    </div>
  );
}

// ── Document Card (Grid) ────────────────────────────────────────────────────

function DocCard({
  template,
  onUse,
}: {
  template: SuratTemplate;
  onUse?: (t: SuratTemplate) => void;
}) {
  const locked = Boolean(template.comingSoon);
  const c      = PHASE[template.phase];
  const phase  = suratPhases.find((p) => p.id === template.phase)!;
  const Icon   = template.icon;

  return (
    <article
      className={[
        "group relative flex flex-col overflow-hidden rounded-[18px] border transition-all duration-200 sm:rounded-[20px]",
        locked
          ? "border-white/[0.04] bg-[#070e1b] opacity-55"
          : `border-white/[0.07] bg-[#070e1b] hover:border-white/[0.13] ${c.glow}`,
      ].join(" ")}
    >
      {/* Phase color bar */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${c.topBar}`} />

      {/* Thumbnail — compact on mobile */}
      <div
        className="relative flex items-center justify-center px-6 py-5 sm:py-7"
        style={{ background: "linear-gradient(180deg,#060d1a 0%,#070e1b 100%)" }}
      >
        {/* Paper shape */}
        <div
          className={[
            "relative flex flex-col overflow-hidden rounded-lg border shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] transition-transform duration-200",
            c.border,
            locked ? "" : "group-hover:scale-105",
          ].join(" ")}
          style={{
            width: 64,
            height: 80,
            background: "linear-gradient(160deg,#07111f,#050c18)",
          }}
        >
          {/* Fold corner */}
          <div
            className={`absolute right-0 top-0 h-[16px] w-[16px] border-b border-l ${c.border}`}
            style={{
              background: "linear-gradient(225deg,#060d1a 50%,transparent 50%)",
              borderBottomLeftRadius: 3,
            }}
          />
          {/* Icon */}
          <div className={`mt-5 flex justify-center ${c.text} opacity-70 transition-opacity group-hover:opacity-100`}>
            <Icon className="h-4 w-4" />
          </div>
          {/* Lines */}
          <div className="mt-2.5 flex-1 space-y-[3.5px] px-1.5 pb-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-px rounded-full bg-white/[0.07]"
                style={{ width: i % 3 === 2 ? "60%" : "100%" }}
              />
            ))}
          </div>
        </div>

        {/* Status badge */}
        <div className="absolute right-3 top-3">
          {locked ? (
            <span className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-[#060e1b] px-2 py-0.5 text-[10px] text-slate-600">
              <Lock className="h-2.5 w-2.5" /> Soon
            </span>
          ) : template.status === "Baru" ? (
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              Baru
            </span>
          ) : template.status === "Populer" ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Populer
            </span>
          ) : null}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-0.5">
        {/* Phase pill */}
        <span className={`inline-flex self-start rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${c.pill}`}>
          {phase.subtitle}
        </span>

        {/* Title */}
        <h3 className="mt-2 text-[13px] font-semibold leading-snug text-white line-clamp-2">
          {template.title}
        </h3>

        {/* Description — hide on very small on grid, visible on list */}
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
          {template.description}
        </p>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-600">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{template.updatedAt}</span>
          <span className="h-3 w-px bg-white/[0.08]" />
          <span>{template.usedCount}× digunakan</span>
        </div>

        {/* CTA */}
        <div className="mt-3.5">
          {locked ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.05] px-3.5 py-2.5 text-[11px] font-medium text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              Segera Hadir
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onUse?.(template)}
              className={[
                "inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.98]",
                c.cta,
              ].join(" ")}
            >
              <FilePenLine className="h-3.5 w-3.5" />
              Gunakan Template
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Document Row (List) ─────────────────────────────────────────────────────

function DocRow({
  template,
  onUse,
}: {
  template: SuratTemplate;
  onUse?: (t: SuratTemplate) => void;
}) {
  const locked = Boolean(template.comingSoon);
  const c      = PHASE[template.phase];
  const Icon   = template.icon;

  return (
    <div
      className={[
        "group flex items-center gap-3 rounded-[14px] border px-3.5 py-3 transition-all duration-150 sm:gap-4 sm:px-4 sm:py-3.5",
        locked
          ? "border-white/[0.04] bg-white/[0.01] opacity-55"
          : `border-white/[0.06] bg-white/[0.025] hover:border-white/[0.11] hover:bg-white/[0.04] ${c.glow}`,
      ].join(" ")}
    >
      {/* Accent bar */}
      <div className={`h-8 w-[3px] shrink-0 rounded-full ${locked ? "bg-slate-800" : c.dot} opacity-80`} />

      {/* Icon */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border ${c.border} ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>

      {/* Title + desc */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white sm:text-sm">
          {template.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {template.description}
        </p>
      </div>

      {/* Date (tablet+) */}
      <div className="hidden shrink-0 items-center gap-1 text-[11px] text-slate-600 md:flex">
        <Calendar className="h-3 w-3" />
        {template.updatedAt}
      </div>

      {/* Action */}
      <div className="shrink-0">
        {locked ? (
          <span className="flex items-center gap-1 rounded-full border border-white/[0.05] px-2.5 py-1.5 text-[10px] text-slate-600">
            <Lock className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">Soon</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onUse?.(template)}
            className={[
              "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition active:scale-[0.97] sm:px-4",
              c.cta,
            ].join(" ")}
          >
            <FilePenLine className="h-3 w-3" />
            <span className="hidden xs:inline sm:inline">Gunakan</span>
          </button>
        )}
      </div>
    </div>
  );
}
