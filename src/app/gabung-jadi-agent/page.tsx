"use client";

import React, { useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Signin from "@/components/Auth/SignIn";
import { Icon } from "@iconify/react";

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

/** ✅ sosial: user boleh paste link / @handle / username -> kita ambil "slug" bersih */
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

    // turun quality perlahan (jaga keterbacaan)
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

/* ---------------- Types ---------------- */

type CityItem = { id: string; name: string; province?: string };

export default function GabungJadiAgentPage() {
  const { data: session, status } = useSession();
  const user = (session?.user as AppSessionUser | undefined) ?? undefined;

  const isLoading = status === "loading";
  const isAuthed = status === "authenticated";
  const isAlreadyAgent = user?.role === "AGENT" && Boolean(user?.agentId);

  const [loginOpen, setLoginOpen] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Form states
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [noTelp, setNoTelp] = useState(""); // digits tanpa +62

  const [namaKantor, setNamaKantor] = useState("");
  const [kotaArea, setKotaArea] = useState("");

  // ✅ Sosmed = simpan slug/username / link
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");

  // ✅ Sosmed URL preview (ngikutin input)
  const instagramUrl = useMemo(
    () => (instagram ? `https://www.instagram.com/${normalizeSocialSlug(instagram)}` : ""),
    [instagram]
  );
  const facebookUrl = useMemo(
    () => (facebook ? `https://www.facebook.com/${normalizeSocialSlug(facebook)}` : ""),
    [facebook]
  );
  const tiktokUrl = useMemo(
    () => (tiktok ? `https://www.tiktok.com/@${normalizeSocialSlug(tiktok)}` : ""),
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
  const [success, setSuccess] = useState<string | null>(null);

  // Prefill dari session + set lock
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

  const progress = step === 0 ? 33 : step === 1 ? 66 : 100;

  function goToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateStep(s: Step): string | null {
    if (!isAuthed) return "Silakan login dulu untuk melanjutkan.";
    if (isAlreadyAgent) return "Akun kamu sudah terdaftar sebagai Agent.";

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
        const code = normalizeAgentCode(raw);
        setUplineError(null);
        setUplineInfo(null);

        if (!code) {
          setLockKantorFromReferral(false);
          return;
        }

        setUplineLoading(true);
        try {
          const res = await fetch(`/api/agent/referral?code=${encodeURIComponent(code)}`, {
            method: "GET",
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || "Kode referral tidak valid / tidak ditemukan.");

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
    []
  );

  async function onSubmit() {
    setError(null);
    setSuccess(null);

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

      // ✅ Sosmed (opsional) — kirim slug + link
      const igSlug = normalizeSocialSlug(instagram);
      const fbSlug = normalizeSocialSlug(facebook);
      const ttSlug = normalizeSocialSlug(tiktok);

      if (igSlug) {
        fd.append("instagram_username", igSlug);
        fd.append("link_instagram", `https://www.instagram.com/${igSlug}`);
      }
      if (fbSlug) {
        fd.append("facebook", fbSlug);
        fd.append("link_facebook", `https://www.facebook.com/${fbSlug}`);
      }
      if (ttSlug) {
        fd.append("tiktok", ttSlug);
        fd.append("link_tiktok", `https://www.tiktok.com/@${ttSlug}`);
      }

      const normalizedRef = normalizeAgentCode(refCode);
      if (normalizedRef) fd.append("kode_referral_upline", normalizedRef);
      if (uplineInfo?.id_agent) fd.append("id_upline", uplineInfo.id_agent);

      fd.append("foto_ktp", fotoKtp!);
      if (fotoNpwp) fd.append("foto_npwp", fotoNpwp);
      fd.append("foto_profil", fotoProfil!);

      const res = await fetch("/api/agent/apply", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal mengirim pendaftaran.");

      setSuccess(data?.message || "Pendaftaran terkirim. Status: PENDING.");
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] p-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-black/30 p-6 text-white">
          Memuat...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050807] text-white pt-24 md:pt-28">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-40 right-[-12rem] h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-12rem] h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-16">
        {/* HERO */}
        <div className="mb-10 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
              <span className="text-emerald-200">●</span> Upgrade Agent • 3 langkah • ± 2–3 menit
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Aktifkan status <span className="text-emerald-200">Agent Profesional</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              Akses database listing nasional, sistem reward closing, mentoring tim, dan dashboard performa.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  if (!isAuthed) return setLoginOpen(true);
                  goToForm();
                }}
                className="rounded-2xl bg-emerald-400/90 px-5 py-3 text-sm font-medium text-black hover:bg-emerald-300"
              >
                {isAuthed ? "Mulai Pendaftaran" : "Login untuk Mulai"}
              </button>

              <div className="text-xs text-white/50">🔒 Dokumen hanya untuk verifikasi.</div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatChip title="100.000+" sub="Listing nasional" icon={<IconDatabase />} />
                <StatChip title="Reward" sub="Bonus tiap closing" icon={<IconReward />} />
                <StatChip title="Mentoring" sub="Upline & support" icon={<IconUsers />} />
                <StatChip title="Dashboard" sub="Tracking performa" icon={<IconChart />} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left */}
          <aside className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <h2 className="text-base font-semibold">Benefit utama</h2>

              <div className="mt-5 space-y-3">
                <BenefitRow icon={<IconDatabase />} title="Database listing nasional" desc="Mulai prospek tanpa harus canvassing." />
                <BenefitRow icon={<IconReward />} title="Bonus & reward closing" desc="Komisi + apresiasi (poin/reward)." />
                <BenefitRow icon={<IconUsers />} title="Struktur tim & mentoring" desc="Terhubung ke upline untuk support & growth." />
                <BenefitRow icon={<IconChart />} title="Dashboard performa" desc="Pantau transaksi & progres secara rapi." />
                <BenefitRow icon={<IconShield />} title="Profil terverifikasi" desc="Meningkatkan trust klien." />
              </div>
            </div>
          </aside>

          {/* Form */}
          <section className="lg:col-span-7">
            <div ref={formRef} className="scroll-mt-24 md:scroll-mt-28">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
                {isAlreadyAgent ? (
                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
                    <div className="text-sm font-medium text-emerald-100">Kamu sudah terdaftar sebagai Agent 🎉</div>
                    <div className="mt-2 text-sm text-emerald-100/80">
                      ID Pengguna: <span className="font-mono text-white">{user?.id}</span> • ID Agent:{" "}
                      <span className="font-mono text-white">{user?.agentId}</span>
                    </div>
                  </div>
                ) : null}

                {!isAuthed && !isAlreadyAgent ? (
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

                {!isAlreadyAgent ? (
                  <div className="mb-6">
                    <WizardHeader step={step} onJump={jumpTo} progress={progress} />
                  </div>
                ) : null}

                {error ? (
                  <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}
                {success ? (
                  <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                    {success}
                  </div>
                ) : null}

                {!isAlreadyAgent ? (
                  <div className={!isAuthed ? "relative" : ""}>
                    {!isAuthed ? (
                      <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-black/45 backdrop-blur-[2px]" />
                    ) : null}

                    {step === 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nama" required hint={lockFromAccount.nama ? "Terkunci dari akun." : "Isi sesuai identitas akun."}>
                          <input value={nama} onChange={(e) => setNama(e.target.value)} disabled={lockFromAccount.nama} className={inputClass} placeholder="Nama lengkap" />
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
                              disabled={lockFromAccount.phone}
                              className={`${inputClass} rounded-l-none border-l-0`}
                              placeholder="81234567890"
                              inputMode="numeric"
                              autoComplete="tel-national"
                            />
                          </div>
                        </Field>

                        <Field label="Email" required hint={lockFromAccount.email ? "Terkunci dari akun." : "Gunakan email aktif."}>
                          <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={lockFromAccount.email} className={inputClass} placeholder="nama@email.com" type="email" />
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
                            disabled={lockKantorFromReferral}
                            className={inputClass}
                            placeholder="Nama kantor/tim"
                          />
                        </Field>

                        <Field label="Kota / Area" required hint="Ketik untuk mencari (contoh: Sur...).">
                          <CitySelect value={kotaArea} onChange={(v) => setKotaArea(v)} disabled={!isAuthed} />
                        </Field>
                      </div>
                    ) : null}

                    {/* ✅ STEP 1: SOSMED */}
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
                            label="Instagram"
                            icon="skill-icons:instagram"
                            prefix="instagram.com/"
                            value={instagram}
                            onChange={setInstagram}
                            previewUrl={instagramUrl}
                            placeholder="namakamu"
                          />
                          <SocialInput
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

                    {/* ✅ STEP 2: DOKUMEN (preview + compress) */}
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
                          <UploadCard label="Foto KTP" required file={fotoKtp} setFile={setFotoKtp} />
                          <UploadCard label="Foto NPWP" file={fotoNpwp} setFile={setFotoNpwp} />
                          <UploadCard label="Foto Profil" required file={fotoProfil} setFile={setFotoProfil} />
                        </div>
                      </div>
                    ) : null}

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
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthed) return setLoginOpen(true);
                            onSubmit();
                          }}
                          disabled={submitting}
                          className="rounded-2xl bg-emerald-400/90 px-5 py-3 text-sm font-medium text-black hover:bg-emerald-300 disabled:opacity-50"
                        >
                          {submitting ? "Mengirim..." : "Kirim Pendaftaran"}
                        </button>
                      )}
                    </div>

                    <div className="mt-4 text-xs text-white/45">
                      Dengan mengirim, kamu menyetujui data digunakan untuk proses verifikasi.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      {loginOpen ? (
        <ModalShell onClose={() => setLoginOpen(false)}>
          <Signin closeModal={() => setLoginOpen(false)} />
        </ModalShell>
      ) : null}
    </div>
  );
}

