import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { sendNewAgentEmail, sendNewUserEmail, sendReferralKlienEmail } from "@/lib/mailer";
import { jabatan_agent_enum, status_agent_enum } from "@prisma/client";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://solusindoaset.com";

/**
 * Kirim email "agent baru bergabung" (best-effort) ke:
 *  - Semua OWNER aktif (lintas kantor)
 *  - PRINCIPAL aktif dari kantor yang sama dengan agent baru
 *  - UPLINE (kalau daftar via kode referral) — dengan narasi "referral"
 *
 * Dedup ketat berdasarkan email: satu orang hanya menerima SATU email meski
 * cocok di beberapa peran. Khususnya bila upline ternyata adalah owner /
 * principal kantor itu sendiri, ia hanya menerima email pimpinan (bukan ganda).
 * Agent itu sendiri juga tidak pernah dikirimi.
 * Tidak melempar error agar tidak mengganggu alur pendaftaran.
 */
async function emailNewAgentNotifications(
  id_agent: string,
  nama_lengkap: string,
  id_upline?: string | null,
) {
  try {
    const baru = await prisma.agent.findUnique({
      where: { id_agent },
      select: {
        id_agent: true,
        nama_kantor: true,
        kota_area: true,
        nomor_whatsapp: true,
        tanggal_gabung: true,
        pengguna: { select: { email: true } },
      },
    });
    if (!baru) return;

    const reviewUrl = `${BASE_URL}/dashboard/human-resource-management?agent=${id_agent}`;

    // Field email yang sama untuk semua peran.
    const base = {
      agentName: nama_lengkap,
      agentId: baru.id_agent,
      office: baru.nama_kantor,
      area: baru.kota_area,
      whatsapp: baru.nomor_whatsapp,
      agentEmail: baru.pengguna?.email ?? null,
      joinedAt: baru.tanggal_gabung,
      reviewUrl,
    };

    // Dedup global berdasarkan email; seed dengan email agent itu sendiri agar
    // ia tidak pernah menerima notifikasi tentang dirinya sendiri.
    const seen = new Set<string>();
    const selfEmail = baru.pengguna?.email?.trim().toLowerCase();
    if (selfEmail) seen.add(selfEmail);

    const jobs: Promise<unknown>[] = [];

    // 1) Pimpinan: OWNER (lintas kantor) + PRINCIPAL kantor yang sama.
    const pimpinan = await prisma.agent.findMany({
      where: {
        status_keanggotaan: status_agent_enum.AKTIF,
        id_agent: { not: id_agent },
        OR: [
          { jabatan: jabatan_agent_enum.OWNER },
          { jabatan: jabatan_agent_enum.PRINCIPAL, nama_kantor: baru.nama_kantor },
        ],
      },
      select: {
        jabatan: true,
        pengguna: { select: { email: true, nama_lengkap: true } },
      },
    });

    for (const p of pimpinan) {
      const email = p.pengguna?.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue; // dedup
      seen.add(email);
      jobs.push(
        sendNewAgentEmail(p.pengguna!.email!, {
          ...base,
          recipientName: p.pengguna?.nama_lengkap ?? null,
          recipientRole:
            p.jabatan === jabatan_agent_enum.OWNER ? "OWNER" : "PRINCIPAL",
        }).catch((e) => console.warn("sendNewAgentEmail (pimpinan) failed:", e)),
      );
    }

    // 2) UPLINE — kecuali ia sudah menerima email sebagai owner/principal kantor
    //    itu (mis. upline = principal kantornya sendiri / = owner). Tidak ganda.
    if (id_upline) {
      const upline = await prisma.agent.findUnique({
        where: { id_agent: id_upline },
        select: { pengguna: { select: { email: true, nama_lengkap: true } } },
      });
      const email = upline?.pengguna?.email?.trim().toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        jobs.push(
          sendNewAgentEmail(upline!.pengguna!.email!, {
            ...base,
            recipientName: upline!.pengguna?.nama_lengkap ?? null,
            recipientRole: "UPLINE",
            uplineCode: id_upline,
          }).catch((e) => console.warn("sendNewAgentEmail (upline) failed:", e)),
        );
      }
    }

    await Promise.all(jobs);
  } catch (e) {
    console.warn("emailNewAgentNotifications failed:", e);
  }
}

