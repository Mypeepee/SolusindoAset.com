"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CAT_DESIGN } from "./constants";
import { openWA, fIDR, saveTaskMeta } from "./helpers";
import type { TaskType } from "./taskType";
import type { DailyTask } from "./types";

/* ═══════════════════════════════════════════════════════════════
   Shared premium building blocks
═══════════════════════════════════════════════════════════════ */

/** Persist to the existing lead endpoint. Returns true on success. */
async function patchLead(leadId: string | undefined, payload: Record<string, unknown>): Promise<boolean> {
  if (!leadId) {
    toast.error("Tugas ini belum terhubung ke lead.");
    return false;
  }
  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok === false) throw new Error(j?.error || "Gagal menyimpan");
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    return false;
  }
}

function SectionLabel({ icon, text, tint }: { icon: string; text: string; tint: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <Icon icon={icon} className={`text-sm ${tint}`} />
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{text}</span>
    </div>
  );
}

/** Template chips that swap the composer text */
function TemplateChips({
  options,
  active,
  onPick,
  tint,
}: {
  options: { key: string; label: string }[];
  active: string;
  onPick: (key: string) => void;
  tint: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.key === active;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className={[
              "rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition-all duration-150",
              on
                ? `border-white/20 bg-white/[0.08] ${tint}`
                : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** WhatsApp/text composer with copy + send */
function Composer({
  value,
  onChange,
  onSend,
  sendLabel,
  sendIcon = "logos:whatsapp-icon",
  sendDisabled,
  gradient,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend?: () => void;
  sendLabel: string;
  sendIcon?: string;
  sendDisabled?: boolean;
  gradient: string;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Pesan disalin 📋");
    } catch {
      toast.error("Gagal menyalin");
    }
  };
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-white/[0.06] bg-black/40 p-3 text-[12.5px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
        placeholder="Tulis pesan..."
      />
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11.5px] font-bold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Icon icon="solar:copy-bold-duotone" className="text-sm" /> Salin
        </button>
        {onSend && (
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: gradient, boxShadow: "0 4px 18px -8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.14)" }}
          >
            <Icon icon={sendIcon} className="text-base" /> {sendLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1) HUBUNGI VIA WA — convert a fresh contact into a lead
═══════════════════════════════════════════════════════════════ */

const LEAD_STAGES = [
  { key: "BARU",     label: "Baru",      icon: "solar:user-plus-bold",        status: "new" },
  { key: "DIHUBUNGI",label: "Dihubungi", icon: "solar:chat-round-dots-bold",  status: "contacted" },
  { key: "TERTARIK", label: "Tertarik",  icon: "solar:fire-bold",             status: "hot" },
  { key: "TIDAK",    label: "Tidak",     icon: "solar:close-circle-bold",     status: "cold" },
];

function HubungiWaBody({ task, gradient, accentText, tint }: BodyInner) {
  const { data: session } = useSession();
  const agent = session?.user?.name?.split(" ")[0] ?? "tim Solusindo";
  const name = task.leadName ?? "Bapak/Ibu";
  const prop = task.propertyTitle ?? "properti kami";

  const TEMPLATES: Record<string, string> = {
    PEMBUKA: `Halo ${name}, perkenalkan saya ${agent} dari Solusindo Aset. Saya lihat Anda tertarik dengan ${prop}. Boleh saya bantu berikan informasinya? 🏡`,
    KEBUTUHAN: `Halo ${name}, saya ${agent} dari Solusindo Aset. Boleh tahu kriteria properti yang sedang Anda cari? Biar saya carikan opsi terbaik. 🙏`,
    VIEWING: `Halo ${name}, kapan waktu luang Anda untuk viewing ${prop}? Saya siap atur jadwalnya kapan pun nyaman buat Anda. 📅`,
  };
  const [tpl, setTpl] = useState("PEMBUKA");
  const [msg, setMsg] = useState(TEMPLATES.PEMBUKA);
  const [stage, setStage] = useState("BARU");
  const [saving, setSaving] = useState(false);

  const pick = (k: string) => { setTpl(k); setMsg(TEMPLATES[k]); };

  const setLeadStatus = async (s: typeof LEAD_STAGES[number]) => {
    if (saving || s.key === stage) return;
    const prev = stage;
    setStage(s.key);          // optimistic
    setSaving(true);
    const ok = await patchLead(task.sourceId, { status: s.status });
    setSaving(false);
    if (ok) toast.success(`Status kontak: ${s.label}`);
    else setStage(prev);      // revert on failure
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel icon="solar:chat-round-call-bold-duotone" text="Pesan Pembuka" tint={tint} />
        <TemplateChips
          options={[
            { key: "PEMBUKA", label: "Pembuka" },
            { key: "KEBUTUHAN", label: "Tanya kebutuhan" },
            { key: "VIEWING", label: "Ajak viewing" },
          ]}
          active={tpl}
          onPick={pick}
          tint={tint}
        />
        <Composer
          value={msg}
          onChange={setMsg}
          onSend={task.leadPhone ? () => openWA(task.leadPhone!, task.leadName ?? "Klien", msg) : undefined}
          sendLabel="Kirim WhatsApp"
          sendDisabled={!task.leadPhone}
          gradient="linear-gradient(135deg,#22c55e,#15803d)"
        />
      </div>

      <div>
        <SectionLabel icon="solar:rounding-2-up-bold-duotone" text="Update Status Kontak" tint={tint} />
        <div className="grid grid-cols-4 gap-1.5">
          {LEAD_STAGES.map((s) => {
            const on = s.key === stage;
            return (
              <button
                key={s.key}
                type="button"
                disabled={saving}
                onClick={() => setLeadStatus(s)}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-bold transition-all duration-200 disabled:opacity-60",
                  on ? "border-white/25 bg-white/[0.07] text-white" : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300",
                ].join(" ")}
                style={on ? { boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06)` } : undefined}
              >
                <Icon icon={s.icon} className={`text-base ${on ? accentText : ""}`} />
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] text-slate-600">
          Tandai <span className="text-slate-400">Tertarik</span> jika kontak merespons positif — otomatis masuk pipeline lead.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2) TITIP JUAL — multi-step vertical stepper
═══════════════════════════════════════════════════════════════ */

const TITIP_STEPS = [
  { title: "Hubungi pemilik", desc: "Konfirmasi detail & ketersediaan properti titipan." },
  { title: "Sepakati harga & dokumen", desc: "Negosiasi harga, komisi, dan kelengkapan surat." },
  { title: "Upload jadi listing", desc: "Publikasikan properti ke katalog resmi." },
];

function TitipJualBody({ task, gradient, accentText, tint }: BodyInner) {
  const current = Math.min(Math.max(task.titipStep ?? 1, 1), 3); // 1-based active step
  const name = task.leadName ?? "Pemilik";
  const prop = task.propertyTitle ?? "properti Anda";
  const msg = `Halo Bapak/Ibu ${name}, saya dari Solusindo Aset. Terima kasih sudah menitipkan ${prop}. Boleh saya minta waktu sebentar untuk konfirmasi detail & harga? 🏡`;

  return (
    <div className="space-y-4">
      <SectionLabel icon="solar:routing-3-bold-duotone" text="Tahapan Titip Jual" tint={tint} />

      <div className="relative pl-1">
        {/* spine */}
        <div className="pointer-events-none absolute bottom-4 left-[14px] top-3 w-px bg-white/[0.08]" />
        <div className="space-y-3">
          {TITIP_STEPS.map((s, i) => {
            const stepNo = i + 1;
            const done = stepNo < current;
            const active = stepNo === current;
            return (
              <div key={i} className="relative flex gap-3">
                <div
                  className={[
                    "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black transition-all",
                    done ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" :
                    active ? "border-white/30 text-white" : "border-white/10 bg-white/[0.02] text-slate-600",
                  ].join(" ")}
                  style={active ? { background: gradient, boxShadow: "0 0 16px -4px rgba(245,158,11,0.6)" } : undefined}
                >
                  {done ? <Icon icon="solar:check-bold" className="text-sm" /> : stepNo}
                </div>
                <div className={`flex-1 rounded-xl border px-3 py-2.5 transition-all ${active ? "border-white/15 bg-white/[0.04]" : "border-transparent"}`}>
                  <p className={`text-[12.5px] font-bold ${done ? "text-slate-500 line-through" : active ? "text-white" : "text-slate-500"}`}>{s.title}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-600">{s.desc}</p>

                  {/* Active step action */}
                  {active && stepNo === 1 && (
                    <div className="mt-2.5">
                      <Composer
                        value={msg}
                        onChange={() => {}}
                        onSend={task.leadPhone ? () => openWA(task.leadPhone!, name, msg) : undefined}
                        sendLabel="WA Pemilik"
                        sendDisabled={!task.leadPhone}
                        gradient="linear-gradient(135deg,#22c55e,#15803d)"
                      />
                    </div>
                  )}
                  {active && stepNo === 2 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {task.leadPhone && (
                        <button type="button" onClick={() => openWA(task.leadPhone!, name)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-green-400/30 bg-green-500/[0.1] px-3 py-2 text-[11.5px] font-bold text-green-300 hover:bg-green-500/20">
                          <Icon icon="logos:whatsapp-icon" className="text-sm" /> Lanjut nego
                        </button>
                      )}
                      <button type="button" onClick={() => (window.location.href = "/")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/[0.1] px-3 py-2 text-[11.5px] font-bold text-amber-300 hover:bg-amber-500/20">
                        <Icon icon="solar:book-2-bold-duotone" className="text-sm" /> Buka panduan
                      </button>
                    </div>
                  )}
                  {active && stepNo === 3 && (
                    <button type="button" onClick={() => (window.location.href = "/dashboard/listings")}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", boxShadow: "0 4px 18px -8px rgba(139,92,246,0.8)" }}>
                      <Icon icon="solar:upload-minimalistic-bold-duotone" className="text-base" /> Upload listing sekarang
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3) POST LISTING — caption + multi-channel publisher
═══════════════════════════════════════════════════════════════ */

const CHANNELS = [
  { key: "ig",   label: "Instagram",   icon: "skill-icons:instagram" },
  { key: "fb",   label: "FB Market",   icon: "logos:facebook" },
  { key: "portal", label: "Rumah123",  icon: "solar:global-bold-duotone" },
  { key: "wa",   label: "WA Status",   icon: "logos:whatsapp-icon" },
  { key: "grup", label: "Grup",        icon: "solar:users-group-rounded-bold-duotone" },
];

function PostListingBody({ task, onDone, tint }: BodyInner) {
  const prop = task.propertyTitle ?? "Properti Pilihan";
  const [caption, setCaption] = useState(
    `🏡 ${prop}\n\n✨ Lokasi strategis, siap huni & investasi menjanjikan!\n📍 Hubungi saya untuk detail lokasi & harga\n📲 Jadwal viewing fleksibel\n\nDM / WA sekarang sebelum keduluan orang lain 👇\n#properti #dijual #rumahdijual #investasiproperti`
  );
  const [posted, setPosted] = useState<Set<string>>(
    () => new Set(Array.isArray(task.meta?.channels) ? task.meta!.channels : [])
  );

  const toggle = (k: string) =>
    setPosted((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      saveTaskMeta(task.id, { channels: [...n] });
      return n;
    });

  const share = async () => {
    try { await navigator.clipboard.writeText(caption); } catch {}
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel icon="solar:pen-new-square-bold-duotone" text="Caption Marketing" tint={tint} />
        <Composer
          value={caption}
          onChange={setCaption}
          onSend={share}
          sendLabel="Bagikan"
          gradient="linear-gradient(135deg,#a78bfa,#7c3aed)"
        />
      </div>

      <div>
        <SectionLabel icon="solar:share-circle-bold-duotone" text={`Channel Publikasi · ${posted.size}/${CHANNELS.length}`} tint={tint} />
        <div className="grid grid-cols-5 gap-1.5">
          {CHANNELS.map((c) => {
            const on = posted.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={[
                  "relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[9.5px] font-bold transition-all duration-200",
                  on ? "border-violet-400/40 bg-violet-500/[0.1] text-violet-200" : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300",
                ].join(" ")}
              >
                {on && <Icon icon="solar:check-circle-bold" className="absolute -right-1 -top-1 text-sm text-violet-300" />}
                <Icon icon={c.icon} className="text-lg" />
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] text-slate-600">Tandai channel yang sudah diposting. Selesaikan tugas setelah semua tersebar.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4) FOLLOW-UP — stage-aware message + reschedule
═══════════════════════════════════════════════════════════════ */

const SNOOZE = [
  { key: "besok", label: "Besok" },
  { key: "3hari", label: "3 hari" },
  { key: "minggu", label: "Minggu depan" },
];

function FollowupBody({ task, tint }: BodyInner) {
  const { data: session } = useSession();
  const agent = session?.user?.name?.split(" ")[0] ?? "tim Solusindo";
  const name = task.leadName ?? "Bapak/Ibu";
  const prop = task.propertyTitle ?? "properti yang kita bahas";
  const stage = task.pipelineStage;

  const [msg, setMsg] = useState(
    `Halo ${name}, ini ${agent} dari Solusindo Aset. Menindaklanjuti obrolan kita soal ${prop} — apakah ada yang masih bisa saya bantu? Saya siap atur jadwal viewing kapan pun Anda luang. 🙏`
  );
  const [snooze, setSnooze] = useState<string>(
    typeof task.meta?.snooze === "string" ? task.meta!.snooze : ""
  );

  return (
    <div className="space-y-4">
      {stage && (
        <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Tahap saat ini</p>
            <p className={`mt-0.5 text-[13px] font-extrabold ${tint}`}>{stage}</p>
          </div>
          <Icon icon="solar:square-academic-cap-bold-duotone" className={`text-2xl ${tint} opacity-60`} />
        </div>
      )}

      <div>
        <SectionLabel icon="solar:chat-square-call-bold-duotone" text="Pesan Follow-up" tint={tint} />
        <Composer
          value={msg}
          onChange={setMsg}
          onSend={task.leadPhone ? () => openWA(task.leadPhone!, task.leadName ?? "Klien", msg) : undefined}
          sendLabel="Kirim WhatsApp"
          sendDisabled={!task.leadPhone}
          gradient="linear-gradient(135deg,#22c55e,#15803d)"
        />
      </div>

      <div>
        <SectionLabel icon="solar:alarm-bold-duotone" text="Jadwalkan ulang" tint={tint} />
        <div className="flex flex-wrap gap-1.5">
          {SNOOZE.map((s) => {
            const on = snooze === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setSnooze(s.key); saveTaskMeta(task.id, { snooze: s.key }); toast.success(`Dijadwalkan ulang: ${s.label}`); }}
                className={[
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11.5px] font-bold transition-colors",
                  on ? "border-sky-400/40 bg-sky-500/[0.1] text-sky-200" : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-sky-400/30 hover:bg-sky-500/[0.08] hover:text-sky-200",
                ].join(" ")}
              >
                <Icon icon="solar:calendar-add-bold-duotone" className="text-sm" /> {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5) AJUKAN PENAWARAN — submit & track an offer
═══════════════════════════════════════════════════════════════ */

const OFFER_STATUS = [
  { key: "pending",  label: "Pending",  icon: "solar:clock-circle-bold",  cls: "border-amber-400/40 bg-amber-500/[0.1] text-amber-200" },
  { key: "diterima", label: "Diterima", icon: "solar:check-circle-bold",  cls: "border-emerald-400/40 bg-emerald-500/[0.1] text-emerald-200" },
  { key: "ditolak",  label: "Ditolak",  icon: "solar:close-circle-bold",  cls: "border-rose-400/40 bg-rose-500/[0.1] text-rose-200" },
];

function parseRupiah(s: string) {
  const n = Number(s.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function PenawaranBody({ task, tint, onDone }: BodyInner) {
  const { data: session } = useSession();
  const agent = session?.user?.name?.split(" ")[0] ?? "tim Solusindo";
  const name = task.leadName ?? "Bapak/Ibu";
  const prop = task.propertyTitle ?? "properti";

  const [amount, setAmount] = useState(task.offerAmount ? String(task.offerAmount) : "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string>(task.offerStatus ?? "pending");
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amountNum = parseRupiah(amount);

  const decide = async (decision: "diterima" | "ditolak", catatan?: string) => {
    setSaving(true);
    const ok = await patchLead(task.sourceId, { decision, ...(catatan ? { catatan_agent: catatan } : {}) });
    setSaving(false);
    if (!ok) return;
    setStatus(decision);
    setRejecting(false);
    toast.success(decision === "diterima" ? "Penawaran diterima ✅" : "Penawaran ditolak");
    onDone(); // selesaikan tugas & tutup modal
  };

  const sendOffer = () => {
    const msg =
      `Halo ${name}, saya ${agent} dari Solusindo Aset.\n\n` +
      `Berikut penawaran untuk ${prop}:\n` +
      `💰 Harga penawaran: ${amountNum ? fIDR(amountNum) : "(isi nominal)"}\n` +
      (note ? `📝 Catatan: ${note}\n` : "") +
      `\nMohon konfirmasinya ya. Terima kasih 🙏`;
    if (task.leadPhone) openWA(task.leadPhone, task.leadName ?? "Klien", msg);
  };

  return (
    <div className="space-y-4">
      {/* Current offer summary */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Nilai penawaran</p>
          <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-white">
            {amountNum ? fIDR(amountNum) : "—"}
          </p>
        </div>
        <Icon icon="solar:hand-money-bold-duotone" className={`text-3xl ${tint} opacity-60`} />
      </div>

      {/* Compose offer */}
      <div>
        <SectionLabel icon="solar:tag-price-bold-duotone" text="Susun Penawaran" tint={tint} />
        <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-black/30 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/40 px-3">
            <span className="text-[12.5px] font-bold text-slate-500">Rp</span>
            <input
              value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent py-2.5 text-[13px] font-bold tabular-nums text-white placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Syarat / catatan (opsional)"
            className="w-full resize-none rounded-xl border border-white/[0.06] bg-black/40 p-3 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-white/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={sendOffer}
            disabled={!task.leadPhone}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#22c55e,#15803d)", boxShadow: "0 4px 18px -8px rgba(0,0,0,0.8)" }}
          >
            <Icon icon="logos:whatsapp-icon" className="text-base" /> Kirim penawaran via WhatsApp
          </button>
        </div>
      </div>

      {/* Decision — persisted to lead + notifies client/cobroke */}
      <div>
        <SectionLabel icon="solar:checklist-bold-duotone" text="Keputusan Penawaran" tint={tint} />

        {status !== "pending" ? (
          (() => {
            const s = OFFER_STATUS.find((o) => o.key === status) ?? OFFER_STATUS[0];
            return (
              <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[12.5px] font-bold ${s.cls}`}>
                <Icon icon={s.icon} className="text-base" />
                Penawaran {s.label.toLowerCase()}
              </div>
            );
          })()
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={saving || rejecting}
                onClick={() => decide("diterima")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/[0.1] px-3 py-2.5 text-[12px] font-bold text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Icon icon="solar:check-circle-bold" className="text-base" /> Terima
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setRejecting((r) => !r)}
                className={[
                  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-all disabled:opacity-50",
                  rejecting ? "border-rose-400/50 bg-rose-500/20 text-rose-100" : "border-rose-400/40 bg-rose-500/[0.1] text-rose-200 hover:bg-rose-500/20",
                ].join(" ")}
              >
                <Icon icon="solar:close-circle-bold" className="text-base" /> Tolak
              </button>
            </div>

            {rejecting && (
              <div className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.04] p-2.5">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={2}
                  placeholder="Alasan penolakan (wajib)..."
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-rose-400/30 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={saving || !rejectNote.trim()}
                  onClick={() => decide("ditolak", rejectNote.trim())}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500/90 px-3 py-2 text-[12px] font-bold text-white transition-all hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon icon="solar:trash-bin-trash-bold" className="text-sm" /> Konfirmasi tolak
                </button>
              </div>
            )}
            <p className="text-[10.5px] text-slate-600">Keputusan tersimpan & memberi tahu klien secara real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6) COBROKE — coordinate with the partner agent
═══════════════════════════════════════════════════════════════ */

const SPLITS = ["50 / 50", "60 / 40", "40 / 60", "70 / 30"];
const COBROKE_STEPS = [
  { key: "split",   label: "Sepakati split komisi" },
  { key: "viewing", label: "Koordinasi viewing" },
  { key: "closing", label: "Konfirmasi closing" },
];

function CobrokeBody({ task, tint }: BodyInner) {
  const partner = task.cobrokeAgentName ?? "Agent partner";
  const office = task.cobrokeAgentOffice;
  const phone = task.cobrokeAgentPhone;
  const [split, setSplit] = useState<string>(
    typeof task.meta?.split === "string" ? task.meta!.split : SPLITS[0]
  );
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(Array.isArray(task.meta?.checklist) ? task.meta!.checklist : [])
  );

  const pickSplit = (s: string) => {
    setSplit(s);
    saveTaskMeta(task.id, { split: s, checklist: [...checked] });
  };

  const toggle = (k: string) =>
    setChecked((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      saveTaskMeta(task.id, { split, checklist: [...n] });
      return n;
    });

  const waPartner = () => {
    if (!phone) return;
    const msg = `Halo ${partner}, terkait lead cobroke kita untuk ${task.propertyTitle ?? "properti"} — boleh kita selaraskan split komisi (${split}) & langkah berikutnya? 🤝`;
    openWA(phone, partner, msg);
  };

  return (
    <div className="space-y-4">
      {/* Partner agent card */}
      <div className="relative overflow-hidden rounded-2xl border border-pink-400/15 bg-gradient-to-br from-pink-500/[0.08] to-transparent p-4">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/25 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-400/20 bg-black/25">
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-xl text-pink-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-extrabold text-white">{partner}</p>
            <p className="truncate text-[11px] text-slate-500">{office ?? "Agent partner cobroke"}</p>
          </div>
          {phone && (
            <button
              type="button"
              onClick={waPartner}
              className="inline-flex items-center gap-1.5 rounded-xl border border-green-400/30 bg-green-500/[0.1] px-3 py-2 text-[11.5px] font-bold text-green-300 transition-colors hover:bg-green-500/20"
            >
              <Icon icon="logos:whatsapp-icon" className="text-sm" /> WA
            </button>
          )}
        </div>
      </div>

      {/* Commission split */}
      <div>
        <SectionLabel icon="solar:pie-chart-2-bold-duotone" text="Split Komisi" tint={tint} />
        <div className="grid grid-cols-4 gap-1.5">
          {SPLITS.map((s) => {
            const on = s === split;
            return (
              <button
                key={s}
                type="button"
                onClick={() => pickSplit(s)}
                className={[
                  "rounded-xl border px-1 py-2.5 text-[11px] font-black tabular-nums transition-all",
                  on ? "border-pink-400/40 bg-pink-500/[0.1] text-pink-200" : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">Kamu / partner. Pastikan tertulis di kesepakatan.</p>
      </div>

      {/* Coordination checklist */}
      <div>
        <SectionLabel icon="solar:clipboard-check-bold-duotone" text="Checklist Koordinasi" tint={tint} />
        <div className="space-y-1.5">
          {COBROKE_STEPS.map((s) => {
            const on = checked.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                className={[
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[12px] font-bold transition-all",
                  on ? "border-pink-400/30 bg-pink-500/[0.06] text-white" : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                <Icon
                  icon={on ? "solar:check-circle-bold" : "solar:record-circle-line-duotone"}
                  className={`text-lg ${on ? "text-pink-300" : "text-slate-600"}`}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Dispatcher
═══════════════════════════════════════════════════════════════ */

interface BodyInner {
  task: DailyTask;
  onDone: () => void;
  gradient: string;
  accentText: string;
  tint: string;
}

export function TaskTypeBody({
  task,
  type,
  tint,
  onDone,
}: {
  task: DailyTask;
  type: TaskType;
  tint: string;
  onDone: () => void;
}) {
  const D = CAT_DESIGN[task.category];
  const inner: BodyInner = { task, onDone, gradient: D?.iconGrad ?? "linear-gradient(135deg,#f59e0b,#d97706)", accentText: D?.accent ?? "text-amber-300", tint };

  switch (type) {
    case "HUBUNGI_WA":     return <HubungiWaBody {...inner} />;
    case "TITIP_JUAL":     return <TitipJualBody {...inner} />;
    case "POST_LISTING":   return <PostListingBody {...inner} />;
    case "FOLLOWUP":       return <FollowupBody {...inner} />;
    case "AJUKAN_PENAWARAN": return <PenawaranBody {...inner} />;
    case "COBROKE":        return <CobrokeBody {...inner} />;
    default:               return null;
  }
}