/* ---------------- Sosmed Input (Premium) ---------------- */

function SocialInput({
  label,
  icon,
  prefix,
  value,
  onChange,
  previewUrl,
  placeholder,
}: {
  label: string;
  icon: string;
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  previewUrl?: string;
  placeholder?: string;
}) {
  const clean = useMemo(() => normalizeSocialSlug(value), [value]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.03] transition">
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
      (c) => !c.name.toLowerCase().startsWith(s) && c.name.toLowerCase().includes(s)
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
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon icon="solar:buildings-2-bold-duotone" className="text-xl text-emerald-200 shrink-0" />
          <span className={["truncate", value ? "text-white" : "text-white/45"].join(" ")}>
            {value || "Pilih kota/kabupaten"}
          </span>
        </div>
        <Icon
          icon="solar:alt-arrow-down-linear"
          className={["text-white/60 transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-[#060b0a] shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-white/10 bg-black/20">
            <div className="relative">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45"
              />
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
                  onClick={() => {
                    const label = c.province ? `${c.name} — ${c.province}` : c.name;
                    onChange(label);
                    setOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-white/85 hover:bg-white/[0.05] transition flex items-center gap-3"
                >
                  <Icon icon="solar:map-point-wave-bold-duotone" className="text-lg text-emerald-200" />
                  <span className="truncate">{c.name}</span>
                  {c.province ? (
                    <span className="ml-auto text-xs text-white/45 truncate">{c.province}</span>
                  ) : null}
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
                active
                  ? "border-emerald-400/25 bg-emerald-400/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/5",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <div
                  className={[
                    "h-8 w-8 rounded-xl flex items-center justify-center border text-sm font-semibold",
                    done || active
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-black/20 text-white/70",
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

function StatChip({ title, sub, icon }: { title: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-white/55">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.04] transition">
      <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-emerald-200">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
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
}: {
  label: string;
  required?: boolean;
  file: File | null;
  setFile: (f: File | null) => void;
}) {
  const previewUrl = useObjectUrl(file);
  const isImage = Boolean(file?.type?.startsWith("image/"));
  const [compressing, setCompressing] = useState(false);
  const [compressInfo, setCompressInfo] = useState<string>("");

  const isDoc = /ktp|npwp/i.test(label);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.03] transition">
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

      {/* Preview */}
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
              onClick={() => {
                setFile(null);
                setCompressInfo("");
              }}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-white/75 hover:bg-white/10"
            >
              Hapus
            </button>
          </div>
        </div>
      ) : null}

      <label className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 hover:border-emerald-400/30 hover:bg-emerald-400/[0.06]">
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
          onChange={async (e) => {
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

              // ✅ setting aman: dokumen max ~2MB, profil max ~600KB
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
              // fallback: simpan file asli
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

/* ---------------- Icons ---------------- */

function IconDatabase() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 6c0-2 3.6-3.6 8-3.6S20 4 20 6s-3.6 3.6-8 3.6S4 8 4 6Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4 6v6c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6V6" stroke="currentColor" strokeWidth="2" />
      <path d="M4 12v6c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6v-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconReward() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2" stroke="currentColor" strokeWidth="2" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 15V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 15v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 2 20 6v7c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-4Z" stroke="currentColor" strokeWidth="2" />
      <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition " +
  "focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20 disabled:bg-white/[0.02] disabled:text-white/70";
