"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import KlienFormModal from "./KlienFormModal";
import {
  formatRupiah as fmtRup,
  locFieldsToRegion,
  buildPrefPayloads,
  TIPE_ICONS,
  TIPE_LABELS,
  TUJUAN_OPTIONS,
} from "./KlienFormModal";
import { PremiumSelect, PremiumDateTimePicker, type PremiumOption } from "./CrmFormControls";
import TypePicker from "@/components/search/TypePicker";
import LocationPicker from "@/components/search/LocationPicker";
import { regionKey, type SelectedRegion } from "@/lib/regionSearch";
import {
  Klien, KlienStatus, PreferensiKlien, PreferensiForm,
  TipeProperti, JenisTransaksi, TujuanBeli,
  SUMBER_LABEL, JENIS_TRANSAKSI_LABEL, TIPE_PROPERTI_LABEL,
} from "./types";

/* Opsi jenis transaksi untuk inline edit preferensi */
const JENIS_EDIT_OPTIONS: PremiumOption[] = [
  { value: "", label: "-- Semua --" },
  ...(Object.entries(JENIS_TRANSAKSI_LABEL) as [string, string][]).map(([k, v]) => ({ value: k, label: v })),
];

/* Input style untuk inline edit preferensi */
const editInputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/40 focus:bg-white/[0.05]";

/* ────────────────────────────────────────────────────────────
   THEME — per-status visual language (futuristic glass + glow)
   ──────────────────────────────────────────────────────────── */
type StatusTheme = {
  label: string;
  icon: string;
  dot: string;        // solid dot / accent
  text: string;       // accent text
  badge: string;      // badge bg + border + text
  bar: string;        // column top accent gradient
  glow: string;       // ambient glow blob
  ring: string;       // drop target ring
  grad: string;       // avatar gradient
  shadow: string;     // ambient hover drop-shadow (status colored)
  tint: string;       // subtle surface wash (gradient start)
};

const STATUS_THEME: Record<KlienStatus, StatusTheme> = {
  lead_baru: {
    label: "Lead Baru", icon: "solar:bell-bing-bold-duotone",
    dot: "bg-rose-400", text: "text-rose-300",
    badge: "bg-rose-500/15 text-rose-200 border-rose-400/25",
    bar: "from-rose-400/0 via-rose-400/80 to-rose-400/0",
    glow: "bg-rose-500/20", ring: "ring-rose-400/50",
    grad: "from-rose-500/40 to-rose-900/10 text-rose-100 ring-rose-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(244,63,94,0.6)]",
    tint: "from-rose-500/[0.07]",
  },
  sudah_dikontak: {
    label: "Sudah Dikontak", icon: "solar:phone-calling-bold-duotone",
    dot: "bg-sky-400", text: "text-sky-300",
    badge: "bg-sky-500/15 text-sky-200 border-sky-400/25",
    bar: "from-sky-400/0 via-sky-400/80 to-sky-400/0",
    glow: "bg-sky-500/20", ring: "ring-sky-400/50",
    grad: "from-sky-500/40 to-sky-900/10 text-sky-100 ring-sky-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(56,189,248,0.6)]",
    tint: "from-sky-500/[0.07]",
  },
  hot_buyer: {
    label: "Hot Buyer", icon: "solar:fire-bold-duotone",
    dot: "bg-amber-400", text: "text-amber-300",
    badge: "bg-amber-500/15 text-amber-200 border-amber-400/25",
    bar: "from-amber-400/0 via-amber-400/80 to-amber-400/0",
    glow: "bg-amber-500/20", ring: "ring-amber-400/50",
    grad: "from-amber-500/40 to-amber-900/10 text-amber-100 ring-amber-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(245,158,11,0.6)]",
    tint: "from-amber-500/[0.08]",
  },
  closing: {
    label: "Closing", icon: "solar:cup-star-bold-duotone",
    dot: "bg-emerald-400", text: "text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
    bar: "from-emerald-400/0 via-emerald-400/80 to-emerald-400/0",
    glow: "bg-emerald-500/20", ring: "ring-emerald-400/50",
    grad: "from-emerald-500/40 to-emerald-900/10 text-emerald-100 ring-emerald-400/25",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(16,185,129,0.6)]",
    tint: "from-emerald-500/[0.07]",
  },
  lost_iseng: {
    label: "Lost / Iseng", icon: "solar:close-circle-bold-duotone",
    dot: "bg-slate-500", text: "text-slate-400",
    badge: "bg-slate-500/15 text-slate-400 border-slate-400/20",
    bar: "from-slate-400/0 via-slate-400/50 to-slate-400/0",
    glow: "bg-slate-500/10", ring: "ring-slate-400/40",
    grad: "from-slate-600/40 to-slate-900/10 text-slate-200 ring-slate-400/20",
    shadow: "group-hover:shadow-[0_26px_60px_-28px_rgba(148,163,184,0.4)]",
    tint: "from-slate-500/[0.05]",
  },
};

const PIPELINE_ORDER: KlienStatus[] = [
  "lead_baru", "sudah_dikontak", "hot_buyer", "closing", "lost_iseng",
];

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */
function formatRp(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} jt`;
  return `${n.toLocaleString("id-ID")}`;
}
function formatRpFull(n: number | null) {
  if (!n) return "—";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function followUpLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return { text: "Terlambat!", urgent: true };
  const h = diff / 3600000;
  if (h < 24) return { text: `Hari ini ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, urgent: true };
  return { text: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), urgent: false };
}

