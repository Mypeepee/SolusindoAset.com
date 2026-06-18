"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { accentFor, formatTanggal } from "@/lib/beritaUi";
import type { BeritaListItem } from "@/lib/berita";

const ALLOWED = ["OWNER", "ADMIN", "PRINCIPAL"];

const STATUS_TABS = [
  { value: "", label: "Semua" },
  { value: "PUBLISHED", label: "Terbit" },
  { value: "DRAFT", label: "Draf" },
  { value: "SCHEDULED", label: "Terjadwal" },
  { value: "ARCHIVED", label: "Arsip" },
];

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  DRAFT: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  SCHEDULED: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  ARCHIVED: "bg-rose-400/15 text-rose-300 border-rose-400/30",
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Terbit",
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  ARCHIVED: "Arsip",
};

export default function BeritaDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const jabatan = String((session?.user as any)?.jabatan || "").toUpperCase();
  const allowed = ALLOWED.includes(jabatan);

  const [items, setItems] = useState<BeritaListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BeritaListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debounced.trim()) params.set("q", debounced.trim());
      params.set("pageSize", "50");
      const res = await fetch(`/api/berita/admin?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.statusCounts || {});
    } catch {
      toast.error("Gagal memuat daftar berita");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debounced]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/berita/admin/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Berita dihapus");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Gagal menghapus berita");
    } finally {
      setDeleting(false);
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Icon icon="solar:refresh-linear" className="animate-spin text-2xl text-emerald-400" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10">
          <Icon icon="solar:lock-keyhole-bold" className="text-3xl text-rose-400" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-white">Akses Terbatas</h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">
          Hanya Admin / Owner yang dapat mengelola berita.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 rounded-full border border-white/10 px-5 py-2.5 text-xs font-bold text-slate-300 hover:border-white/25 hover:text-white"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl py-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            <Icon icon="solar:notebook-bold" /> Redaksi
          </div>
          <h1 className="text-2xl font-extrabold text-white">Kelola Berita</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tulis, terbitkan, dan kelola artikel blog Solusindo Aset.
          </p>
        </div>
        <Link
          href="/dashboard/berita/new"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-300 active:scale-95 sm:self-auto"
        >
          <Icon icon="solar:pen-new-square-bold" /> Tulis Berita
        </Link>
      </div>

      {/* STATS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={totalAll} icon="solar:documents-bold" tone="text-white" />
        <Stat label="Terbit" value={counts.PUBLISHED || 0} icon="solar:check-circle-bold" tone="text-emerald-300" />
        <Stat label="Draf" value={counts.DRAFT || 0} icon="solar:document-linear" tone="text-slate-300" />
        <Stat label="Terjadwal" value={counts.SCHEDULED || 0} icon="solar:clock-circle-bold" tone="text-amber-300" />
      </div>

      {/* FILTERS */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all ${
                statusFilter === t.value
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Icon icon="solar:magnifer-linear" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul…"
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
          <Icon icon="solar:notebook-broken" className="text-4xl text-slate-600" />
          <h3 className="mt-4 text-base font-bold text-white">Belum ada berita</h3>
          <p className="mt-1 text-sm text-slate-500">Mulai tulis artikel pertama Anda.</p>
          <Link
            href="/dashboard/berita/new"
            className="mt-5 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-extrabold text-black hover:bg-emerald-300"
          >
            Tulis Berita
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((b) => {
            const accent = accentFor(b.kategori);
            return (
              <div
                key={b.id}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a0d10] p-3 transition-colors hover:border-white/20"
              >
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  {b.gambar_utama ? (
                    <Image src={b.gambar_utama} alt={b.judul} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-700">
                      <Icon icon="solar:gallery-broken" className="text-xl" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[b.status_publish]}`}>
                      {STATUS_LABEL[b.status_publish]}
                    </span>
                    <span className={`text-[11px] font-semibold ${accent.text}`}>{b.kategori}</span>
                    {b.berita_utama && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                        <Icon icon="solar:star-bold" /> Headline
                      </span>
                    )}
                  </div>
                  <h3 className="truncate text-sm font-bold text-white">{b.judul}</h3>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:eye-linear" /> {b.views}
                    </span>
                    <span>{b.readMinutes} min</span>
                    <span className="hidden sm:inline">
                      {formatTanggal(b.tanggal_publish || b.tanggal_dibuat)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {b.status_publish === "PUBLISHED" && (
                    <Link
                      href={`/blog/${b.slug}`}
                      target="_blank"
                      title="Lihat publik"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
                    >
                      <Icon icon="solar:eye-linear" />
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/berita/${b.id}`}
                    title="Edit"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
                  >
                    <Icon icon="solar:pen-2-linear" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(b)}
                    title="Hapus"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-rose-400/40 hover:text-rose-300"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0d10] p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
              <Icon icon="solar:trash-bin-trash-bold" className="text-2xl text-rose-400" />
            </div>
            <h3 className="mt-4 text-center text-lg font-bold text-white">Hapus berita ini?</h3>
            <p className="mt-1.5 text-center text-sm text-slate-400">
              <span className="font-semibold text-slate-200">“{deleteTarget.judul}”</span> akan
              dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-white/25 hover:text-white disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-extrabold text-white transition-colors hover:bg-rose-400 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Icon icon="solar:refresh-linear" className="animate-spin" /> Menghapus…
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0d10] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <Icon icon={icon} className={tone} />
      </div>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