/**
 * Dipanggil saat agent baru pertama kali submit pendaftaran (status PENDING).
 * Mengirim notifikasi ke:
 * - Semua PRINCIPAL/OWNER aktif: "ada agent baru bergabung"
 * - Upline (kalau daftar via kode referral): "ada yang gabung pakai referral kamu"
 */
export async function notifyNewAgentRegistration(params: {
  id_agent: string;
  nama_lengkap: string;
  id_upline?: string | null;
}) {
  const { id_agent, nama_lengkap, id_upline } = params;
  const link = `/dashboard/human-resource-management?agent=${id_agent}`;

  // Pastikan notifikasi "agent baru" untuk id_agent ini belum pernah
  // dikirim sebelumnya — supaya re-submit data (masih PENDING) tidak spam,
  // termasuk untuk agent row lama (migrasi/seed) yang belum pernah dinotif.
  const already = await prisma.notifikasi.findFirst({
    where: { id_agent_ref: id_agent, tipe: { in: ["AGENT_BARU", "AGENT_REFERRAL"] } },
    select: { id_notifikasi: true },
  });
  if (already) return;

  // 📧 Email ultra-premium ke OWNER, PRINCIPAL kantor & UPLINE (best-effort).
  await emailNewAgentNotifications(id_agent, nama_lengkap, id_upline);

  const recipients: Array<{
    id_pengguna: string;
    tipe: "AGENT_BARU" | "AGENT_REFERRAL";
    judul: string;
    pesan: string;
  }> = [];

  const pimpinan = await prisma.agent.findMany({
    where: {
      jabatan: { in: [jabatan_agent_enum.PRINCIPAL, jabatan_agent_enum.OWNER] },
      status_keanggotaan: status_agent_enum.AKTIF,
    },
    select: { id_pengguna: true },
  });
  for (const p of pimpinan) {
    recipients.push({
      id_pengguna: p.id_pengguna,
      tipe: "AGENT_BARU",
      judul: "Ada agent baru bergabung!",
      pesan: `${nama_lengkap} baru saja mendaftar sebagai agent dan menunggu verifikasi kamu.`,
    });
  }

  if (id_upline) {
    const upline = await prisma.agent.findUnique({
      where: { id_agent: id_upline },
      select: { id_pengguna: true },
    });
    if (upline) {
      recipients.push({
        id_pengguna: upline.id_pengguna,
        tipe: "AGENT_REFERRAL",
        judul: "Ada yang bergabung pakai kode referral kamu!",
        pesan: `${nama_lengkap} mendaftar sebagai agent menggunakan kode referral ${id_upline} milikmu.`,
      });
    }
  }

  if (recipients.length === 0) return;

  const created = await prisma.$transaction(
    recipients.map((r) =>
      prisma.notifikasi.create({
        data: {
          id_pengguna: r.id_pengguna,
          tipe: r.tipe,
          judul: r.judul,
          pesan: r.pesan,
          link,
          id_agent_ref: id_agent,
        },
      }),
    ),
  );

  await Promise.all(
    created.map((n) =>
      pusherServer
        .trigger(`notif-pengguna-${n.id_pengguna}`, "notif:new", {
          id_notifikasi: n.id_notifikasi.toString(),
          tipe: n.tipe,
          judul: n.judul,
          pesan: n.pesan,
          link: n.link,
          dibuat_pada: n.dibuat_pada.toISOString(),
        })
        .catch((e) => console.warn("pusher trigger notif:new failed:", e)),
    ),
  );
}

/**
 * Dipanggil saat user baru berhasil mendaftar (peran USER).
 * Mengirim email notifikasi hanya ke semua OWNER aktif.
 * Best-effort: tidak melempar error.
 */
