"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { KategoriTugas, PrioritasTugas, TugasFormData, DbTask } from "./types";

const KATEGORI_OPTIONS: { value: KategoriTugas; label: string; icon: string; color: string }[] = [
  { value: "URGENT",     label: "Mendesak",         icon: "solar:danger-bold-duotone",              color: "text-rose-400" },
  { value: "FOLLOWUP",   label: "Follow-up Lead",   icon: "solar:phone-calling-bold-duotone",        color: "text-sky-400" },
  { value: "KONTEN",     label: "Konten & Marketing",icon: "solar:gallery-add-bold-duotone",         color: "text-violet-400" },
  { value: "VIEWING",    label: "Viewing & Meeting", icon: "solar:home-2-bold-duotone",              color: "text-amber-400" },
  { value: "PIPELINE",   label: "Pipeline & Admin",  icon: "solar:chart-square-bold-duotone",        color: "text-emerald-400" },
  { value: "NETWORKING", label: "Networking",        icon: "solar:users-group-rounded-bold-duotone", color: "text-pink-400" },
  { value: "UMUM",       label: "Umum",              icon: "solar:checklist-bold-duotone",           color: "text-slate-400" },
];

const PRIORITAS_OPTIONS: { value: PrioritasTugas; label: string; color: string }[] = [
  { value: "TINGGI", label: "Tinggi 🔴", color: "text-rose-400" },
  { value: "SEDANG", label: "Sedang 🟡", color: "text-amber-400" },
  { value: "RENDAH", label: "Rendah 🟢", color: "text-emerald-400" },
];

const EMPTY: TugasFormData = {
  judul: "", kategori: "UMUM", prioritas: "SEDANG",
  catatan: "", alasan: "", tanggal_selesai: "",
  jam_terjadwal: "", target: "", komisi_potensial: "",
};

interface Props {
  onClose: () => void;
  onCreated: (task: DbTask) => void;
}

export function TambahTugasModal({ onClose, onCreated }: Props) {
  const [form, setForm]       = useState<TugasFormData>(EMPTY);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof TugasFormData, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim()) { toast.error("Judul tugas wajib diisi"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/tugas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judul:            form.judul.trim(),
          kategori:         form.kategori,
          prioritas:        form.prioritas,
          catatan:          form.catatan   || null,
          alasan:           form.alasan    || null,
          tanggal_selesai:  form.tanggal_selesai || null,
          jam_terjadwal:    form.jam_terjadwal   || null,
          target:           form.target          ? Number(form.target)          : null,
          komisi_potensial: form.komisi_potensial ? Number(form.komisi_potensial) : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Gagal membuat tugas");
      }

      const created: DbTask = await res.json();
      toast.success("Tugas berhasil ditambahkan!");
      onCreated(created);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0e18] shadow-[0_48px_120px_rgba(0,0,0,.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
        {/* Glow */}
        <div className="pointer-events-none absolute -top-16 left-1/4 h-40 w-40 rounded-full bg-orange-600/[0.08] blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-400/20">
              <Icon icon="solar:add-circle-bold-duotone" className="text-lg text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Tambah Tugas</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Tugas baru untuk hari ini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-rose-300 hover:border-rose-400/30 transition"
          >
            <Icon icon="solar:close-circle-bold" className="text-base" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.06)_transparent]">

          {/* Judul */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
              Judul Tugas <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.judul}
              onChange={(e) => set("judul", e.target.value)}
              placeholder="Contoh: Follow-up Bapak Hendra"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-orange-400/40 focus:outline-none focus:bg-white/[0.05] transition"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Kategori
            </label>
            <div className="grid grid-cols-2 gap-2">
              {KATEGORI_OPTIONS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => set("kategori", k.value)}
                  className={[
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold text-left transition-all duration-150",
                    form.kategori === k.value
                      ? "border-orange-400/40 bg-orange-500/[0.1] text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.12] hover:text-white",
                  ].join(" ")}
                >
                  <Icon icon={k.icon} className={`text-sm shrink-0 ${form.kategori === k.value ? k.color : ""}`} />
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prioritas + Deadline row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                Prioritas
              </label>
              <select
                value={form.prioritas}
                onChange={(e) => set("prioritas", e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0a0e18] px-3 py-2.5 text-sm text-white focus:border-orange-400/40 focus:outline-none transition"
              >
                {PRIORITAS_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={form.tanggal_selesai}
                onChange={(e) => set("tanggal_selesai", e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0a0e18] px-3 py-2.5 text-sm text-white focus:border-orange-400/40 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Jam + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                Jam Terjadwal
              </label>
              <input
                type="time"
                value={form.jam_terjadwal}
                onChange={(e) => set("jam_terjadwal", e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0a0e18] px-3 py-2.5 text-sm text-white focus:border-orange-400/40 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                Target <span className="normal-case font-normal text-slate-600">(batch)</span>
              </label>
              <input
                type="number"
                min="2"
                value={form.target}
                onChange={(e) => set("target", e.target.value)}
                placeholder="mis. 5"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-orange-400/40 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Komisi */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
              Komisi Potensial (Rp)
            </label>
            <input
              type="number"
              value={form.komisi_potensial}
              onChange={(e) => set("komisi_potensial", e.target.value)}
              placeholder="mis. 36000000"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none transition"
            />
          </div>

          {/* Alasan */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
              Alasan / Mengapa Penting
            </label>
            <textarea
              rows={2}
              value={form.alasan}
              onChange={(e) => set("alasan", e.target.value)}
              placeholder="Tulis kenapa tugas ini penting..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-orange-400/40 focus:outline-none transition resize-none"
            />
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-1.5">
              Catatan
            </label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => set("catatan", e.target.value)}
              placeholder="Catatan tambahan..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-orange-400/40 focus:outline-none transition resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-semibold text-slate-400 hover:text-white transition"
          >
            Batal
          </button>
          <button
            type="submit"
            form="tambah-tugas-form"
            disabled={loading}
            onClick={handleSubmit as any}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg,#ea580c,#c2410c)",
              boxShadow: "0 4px 18px -6px rgba(234,88,12,.75)",
            }}
          >
            {loading ? (
              <Icon icon="svg-spinners:ring-resize" className="text-base" />
            ) : (
              <Icon icon="solar:add-circle-bold" className="text-base" />
            )}
            {loading ? "Menyimpan..." : "Tambah Tugas"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
