"use client";

/* ════════════════════════════════════════════════════════════════════
   Titip-Jual feed untuk HotLeadsCard
   ────────────────────────────────────────────────────────────────────
   Titip-jual masuk dari publik melalui form /titip-jual lalu di-broadcast
   ke semua agent AKTIF di kota yang sama. Modul ini menyediakan:
   - useTitipFeed(): hook untuk fetch + Pusher realtime + accept/reject
   - TitipRow: row visual yang dipasang DI ATAS daftar lead reguler
                (selalu sticky di paling atas, tidak ikut filter).
   - ClaimedTitipModal: modal "reveal" identitas saat klaim sukses.
   ════════════════════════════════════════════════════════════════════ */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";

/* ─────────────── Types ─────────────── */

export type JenisProperti =
  | "RUMAH"
  | "APARTEMEN"
  | "RUKO"
  | "TANAH"
  | "GUDANG"
  | "PABRIK"
  | "HOTEL_DAN_VILLA"
  | "TOKO";

export interface TitipItem {
  id_titip: string;
  jenis_properti: JenisProperti;
  alamat_lengkap: string;
  provinsi: string;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;
  estimasi_harga: string | null;
  pengirim_nama_masked: string;
  pengirim_phone_masked: string;
  status_kepemilikan: "PRIBADI" | "ORANG_LAIN";
  kedaluwarsa_pada: string;
  dibuat_pada: string;
}

export interface ClaimedTitip {
  id_titip: string;
  pengirim_nama: string;
  pengirim_phone: string;
  alamat_lengkap: string;
  jenis_properti: JenisProperti;
  estimasi_harga: string | null;
}

/** Lead yang sudah dimenangkan agent ini — tampil di section
 *  "Sedang Tindak Lanjuti" supaya tidak hilang dari radar. */
export interface ClaimedFollowupItem extends ClaimedTitip {
  kota: string | null;
  kecamatan: string | null;
  claimed_at: number;
}

/** Lead yang sudah diambil agent lain — ditampilkan sebagai closure
 *  card supaya agent yang kalah tidak bingung "kenapa hilang?".
 *  - persistent=false (default): dari Pusher live event, auto-hide 60s
 *  - persistent=true: dari API missed_items, stay sampai user dismiss
 *    secara manual (dipersist via localStorage). */
export interface LockedTitip {
  id_titip: string;
  jenis_properti: JenisProperti;
  alamat_lengkap: string;
  kota: string;
  kecamatan: string | null;
  by_agent_nama: string;
  locked_at: number;
  persistent?: boolean;
}

/* ─────────────── Meta ─────────────── */

export const JENIS_META: Record<
  JenisProperti,
  { label: string; icon: string }
> = {
  RUMAH: { label: "Rumah", icon: "solar:home-2-bold-duotone" },
  APARTEMEN: { label: "Apartemen", icon: "solar:buildings-2-bold-duotone" },
  RUKO: { label: "Ruko", icon: "solar:shop-2-bold-duotone" },
  TANAH: { label: "Tanah", icon: "solar:map-point-wave-bold-duotone" },
  GUDANG: { label: "Gudang", icon: "solar:box-minimalistic-bold-duotone" },
  PABRIK: { label: "Pabrik", icon: "solar:garage-bold-duotone" },
  HOTEL_DAN_VILLA: { label: "Hotel/Villa", icon: "solar:bed-bold-duotone" },
  TOKO: { label: "Toko", icon: "solar:shop-bold-duotone" },
};

/* ─────────────── Helpers ─────────────── */

export function formatRupiahCompact(raw: string | null): string {
  if (!raw) return "Belum ada estimasi";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "Belum ada estimasi";
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `Rp ${v.toFixed(v >= 100 ? 0 : 2).replace(/\.?0+$/, "")} M`;
  }
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)} jt`;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatRupiahFull(raw: string | null): string {
  if (!raw) return "Belum ada harga";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "Belum ada harga";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function countdownText(iso: string): {
  text: string;
  hoursLeft: number;
} {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: "kedaluwarsa", hoursLeft: 0 };
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return { text: `${d}h ${h % 24}j`, hoursLeft: h };
  }
  if (h > 0) return { text: `${h}j ${m}m`, hoursLeft: h };
  return { text: `${m}m`, hoursLeft: 0 };
}

export function formatRelativeTime(ms: number): string {
  const elapsed = Math.max(0, Date.now() - ms);
  if (elapsed < 60_000) return "baru saja";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} menit lalu`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} jam lalu`;
  return `${Math.floor(elapsed / 86_400_000)} hari lalu`;
}

export function formatDateTimeID(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hh}:${mm}`;
}

function waLinkFromPhone(
  phone: string,
  jenis: string,
  alamat: string,
  ctx: { agentName?: string; senderName?: string } = {},
) {
  const digits = phone.replace(/\D/g, "");
  const wa = digits.startsWith("62") ? digits : `62${digits}`;
  const greet = ctx.senderName
    ? `Halo Bapak/Ibu ${ctx.senderName},`
    : "Halo Bapak/Ibu,";
  const intro = ctx.agentName
    ? `perkenalkan, saya ${ctx.agentName}, agent property dari Solusindo Premier.`
    : "perkenalkan, saya agent property dari Solusindo Premier.";
  const text = encodeURIComponent(
    `${greet} ${intro}\n\nSaya baru saja menerima titip jual Anda untuk ${jenis} di ${alamat}. Terima kasih sudah mempercayakan ke kami.\n\nApakah berkenan kalau kita ngobrol singkat (10–15 menit) supaya saya bisa pahami kebutuhan Anda lebih dalam?`,
  );
  return `https://wa.me/${wa}?text=${text}`;
}

/* ════════════════════════════════════════════════════════════════════
   HOOK: useTitipFeed
   - fetch inbox titip per agent
   - Pusher realtime subscribe (titip:new, titip:locked)
   - accept/reject handlers (race-aware: 409 = sudah keburu diambil)
   ════════════════════════════════════════════════════════════════════ */

/** Berapa lama closure card live (dari Pusher event) tetap muncul
 *  sebelum auto-hide. Cukup panjang untuk closure tanpa bikin list
 *  jadi gudang notif lewat. Note: missed items dari API tidak pakai
 *  TTL — mereka stay sampai user dismiss eksplisit. */
const LOCKED_VISIBLE_MS = 60_000;

/** Key localStorage untuk track lead missed yang sudah di-acknowledge user.
 *  Pakai client-side persist supaya tidak butuh migration schema baru
 *  (enum distribusi cuma punya pending/diterima/ditolak). */
const DISMISSED_LOCKED_KEY = "titip:dismissed-missed";

export function readDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_LOCKED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function writeDismissedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISSED_LOCKED_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // storage full / disabled — biarkan saja
  }
}

