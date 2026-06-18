// Normalizes raw editor input into Prisma-ready berita fields.
import { BERITA_KATEGORI, BERITA_STATUS, type BeritaStatus } from "@/lib/berita";

export type NormalizedBerita = {
  judul: string;
  ringkasan: string | null;
  isi_berita: string;
  gambar_utama: string | null;
  galeri_gambar: string | null;
  kategori: string;
  tag: string | null;
  sumber_berita: string | null;
  status_publish: BeritaStatus;
  berita_unggulan: boolean;
  berita_utama: boolean;
  tanggal_publish: Date | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toJsonArray(v: unknown): string | null {
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? JSON.stringify(arr) : null;
  }
  if (typeof v === "string" && v.trim()) {
    const arr = v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return arr.length ? JSON.stringify(arr) : null;
  }
  return null;
}

export function validateBerita(body: any): { ok: true } | { ok: false; error: string } {
  if (!str(body?.judul)) return { ok: false, error: "Judul wajib diisi." };
  if (!str(body?.isi_berita)) return { ok: false, error: "Isi berita wajib diisi." };
  return { ok: true };
}

export function normalizeBerita(body: any): NormalizedBerita {
  const kategori = BERITA_KATEGORI.includes(str(body?.kategori) as any)
    ? str(body.kategori)
    : BERITA_KATEGORI[0];

  let status = str(body?.status_publish).toUpperCase() as BeritaStatus;
  if (!BERITA_STATUS.includes(status)) status = "DRAFT";

  // tanggal_publish: explicit value wins; else set "now" the moment it goes live.
  let tanggal_publish: Date | null = null;
  if (body?.tanggal_publish) {
    const d = new Date(body.tanggal_publish);
    if (!isNaN(d.getTime())) tanggal_publish = d;
  }
  if (!tanggal_publish && (status === "PUBLISHED" || status === "SCHEDULED")) {
    tanggal_publish = new Date();
  }

  return {
    judul: str(body.judul),
    ringkasan: str(body?.ringkasan) || null,
    isi_berita: str(body.isi_berita),
    gambar_utama: str(body?.gambar_utama) || null,
    galeri_gambar: toJsonArray(body?.galeri_gambar),
    kategori,
    tag: toJsonArray(body?.tag),
    sumber_berita: str(body?.sumber_berita) || null,
    status_publish: status,
    berita_unggulan: !!body?.berita_unggulan,
    berita_utama: !!body?.berita_utama,
    tanggal_publish,
  };
}
