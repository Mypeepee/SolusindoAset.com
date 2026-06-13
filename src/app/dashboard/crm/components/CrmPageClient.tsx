"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import KlienFormModal from "./KlienFormModal";
import {
  Klien, KlienStatus,
  STATUS_COLOR, STATUS_ICON, STATUS_LABEL, SUMBER_LABEL,
} from "./types";

const STATUS_FILTERS: { key: KlienStatus | "semua"; label: string }[] = [
  { key: "semua",         label: "Semua" },
  { key: "lead_baru",     label: "Lead Baru" },
  { key: "sudah_dikontak",label: "Sudah Dikontak" },
  { key: "hot_buyer",     label: "Hot Buyer" },
  { key: "closing",       label: "Closing" },
  { key: "lost_iseng",    label: "Lost / Iseng" },
];

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
  const d   = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return { text: "Terlambat!", urgent: true };
  const h = diff / 3600000;
  if (h < 24) return { text: `Hari ini ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`, urgent: true };
  return { text: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), urgent: false };
}

export default function CrmPageClient() {
  const [items, setItems]       = useState<Klien[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [statusFilter, setStatusFilter] = useState<KlienStatus | "semua">("semua");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Klien | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState<Klien | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (q) params.set("q", q);
      if (statusFilter !== "semua") params.set("status", statusFilter);
      const res  = await fetch(`/api/dashboard/klien?${params}`);
      const json = await res.json();
      setItems(json.data || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(k: Klien) {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id_klien === k.id_klien);
      if (idx >= 0) { const n = [...prev]; n[idx] = k; return n; }
      return [k, ...prev];
    });
    setTotal(t => t + (items.some(x => x.id_klien === k.id_klien) ? 0 : 1));
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

  return (
    <div className="min-h-screen bg-[#040608] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#040608]/95 backdrop-blur-xl px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">CRM Klien</h1>
            <p className="text-[12px] text-slate-400">{total} klien tersimpan</p>
          </div>
          <button
            onClick={() => { setEditTarget(undefined); setShowForm(true); }}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.97]"
          >
            <Icon icon="solar:user-plus-bold-duotone" className="text-base" />
            <span className="hidden sm:inline">Tambah Klien</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-[16px]" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari nama atau nomor WA..."
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-400/50"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <Icon icon="solar:close-circle-bold" className="text-base" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                statusFilter === f.key
                  ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-200"
                  : "border border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-4xl text-emerald-400" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState onAdd={() => { setEditTarget(undefined); setShowForm(true); }} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(klien => (
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

      {/* Detail drawer */}
      {detailOpen && (
        <KlienDetailDrawer
          klien={detailOpen}
          onClose={() => setDetailOpen(null)}
          onEdit={() => { setEditTarget(detailOpen); setDetailOpen(null); setShowForm(true); }}
          onDelete={() => { handleDelete(detailOpen.id_klien); }}
        />
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

/* ── KLIEN CARD ── */
function KlienCard({
  klien, deleting, onEdit, onDelete, onOpen,
}: {
  klien: Klien;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const fu = followUpLabel(klien.tanggal_follow_up);
  const initials = klien.nama.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-900/20 text-[14px] font-extrabold text-emerald-200 ring-1 ring-emerald-400/20">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-white">{klien.nama}</p>
          {klien.nomor_whatsapp ? (
            <p className="text-[11px] text-slate-400">+{klien.nomor_whatsapp}</p>
          ) : (
            <p className="text-[11px] text-slate-600 italic">Belum ada nomor</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:pen-2-bold-duotone" className="text-sm" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            <Icon icon={deleting ? "solar:refresh-circle-bold-duotone" : "solar:trash-bin-2-bold-duotone"} className={`text-sm ${deleting ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status + sumber */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[klien.status]}`}>
          <Icon icon={STATUS_ICON[klien.status]} className="text-[10px]" />
          {STATUS_LABEL[klien.status]}
        </span>
        <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">
          {SUMBER_LABEL[klien.sumber]}
        </span>
      </div>

      {/* Preferensi summary */}
      {klien.preferensi.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {klien.preferensi.slice(0, 3).map(p => (
            <span key={p.id_preferensi} className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400">
              {p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace("_dan_", " & ")}
              {p.budget_max && ` ≤ ${formatRp(p.budget_max)}`}
            </span>
          ))}
          {klien.preferensi.length > 3 && (
            <span className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500">+{klien.preferensi.length - 3} lagi</span>
          )}
        </div>
      )}

      {/* Follow up & waktu */}
      <div className="mt-3 flex items-center justify-between">
        {fu ? (
          <span className={`inline-flex items-center gap-1 text-[10px] ${fu.urgent ? "text-amber-400" : "text-slate-400"}`}>
            <Icon icon="solar:calendar-mark-bold-duotone" className="text-[11px]" />
            Follow up: {fu.text}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] text-slate-600">{relativeTime(klien.dibuat_pada)}</span>
      </div>
    </div>
  );
}

/* ── DETAIL DRAWER ── */
function KlienDetailDrawer({
  klien, onClose, onEdit, onDelete,
}: {
  klien: Klien;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() { setShown(false); setTimeout(onClose, 220); }

  const phone = klien.nomor_whatsapp;
  const fu = followUpLabel(klien.tanggal_follow_up);

  return (
    <div
      className={`fixed inset-0 z-[65] flex items-end justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-[#0f0f12] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] sm:max-h-[85vh] sm:rounded-[28px] sm:border transition-transform duration-280 ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        <button onClick={handleClose} className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 hover:bg-white/[0.12] transition-all">
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-5 pt-9 sm:pt-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-900/20 text-lg font-extrabold text-emerald-200 ring-1 ring-emerald-400/20">
              {klien.nama.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-bold text-white">{klien.nama}</p>
              <p className="text-[12px] text-slate-400">{phone ? `+${phone}` : "Belum ada nomor"}</p>
              <div className="mt-1.5 flex gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[klien.status]}`}>
                  <Icon icon={STATUS_ICON[klien.status]} className="text-[10px]" />
                  {STATUS_LABEL[klien.status]}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <InfoSection title="Kontak" icon="solar:phone-calling-bold-duotone">
            <InfoRow label="WhatsApp" value={phone ? `+${phone}` : "—"} />
            <InfoRow label="Email"    value={klien.email || "—"} />
            <InfoRow label="Sumber"   value={SUMBER_LABEL[klien.sumber]} />
          </InfoSection>

          <InfoSection title="Pembayaran" icon="solar:card-bold-duotone">
            <InfoRow label="Metode"   value={klien.metode_pembayaran
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
                <div key={p.id_preferensi} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-300">Preferensi #{i + 1}</p>
                  <InfoRow label="Tipe"    value={p.tipe_properti.charAt(0) + p.tipe_properti.slice(1).toLowerCase().replace(/_/g, " ")} />
                  {p.jenis_transaksi && <InfoRow label="Jenis"   value={p.jenis_transaksi} />}
                  {p.lokasi_dicari   && <InfoRow label="Lokasi"  value={p.lokasi_dicari} />}
                  {(p.budget_min || p.budget_max) && (
                    <InfoRow label="Budget" value={[formatRp(p.budget_min), formatRp(p.budget_max)].filter(Boolean).join(" – ") + " Rp"} />
                  )}
                  {(p.luas_min || p.luas_max) && (
                    <InfoRow label="Luas" value={[p.luas_min, p.luas_max].filter(Boolean).join(" – ") + " m²"} />
                  )}
                  {p.tujuan_beli && <InfoRow label="Tujuan" value={{ ditempati: "Ditempati", investasi: "Investasi", disewakan: "Disewakan" }[p.tujuan_beli]} />}
                  {p.catatan     && <InfoRow label="Catatan" value={p.catatan} />}
                </div>
              ))}
            </InfoSection>
          )}

          <InfoSection title="CRM" icon="solar:clipboard-text-bold-duotone">
            {fu && <InfoRow label="Follow Up" value={fu.text} highlight={fu.urgent} />}
            <InfoRow label="Masuk"   value={new Date(klien.tanggal_masuk).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
            {klien.catatan && <InfoRow label="Catatan" value={klien.catatan} />}
          </InfoSection>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
          {phone && (
            <a
              href={`https://wa.me/${phone}`}
              target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-100 hover:bg-emerald-500/20 transition-all"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Buka WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <button onClick={onDelete} className="flex-1 rounded-xl border border-rose-400/20 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 transition-all">
              Hapus
            </button>
            <button onClick={onEdit} className="flex-[2] rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-sm font-extrabold text-white hover:from-emerald-400 hover:to-emerald-300 transition-all">
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
      <div className="grid h-20 w-20 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]">
        <Icon icon="solar:users-group-rounded-bold-duotone" className="text-4xl text-slate-600" />
      </div>
      <p className="mt-4 text-[15px] font-bold text-white">Belum ada klien</p>
      <p className="mt-1 text-[12px] text-slate-500 max-w-xs">
        Tambahkan klien pertama Anda, atau convert lead dari Hot Leads ke CRM.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-5 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all"
      >
        <Icon icon="solar:user-plus-bold-duotone" className="text-base" />
        Tambah Klien Pertama
      </button>
    </div>
  );
}