export function useTitipFeed() {
  const [items, setItems] = useState<TitipItem[]>([]);
  const [claimedItems, setClaimedItems] = useState<ClaimedFollowupItem[]>([]);
  const [lockedItems, setLockedItems] = useState<LockedTitip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<ClaimedTitip | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [removalId, setRemovalId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "warn" | "err";
    text: string;
  } | null>(null);

  const showToast = useCallback(
    (kind: "warn" | "err", text: string, ms = 3000) => {
      setToast({ kind, text });
      window.setTimeout(() => setToast(null), ms);
    },
    [],
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const res = await fetch("/api/leads/titip-jual/inbox", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json?.error || `HTTP ${res.status}`);
      setItems(json.items || []);

      // Hydrate "Sedang Tindak Lanjuti" — lead yang sudah dimenangkan
      // oleh agent ini di sesi sebelumnya tetap muncul setelah refresh.
      const claimedFromApi: ClaimedFollowupItem[] = (json.claimed_items || []).map(
        (c: {
          id_titip: string;
          jenis_properti: JenisProperti;
          alamat_lengkap: string;
          kota: string | null;
          kecamatan: string | null;
          estimasi_harga: string | null;
          pengirim_nama: string;
          pengirim_phone: string;
          diklaim_pada: string | null;
        }) => ({
          id_titip: c.id_titip,
          jenis_properti: c.jenis_properti,
          alamat_lengkap: c.alamat_lengkap,
          kota: c.kota,
          kecamatan: c.kecamatan,
          estimasi_harga: c.estimasi_harga,
          pengirim_nama: c.pengirim_nama,
          pengirim_phone: c.pengirim_phone,
          claimed_at: c.diklaim_pada
            ? new Date(c.diklaim_pada).getTime()
            : Date.now(),
        }),
      );
      // Merge: prefer entry dari API (otoritatif) tapi pertahankan
      // entry session yang belum sempat ke-fetch. Dedup by id.
      setClaimedItems((prev) => {
        const apiIds = new Set(claimedFromApi.map((x) => x.id_titip));
        const localOnly = prev.filter((x) => !apiIds.has(x.id_titip));
        return [...claimedFromApi, ...localOnly];
      });

      // Hydrate "missed" — closure persisten untuk agent yang tidak sempat
      // klaim. Lewati yang sudah di-dismiss user (track via localStorage).
      const dismissed = readDismissedIds();
      const missedFromApi: LockedTitip[] = (json.missed_items || [])
        .filter((m: { id_titip: string }) => !dismissed.has(m.id_titip))
        .map(
          (m: {
            id_titip: string;
            jenis_properti: JenisProperti;
            alamat_lengkap: string;
            kota: string;
            kecamatan: string | null;
            by_agent_nama: string;
            diklaim_pada: string | null;
          }) => ({
            id_titip: m.id_titip,
            jenis_properti: m.jenis_properti,
            alamat_lengkap: m.alamat_lengkap,
            kota: m.kota,
            kecamatan: m.kecamatan,
            by_agent_nama: m.by_agent_nama,
            locked_at: m.diklaim_pada
              ? new Date(m.diklaim_pada).getTime()
              : Date.now(),
            persistent: true,
          }),
        );
      setLockedItems((prev) => {
        // Hindari duplikat dengan locked yang sudah ada (mis. dari Pusher
        // live event yang barusan terjadi). Prefer entry persisten dari API.
        const apiIds = new Set(missedFromApi.map((x) => x.id_titip));
        const localOnly = prev.filter((x) => !apiIds.has(x.id_titip));
        return [...missedFromApi, ...localOnly];
      });

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // initial + focus refresh + 60s polling fallback
  useEffect(() => {
    load();
    const onFocus = () => load({ silent: true });
    const onVis = () => {
      if (!document.hidden) load({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const intv = window.setInterval(() => load({ silent: true }), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(intv);
    };
  }, [load]);

  // Pusher realtime
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("@/lib/pusher-client");
        const pc = mod.pusherClient;
        const ch = pc.subscribe("titip-broadcast");
        const onNew = () => load({ silent: true });
        const onLocked = (data: {
          id_titip: string;
          by_agent_nama?: string;
          at_iso?: string;
        }) => {
          setItems((prev) => {
            const target = prev.find((x) => x.id_titip === data.id_titip);
            if (!target) return prev;

            const lockedAt = data.at_iso
              ? new Date(data.at_iso).getTime()
              : Date.now();
            const lockedEntry: LockedTitip = {
              id_titip: data.id_titip,
              jenis_properti: target.jenis_properti,
              alamat_lengkap: target.alamat_lengkap,
              kota: target.kota,
              kecamatan: target.kecamatan,
              by_agent_nama: data.by_agent_nama || "Agent lain",
              locked_at: lockedAt,
            };

            // Tampilkan closure card supaya agent tidak bingung kenapa
            // lead-nya menghilang. Tidak nge-stack — replace existing
            // entry untuk id yang sama (race-safe).
            setLockedItems((curr) => [
              lockedEntry,
              ...curr.filter((x) => x.id_titip !== data.id_titip),
            ]);
            // Auto-clear setelah jangka closure — kecuali sementara itu
            // entry sudah ter-upgrade jadi persistent (dari API missed_items
            // pada refresh berikutnya). Persistent harus stay sampai user
            // dismiss manual.
            window.setTimeout(() => {
              setLockedItems((curr) => {
                const target = curr.find((x) => x.id_titip === data.id_titip);
                if (target?.persistent) return curr;
                return curr.filter((x) => x.id_titip !== data.id_titip);
              });
            }, LOCKED_VISIBLE_MS);

            // Pindah dari "actionable" → "closure" dengan shake transition
            setConflictId(data.id_titip);
            window.setTimeout(() => {
              setItems((p) => p.filter((x) => x.id_titip !== data.id_titip));
              setConflictId(null);
            }, 900);
            return prev;
          });
        };
        ch.bind("titip:new", onNew);
        ch.bind("titip:locked", onLocked);
        cleanup = () => {
          ch.unbind("titip:new", onNew);
          ch.unbind("titip:locked", onLocked);
          pc.unsubscribe("titip-broadcast");
        };
      } catch {
        // Pusher tidak siap — fallback polling sudah jalan
      }
    })();
    return () => {
      if (cleanup) cleanup();
    };
  }, [load]);

  const accept = useCallback(
    async (id: string) => {
      if (pendingAction) return;
      setPendingAction(`accept:${id}`);
      try {
        const res = await fetch(`/api/leads/titip-jual/${id}/accept`, {
          method: "POST",
        });
        const json = await res.json();
        if (res.status === 409) {
          setConflictId(id);
          showToast("warn", "Sudah keburu diambil agent lain.");
          window.setTimeout(() => {
            setItems((prev) => prev.filter((x) => x.id_titip !== id));
            setConflictId(null);
          }, 900);
          return;
        }
        if (!res.ok || !json.ok)
          throw new Error(json?.error || "Gagal terima");

        // Capture context dari item asli (kota/kecamatan) sebelum
        // di-remove — agar bisa ditampilkan di follow-up card.
        const sourceItem = items.find((x) => x.id_titip === id);

        setRemovalId(id);
        window.setTimeout(() => {
          setItems((prev) => prev.filter((x) => x.id_titip !== id));
          setRemovalId(null);
          setClaimed(json.titip);

          // Pindahkan ke section "Sedang Tindak Lanjuti" supaya agent
          // tidak kehilangan jejak lead-nya untuk follow-up.
          const followup: ClaimedFollowupItem = {
            ...json.titip,
            kota: sourceItem?.kota ?? null,
            kecamatan: sourceItem?.kecamatan ?? null,
            claimed_at: Date.now(),
          };
          setClaimedItems((curr) => [
            followup,
            ...curr.filter((x) => x.id_titip !== id),
          ]);
        }, 380);
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : String(e));
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction, showToast, items],
  );

  const reject = useCallback(
    async (id: string) => {
      if (pendingAction) return;
      setPendingAction(`reject:${id}`);
      try {
        const res = await fetch(`/api/leads/titip-jual/${id}/reject`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.ok)
          throw new Error(json?.error || "Gagal tolak");
        setRemovalId(id);
        window.setTimeout(() => {
          setItems((prev) => prev.filter((x) => x.id_titip !== id));
          setRemovalId(null);
        }, 320);
      } catch (e) {
        showToast("err", e instanceof Error ? e.message : String(e));
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction, showToast],
  );

  /** Buka kembali modal playbook dari row "Sedang Tindak Lanjuti".
   *  Agent bisa lanjut step yang belum selesai tanpa kehilangan konteks. */
  const reopenPlaybook = useCallback((item: ClaimedFollowupItem) => {
    setClaimed({
      id_titip: item.id_titip,
      pengirim_nama: item.pengirim_nama,
      pengirim_phone: item.pengirim_phone,
      alamat_lengkap: item.alamat_lengkap,
      jenis_properti: item.jenis_properti,
      estimasi_harga: item.estimasi_harga,
    });
  }, []);

  /** Manual dismiss closure card (X icon). Untuk entry yang berasal
   *  dari API missed_items, ID-nya disimpan di localStorage supaya
   *  tidak muncul kembali setelah refresh. */
  const dismissLocked = useCallback((id: string) => {
    setLockedItems((curr) => {
      const target = curr.find((x) => x.id_titip === id);
      if (target?.persistent) {
        const ids = readDismissedIds();
        ids.add(id);
        writeDismissedIds(ids);
      }
      return curr.filter((x) => x.id_titip !== id);
    });
  }, []);

  return {
    items,
    claimedItems,
    lockedItems,
    loading,
    error,
    pendingAction,
    claimed,
    conflictId,
    removalId,
    toast,
    accept,
    reject,
    refresh: load,
    reopenPlaybook,
    dismissLocked,
    closeClaimed: () => setClaimed(null),
  };
}

/* ════════════════════════════════════════════════════════════════════
   TITIP ROW — gaya HotLead tapi dengan tombol Terima/Tolak inline
   ════════════════════════════════════════════════════════════════════ */

