// src/lib/referral.ts
//
// Helper terpusat untuk sistem KODE REFERRAL KLIEN.
// Dipakai oleh:
//  - POST /api/auth/Register   (daftar email/phone)
//  - authOptions signIn()      (daftar via Google)
//
// Semua operasi bersifat BEST-EFFORT: kegagalan atribusi TIDAK BOLEH
// menggagalkan pembuatan akun. Karena itu attributeReferral() tidak pernah
// melempar error — ia hanya mengembalikan ringkasan hasil.

import prisma from "@/lib/prisma";
import { notifyNewReferralKlien, notifyAgentReferralReward } from "@/lib/notifications";

/** Poin yang didapat agent perujuk untuk tiap klien baru yang daftar pakai kodenya. */
export const REFERRAL_AGENT_POIN = 10_000;

/** Poin untuk UPLINE saat downline agent-nya resmi diverifikasi (PENDING -> AKTIF). */
export const REFERRAL_UPLINE_POIN = 10_000;

/**
 * Normalisasi kode agent ke bentuk kanonik `AG<number>`.
 *  - "108"        -> "AG108"
 *  - "ag108"      -> "AG108"
 *  - "AG 0108"    -> "AG108"
 *  - "AG108"      -> "AG108"
 * (Sinkron dengan logika di /api/agent/referral.)
 */
export function normalizeAgentCode(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";

  if (/^\d+$/.test(s)) return `AG${s.replace(/^0+/, "") || "0"}`;

  const m = s.toUpperCase().match(/^AG\s*0*(\d+)$/);
  if (m) return `AG${m[1]}`;

  return s.toUpperCase();
}

/**
 * Tambah poin ke agent + catat di riwayat_poin.
 * Mengikuti pola yang sudah dipakai saat agent menambah listing
 * (lihat src/app/api/dashboard/listings/route.ts).
 */
export async function awardAgentPoin(
  id_agent: string,
  amount: number,
  jenis_aktivitas: string,
  deskripsi: string,
  tabel_referensi?: string,
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id_agent },
    select: { poin: true },
  });
  if (!agent) return;

  const before = agent.poin ?? 0;
  const after = before + amount;

  await prisma.agent.update({
    where: { id_agent },
    data: { poin: after },
  });

  await prisma.riwayatPoin.create({
    data: {
      id_agent,
      jenis_aktivitas,
      deskripsi,
      poin: amount,
      tipe_transaksi: "DAPAT",
      id_referensi: null,
      tabel_referensi: tabel_referensi ?? null,
      saldo_sebelum: before,
      saldo_sesudah: after,
    },
  });
}

/**
 * Reward UPLINE saat downline-nya resmi menjadi agent (PENDING -> AKTIF).
 *
 * Idempotent: cek riwayat poin dulu (per downline) supaya tidak dobel walau
 * status di-toggle berkali-kali. Best-effort — tidak pernah throw.
 * Kembalikan true bila reward benar-benar diberikan kali ini.
 */
export async function rewardAgentReferral(params: {
  uplineAgentId: string | null | undefined;
  downlineAgentId: string;
  downlineNama: string;
}): Promise<boolean> {
  try {
    const uplineAgentId = (params.uplineAgentId || "").trim();
    const downlineAgentId = (params.downlineAgentId || "").trim();
    if (!uplineAgentId || !downlineAgentId) return false;
    if (uplineAgentId === downlineAgentId) return false;

    // Idempotent: jangan reward dua kali untuk downline yang sama.
    // Pakai penanda berkurung "(AG###)" supaya "AG1" tidak salah cocok dengan "AG10".
    const marker = `(${downlineAgentId})`;
    const already = await prisma.riwayatPoin.findFirst({
      where: {
        id_agent: uplineAgentId,
        jenis_aktivitas: "Referral Agent",
        deskripsi: { contains: marker },
      },
      select: { id_riwayat: true },
    });
    if (already) return false;

    // Upline harus agent yang valid.
    const upline = await prisma.agent.findUnique({
      where: { id_agent: uplineAgentId },
      select: { id_agent: true },
    });
    if (!upline) return false;

    await awardAgentPoin(
      uplineAgentId,
      REFERRAL_UPLINE_POIN,
      "Referral Agent",
      `Downline "${params.downlineNama?.trim() || "Agent"}" (${downlineAgentId}) resmi menjadi agent via referralmu.`,
      "agent",
    );

    notifyAgentReferralReward({
      id_upline_agent: uplineAgentId,
      id_downline_agent: downlineAgentId,
      nama_downline: params.downlineNama?.trim() || "Agent",
      poin: REFERRAL_UPLINE_POIN,
    }).catch((e) => console.warn("notifyAgentReferralReward failed:", e));

    return true;
  } catch (e) {
    console.warn("rewardAgentReferral failed:", e);
    return false;
  }
}

