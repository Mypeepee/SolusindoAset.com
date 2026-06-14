import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";
import { jabatan_agent_enum, status_agent_enum } from "@prisma/client";

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
