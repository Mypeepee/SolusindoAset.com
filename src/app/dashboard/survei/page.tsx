"use client";

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface SurveiItem {
  id_booking: string;
  id_property: string;
  judul: string;
  slug: string;
  nama_klien: string;
  nomor_telepon: string;
  tanggal_survei: string; // ISO
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  catatan: string | null;
  tanggal_dibuat: string; // ISO
}

const TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu" },
  { key: "CONFIRMED", label: "Diterima" },
  { key: "CANCELLED", label: "Ditolak" },
];

function formatSurveiDate(iso: string): string {
  // tanggal_survei disimpan UTC → konversi ke WIB (UTC+7) sebelum ditampilkan
  const wib = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const day = days[wib.getUTCDay()];
  const date = String(wib.getUTCDate()).padStart(2, "0");
  const mon = months[wib.getUTCMonth()];
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${day}, ${date} ${mon} ${wib.getUTCFullYear()} • ${hh}:${mm} WIB`;
}

const STATUS_META: Record<SurveiItem["status"], { label: string; color: string; icon: string }> = {
  PENDING: { label: "Menunggu Konfirmasi", color: "amber", icon: "solar:clock-circle-bold-duotone" },
  CONFIRMED: { label: "Diterima", color: "emerald", icon: "solar:check-circle-bold-duotone" },
  CANCELLED: { label: "Ditolak", color: "rose", icon: "solar:close-circle-bold-duotone" },
};

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  amber: { border: "border-amber-400/35", bg: "bg-amber-500/[0.08]", text: "text-amber-300", glow: "from-amber-400/30 to-orange-500/10" },
  emerald: { border: "border-emerald-400/35", bg: "bg-emerald-500/[0.08]", text: "text-emerald-300", glow: "from-emerald-400/30 to-teal-500/10" },
  rose: { border: "border-rose-400/35", bg: "bg-rose-500/[0.08]", text: "text-rose-300", glow: "from-rose-400/30 to-pink-500/10" },
};

export default function JadwalSurveiPage() {
  const [items, setItems] = useState<SurveiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [acting, setActing] = useState<Set<string>>(new Set());

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/survei/list?status=${status}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setItems(json.items as SurveiItem[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const handleAction = async (id_booking: string, status: "CONFIRMED" | "CANCELLED") => {
    setActing((prev) => new Set(prev).add(id_booking));
    try {
      const res = await fetch(`/api/survei/booking/${id_booking}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        if (tab === "ALL") {
          setItems((prev) =>
            prev.map((it) => (it.id_booking === id_booking ? { ...it, status } : it)),
          );
        } else {
          setItems((prev) => prev.filter((it) => it.id_booking !== id_booking));
        }
        // Sinkronkan Hot Leads di dashboard — status booking & lead barusan berubah
        window.dispatchEvent(new CustomEvent("hot-leads:refresh"));
      }
    } catch {
      /* ignore */
    } finally {
      setActing((prev) => {
        const next = new Set(prev);
        next.delete(id_booking);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#040608] p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl blur-[8px] bg-gradient-to-br from-amber-400/30 to-orange-500/15" />
            <div className="relative h-11 w-11 rounded-2xl border border-amber-400/35 bg-amber-500/[0.08] flex items-center justify-center">
              <Icon icon="solar:map-point-wave-bold-duotone" className="text-2xl text-amber-300" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Jadwal Survei Lokasi</h1>
            <p className="text-[12px] text-white/45">
              Kelola permintaan survei lokasi dari calon pembeli/penyewa.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-xl border px-3.5 py-1.5 text-[12px] font-bold transition ${
                tab === t.key
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {loading ? (
            <div className="px-6 py-14 text-center text-white/40 text-[12.5px]">
              Memuat data...
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.025] flex items-center justify-center">
                <Icon icon="solar:calendar-mark-bold-duotone" className="text-white/30 text-2xl" />
              </div>
              <p className="mt-3 text-[12.5px] font-semibold text-white/70">
                Belum ada jadwal survei
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                Permintaan survei lokasi dari klien akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              <AnimatePresence initial={false}>
                {items.map((it) => {
                  const meta = STATUS_META[it.status];
                  const cc = COLOR_CLASSES[meta.color];
                  const isActing = acting.has(it.id_booking);
                  return (
                    <motion.li
                      key={it.id_booking}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 py-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div className={`absolute inset-0 rounded-xl blur-[6px] bg-gradient-to-br ${cc.glow}`} />
                          <div className={`relative h-10 w-10 rounded-xl border ${cc.border} ${cc.bg} flex items-center justify-center`}>
                            <Icon icon={meta.icon} className={`text-xl ${cc.text}`} />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-bold text-white truncate">
                              {it.nama_klien} · {it.nomor_telepon}
                            </p>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider ${cc.border} ${cc.bg} ${cc.text}`}>
                              {meta.label}
                            </span>
                          </div>
                          <Link
                            href={`/Jual/${it.slug}`}
                            target="_blank"
                            className="mt-0.5 block text-[11.5px] text-white/55 hover:text-emerald-300 truncate transition"
                          >
                            {it.judul}
                          </Link>
                          <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-white/45">
                            <Icon icon="solar:calendar-bold-duotone" className="text-[12px]" />
                            {formatSurveiDate(it.tanggal_survei)}
                          </p>
                          {it.catatan && (
                            <p className="mt-1 text-[10.5px] italic text-white/35 truncate">
                              "{it.catatan}"
                            </p>
                          )}

                          {it.status === "PENDING" && (
                            <div className="mt-2.5 flex items-center gap-2 max-w-xs">
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleAction(it.id_booking, "CONFIRMED")}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-extrabold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                <Icon icon="solar:check-circle-bold" className="text-[13px]" />
                                Terima
                              </button>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleAction(it.id_booking, "CANCELLED")}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-extrabold text-white/55 transition hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-50"
                              >
                                <Icon icon="solar:close-circle-bold" className="text-[13px]" />
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
