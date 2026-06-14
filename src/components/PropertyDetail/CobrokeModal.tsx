"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import Signin from "@/components/Auth/SignIn";
import SignUp from "@/components/Auth/SignUp";
import { trackLeadClick } from "@/lib/leadTracking";

interface ExistingClaim {
  id_lead: string;
  client_name: string | null;
  client_phone: string | null;
  catatan?: string | null;
  status_penawaran: "pending" | "diterima" | "ditolak";
  catatan_agent?: string | null;
  tanggal_keputusan?: string | null;
  created_at?: string;
}

export interface CobrokeClaimSummary {
  status: "pending" | "diterima" | "ditolak";
}

interface CobrokeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentOffice: string;
  agentPhone: string;
  propertyTitle: string;
  askingPrice: number;
  idProperty: string | number;
  idAgent: string | number | undefined;
  onClaimChange?: (claim: CobrokeClaimSummary | null) => void;
}

export default function CobrokeModal({
  isOpen, onClose, agentName, agentOffice, agentPhone, propertyTitle, askingPrice, idProperty, idAgent, onClaimChange,
}: CobrokeModalProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [namaKlien, setNamaKlien] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [notes, setNotes] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authView, setAuthView] = useState<"gate" | "signin" | "signup">("gate");
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [existingClaim, setExistingClaim] = useState<ExistingClaim | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(true);
  const [myInfo, setMyInfo] = useState<{ name: string; office: string; phone: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNamaKlien(""); setPhoneDigits(""); setNotes(""); setError("");
      setSubmitting(false); setAuthView("gate"); setJustAuthenticated(false);
      requestAnimationFrame(() => setVisible(true));

      if (session?.user) {
        fetch("/api/profile")
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            setMyInfo({
              name: data?.pengguna?.nama_lengkap || session.user?.name || "",
              office: data?.agent?.nama_kantor || "",
              phone: data?.pengguna?.nomor_telepon || "",
            });
          })
          .catch(() => setMyInfo(null));

        setLoadingClaim(true);
        fetch(`/api/leads/cobroke/mine?id_property=${idProperty}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const claim = data?.claim ?? null;
            setExistingClaim(claim);
            onClaimChange?.(claim ? { status: claim.status_penawaran } : null);
          })
          .catch(() => setExistingClaim(null))
          .finally(() => setLoadingClaim(false));
      } else {
        setMyInfo(null);
        setExistingClaim(null);
      }
    } else {
      setVisible(false);
    }
  }, [isOpen, session, idProperty]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const needsLoginNow = sessionStatus !== "loading" && sessionStatus !== "authenticated";
  useEffect(() => {
    if (!justAuthenticated) { setSuccessVisible(false); return; }
    requestAnimationFrame(() => setSuccessVisible(true));
    if (!needsLoginNow) {
      const t = setTimeout(() => {
        setSuccessVisible(false);
        setTimeout(() => setJustAuthenticated(false), 200);
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [justAuthenticated, needsLoginNow]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[-\s]/g, "").replace(/\D/g, "");
    if (v.startsWith("62")) v = v.slice(2);
    if (v.startsWith("0")) v = v.slice(1);
    setPhoneDigits(v.slice(0, 12));
    setError("");
  };
  const fullPhone = `+62${phoneDigits}`;

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  const handleSubmit = async () => {
    if (!namaKlien.trim()) {
      setError("Nama klien wajib diisi"); return;
    }
    if (phoneDigits.length < 7) {
      setError("Nomor WhatsApp klien tidak valid"); return;
    }
    setSubmitting(true); setError("");

    const result = await trackLeadClick({
      id_property: idProperty, id_agent: idAgent !== undefined ? String(idAgent) : undefined, source: "cobroke",
      client_name: namaKlien.trim(), client_phone: fullPhone,
      notes: notes.trim() || undefined,
    });

    if (!result.ok) {
      if (result.error === "PENDING_COBROKE_EXISTS" && result.existing) {
        setExistingClaim({
          id_lead: result.existing.id_lead,
          client_name: namaKlien.trim(),
          client_phone: fullPhone,
          status_penawaran: "pending",
          created_at: result.existing.created_at,
        });
        onClaimChange?.({ status: "pending" });
      } else {
        setError(result.error || "Gagal mengirim pengajuan. Silakan coba lagi.");
      }
      setSubmitting(false);
      return;
    }

    onClaimChange?.({ status: "pending" });

    const phone = agentPhone.replace(/^0/, "62").replace(/\D/g, "");
    let msg =
      `Halo ${agentName}, saya ${myInfo?.name || "agent"} dari *${myInfo?.office || "kantor lain"}* ingin mengajukan *Co-Broke* untuk properti:\n` +
      `*${propertyTitle}*\n\n` +
      `🤝 Saya punya 1 klien yang berminat dengan listing ini.\n` +
      `📋 Identitas klien tercatat di sistem sebagai klaim co-broke saya (tidak dibagikan demi privasi klien).\n` +
      `🗓️ Mohon info ketersediaan jadwal untuk survei — saya akan mendampingi klien saat survei.`;
    if (notes.trim()) msg += `\n\n📝 Catatan: ${notes.trim()}`;
    msg += `\n\nMohon konfirmasi kesediaan kerja sama co-broke (komisi dibagi sesuai kesepakatan). Terima kasih!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitting(false);
    handleClose();
  };

  if (!isOpen) return null;

  const needsLogin = needsLoginNow && !justAuthenticated;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <div
        className="relative w-full sm:max-w-[440px] sm:mx-auto bg-[#0C0C0C] border border-white/[0.07] rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden shadow-[0_-24px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-300 ease-out max-h-[92dvh] sm:max-h-[85vh] flex flex-col"
        style={{ transform: visible ? "translateY(0)" : "translateY(24px)", opacity: visible ? 1 : 0 }}
      >
        {/* Pull bar */}
        <div className="sm:hidden flex justify-center pt-3.5 pb-1 shrink-0">
          <div className="w-8 h-[3px] rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-[#34d399]/70 uppercase tracking-widest flex items-center gap-1.5">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-sm" />
              Kerja Sama Co-Broke
            </span>
            <button onClick={handleClose} className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
              <Icon icon="solar:close-circle-bold" className="text-white/50 text-base" />
            </button>
          </div>
          <h2 className="text-[1.25rem] font-extrabold text-white leading-tight tracking-tight">
            Ajukan Co-Broke
          </h2>
          <p className="text-[11px] text-white/30 mt-0.5 truncate font-medium">{propertyTitle}</p>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
          {justAuthenticated ? (
            <div
              className="flex flex-col items-center text-center gap-4 py-10 transition-all duration-500 ease-out"
              style={{ opacity: successVisible ? 1 : 0, transform: successVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)" }}
            >
              <div className="relative w-20 h-20 rounded-full bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#86efac]/20 animate-ping" />
                <Icon icon="solar:check-circle-bold" className="text-4xl text-[#86efac] relative z-10" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Berhasil masuk!</h3>
                <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                  Menyiapkan formulir co-broke kamu...
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#86efac] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : needsLogin ? (
            authView === "signin" ? (
              <div className="auth-embed">
                <Signin
                  closeModal={() => setAuthView("gate")}
                  openSignupModal={() => setAuthView("signup")}
                  skipRedirect
                  onSuccess={() => setJustAuthenticated(true)}
                />
              </div>
            ) : authView === "signup" ? (
              <div className="auth-embed">
                <SignUp
                  closeModal={() => setAuthView("gate")}
                  openSigninModal={() => setAuthView("signin")}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#34d399]/10 border border-[#34d399]/20 flex items-center justify-center">
                    <Icon icon="solar:shield-keyhole-bold-duotone" className="text-2xl text-[#34d399]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Masuk sebagai agent untuk co-broke</h3>
                    <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                      Pengajuan co-broke hanya bisa dilakukan oleh akun agent terdaftar —
                      agar klaim klien & kesepakatan split komisi Anda tercatat dengan timestamp dan terlindungi.
                      Jangan langsung WhatsApp agent pemilik tanpa klaim di sini.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAuthView("signin")}
                  className="w-full bg-[#86efac] hover:bg-[#6ee7a8] active:scale-[0.98] text-black font-extrabold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Icon icon="solar:login-3-bold" className="text-lg" />
                  Masuk
                </button>
                <button
                  onClick={() => setAuthView("signup")}
                  className="w-full bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all text-sm border border-white/[0.08]"
                >
                  Daftar Akun Baru
                </button>
              </>
            )
          ) : loadingClaim && !existingClaim ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-[#34d399] animate-spin" />
              <p className="text-[12px] text-white/30 font-medium">Memeriksa status pengajuan...</p>
            </div>
          ) : existingClaim?.status_penawaran === "pending" ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="relative w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/15 animate-ping" />
                <Icon icon="solar:hourglass-line-bold-duotone" className="text-3xl text-amber-300 relative z-10" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Menunggu Respon Agent Pemilik</h3>
                <p className="text-[12px] text-white/40 mt-1.5 leading-relaxed">
                  Pengajuan co-broke Anda sedang dipertimbangkan. Anda akan diberi tahu begitu ada keputusan.
                </p>
              </div>
              <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 font-medium">Klien yang dibawa</span>
                  <span className="text-sm font-extrabold text-white">
                    {existingClaim.client_name || "-"}
                  </span>
                </div>
                {existingClaim.client_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40 font-medium">No. WhatsApp</span>
                    <span className="text-[12px] font-bold text-white/80">{existingClaim.client_phone}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-full bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all text-sm border border-white/[0.08]"
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              {/* Hasil keputusan sebelumnya */}
              {existingClaim && existingClaim.status_penawaran !== "pending" && (
                <div className={`flex items-start gap-2.5 rounded-2xl border p-3 ${existingClaim.status_penawaran === "diterima" ? "border-[#86efac]/20 bg-[#86efac]/[0.06]" : "border-rose-400/20 bg-rose-500/[0.06]"}`}>
                  <Icon
                    icon={existingClaim.status_penawaran === "diterima" ? "solar:medal-ribbons-star-bold-duotone" : "solar:close-circle-bold"}
                    className={`text-base mt-0.5 shrink-0 ${existingClaim.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-400"}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-[12px] font-bold ${existingClaim.status_penawaran === "diterima" ? "text-[#86efac]" : "text-rose-300"}`}>
                      {existingClaim.status_penawaran === "diterima" ? "Co-Broke sebelumnya diterima!" : "Co-Broke sebelumnya ditolak"}
                    </p>
                    {existingClaim.catatan_agent && (
                      <p className="text-[11px] text-white/50 mt-1 italic">"{existingClaim.catatan_agent}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* Info edukatif: kenapa harus klaim di sini dulu */}
              <div className="rounded-2xl border border-[#34d399]/15 bg-gradient-to-br from-[#34d399]/[0.08] to-transparent p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:shield-check-bold-duotone" className="text-[#34d399] text-base shrink-0" />
                  <p className="text-[11px] font-extrabold text-[#86efac] uppercase tracking-wide">
                    Kenapa harus klaim co-broke di sini?
                  </p>
                </div>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-[11px] text-white/50 leading-relaxed">
                    <Icon icon="solar:clock-circle-bold" className="text-white/30 text-sm mt-0.5 shrink-0" />
                    <span>
                      <span className="text-white/80 font-bold">Klaim tercatat dengan timestamp</span> — jadi bukti sah siapa yang lebih dulu membawa klien ini, melindungi prioritas Anda.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-white/50 leading-relaxed">
                    <Icon icon="solar:document-text-bold" className="text-white/30 text-sm mt-0.5 shrink-0" />
                    <span>
                      <span className="text-white/80 font-bold">Kesepakatan split komisi tercatat</span> (umumnya 50:50) — jadi pegangan kalau ada perbedaan saat closing.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] text-white/50 leading-relaxed">
                    <Icon icon="solar:medal-ribbons-star-bold-duotone" className="text-white/30 text-sm mt-0.5 shrink-0" />
                    <span>
                      <span className="text-white/80 font-bold">Membangun reputasi</span> — co-broke yang selesai dengan baik tercatat di riwayat Anda, jadi modal kepercayaan untuk kerja sama berikutnya.
                    </span>
                  </li>
                </ul>
                <p className="text-[10px] text-white/30 leading-relaxed pt-2 border-t border-white/[0.06]">
                  Jangan ajukan co-broke langsung lewat WhatsApp tanpa klaim di sini — tanpa klaim, prioritas dan kesepakatan komisi Anda tidak tercatat dan tidak terlindungi.
                </p>
              </div>

              {/* Harga listing reference */}
              <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                <span className="text-[11px] text-white/40 font-medium">Harga Listing</span>
                <span className="text-sm font-extrabold text-white">{fmt(askingPrice)}</span>
              </div>

              {/* Identitas pengaju */}
              {myInfo && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-2.5">
                  <Icon icon="solar:user-id-bold-duotone" className="text-[#34d399] text-base shrink-0" />
                  <p className="text-[11px] text-white/45 font-medium truncate">
                    Mengajukan sebagai <span className="text-white/80 font-bold">{myInfo.name}</span>
                    {myInfo.office ? ` · ${myInfo.office}` : ""}
                  </p>
                </div>
              )}

              {/* Privasi data klien */}
              <div className="flex items-center gap-2 bg-fuchsia-500/[0.06] border border-fuchsia-400/15 rounded-2xl px-4 py-2.5">
                <Icon icon="solar:lock-keyhole-bold-duotone" className="text-fuchsia-300 text-base shrink-0" />
                <p className="text-[10.5px] text-fuchsia-100/70 font-medium leading-relaxed">
                  Data klien di bawah ini <span className="text-fuchsia-200 font-bold">privat & hanya untuk klaim Anda</span> — TIDAK dikirim ke agent pemilik listing.
                </p>
              </div>

              {/* Nama Klien */}
              <div>
                <label className="flex items-center gap-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">
                  <Icon icon="solar:lock-keyhole-minimalistic-bold" className="text-fuchsia-300/70 text-[11px]" />
                  Nama Klien Anda
                  <span className="text-white/15 normal-case font-normal tracking-normal">· privat</span>
                </label>
                <input
                  type="text"
                  value={namaKlien}
                  onChange={e => { setNamaKlien(e.target.value); setError(""); }}
                  placeholder="Nama klien yang akan dibawa"
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#34d399]/30 rounded-2xl px-4 py-3.5 text-white font-bold text-sm outline-none placeholder:text-white/15 transition-colors"
                />
              </div>

              {/* No WA Klien */}
              <div>
                <label className="flex items-center gap-1.5 text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">
                  <Icon icon="solar:lock-keyhole-minimalistic-bold" className="text-fuchsia-300/70 text-[11px]" />
                  No. WhatsApp Klien
                  <span className="text-white/15 normal-case font-normal tracking-normal">· privat</span>
                </label>
                <div className={`flex items-center gap-2 rounded-2xl px-4 py-3.5 transition-colors border ${error ? "border-rose-500/40 bg-rose-500/[0.04]" : "border-white/[0.08] bg-white/[0.04] focus-within:border-[#34d399]/30"}`}>
                  <span className="text-sm font-bold text-white/30 shrink-0">+62</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phoneDigits}
                    onChange={handlePhoneInput}
                    placeholder="812xxxxxxxx"
                    className="flex-1 bg-transparent text-white font-extrabold text-sm outline-none placeholder:text-white/15 tabular-nums"
                  />
                </div>
                {error && (
                  <p className="text-[10px] text-rose-400 mt-1.5 font-medium">{error}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">
                  Catatan untuk Agent Pemilik <span className="text-white/15 normal-case font-normal tracking-normal">(opsional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Contoh: Klien sudah siap KPR, ingin survei minggu ini... (jangan tulis nama/nomor klien di sini)"
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#34d399]/30 rounded-2xl px-4 py-3 text-white text-[13px] font-medium outline-none placeholder:text-white/15 resize-none transition-colors"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[#34d399] to-[#86efac] hover:opacity-90 active:scale-[0.98] text-black font-extrabold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(52,211,153,0.25)] disabled:opacity-60"
              >
                <Icon icon={submitting ? "solar:refresh-bold" : "ic:baseline-whatsapp"} className={`text-lg ${submitting ? "animate-spin" : ""}`} />
                {submitting ? "Mengirim..." : "Ajukan & Hubungi via WhatsApp"}
              </button>

              <p className="text-center text-[10px] text-white/20 font-medium">
                Klaim Anda tercatat dengan timestamp untuk melindungi prioritas co-broke
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
