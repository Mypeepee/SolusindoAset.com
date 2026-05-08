"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { suratTemplates, type SuratTemplate } from "../../surat/components/data";

type FolderColor = "emerald" | "blue" | "amber";

function getFolderColor(category: string): { color: FolderColor; icon: string } {
  const cat = category.toLowerCase();
  if (cat.includes("litigasi") || cat.includes("eksekusi") || cat.includes("pengosongan") || cat.includes("pengadilan")) {
    return { color: "amber", icon: "solar:document-text-bold-duotone" };
  }
  if (cat.includes("notaris") || cat.includes("ppat") || cat.includes("pengurusan") || cat.includes("legalitas")) {
    return { color: "blue", icon: "solar:notes-bold-duotone" };
  }
  return { color: "emerald", icon: "solar:card-transfer-bold-duotone" };
}

const COLOR_CLASSES: Record<FolderColor, { badge: string; badgeText: string; icon: string }> = {
  emerald: {
    badge:     "bg-emerald-500/12 ring-1 ring-emerald-500/25",
    badgeText: "text-emerald-200",
    icon:      "text-emerald-300",
  },
  blue: {
    badge:     "bg-blue-500/12 ring-1 ring-blue-500/25",
    badgeText: "text-blue-200",
    icon:      "text-blue-300",
  },
  amber: {
    badge:     "bg-amber-500/12 ring-1 ring-amber-500/25",
    badgeText: "text-amber-200",
    icon:      "text-amber-300",
  },
};

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-emerald-400/25 text-emerald-200 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SuratSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  const results = useMemo<SuratTemplate[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return suratTemplates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  useEffect(() => {
    setHighlighted(0);
  }, [results]);

  function selectTemplate(t: SuratTemplate) {
    router.push(`/dashboard/surat?template=${t.id}`);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlighted]) selectTemplate(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const showDropdown = open && results.length > 0;

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className={[
        "flex items-center gap-2 rounded-2xl border bg-[#07090f] px-4 py-3 transition-all",
        showDropdown
          ? "border-emerald-500/40 shadow-[0_0_0_3px_rgba(52,211,153,0.08)]"
          : "border-white/8 hover:border-white/15",
      ].join(" ")}>
        <Icon
          icon="solar:magnifer-bold-duotone"
          className="shrink-0 text-xl text-emerald-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Cari template surat… (cth: eksekusi, akte grosse)"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            className="shrink-0 text-slate-500 hover:text-slate-200 transition"
          >
            <Icon icon="solar:close-circle-bold" className="text-base" />
          </button>
        )}
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘</kbd>
          <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">K</kbd>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.75)] ring-1 ring-white/5">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
              <Icon icon="solar:document-text-bold-duotone" className="text-sm text-zinc-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Template Surat — {results.length} hasil
              </p>
            </div>

            {/* Results */}
            <ul ref={listRef} className="max-h-[340px] overflow-y-auto p-1.5">
              {results.map((t, i) => {
                const { color, icon } = getFolderColor(t.category);
                const c = COLOR_CLASSES[color];
                const isHl = i === highlighted;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => selectTemplate(t)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                        isHl ? "bg-zinc-800/70" : "hover:bg-zinc-800/40",
                      ].join(" ")}
                    >
                      {/* Icon */}
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c.badge}`}>
                        <Icon icon={icon} className={`text-lg ${c.icon}`} />
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-white">
                          <HighlightMatch text={t.title} query={query} />
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          <span className={`font-mono font-bold ${c.badgeText}`}>{t.code}</span>
                          {" · "}
                          <HighlightMatch text={t.category} query={query} />
                        </p>
                      </div>

                      {/* Status */}
                      <span className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1",
                        t.status === "Populer"
                          ? "bg-emerald-500/12 text-emerald-300 ring-emerald-500/25"
                          : t.status === "Baru"
                          ? "bg-cyan-500/12 text-cyan-300 ring-cyan-500/25"
                          : "bg-zinc-700/40 text-zinc-400 ring-zinc-700/40",
                      ].join(" ")}>
                        {t.status}
                      </span>

                      {/* Arrow */}
                      <Icon
                        icon="solar:arrow-right-bold"
                        className={`shrink-0 text-xs transition-opacity ${isHl ? "text-emerald-400 opacity-100" : "opacity-0"}`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="border-t border-zinc-800/60 px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono">↑↓</kbd>
                <span>navigasi</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono">↵</kbd>
                <span>buka</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 font-mono">Esc</kbd>
                <span>tutup</span>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => { router.push("/dashboard/surat"); setQuery(""); setOpen(false); }}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-300 transition"
                >
                  <Icon icon="solar:folder-with-files-bold-duotone" className="text-sm" />
                  Lihat semua template
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No results hint */}
      {open && query.trim() && results.length === 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
            <Icon icon="solar:magnifer-bold-duotone" className="text-3xl text-zinc-700 mx-auto" />
            <p className="mt-2 text-sm font-black text-zinc-400">Tidak ditemukan</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              Tidak ada template yang cocok dengan &ldquo;{query}&rdquo;
            </p>
          </div>
        </>
      )}
    </div>
  );
}
