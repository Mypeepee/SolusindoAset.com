import { beritaPermissions } from "@/lib/beritaPermissions";
import type { BeritaStatus } from "@/lib/beritaUi";

export function editorialWriteError(
  position: string,
  body: Record<string, unknown>,
  existing?: {
    status_publish: BeritaStatus;
    berita_utama: boolean;
    berita_unggulan: boolean;
  },
): string | null {
  const permissions = beritaPermissions(position);
  if (!permissions.canEdit) return "Anda tidak memiliki akses redaksi.";
  if (permissions.canPublish) return null;
  if (existing && existing.status_publish !== "DRAFT") {
    return "Simpan revisi sebagai draf baru untuk ditinjau Owner.";
  }
  if (body.status_publish && body.status_publish !== "DRAFT") {
    return "Hanya Owner yang dapat menerbitkan, menjadwalkan, atau mengarsipkan berita.";
  }
  if (body.berita_utama || body.berita_unggulan) {
    return "Hanya Owner yang dapat memilih headline dan artikel unggulan.";
  }
  if (
    existing &&
    (("berita_utama" in body && body.berita_utama !== existing.berita_utama) ||
      ("berita_unggulan" in body &&
        body.berita_unggulan !== existing.berita_unggulan))
  ) {
    return "Hanya Owner yang dapat mengubah pilihan headline dan artikel unggulan.";
  }
  return null;
}

export function scheduleError(body: Record<string, unknown>): string | null {
  const requested =
    body.status_publish === "SCHEDULED"
      ? body.tanggal_publish
      : body.submit_review === true
        ? body.requested_publish_at
        : null;
  if (body.status_publish !== "SCHEDULED" && !requested) return null;
  if (
    typeof requested !== "string" ||
    !requested ||
    !Number.isFinite(Date.parse(requested)) ||
    Date.parse(requested) <= Date.now()
  ) {
    return "Pilih waktu penayangan yang valid di masa mendatang.";
  }
  return null;
}