export function TitipRow({
  item,
  pendingAction,
  conflictId,
  removalId,
  onAccept,
  onReject,
}: {
  item: TitipItem;
  pendingAction: string | null;
  conflictId: string | null;
  removalId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const meta = JENIS_META[item.jenis_properti] || JENIS_META.RUMAH;
  const cd = countdownText(item.kedaluwarsa_pada);
  const isAccepting = pendingAction === `accept:${item.id_titip}`;
  const isRejecting = pendingAction === `reject:${item.id_titip}`;
  const isBusyAny = pendingAction !== null;
  const isConflict = conflictId === item.id_titip;
  const isRemoving = removalId === item.id_titip;

  const urgent = cd.hoursLeft < 6;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={
        isRemoving
          ? {
              opacity: 0,
              x: 18,
              height: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
            }
          : isConflict && !reduce
            ? { x: [-2, 3, -3, 2, 0], opacity: [1, 1, 0.7, 0.35, 0] }
            : { opacity: 1, y: 0 }
      }
      exit={{ opacity: 0, x: 18, height: 0 }}
      transition={{
        layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.25 },
      }}
      className="group relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.025] to-transparent shadow-[0_8px_28px_-16px_rgba(52,211,153,0.55)]"
    >
      {/* moving sheen — terasa "hot" */}
      {!reduce && (
        <motion.div
          aria-hidden
          initial={{ x: "-120%" }}
          animate={{ x: "140%" }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute -inset-y-2 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/[0.12] to-transparent skew-x-12"
        />
      )}

      {/* left accent */}
      <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-emerald-300 via-emerald-500 to-teal-500" />

      {/* Top: icon + content */}
      <div className="relative flex gap-3 p-3 pr-3 pl-4">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/25 to-teal-500/10 blur-[8px]" />
          <div className="relative grid h-16 w-16 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06]">
            <Icon icon={meta.icon} className="text-emerald-300 text-3xl" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Meta row: type · lokasi  +  badges (Urgent / Titip Jual) inline */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/85 shrink-0">
              {meta.label}
            </span>
            <span className="text-white/20 shrink-0">·</span>
            <span className="text-white/55 font-semibold text-[11px] truncate min-w-0">
              {[item.kecamatan, item.kota].filter(Boolean).join(", ")}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1.5">
              {urgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-200">
                  <Icon icon="solar:fire-bold-duotone" className="text-[11px]" />
                  Mendesak
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-100 shadow-[0_2px_8px_-2px_rgba(52,211,153,0.5)]">
                <Icon icon="solar:home-add-bold-duotone" className="text-[11px]" />
                Titip Jual
              </span>
            </div>
          </div>

          <p className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug text-white">
            {item.alamat_lengkap}
          </p>

          <div className="mt-1.5">
            <span className="text-[17px] font-black tabular-nums text-emerald-300 tracking-tight">
              {formatRupiahFull(item.estimasi_harga)}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className="inline-flex items-center gap-1 select-none"
              style={{ filter: "blur(0.6px)" }}
            >
              <Icon icon="solar:user-bold" className="text-[12px]" />
              {item.pengirim_nama_masked}
            </span>
            <span className="text-white/20">·</span>
            <span
              className="tabular-nums select-none"
              style={{ filter: "blur(0.6px)" }}
            >
              {item.pengirim_phone_masked}
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                item.status_kepemilikan === "PRIBADI"
                  ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200/90"
                  : "border-amber-400/25 bg-amber-400/[0.06] text-amber-200/90"
              }`}
            >
              {item.status_kepemilikan === "PRIBADI" ? "Pribadi" : "Kuasa"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom banner: countdown + actions */}
      <div className="flex items-center justify-between gap-2 border-t border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-2 sm:px-4">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
          <Icon icon="solar:clock-circle-bold-duotone" className="text-[13px]" />
          Kedaluwarsa {cd.text}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReject(item.id_titip)}
            disabled={isBusyAny}
            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold transition ${
              isBusyAny && !isRejecting
                ? "border-white/5 text-white/25 cursor-not-allowed"
                : isRejecting
                  ? "border-red-400/40 bg-red-400/10 text-red-200"
                  : "border-white/10 text-white/65 hover:border-red-400/40 hover:bg-red-400/[0.08] hover:text-red-200"
            }`}
          >
            {isRejecting ? (
              <Icon icon="line-md:loading-loop" className="text-[13px]" />
            ) : (
              "Tolak"
            )}
          </button>
          <button
            type="button"
            onClick={() => onAccept(item.id_titip)}
            disabled={isBusyAny}
            className={`relative inline-flex h-7 items-center gap-1 overflow-hidden rounded-lg px-2.5 text-[10px] font-bold transition ${
              isBusyAny && !isAccepting
                ? "bg-white/[0.04] text-white/25 cursor-not-allowed"
                : isAccepting
                  ? "bg-emerald-400 text-[#05070D]"
                  : "bg-gradient-to-r from-emerald-400 to-teal-400 text-[#05070D] shadow-[0_4px_14px_-4px_rgba(52,211,153,0.7)] hover:shadow-[0_8px_22px_-6px_rgba(52,211,153,0.9)] active:scale-[0.97]"
            }`}
          >
            {isAccepting ? (
              <>
                <Icon icon="line-md:loading-loop" className="text-[13px]" />
                <span>Klaim…</span>
              </>
            ) : (
              <>
                <Icon icon="solar:check-read-bold" className="text-[13px]" />
                <span>Terima Lead</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conflict overlay */}
      <AnimatePresence>
        {isConflict && (
          <motion.div
            key="conflict"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-[11px] font-bold text-amber-100">
              <Icon
                icon="solar:lock-keyhole-bold-duotone"
                className="text-base"
              />
              Sudah diambil agent lain
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CLAIMED FOLLOW-UP ROW
   ────────────────────────────────────────────────────────────────────
   Lead yang sukses diklaim agent ini — supaya tidak hilang dari radar.
   Ditampilkan di section "Sedang Tindak Lanjuti" di atas titip jual baru.
   Klik untuk re-open modal playbook dan lanjutkan langkah closing.
   ════════════════════════════════════════════════════════════════════ */

export function ClaimedFollowupRow({
  item,
  onOpenPlaybook,
}: {
  item: ClaimedFollowupItem;
  onOpenPlaybook: (item: ClaimedFollowupItem) => void;
}) {
  const reduce = useReducedMotion();
  const meta = JENIS_META[item.jenis_properti] || JENIS_META.RUMAH;
  const lokasi = [item.kecamatan, item.kota].filter(Boolean).join(", ");
  // Re-render setiap 30s biar "5 menit lalu" tetap akurat tanpa polling berat
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full min-w-0 overflow-hidden rounded-xl p-[1px] bg-[linear-gradient(135deg,rgba(110,231,183,0.65)_0%,rgba(45,212,191,0.25)_40%,rgba(255,255,255,0.05)_60%,rgba(45,212,191,0.3)_85%,rgba(110,231,183,0.6)_100%)] shadow-[0_10px_28px_-14px_rgba(16,185,129,0.7)]"
    >
      <div className="relative rounded-[11px] overflow-hidden bg-[linear-gradient(180deg,#0A1418_0%,#070A0D_100%)]">
        {/* Aurora ambient */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -left-6 h-32 w-40 opacity-50 blur-2xl bg-[radial-gradient(60%_60%_at_30%_50%,rgba(16,185,129,0.45),transparent_70%)]"
        />

        {/* moving sheen */}
        {!reduce && (
          <motion.div
            aria-hidden
            initial={{ x: "-130%" }}
            animate={{ x: "150%" }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute -inset-y-2 w-1/4 bg-gradient-to-r from-transparent via-emerald-300/[0.12] to-transparent skew-x-12"
          />
        )}

        {/* Header strip */}
        <div className="relative flex items-center justify-between gap-2 px-3.5 pt-2.5">
          <div className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            <span className="text-[9.5px] font-black uppercase tracking-[0.22em] bg-gradient-to-r from-emerald-200 via-emerald-100 to-teal-200 bg-clip-text text-transparent">
              Sedang Tindak Lanjuti
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-white/45 tabular-nums">
            <Icon icon="solar:clock-circle-bold-duotone" className="text-[10px]" />
            diklaim {formatRelativeTime(item.claimed_at)}
          </span>
        </div>

        {/* Main */}
        <div className="relative flex items-center gap-3 px-3.5 py-2.5 min-w-0">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-emerald-400/35 to-teal-500/5 blur-[6px]" />
            <div className="relative grid h-11 w-11 place-items-center rounded-lg border border-emerald-400/35 bg-emerald-500/[0.10]">
              <Icon
                icon={meta.icon}
                className="text-emerald-200 text-xl drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]"
              />
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-extrabold leading-tight text-white tracking-tight">
              {item.alamat_lengkap}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              <span className="text-[10.5px] font-semibold text-white/55 truncate">
                {meta.label}{lokasi ? ` · ${lokasi}` : ""}
              </span>
            </div>
            {item.estimasi_harga && (
              <div className="mt-0.5 text-[12.5px] font-black tabular-nums text-emerald-300 tracking-tight">
                {formatRupiahFull(item.estimasi_harga)}
              </div>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="relative flex items-center gap-1.5 border-t border-emerald-400/10 bg-emerald-500/[0.04] px-3.5 py-2">
          <span className="text-[10px] font-bold text-white/45 truncate">
            <Icon icon="solar:user-bold-duotone" className="inline text-[12px] mr-1 -mt-[1px]" />
            {item.pengirim_nama}
          </span>
          <button
            type="button"
            onClick={() => onOpenPlaybook(item)}
            className="relative ml-auto inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 px-3 text-[10.5px] font-extrabold tracking-wide text-[#05070D] shadow-[0_4px_14px_-4px_rgba(52,211,153,0.7),inset_0_1px_0_rgba(255,255,255,0.45)] hover:shadow-[0_8px_22px_-6px_rgba(52,211,153,0.95)] active:scale-[0.97] transition-all"
          >
            {!reduce && (
              <motion.span
                aria-hidden
                initial={{ x: "-150%" }}
                animate={{ x: "180%" }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.4 }}
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent skew-x-12"
              />
            )}
            <Icon icon="solar:document-text-bold-duotone" className="relative text-[12px]" />
            <span className="relative">Buka Panduan</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LOCKED ROW
   ────────────────────────────────────────────────────────────────────
   Closure card untuk agent yang kalah cepat. Bukan dihilangkan
   diam-diam — transparan: siapa yang ambil + kapan. Hindari kesan
   "leader nyembunyiin lead". Auto-hide setelah LOCKED_VISIBLE_MS.
   ════════════════════════════════════════════════════════════════════ */

export function LockedRow({
  item,
  onDismiss,
}: {
  item: LockedTitip;
  onDismiss: (id: string) => void;
}) {
  const meta = JENIS_META[item.jenis_properti] || JENIS_META.RUMAH;
  const lokasi = [item.kecamatan, item.kota].filter(Boolean).join(", ");

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.018)_0%,rgba(255,255,255,0.008)_100%)]"
    >
      {/* Watermark stamp */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-[44px] font-black tracking-[0.08em] text-white/[0.025] rotate-[-12deg]"
      >
        TERKLAIM
      </div>

      {/* Diagonal scanline texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025] bg-[repeating-linear-gradient(45deg,transparent_0_8px,rgba(255,255,255,0.6)_8px_9px)]"
      />

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(item.id_titip)}
        aria-label="Tutup notifikasi"
        className="absolute right-2 top-2 z-10 h-6 w-6 rounded-md border border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.06] flex items-center justify-center transition"
      >
        <Icon icon="solar:close-circle-bold" className="text-[12px]" />
      </button>

      <div className="relative flex items-center gap-3 px-3.5 py-2.5 opacity-75">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025]">
            <Icon icon={meta.icon} className="text-white/35 text-lg" />
          </div>
          {/* Mini lock badge */}
          <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[#0A0F17] border border-white/15">
            <Icon icon="solar:lock-keyhole-minimalistic-bold" className="text-white/45 text-[9px]" />
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35 shrink-0">
              {item.persistent ? "Lead Terlewat" : "Telah diambil"}
            </span>
            <span className="text-white/15 shrink-0">·</span>
            <span className="text-[10px] font-semibold text-white/40 truncate">
              {meta.label}{lokasi ? ` · ${lokasi}` : ""}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] font-bold leading-tight text-white/55">
            {item.alamat_lengkap}
          </p>
          <p className="mt-1 text-[10.5px] text-white/50 leading-snug">
            Lead titip jual ini telah diterima oleh{" "}
            <span className="font-bold text-white/75">
              {item.by_agent_nama}
            </span>{" "}
            pada{" "}
            <span className="font-bold tabular-nums text-white/65">
              {formatDateTimeID(item.locked_at)}
            </span>
            .
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] italic text-emerald-300/65 leading-snug">
            <Icon icon="solar:hand-stars-bold-duotone" className="text-[12px] shrink-0" />
            Tetap semangat — semakin cepat respon, semakin besar peluang Anda menang di lead berikutnya.
          </p>
        </div>
      </div>
    </motion.article>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TOAST + MODAL
   ════════════════════════════════════════════════════════════════════ */

export function TitipToast({
  toast,
}: {
  toast: { kind: "warn" | "err"; text: string } | null;
}) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key="t"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
          className={`fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-[12.5px] font-semibold backdrop-blur-xl ${
            toast.kind === "warn"
              ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
              : "border-red-400/40 bg-red-400/15 text-red-100"
          }`}
        >
          <Icon
            icon={
              toast.kind === "warn"
                ? "solar:bell-bold-duotone"
                : "solar:danger-triangle-bold-duotone"
            }
            className="text-base"
          />
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PLAYBOOK — mentor mode (bukan textbook)
   ────────────────────────────────────────────────────────────────────
   Filosofi: agent dibimbing tahap-demi-tahap oleh "coach" senior.
   Hanya satu tahap aktif sekaligus — tahap berikutnya unlock setelah
   tahap saat ini ditandai selesai. Setiap tahap punya:
   - Suara coach (first-person, hangat) → bukan instruksi textbook.
   - Deadline countdown → mendorong action, bukan procrastinate.
   - Checklist interaktif → progress terasa nyata.
   ════════════════════════════════════════════════════════════════════ */

interface ChecklistItem {
  text: string;
  /** Template pesan yang bisa di-copy agent untuk kirim via WhatsApp.
   *  Mendukung placeholder `{agentName}` dan `{senderName}` yang akan
   *  diisi dari session agent + nama pengirim titip jual. */
  copyMessage?: string;
  /** Kalau item ini adalah aksi TTD MOU, render prominent button untuk
   *  generate dokumen MOU saat item ini jadi satu-satunya sisa unchecked. */
  generateMou?: boolean;
}

interface ChecklistGroup {
  label: string;
  icon: string;
  /** Catatan tambahan kalau perlu — mis. "JANGAN ditanya di WhatsApp". */
  note?: string;
  items: ChecklistItem[];
}

interface PlaybookStep {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  /** Berapa jam dari tahap ini dimulai sampai dianggap telat. */
  deadlineHours: number;
  /** Suara coach senior — first-person, hangat, to-the-point. */
  coachLine: string;
  /** Insight data-driven yang ditampilkan setelah coach. */
  insight: string;
  /** Checklist di-grup supaya jelas mana "saat WA", mana "saat call",
   *  mana "saat lapangan". Mencegah agent dump pertanyaan via chat. */
  checklist: ChecklistGroup[];
  /** Tombol primary action untuk tahap ini. */
  cta: { kind: "whatsapp" | "upload"; label: string } | null;
}

const PLAYBOOK: PlaybookStep[] = [
  {
    id: "contact",
    icon: "solar:chat-round-call-bold-duotone",
    title: "Sapa Client + Discovery Call",
    subtitle: "Bangun kepercayaan, gali konteks",
    deadlineHours: 24,
    coachLine:
      "Kerja bagus {agentName}! Klaim duluan udah, tapi belum nentuin closing. Di WA cukup intro + ajakin {senderName} ngobrol — JANGAN serbu pertanyaan, dia bisa ilfeel kayak diinterogasi. Sapa hangat, tawarin call. Di call baru gali konteks + tutup dengan TTD MOU. Tanpa MOU, kerja kamu nggak ada kuncinya.",
    insight:
      "Speed-to-lead di bawah 5 menit naikkan conversion 9x. Tapi cepat ≠ buru-buru gali. Discovery yang tepat dilakukan saat call, bukan chat.",
    checklist: [
      {
        label: "Saat WhatsApp pertama",
        icon: "ic:baseline-whatsapp",
        note: "Cukup intro + minta izin ngobrol — JANGAN serbu pertanyaan.",
        items: [
          { text: "Sebut nama Anda + agency Solusindo Premier dengan jelas" },
          { text: "Konfirmasi sudah menerima titip jual & ucapkan terima kasih" },
          { text: "Sapa hangat, build rapport singkat — bukan langsung jualan" },
          { text: "Tawarkan call singkat 10–15 menit dalam 24 jam" },
        ],
      },
      {
        label: "Saat call / meeting (tutup dengan TTD MOU)",
        icon: "solar:phone-rounded-bold-duotone",
        note: "Pertemuan ditutup dengan TTD MOU/PJB eksklusif — ini yang ngebuka kamu kerja maksimal di step berikutnya.",
        items: [
          {
            text: "Tanya spesifikasi properti",
            copyMessage: `Halo Bapak/Ibu {senderName}, ini {agentName} dari Solusindo Premier.

Terima kasih sudah meluangkan waktu untuk berdiskusi sebelumnya. Supaya saya bisa susun strategi pemasaran yang pas untuk properti Bapak/Ibu, mohon izin minta info singkat berikut:

1. Alamat lengkap:
2. Luas tanah (m²):
3. Luas bangunan (m²):
4. Jumlah kamar tidur:
5. Jumlah kamar mandi:
6. Kondisi (furnished / semi-furnished / kosongan):
7. Jumlah lantai (atau lantai ke berapa jika apartemen):
8. Daya listrik (VA):
9. Sumber air (PDAM / sumur / lainnya):

Mohon dijawab sesuai data yang ada ya Bapak/Ibu. Terima kasih banyak, ditunggu kabar baiknya 🙏`,
          },
          { text: "Sepakati jadwal site visit dalam 2×24 jam" },
          { text: "Minta identitas pemilik untuk pembuatan MOU" },
          { text: "TTD MOU pemasaran", generateMou: true },
        ],
      },
    ],
    cta: { kind: "whatsapp", label: "Hubungi via WhatsApp sekarang" },
  },
  {
    id: "visit",
    icon: "solar:home-smile-angle-bold-duotone",
    title: "Site Visit + Analisis Harga Pasar",
    subtitle: "Verifikasi langsung, susun CMA",
    deadlineHours: 72,
    coachLine:
      "Mantap {agentName}! MOU di tangan = komisi aman. Waktunya turun lapangan. Bawa kamera + meteran + banner, dokumentasi profesional, verifikasi dokumen, pasang banner. Pulang kantor susun CMA — pricing tepat yang bedain agent biasa sama agent jago. Present ke {senderName}, sepakati harga, lanjut deploy marketing.",
    insight:
      "Foto profesional + verifikasi dokumen di sesi pertama hindari bolak-balik. CMA tepat bikin listing nggak stale di pasar.",
    checklist: [
      {
        label: "Persiapan sebelum berangkat",
        icon: "solar:checklist-minimalistic-bold-duotone",
        note: "MOU sudah di tangan dari step 1 — kamu kerja dengan legal protection. Bawa peralatan lengkap.",
        items: [
          { text: "Bawa kamera + meteran" },
          { text: "Bawa banner (langsung pasang di lokasi)" },
        ],
      },
      {
        label: "Saat site visit di lokasi",
        icon: "solar:camera-bold-duotone",
        items: [
          { text: "Foto & video: tampak depan rumah, tampak depan jalan, setiap ruangan" },
          { text: "Catat kondisi fisik, hadap rumah, lebar × panjang bangunan" },
          { text: "Verifikasi dokumen original (SHM/SHGB, IMB, PBB)" },
          { text: "Pasang banner di lokasi" },
        ],
      },
      {
        label: "Setelah balik kantor",
        icon: "solar:chart-square-bold-duotone",
        items: [
          { text: "Susun CMA dari 5+ listing aktif & sold dalam radius 1–2 km" },
          { text: "Present CMA ke client + sepakati pricing strategy" },
        ],
      },
    ],
    cta: null,
  },
  {
    id: "upload",
    icon: "solar:rocket-2-bold-duotone",
    title: "Upload ke Solusindo Aset",
    subtitle: "Maksimalkan visibility golden window",
    deadlineHours: 24,
    coachLine:
      "Hampir finish {agentName}! 7 hari pertama listing = golden window. Bikin judul + foto yang nge-hook dari ribuan listing lain. Setelah live, update {senderName} mingguan — komunikasi rutin = referral nggak ada habisnya. Push sampai finish!",
    insight:
      "7 hari pertama listing baru = visibility window paling penting. Setelah itu listing mulai kelihatan stale di feed pencari.",
    checklist: [
      {
        label: "Upload & distribusi",
        icon: "solar:upload-square-bold-duotone",
        items: [
          { text: "Upload ke Solusindo Aset — auto-distribusi ke network" },
          { text: "Judul + deskripsi yang menjual (highlight USP & lokasi)" },
          { text: "Upload semua foto profesional + walkthrough video" },
          { text: "Cross-post ke Rumah123, OLX, Lamudi" },
          { text: "Share ke co-broking network internal Solusindo" },
        ],
      },
      {
        label: "Maintain client",
        icon: "solar:phone-rounded-bold-duotone",
        items: [
          { text: "Jadwalkan update mingguan ke client (view, inquiry, showing)" },
        ],
      },
    ],
    cta: { kind: "upload", label: "Buka halaman Listing" },
  },
];

/* ─────────────── Progress storage ───────────────
   Disimpan per id_titip via localStorage supaya refresh / re-open
   modal lanjut dari tahap terakhir, bukan reset dari nol. */

interface PlaybookProgress {
  /** stepId → ms saat tahap dimulai (countdown deadline mulai dari sini). */
  startedAt: Record<string, number>;
  /** stepId → ms saat tahap ditandai selesai. */
  completedAt: Record<string, number>;
  /** "stepId:itemIdx" → checked. */
  checks: Record<string, boolean>;
}

const PROGRESS_KEY = (id: string) => `titip:playbook:${id}`;

function loadProgress(id: string): PlaybookProgress {
  if (typeof window === "undefined") {
    return { startedAt: {}, completedAt: {}, checks: {} };
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY(id));
    if (!raw) return { startedAt: {}, completedAt: {}, checks: {} };
    const parsed = JSON.parse(raw);
    return {
      startedAt: parsed.startedAt ?? {},
      completedAt: parsed.completedAt ?? {},
      checks: parsed.checks ?? {},
    };
  } catch {
    return { startedAt: {}, completedAt: {}, checks: {} };
  }
}

function saveProgress(id: string, progress: PlaybookProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY(id), JSON.stringify(progress));
  } catch {
    // storage penuh — biarkan saja
  }
}

/** Ambil nama depan dari nama lengkap (kata pertama). */
function firstName(full: string | null | undefined): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

/** Inject nama agent + sender ke template coach line. */
function formatCoachLine(
  template: string,
  agent: string,
  sender: string,
): string {
  return template
    .replace(/\{agentName\}/g, agent || "Kamu")
    .replace(/\{senderName\}/g, sender || "client");
}

/** Generate draft MOU pemasaran dengan data agent + client + properti
 *  yang sudah di-auto-fill, buka di window baru dengan styling print-ready.
 *  Agent bisa cetak / save as PDF langsung dari sana. */
function openMouDocument(
  data: ClaimedTitip,
  agentFullName: string,
) {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const meta = JENIS_META[data.jenis_properti] || JENIS_META.RUMAH;
  const harga = formatRupiahFull(data.estimasi_harga);
  const docNo = `SIP/SP/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`;
  const senderName = data.pengirim_nama || "________________";
  const agent = agentFullName || "________________";

  // HTML escape util kecil
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
    );

  const html = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="UTF-8">
<title>Surat Izin Pemasaran — ${esc(data.alamat_lengkap)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; max-width: 760px; margin: 0 auto; padding: 32px 40px 80px; color: #1a1a1a; line-height: 1.65; font-size: 12pt; }
  .toolbar { position: sticky; top: 0; background: #f1f5f9; padding: 12px 16px; margin: -32px -40px 24px; border-bottom: 1px solid #cbd5e1; display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  .toolbar h3 { margin: 0; font-size: 13px; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .toolbar button { background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; font-family: -apple-system, sans-serif; font-size: 13px; }
  .toolbar button:hover { background: #059669; }
  h1 { text-align: center; text-transform: uppercase; letter-spacing: 2px; font-size: 16pt; margin: 8px 0 4px; }
  .docno { text-align: center; font-size: 11pt; color: #555; margin-bottom: 28px; }
  .section { margin-top: 18px; }
  .label { font-weight: bold; display: inline-block; min-width: 140px; }
  ol { padding-left: 22px; }
  ol li { margin-bottom: 6px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 72px; gap: 32px; }
  .sig { flex: 1; text-align: center; }
  .sig-title { font-weight: bold; margin-bottom: 6px; }
  .sig-line { border-top: 1.5px solid #000; margin-top: 80px; padding-top: 6px; font-weight: bold; }
  @media print {
    .toolbar { display: none; }
    body { margin: 0; padding: 20mm; }
  }
</style>
</head><body>
<div class="toolbar">
  <h3>📄 Draft MOU siap di-cetak / save as PDF</h3>
  <button onclick="window.print()">🖨 Cetak / Save PDF</button>
</div>

<h1>Surat Izin Pemasaran Properti</h1>
<div class="docno">No: ${esc(docNo)}</div>

<p>Yang bertanda tangan di bawah ini:</p>

<div class="section">
  <p><span class="label">Nama</span>: ${esc(senderName)}</p>
  <p><span class="label">Alamat Properti</span>: ${esc(data.alamat_lengkap)}</p>
  <p><span class="label">No. Telepon</span>: +62${esc(data.pengirim_phone)}</p>
  <p>Selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong> (Pemberi Kuasa).</p>
</div>

<div class="section">
  <p><span class="label">Nama</span>: ${esc(agent)}</p>
  <p><span class="label">Agency</span>: Solusindo Premier</p>
  <p>Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong> (Penerima Kuasa).</p>
</div>

<p>Dengan ini PIHAK PERTAMA memberikan kuasa eksklusif kepada PIHAK KEDUA untuk memasarkan properti berikut:</p>

<div class="section">
  <p><span class="label">Jenis Properti</span>: ${esc(meta.label)}</p>
  <p><span class="label">Alamat</span>: ${esc(data.alamat_lengkap)}</p>
  <p><span class="label">Estimasi Harga</span>: ${esc(harga)}</p>
</div>

<p><strong>HAK DAN KEWAJIBAN:</strong></p>
<ol>
  <li>PIHAK KEDUA berhak memasarkan properti melalui channel resmi (online listing, offline marketing, signage di lokasi).</li>
  <li>PIHAK KEDUA berhak menerima komisi sebesar <strong>2,5% (dua koma lima persen)</strong> dari harga transaksi jika properti berhasil terjual melalui mediasi PIHAK KEDUA.</li>
  <li>PIHAK PERTAMA berkewajiban menyediakan dokumen asli properti (SHM/SHGB, IMB, PBB) untuk keperluan verifikasi calon pembeli.</li>
  <li>Jangka waktu kerja sama: <strong>3 (tiga) bulan</strong> sejak surat ini ditandatangani, dapat diperpanjang dengan kesepakatan tertulis bersama.</li>
  <li>PIHAK PERTAMA tidak diperkenankan menerima penawaran langsung dari calon pembeli yang diperkenalkan oleh PIHAK KEDUA selama masa berlaku surat ini.</li>
  <li>Pengakhiran kerja sama sebelum masa berlaku habis hanya dapat dilakukan dengan kesepakatan tertulis kedua belah pihak.</li>
</ol>

<p>Demikian surat izin pemasaran ini dibuat dengan kesadaran penuh tanpa adanya paksaan dari pihak manapun.</p>

<p>Dibuat di: ____________, tanggal ${esc(today)}</p>

<div class="signatures">
  <div class="sig">
    <div class="sig-title">PIHAK PERTAMA</div>
    <div>(Pemberi Kuasa)</div>
    <div class="sig-line">${esc(senderName)}</div>
  </div>
  <div class="sig">
    <div class="sig-title">PIHAK KEDUA</div>
    <div>(Penerima Kuasa)</div>
    <div class="sig-line">${esc(agent)}</div>
  </div>
</div>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

/** Custom smooth-scroll dalam container dengan easeOutQuint — terasa lebih
 *  "premium" dibanding native `scrollTo({behavior:"smooth"})` yang
 *  inkonsisten antar browser. */
function smoothScrollWithin(
  container: HTMLElement,
  targetTop: number,
  duration: number,
) {
  const start = container.scrollTop;
  const distance = targetTop - start;
  if (Math.abs(distance) < 2) return;
  const startTime = performance.now();
  const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    container.scrollTop = start + distance * easeOutQuint(progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function formatDeadline(remainingMs: number): {
  text: string;
  tone: "good" | "warn" | "danger" | "over";
} {
  if (remainingMs <= 0) {
    const overdueMs = -remainingMs;
    const h = Math.floor(overdueMs / 3_600_000);
    if (h >= 24)
      return { text: `Telat ${Math.floor(h / 24)} hari`, tone: "over" };
    if (h >= 1) return { text: `Telat ${h} jam`, tone: "over" };
    return { text: "Baru saja telat", tone: "over" };
  }
  const totalMin = Math.floor(remainingMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const tone: "good" | "warn" | "danger" =
    h >= 12 ? "good" : h >= 3 ? "warn" : "danger";
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return { text: `${d} hari ${h % 24} jam lagi`, tone };
  }
  if (h > 0) return { text: `${h} jam ${m} menit lagi`, tone };
  return { text: `${m} menit lagi`, tone };
}

export function ClaimedTitipModal({
  data,
  onClose,
}: {
  data: ClaimedTitip | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { data: session } = useSession();
  const agentFullName = useMemo(
    () =>
      (
        (session?.user as { name?: string | null } | undefined)?.name ?? ""
      ).trim(),
    [session],
  );
  const agentFirstName = useMemo(
    () => firstName(agentFullName),
    [agentFullName],
  );
  const senderFirstName = useMemo(
    () => firstName(data?.pengirim_nama),
    [data?.pengirim_nama],
  );
  const meta = data
    ? JENIS_META[data.jenis_properti] || JENIS_META.RUMAH
    : JENIS_META.RUMAH;
  const waUrl = useMemo(
    () =>
      data
        ? waLinkFromPhone(data.pengirim_phone, meta.label, data.alamat_lengkap, {
            agentName: agentFullName,
            senderName: firstName(data.pengirim_nama),
          })
        : "#",
    [data, meta.label, agentFullName],
  );

  const [progress, setProgress] = useState<PlaybookProgress>({
    startedAt: {},
    completedAt: {},
    checks: {},
  });
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  // Step yang baru saja di-unlock — buat dramatic entry animation.
  const [unlockingStepId, setUnlockingStepId] = useState<string | null>(null);
  // Token untuk trigger pulse highlight di kartu aktif. Bertambah tiap
  // kali modal dibuka untuk lead yang sudah lewati step 1.
  const [scrollHighlightToken, setScrollHighlightToken] = useState(0);
  // Tick state — re-render per menit supaya countdown deadline tetap up-to-date.
  const [, setTick] = useState(0);

  // Refs untuk smooth scroll ke kartu aktif saat re-open panduan.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // Dashboard scroll-container hidup di [layout.tsx](src/app/dashboard/layout.tsx)
  // (div overflow-y-auto), BUKAN di body. Jadi `body.style.overflow="hidden"`
  // tidak diperlukan — kalau dipakai dan ada race antar-modal yang sama-sama
  // manipulate body.style, hasilnya body bisa nyangkut "hidden" dan bikin
  // freeze. Kita andalkan `overscroll-contain` di scroll container modal
  // supaya scroll modal tidak chain ke dashboard.

  // Load progress + auto-start tahap aktif (deadline mulai dihitung dari sini).
  // Kalau user buka panduan untuk lead yang sudah lewati step 1, smooth-scroll
  // ke kartu aktif + trigger pulse highlight (signal "lanjut di sini").
  useEffect(() => {
    if (!data) return;
    let prog = loadProgress(data.id_titip);
    for (const step of PLAYBOOK) {
      if (!prog.completedAt[step.id]) {
        if (!prog.startedAt[step.id]) {
          prog = {
            ...prog,
            startedAt: { ...prog.startedAt, [step.id]: Date.now() },
          };
          saveProgress(data.id_titip, prog);
        }
        break;
      }
    }
    setProgress(prog);
    setJustCompleted(null);

    // Hitung step aktif dari progress yang baru di-load (sync, sebelum
    // setState ke-commit). Hanya scroll kalau idx > 0 (step 1 sudah selesai).
    let loadedIdx = PLAYBOOK.length;
    for (let i = 0; i < PLAYBOOK.length; i++) {
      if (!prog.completedAt[PLAYBOOK[i]!.id]) {
        loadedIdx = i;
        break;
      }
    }
    if (loadedIdx <= 0 || loadedIdx >= PLAYBOOK.length) return;

    // Tunggu render + entry animation kartu (~350ms), baru smooth-scroll.
    const scrollTimer = window.setTimeout(() => {
      const container = scrollContainerRef.current;
      const card = activeCardRef.current;
      if (!container || !card) return;
      smoothScrollWithin(container, card.offsetTop - 8, 720);
      // Trigger pulse highlight begitu scroll mulai — sampai user
      // benar-benar liat kartunya pulse-glow saat sampai.
      window.setTimeout(() => {
        setScrollHighlightToken((t) => t + 1);
      }, 380);
    }, 360);
    return () => window.clearTimeout(scrollTimer);
  }, [data?.id_titip]);

  // Countdown ticker per menit.
  useEffect(() => {
    if (!data) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => window.clearInterval(t);
  }, [data?.id_titip]);

  const currentStepIdx = useMemo(() => {
    for (let i = 0; i < PLAYBOOK.length; i++) {
      if (!progress.completedAt[PLAYBOOK[i]!.id]) return i;
    }
    return PLAYBOOK.length;
  }, [progress.completedAt]);

  const allDone = currentStepIdx >= PLAYBOOK.length;

  const handleToggleCheck = useCallback(
    (stepId: string, idx: number) => {
      if (!data) return;
      setProgress((p) => {
        const key = `${stepId}:${idx}`;
        const next: PlaybookProgress = {
          ...p,
          checks: { ...p.checks, [key]: !p.checks[key] },
        };
        saveProgress(data.id_titip, next);
        return next;
      });
    },
    [data],
  );

  // Tandai banyak item sekaligus tanpa toggle (selalu set true).
  // Dipakai saat agent tekan tombol WA — auto-centangin grup "WhatsApp pertama".
  const handleBulkCheck = useCallback(
    (stepId: string, indices: number[]) => {
      if (!data || indices.length === 0) return;
      setProgress((p) => {
        const nextChecks = { ...p.checks };
        for (const idx of indices) {
          nextChecks[`${stepId}:${idx}`] = true;
        }
        const next: PlaybookProgress = { ...p, checks: nextChecks };
        saveProgress(data.id_titip, next);
        return next;
      });
    },
    [data],
  );

  const handleCompleteStep = useCallback(
    (stepId: string) => {
      if (!data) return;
      // Phase 1 — Celebration di kartu yang baru selesai (tahan ~1.6s
      // sebelum swap kartu, supaya user betul-betul rasakan momen achievement).
      setJustCompleted(stepId);

      window.setTimeout(() => {
        if (!data) return;
        // Phase 2 — Commit state. Kartu lama smoothly collapse jadi
        // CompletedStepCard, kartu berikutnya dramatic-enter.
        setProgress((p) => {
          const now = Date.now();
          const next: PlaybookProgress = {
            ...p,
            completedAt: { ...p.completedAt, [stepId]: now },
            startedAt: { ...p.startedAt },
          };
          const idx = PLAYBOOK.findIndex((s) => s.id === stepId);
          const nextStep = PLAYBOOK[idx + 1];
          if (nextStep) {
            if (!next.startedAt[nextStep.id]) {
              next.startedAt[nextStep.id] = now;
            }
            // Tandai next step sebagai baru di-unlock — di-detect di
            // ActiveStepCard buat trigger entry animation premium.
            setUnlockingStepId(nextStep.id);
          }
          saveProgress(data.id_titip, next);
          return next;
        });
        setJustCompleted(null);
      }, 1600);

      // Phase 3 — Setelah unlock animation selesai (~2.4s setelah commit),
      // clear flag supaya kartu kembali ke state idle yang normal.
      window.setTimeout(() => setUnlockingStepId(null), 4200);
    },
    [data],
  );

  const handleGenerateMou = useCallback(() => {
    if (!data) return;
    openMouDocument(data, agentFullName);
  }, [data, agentFullName]);

  const handleCopyPhone = useCallback(async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`+62${data.pengirim_phone}`);
      setPhoneCopied(true);
      window.setTimeout(() => setPhoneCopied(false), 1600);
    } catch {
      // Clipboard API tidak tersedia — biarkan saja, user bisa long-press manual
    }
  }, [data]);

  // Simple early return — bukan AnimatePresence — supaya saat data null,
  // backdrop benar-benar lepas dari DOM seketika (tidak ada exit-window di
  // mana backdrop masih capture pointer events).
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <Sparks />
      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 36 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 24,
          mass: 0.7,
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[92vh] rounded-[28px] p-[1px] bg-[linear-gradient(140deg,rgba(110,231,183,0.7)_0%,rgba(45,212,191,0.25)_30%,rgba(255,255,255,0.05)_55%,rgba(45,212,191,0.25)_82%,rgba(110,231,183,0.6)_100%)] shadow-[0_50px_140px_rgba(0,0,0,0.8)]"
      >
            <div className="relative flex max-h-[calc(92vh-2px)] flex-col rounded-[27px] bg-gradient-to-br from-[#0B0F17] via-[#070A11] to-[#0B0F17] overflow-hidden">
              {/* Aurora glows */}
              <motion.div
                aria-hidden
                animate={reduce ? undefined : { opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute -top-24 -left-12 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"
              />
              <motion.div
                aria-hidden
                animate={reduce ? undefined : { opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-teal-400/15 blur-3xl"
              />

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="absolute top-4 right-4 z-20 h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all"
              >
                <Icon icon="solar:close-circle-bold" className="text-white/55 text-lg" />
              </button>

              {/* ── SINGLE SCROLL BODY ──────────────────────────
                   Satu container scrollable — hero + lead info + playbook
                   semua dalam satu flow. Di HP, active step bisa di-scroll
                   ke atas tanpa nested scroll yang nyesakin. */}
              <div
                ref={scrollContainerRef}
                className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
              >
                {/* HERO (compact di mobile) */}
                <div className="relative px-4 sm:px-7 pt-5 sm:pt-7 pb-3 sm:pb-5">
                  <div className="flex items-center gap-3 sm:gap-4 pr-10">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.08, type: "spring", stiffness: 220, damping: 16 }}
                      className="relative shrink-0 h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-300/30 to-teal-500/10 border border-emerald-400/45 flex items-center justify-center shadow-[0_0_36px_rgba(52,211,153,0.35)]"
                    >
                      <Icon icon="solar:check-circle-bold-duotone" className="text-emerald-300 text-xl sm:text-2xl" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">
                          <Icon icon="solar:bolt-bold-duotone" className="text-[11px]" />
                          Terklaim
                        </span>
                      </div>
                      <h3 className="mt-1 text-white font-black text-[17px] sm:text-[20px] tracking-tight leading-tight">
                        Lead jadi milik Anda
                      </h3>
                      <p className="hidden sm:block text-[12px] text-white/50 leading-snug">
                        Sekarang giliran Anda buktikan — ikuti playbook di bawah.
                      </p>
                    </div>
                  </div>
                </div>

                {/* LEAD INFO CARD (compact di mobile) */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14, duration: 0.32 }}
                  className="relative mx-4 sm:mx-7 mb-3 rounded-xl sm:rounded-2xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.07)_0%,rgba(255,255,255,0.02)_60%,transparent_100%)] p-3 sm:p-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Pengirim */}
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
                        <Icon icon="solar:user-bold-duotone" className="text-emerald-300 text-[14px] sm:text-[15px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] sm:text-[9.5px] font-bold tracking-[0.18em] uppercase text-white/40">
                          Pengirim
                        </div>
                        <div className="text-[12.5px] sm:text-[13px] font-bold text-white truncate leading-snug">
                          {data.pengirim_nama}
                        </div>
                      </div>
                    </div>

                    {/* Phone + copy */}
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
                        <Icon icon="ic:baseline-whatsapp" className="text-emerald-300 text-[14px] sm:text-[15px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] sm:text-[9.5px] font-bold tracking-[0.18em] uppercase text-white/40">
                          No. WhatsApp
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] sm:text-[13px] font-bold text-white tabular-nums truncate">
                            +62{data.pengirim_phone}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyPhone}
                            aria-label="Salin nomor"
                            className="relative h-5 w-5 shrink-0 rounded-md border border-white/10 hover:border-emerald-400/40 bg-white/[0.03] hover:bg-emerald-400/[0.08] flex items-center justify-center transition"
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {phoneCopied ? (
                                <motion.span
                                  key="ok"
                                  initial={{ scale: 0.4, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                >
                                  <Icon
                                    icon="solar:check-read-bold"
                                    className="text-emerald-300 text-[11px]"
                                  />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="copy"
                                  initial={{ scale: 0.4, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                >
                                  <Icon
                                    icon="solar:copy-bold"
                                    className="text-white/55 text-[10px]"
                                  />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Properti — spans full on sm+ */}
                    <div className="flex items-start gap-2.5 sm:col-span-2">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
                        <Icon icon={meta.icon} className="text-emerald-300 text-[14px] sm:text-[15px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] sm:text-[9.5px] font-bold tracking-[0.18em] uppercase text-white/40">
                          {meta.label}
                        </div>
                        <div className="text-[12.5px] sm:text-[13px] font-bold text-white leading-snug">
                          {data.alamat_lengkap}
                        </div>
                        {data.estimasi_harga && (
                          <div className="mt-0.5 sm:mt-1 text-[12.5px] sm:text-[13px] font-black tabular-nums text-emerald-300 tracking-tight">
                            {formatRupiahFull(data.estimasi_harga)}
                            <span className="ml-1.5 text-[9px] sm:text-[9.5px] font-bold tracking-[0.18em] uppercase text-white/35">
                              estimasi
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* PLAYBOOK HEADER */}
                <div className="relative px-4 sm:px-7 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-400/35 to-emerald-400/10" />
                    <div className="inline-flex items-center gap-1.5">
                      <Icon
                        icon="solar:medal-ribbons-star-bold-duotone"
                        className="text-emerald-300 text-[14px]"
                      />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] bg-gradient-to-r from-emerald-200 to-teal-200 bg-clip-text text-transparent">
                        Playbook Coach
                      </span>
                    </div>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-400/35 to-emerald-400/10" />
                  </div>
                  <p className="mt-2 text-center text-[11px] sm:text-[11.5px] text-white/50 leading-snug">
                    Fokus satu tahap dulu. Tahap berikutnya unlock setelah
                    tahap ini selesai.
                  </p>
                </div>

                {/* STEP CARDS */}
                <div className="relative px-4 sm:px-7 pt-3 pb-6 space-y-2.5">
                  {PLAYBOOK.map((step, idx) => {
                    if (idx < currentStepIdx) {
                      return (
                        <CompletedStepCard
                          key={step.id}
                          step={step}
                          index={idx}
                          completedAt={progress.completedAt[step.id] ?? 0}
                        />
                      );
                    }
                    if (idx === currentStepIdx) {
                      return (
                        <div ref={activeCardRef} key={step.id}>
                          <ActiveStepCard
                            step={step}
                            index={idx}
                            startedAt={
                              progress.startedAt[step.id] ?? Date.now()
                            }
                            checks={progress.checks}
                            onToggleCheck={handleToggleCheck}
                            onBulkCheck={handleBulkCheck}
                            onComplete={handleCompleteStep}
                            onGenerateMou={handleGenerateMou}
                            waUrl={waUrl}
                            uploadUrl="/dashboard/listings"
                            reduce={!!reduce}
                            justCompleted={justCompleted === step.id}
                            wasJustUnlocked={unlockingStepId === step.id}
                            scrollHighlightToken={scrollHighlightToken}
                            agentFirstName={agentFirstName}
                            agentFullName={agentFullName}
                            senderFirstName={senderFirstName}
                          />
                        </div>
                      );
                    }
                    return (
                      <LockedStepCard
                        key={step.id}
                        step={step}
                        index={idx}
                        unlocksAfter={PLAYBOOK[idx - 1]!.title}
                      />
                    );
                  })}
                  {allDone && <PlaybookDoneCard />}
                </div>
              </div>
            </div>
          </motion.div>
    </motion.div>
  );
}


/* ─────────────── Active step (current tahap) ─────────────── */

function ActiveStepCard({
  step,
  index,
  startedAt,
  checks,
  onToggleCheck,
  onBulkCheck,
  onComplete,
  onGenerateMou,
  waUrl,
  uploadUrl,
  reduce,
  justCompleted,
  wasJustUnlocked,
  scrollHighlightToken,
  agentFirstName,
  agentFullName,
  senderFirstName,
}: {
  step: PlaybookStep;
  index: number;
  startedAt: number;
  checks: Record<string, boolean>;
  onToggleCheck: (stepId: string, idx: number) => void;
  onBulkCheck: (stepId: string, indices: number[]) => void;
  onComplete: (stepId: string) => void;
  onGenerateMou: () => void;
  waUrl: string;
  uploadUrl: string;
  reduce: boolean;
  justCompleted: boolean;
  wasJustUnlocked: boolean;
  /** Bertambah tiap kali parent mau trigger pulse highlight di kartu ini
   *  (mis. setelah smooth-scroll selesai). */
  scrollHighlightToken: number;
  agentFirstName: string;
  agentFullName: string;
  senderFirstName: string;
}) {
  const deadline = startedAt + step.deadlineHours * 3_600_000;
  const dl = formatDeadline(deadline - Date.now());

  // Flatten grouped checklist → global indices yang stabil. Setiap item
  // dapet 1 global index linear (gabungan semua grup) yang dipakai sebagai
  // key di progress.checks.
  const groupedItems = useMemo(() => {
    let idx = 0;
    return step.checklist.map((group) => ({
      label: group.label,
      icon: group.icon,
      note: group.note,
      items: group.items.map((it) => ({
        text: it.text,
        copyMessage: it.copyMessage,
        generateMou: it.generateMou,
        globalIdx: idx++,
      })),
    }));
  }, [step.checklist]);

  // Show generate MOU button kalau ada item dengan generateMou=true DAN
  // item itu satu-satunya yang belum dicentang di seluruh step. Artinya
  // agent udah ngerjain semua persiapan, sekarang tinggal TTD MOU.
  const showMouGenerator = useMemo(() => {
    const allItems = groupedItems.flatMap((g) => g.items);
    const mouItem = allItems.find((it) => it.generateMou);
    if (!mouItem) return false;
    const mouChecked = !!checks[`${step.id}:${mouItem.globalIdx}`];
    if (mouChecked) return false;
    const hasOtherUnchecked = allItems.some(
      (it) =>
        !it.generateMou && !checks[`${step.id}:${it.globalIdx}`],
    );
    return !hasOtherUnchecked;
  }, [groupedItems, checks, step.id]);

  // State copy feedback — track item mana yang baru di-copy supaya
  // bisa ditampilin "Tersalin" sebentar.
  const [copiedItemIdx, setCopiedItemIdx] = useState<number | null>(null);
  const handleCopyMessage = useCallback(
    async (globalIdx: number, template: string) => {
      const message = template
        .replace(/\{agentName\}/g, agentFullName || agentFirstName || "agent")
        .replace(/\{senderName\}/g, senderFirstName || "Bapak/Ibu");
      try {
        await navigator.clipboard.writeText(message);
        setCopiedItemIdx(globalIdx);
        window.setTimeout(() => setCopiedItemIdx(null), 1800);
      } catch {
        // Clipboard API tidak tersedia — agent tetap bisa baca pesan via DevTools
      }
    },
    [agentFullName, agentFirstName, senderFirstName],
  );
  const total = groupedItems.reduce((acc, g) => acc + g.items.length, 0);
  const checkedCount = groupedItems.reduce(
    (acc, g) =>
      acc + g.items.filter((it) => checks[`${step.id}:${it.globalIdx}`]).length,
    0,
  );
  const pct = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  const toneStyles = {
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-300/35 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/40 bg-rose-400/12 text-rose-200",
    over: "border-rose-500/55 bg-rose-500/15 text-rose-100",
  }[dl.tone];

  const ctaHref =
    step.cta?.kind === "whatsapp"
      ? waUrl
      : step.cta?.kind === "upload"
        ? uploadUrl
        : "#";

  // Coach line text + jam (di-set sekali saat mount supaya stabil).
  const coachMessage = useMemo(
    () => formatCoachLine(step.coachLine, agentFirstName, senderFirstName),
    [step.coachLine, agentFirstName, senderFirstName],
  );
  const bubbleTime = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, []);

  // Animasi bubble chat: hidden → typing (indicator 3 dots) → shown.
  // Trigger pertama kali bubble scroll ke viewport (atau langsung kalau di-view).
  const bubbleAnchorRef = useRef<HTMLDivElement>(null);
  const [bubblePhase, setBubblePhase] = useState<
    "hidden" | "typing" | "shown"
  >(reduce ? "shown" : "hidden");

  useEffect(() => {
    if (reduce || bubblePhase !== "hidden") return;
    const el = bubbleAnchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setBubblePhase("typing");
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [bubblePhase, reduce]);

  useEffect(() => {
    if (bubblePhase !== "typing") return;
    // Durasi typing: scale dengan panjang pesan, antara 1.3–2.5 detik.
    const duration = Math.min(2500, Math.max(1300, coachMessage.length * 13));
    const t = window.setTimeout(() => setBubblePhase("shown"), duration);
    return () => window.clearTimeout(t);
  }, [bubblePhase, coachMessage]);

  // Entry animation — kalau baru di-unlock, pakai animasi dramatic
  // (scale + blur-to-clear + spring) supaya kerasa premium reveal.
  const entryAnim = reduce
    ? { initial: undefined, animate: { opacity: 1 }, transition: { duration: 0 } }
    : wasJustUnlocked
      ? {
          initial: {
            opacity: 0,
            scale: 0.88,
            y: 40,
            filter: "blur(10px)" as const,
          },
          animate: {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: "blur(0px)" as const,
          },
          transition: {
            duration: 0.85,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.32,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        };

  return (
    <motion.div
      layout
      initial={entryAnim.initial}
      animate={entryAnim.animate}
      transition={entryAnim.transition}
      className="relative overflow-hidden rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(110,231,183,0.7)_0%,rgba(45,212,191,0.2)_45%,rgba(255,255,255,0.05)_60%,rgba(45,212,191,0.25)_82%,rgba(110,231,183,0.65)_100%)] shadow-[0_18px_44px_-18px_rgba(52,211,153,0.65)]"
    >
      <div className="relative rounded-[15px] bg-[linear-gradient(180deg,#0A1116_0%,#070A0E_100%)] overflow-hidden">
        {!reduce && (
          <motion.div
            aria-hidden
            initial={{ x: "-130%" }}
            animate={{ x: "180%" }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute -inset-y-2 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/[0.12] to-transparent skew-x-12"
          />
        )}

        {/* Header: icon + title + deadline chip */}
        <div className="relative flex items-start gap-3 px-4 pt-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-teal-500/10 blur-[8px]" />
            <div className="relative grid h-12 w-12 place-items-center rounded-xl border border-emerald-400/40 bg-emerald-500/[0.10]">
              <Icon
                icon={step.icon}
                className="text-emerald-200 text-[22px] drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]"
              />
            </div>
            <span className="absolute -top-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[#05070D] text-[10px] font-black tabular-nums ring-2 ring-[#0A1116]">
              {index + 1}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                Tahap aktif
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[9.5px] font-bold tabular-nums ${toneStyles}`}
              >
                <Icon
                  icon={
                    dl.tone === "over"
                      ? "solar:danger-triangle-bold-duotone"
                      : "solar:clock-circle-bold-duotone"
                  }
                  className="text-[11px]"
                />
                {dl.text}
              </span>
            </div>
            <h4 className="mt-1 text-white font-black text-[15.5px] leading-tight tracking-tight">
              {step.title}
            </h4>
            <p className="text-[11.5px] text-white/55 leading-snug">
              {step.subtitle}
            </p>
          </div>
        </div>

        {/* Coach chat bubble — WhatsApp style.
            Avatar top-left sejajar dengan tail bubble. Coach label dipindah
            ke DALAM bubble (mirip nama sender di WA group chat) supaya
            avatar dan tail benar-benar nyambung secara visual. */}
        <div
          ref={bubbleAnchorRef}
          className="relative mx-4 mt-3.5 flex items-start gap-2"
        >
          {/* Avatar Coach — user yang ngomong (mentor) */}
          <div className="relative shrink-0">
            <div className="relative grid h-8 w-8 place-items-center rounded-full border border-emerald-400/45 bg-emerald-400/[0.08] shadow-[0_2px_10px_-4px_rgba(52,211,153,0.55)]">
              <Icon
                icon="solar:user-speak-rounded-bold-duotone"
                className="text-emerald-300 text-[18px]"
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-400 ring-2 ring-[#0A1116]">
              <span className="h-1 w-1 rounded-full bg-emerald-50" />
            </span>
          </div>

          {/* Bubble area */}
          <div className="relative min-w-0 flex-1">

            <AnimatePresence mode="wait" initial={false}>
              {bubblePhase === "typing" && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  className="relative inline-flex items-center gap-1.5 rounded-[14px] rounded-tl-[4px] bg-[#1F2C34] px-3.5 py-2.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)]"
                >
                  {/* WA-style tail */}
                  <svg
                    aria-hidden
                    className="absolute -left-[5px] top-0 text-[#1F2C34]"
                    width="9"
                    height="12"
                    viewBox="0 0 9 12"
                    fill="currentColor"
                  >
                    <path d="M9 0 L9 12 Q 4 5 0 0 Z" />
                  </svg>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{
                        y: [0, -3, 0],
                        opacity: [0.35, 1, 0.35],
                      }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.16,
                        ease: "easeInOut",
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-[#8696A0]"
                    />
                  ))}
                </motion.div>
              )}

              {bubblePhase === "shown" && (
                <motion.div
                  key="bubble"
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 26,
                    mass: 0.6,
                  }}
                  className="relative rounded-[14px] rounded-tl-[4px] bg-[#1F2C34] px-3 py-1.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)]"
                >
                  {/* WA-style tail */}
                  <svg
                    aria-hidden
                    className="absolute -left-[5px] top-0 text-[#1F2C34]"
                    width="9"
                    height="12"
                    viewBox="0 0 9 12"
                    fill="currentColor"
                  >
                    <path d="M9 0 L9 12 Q 4 5 0 0 Z" />
                  </svg>
                  {/* Sender name di dalam bubble (mirip WA group chat) */}
                  <div className="text-[11.5px] font-bold text-emerald-300 leading-tight">
                    Coach
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#E9EDEF] whitespace-pre-line">
                    {coachMessage}
                  </p>
                  <div className="mt-0.5 -mb-0.5 flex items-center justify-end gap-0.5 text-[9.5px] tabular-nums text-[#8696A0]">
                    <span>{bubbleTime}</span>
                    <Icon
                      icon="solar:check-read-bold"
                      className="text-[#53BDEB] text-[13px] ml-0.5"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Insight (warning kuning seperti perhatian) */}
        <div className="relative mx-4 mt-3 rounded-lg border border-amber-300/25 bg-amber-400/[0.06] px-3 py-2">
          <div className="flex gap-2">
            <Icon
              icon="solar:lightbulb-bold-duotone"
              className="text-amber-300 text-[15px] shrink-0 mt-[1px] drop-shadow-[0_0_6px_rgba(252,211,77,0.45)]"
            />
            <p className="text-[11.5px] leading-relaxed text-amber-100/85">
              {step.insight}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mx-4 mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
            />
          </div>
          <span className="text-[10px] font-extrabold tabular-nums text-white/60 shrink-0">
            {checkedCount}/{total}
          </span>
        </div>

        {/* Interactive checklist (grouped) */}
        <div className="relative px-3 pt-3 space-y-3">
          {groupedItems.map((group, gIdx) => (
            <div key={gIdx}>
              {/* Group header */}
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <Icon
                  icon={group.icon}
                  className="text-emerald-300/85 text-[12px]"
                />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/85">
                  {group.label}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-emerald-400/25 to-transparent ml-0.5" />
              </div>
              {/* Group note (warning untuk grup tertentu) */}
              {group.note && (
                <p className="px-2 mb-1 text-[10.5px] italic text-amber-200/75 leading-snug">
                  <Icon
                    icon="solar:info-circle-bold"
                    className="inline text-[11px] mr-1 -mt-[1px] text-amber-300/85"
                  />
                  {group.note}
                </p>
              )}
              {/* Group items */}
              <ul className="space-y-0.5">
                {group.items.map((it) => {
                  const checked = !!checks[`${step.id}:${it.globalIdx}`];
                  const isCopied = copiedItemIdx === it.globalIdx;
                  return (
                    <li key={it.globalIdx}>
                      <div
                        className={`group flex items-start gap-1.5 rounded-lg pl-2 pr-1.5 py-1.5 transition-colors ${
                          checked
                            ? "bg-emerald-400/[0.06]"
                            : "hover:bg-white/[0.025]"
                        }`}
                      >
                        {/* Toggle area (kotak + teks) */}
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCheck(step.id, it.globalIdx)
                          }
                          className="flex flex-1 items-start gap-2.5 text-left min-w-0"
                        >
                          <span
                            className={`mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-colors ${
                              checked
                                ? "border-emerald-400 bg-emerald-400"
                                : "border-white/20 bg-white/[0.03] group-hover:border-emerald-400/50"
                            }`}
                          >
                            {checked && (
                              <svg
                                aria-hidden
                                viewBox="0 0 16 16"
                                width="13"
                                height="13"
                                fill="none"
                                stroke="#05070D"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3.2 8.4 L6.6 11.8 L12.8 5.2" />
                              </svg>
                            )}
                          </span>
                          <span
                            className={`text-[12px] leading-snug ${
                              checked
                                ? "text-white/45 line-through decoration-emerald-300/40"
                                : "text-white/80"
                            }`}
                          >
                            {it.text}
                          </span>
                        </button>

                        {/* Tombol Salin pesan — hanya item yang punya copyMessage */}
                        {it.copyMessage && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyMessage(
                                it.globalIdx,
                                it.copyMessage!,
                              )
                            }
                            aria-label="Salin template pesan"
                            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[9.5px] font-bold tabular-nums transition-all active:scale-[0.95] ${
                              isCopied
                                ? "border-emerald-400/60 bg-emerald-400/[0.18] text-emerald-100"
                                : "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200 hover:bg-emerald-400/[0.16] hover:border-emerald-400/55"
                            }`}
                          >
                            <Icon
                              icon={
                                isCopied
                                  ? "solar:check-read-bold"
                                  : "solar:copy-bold-duotone"
                              }
                              className="text-[11px]"
                            />
                            <span>{isCopied ? "Tersalin" : "Salin pesan"}</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* ── GENERATE MOU CARD — muncul saat tinggal item TTD MOU yang belum dicentang */}
        <AnimatePresence>
          {showMouGenerator && (
            <motion.div
              key="mou-gen"
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
              }}
              className="relative mx-3 mt-3 rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(110,231,183,0.65)_0%,rgba(45,212,191,0.25)_50%,rgba(110,231,183,0.6)_100%)] shadow-[0_12px_36px_-14px_rgba(52,211,153,0.7)]"
            >
              <div className="relative overflow-hidden rounded-[15px] bg-[linear-gradient(180deg,#0B1418_0%,#070A0D_100%)]">
                {/* Sheen */}
                {!reduce && (
                  <motion.div
                    aria-hidden
                    initial={{ x: "-130%" }}
                    animate={{ x: "180%" }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "linear",
                      repeatDelay: 0.4,
                    }}
                    className="pointer-events-none absolute -inset-y-2 w-1/4 bg-gradient-to-r from-transparent via-emerald-300/[0.14] to-transparent skew-x-12"
                  />
                )}
                {/* Aurora dot */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-8 -left-6 h-28 w-32 rounded-full bg-emerald-400/15 blur-2xl"
                />

                {/* Header */}
                <div className="relative flex items-center gap-3 px-3.5 pt-3 pb-2.5">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-emerald-400/35 to-teal-500/10 blur-[6px]" />
                    <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/45 bg-emerald-500/[0.10]">
                      <Icon
                        icon="solar:document-add-bold-duotone"
                        className="text-emerald-200 text-[20px] drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      </span>
                      Siap TTD
                    </div>
                    <div className="mt-0.5 text-[13.5px] font-black text-white tracking-tight leading-tight">
                      Generate MOU Pemasaran
                    </div>
                    <div className="text-[11px] text-white/55 leading-snug">
                      Auto-fill data agent, client &amp; properti — siap cetak / save PDF
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <div className="relative px-3.5 pb-3.5">
                  <button
                    type="button"
                    onClick={onGenerateMou}
                    className="relative w-full inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 px-4 py-2.5 text-[12.5px] font-extrabold tracking-wide text-[#05070D] shadow-[0_8px_22px_-8px_rgba(52,211,153,0.7),inset_0_1px_0_rgba(255,255,255,0.45)] hover:shadow-[0_14px_36px_-8px_rgba(52,211,153,1)] active:scale-[0.97] transition-all"
                  >
                    {!reduce && (
                      <motion.span
                        aria-hidden
                        initial={{ x: "-150%" }}
                        animate={{ x: "180%" }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                          repeatDelay: 0.6,
                        }}
                        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent skew-x-12"
                      />
                    )}
                    <Icon
                      icon="solar:magic-stick-3-bold-duotone"
                      className="relative text-[16px]"
                    />
                    <span className="relative">
                      Buat Dokumen MOU Sekarang
                    </span>
                    <Icon
                      icon="solar:arrow-right-bold"
                      className="relative text-[13px]"
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer: CTA + Tandai Selesai */}
        <div className="relative px-4 pt-3 pb-4 mt-3 border-t border-white/[0.05] bg-white/[0.012] space-y-2">
          {step.cta && (
            <a
              href={ctaHref}
              target={step.cta.kind === "whatsapp" ? "_blank" : undefined}
              rel={
                step.cta.kind === "whatsapp"
                  ? "noopener noreferrer"
                  : undefined
              }
              onClick={() => {
                // Saat agent buka WhatsApp lewat tombol ini, kita asumsikan
                // dia commit melakukan grup pertama (intro + sapa + tawarin
                // call) — jadi auto-centang. Item discovery di grup berikutnya
                // tetap manual, harus di-centang setelah call beneran terjadi.
                if (step.cta?.kind === "whatsapp" && groupedItems[0]) {
                  const indices = groupedItems[0].items.map(
                    (it) => it.globalIdx,
                  );
                  onBulkCheck(step.id, indices);
                }
              }}
              className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 px-5 py-2.5 text-[12.5px] font-extrabold tracking-wide text-[#05070D] shadow-[0_8px_22px_-8px_rgba(52,211,153,0.7),inset_0_1px_0_rgba(255,255,255,0.45)] transition-all hover:shadow-[0_14px_36px_-8px_rgba(52,211,153,1)] active:scale-[0.98]"
            >
              {!reduce && (
                <motion.span
                  aria-hidden
                  initial={{ x: "-150%" }}
                  animate={{ x: "180%" }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1,
                  }}
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent skew-x-12"
                />
              )}
              <Icon
                icon={
                  step.cta.kind === "whatsapp"
                    ? "ic:baseline-whatsapp"
                    : "solar:upload-square-bold-duotone"
                }
                className="relative text-[15px]"
              />
              <span className="relative">{step.cta.label}</span>
              <Icon
                icon="solar:arrow-right-bold"
                className="relative text-[13px]"
              />
            </a>
          )}

          <button
            type="button"
            onClick={() => onComplete(step.id)}
            disabled={checkedCount < total || justCompleted}
            className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[11.5px] font-extrabold tracking-wide transition-all ${
              justCompleted
                ? "border-emerald-400/60 bg-emerald-400/[0.20] text-emerald-100"
                : checkedCount < total
                  ? "border-white/8 bg-white/[0.02] text-white/30 cursor-not-allowed"
                  : "border-emerald-400/45 bg-emerald-400/[0.12] text-emerald-100 hover:bg-emerald-400/[0.20]"
            }`}
          >
            <Icon
              icon={
                justCompleted
                  ? "line-md:loading-loop"
                  : checkedCount === total
                    ? "solar:verified-check-bold-duotone"
                    : "solar:lock-keyhole-minimalistic-bold-duotone"
              }
              className="text-[14px]"
            />
            <span>
              {justCompleted
                ? "Tahap diselesaikan…"
                : checkedCount === total
                  ? "Tandai tahap selesai → buka tahap berikutnya"
                  : `Selesaikan semua dulu (${checkedCount}/${total})`}
            </span>
          </button>
        </div>

        {/* ── CELEBRATION overlay (Phase 1: setelah tombol "Tandai selesai")
            Glow burst ring + checkmark scale-up + sparkles + label. */}
        <AnimatePresence>
          {justCompleted && (
            <motion.div
              key="celebration"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-emerald-500/[0.18] backdrop-blur-[3px] overflow-hidden"
            >
              {/* Expanding ring */}
              <motion.div
                aria-hidden
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute h-24 w-24 rounded-full border-2 border-emerald-300/70"
              />
              <motion.div
                aria-hidden
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 5.5, opacity: 0 }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.15 }}
                className="absolute h-24 w-24 rounded-full border border-emerald-300/50"
              />

              {/* Burst particles */}
              {Array.from({ length: 14 }).map((_, i) => {
                const angle = (i / 14) * Math.PI * 2;
                const r = 110 + (i % 3) * 18;
                return (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                    animate={{
                      x: Math.cos(angle) * r,
                      y: Math.sin(angle) * r,
                      opacity: 0,
                      scale: 0.2,
                    }}
                    transition={{
                      duration: 0.9 + (i % 4) * 0.1,
                      ease: "easeOut",
                      delay: 0.18,
                    }}
                    className="absolute h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                  />
                );
              })}

              {/* Central checkmark */}
              <motion.div
                initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 18,
                  delay: 0.1,
                }}
                className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 text-[#05070D] shadow-[0_0_50px_rgba(52,211,153,0.95)]"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 32 32"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="#05070D"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M7 16 L13 22 L25 10"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                      delay: 0.32,
                    }}
                  />
                </svg>
              </motion.div>

              {/* Label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.35 }}
                className="absolute bottom-[28%] text-center"
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-emerald-200/85">
                  Tahap {index + 1} selesai
                </div>
                <div className="mt-0.5 text-[13px] font-black text-emerald-100">
                  Mantap, lanjut tahap berikutnya
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── UNLOCK overlay (Phase 2: kartu baru di-unlock dari step
            sebelumnya). Lock icon scale up → break apart + particle burst
            keluar dari tengah, lalu fade reveal card content. */}
        <AnimatePresence>
          {wasJustUnlocked && (
            <motion.div
              key="unlock"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
              className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-hidden"
            >
              {/* Aurora burst dari pusat */}
              <motion.div
                aria-hidden
                initial={{ scale: 0, opacity: 0.7 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute h-32 w-32 rounded-full bg-emerald-400/30 blur-2xl"
              />

              {/* Lock yang kebuka */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                animate={{
                  scale: [0.6, 1.25, 1.5, 1.7],
                  opacity: [0, 1, 1, 0],
                  rotate: [-8, 0, 8, 22],
                  y: [0, -4, -12, -28],
                }}
                transition={{
                  duration: 1.2,
                  ease: "easeOut",
                  times: [0, 0.25, 0.55, 1],
                }}
                className="relative"
              >
                <Icon
                  icon="solar:lock-keyhole-minimalistic-unlocked-bold-duotone"
                  className="text-emerald-300 text-[56px] drop-shadow-[0_0_24px_rgba(52,211,153,0.85)]"
                />
              </motion.div>

              {/* Particle burst keluar dari pusat */}
              {Array.from({ length: 18 }).map((_, i) => {
                const angle = (i / 18) * Math.PI * 2;
                const r = 140 + (i % 4) * 22;
                return (
                  <motion.span
                    key={i}
                    aria-hidden
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                    animate={{
                      x: Math.cos(angle) * r,
                      y: Math.sin(angle) * r,
                      opacity: 0,
                      scale: 0.1,
                    }}
                    transition={{
                      duration: 1 + (i % 5) * 0.12,
                      ease: "easeOut",
                      delay: 0.25,
                    }}
                    className="absolute h-1.5 w-1.5 rounded-full bg-emerald-200 shadow-[0_0_12px_rgba(167,243,208,0.95)]"
                  />
                );
              })}

              {/* Label "Tahap Terbuka" */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: [0, 1, 1, 0], y: [16, 0, 0, -6] }}
                transition={{
                  duration: 1.4,
                  times: [0, 0.2, 0.7, 1],
                  delay: 0.35,
                }}
                className="absolute bottom-[24%] text-center"
              >
                <div className="text-[9.5px] font-extrabold uppercase tracking-[0.28em] text-emerald-200/85">
                  Tahap {index + 1} terbuka
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SCROLL HIGHLIGHT — pulse ring di sekeliling kartu setelah
            auto-scroll, sebagai signal "lanjut di sini". Re-trigger setiap
            kali `scrollHighlightToken` berubah. */}
        {scrollHighlightToken > 0 && (
          <motion.div
            key={`pulse-${scrollHighlightToken}`}
            aria-hidden
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{
              opacity: [0, 0.85, 0.6, 0],
              scale: [1.02, 1.05, 1.06, 1.06],
            }}
            transition={{
              duration: 1.8,
              times: [0, 0.18, 0.55, 1],
              ease: "easeOut",
            }}
            className="pointer-events-none absolute -inset-[3px] rounded-[18px] border-2 border-emerald-300 shadow-[0_0_38px_rgba(52,211,153,0.65),inset_0_0_24px_rgba(52,211,153,0.35)] z-30"
          />
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────── Completed step (sebelumnya) ─────────────── */

function CompletedStepCard({
  step,
  index,
  completedAt,
}: {
  step: PlaybookStep;
  index: number;
  completedAt: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="relative flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.025] px-3.5 py-2.5"
    >
      <div className="relative shrink-0">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-500/[0.10]">
          <Icon
            icon="solar:check-circle-bold-duotone"
            className="text-emerald-300 text-[17px]"
          />
        </div>
        <span className="absolute -top-1.5 -left-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-400/85 text-[#05070D] text-[8.5px] font-black tabular-nums ring-2 ring-[#0B0F17]">
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-emerald-300/85">
            Selesai
          </span>
          <span className="text-white/15">·</span>
          <span className="text-[9.5px] font-bold text-white/45 tabular-nums">
            {completedAt > 0 ? formatRelativeTime(completedAt) : "—"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] font-bold text-white/75 line-through decoration-emerald-300/30">
          {step.title}
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────── Locked step (belum unlock) ─────────────── */

function LockedStepCard({
  step,
  index,
  unlocksAfter,
}: {
  step: PlaybookStep;
  index: number;
  unlocksAfter: string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="relative flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] px-3.5 py-2.5"
    >
      <div className="relative shrink-0">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.02]">
          <Icon icon={step.icon} className="text-white/25 text-[17px]" />
        </div>
        <span className="absolute -top-1.5 -left-1.5 grid h-4 w-4 place-items-center rounded-full bg-white/[0.08] text-white/40 text-[8.5px] font-black tabular-nums ring-2 ring-[#0B0F17]">
          {index + 1}
        </span>
        <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-white/15 bg-[#0B0F17]">
          <Icon
            icon="solar:lock-keyhole-minimalistic-bold"
            className="text-white/45 text-[9px]"
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-white/30">
          Terkunci
        </span>
        <p className="mt-0.5 truncate text-[12px] font-bold text-white/40">
          {step.title}
        </p>
        <p className="text-[10.5px] text-white/35 italic leading-snug">
          Akan terbuka setelah “{unlocksAfter}” selesai.
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────── Done celebration (semua tahap selesai) ─────────────── */

function PlaybookDoneCard() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(110,231,183,0.7)_0%,rgba(45,212,191,0.25)_50%,rgba(110,231,183,0.65)_100%)]"
    >
      <div className="relative rounded-[15px] bg-[linear-gradient(180deg,#0A1418_0%,#070A0D_100%)] px-4 py-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-400/15 shadow-[0_0_36px_rgba(52,211,153,0.5)]">
          <Icon
            icon="solar:cup-star-bold-duotone"
            className="text-emerald-200 text-[28px]"
          />
        </div>
        <h4 className="mt-3 text-white font-black text-[15px] tracking-tight">
          Playbook selesai — mantap!
        </h4>
        <p className="mt-1 text-[11.5px] text-white/55 leading-snug">
          Listing sudah live. Sekarang fokus monitoring &amp; nurture: respon
          cepat tiap inquiry, update mingguan ke client.
        </p>
      </div>
    </motion.div>
  );
}

function Sparks() {
  const dots = Array.from({ length: 14 }).map((_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {dots.map((i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const r = 220 + (i % 3) * 30;
        const dx = Math.cos(angle) * r;
        const dy = Math.sin(angle) * r;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1 }}
            transition={{ duration: 1.2 + (i % 4) * 0.15, ease: "easeOut" }}
            className="absolute h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.85)]"
          />
        );
      })}
    </div>
  );
}
