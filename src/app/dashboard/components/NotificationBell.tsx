"use client";

/* ════════════════════════════════════════════════════════════════════
   NotificationBell — topbar notification dropdown
   ────────────────────────────────────────────────────────────────────
   Saat ini sumber notif: titip-jual masuk yang masih PENDING untuk
   agent ini. Ke depan bisa di-extend ke source lain (sistem, transaksi,
   pengingat). Bell tampil di setiap halaman dashboard via topbar.tsx.
   ════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import {
  countdownText,
  formatDateTimeID,
  readDismissedIds,
  writeDismissedIds,
  JENIS_META,
  type TitipItem,
  type JenisProperti,
} from "@/app/dashboard/components/agent/premium/titipLeads";

/* Item dengan tambahan metadata "locked" — saat ada agent lain yang
   sudah klaim, item tidak langsung dihapus; dia ditandai locked supaya
   agent ini dapat closure ("Diambil oleh X pada tanggal jam"),
   lalu fade out otomatis setelah cukup waktu untuk dibaca. */
type NotifItem = TitipItem & {
  locked?: { by_nama: string; at: number; persistent?: boolean };
};

// Cukup panjang untuk closure tanpa bikin dropdown menumpuk notif
// "yang sudah lewat". 30 detik = waktu yang masuk akal untuk baca + recover
// dari kekalahan tanpa mengganggu workflow.
const LOCKED_TTL_MS = 30_000;

/** Bentuk minimum TitipItem untuk represent missed lead di notif —
 *  sebagian field tidak relevan (kedaluwarsa, masked phone, dll) jadi
 *  diisi placeholder safe. Yang penting locked metadata-nya. */
