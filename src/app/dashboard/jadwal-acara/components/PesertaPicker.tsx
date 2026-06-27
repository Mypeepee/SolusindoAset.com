"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

/* ────────────────────────────────────────────────────────────────────
   PesertaPicker — multi-select autocomplete untuk invite peserta ke
   sebuah acara di kalender.

   Pattern: chip-style input. User klik field → dropdown muncul (portaled
   ke <body> supaya escape modal stacking) → ketik buat search →
   pilih agent → chip muncul di field. X di chip buat hapus.

   Backed by /api/dashboard/agents/search.
   ──────────────────────────────────────────────────────────────────── */

export interface PesertaOption {
  id_agent: string;
  nama_lengkap: string;
  email: string | null;
  nama_kantor: string;
  kota_area: string;
  foto_profil_url: string | null;
  /** Jabatan agent — dipakai untuk grouping section di dropdown.
   *  "Manajemen" untuk PRINCIPAL/OWNER/STOKER/ADMIN/TEAMLEADER,
   *  selain itu masuk ke "Agent". */
  jabatan?: string;
}

/** Kategori section dropdown — derived dari jabatan_agent_enum. */
function jabatanCategory(jabatan?: string): "manajemen" | "agent" {
  if (!jabatan) return "agent";
  const up = jabatan.toUpperCase();
  return up === "PRINCIPAL" ||
    up === "OWNER" ||
    up === "STOKER" ||
    up === "ADMIN" ||
    up === "TEAMLEADER"
    ? "manajemen"
    : "agent";
}

interface PesertaPickerProps {
  value: PesertaOption[];
  onChange: (next: PesertaOption[]) => void;
  /** View mode (read-only) — sembunyiin search input, hanya tampil chip. */
  readOnly?: boolean;
  /** Placeholder text untuk input. */
  placeholder?: string;
  /** Maks. jumlah peserta. Default 20. */
  max?: number;
}

function normalizeDriveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  // Bare Drive ID → proxy lokal (avoid 429 dari Drive CDN)
  return `/api/drive-image?id=${trimmed}&sz=w64`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function PesertaPicker({
  value,
  onChange,
  readOnly = false,
  placeholder = "Ketik nama agent untuk di-invite…",
  max = 20,
}: PesertaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PesertaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const reactId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounced search — request agent list 250ms setelah user berhenti ngetik
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        params.set("limit", "20");
        const res = await fetch(
          `/api/dashboard/agents/search?${params.toString()}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }
        setResults(json.data as PesertaOption[]);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Gagal memuat agent");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open]);

  // Position dropdown via fixed coords (portal escapes modal stacking)
  useLayoutEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Close on Escape / click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selectedIds = useMemo(
    () => new Set(value.map((v) => v.id_agent)),
    [value],
  );

  const handleAdd = useCallback(
    (opt: PesertaOption) => {
      if (selectedIds.has(opt.id_agent)) return;
      if (value.length >= max) {
        setError(`Maksimal ${max} peserta`);
        return;
      }
      onChange([...value, opt]);
      setQuery("");
      // Tetep buka dropdown supaya user bisa lanjut nambahin
      inputRef.current?.focus();
    },
    [value, onChange, selectedIds, max],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(value.filter((v) => v.id_agent !== id));
    },
    [value, onChange],
  );

  // Backspace di input kosong → hapus chip terakhir
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "" && value.length > 0) {
      handleRemove(value[value.length - 1].id_agent);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chip field — looks like an input, but contains chips + a text input */}
      <div
        onClick={() => {
          if (readOnly) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2 text-sm transition-all ${
          readOnly
            ? "border-white/10 bg-white/5 cursor-default"
            : open
            ? "border-emerald-500/60 bg-white/10"
            : "border-white/10 bg-white/5 hover:bg-white/[0.07] cursor-text"
        }`}
      >
        {value.length === 0 && readOnly && (
          <span className="px-1 py-1 text-xs italic text-slate-500">
            Tidak ada peserta diundang
          </span>
        )}

        {value.map((p) => {
          const photo = normalizeDriveUrl(p.foto_profil_url);
          return (
            <span
              key={p.id_agent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/[0.12] py-0.5 pl-0.5 pr-1.5 text-xs font-semibold text-emerald-100"
            >
              <span className="grid h-5 w-5 flex-shrink-0 place-items-center overflow-hidden rounded-md bg-emerald-900/40">
                {photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span className="text-[8px] font-extrabold text-emerald-200">
                    {initialsOf(p.nama_lengkap)}
                  </span>
                )}
              </span>
              <span className="max-w-[140px] truncate">{p.nama_lengkap}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(p.id_agent);
                  }}
                  className="grid h-4 w-4 place-items-center rounded text-emerald-200/70 transition hover:bg-emerald-400/20 hover:text-white"
                  aria-label={`Hapus ${p.nama_lengkap}`}
                >
                  <Icon icon="solar:close-circle-bold" className="text-[12px]" />
                </button>
              )}
            </span>
          );
        })}

        {!readOnly && (
          <input
            ref={inputRef}
            id={reactId}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onInputKey}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        )}
      </div>

      {/* Helper line */}
      {!readOnly && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {value.length}/{max} peserta · acara cuma muncul di kalender owner +
          peserta yang diundang
        </p>
      )}

      {/* Portal dropdown — z-index sengaja dipasang di [10000]+ supaya
          DI ATAS modal-acara (yang pakai z-[9998]/[9999]). Tanpa ini,
          scrim PesertaPicker ke-block sama modal content dan dropdown
          ga bisa ditutup dengan click di luar. */}
      {open && !readOnly && mounted && pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[10001] max-h-80 overflow-hidden rounded-2xl border border-white/[0.14] p-1 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150"
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 320),
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%), rgba(12,18,23,0.92)",
              }}
            >
              <div className="max-h-[19rem] overflow-y-auto">
                {loading ? (
                  <div className="space-y-1.5 p-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2"
                      >
                        <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.06]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                          <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 p-3 text-[11px] text-rose-300">
                    <Icon
                      icon="solar:danger-triangle-bold-duotone"
                      className="text-[14px]"
                    />
                    {error}
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1 px-4 py-6 text-center">
                    <Icon
                      icon="solar:user-cross-bold-duotone"
                      className="text-2xl text-slate-600"
                    />
                    <p className="text-xs font-semibold text-slate-300">
                      {query.trim()
                        ? "Tidak ada agent yang cocok"
                        : "Belum ada agent untuk di-invite"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Coba kata kunci nama atau ID agent
                    </p>
                  </div>
                ) : (
                  (() => {
                    // Group by category. Manajemen dulu (lebih senior),
                    // lalu Agent. Section header pakai gradient bar +
                    // icon biar visually jelas.
                    const manajemen = results.filter(
                      (o) => jabatanCategory(o.jabatan) === "manajemen",
                    );
                    const agent = results.filter(
                      (o) => jabatanCategory(o.jabatan) === "agent",
                    );
                    const renderItem = (opt: PesertaOption) => {
                      const isSelected = selectedIds.has(opt.id_agent);
                      const photo = normalizeDriveUrl(opt.foto_profil_url);
                      return (
                        <button
                          key={opt.id_agent}
                          type="button"
                          disabled={isSelected}
                          onClick={() => handleAdd(opt)}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                            isSelected
                              ? "bg-emerald-500/[0.08] text-emerald-200 cursor-default opacity-70"
                              : "text-slate-200 hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <span className="relative grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/[0.08]">
                            {photo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={photo}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <span className="text-[10px] font-extrabold text-slate-300">
                                {initialsOf(opt.nama_lengkap)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">
                              {opt.nama_lengkap}
                            </span>
                            <span className="block truncate text-[10px] text-slate-500">
                              <span className="text-emerald-400/70">
                                {opt.id_agent}
                              </span>
                              {opt.jabatan && (
                                <>
                                  {" · "}
                                  <span className="text-slate-400">
                                    {opt.jabatan}
                                  </span>
                                </>
                              )}
                              {" · "}
                              {opt.nama_kantor}
                            </span>
                          </span>
                          {isSelected && (
                            <Icon
                              icon="solar:check-circle-bold"
                              className="flex-shrink-0 text-[14px] text-emerald-300"
                            />
                          )}
                        </button>
                      );
                    };

                    return (
                      <>
                        {manajemen.length > 0 && (
                          <>
                            <SectionHeader
                              icon="solar:crown-bold-duotone"
                              label="Manajemen"
                              color="amber"
                              count={manajemen.length}
                            />
                            {manajemen.map(renderItem)}
                          </>
                        )}
                        {agent.length > 0 && (
                          <>
                            <SectionHeader
                              icon="solar:users-group-rounded-bold-duotone"
                              label="Agent"
                              color="emerald"
                              count={agent.length}
                            />
                            {agent.map(renderItem)}
                          </>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/** Section divider untuk grouping di dropdown peserta. Sticky di top
 *  saat scroll supaya konteks section selalu kebaca. */
function SectionHeader({
  icon,
  label,
  color,
  count,
}: {
  icon: string;
  label: string;
  color: "amber" | "emerald";
  count: number;
}) {
  const palette = color === "amber"
    ? {
        text: "text-amber-300",
        bg: "bg-amber-500/[0.05]",
        border: "border-amber-400/15",
        chipBg: "bg-amber-500/15",
        chipText: "text-amber-200",
      }
    : {
        text: "text-emerald-300",
        bg: "bg-emerald-500/[0.05]",
        border: "border-emerald-400/15",
        chipBg: "bg-emerald-500/15",
        chipText: "text-emerald-200",
      };
  return (
    <div
      className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-2.5 py-1.5 backdrop-blur-md ${palette.bg} ${palette.border}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon icon={icon} className={`text-[13px] ${palette.text}`} />
        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
          {label}
        </span>
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${palette.chipBg} ${palette.chipText}`}
      >
        {count}
      </span>
    </div>
  );
}

export default PesertaPicker;