export async function notifyNewUserRegistration(params: {
  nama: string;
  email: string | null;
  phone: string | null;
  registeredAt?: Date;
}) {
  try {
    const { nama, email, phone, registeredAt } = params;
    const dashboardUrl = `${BASE_URL}/dashboard`;

    const owners = await prisma.agent.findMany({
      where: {
        jabatan: jabatan_agent_enum.OWNER,
        status_keanggotaan: status_agent_enum.AKTIF,
      },
      select: {
        pengguna: { select: { email: true, nama_lengkap: true } },
      },
    });

    await Promise.all(
      owners
        .filter((o) => o.pengguna?.email)
        .map((o) =>
          sendNewUserEmail(o.pengguna!.email!, {
            recipientName: o.pengguna?.nama_lengkap ?? null,
            userName: nama,
            userEmail: email,
            userPhone: phone,
            registeredAt: registeredAt ?? new Date(),
            dashboardUrl,
          }).catch((e) => console.warn("sendNewUserEmail failed:", e))
        )
    );
  } catch (e) {
    console.warn("notifyNewUserRegistration failed:", e);
  }
}

/**
 * Dipanggil saat seorang KLIEN baru mendaftar memakai kode referral milik agent.
 * Mengirim notifikasi in-app (+ realtime) ke agent perujuk.
 * Best-effort: tidak melempar error agar tidak mengganggu alur pendaftaran.
 */
export async function notifyNewReferralKlien(params: {
  id_agent: string;
  id_pengguna: string; // id_pengguna milik agent perujuk (penerima notif)
  nama_klien: string;
  kode: string;
  klienEmail?: string | null;
  klienPhone?: string | null;
  poin?: number;
  registeredAt?: Date;
}) {
  const { id_agent, id_pengguna, nama_klien, kode } = params;

  try {
    const link = `/dashboard/crm`;

    const n = await prisma.notifikasi.create({
      data: {
        id_pengguna,
        tipe: "KLIEN_REFERRAL",
        judul: "Klien baru lewat referral! 🎉",
        pesan: `${nama_klien} mendaftar memakai kode referral ${kode} milikmu. Kamu mendapat +10.000 poin & klien ini otomatis masuk CRM-mu.`,
        link,
        id_agent_ref: id_agent,
      },
    });

    await pusherServer
      .trigger(`notif-pengguna-${n.id_pengguna}`, "notif:new", {
        id_notifikasi: n.id_notifikasi.toString(),
        tipe: n.tipe,
        judul: n.judul,
        pesan: n.pesan,
        link: n.link,
        dibuat_pada: n.dibuat_pada.toISOString(),
      })
      .catch((e) => console.warn("pusher trigger notif:new failed:", e));

    // Email ke agent perujuk (best-effort).
    const agentPengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna },
      select: { email: true, nama_lengkap: true },
    });
    if (agentPengguna?.email) {
      sendReferralKlienEmail(agentPengguna.email, {
        agentName: agentPengguna.nama_lengkap ?? null,
        klienName: nama_klien,
        klienEmail: params.klienEmail ?? null,
        klienPhone: params.klienPhone ?? null,
        kodeReferral: kode,
        poin: params.poin ?? 10_000,
        registeredAt: params.registeredAt ?? new Date(),
        crmUrl: `${BASE_URL}/dashboard/crm`,
      }).catch((e) => console.warn("sendReferralKlienEmail failed:", e));
    }
  } catch (e) {
    console.warn("notifyNewReferralKlien failed:", e);
  }
}

/**
 * Dipanggil saat seorang downline agent RESMI diverifikasi (PENDING -> AKTIF)
 * lewat kode referral upline. Memberi tahu upline bahwa ia mendapat reward poin.
 * Best-effort: tidak melempar error.
 */