function initialsOf(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function klienValue(k: Klien) {
  return k.preferensi.reduce((max, p) => Math.max(max, p.budget_max || 0), 0);
}

/** Sumber prospek yang spesifik — diturunkan dari catatan auto-import */
const SOURCE_META: { test: RegExp; label: string; icon: string }[] = [
  { test: /Titip Jual/i,           label: "Titip Jual", icon: "solar:home-add-bold-duotone" },
  { test: /Penawaran/i,            label: "Penawaran",  icon: "solar:tag-price-bold-duotone" },
  { test: /Site Visit/i,           label: "Site Visit", icon: "solar:map-point-bold-duotone" },
  { test: /Form Website|Website/i, label: "Website",    icon: "solar:global-bold-duotone" },
  { test: /WA Organik/i,           label: "WA Organik", icon: "ic:baseline-whatsapp" },
];
function provenanceOf(k: Klien): { label: string; icon: string } {
  const c = k.catatan || "";
  for (const m of SOURCE_META) if (m.test.test(c)) return { label: m.label, icon: m.icon };
  return { label: SUMBER_LABEL[k.sumber], icon: "solar:inbox-line-bold-duotone" };
}

/** URL detail properti — konsisten dgn getPropertyUrl (slug-id, route per jenis transaksi) */
function propertiHref(p: { slug: string; id_property: string; jenis_transaksi: string }) {
  const id = `${p.slug}-${p.id_property}`;
  switch (p.jenis_transaksi?.toUpperCase()) {
    case "SEWA":   return `/Sewa/${id}`;
    case "LELANG": return `/Lelang/${id}`;
    default:       return `/Jual/${id}`; // PRIMARY, SECONDARY, CESSIE
  }
}

function waHref(phone: string, nama?: string) {
  const digits = phone.replace(/\D/g, "");
  const greet = nama ? `Halo ${nama.split(" ")[0]}, ` : "";
  return `https://wa.me/${digits}${greet ? `?text=${encodeURIComponent(greet)}` : ""}`;
}

/* ════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════ */
export default function CrmPageClient() {
  const [items, setItems]   = useState<Klien[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ]           = useState("");
  const [statusFilter, setStatusFilter] = useState<KlienStatus | "semua">("semua");
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Klien | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState<Klien | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState<string | null>(null);
  const syncedOnce = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      const res  = await fetch(`/api/dashboard/klien?${params}`);
      const json = await res.json();
      setItems(json.data || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [q]);

  // Ref so the mount-time auto-sync can call the latest load() without creating dep cycles
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const syncProspek = useCallback(async (silent = false) => {
    setSyncing(true);
    try {
      const res  = await fetch("/api/dashboard/klien/sync-prospek", { method: "POST" });
      const json = await res.json();
      await load();
      const changed = (json.created || 0) + (json.updated || 0);
      if (!silent || changed) {
        setSyncMsg(
          changed
            ? `${json.created || 0} prospek baru diimpor · ${json.updated || 0} diperbarui`
            : "Semua prospek sudah tersinkron"
        );
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } catch {
      if (!silent) { setSyncMsg("Gagal sinkronisasi prospek"); setTimeout(() => setSyncMsg(null), 4000); }
    } finally {
      setSyncing(false);
    }
  }, [load]);

  // Auto-import prospek saat halaman dibuka (sekali) — berjalan paralel dengan load() awal.
  // Hanya re-fetch jika ada data baru, mencegah triple-request (GET→POST→GET) menjadi
  // dua request paralel (GET + POST), dengan GET ketiga hanya jika ada prospek baru.
  useEffect(() => {
    if (syncedOnce.current) return;
    syncedOnce.current = true;
    fetch("/api/dashboard/klien/sync-prospek", { method: "POST" })
      .then(r => r.json())
      .then(json => {
        const changed = (json.created || 0) + (json.updated || 0);
        if (changed > 0) {
          loadRef.current();
          setSyncMsg(`${json.created || 0} prospek baru diimpor · ${json.updated || 0} diperbarui`);
          setTimeout(() => setSyncMsg(null), 4000);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── metrics (derived) ── */
  const metrics = useMemo(() => {
    const byStatus = (s: KlienStatus) => items.filter(k => k.status === s).length;
    const followUps = items.filter(k => {
      const fu = followUpLabel(k.tanggal_follow_up);
      return fu?.urgent;
    }).length;
    const pipelineValue = items
      .filter(k => k.status !== "lost_iseng" && k.status !== "closing")
      .reduce((sum, k) => sum + klienValue(k), 0);
    return {
      hot: byStatus("hot_buyer"),
      closing: byStatus("closing"),
      followUps,
      pipelineValue,
    };
  }, [items]);

  const gridItems = useMemo(() => {
    if (statusFilter === "semua") return items;
    return items.filter(k => k.status === statusFilter);
  }, [items, statusFilter]);

  function handleSaved(k: Klien) {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id_klien === k.id_klien);
      if (idx >= 0) { const n = [...prev]; n[idx] = k; return n; }
      setTotal(t => t + 1);
      return [k, ...prev];
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus klien ini?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/dashboard/klien/${id}`, { method: "DELETE" });
      setItems(prev => prev.filter(x => x.id_klien !== id));
      setTotal(t => t - 1);
      if (detailOpen?.id_klien === id) setDetailOpen(null);
    } finally {
      setDeleting(null);
    }
  }

  async function moveStatus(id: string, status: KlienStatus) {
    setItems(prev => prev.map(k => k.id_klien === id ? { ...k, status } : k));
    setDetailOpen(d => d && d.id_klien === id ? { ...d, status } : d);
    try {
      await fetch(`/api/dashboard/klien/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      load(); // resync on failure
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040608] text-white">
      {/* ── Ambient backdrop — living aurora ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="crm-aurora-1 absolute -top-44 left-[18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[80px]" />
        <div className="crm-aurora-2 absolute -top-32 right-[6%] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.18] blur-[80px]" />
        <div className="crm-aurora-3 absolute top-10 left-1/2 h-[30rem] w-[44rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.12] blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:46px_46px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_30%,transparent_75%)]" />
      </div>

      <div className="relative z-10">
        {/* ── HEADER ── */}
        <div className="sticky top-0 z-30 overflow-hidden border-b border-white/[0.08] bg-gradient-to-br from-[#0a1410]/85 via-[#070b16]/85 to-[#0c0a1a]/85 px-4 pb-4 pt-5 shadow-[0_18px_60px_-30px_rgba(16,185,129,0.45)] backdrop-blur-2xl sm:px-6">
          {/* animated top accent line */}
          <div className="crm-line pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/40 to-fuchsia-400/0 blur-[2px]" />

          <div className="relative mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 py-1 pl-1.5 pr-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90 backdrop-blur-sm">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#04130d] shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                  <Icon icon="solar:users-group-two-rounded-bold" className="text-[9px]" />
                </span>
                Workspace · CRM
                <span className="ml-0.5 inline-flex items-center gap-1 text-[9px] text-cyan-300/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </div>
              <h1 className="bg-gradient-to-br from-white via-emerald-100 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent drop-shadow-[0_2px_12px_rgba(16,185,129,0.25)] sm:text-[30px]">
                Pipeline Klien
              </h1>
              <p className="mt-0.5 text-[12px] text-slate-300/80">
                <span className="font-semibold text-emerald-300/90">{total} klien</span> · kelola perjalanan dari lead hingga closing
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => syncProspek(false)}
                disabled={syncing}
                title="Tarik prospek dari Titip Jual, WA, Penawaran & Site Visit"
                className="flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-3.5 py-2.5 text-sm font-semibold text-slate-100 transition-all hover:border-cyan-400/40 hover:bg-cyan-400/[0.08] hover:text-cyan-100 active:scale-[0.97] disabled:opacity-60"
              >
                <Icon icon="solar:refresh-bold" className={`text-base ${syncing ? "animate-spin text-cyan-300" : "text-slate-300"}`} />
                <span className="hidden md:inline">{syncing ? "Menyinkron…" : "Sinkronkan"}</span>
              </button>

              <button
                onClick={() => { setEditTarget(undefined); setShowForm(true); }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-4 py-2.5 text-sm font-bold text-[#04130d] shadow-[0_10px_34px_-8px_rgba(16,185,129,0.8)] transition-all hover:shadow-[0_14px_46px_-6px_rgba(34,211,238,0.9)] active:scale-[0.97]"
              >
                <span className="crm-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-md" />
                <Icon icon="solar:user-plus-bold" className="relative text-base transition-transform group-hover:rotate-12" />
                <span className="relative hidden sm:inline">Tambah Klien</span>
                <span className="relative sm:hidden">Tambah</span>
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="relative mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <MetricStat icon="solar:users-group-rounded-bold-duotone" label="Total Klien"
              value={total} subtitle="dalam pipeline" scheme="emerald" />
            <MetricStat icon="solar:fire-bold-duotone" label="Hot Buyer"
              value={metrics.hot} subtitle="siap dikonversi" scheme="amber" />
            <MetricStat icon="solar:cup-star-bold-duotone" label="Closing"
              value={metrics.closing} subtitle="deal tercapai" scheme="violet" />
            <MetricStat icon="solar:bell-bing-bold-duotone" label="Follow-up"
              value={metrics.followUps} subtitle="perlu tindakan" scheme={metrics.followUps ? "rose" : "sky"} />
          </div>

          {/* Toolbar: search | dropdown */}
          <div className="relative flex items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-500" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari nama, WA, atau email…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-9 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-emerald-400/50 focus:bg-white/[0.05]"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <Icon icon="solar:close-circle-bold" className="text-base" />
                </button>
              )}
            </div>

            {/* Status dropdown */}
            <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-28">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-emerald-400/20" />
                <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-emerald-400" />
              </div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState onAdd={() => { setEditTarget(undefined); setShowForm(true); }} />
          ) : gridItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Icon icon="solar:magnifer-zoom-out-bold-duotone" className="text-4xl text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-300">Tidak ada klien pada status ini</p>
              <button onClick={() => setStatusFilter("semua")} className="mt-3 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300">
                Tampilkan semua
              </button>
            </div>
          ) : (
            <div className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {gridItems.map(klien => (
                <KlienCard
                  key={klien.id_klien}
                  klien={klien}
                  deleting={deleting === klien.id_klien}
                  onEdit={() => { setEditTarget(klien); setShowForm(true); }}
                  onDelete={() => handleDelete(klien.id_klien)}
                  onOpen={() => setDetailOpen(klien)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {detailOpen && (
        <KlienDetailDrawer
          klien={detailOpen}
          onClose={() => setDetailOpen(null)}
          onEdit={() => { setEditTarget(detailOpen); setDetailOpen(null); setShowForm(true); }}
          onDelete={() => handleDelete(detailOpen.id_klien)}
          onMove={(s) => moveStatus(detailOpen.id_klien, s)}
          onKlienUpdated={(updated) => { handleSaved(updated); setDetailOpen(updated); }}
          onPrefDeleted={(prefId) => {
            const strip = (k: Klien) => ({ ...k, preferensi: k.preferensi.filter(p => p.id_preferensi !== prefId) });
            setDetailOpen(d => d ? strip(d) : null);
            setItems(prev => prev.map(k => k.id_klien === detailOpen.id_klien ? strip(k) : k));
          }}
          onPrefGroupUpdated={(oldIds, newPrefs) => {
            const replace = (k: Klien) => ({
              ...k,
              preferensi: [
                ...k.preferensi.filter(p => !oldIds.includes(p.id_preferensi)),
                ...newPrefs,
              ],
            });
            setDetailOpen(d => d ? replace(d) : null);
            setItems(prev => prev.map(k => k.id_klien === detailOpen!.id_klien ? replace(k) : k));
          }}
        />
      )}

      {/* Sync toast */}
      {syncMsg && (
        <div className="fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-[#0a0c12]/95 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <Icon icon="solar:check-circle-bold" className="text-base text-emerald-400" />
            {syncMsg}
          </div>
        </div>
      )}

      {/* Form modal */}
      <KlienFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
        editTarget={editTarget}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   METRIC STAT
   ════════════════════════════════════════════════════════════ */
const METRIC_SCHEME = {
  emerald: {
    fill: "from-emerald-500/[0.16] via-emerald-500/[0.04] to-transparent",
    border: "border-emerald-400/20 group-hover:border-emerald-400/45",
    glow: "bg-emerald-500/30", iconGrad: "from-emerald-400 to-teal-300", iconShadow: "shadow-[0_6px_20px_-4px_rgba(16,185,129,0.7)]",
    num: "from-white to-emerald-200", bar: "from-emerald-400 to-teal-300", accent: "via-emerald-400",
  },
  amber: {
    fill: "from-amber-500/[0.16] via-orange-500/[0.05] to-transparent",
    border: "border-amber-400/25 group-hover:border-amber-400/50",
    glow: "bg-amber-500/30", iconGrad: "from-amber-400 to-orange-400", iconShadow: "shadow-[0_6px_20px_-4px_rgba(245,158,11,0.7)]",
    num: "from-white to-amber-200", bar: "from-amber-400 to-orange-400", accent: "via-amber-400",
  },
  violet: {
    fill: "from-violet-500/[0.16] via-fuchsia-500/[0.05] to-transparent",
    border: "border-violet-400/25 group-hover:border-violet-400/50",
    glow: "bg-violet-500/30", iconGrad: "from-violet-400 to-fuchsia-400", iconShadow: "shadow-[0_6px_20px_-4px_rgba(139,92,246,0.7)]",
    num: "from-white to-violet-200", bar: "from-violet-400 to-fuchsia-400", accent: "via-violet-400",
  },
  sky: {
    fill: "from-sky-500/[0.16] via-cyan-500/[0.05] to-transparent",
    border: "border-sky-400/25 group-hover:border-sky-400/50",
    glow: "bg-sky-500/30", iconGrad: "from-sky-400 to-cyan-300", iconShadow: "shadow-[0_6px_20px_-4px_rgba(56,189,248,0.7)]",
    num: "from-white to-sky-200", bar: "from-sky-400 to-cyan-300", accent: "via-sky-400",
  },
  rose: {
    fill: "from-rose-500/[0.18] via-pink-500/[0.05] to-transparent",
    border: "border-rose-400/30 group-hover:border-rose-400/55",
    glow: "bg-rose-500/35", iconGrad: "from-rose-400 to-pink-400", iconShadow: "shadow-[0_6px_20px_-4px_rgba(244,63,94,0.75)]",
    num: "from-white to-rose-200", bar: "from-rose-400 to-pink-400", accent: "via-rose-400",
  },
} as const;

function MetricStat({ icon, label, value, subtitle, scheme }: {
  icon: string; label: string; value: number | string; subtitle: string;
  scheme: keyof typeof METRIC_SCHEME;
}) {
  const s = METRIC_SCHEME[scheme];
  return (
    <div className={`group relative overflow-hidden rounded-2xl border ${s.border} bg-[#0a0c12]/60 p-3.5 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:bg-[#0c0f17]/70`}>
      {/* colored gradient wash */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.fill}`} />
      {/* corner glow */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${s.glow} opacity-60 blur-2xl transition-all duration-500 group-hover:opacity-100 group-hover:blur-xl`} />
      {/* top accent line */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${s.accent} to-transparent opacity-60 transition-opacity group-hover:opacity-100`} />
      <div className="relative flex items-center gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.iconGrad} ${s.iconShadow} transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6`}>
          <Icon icon={icon} className="text-xl text-[#06120c]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300/70">{label}</p>
          <p className={`bg-gradient-to-br ${s.num} bg-clip-text text-[26px] font-extrabold leading-tight tracking-tight text-transparent tabular-nums`}>{value}</p>
        </div>
      </div>
      {/* micro progress sheen */}
      <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${s.bar} opacity-70 transition-all duration-500 group-hover:w-full group-hover:opacity-100`} />
      </div>
      <p className="relative mt-1.5 truncate text-[11px] text-slate-400/80">{subtitle}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STATUS DROPDOWN
   ════════════════════════════════════════════════════════════ */
function StatusDropdown({ value, onChange }: {
  value: KlienStatus | "semua";
  onChange: (v: KlienStatus | "semua") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const options: { value: KlienStatus | "semua"; label: string; dot?: string; icon?: string }[] = [
    { value: "semua", label: "Semua Status", icon: "solar:layers-minimalistic-bold-duotone" },
    ...PIPELINE_ORDER.map(s => ({ value: s, label: STATUS_THEME[s].label, dot: STATUS_THEME[s].dot })),
  ];
  const selected = options.find(o => o.value === value)!;
  const isFiltered = value !== "semua";

  return (
    <div ref={ref} className="relative w-[150px] shrink-0 sm:w-[185px]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
          isFiltered
            ? "border-emerald-400/40 bg-emerald-400/[0.06] text-white shadow-[0_0_24px_-12px_rgba(16,185,129,0.8)]"
            : "border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-white/[0.16]"
        } ${open ? "ring-2 ring-emerald-400/40" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected.dot
            ? <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot} shadow-[0_0_8px_currentColor]`} />
            : <Icon icon={selected.icon!} className="shrink-0 text-base text-slate-400" />}
          <span className="truncate font-medium">{selected.label}</span>
        </span>
        <Icon icon="solar:alt-arrow-down-line-duotone"
          className={`shrink-0 text-base text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-emerald-300" : ""}`} />
      </button>

      <div
        role="listbox"
        className={`absolute right-0 z-50 mt-2 w-[200px] origin-top overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]/95 p-1.5 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] transition-all duration-200 ease-out ${
          open ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="space-y-0.5">
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-white/[0.07] ${
                  isSel ? "text-white" : "text-slate-300"
                }`}
              >
                {opt.dot
                  ? <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot} shadow-[0_0_8px_currentColor]`} />
                  : <Icon icon={opt.icon!} className="shrink-0 text-base text-slate-400" />}
                <span className="flex-1 truncate text-left font-medium">{opt.label}</span>
                {isSel && <Icon icon="solar:check-circle-bold" className="shrink-0 text-base text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GRID CARD
   ════════════════════════════════════════════════════════════ */
function KlienCard({ klien, deleting, onEdit, onDelete, onOpen }: {
  klien: Klien; deleting: boolean; onEdit: () => void; onDelete: () => void; onOpen: () => void;
}) {
  const theme = STATUS_THEME[klien.status];
  const prov = provenanceOf(klien);

  // Grup preferensi berdasarkan (budget + jenis transaksi) → tiap grup = satu "niat" berbeda
  const prefGroups = (() => {
    type Group = { types: string[]; kota: string[]; budgetLabel: string | null };
    const map = new Map<string, Group>();
    for (const p of klien.preferensi) {
      const sig = `${p.budget_min ?? ""}|${p.budget_max ?? ""}|${p.jenis_transaksi ?? ""}`;
      let g = map.get(sig);
      if (!g) {
        const lo = p.budget_min ? Number(p.budget_min) : 0;
        const hi = p.budget_max ? Number(p.budget_max) : 0;
        let bl: string | null = null;
        if (lo && hi) bl = `${formatRp(lo)} – ${formatRp(hi)}`;
        else if (hi)  bl = `≤ ${formatRp(hi)}`;
        else if (lo)  bl = `≥ ${formatRp(lo)}`;
        g = { types: [], kota: [], budgetLabel: bl };
        map.set(sig, g);
      }
      const tl = p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_dan_/g, " & ");
      if (!g.types.includes(tl)) g.types.push(tl);
      if (p.loc_kota && !g.kota.includes(p.loc_kota)) g.kota.push(p.loc_kota);
    }
    return Array.from(map.values());
  })();

  return (
    <div
      onClick={onOpen}
      className={`group relative h-full cursor-pointer rounded-[20px] bg-gradient-to-b from-white/[0.12] via-white/[0.05] to-white/[0.02] p-px transition-all duration-500 hover:-translate-y-1 ${theme.shadow} active:scale-[0.99]`}
    >
      {/* Glow halus status saat hover (di belakang kartu) */}
      <div className={`pointer-events-none absolute -inset-2 -z-10 rounded-[26px] ${theme.glow} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40`} />

      {/* Surface kaca */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-[19px] bg-[#0a0c11]/90 p-3.5 backdrop-blur-xl sm:p-4">
        {/* Wash warna status yang sangat halus */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.tint} via-transparent to-transparent opacity-70`} />
        {/* Sheen atas + rail status kiri */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className={`pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b ${theme.bar} opacity-80 transition-opacity duration-500 group-hover:opacity-100`} />
        {/* Corner glow */}
        <div className={`pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full ${theme.glow} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60`} />

        {/* Header — avatar, nama, nomor; stage pill di kanan atas */}
        <div className="relative flex items-start gap-2.5">
          <div className="relative shrink-0">
            <div className={`grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-[14px] font-bold ring-1 transition-transform duration-500 group-hover:scale-105 ${theme.grad}`}>
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
              <span className="relative">{initialsOf(klien.nama)}</span>
            </div>
            {/* status indikator di pojok avatar */}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${theme.dot} ring-2 ring-[#0a0c11] shadow-[0_0_8px_currentColor]`} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-[14px] font-bold leading-tight tracking-tight text-white">{klien.nama}</p>
            {klien.nomor_whatsapp
              ? <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">+{klien.nomor_whatsapp}</p>
              : <p className="mt-0.5 text-[11px] italic text-slate-600">Belum ada nomor</p>}
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${theme.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} shadow-[0_0_6px_currentColor]`} />
            {theme.label}
          </span>
        </div>

        {/* Objektif — blok utama yg mengisi sisa tinggi: hilangkan ruang kosong & beri konteks jelas */}
        <div className="relative mt-3 flex flex-1 flex-col justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
          {klien.propertiAsal ? (
            /* ── Seller / Titip Jual: tampilkan listing asal ── */
            <>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Listing asal</p>
              <div className="flex items-start gap-2">
                <Icon icon="solar:map-point-bold-duotone" className={`mt-px shrink-0 text-[16px] ${theme.text}`} />
                <span className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-slate-100">
                  {klien.propertiAsal.alamat_lengkap || klien.propertiAsal.kota || klien.propertiAsal.judul}
                </span>
              </div>
            </>
          ) : prefGroups.length === 0 ? (
            /* ── Kosong ── */
            <div className="flex items-center gap-2 text-slate-600">
              <Icon icon="solar:clipboard-list-bold-duotone" className="shrink-0 text-[16px]" />
              <span className="text-[11px] italic">Belum ada preferensi</span>
            </div>
          ) : prefGroups.length === 1 ? (
            /* ── 1 grup: tampilan penuh dengan budget besar ── */
            <>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mencari</p>
              <div className="flex items-center gap-2">
                <Icon icon="solar:home-smile-angle-bold-duotone" className={`shrink-0 text-[16px] ${theme.text}`} />
                <span className="truncate text-[12px] font-semibold text-slate-100">
                  {prefGroups[0].types.join(" · ") || "Properti"}
                </span>
                {prefGroups[0].kota.length > 0 && (
                  <span className="truncate text-[10px] text-slate-500">{prefGroups[0].kota[0]}</span>
                )}
              </div>
              {prefGroups[0].budgetLabel && (
                <div className="flex items-baseline gap-1.5 border-t border-white/[0.05] pt-1.5">
                  <span className="text-[9.5px] font-medium uppercase tracking-wide text-slate-500">Budget</span>
                  <span className={`text-[13px] font-extrabold tracking-tight ${theme.text}`}>{prefGroups[0].budgetLabel}</span>
                </div>
              )}
            </>
          ) : (
            /* ── 2+ grup: satu baris ringkas per grup ── */
            <>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mencari</p>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${theme.badge}`}>
                  {prefGroups.length} preferensi
                </span>
              </div>
              <div className="space-y-1.5">
                {prefGroups.slice(0, 2).map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 py-1">
                    <Icon icon="solar:home-smile-angle-bold-duotone" className={`shrink-0 text-[12px] ${theme.text}`} />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200">
                      {g.types.join(" · ") || "Properti"}
                      {g.kota.length > 0 && (
                        <span className="font-normal text-slate-500"> · {g.kota[0]}</span>
                      )}
                    </span>
                    {g.budgetLabel && (
                      <span className={`shrink-0 text-[10.5px] font-bold ${theme.text}`}>{g.budgetLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sumber prospek — caption tenang */}
        <div className="relative mt-2 flex items-center gap-1.5 text-[10.5px] text-slate-500">
          <Icon icon={prov.icon} className="shrink-0 text-[12px]" />
          <span className="truncate">{prov.label}</span>
        </div>

        {/* Footer — shortcut aksi */}
        <div className="relative mt-2.5 flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5" onClick={e => e.stopPropagation()}>
          {klien.nomor_whatsapp ? (
            <a
              href={waHref(klien.nomor_whatsapp, klien.nama)}
              target="_blank"
              rel="noopener noreferrer"
              title="Chat WhatsApp"
              className="flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-[12px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 hover:text-emerald-200 hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.85)] active:scale-[0.97]"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              WhatsApp
            </a>
          ) : (
            <span className="flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.06] bg-white/[0.02] text-[12px] font-medium text-slate-600">
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Tanpa nomor
            </span>
          )}
          <button onClick={onEdit} title="Edit"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.95]">
            <Icon icon="solar:pen-2-bold-duotone" className="text-base" />
          </button>
          <button onClick={onDelete} disabled={deleting} title="Hapus"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-300 active:scale-[0.95] disabled:opacity-50">
            <Icon icon={deleting ? "solar:refresh-circle-bold-duotone" : "solar:trash-bin-2-bold-duotone"} className={`text-base ${deleting ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DETAIL DRAWER
   ════════════════════════════════════════════════════════════ */
type PrefGroup = {
  ids: string[];
  rows: PreferensiKlien[];
  types: string[];
  lokasi: string[];
  jenis_transaksi: string | null;
  budget_min: number | null;
  budget_max: number | null;
  luas_min: number | null;
  luas_max: number | null;
  tujuan_beli: string | null;
  catatan: string | null;
};

function KlienDetailDrawer({ klien, onClose, onEdit, onDelete, onMove, onKlienUpdated, onPrefDeleted, onPrefGroupUpdated }: {
  klien: Klien; onClose: () => void; onEdit: () => void; onDelete: () => void;
  onMove: (s: KlienStatus) => void;
  onKlienUpdated: (k: Klien) => void;
  onPrefDeleted: (prefId: string) => void;
  onPrefGroupUpdated: (oldIds: string[], newPrefs: PreferensiKlien[]) => void;
}) {
  const [shown, setShown] = useState(false);
  const [matchPref, setMatchPref] = useState<PreferensiKlien | null>(null);
  const [deletingPrefs, setDeletingPrefs] = useState<Set<string>>(new Set());
  const [editingGroupIdx, setEditingGroupIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PreferensiForm | null>(null);
  const [openEditPicker, setOpenEditPicker] = useState<"type" | "transaksi" | "location" | "tujuan" | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Inline CRM edit (catatan & follow-up) ──
  const [editingCrm, setEditingCrm] = useState(false);
  const [crmDraft, setCrmDraft] = useState({ tanggal_follow_up: "", catatan: "" });
  const [savingCrm, setSavingCrm] = useState(false);
  const [crmErr, setCrmErr] = useState<string | null>(null);

  function startEditCrm() {
    setCrmDraft({
      tanggal_follow_up: klien.tanggal_follow_up
        ? String(klien.tanggal_follow_up).slice(0, 16)
        : "",
      catatan: klien.catatan || "",
    });
    setCrmErr(null);
    setEditingCrm(true);
  }

  async function handleSaveCrm() {
    setSavingCrm(true);
    setCrmErr(null);
    try {
      const res = await fetch(`/api/dashboard/klien/${klien.id_klien}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catatan: crmDraft.catatan.trim() || null,
          tanggal_follow_up: crmDraft.tanggal_follow_up || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();
      onKlienUpdated(data);
      setEditingCrm(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("acara:changed", { detail: { mode: "edit" } }));
      }
    } catch (e: unknown) {
      setCrmErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSavingCrm(false);
    }
  }

  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);

  function startEditGroup(g: PrefGroup, i: number) {
    const seen = new Set<string>();
    const locations: SelectedRegion[] = [];
    for (const row of g.rows) {
      const r = locFieldsToRegion(row);
      if (r) { const k = regionKey(r); if (!seen.has(k)) { seen.add(k); locations.push(r); } }
    }
    setEditForm({
      tipe_properti: Array.from(new Set(g.rows.map(r => r.tipe_properti))),
      jenis_transaksi: (g.jenis_transaksi as JenisTransaksi | null) || "",
      locations,
      budget_min: g.budget_min ? fmtRup(String(g.budget_min)) : "",
      budget_max: g.budget_max ? fmtRup(String(g.budget_max)) : "",
      luas_min:   g.luas_min   ? fmtRup(String(g.luas_min))   : "",
      luas_max:   g.luas_max   ? fmtRup(String(g.luas_max))   : "",
      tujuan_beli: (g.tujuan_beli as TujuanBeli | null) || "",
      catatan: g.catatan || "",
    });
    setEditingGroupIdx(i);
    setOpenEditPicker(null);
  }

  function cancelEdit() {
    setEditingGroupIdx(null);
    setEditForm(null);
    setOpenEditPicker(null);
  }

  async function handleSaveEdit(g: PrefGroup) {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      await Promise.all(g.ids.map(id =>
        fetch(`/api/dashboard/klien/${klien.id_klien}/preferensi/${id}`, { method: "DELETE" })
      ));
      const payloads = buildPrefPayloads(editForm);
      const results = await Promise.all(
        payloads.map(p =>
          fetch(`/api/dashboard/klien/${klien.id_klien}/preferensi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          }).then(r => r.json())
        )
      );
      const newPrefs: PreferensiKlien[] = results.filter(r => r.ok).map(r => r.data);
      onPrefGroupUpdated(g.ids, newPrefs);
      setEditingGroupIdx(null);
      setEditForm(null);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletePrefGroup(ids: string[]) {
    setDeletingPrefs(new Set(ids));
    try {
      await Promise.all(ids.map(id =>
        fetch(`/api/dashboard/klien/${klien.id_klien}/preferensi/${id}`, { method: "DELETE" })
      ));
      ids.forEach(id => onPrefDeleted(id));
    } finally {
      setDeletingPrefs(new Set());
    }
  }
  const handleClose = useCallback(() => { setShown(false); setTimeout(onClose, 220); }, [onClose]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleClose]);

  const theme = STATUS_THEME[klien.status];
  const phone = klien.nomor_whatsapp;
  const fu = followUpLabel(klien.tanggal_follow_up);
  const prov = provenanceOf(klien);

  return (
    <div
      className={`fixed inset-0 z-[65] flex items-end justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-[#0a0c12] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] transition-transform duration-300 sm:max-h-[88vh] sm:rounded-[28px] sm:border ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${theme.bar}`} />
        <div className={`pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full ${theme.glow} blur-3xl`} />
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        <button onClick={handleClose} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]">
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* Header */}
        <header className="relative shrink-0 border-b border-white/[0.06] px-5 pb-5 pt-9 sm:pt-6">
          <div className="flex items-center gap-4">
            <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-lg font-extrabold ring-1 ${theme.grad}`}>
              {initialsOf(klien.nama)}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-white">{klien.nama}</p>
              <p className="text-[12px] text-slate-400">{phone ? `+${phone}` : "Belum ada nomor"}</p>
            </div>
          </div>

          {/* Quick status changer */}
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Tahap Pipeline</p>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_ORDER.map(s => {
                const t = STATUS_THEME[s];
                const active = klien.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => !active && onMove(s)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all ${
                      active ? t.badge : "border-white/[0.06] text-slate-500 hover:border-white/[0.14] hover:text-slate-300"
                    }`}
                  >
                    <Icon icon={t.icon} className="text-[10px]" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <InfoSection title="Asal Prospek" icon={prov.icon}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">Sumber</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                <Icon icon={prov.icon} className="text-[11px] text-slate-400" />
                {prov.label}
              </span>
            </div>
            {klien.propertiAsal && (
              <a
                href={propertiHref(klien.propertiAsal)}
                target="_blank" rel="noopener noreferrer"
                className="mt-1 flex items-start gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/10"
              >
                <Icon icon="solar:map-point-bold-duotone" className="mt-0.5 shrink-0 text-base text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] font-bold leading-snug text-white">
                    {klien.propertiAsal.alamat_lengkap || klien.propertiAsal.kota || klien.propertiAsal.judul}
                  </p>
                  {klien.propertiAsal.alamat_lengkap && klien.propertiAsal.kota && (
                    <p className="mt-0.5 text-[10px] text-slate-400">{klien.propertiAsal.kota}</p>
                  )}
                </div>
                <Icon icon="solar:arrow-right-up-line-duotone" className="mt-0.5 shrink-0 text-sm text-slate-500" />
              </a>
            )}
          </InfoSection>

          <InfoSection title="Kontak" icon="solar:phone-calling-bold-duotone">
            <InfoRow label="WhatsApp" value={phone ? `+${phone}` : "—"} />
            <InfoRow label="Email"    value={klien.email || "—"} />
            <InfoRow label="Sumber"   value={SUMBER_LABEL[klien.sumber]} />
          </InfoSection>

          <InfoSection title="Pembayaran" icon="solar:card-bold-duotone">
            <InfoRow label="Metode" value={klien.metode_pembayaran
              ? { cash: "Cash", kpr: "KPR", cash_bertahap: "Cash Bertahap" }[klien.metode_pembayaran]
              : "Belum ditentukan"} />
            {klien.metode_pembayaran === "kpr" && (
              <>
                <InfoRow label="Bank KPR" value={klien.bank_kpr || "—"} />
                <InfoRow label="Tenor"    value={klien.tenor_kpr ? `${klien.tenor_kpr} tahun` : "—"} />
              </>
            )}
          </InfoSection>

          {klien.preferensi.length > 0 && (() => {
            const map = new Map<string, PrefGroup>();
            for (const p of klien.preferensi) {
              const sig = JSON.stringify([
                p.jenis_transaksi ?? "", p.budget_min ?? "", p.budget_max ?? "",
                p.luas_min ?? "", p.luas_max ?? "", p.tujuan_beli ?? "", p.catatan ?? "",
              ]);
              let g = map.get(sig);
              if (!g) {
                g = {
                  ids: [], rows: [], types: [], lokasi: [],
                  jenis_transaksi: p.jenis_transaksi ?? null,
                  budget_min: p.budget_min ? Number(p.budget_min) : null,
                  budget_max: p.budget_max ? Number(p.budget_max) : null,
                  luas_min:   p.luas_min   ? Number(p.luas_min)   : null,
                  luas_max:   p.luas_max   ? Number(p.luas_max)   : null,
                  tujuan_beli: p.tujuan_beli ?? null,
                  catatan:     p.catatan ?? null,
                };
                map.set(sig, g);
              }
              g.ids.push(p.id_preferensi);
              g.rows.push(p);
              const tl = p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_/g, " ");
              if (!g.types.includes(tl)) g.types.push(tl);
              if (p.lokasi_dicari && !g.lokasi.includes(p.lokasi_dicari)) g.lokasi.push(p.lokasi_dicari);
            }
            const groups = Array.from(map.values());

            return (
              <InfoSection title="Preferensi Properti" icon="solar:home-bold-duotone">
                {groups.map((g, i) => {
                  const isDel = g.ids.some(id => deletingPrefs.has(id));
                  const isEditing = editingGroupIdx === i;

                  return (
                    <div
                      key={i}
                      className={`rounded-xl border transition-all duration-200 ${
                        isEditing
                          ? "border-emerald-400/30 bg-emerald-500/[0.04] shadow-[0_0_20px_-8px_rgba(52,211,153,0.15)]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isEditing && editForm ? (
                          /* ── MODE EDIT INLINE ── */
                          <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-3 p-3"
                          >
                            {/* Header edit */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20">
                                  <Icon icon="solar:pen-2-bold-duotone" className="text-[10px] text-emerald-300" />
                                </div>
                                <p className="text-[11px] font-bold text-emerald-300">Edit Preferensi #{i + 1}</p>
                              </div>
                              <button onClick={cancelEdit} className="text-[10px] font-semibold text-slate-400 hover:text-white transition-colors">
                                Batal
                              </button>
                            </div>

                            {/* Tipe Properti */}
                            <div>
                              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tipe Properti</label>
                              <div className="h-[42px] rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all hover:border-white/20">
                                <TypePicker
                                  theme="dark"
                                  label=""
                                  value={editForm.tipe_properti.map(t => TIPE_PROPERTI_LABEL[t])}
                                  onChange={labels =>
                                    setEditForm(f => f ? { ...f, tipe_properti: labels.map(l => Object.entries(TIPE_PROPERTI_LABEL).find(([, v]) => v === l)?.[0] as TipeProperti).filter(Boolean) } : f)
                                  }
                                  options={TIPE_LABELS}
                                  icons={TIPE_ICONS}
                                  open={openEditPicker === "type"}
                                  onOpenChange={v => setOpenEditPicker(v ? "type" : null)}
                                />
                              </div>
                            </div>

                            {/* Jenis Transaksi */}
                            <div>
                              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Jenis Transaksi</label>
                              <PremiumSelect
                                value={editForm.jenis_transaksi}
                                onChange={v => setEditForm(f => f ? { ...f, jenis_transaksi: v as JenisTransaksi | "" } : f)}
                                placeholder="-- Semua --"
                                options={JENIS_EDIT_OPTIONS}
                                open={openEditPicker === "transaksi"}
                                onOpenChange={v => setOpenEditPicker(v ? "transaksi" : null)}
                              />
                            </div>

                            {/* Lokasi */}
                            <div>
                              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lokasi</label>
                              <div className="h-[42px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-1 transition-all hover:border-white/20">
                                <LocationPicker
                                  theme="dark"
                                  label=""
                                  value={editForm.locations}
                                  onChange={locs => setEditForm(f => f ? { ...f, locations: locs } : f)}
                                  open={openEditPicker === "location"}
                                  onOpenChange={v => setOpenEditPicker(v ? "location" : null)}
                                />
                              </div>
                            </div>

                            {/* Budget */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Budget Min (Rp)</label>
                                <input type="text" inputMode="numeric" placeholder="500.000.000"
                                  value={editForm.budget_min}
                                  onChange={e => setEditForm(f => f ? { ...f, budget_min: fmtRup(e.target.value) } : f)}
                                  className={editInputCls} />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Budget Max (Rp)</label>
                                <input type="text" inputMode="numeric" placeholder="2.000.000.000"
                                  value={editForm.budget_max}
                                  onChange={e => setEditForm(f => f ? { ...f, budget_max: fmtRup(e.target.value) } : f)}
                                  className={editInputCls} />
                              </div>
                            </div>

                            {/* Luas */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Luas Min (m²)</label>
                                <input type="text" inputMode="numeric" placeholder="60"
                                  value={editForm.luas_min}
                                  onChange={e => setEditForm(f => f ? { ...f, luas_min: fmtRup(e.target.value) } : f)}
                                  className={editInputCls} />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Luas Max (m²)</label>
                                <input type="text" inputMode="numeric" placeholder="500"
                                  value={editForm.luas_max}
                                  onChange={e => setEditForm(f => f ? { ...f, luas_max: fmtRup(e.target.value) } : f)}
                                  className={editInputCls} />
                              </div>
                            </div>

                            {/* Tujuan + Catatan */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Tujuan Beli</label>
                                <PremiumSelect
                                  value={editForm.tujuan_beli}
                                  onChange={v => setEditForm(f => f ? { ...f, tujuan_beli: v as TujuanBeli | "" } : f)}
                                  placeholder="-- Belum tahu --"
                                  options={TUJUAN_OPTIONS}
                                  open={openEditPicker === "tujuan"}
                                  onOpenChange={v => setOpenEditPicker(v ? "tujuan" : null)}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Catatan</label>
                                <input type="text" placeholder="Hal lain..."
                                  value={editForm.catatan}
                                  onChange={e => setEditForm(f => f ? { ...f, catatan: e.target.value } : f)}
                                  className={editInputCls} />
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-1">
                              <button onClick={cancelEdit}
                                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-bold text-slate-300 transition-all hover:border-white/20 hover:text-white">
                                Batal
                              </button>
                              <button
                                onClick={() => handleSaveEdit(g)}
                                disabled={savingEdit || editForm.tipe_properti.length === 0}
                                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-[12px] font-extrabold text-[#04130d] transition-all hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50"
                              >
                                {savingEdit
                                  ? <><Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-sm" /> Menyimpan...</>
                                  : <><Icon icon="solar:check-circle-bold" className="text-sm" /> Simpan Perubahan</>
                                }
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          /* ── MODE BACA ── */
                          <motion.div
                            key="read"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-1.5 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold text-slate-300">Preferensi #{i + 1}</p>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditGroup(g, i)}
                                  title="Edit preferensi ini"
                                  className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                                >
                                  <Icon icon="solar:pen-2-bold-duotone" className="text-[11px]" />
                                </button>
                                <button
                                  onClick={() => handleDeletePrefGroup(g.ids)}
                                  disabled={isDel}
                                  title="Hapus preferensi ini"
                                  className="grid h-6 w-6 place-items-center rounded-md border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-all hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                  <Icon icon={isDel ? "solar:refresh-circle-bold-duotone" : "solar:trash-bin-2-bold-duotone"} className={`text-[11px] ${isDel ? "animate-spin" : ""}`} />
                                </button>
                              </div>
                            </div>
                            <InfoRow label="Tipe" value={g.types.join(", ")} />
                            {g.jenis_transaksi && <InfoRow label="Jenis" value={g.jenis_transaksi} />}
                            {g.lokasi.length > 0 && <InfoRow label="Lokasi" value={g.lokasi.join(", ")} />}
                            {(g.budget_min || g.budget_max) && (
                              <InfoRow label="Budget" value={"Rp " + [formatRp(g.budget_min), formatRp(g.budget_max)].filter(Boolean).join(" – ")} />
                            )}
                            {(g.luas_min || g.luas_max) && (
                              <InfoRow label="Luas" value={[g.luas_min, g.luas_max].filter(Boolean).join(" – ") + " m²"} />
                            )}
                            {g.tujuan_beli && <InfoRow label="Tujuan" value={{ ditempati: "Ditempati", investasi: "Investasi", disewakan: "Disewakan" }[g.tujuan_beli] ?? g.tujuan_beli} />}
                            {g.catatan && <InfoRow label="Catatan" value={g.catatan} />}
                            <button
                              onClick={() => setMatchPref(g.rows[0])}
                              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 py-2 text-[12px] font-bold text-emerald-200 transition-all hover:bg-emerald-500/20"
                            >
                              <Icon icon="solar:magnifer-bold-duotone" className="text-sm" />
                              Cari Listing Cocok
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </InfoSection>
            );
          })()}

          <InfoSection title="Catatan & Follow Up" icon="solar:clipboard-text-bold-duotone">
            <AnimatePresence mode="wait" initial={false}>
              {editingCrm ? (
                <motion.div
                  key="crm-edit"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20">
                      <Icon icon="solar:pen-2-bold-duotone" className="text-[10px] text-amber-300" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-300">Edit Catatan & Follow Up</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Jadwal Follow Up
                    </label>
                    <PremiumDateTimePicker
                      value={crmDraft.tanggal_follow_up}
                      onChange={v => setCrmDraft(d => ({ ...d, tanggal_follow_up: v }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Catatan
                    </label>
                    <textarea
                      value={crmDraft.catatan}
                      onChange={e => setCrmDraft(d => ({ ...d, catatan: e.target.value }))}
                      placeholder="Tulis catatan tentang klien ini..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder-slate-600 outline-none transition-all focus:border-amber-400/50 focus:bg-white/[0.05]"
                    />
                  </div>

                  {crmErr && (
                    <p className="text-[11px] text-rose-300">{crmErr}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCrm(false)}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-[12px] font-bold text-slate-300 transition-all hover:border-white/20 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveCrm}
                      disabled={savingCrm}
                      className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-[12px] font-extrabold text-[#140a00] transition-all hover:from-amber-400 hover:to-amber-300 disabled:opacity-50"
                    >
                      {savingCrm
                        ? <><Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-sm" /> Menyimpan...</>
                        : <><Icon icon="solar:check-circle-bold" className="text-sm" /> Simpan</>
                      }
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="crm-read"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-1.5"
                >
                  {fu ? (
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${fu.urgent ? "border-amber-400/30 bg-amber-500/10" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <Icon icon="solar:bell-bing-bold-duotone" className={`shrink-0 text-base ${fu.urgent ? "text-amber-300" : "text-slate-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Follow Up</p>
                        <p className={`text-[13px] font-bold ${fu.urgent ? "text-amber-200" : "text-slate-200"}`}>{fu.text}</p>
                      </div>
                      {fu.urgent && (
                        <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Segera</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-3 py-2 text-slate-600">
                      <Icon icon="solar:calendar-add-bold-duotone" className="shrink-0 text-base" />
                      <span className="text-[12px] italic">Belum ada jadwal follow up</span>
                    </div>
                  )}

                  <InfoRow label="Tanggal Masuk" value={new Date(klien.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />

                  {klien.catatan ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Catatan</p>
                      <p className="text-[12px] leading-relaxed text-slate-200">{klien.catatan}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-2 text-slate-600">
                      <span className="text-[12px] italic">Belum ada catatan</span>
                    </div>
                  )}

                  <button
                    onClick={startEditCrm}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 py-2 text-[12px] font-bold text-amber-200 transition-all hover:bg-amber-500/20"
                  >
                    <Icon icon="solar:pen-2-bold-duotone" className="text-sm" />
                    Edit Catatan & Follow Up
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </InfoSection>
        </div>

        {/* Footer */}
        <footer className="shrink-0 space-y-2 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phone && (
            <a href={waHref(phone, klien.nama)} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/20">
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Chat WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <button onClick={onDelete} className="flex-1 rounded-xl border border-rose-400/20 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/20">
              Hapus
            </button>
            <button onClick={onEdit} className="flex-[2] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-sm font-extrabold text-[#04130d] transition-all hover:from-emerald-400 hover:to-emerald-300">
              Edit Klien
            </button>
          </div>
        </footer>
      </div>

      {matchPref && (
        <MatchListingModal
          klienId={klien.id_klien}
          klienNama={klien.nama}
          klienWhatsapp={klien.nomor_whatsapp}
          klienEmail={klien.email}
          pref={matchPref}
          onClose={() => setMatchPref(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MATCH LISTING MODAL — listing yang cocok dgn sebuah preferensi
   ════════════════════════════════════════════════════════════ */
type MatchedListing = {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  alamat_lengkap: string;
  jenis_transaksi: string;
  kategori: string;
  harga: number;
  harga_promo: number | null;
  nilai_limit_lelang: number | null;
  gambar: string;
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_office: string;
};

function MatchListingModal({ klienId, klienNama, klienWhatsapp, klienEmail, pref, onClose }: {
  klienId: string;
  klienNama: string;
  klienWhatsapp: string | null;
  klienEmail: string | null;
  pref: PreferensiKlien;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MatchedListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  const close = useCallback(() => { setShown(false); setTimeout(onClose, 200); }, [onClose]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [close]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    fetch(`/api/dashboard/klien/${klienId}/preferensi/${pref.id_preferensi}/match`)
      .then(r => r.json())
      .then(j => { if (!active) return; if (j.ok) setItems(j.items); else setError("Gagal memuat"); })
      .catch(() => { if (active) setError("Gagal memuat"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [klienId, pref.id_preferensi]);

  const tipeLabel = pref.tipe_properti.charAt(0) + pref.tipe_properti.slice(1).toLowerCase().replace(/_/g, " ");

  return (
    <div
      onClick={e => { e.stopPropagation(); close(); }}
      className={`fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-[#0a0c12] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] transition-transform duration-300 sm:max-h-[85vh] sm:rounded-[28px] sm:border ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-emerald-400/0" />
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        <button onClick={close} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]">
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-9 sm:pt-6">
          <div className="flex items-center gap-2">
            <Icon icon="solar:magnifer-bold-duotone" className="text-base text-emerald-300" />
            <h3 className="text-[15px] font-extrabold text-white">Listing yang Cocok</h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-400">
            {tipeLabel}
            {pref.jenis_transaksi ? ` · ${JENIS_TRANSAKSI_LABEL[pref.jenis_transaksi]}` : ""}
            {pref.lokasi_dicari ? ` · ${pref.lokasi_dicari}` : ""}
            {(pref.budget_min || pref.budget_max)
              ? ` · Rp ${[formatRp(pref.budget_min), formatRp(pref.budget_max)].filter(Boolean).join("–")}`
              : ""}
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <Icon icon="svg-spinners:ring-resize" className="text-3xl text-emerald-400" />
              <p className="text-[13px]">Mencari listing…</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-[13px] text-rose-300">{error}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
                <Icon icon="solar:home-smile-angle-bold-duotone" className="text-3xl text-slate-500" />
              </div>
              <p className="mt-3 text-[14px] font-bold text-white">Belum ada listing yang cocok</p>
              <p className="mt-1 max-w-xs text-[12px] text-slate-500">
                Coba longgarkan kriteria preferensi (budget, luas, atau lokasi) lalu cari lagi.
              </p>
            </div>
          ) : (
            <>
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {items.length} listing ditemukan
              </p>
              {items.map(it => (
                <MatchCard
                  key={it.id_property}
                  it={it}
                  klienNama={klienNama}
                  klienWhatsapp={klienWhatsapp}
                  klienEmail={klienEmail}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ it, klienNama, klienWhatsapp, klienEmail }: {
  it: MatchedListing;
  klienNama: string;
  klienWhatsapp: string | null;
  klienEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const isLel = it.jenis_transaksi.toUpperCase() === "LELANG";
  const price = isLel ? it.nilai_limit_lelang : (it.harga_promo ?? it.harga);
  const lokasi = [it.kelurahan, it.kecamatan, it.kota].filter(Boolean).join(", ");
  const luas = it.kategori.toUpperCase() === "TANAH"
    ? (it.luas_tanah ? `LT ${it.luas_tanah} m²` : "")
    : [it.luas_tanah ? `LT ${it.luas_tanah}` : "", it.luas_bangunan ? `LB ${it.luas_bangunan}` : ""].filter(Boolean).join(" · ");

  // Link & pesan share — pakai URL detail publik (absolut).
  const detailHref = propertiHref(it);
  const fullUrl = (typeof window !== "undefined" ? window.location.origin : "") + detailHref;
  const firstName = klienNama ? klienNama.split(" ")[0] : "";
  const greet = firstName ? `Halo ${firstName} 👋 ` : "Halo 👋 ";
  const pesan = `${greet}Ini ada properti yang mungkin cocok untuk Anda:\n\n*${it.judul}*\n${formatRpFull(price)}${lokasi ? `\n📍 ${lokasi}` : ""}\n\nDetail lengkap:\n${fullUrl}`;
  const waDigits = (klienWhatsapp || "").replace(/\D/g, "");
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(pesan)}`
    : `https://wa.me/?text=${encodeURIComponent(pesan)}`;
  const mailHref = `mailto:${klienEmail || ""}?subject=${encodeURIComponent("Properti untuk Anda: " + it.judul)}&body=${encodeURIComponent(pesan)}`;
  const copyLink = () => {
    navigator.clipboard?.writeText(fullUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-all hover:border-white/[0.12]">
      {/* Info listing → ketuk untuk buka detail */}
      <a href={detailHref} target="_blank" rel="noopener noreferrer" className="flex gap-3">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.gambar} alt={it.judul} className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-200 backdrop-blur">
            {JENIS_TRANSAKSI_LABEL[it.jenis_transaksi as keyof typeof JENIS_TRANSAKSI_LABEL] ?? it.jenis_transaksi}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <p className="line-clamp-1 text-[13px] font-bold text-white">{it.judul}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
              <Icon icon="solar:map-point-bold-duotone" className="mr-0.5 inline align-[-2px] text-[11px] text-slate-500" />
              {lokasi || "—"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold text-emerald-300">{formatRpFull(price)}</span>
            {luas && <span className="shrink-0 text-[10px] text-slate-500">{luas}</span>}
          </div>
        </div>
      </a>

      {/* Tombol share */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.06] pt-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 py-2 text-[11px] font-bold text-emerald-200 transition-all hover:bg-emerald-500/20"
        >
          <Icon icon="ic:baseline-whatsapp" className="text-sm" />
          WhatsApp
        </a>
        <a
          href={mailHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-500/10 py-2 text-[11px] font-bold text-sky-200 transition-all hover:bg-sky-500/20"
        >
          <Icon icon="solar:letter-bold" className="text-sm" />
          Email
        </a>
        <button
          onClick={copyLink}
          title="Salin link"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-200 transition-all hover:bg-white/[0.08]"
        >
          <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"} className="text-sm" />
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </div>
  );
}

function InfoSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon icon={icon} className="text-[13px] text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string | undefined; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className={`text-right text-[12px] font-medium ${highlight ? "text-amber-300" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-emerald-500/10 blur-2xl" />
        <Icon icon="solar:users-group-rounded-bold-duotone" className="relative text-4xl text-emerald-400/70" />
      </div>
      <p className="mt-4 text-[15px] font-bold text-white">Belum ada klien</p>
      <p className="mt-1 max-w-xs text-[12px] text-slate-500">
        Tambahkan klien pertama Anda, atau convert lead dari Hot Leads ke CRM.
      </p>
      <button onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-5 py-2.5 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/30">
        <Icon icon="solar:user-plus-bold-duotone" className="text-base" />
        Tambah Klien Pertama
      </button>
    </div>
  );
}
