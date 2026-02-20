"use client";

import React, { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import Signin from "@/components/Auth/SignIn";

type AppSessionUser = {
  id?: string;
  role?: "USER" | "AGENT";
  agentId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  nomor_telepon?: string | null;
};

type Step = 0 | 1 | 2;

export type PrefillAgentLite = {
  id_agent: string;
  status_keanggotaan: string;
  nama_kantor: string | null;
  kota_area: string | null;
  nomor_whatsapp: string | null;
  link_instagram: string | null;
  link_facebook: string | null;
  link_tiktok: string | null;
  id_upline: string | null;
  foto_ktp_url?: string | null;
  foto_npwp_url?: string | null;
  foto_profil_url?: string | null;
};

type PrefillResponse = {
  ok: boolean;
  pengguna?: {
    id_pengguna?: string;
    nama_lengkap?: string | null;
    email?: string | null;
    nomor_telepon?: string | null;
  } | null;
  agent?: PrefillAgentLite | null;
  alreadyApplied?: boolean;
  message?: string;
};

type CityItem = { id: string; name: string; province?: string };

type DraftData = {
  nama: string;
  email: string;
  noTelp: string;
  namaKantor: string;
  kotaArea: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  refCode: string;
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function normalizePhoneDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits;
}

function normalizeAgentCode(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return `AG${s.replace(/^0+/, "") || "0"}`;
  const m = s.toUpperCase().match(/^AG\s*0*(\d+)$/);
  if (m) return `AG${m[1]}`;
  return s.toUpperCase();
}

function normalizeSocialSlug(raw: string) {
  let v = (raw || "").trim();
  if (!v) return "";

  v = v.replace(/^https?:\/\//i, "");
  v = v.replace(/^www\./i, "");
  v = v.replace(/\/+$/g, "");

  const parts = v.split("/");
  if (parts.length > 1) v = parts[parts.length - 1];

  v = v.split("?")[0].split("#")[0];
  v = v.replace(/^@+/, "");
  v = v.replace(/\s+/g, "");
  return v;
}

/* ---------------- Image compression (client-side) ---------------- */

async function readImageFromFile(file: File): Promise<HTMLImageElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("File bukan gambar yang valid"));
  });

  return img;
}

type CompressOptions = {
  maxWidth: number;
  quality: number; // 0..1
  mimeType?: "image/jpeg" | "image/webp";
  maxSizeMB?: number; // target max size
};

async function compressImage(file: File, opts: CompressOptions): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await readImageFromFile(file);

  const scale = Math.min(1, opts.maxWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const mimeType = opts.mimeType ?? "image/jpeg";

  let quality = opts.quality;
  let blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mimeType, quality)
  );
  if (!blob) return file;

  if (opts.maxSizeMB) {
    const maxBytes = opts.maxSizeMB * 1024 * 1024;
    let guard = 0;

    while (blob.size > maxBytes && quality > 0.6 && guard < 7) {
      quality = Math.max(0.6, quality - 0.06);
      blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), mimeType, quality)
      );
      if (!blob) break;
      guard++;
    }
  }

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const newName = `${baseName}.compressed.${ext}`;

  return new File([blob], newName, { type: mimeType });
}

/* ---------------- Draft helpers ---------------- */

function draftKey(userId?: string) {
  return userId ? `agent_apply_draft:${userId}` : `agent_apply_draft:guest`;
}

function safeParseDraft(raw: string | null): DraftData | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return {
      nama: String(obj.nama ?? ""),
      email: String(obj.email ?? ""),
      noTelp: String(obj.noTelp ?? ""),
      namaKantor: String(obj.namaKantor ?? ""),
      kotaArea: String(obj.kotaArea ?? ""),
      instagram: String(obj.instagram ?? ""),
      facebook: String(obj.facebook ?? ""),
      tiktok: String(obj.tiktok ?? ""),
      refCode: String(obj.refCode ?? ""),
    };
  } catch {
    return null;
  }
}

/* ---------------- Status helpers ---------------- */

type AgentStatus = "NONE" | "PENDING" | "AKTIF" | "SUSPEND";

function toAgentStatus(raw: any): AgentStatus {
  const s = String(raw || "").toUpperCase().trim();
  if (s === "PENDING" || s === "AKTIF" || s === "SUSPEND") return s;
  return "NONE";
}

/* ---------------- Component ---------------- */

