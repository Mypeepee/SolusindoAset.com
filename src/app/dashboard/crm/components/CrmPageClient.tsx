"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import KlienFormModal from "./KlienFormModal";
import { Klien, KlienStatus, SUMBER_LABEL } from "./types";

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

  // Auto-import prospek dari semua sumber saat halaman dibuka (sekali)
  useEffect(() => {
    if (syncedOnce.current) return;
    syncedOnce.current = true;
    syncProspek(true);
  }, [syncProspek]);

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
        <div className="crm-aurora-1 absolute -top-44 left-[18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[150px]" />
        <div className="crm-aurora-2 absolute -top-32 right-[6%] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.18] blur-[150px]" />
        <div className="crm-aurora-3 absolute top-10 left-1/2 h-[30rem] w-[44rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.12] blur-[160px]" />
        <div className="absolute right-1/4 top-24 h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/[0.08] blur-[150px]" />
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
  const value = klienValue(klien);
  const prov = provenanceOf(klien);

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

        {/* Header */}
        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0">
            <div className={`grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-[14px] font-bold ring-1 transition-transform duration-500 group-hover:scale-105 ${theme.grad}`}>
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
              <span className="relative">{initialsOf(klien.nama)}</span>
            </div>
            {/* status indikator di pojok avatar */}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${theme.dot} ring-2 ring-[#0a0c11] shadow-[0_0_8px_currentColor]`} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-[14px] font-bold tracking-tight text-white">{klien.nama}</p>
            {klien.nomor_whatsapp
              ? <p className="truncate text-[11px] font-medium text-slate-400">+{klien.nomor_whatsapp}</p>
              : <p className="text-[11px] italic text-slate-600">Belum ada nomor</p>}
          </div>
        </div>

        {/* Status pill · sumber · nilai */}
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${theme.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${theme.dot} shadow-[0_0_6px_currentColor]`} />
            {theme.label}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] text-slate-300">
            <Icon icon={prov.icon} className="shrink-0 text-[11px]" />
            <span className="truncate">{prov.label}</span>
          </span>
          {value > 0 && (
            <span className={`ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-bold ${theme.text}`}>
              <Icon icon="solar:wallet-money-bold-duotone" className="text-[11px]" />
              {formatRp(value)}
            </span>
          )}
        </div>

        {/* Asal listing — selalu alamat lengkap */}
        {klien.propertiAsal ? (
          <div className="relative mt-2.5 flex items-start gap-1.5 rounded-xl bg-white/[0.03] px-2.5 py-1.5">
            <Icon icon="solar:map-point-bold-duotone" className={`mt-px shrink-0 text-[14px] ${theme.text}`} />
            <span className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-200">
              {klien.propertiAsal.alamat_lengkap || klien.propertiAsal.kota || klien.propertiAsal.judul}
            </span>
          </div>
        ) : klien.preferensi.length > 0 ? (
          <div className="relative mt-2.5 flex flex-wrap gap-1">
            {klien.preferensi.slice(0, 3).map(p => (
              <span key={p.id_preferensi} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-400">
                {p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_dan_/g, " & ")}
              </span>
            ))}
            {klien.preferensi.length > 3 && (
              <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500">+{klien.preferensi.length - 3}</span>
            )}
          </div>
        ) : null}

        {/* Footer — shortcut aksi */}
        <div className="relative mt-auto flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5" onClick={e => e.stopPropagation()}>
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
function KlienDetailDrawer({ klien, onClose, onEdit, onDelete, onMove }: {
  klien: Klien; onClose: () => void; onEdit: () => void; onDelete: () => void;
  onMove: (s: KlienStatus) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
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

          {klien.preferensi.length > 0 && (
            <InfoSection title="Preferensi Properti" icon="solar:home-bold-duotone">
              {klien.preferensi.map((p, i) => (
                <div key={p.id_preferensi} className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] font-bold text-slate-300">Preferensi #{i + 1}</p>
                  <InfoRow label="Tipe" value={p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_/g, " ")} />
                  {p.jenis_transaksi && <InfoRow label="Jenis"  value={p.jenis_transaksi} />}
                  {p.lokasi_dicari   && <InfoRow label="Lokasi" value={p.lokasi_dicari} />}
                  {(p.budget_min || p.budget_max) && (
                    <InfoRow label="Budget" value={[formatRp(p.budget_min), formatRp(p.budget_max)].filter(Boolean).join(" – ") + " Rp"} />
                  )}
                  {(p.luas_min || p.luas_max) && (
                    <InfoRow label="Luas" value={[p.luas_min, p.luas_max].filter(Boolean).join(" – ") + " m²"} />
                  )}
                  {p.tujuan_beli && <InfoRow label="Tujuan" value={{ ditempati: "Ditempati", investasi: "Investasi", disewakan: "Disewakan" }[p.tujuan_beli]} />}
                  {p.catatan && <InfoRow label="Catatan" value={p.catatan} />}
                </div>
              ))}
            </InfoSection>
          )}

          <InfoSection title="CRM" icon="solar:clipboard-text-bold-duotone">
            {fu && <InfoRow label="Follow Up" value={fu.text} highlight={fu.urgent} />}
            <InfoRow label="Masuk" value={new Date(klien.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
            {klien.catatan && <InfoRow label="Catatan" value={klien.catatan} />}
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
