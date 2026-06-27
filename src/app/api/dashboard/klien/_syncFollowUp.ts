import { prisma } from "@/lib/prisma";

/**
 * Sinkronkan tanggal_follow_up klien ke tabel acara.
 * - Jika tanggalFollowUp diisi → buat atau update acara tipe FOLLOW_UP yang terhubung ke klien ini.
 * - Jika tanggalFollowUp null → hapus acara FOLLOW_UP milik klien ini (jika ada).
 * Dipanggil setelah setiap POST/PATCH klien yang menyentuh tanggal_follow_up.
 */
export async function syncFollowUpAcara(
  agentId: string,
  klienId: string,
  klienNama: string,
  tanggalFollowUp: Date | null,
) {
  const existing = await prisma.acara.findFirst({
    where: { id_klien_ref: klienId, tipe_acara: "FOLLOW_UP" },
    select: { id_acara: true },
  });

  if (!tanggalFollowUp) {
    if (existing) {
      await prisma.acara.delete({ where: { id_acara: existing.id_acara } });
    }
    return;
  }

  const selesai = new Date(tanggalFollowUp.getTime() + 60 * 60 * 1000); // +1 jam
  const now = new Date();
  const status = tanggalFollowUp > now ? "SCHEDULED" : "COMPLETED";

  if (existing) {
    await prisma.acara.update({
      where: { id_acara: existing.id_acara },
      data: {
        judul_acara: `Follow Up: ${klienNama}`,
        tanggal_mulai: tanggalFollowUp,
        tanggal_selesai: selesai,
        status_acara: status,
        tanggal_diupdate: now,
      },
    });
  } else {
    await prisma.acara.create({
      data: {
        id_agent: agentId,
        id_klien_ref: klienId,
        judul_acara: `Follow Up: ${klienNama}`,
        tipe_acara: "FOLLOW_UP",
        tanggal_mulai: tanggalFollowUp,
        tanggal_selesai: selesai,
        status_acara: status,
        reminder_sent: false,
        tanggal_dibuat: now,
        tanggal_diupdate: now,
      },
    });
  }
}