export default function AgentApplyForm({
  formRef,
  isAuthed,
  isAlreadyAgent,
  user,
  loginOpen,
  setLoginOpen,
  onPrefillStateChange,
}: {
  formRef: React.RefObject<HTMLDivElement | null>;
  isAuthed: boolean;
  isAlreadyAgent: boolean;
  user?: AppSessionUser;
  loginOpen: boolean;
  setLoginOpen: (v: boolean) => void;
  onPrefillStateChange?: (s: {
    prefillLoading: boolean;
    existingAgent: PrefillAgentLite | null;
  }) => void;
}) {
  // Form states
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [noTelp, setNoTelp] = useState(""); // digits tanpa +62

  const [namaKantor, setNamaKantor] = useState("");
  const [kotaArea, setKotaArea] = useState("");

  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");

  const instagramUrl = useMemo(
    () =>
      instagram
        ? `https://www.instagram.com/${normalizeSocialSlug(instagram)}`
        : "",
    [instagram]
  );
  const facebookUrl = useMemo(
    () =>
      facebook
        ? `https://www.facebook.com/${normalizeSocialSlug(facebook)}`
        : "",
    [facebook]
  );
  const tiktokUrl = useMemo(
    () =>
      tiktok
        ? `https://www.tiktok.com/@${normalizeSocialSlug(tiktok)}`
        : "",
    [tiktok]
  );

  const [refCode, setRefCode] = useState("");

  // lock flags: berdasarkan data akun
  const [lockFromAccount, setLockFromAccount] = useState({
    nama: false,
    email: false,
    phone: false,
  });
  const [lockKantorFromReferral, setLockKantorFromReferral] = useState(false);

  // Upline lookup state
  const [uplineLoading, setUplineLoading] = useState(false);
  const [uplineError, setUplineError] = useState<string | null>(null);
  const [uplineInfo, setUplineInfo] = useState<null | {
    id_agent: string;
    id_pengguna: string;
    nama_lengkap: string;
    nama_kantor?: string | null;
    kota_area?: string | null;
  }>(null);

  // Files
  const [fotoKtp, setFotoKtp] = useState<File | null>(null);
  const [fotoNpwp, setFotoNpwp] = useState<File | null>(null);
  const [fotoProfil, setFotoProfil] = useState<File | null>(null);

  // Wizard
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ world-class receipt after submit (instead of plain "success string")
  const [receipt, setReceipt] = useState<null | {
    status: AgentStatus; // mostly PENDING
    message: string;
    submittedAt: number;
  }>(null);

  // Prefill from backend
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [existingAgent, setExistingAgent] =
    useState<PrefillResponse["agent"]>(null);

  // expose to page (untuk HERO status card)
  React.useEffect(() => {
    onPrefillStateChange?.({
      prefillLoading,
      existingAgent: existingAgent ?? null,
    });
  }, [prefillLoading, existingAgent, onPrefillStateChange]);

  const agentStatus: AgentStatus = useMemo(
    () => toAgentStatus(existingAgent?.status_keanggotaan),
    [existingAgent?.status_keanggotaan]
  );

  // ✅ truth from DB > session:
  // - kalau DB bilang AKTIF -> memang agent
  // - kalau DB bilang PENDING -> bukan agent tapi pending
  // - kalau DB bilang SUSPEND -> treat sebagai USER (boleh apply ulang)
  const isAgentActive = agentStatus === "AKTIF";
  const isAgentPending = agentStatus === "PENDING";
  const isAgentSuspend = agentStatus === "SUSPEND";

  // Kalau session bilang AGENT tapi DB bilang SUSPEND → jangan blok form
  const effectiveAlreadyAgent = isAgentActive || (isAlreadyAgent && !isAgentSuspend);

  // ✅ lock form hanya kalau:
  // - belum login
  // - lagi submit
  // - sudah agent aktif
  // - atau pending (menunggu verifikasi)
  // - atau baru submit (receipt pending)
  const pendingFromReceipt = receipt?.status === "PENDING";
  const isFormLocked =
    !isAuthed || submitting || effectiveAlreadyAgent || isAgentPending || pendingFromReceipt;

  // UI state:
  // - show status card kalau pending (DB atau receipt)
  const showPendingScreen = isAgentPending || pendingFromReceipt;
  const showActiveScreen = isAgentActive || effectiveAlreadyAgent;
  const showSuspendBanner = isAgentSuspend && !showPendingScreen && !showActiveScreen;

  // progress (tetap dipakai wizard)
  const progress = step === 0 ? 33 : step === 1 ? 66 : 100;

  /* ---------------- Prefill priority rules ----------------
   * 1) Prefill dari backend (pengguna+agent) -> paling dipercaya.
   * 2) Prefill dari session (name/email/phone) -> fallback.
   * 3) Draft localStorage -> fallback, buat UX "ga hilang" sebelum submit.
   --------------------------------------------------------- */

  // (A) Prefill dari backend (utama)
  React.useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;

    (async () => {
      setPrefillLoading(true);
      try {
        const res = await fetch("/api/agent/daftar-agent/prefill", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await res.json().catch(() => ({}))) as PrefillResponse;
        if (!res.ok || !data?.ok) return;
        if (cancelled) return;

        const pengguna = data.pengguna ?? null;
        const agent = data.agent ?? null;

        // pengguna
        if (pengguna) {
          const pNama = String(pengguna.nama_lengkap ?? "").trim();
          const pEmail = String(pengguna.email ?? "").trim();
          const pPhone = String(pengguna.nomor_telepon ?? "").trim();

          setNama((v) => v || pNama);
          setEmail((v) => v || pEmail);
          if (pPhone) setNoTelp((v) => v || normalizePhoneDigits(pPhone));
        }

        // agent (kalau pernah submit)
        if (agent) {
          setExistingAgent(agent);

          // isi form dari DB (prefill) - tetap oke untuk SUSPEND (buat re-apply)
          setNamaKantor((v) => v || String(agent.nama_kantor ?? ""));
          setKotaArea((v) => v || String(agent.kota_area ?? ""));

          if (agent.nomor_whatsapp) {
            setNoTelp((v) => v || normalizePhoneDigits(agent.nomor_whatsapp));
          }

          setInstagram((v) =>
            v || (agent.link_instagram ? normalizeSocialSlug(agent.link_instagram) : "")
          );
          setFacebook((v) =>
            v || (agent.link_facebook ? normalizeSocialSlug(agent.link_facebook) : "")
          );
          setTiktok((v) =>
            v || (agent.link_tiktok ? normalizeSocialSlug(agent.link_tiktok) : "")
          );

          const st = toAgentStatus(agent.status_keanggotaan);

          // ✅ kalau PENDING: tampil pending screen dan kunci
          if (st === "PENDING") {
            setReceipt((r) =>
              r ??
              ({
                status: "PENDING",
                message:
                  "Pendaftaran kamu sudah kami terima. Tim kami sedang memverifikasi data kamu.",
                submittedAt: Date.now(),
              } as const)
            );
            setStep(2);
          }

          // ✅ kalau SUSPEND: jangan lock, jangan force step 2
          if (st === "SUSPEND") {
            setReceipt(null);
            setError(null);
            setStep(0);
          }

          // ✅ kalau AKTIF: biarkan UI showActiveScreen yang handle
          if (st === "AKTIF") {
            setReceipt(null);
            setError(null);
            setStep(2);
          }
        }
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  // (B) Prefill dari session (fallback)
  React.useEffect(() => {
    if (!isAuthed) return;

    const accountNama = (user?.name ?? "").trim();
    const accountEmail = (user?.email ?? "").trim();
    const phoneDigits = normalizePhoneDigits(user?.phone ?? user?.nomor_telepon ?? "");

    setNama((prev) => prev || accountNama);
    setEmail((prev) => prev || accountEmail);
    setNoTelp((prev) => prev || phoneDigits);

    setLockFromAccount({
      nama: Boolean(accountNama),
      email: Boolean(accountEmail),
      phone: Boolean(phoneDigits),
    });
  }, [isAuthed, user?.name, user?.email, user?.phone, user?.nomor_telepon]);

  // (C) Draft localStorage (fallback, biar ga hilang) — hanya kalau tidak pending
  React.useEffect(() => {
    if (!isAuthed) return;
    if (showPendingScreen) return;
    const key = draftKey(user?.id);
    const draft = safeParseDraft(
      typeof window !== "undefined" ? localStorage.getItem(key) : null
    );
    if (!draft) return;

    setNama((p) => p || draft.nama);
    setEmail((p) => p || draft.email);
    setNoTelp((p) => p || draft.noTelp);
    setNamaKantor((p) => p || draft.namaKantor);
    setKotaArea((p) => p || draft.kotaArea);
    setInstagram((p) => p || draft.instagram);
    setFacebook((p) => p || draft.facebook);
    setTiktok((p) => p || draft.tiktok);
    setRefCode((p) => p || draft.refCode);
  }, [isAuthed, user?.id, showPendingScreen]);

  // Autosave draft (skip kalau pending / sedang terkunci)
  React.useEffect(() => {
    if (!isAuthed) return;
    if (showPendingScreen) return;
    if (isFormLocked) return;

    const key = draftKey(user?.id);
    const draft: DraftData = {
      nama,
      email,
      noTelp,
      namaKantor,
      kotaArea,
      instagram,
      facebook,
      tiktok,
      refCode,
    };
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    isAuthed,
    user?.id,
    showPendingScreen,
    isFormLocked,
    nama,
    email,
    noTelp,
    namaKantor,
    kotaArea,
    instagram,
    facebook,
    tiktok,
    refCode,
  ]);

  function validateStep(s: Step): string | null {
    if (!isAuthed) return "Silakan login dulu untuk melanjutkan.";
    if (effectiveAlreadyAgent) return "Akun kamu sudah terdaftar sebagai Agent.";
    if (showPendingScreen) return "Pendaftaran kamu sudah terkirim. Mohon tunggu verifikasi.";

    if (s === 0) {
      if (!nama.trim()) return "Nama wajib ada.";
      if (!noTelp.trim()) return "No. WhatsApp wajib ada.";
      if (!email.trim()) return "Email wajib ada.";
      if (!namaKantor.trim()) return "Nama kantor/tim wajib diisi.";
      if (!kotaArea.trim()) return "Kota/area wajib dipilih.";

      if (noTelp.trim().length < 9) return "No. WhatsApp terlalu pendek.";
      if (noTelp.trim().length > 13) return "No. WhatsApp terlalu panjang.";
    }

    if (s === 2) {
      if (!fotoKtp) return "Foto KTP wajib diupload.";
      if (!fotoProfil) return "Foto profil wajib diupload.";
    }

    return null;
  }

  function jumpTo(target: Step) {
    setError(null);
    if (target === step) return;
    if (target > step) {
      const msg = validateStep(step);
      if (msg) return setError(msg);
    }
    setStep(target);
  }

  function next() {
    setError(null);
    const msg = validateStep(step);
    if (msg) return setError(msg);
    setStep((p) => (p < 2 ? ((p + 1) as Step) : p));
  }

  function back() {
    setError(null);
    setStep((p) => (p > 0 ? ((p - 1) as Step) : p));
  }

  // Referral lookup (debounced)
  const lookupReferral = useMemo(
    () =>
      debounce(async (raw: string) => {
        if (isFormLocked) return;

        const code = normalizeAgentCode(raw);
        setUplineError(null);
        setUplineInfo(null);

        if (!code) {
          setLockKantorFromReferral(false);
          return;
        }

        setUplineLoading(true);
        try {
          const res = await fetch(
            `/api/agent/referral?code=${encodeURIComponent(code)}`,
            { method: "GET", cache: "no-store" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(
              data?.message || "Kode referral tidak valid / tidak ditemukan."
            );

          const info = {
            id_agent: data.id_agent ?? "",
            id_pengguna: data.id_pengguna ?? "",
            nama_lengkap: data.nama_lengkap ?? "Agent",
            nama_kantor: data.nama_kantor ?? null,
            kota_area: data.kota_area ?? null,
          };

          if (!info.id_agent) throw new Error("Data upline tidak lengkap.");

          setUplineInfo(info);

          // REQUIREMENT: nama kantor harus ikut upline
          if (info.nama_kantor) {
            setNamaKantor(info.nama_kantor);
            setLockKantorFromReferral(true);
          } else {
            setLockKantorFromReferral(false);
          }
        } catch (e: any) {
          setUplineError(e?.message || "Gagal memeriksa referral.");
          setLockKantorFromReferral(false);
        } finally {
          setUplineLoading(false);
        }
      }, 350),
    [isFormLocked]
  );

  async function onSubmit() {
    setError(null);

    const msg = validateStep(0) ?? validateStep(2);
    if (msg) return setError(msg);

    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("id_pengguna", user?.id || "");
      fd.append("nama_lengkap", nama.trim());
      fd.append("nomor_whatsapp", `+62${noTelp.trim()}`);
      fd.append("email", email.trim());
      fd.append("nama_kantor", namaKantor.trim());
      fd.append("kota_area", kotaArea.trim());

      const igSlug = normalizeSocialSlug(instagram);
      const fbSlug = normalizeSocialSlug(facebook);
      const ttSlug = normalizeSocialSlug(tiktok);

      if (igSlug) fd.append("link_instagram", `https://www.instagram.com/${igSlug}`);
      if (fbSlug) fd.append("link_facebook", `https://www.facebook.com/${fbSlug}`);
      if (ttSlug) fd.append("link_tiktok", `https://www.tiktok.com/@${ttSlug}`);

      const normalizedRef = normalizeAgentCode(refCode);
      if (normalizedRef) fd.append("kode_referral_upline", normalizedRef);

      fd.append("foto_ktp", fotoKtp!);
      if (fotoNpwp) fd.append("foto_npwp", fotoNpwp);
      fd.append("foto_profil", fotoProfil!);

      const res = await fetch("/api/agent/daftar-agent", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) throw new Error(data?.message || "Gagal mengirim pendaftaran.");

      // ✅ tampilkan world-class status screen (pending) + lock
      setReceipt({
        status: "PENDING",
        message:
          data?.message ||
          "Pendaftaran kamu sudah kami terima. Tim kami sedang memverifikasi data kamu.",
        submittedAt: Date.now(),
      });

      // bersihkan draft
      try {
        localStorage.removeItem(draftKey(user?.id));
      } catch {}

      // refresh prefill (biar existingAgent kebaca DB saat reload)
      try {
        const r2 = await fetch("/api/agent/daftar-agent/prefill", { method: "GET", cache: "no-store" });
        const d2 = (await r2.json().catch(() => ({}))) as PrefillResponse;
        if (r2.ok && d2?.ok && d2.agent) setExistingAgent(d2.agent);
      } catch {}

      setStep(2);
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = useMemo(() => {
    if (showPendingScreen) return "Terkirim ✓";
    if (submitting) return "Mengirim…";
    return "Kirim Pendaftaran";
  }, [showPendingScreen, submitting]);

  const submitHint = useMemo(() => {
    if (!isAuthed) return "Login diperlukan untuk mengirim pendaftaran.";
    if (effectiveAlreadyAgent) return "Akun sudah berstatus Agent.";
    if (showPendingScreen) return "Pendaftaran sudah terkirim. Mohon tunggu verifikasi admin.";
    if (isAgentSuspend) return "Akun kamu sedang tidak aktif lagi — kamu bisa ajukan ulang pendaftaran di bawah.";
    return "Pastikan data & foto sudah benar sebelum mengirim.";
  }, [effectiveAlreadyAgent, isAuthed, isAgentSuspend, showPendingScreen]);

  return (
    <>
      <div ref={formRef} className="scroll-mt-24 md:scroll-mt-28">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">

          {/* ✅ ACTIVE AGENT SCREEN */}
    {/* ✅ VERIFICATION SCREEN (replace ACTIVE screen UI) */}
    {showActiveScreen ? (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        {/* Animated background blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl animate-[float_7s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl animate-[float_9s_ease-in-out_infinite]" />

        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
        <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </span>
        Sedang menunggu verifikasi
        </div>

    {/* Header */}
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="text-lg md:text-xl font-semibold text-white">
          Pendaftaran Agent kamu sudah terkirim ✅
        </div>
        <div className="mt-1 text-sm text-white/70 max-w-[62ch]">
          Tim kami sedang mengecek data & dokumen kamu. Setelah disetujui, akun kamu akan otomatis berubah menjadi Agent.
        </div>

        {/* IDs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1">
            ID Pengguna: <span className="font-mono text-white/90">{user?.id || "-"}</span>
          </span>
          <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1">
            ID Agent:{" "}
            <span className="font-mono text-white/90">
              {user?.agentId || existingAgent?.id_agent || "-"}
            </span>
          </span>
          <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-1">
            Status:{" "}
            <span className="font-semibold text-white/90">
              {existingAgent?.status_keanggotaan || "PENDING"}
            </span>
          </span>
        </div>
      </div>

      {/* Right status card */}
      <div className="shrink-0 rounded-3xl border border-white/10 bg-black/20 p-4 md:w-[280px]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">Proses</div>
          <div className="text-xs text-white/60">VERIFIKASI</div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            {/* Spinner */}
            <div className="relative h-10 w-10 rounded-2xl border border-white/10 bg-black/30 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/90">Memeriksa dokumen</div>

              {/* Shimmer progress */}
              <div className="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-2 w-1/2 rounded-full bg-white/40 animate-[shimmer_1.2s_linear_infinite]" />
              </div>

              <div className="mt-2 text-[11px] text-white/55">
                Jangan kirim ulang — sistem hanya menerima 1x untuk keamanan.
              </div>
            </div>
          </div>
        </div>

        {/* Estimated time hint */}
        <div className="mt-3 text-xs text-white/60">
          Estimasi: <span className="text-white/85">1–24 jam</span> (tergantung antrean admin)
        </div>
      </div>
    </div>



    {/* keyframes */}
    <style jsx>{`
      @keyframes shimmer {
        0% {
          transform: translateX(-60%);
          opacity: 0.5;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform: translateX(160%);
          opacity: 0.6;
        }
      }
      @keyframes float {
        0%,
        100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(14px);
        }
      }
    `}</style>
  </div>
) : null}


          {/* ✅ NOT AUTH */}
          {!isAuthed && !showActiveScreen ? (
            <div className="mb-5 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
              <div className="text-sm font-medium text-yellow-100">Kamu belum login</div>
              <div className="mt-1 text-sm text-yellow-100/80">Login dulu supaya data akun terisi otomatis.</div>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="mt-3 rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300"
              >
                Login
              </button>
            </div>
          ) : null}

          {/* ✅ SUSPEND BANNER (boleh apply ulang) */}
          {showSuspendBanner ? (
            <div className="mb-5 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-10 w-10 rounded-2xl border border-white/10 bg-black/20 flex items-center justify-center">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="text-2xl text-amber-200" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-100">Keanggotaan kamu sedang tidak aktif lagi</div>
                  <div className="mt-1 text-sm text-amber-100/80">
                    Kamu bisa ajukan ulang pendaftaran di bawah. Pastikan data & dokumen terbaru.
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    ID Agent sebelumnya: <span className="font-mono text-white">{existingAgent?.id_agent || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ✅ WORLD-CLASS PENDING SCREEN */}
          {showPendingScreen && !showActiveScreen ? (
            <PendingScreen
              userId={user?.id}
              agentId={existingAgent?.id_agent ?? user?.agentId}
              message={receipt?.message}
            />
          ) : null}

          {/* wizard header only if form visible */}
          {!showActiveScreen && !showPendingScreen ? (
            <div className="mb-6">
              <WizardHeader step={step} onJump={jumpTo} progress={progress} />
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {/* FORM - only if not active and not pending */}
          {!showActiveScreen && !showPendingScreen ? (
            <div className={!isAuthed ? "relative" : ""}>
              {!isAuthed ? (
                <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-black/45 backdrop-blur-[2px]" />
              ) : null}

              {step === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nama" required hint={lockFromAccount.nama ? "Terkunci dari akun." : "Isi sesuai identitas akun."}>
                    <input
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      disabled={lockFromAccount.nama || isFormLocked}
                      className={inputClass}
                      placeholder="Nama lengkap"
                    />
                  </Field>

                  <Field
                    label="No. WhatsApp"
                    required
                    hint={
                      lockFromAccount.phone
                        ? "Terkunci karena sudah tersimpan di akun."
                        : "Masukkan tanpa 0 (karena sudah +62). Contoh: 812xxxx."
                    }
                  >
                    <div className="flex">
                      <div className="flex items-center rounded-l-2xl border border-white/10 bg-white/5 px-4 text-sm text-white/70">
                        +62
                      </div>
                      <input
                        value={noTelp}
                        onChange={(e) => setNoTelp(normalizePhoneDigits(e.target.value))}
                        disabled={lockFromAccount.phone || isFormLocked}
                        className={`${inputClass} rounded-l-none border-l-0`}
                        placeholder="81234567890"
                        inputMode="numeric"
                        autoComplete="tel-national"
                      />
                    </div>
                  </Field>

                  <Field label="Email" required hint={lockFromAccount.email ? "Terkunci dari akun." : "Gunakan email aktif."}>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={lockFromAccount.email || isFormLocked}
                      className={inputClass}
                      placeholder="nama@email.com"
                      type="email"
                    />
                  </Field>

                  <Field label="Kode Referal (Upline)">
                    <input
                      value={refCode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRefCode(v);
                        setUplineError(null);
                        setUplineInfo(null);
                        lookupReferral(v);
                      }}
                      disabled={isFormLocked}
                      className={inputClass}
                      placeholder="Masukan Kode Referalmu!"
                    />

                    <div className="mt-2">
                      {uplineLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                          Mengecek upline...
                        </div>
                      ) : null}

                      {uplineError ? (
                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-100">
                          {uplineError}
                        </div>
                      ) : null}

                      {uplineInfo ? (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                          <div className="text-xs text-emerald-100/80">Upline terdeteksi (AKTIF)</div>
                          <div className="mt-1 text-sm font-medium text-white">
                            {uplineInfo.nama_lengkap}{" "}
                            <span className="text-white/60">({uplineInfo.id_agent})</span>
                          </div>
                          <div className="mt-1 text-xs text-white/70">
                            {uplineInfo.nama_kantor ? (
                              <>
                                Kantor/Tim: <span className="text-white">{uplineInfo.nama_kantor}</span>
                              </>
                            ) : (
                              "Kantor/Tim: -"
                            )}
                            {uplineInfo.kota_area ? (
                              <>
                                {" "}
                                • Area: <span className="text-white">{uplineInfo.kota_area}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Field>

                  <Field
                    label="Nama Kantor / Tim"
                    required
                    hint={lockKantorFromReferral ? "Otomatis mengikuti kantor upline dari referral." : undefined}
                  >
                    <input
                      value={namaKantor}
                      onChange={(e) => setNamaKantor(e.target.value)}
                      disabled={lockKantorFromReferral || isFormLocked}
                      className={inputClass}
                      placeholder="Nama kantor/tim"
                    />
                  </Field>

                  <Field label="Kota / Area" required hint="Ketik untuk mencari (contoh: Sur...).">
                    <CitySelect value={kotaArea} onChange={(v) => setKotaArea(v)} disabled={!isAuthed || isFormLocked} />
                  </Field>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
                        <Icon icon="solar:shield-check-bold-duotone" className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">Sosial media</div>
                        <div className="mt-1 text-xs text-white/60">
                          Opsional (membantu verifikasi). Bisa isi username, @handle, atau link — sistem otomatis jadi URL.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <SocialInput
                      disabled={isFormLocked}
                      label="Instagram"
                      icon="skill-icons:instagram"
                      prefix="instagram.com/"
                      value={instagram}
                      onChange={setInstagram}
                      previewUrl={instagramUrl}
                      placeholder="namakamu"
                    />
                    <SocialInput
                      disabled={isFormLocked}
                      label="TikTok"
                      icon="logos:tiktok-icon"
                      prefix="tiktok.com/@"
                      value={tiktok}
                      onChange={setTiktok}
                      previewUrl={tiktokUrl}
                      placeholder="namakamu"
                    />
                    <div className="md:col-span-2">
                      <SocialInput
                        disabled={isFormLocked}
                        label="Facebook"
                        icon="logos:facebook"
                        prefix="facebook.com/"
                        value={facebook}
                        onChange={setFacebook}
                        previewUrl={facebookUrl}
                        placeholder="namakamu"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
                        <Icon icon="solar:gallery-check-bold-duotone" className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">Dokumen verifikasi</div>
                        <div className="mt-1 text-xs text-white/60">
                          File akan otomatis dikecilkan (tetap terbaca). Preview muncul setelah upload.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <UploadCard disabled={isFormLocked} label="Foto KTP" required file={fotoKtp} setFile={setFotoKtp} />
                    <UploadCard disabled={isFormLocked} label="Foto NPWP" file={fotoNpwp} setFile={setFotoNpwp} />
                    <UploadCard disabled={isFormLocked} label="Foto Profil" required file={fotoProfil} setFile={setFotoProfil} />
                  </div>
                </div>
              ) : null}

              {/* footer actions */}
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 0 || submitting}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 hover:bg-white/5 disabled:opacity-40"
                >
                  Kembali
                </button>

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthed) return setLoginOpen(true);
                      next();
                    }}
                    disabled={submitting}
                    className="rounded-2xl bg-emerald-400/90 px-5 py-3 text-sm font-medium text-black hover:bg-emerald-300 disabled:opacity-50"
                  >
                    Lanjut
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthed) return setLoginOpen(true);
                        onSubmit();
                      }}
                      disabled={submitting}
                      className={[
                        "rounded-2xl px-6 py-3 text-sm font-semibold transition select-none",
                        submitting
                          ? "bg-emerald-400/70 text-black cursor-wait"
                          : "bg-emerald-400/95 text-black hover:bg-emerald-300 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.85)]",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-2">
                        {submitting ? (
                          <Icon icon="line-md:loading-loop" className="text-lg" />
                        ) : (
                          <Icon icon="solar:paper-plane-bold-duotone" className="text-lg" />
                        )}
                        {submitLabel}
                      </span>
                    </button>

                    <div className="text-[11px] text-white/45 max-w-[360px] text-right">{submitHint}</div>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-white/45">
                Dengan mengirim, kamu menyetujui data digunakan untuk proses verifikasi.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loginOpen ? (
        <ModalShell onClose={() => setLoginOpen(false)}>
          <Signin closeModal={() => setLoginOpen(false)} />
        </ModalShell>
      ) : null}
    </>
  );
}

/* ---------------- PENDING SCREEN (world-class) ---------------- */

function PendingScreen({
  userId,
  agentId,
  message,
}: {
  userId?: string;
  agentId?: string | null;
  message?: string | null;
}) {
  return (
    <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <Icon icon="solar:check-circle-bold-duotone" className="text-xl" />
            Pendaftaran sudah terkirim
          </div>
          <div className="mt-2 text-sm text-emerald-100/80">
            {message ||
              "Pendaftaran kamu sudah kami terima. Tim kami sedang memverifikasi data kamu."}
          </div>

          <div className="mt-4 grid gap-2">
            <ProgressRow done label="Form terkirim" />
            <ProgressRow label="Verifikasi admin" />
            <ProgressRow label="Aktivasi akun Agent" />
          </div>

          <div className="mt-4 text-xs text-white/60">
            ID Pengguna:{" "}
            <span className="font-mono text-white">{userId || "-"}</span> • ID
            Agent:{" "}
            <span className="font-mono text-white">{agentId || "-"}</span>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/80">
          Status: <span className="text-white font-medium">PENDING</span>
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="/support"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Hubungi Admin
        </a>
        <a
          href="/profile"
          className="rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300"
        >
          Lihat Profil
        </a>
      </div>
    </div>
  );
}

function ProgressRow({ done, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div
        className={[
          "h-8 w-8 rounded-xl flex items-center justify-center border",
          done
            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
            : "border-white/10 bg-black/20 text-white/50",
        ].join(" ")}
      >
        <Icon icon={done ? "solar:check-circle-bold-duotone" : "solar:clock-circle-bold-duotone"} className="text-lg" />
      </div>
      <div className={done ? "text-sm text-white" : "text-sm text-white/70"}>
        {label}
      </div>
    </div>
  );
}

/* ---------------- Sosmed Input ---------------- */

function SocialInput({
  label,
  icon,
  prefix,
  value,
  onChange,
  previewUrl,
  placeholder,
  disabled,
}: {
  label: string;
  icon: string;
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  previewUrl?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const clean = useMemo(() => normalizeSocialSlug(value), [value]);

  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-black/20 p-4 transition",
        disabled ? "opacity-70" : "hover:bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
            <Icon icon={icon} className="text-xl" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-[11px] text-white/55">Opsional (membantu verifikasi)</div>
          </div>
        </div>

        {clean ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">
            siap
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/45">
            opsional
          </span>
        )}
      </div>

      <div className="flex">
        <div className="flex items-center rounded-l-2xl border border-white/10 bg-white/5 px-4 text-sm text-white/70 whitespace-nowrap">
          {prefix}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${inputClass} rounded-l-none border-l-0`}
          placeholder={placeholder || "username"}
          autoComplete="off"
          inputMode="text"
        />
      </div>

      <div className="mt-2 text-xs text-white/55">
        Preview:{" "}
        {previewUrl ? (
          <span className="text-white/85">{previewUrl}</span>
        ) : (
          <span className="text-white/35">—</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Kota Dropdown ---------------- */

function CitySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [q, setQ] = useState("");

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function ensureLoaded() {
    if (cities.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/regions/cities", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Gagal memuat kota.");
      setCities(data.cities || []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cities.slice(0, 80);

    const starts = cities.filter((c) => c.name.toLowerCase().startsWith(s));
    if (starts.length >= 80) return starts.slice(0, 80);

    const contains = cities.filter(
      (c) =>
        !c.name.toLowerCase().startsWith(s) &&
        c.name.toLowerCase().includes(s)
    );
    return [...starts, ...contains].slice(0, 80);
  }, [cities, q]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={async () => {
          if (disabled) return;
          setOpen((v) => !v);
          if (!open) await ensureLoaded();
        }}
        className={[
          inputClass,
          "flex items-center justify-between gap-3",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon icon="solar:buildings-2-bold-duotone" className="text-xl text-emerald-200 shrink-0" />
          <span className={["truncate", value ? "text-white" : "text-white/45"].join(" ")}>
            {value || "Pilih kota/kabupaten"}
          </span>
        </div>
        <Icon icon="solar:alt-arrow-down-linear" className={["text-white/60 transition", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-[#060b0a] shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-white/10 bg-black/20">
            <div className="relative">
              <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kota... (contoh: Sur)"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
            <div className="mt-2 text-[11px] text-white/45">
              {loading ? "Memuat daftar..." : `${cities.length.toLocaleString("id-ID")} kota/kabupaten`}
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-white/70">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Tidak ada hasil.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(c.name); // 🔥 hanya nama kota
                    setOpen(false);
                  }}
                  
                  className="w-full px-4 py-3 text-left text-sm text-white/85 hover:bg-white/[0.05] transition flex items-center gap-3 disabled:opacity-60"
                >
                  <Icon icon="solar:map-point-wave-bold-duotone" className="text-lg text-emerald-200" />
                  <span className="truncate">{c.name}</span>
                  {c.province ? <span className="ml-auto text-xs text-white/45 truncate">{c.province}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Tutup" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-black/60 p-5 shadow-2xl backdrop-blur">
        {children}
      </div>
    </div>
  );
}

function WizardHeader({ step, onJump, progress }: { step: Step; onJump: (s: Step) => void; progress: number }) {
  const items: Array<{ s: Step; t: string }> = [
    { s: 0, t: "Data" },
    { s: 1, t: "Sosmed" },
    { s: 2, t: "Dokumen" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>Langkah {step + 1} dari 3</span>
        <span>{progress}%</span>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-emerald-400/80 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {items.map((it) => {
          const active = it.s === step;
          const done = it.s < step;
          return (
            <button
              key={it.s}
              type="button"
              onClick={() => onJump(it.s)}
              className={[
                "rounded-2xl border px-3 py-3 text-left transition",
                active ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/[0.02] hover:bg-white/5",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <div
                  className={[
                    "h-8 w-8 rounded-xl flex items-center justify-center border text-sm font-semibold",
                    done || active ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-black/20 text-white/70",
                  ].join(" ")}
                >
                  {it.s + 1}
                </div>
                <div className="text-sm font-medium text-white">{it.t}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-medium text-white">{label}</span>
        {required ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">
            wajib
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </label>
  );
}

/* ---------------- UploadCard (preview + compress) ---------------- */

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string>("");
  React.useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function UploadCard({
  label,
  required,
  file,
  setFile,
  disabled,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  setFile: (f: File | null) => void;
  disabled?: boolean;
}) {
  const previewUrl = useObjectUrl(file);
  const isImage = Boolean(file?.type?.startsWith("image/"));
  const [compressing, setCompressing] = useState(false);
  const [compressInfo, setCompressInfo] = useState<string>("");

  const isDoc = /ktp|npwp/i.test(label);

  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-black/20 p-4 transition",
        disabled ? "opacity-70" : "hover:bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-white">{label}</div>
          {required ? (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">
              wajib
            </span>
          ) : null}
        </div>

        {compressing ? (
          <span className="text-[11px] text-white/60 flex items-center gap-2">
            <Icon icon="line-md:loading-loop" /> mengecilkan...
          </span>
        ) : compressInfo ? (
          <span className="text-[11px] text-white/45">{compressInfo}</span>
        ) : null}
      </div>

      {file && isImage && previewUrl ? (
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="relative aspect-[16/10] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <div className="min-w-0 truncate text-white/80">
              {file.name} <span className="text-white/45">• {formatBytes(file.size)}</span>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setFile(null);
                setCompressInfo("");
              }}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-white/75 hover:bg-white/10 disabled:opacity-60"
            >
              Hapus
            </button>
          </div>
        </div>
      ) : null}

      <label
        className={[
          "group flex items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-emerald-400/30 hover:bg-emerald-400/[0.06]",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="text-sm text-white/80">
            {file ? (
              <>
                <span className="text-white">{file.name}</span>{" "}
                <span className="text-white/45">• {formatBytes(file.size)}</span>
              </>
            ) : (
              "Klik untuk pilih file (JPG/PNG)"
            )}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {file ? "Klik untuk ganti file." : isDoc ? "Pastikan teks dokumen jelas (tidak blur)." : "Foto wajah jelas (pencahayaan cukup)."}
          </div>
        </div>

        <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 group-hover:border-emerald-400/20 group-hover:bg-emerald-400/10">
          {file ? "Ganti" : "Upload"}
        </span>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={async (e) => {
            if (disabled) return;

            const f = e.target.files?.[0] ?? null;
            if (!f) {
              setFile(null);
              return;
            }

            // supaya bisa upload file yang sama setelah dihapus
            e.currentTarget.value = "";

            try {
              setCompressing(true);
              setCompressInfo("");

              const before = f.size;

              // setting aman: dokumen max ~2MB, profil max ~600KB
              const compressed = await compressImage(f, {
                maxWidth: isDoc ? 2000 : 1024,
                quality: isDoc ? 0.86 : 0.82,
                mimeType: "image/jpeg",
                maxSizeMB: isDoc ? 2.0 : 0.6,
              });

              setFile(compressed);

              const after = compressed.size;
              if (after < before) {
                const savedPct = Math.round(((before - after) / before) * 100);
                setCompressInfo(`diperkecil ${savedPct}%`);
              } else {
                setCompressInfo("ukuran sudah optimal");
              }
            } catch {
              setFile(f);
              setCompressInfo("gagal kompres, pakai asli");
            } finally {
              setCompressing(false);
            }
          }}
        />
      </label>
    </div>
  );
}

/* ---------------- shared classes ---------------- */

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition " +
  "focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20 disabled:bg-white/[0.02] disabled:text-white/70";