function buildMissedNotifItem(m: {
  id_titip: string;
  jenis_properti: JenisProperti;
  alamat_lengkap: string;
  kota: string;
  kecamatan: string | null;
  by_agent_nama: string;
  diklaim_pada: string | null;
}): NotifItem {
  return {
    id_titip: m.id_titip,
    jenis_properti: m.jenis_properti,
    alamat_lengkap: m.alamat_lengkap,
    provinsi: "",
    kota: m.kota,
    kecamatan: m.kecamatan,
    kelurahan: null,
    estimasi_harga: null,
    pengirim_nama_masked: "",
    pengirim_phone_masked: "",
    status_kepemilikan: "PRIBADI",
    kedaluwarsa_pada: new Date().toISOString(),
    dibuat_pada: m.diklaim_pada || new Date().toISOString(),
    locked: {
      by_nama: m.by_agent_nama,
      at: m.diklaim_pada ? new Date(m.diklaim_pada).getTime() : Date.now(),
      persistent: true,
    },
  };
}

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const seenCountRef = useRef<number>(0);
  const [pulse, setPulse] = useState(false);
  // Track timer per id supaya cleanup rapi dan tidak double-schedule
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Load + Pusher realtime
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/leads/titip-jual/inbox", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!active || !json?.ok) return;

        const pending = (json.items as TitipItem[]) || [];

        // Hydrate missed: lead yang sudah dimenangkan agent lain (status
        // terklaim) dan belum di-acknowledge user. Filter via localStorage.
        const dismissed = readDismissedIds();
        const missedRaw: Array<{
          id_titip: string;
          jenis_properti: JenisProperti;
          alamat_lengkap: string;
          kota: string;
          kecamatan: string | null;
          by_agent_nama: string;
          diklaim_pada: string | null;
        }> = json.missed_items || [];
        const missed = missedRaw
          .filter((m) => !dismissed.has(m.id_titip))
          .map(buildMissedNotifItem);

        // Susunan: pending dulu (actionable), missed di bawah (closure).
        const next: NotifItem[] = [...pending, ...missed];

        // Pulse animation hanya kalau ada lead baru (actionable) — bukan
        // missed. Pakai count pending saja untuk hindari false-positive
        // pulse saat user pertama kali open page setelah lama offline.
        if (
          pending.length > seenCountRef.current &&
          seenCountRef.current > 0
        ) {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 2200);
        }
        seenCountRef.current = pending.length;
        setItems(next);
      } catch {
        // ignore
      }
    }

    load();
    const onFocus = () => load();
    const onVis = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const intv = window.setInterval(load, 90_000);

    let cleanupPusher: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("@/lib/pusher-client");
        const pc = mod.pusherClient;
        const ch = pc.subscribe("titip-broadcast");
        const onNew = () => load();
        const onLocked = (data: {
          id_titip: string;
          by_agent_nama?: string;
          at_iso?: string;
        }) => {
          const by_nama = data.by_agent_nama || "Agent lain";
          const at = data.at_iso ? new Date(data.at_iso).getTime() : Date.now();
          setItems((prev) => {
            // Hanya transform jika item-nya memang ada di list ini
            const exists = prev.some((x) => x.id_titip === data.id_titip);
            if (!exists) return prev;
            return prev.map((x) =>
              x.id_titip === data.id_titip
                ? { ...x, locked: { by_nama, at } }
                : x,
            );
          });
          // Jadwalkan auto-dismiss — tapi skip kalau item-nya berubah jadi
          // persistent (mis. setelah refresh, di-hydrate dari missed_items).
          const existing = dismissTimersRef.current.get(data.id_titip);
          if (existing) window.clearTimeout(existing);
          const t = window.setTimeout(() => {
            setItems((prev) => {
              const target = prev.find((x) => x.id_titip === data.id_titip);
              if (target?.locked?.persistent) return prev; // jangan buang
              return prev.filter((x) => x.id_titip !== data.id_titip);
            });
            dismissTimersRef.current.delete(data.id_titip);
          }, LOCKED_TTL_MS);
          dismissTimersRef.current.set(data.id_titip, t);
        };
        ch.bind("titip:new", onNew);
        ch.bind("titip:locked", onLocked);
        cleanupPusher = () => {
          ch.unbind("titip:new", onNew);
          ch.unbind("titip:locked", onLocked);
          pc.unsubscribe("titip-broadcast");
        };
      } catch {
        /* fallback polling jalan */
      }
    })();

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(intv);
      if (cleanupPusher) cleanupPusher();
      // Clear semua pending fade-out timer
      dismissTimersRef.current.forEach((t) => window.clearTimeout(t));
      dismissTimersRef.current.clear();
    };
  }, []);

  // Hanya item yang masih bisa di-klaim yang dihitung sebagai notif aktif.
  // Item locked tetap visible (untuk closure) tapi tidak menambah counter
  // merah, karena sudah tidak actionable.
  const count = items.filter((x) => !x.locked).length;

  /** Dismiss notif locked. Kalau persistent (dari API missed_items),
   *  ID-nya disimpan ke localStorage supaya tidak muncul lagi
   *  setelah refresh halaman. */
  const dismissNotif = (id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id_titip === id);
      if (target?.locked?.persistent) {
        const ids = readDismissedIds();
        ids.add(id);
        writeDismissedIds(ids);
      }
      return prev.filter((x) => x.id_titip !== id);
    });
    // Bersihkan timer auto-dismiss kalau ada
    const t = dismissTimersRef.current.get(id);
    if (t) {
      window.clearTimeout(t);
      dismissTimersRef.current.delete(id);
    }
  };

  const goToTitip = (id?: string) => {
    setOpen(false);
    if (pathname === "/dashboard") {
      // already on dashboard — scroll ke card
      const el = document.getElementById("hot-leads-card");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.dispatchEvent(new CustomEvent("hot-leads:focus"));
    } else {
      router.push("/dashboard#hot-leads-card");
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition-all ${
          open
            ? "border-emerald-400/40 bg-emerald-500/15"
            : "border-white/10 bg-[#050608] hover:bg-white/5"
        }`}
        title={count > 0 ? `${count} notifikasi baru` : "Notifikasi"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon
          icon={count > 0 ? "solar:bell-bing-bold-duotone" : "solar:bell-linear"}
          className={`h-4 w-4 ${count > 0 ? "text-emerald-300" : "text-slate-200"}`}
        />
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            className="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-[#050608]"
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
        {/* pulse ring saat ada item baru */}
        <AnimatePresence>
          {pulse && (
            <motion.span
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 1.6, repeat: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400/70"
            />
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
            className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-h-[480px] flex flex-col rounded-2xl border border-white/10 bg-[#0A0D14] shadow-[0_24px_70px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden z-50"
          >
            <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent" />

            <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:bell-bing-bold-duotone"
                  className="text-emerald-300 text-lg"
                />
                <span className="text-[13px] font-bold text-white">
                  Notifikasi
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-rose-500/20 border border-rose-400/40 px-1 text-[10px] font-extrabold text-rose-200">
                    {count}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-300/70">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.025] flex items-center justify-center">
                    <Icon
                      icon="solar:inbox-bold-duotone"
                      className="text-white/30 text-2xl"
                    />
                  </div>
                  <p className="mt-3 text-[12.5px] font-semibold text-white/70">
                    Tidak ada notifikasi
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    Notifikasi titip jual baru akan muncul di sini.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  <AnimatePresence initial={false}>
                    {items.map((it) => (
                      <NotifRow
                        key={it.id_titip}
                        item={it}
                        onClick={() => goToTitip(it.id_titip)}
                        onDismiss={dismissNotif}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => goToTitip()}
                className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] font-bold text-emerald-300 hover:bg-emerald-500/[0.06] flex items-center justify-center gap-1.5 transition-colors"
              >
                Buka Hot Leads
                <Icon icon="solar:arrow-right-bold" className="text-sm" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotifRow({
  item,
  onClick,
  onDismiss,
}: {
  item: NotifItem;
  onClick: () => void;
  onDismiss: (id: string) => void;
}) {
  const meta = JENIS_META[item.jenis_properti] || JENIS_META.RUMAH;
  const cd = countdownText(item.kedaluwarsa_pada);
  const urgent = cd.hoursLeft < 6;
  const lokasi = item.kecamatan || item.kota || item.provinsi || "area kamu";
  const locked = !!item.locked;

  const headline = locked
    ? "Lead ini telah diterima agent lain"
    : urgent
      ? "Klaim sebelum hangus!"
      : "Hey, ada yang titip jual nih";
  const subline = locked
    ? `Diambil oleh ${item.locked!.by_nama} · ${formatDateTimeID(item.locked!.at)}`
    : `${meta.label} di ${lokasi}`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      {/* Dismiss X (hanya untuk locked) — di-render terpisah dari button utama
          supaya tidak jadi nested-button (invalid HTML). */}
      {locked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(item.id_titip);
          }}
          aria-label="Tutup notifikasi"
          className="absolute top-2.5 right-2.5 z-10 h-6 w-6 rounded-md border border-white/[0.07] bg-white/[0.025] text-white/35 hover:text-white/80 hover:border-white/15 hover:bg-white/[0.08] flex items-center justify-center transition"
        >
          <Icon icon="solar:close-circle-bold" className="text-[12px]" />
        </button>
      )}

      <button
        type="button"
        onClick={locked ? undefined : onClick}
        disabled={locked}
        className={`group relative w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
          locked
            ? "cursor-default opacity-65"
            : "hover:bg-emerald-500/[0.05]"
        }`}
      >
        {/* left accent — urgent (rose) atau locked (slate) */}
        {(urgent || locked) && (
          <span
            aria-hidden
            className={`absolute inset-y-2 left-0 w-[2px] rounded-full ${
              locked
                ? "bg-white/15"
                : "bg-gradient-to-b from-rose-400 to-amber-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
            }`}
          />
        )}

        {/* Icon */}
        <div className="relative shrink-0">
          <div
            className={`absolute inset-0 rounded-xl blur-[6px] ${
              locked
                ? "bg-white/[0.04]"
                : urgent
                  ? "bg-gradient-to-br from-rose-400/30 to-amber-500/10"
                  : "bg-gradient-to-br from-emerald-400/25 to-teal-500/10"
            }`}
          />
          <div
            className={`relative h-10 w-10 rounded-xl border flex items-center justify-center ${
              locked
                ? "border-white/10 bg-white/[0.03]"
                : urgent
                  ? "border-rose-400/35 bg-rose-500/[0.08]"
                  : "border-emerald-400/30 bg-emerald-500/[0.08]"
            }`}
          >
            <Icon
              icon={
                locked
                  ? "solar:check-circle-bold-duotone"
                  : urgent
                    ? "solar:fire-bold-duotone"
                    : "solar:home-add-bold-duotone"
              }
              className={`text-xl ${
                locked
                  ? "text-white/40"
                  : urgent
                    ? "text-rose-300"
                    : "text-emerald-300"
              }`}
            />
          </div>
        </div>

        {/* Message */}
        <div className={`min-w-0 flex-1 ${locked ? "pr-7" : ""}`}>
          <p
            className={`text-[13px] font-bold leading-tight truncate ${
              locked
                ? "text-white/65"
                : urgent
                  ? "text-rose-100"
                  : "text-white"
            }`}
          >
            {headline}
          </p>
          <p
            className={`mt-0.5 text-[11.5px] truncate ${
              locked ? "text-white/45" : "text-white/55"
            }`}
          >
            {subline}
          </p>
          {locked && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] italic text-emerald-300/65 leading-snug">
              <Icon
                icon="solar:hand-stars-bold-duotone"
                className="text-[12px] shrink-0"
              />
              Tetap semangat — lead berikutnya bisa milik Anda.
            </p>
          )}
        </div>

        {/* Right side: state-dependent */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {locked ? null : (
            <>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider tabular-nums ${
                  urgent
                    ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                    : "border-white/10 bg-white/[0.03] text-white/55"
                }`}
              >
                <Icon icon="solar:clock-circle-bold-duotone" className="text-[11px]" />
                {cd.text}
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 opacity-70 transition-opacity group-hover:opacity-100">
                Lihat
                <Icon
                  icon="solar:arrow-right-linear"
                  className="text-[12px] transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </>
          )}
        </div>
      </button>
    </motion.li>
  );
}