export type AttributeReferralResult = {
  ok: boolean;
  /** Kode agent perujuk yang valid (mis. "AG108"), bila atribusi sukses. */
  id_agent?: string;
  /** Alasan singkat saat tidak teratribusi (untuk logging/debug). */
  reason?: "no-code" | "invalid-agent" | "already-referred" | "self" | "error";
};

/**
 * Atribusikan seorang pengguna (klien) ke agent perujuk berdasarkan kode referral.
 *
 * Efek bila valid:
 *  1) Pengguna.kode_referral di-set (idempotent: kalau sudah ada, dilewati).
 *  2) Dibuat record Klien (sumber=referral) di CRM agent — dedup per (id_agent, id_pengguna).
 *  3) Agent perujuk dapat +REFERRAL_AGENT_POIN poin (+ riwayat poin).
 *  4) Agent perujuk dapat notifikasi.
 *
 * Tidak pernah throw — selalu mengembalikan hasil.
 */
export async function attributeReferral(params: {
  penggunaId: string;
  code: string | null | undefined;
  nama: string;
  email?: string | null;
  phone?: string | null;
}): Promise<AttributeReferralResult> {
  try {
    const code = normalizeAgentCode(String(params.code || ""));
    if (!code || !/^AG\d+$/.test(code)) return { ok: false, reason: "no-code" };

    // Agent perujuk harus ada & AKTIF.
    const agent = await prisma.agent.findFirst({
      where: { id_agent: code, status_keanggotaan: "AKTIF" },
      select: { id_agent: true, id_pengguna: true },
    });
    if (!agent) return { ok: false, reason: "invalid-agent" };

    // Tidak boleh mereferal diri sendiri.
    if (agent.id_pengguna === params.penggunaId) return { ok: false, reason: "self" };

    // Idempotent: kalau pengguna sudah punya kode_referral, jangan atribusi ulang.
    const pengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna: params.penggunaId },
      select: { kode_referral: true },
    });
    if (pengguna?.kode_referral) return { ok: false, reason: "already-referred" };

    // 1) Set kode_referral di akun klien.
    await prisma.pengguna.update({
      where: { id_pengguna: params.penggunaId },
      data: { kode_referral: code },
    });

    // 2) Buat Klien (CRM) — dedup per (id_agent, id_pengguna).
    const existingKlien = await prisma.klien.findFirst({
      where: { id_agent: agent.id_agent, id_pengguna: params.penggunaId },
      select: { id_klien: true },
    });
    if (!existingKlien) {
      const phone = (params.phone || "").trim() || null;
      const email = (params.email || "").trim() || null;
      await prisma.klien.create({
        data: {
          id_agent: agent.id_agent,
          id_pengguna: params.penggunaId,
          nama: params.nama?.trim() || "Klien Referral",
          nomor_whatsapp: phone,
          email,
          sumber: "referral",
          status: "lead_baru",
          catatan: `Klien mendaftar melalui kode referral ${code}.`,
        },
      });
    }

    // 3) Reward poin untuk agent perujuk.
    await awardAgentPoin(
      agent.id_agent,
      REFERRAL_AGENT_POIN,
      "Referral Klien",
      `Klien baru "${params.nama?.trim() || "Klien"}" mendaftar via kode referral ${code}.`,
      "klien",
    );

    // 4) Notifikasi + email ke agent perujuk (best-effort).
    notifyNewReferralKlien({
      id_agent: agent.id_agent,
      id_pengguna: agent.id_pengguna,
      nama_klien: params.nama?.trim() || "Klien",
      kode: code,
      klienEmail: params.email ?? null,
      klienPhone: params.phone ?? null,
      poin: REFERRAL_AGENT_POIN,
      registeredAt: new Date(),
    }).catch((e) => console.warn("notifyNewReferralKlien failed:", e));

    return { ok: true, id_agent: agent.id_agent };
  } catch (e) {
    console.warn("attributeReferral failed:", e);
    return { ok: false, reason: "error" };
  }
}