export async function notifyAgentReferralReward(params: {
  id_upline_agent: string;
  id_downline_agent: string;
  nama_downline: string;
  poin: number;
}) {
  const { id_upline_agent, id_downline_agent, nama_downline, poin } = params;

  try {
    const upline = await prisma.agent.findUnique({
      where: { id_agent: id_upline_agent },
      select: { id_pengguna: true },
    });
    if (!upline) return;

    const n = await prisma.notifikasi.create({
      data: {
        id_pengguna: upline.id_pengguna,
        tipe: "AGENT_REFERRAL",
        judul: "Downline kamu resmi jadi agent! 🎉",
        pesan: `${nama_downline} (${id_downline_agent}) telah diverifikasi menjadi agent lewat referralmu. Kamu mendapat +${poin.toLocaleString("id-ID")} poin.`,
        link: "/dashboard",
        id_agent_ref: id_downline_agent,
      },
    });

    await pusherServer
      .trigger(`notif-pengguna-${n.id_pengguna}`, "notif:new", {
        id_notifikasi: n.id_notifikasi.toString(),
        tipe: n.tipe,
        judul: n.judul,
        pesan: n.pesan,
        link: n.link,
        dibuat_pada: n.dibuat_pada.toISOString(),
      })
      .catch((e) => console.warn("pusher trigger notif:new failed:", e));
  } catch (e) {
    console.warn("notifyAgentReferralReward failed:", e);
  }
}

/**
 * Dipanggil saat agent lain mengajukan klaim co-broke pada listing.
 * Mengirim notifikasi ke pemilik listing (agent pemilik).
 */
export async function notifyCobrokeSubmission(params: {
  id_agent_owner: string;
  id_property: bigint | string | number;
  id_lead: bigint | string | number;
  judul_listing: string;
  claimer_name: string;
  claimer_office?: string | null;
}) {
  const { id_agent_owner, id_property, id_lead, judul_listing, claimer_name, claimer_office } = params;

  const owner = await prisma.agent.findUnique({
    where: { id_agent: id_agent_owner },
    select: { id_pengguna: true },
  });
  if (!owner) return;

  const link = `/dashboard?tab=leads&id_property=${id_property}&id_lead=${id_lead}#hot-leads-card`;
  const pesan = `${claimer_name}${claimer_office ? ` (${claimer_office})` : ""} ingin mengajukan co-broke untuk listing "${judul_listing}".`;

  const n = await prisma.notifikasi.create({
    data: {
      id_pengguna: owner.id_pengguna,
      tipe: "CO_BROKE_SUBMITTED",
      judul: "Ada pengajuan Co-Broke baru!",
      pesan,
      link,
    },
  });

  await pusherServer
    .trigger(`notif-pengguna-${n.id_pengguna}`, "notif:new", {
      id_notifikasi: n.id_notifikasi.toString(),
      tipe: n.tipe,
      judul: n.judul,
      pesan: n.pesan,
      link: n.link,
      dibuat_pada: n.dibuat_pada.toISOString(),
    })
    .catch((e) => console.warn("pusher trigger notif:new failed:", e));
}

/**
 * Dipanggil saat agent pemilik listing menerima/menolak klaim co-broke.
 * Mengirim notifikasi ke agent yang mengajukan klaim.
 */
export async function notifyCobrokeDecision(params: {
  id_pengguna_claimer: string;
  status: "diterima" | "ditolak";
  judul_listing: string;
  catatan_agent?: string | null;
}) {
  const { id_pengguna_claimer, status, judul_listing, catatan_agent } = params;

  const tipe = status === "diterima" ? "CO_BROKE_ACCEPTED" : "CO_BROKE_REJECTED";
  const judul =
    status === "diterima" ? "Pengajuan Co-Broke Diterima!" : "Pengajuan Co-Broke Ditolak";
  let pesan =
    status === "diterima"
      ? `Pengajuan co-broke kamu untuk listing "${judul_listing}" telah diterima oleh agent pemilik.`
      : `Pengajuan co-broke kamu untuk listing "${judul_listing}" ditolak oleh agent pemilik.`;
  if (catatan_agent) pesan += ` Catatan: ${catatan_agent}`;

  const n = await prisma.notifikasi.create({
    data: {
      id_pengguna: id_pengguna_claimer,
      tipe,
      judul,
      pesan,
    },
  });

  await pusherServer
    .trigger(`notif-pengguna-${n.id_pengguna}`, "notif:new", {
      id_notifikasi: n.id_notifikasi.toString(),
      tipe: n.tipe,
      judul: n.judul,
      pesan: n.pesan,
      link: n.link,
      dibuat_pada: n.dibuat_pada.toISOString(),
    })
    .catch((e) => console.warn("pusher trigger notif:new failed:", e));
}
