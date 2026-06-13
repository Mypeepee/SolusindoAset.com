"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import {
  Klien, KlienForm, KlienStatus, MetodePembayaran, PreferensiForm, SumberKlien,
  TipeProperti, JenisTransaksi, TujuanBeli,
  EMPTY_PREFERENSI, JENIS_TRANSAKSI_LABEL, TIPE_PROPERTI_LABEL,
} from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (klien: Klien) => void;
  initialData?: Partial<KlienForm>;
  editTarget?: Klien;
}

const INITIAL_FORM: KlienForm = {
  nama: "", nomor_whatsapp: "", email: "",
  sumber: "wa_organik", status: "lead_baru",
  metode_pembayaran: "", bank_kpr: "", tenor_kpr: "",
  catatan: "", tanggal_follow_up: "",
  preferensi: [],
};

function formatRupiah(raw: string) {
  const num = raw.replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
}

function unformatRupiah(formatted: string) {
  return formatted.replace(/\./g, "").replace(/,/g, "");
}

export default function KlienFormModal({ open, onClose, onSaved, initialData, editTarget }: Props) {
  const [form, setForm]     = useState<KlienForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [shown, setShown]   = useState(false);
  const scrollRef           = useRef<HTMLDivElement>(null);

  const isEdit = Boolean(editTarget);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setShown(true));
      if (editTarget) {
        setForm({
          nama:             editTarget.nama,
          nomor_whatsapp:   editTarget.nomor_whatsapp?.replace(/^62/, "") || "",
          email:            editTarget.email || "",
          sumber:           editTarget.sumber,
          status:           editTarget.status,
          metode_pembayaran: editTarget.metode_pembayaran || "",
          bank_kpr:         editTarget.bank_kpr || "",
          tenor_kpr:        editTarget.tenor_kpr?.toString() || "",
          catatan:          editTarget.catatan || "",
          tanggal_follow_up: editTarget.tanggal_follow_up
            ? editTarget.tanggal_follow_up.slice(0, 16) : "",
          preferensi:       editTarget.preferensi.map(p => ({
            tipe_properti:   p.tipe_properti,
            jenis_transaksi: p.jenis_transaksi || "",
            lokasi_dicari:   p.lokasi_dicari || "",
            budget_min:      p.budget_min ? formatRupiah(String(p.budget_min)) : "",
            budget_max:      p.budget_max ? formatRupiah(String(p.budget_max)) : "",
            luas_min:        p.luas_min?.toString() || "",
            luas_max:        p.luas_max?.toString() || "",
            tujuan_beli:     p.tujuan_beli || "",
            catatan:         p.catatan || "",
          })),
        });
      } else {
        setForm({ ...INITIAL_FORM, ...initialData, preferensi: [] });
      }
      setErr(null);
      return () => cancelAnimationFrame(t);
    } else {
      setShown(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  function handleClose() {
    setShown(false);
    setTimeout(onClose, 220);
  }

  function setField<K extends keyof KlienForm>(key: K, val: KlienForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function addPreferensi() {
    setForm(f => ({ ...f, preferensi: [...f.preferensi, { ...EMPTY_PREFERENSI }] }));
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 80);
  }

  function removePreferensi(i: number) {
    setForm(f => ({ ...f, preferensi: f.preferensi.filter((_, idx) => idx !== i) }));
  }

  function setPrefField<K extends keyof PreferensiForm>(i: number, key: K, val: PreferensiForm[K]) {
    setForm(f => {
      const prefs = [...f.preferensi];
      prefs[i] = { ...prefs[i], [key]: val };
      return { ...f, preferensi: prefs };
    });
  }

  function buildPhone() {
    const d = form.nomor_whatsapp.replace(/\D/g, "").replace(/^0+/, "");
    return d ? `62${d}` : "";
  }

  async function handleSave() {
    if (!form.nama.trim()) { setErr("Nama klien wajib diisi"); return; }
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        nama:             form.nama.trim(),
        nomor_whatsapp:   buildPhone() || null,
        email:            form.email.trim() || null,
        sumber:           form.sumber,
        status:           form.status,
        catatan:          form.catatan.trim() || null,
        metode_pembayaran: form.metode_pembayaran || null,
        bank_kpr:         form.bank_kpr.trim() || null,
        tenor_kpr:        form.tenor_kpr ? Number(form.tenor_kpr) : null,
        tanggal_follow_up: form.tanggal_follow_up || null,
        id_lead_asal:     form.id_lead_asal || undefined,
        id_properti_asal: form.id_properti_asal || undefined,
        preferensi: form.preferensi
          .filter(p => p.tipe_properti)
          .map(p => ({
            tipe_properti:   p.tipe_properti,
            jenis_transaksi: p.jenis_transaksi || null,
            lokasi_dicari:   p.lokasi_dicari.trim() || null,
            budget_min:      p.budget_min ? Number(unformatRupiah(p.budget_min)) : null,
            budget_max:      p.budget_max ? Number(unformatRupiah(p.budget_max)) : null,
            luas_min:        p.luas_min ? Number(p.luas_min) : null,
            luas_max:        p.luas_max ? Number(p.luas_max) : null,
            tujuan_beli:     p.tujuan_beli || null,
            catatan:         p.catatan.trim() || null,
          })),
      };

      const url    = isEdit ? `/api/dashboard/klien/${editTarget!.id_klien}` : "/api/dashboard/klien";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();

      // Untuk edit, preferensi sudah dihandle di-update. Untuk create, sudah include dalam POST.
      // Kalau edit: sync preferensi secara individual (hapus lama, tambah baru)
      if (isEdit) {
        const old = editTarget!.preferensi;
        // hapus semua preferensi lama
        await Promise.all(old.map(p =>
          fetch(`/api/dashboard/klien/${editTarget!.id_klien}/preferensi/${p.id_preferensi}`, { method: "DELETE" })
        ));
        // tambah preferensi baru
        await Promise.all(
          form.preferensi.filter(p => p.tipe_properti).map(p =>
            fetch(`/api/dashboard/klien/${editTarget!.id_klien}/preferensi`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tipe_properti:   p.tipe_properti,
                jenis_transaksi: p.jenis_transaksi || null,
                lokasi_dicari:   p.lokasi_dicari.trim() || null,
                budget_min:      p.budget_min ? Number(unformatRupiah(p.budget_min)) : null,
                budget_max:      p.budget_max ? Number(unformatRupiah(p.budget_max)) : null,
                luas_min:        p.luas_min ? Number(p.luas_min) : null,
                luas_max:        p.luas_max ? Number(p.luas_max) : null,
                tujuan_beli:     p.tujuan_beli || null,
                catatan:         p.catatan.trim() || null,
              }),
            })
          )
        );
        // fetch ulang data terbaru
        const fresh = await fetch(`/api/dashboard/klien/${editTarget!.id_klien}`).then(r => r.json());
        onSaved(fresh.data);
      } else {
        onSaved(data);
      }

      handleClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const phoneDigits = form.nomor_whatsapp.replace(/\D/g, "").replace(/^0+/, "");

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-xl transition-opacity duration-200 sm:items-center ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative flex max-h-[96vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-t border-white/[0.1] bg-gradient-to-b from-[#1a1a1d] via-[#121214] to-[#08080a] shadow-[0_-30px_80px_rgba(0,0,0,0.7)] sm:max-h-[90vh] sm:rounded-[28px] sm:border transition-transform duration-280 ${shown ? "translate-y-0" : "translate-y-10"}`}
      >
        {/* Top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />

        {/* Drag handle mobile */}
        <div className="absolute left-1/2 top-2.5 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-white/20 sm:hidden" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-slate-200 transition-all hover:bg-white/[0.12]"
        >
          <Icon icon="solar:close-circle-bold" className="text-lg" />
        </button>

        {/* Header */}
        <header className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-9 sm:pt-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10">
              <Icon icon="solar:user-plus-bold-duotone" className="text-xl text-emerald-300" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">
                {isEdit ? "Edit Klien" : "Tambah Klien Baru"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isEdit ? "Perbarui data klien" : "Isi data kontak & preferensi properti"}
              </p>
            </div>
          </div>
        </header>

        {/* Body — scrollable */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── BAGIAN 1: DATA KONTAK ── */}
          <Section icon="solar:phone-calling-bold-duotone" title="Data Kontak">
            <Field label="Nama Klien" required>
              <input
                type="text"
                value={form.nama}
                onChange={e => setField("nama", e.target.value)}
                placeholder="Mis. Budi Santoso"
                className={inputCls}
              />
            </Field>

            <Field label="Nomor WhatsApp">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-emerald-400/50">
                <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.08] bg-white/[0.04] px-3.5">
                  <span className="text-lg">🇮🇩</span>
                  <span className="text-sm font-bold text-slate-100">+62</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.nomor_whatsapp}
                  onChange={e => setField("nomor_whatsapp", e.target.value.replace(/^0+/, ""))}
                  placeholder="8810-2675-7313"
                  className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Tanpa angka 0 di depan</p>
            </Field>

            <Field label="Email (opsional)">
              <input
                type="email"
                value={form.email}
                onChange={e => setField("email", e.target.value)}
                placeholder="budi@email.com"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sumber Lead">
                <select value={form.sumber} onChange={e => setField("sumber", e.target.value as SumberKlien)} className={selectCls}>
                  <option value="wa_organik">WA Organik</option>
                  <option value="iklan">Iklan</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="walk_in">Walk In</option>
                  <option value="titip_jual">Titip Jual</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </Field>

              <Field label="Status">
                <select value={form.status} onChange={e => setField("status", e.target.value as KlienStatus)} className={selectCls}>
                  <option value="lead_baru">Lead Baru</option>
                  <option value="sudah_dikontak">Sudah Dikontak</option>
                  <option value="hot_buyer">Hot Buyer</option>
                  <option value="closing">Closing</option>
                  <option value="lost_iseng">Lost / Iseng</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── BAGIAN 2: PEMBAYARAN ── */}
          <Section icon="solar:card-bold-duotone" title="Pembayaran">
            <Field label="Metode Pembayaran">
              <select value={form.metode_pembayaran} onChange={e => setField("metode_pembayaran", e.target.value as MetodePembayaran | "")} className={selectCls}>
                <option value="">-- Belum tahu --</option>
                <option value="cash">Cash</option>
                <option value="cash_bertahap">Cash Bertahap</option>
                <option value="kpr">KPR</option>
              </select>
            </Field>

            {form.metode_pembayaran === "kpr" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank KPR">
                  <input
                    type="text"
                    value={form.bank_kpr}
                    onChange={e => setField("bank_kpr", e.target.value)}
                    placeholder="BRI, BCA, Mandiri..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Tenor (tahun)">
                  <input
                    type="number"
                    min={1} max={30}
                    value={form.tenor_kpr}
                    onChange={e => setField("tenor_kpr", e.target.value)}
                    placeholder="15"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* ── BAGIAN 3: PREFERENSI PROPERTI ── */}
          <Section icon="solar:home-bold-duotone" title="Preferensi Properti">
            {form.preferensi.length === 0 && (
              <p className="text-[12px] text-slate-500 text-center py-2">
                Belum ada preferensi. Klik tombol di bawah untuk tambah.
              </p>
            )}

            {form.preferensi.map((pref, i) => (
              <PreferensiCard
                key={i}
                index={i}
                pref={pref}
                onChange={(key, val) => setPrefField(i, key, val)}
                onRemove={() => removePreferensi(i)}
              />
            ))}

            <button
              type="button"
              onClick={addPreferensi}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/30 py-3 text-[12px] font-semibold text-emerald-400 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="text-base" />
              Tambah Preferensi
            </button>
          </Section>

          {/* ── BAGIAN 4: CATATAN & FOLLOW UP ── */}
          <Section icon="solar:clipboard-text-bold-duotone" title="Catatan & Follow Up">
            <Field label="Jadwal Follow Up">
              <input
                type="datetime-local"
                value={form.tanggal_follow_up}
                onChange={e => setField("tanggal_follow_up", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Catatan">
              <textarea
                value={form.catatan}
                onChange={e => setField("catatan", e.target.value)}
                placeholder="Tulis catatan tentang klien ini..."
                rows={3}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05]"
              />
            </Field>
          </Section>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 shrink-0 text-base" />
              <span>{err}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {phoneDigits.length >= 8 && (
            <a
              href={`https://wa.me/62${phoneDigits}`}
              target="_blank" rel="noopener noreferrer"
              className="mb-2 group flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-100 transition-all hover:bg-emerald-500/20"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-base" />
              Buka WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-white/[0.08] py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] transition-all"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-3 text-sm font-extrabold text-white transition-all hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-70"
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon icon="solar:refresh-circle-bold-duotone" className="animate-spin text-base" />
                  Menyimpan…
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon icon="solar:check-circle-bold-duotone" className="text-base" />
                  {isEdit ? "Simpan Perubahan" : "Tambah Klien"}
                </span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── PREFERENSI CARD ── */
function PreferensiCard({
  index, pref, onChange, onRemove,
}: {
  index: number;
  pref: PreferensiForm;
  onChange: <K extends keyof PreferensiForm>(key: K, val: PreferensiForm[K]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Preferensi #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-lg border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-colors hover:bg-rose-500/20"
        >
          <Icon icon="solar:trash-bin-2-bold-duotone" className="text-sm" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipe Properti" required>
          <select value={pref.tipe_properti} onChange={e => onChange("tipe_properti", e.target.value as TipeProperti)} className={selectCls}>
            <option value="">-- Pilih --</option>
            {(Object.entries(TIPE_PROPERTI_LABEL) as [TipeProperti, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="Jenis Transaksi">
          <select value={pref.jenis_transaksi} onChange={e => onChange("jenis_transaksi", e.target.value as JenisTransaksi)} className={selectCls}>
            <option value="">-- Semua --</option>
            {(Object.entries(JENIS_TRANSAKSI_LABEL) as [JenisTransaksi, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Lokasi yang Diinginkan">
        <input
          type="text"
          value={pref.lokasi_dicari}
          onChange={e => onChange("lokasi_dicari", e.target.value)}
          placeholder="Mis. Kec. Singojuruh, Jl. Ahmad Yani, Cluster XYZ"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Budget Min (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={pref.budget_min}
            onChange={e => onChange("budget_min", formatRupiah(e.target.value))}
            placeholder="500.000.000"
            className={inputCls}
          />
        </Field>
        <Field label="Budget Max (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={pref.budget_max}
            onChange={e => onChange("budget_max", formatRupiah(e.target.value))}
            placeholder="1.000.000.000"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Luas Min (m²)">
          <input
            type="number" min={0}
            value={pref.luas_min}
            onChange={e => onChange("luas_min", e.target.value)}
            placeholder="100"
            className={inputCls}
          />
        </Field>
        <Field label="Luas Max (m²)">
          <input
            type="number" min={0}
            value={pref.luas_max}
            onChange={e => onChange("luas_max", e.target.value)}
            placeholder="500"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tujuan Beli">
          <select value={pref.tujuan_beli} onChange={e => onChange("tujuan_beli", e.target.value as TujuanBeli)} className={selectCls}>
            <option value="">-- Belum tahu --</option>
            <option value="ditempati">Ditempati</option>
            <option value="investasi">Investasi</option>
            <option value="disewakan">Disewakan</option>
          </select>
        </Field>
        <Field label="Catatan Preferensi">
          <input
            type="text"
            value={pref.catatan}
            onChange={e => onChange("catatan", e.target.value)}
            placeholder="Hal lain yang diinginkan..."
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

/* ── SMALL HELPERS ── */
function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className="text-[14px] text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{title}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-200">
        {label}{required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls  = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/[0.05]";
const selectCls = "w-full rounded-xl border border-white/[0.08] bg-[#0d0d10] px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-emerald-400/50 appearance-none";
