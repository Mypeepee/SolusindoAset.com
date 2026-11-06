import { NextResponse } from "next/server";
import { googleDrive } from "@/lib/server/googleDrive";
import { status_agent_enum } from "@prisma/client";
import prisma from "@/lib/prisma";
import { notifyNewAgentRegistration } from "@/lib/notifications";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/* ---------------- Utils ---------------- */

function jsonError(message: string, status = 400, extra?: any) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

function slugify(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeAgentCode(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) return `AG${s.replace(/^0+/, "") || "0"}`;
  const m = s.toUpperCase().match(/^AG\s*0*(\d+)$/);
  if (m) return `AG${m[1]}`;
  return s.toUpperCase();
}

function normalizePhoneE164Id(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return `+62${digits}`;
}

async function fileToBuffer(file: File) {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

async function compressImageIfPossible(
  buf: Buffer,
  mime: string,
  opts: { maxWidth: number; quality: number }
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  try {
    const sharpMod: any = await import("sharp");
    const sharp = sharpMod.default ?? sharpMod;

    const out = await sharp(buf)
      .rotate()
      .resize({ width: opts.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer();

    return { buffer: out, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    const ext =
      mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    return { buffer: buf, contentType: mime || "application/octet-stream", ext };
  }
}

/* Drive selection, quota, OAuth refresh and folders live in the shared pool. */
// ✅ untuk response/preview saja (DB tidak simpan url)
function publicDriveUrlFromId(fileId: string) {
  return `https://drive.google.com/uc?id=${fileId}`;
}

/* ---------------- Route ---------------- */

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return jsonError("Silakan masuk untuk mengunggah dokumen pendaftaran.", 401);
  try {
    const fd = await req.formData();

    const id_pengguna = String(fd.get("id_pengguna") || "").trim();
    if (id_pengguna !== session.user.id) return jsonError("Dokumen hanya dapat diunggah untuk akun sendiri.", 403);
    const nama_lengkap = String(fd.get("nama_lengkap") || "").trim();
    const email = String(fd.get("email") || "").trim() || null;

    const nomor_whatsapp_raw = String(fd.get("nomor_whatsapp") || "").trim();
    const nomor_whatsapp = normalizePhoneE164Id(nomor_whatsapp_raw);

    const nama_kantor_input = String(fd.get("nama_kantor") || "").trim();
    const kota_area = String(fd.get("kota_area") || "").trim();

    const link_instagram = String(fd.get("link_instagram") || "").trim() || null;
    const link_tiktok = String(fd.get("link_tiktok") || "").trim() || null;
    const link_facebook = String(fd.get("link_facebook") || "").trim() || null;

    const kode_referral_upline_raw = String(fd.get("kode_referral_upline") || "").trim();
    const kode_referral_upline = normalizeAgentCode(kode_referral_upline_raw) || null;

    const foto_ktp = fd.get("foto_ktp") as File | null;
    const foto_npwp = fd.get("foto_npwp") as File | null;
    const foto_profil = fd.get("foto_profil") as File | null;

    // basic validate
    if (!id_pengguna) return jsonError("id_pengguna wajib.");
    if (!nama_lengkap) return jsonError("nama_lengkap wajib.");
    if (!email) return jsonError("email wajib.");
    if (!kota_area) return jsonError("kota_area wajib.");
    if (!nomor_whatsapp || nomor_whatsapp === "+62") return jsonError("nomor_whatsapp wajib.");

    // Pastikan pengguna ada + ambil nomor_telepon sekarang
    const pengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna },
      select: { id_pengguna: true, nomor_telepon: true },
    });
    if (!pengguna) return jsonError("Pengguna tidak ditemukan.", 404);

    // ✅ Cek dokumen yang sudah pernah diupload sebelumnya (kalau reapply).
    // File yang sudah ada dipertahankan kecuali pengguna mengganti dengan file baru.
    const existingAgentFiles = await prisma.agent.findUnique({
      where: { id_pengguna },
      select: { foto_ktp_url: true, foto_npwp_url: true, foto_profil_url: true },
    });

    if (!foto_ktp && !existingAgentFiles?.foto_ktp_url) return jsonError("foto_ktp wajib.");
    if (!foto_profil && !existingAgentFiles?.foto_profil_url) return jsonError("foto_profil wajib.");

    // ✅ Isi nomor_telepon di tabel pengguna hanya kalau masih kosong
    if (!pengguna.nomor_telepon || pengguna.nomor_telepon.trim() === "") {
      await prisma.pengguna.update({
        where: { id_pengguna },
        data: {
          nomor_telepon: nomor_whatsapp,
          diperbarui_pada: new Date(),
        },
      });
    }

    // referral lookup: harus AKTIF
    let id_upline: string | null = null;
    let nama_kantor_final = nama_kantor_input;

    if (kode_referral_upline) {
      const upline = await prisma.agent.findUnique({
        where: { id_agent: kode_referral_upline },
        select: { id_agent: true, status_keanggotaan: true, nama_kantor: true },
      });

      if (!upline) return jsonError("Kode referral tidak ditemukan.");
      if (upline.status_keanggotaan !== status_agent_enum.AKTIF) {
        return jsonError("Kode referral tidak valid: Agent belum AKTIF.");
      }

      id_upline = upline.id_agent;
      nama_kantor_final = upline.nama_kantor; // enforce kantor ikut upline
    }

    if (!nama_kantor_final) return jsonError("nama_kantor wajib.");

    // ✅ default: pertahankan fileId dokumen lama (kalau reapply & tidak diganti)
    let ktpFileId = existingAgentFiles?.foto_ktp_url ?? null;
    let npwpFileId = existingAgentFiles?.foto_npwp_url ?? null;
    let profilFileId = existingAgentFiles?.foto_profil_url ?? null;

    // fileId dokumen lama yang akan dihapus dari Drive setelah upsert sukses
    // (hanya terisi kalau ada penggantian file)
    const oldFileIdsToDelete: string[] = [];


    const hasNewFiles = Boolean(foto_ktp || foto_npwp || foto_profil);

    if (hasNewFiles) {
      const folderName = slugify(nama_lengkap) || `user_${id_pengguna}`;

      // ✅ upload helper: return fileId saja (yang disimpan ke DB)
      async function uploadOne(file: File, prefix: string, compressProfile = false) {
        const raw = await fileToBuffer(file);

        const { buffer, contentType, ext } = await compressImageIfPossible(
          raw,
          file.type || "image/jpeg",
          compressProfile ? { maxWidth: 1600, quality: 75 } : { maxWidth: 2000, quality: 80 }
        );

        const filename = `${prefix}_${crypto.randomUUID()}.${ext}`;

        const { fileId } = await googleDrive.upload({ buffer, name: filename, mimeType: contentType,
          purpose: "agents", folders: [folderName], publicRead: true });

        return { fileId }; // ✅ hanya fileId
      }

      if (foto_ktp) {
        const up = await uploadOne(foto_ktp, "ktp", false);
        if (ktpFileId) oldFileIdsToDelete.push(ktpFileId);
        ktpFileId = up.fileId;
      }
      if (foto_npwp) {
        const up = await uploadOne(foto_npwp, "npwp", false);
        if (npwpFileId) oldFileIdsToDelete.push(npwpFileId);
        npwpFileId = up.fileId;
      }
      if (foto_profil) {
        const up = await uploadOne(foto_profil, "profil", true);
        if (profilFileId) oldFileIdsToDelete.push(profilFileId);
        profilFileId = up.fileId;
      }
    }

    // Upsert Agent by id_pengguna
    // ✅ SIMPAN FILE ID ke kolom foto_ktp_url / foto_npwp_url / foto_profil_url (meski namanya url)
    const agent = await prisma.agent.upsert({
      where: { id_pengguna },
      create: {
        id_pengguna,
        nama_kantor: nama_kantor_final,
        kota_area,
        nomor_whatsapp,
        id_upline,

        foto_ktp_url: ktpFileId, // ✅ fileId saja
        foto_npwp_url: npwpFileId, // ✅ fileId saja
        foto_profil_url: profilFileId, // ✅ fileId saja

        link_instagram,
        link_tiktok,
        link_facebook,
        status_keanggotaan: status_agent_enum.PENDING,
      },
      update: {
        nama_kantor: nama_kantor_final,
        kota_area,
        nomor_whatsapp,
        id_upline,

        foto_ktp_url: ktpFileId, // ✅ fileId saja (lama dipertahankan kalau tidak diganti)
        foto_npwp_url: npwpFileId, // ✅ fileId saja
        foto_profil_url: profilFileId, // ✅ fileId saja

        link_instagram,
        link_tiktok,
        link_facebook,
        status_keanggotaan: status_agent_enum.PENDING,
        diperbarui_pada: new Date(),
      },
      select: {
        id_agent: true,
        status_keanggotaan: true,
        nama_kantor: true,
        kota_area: true,
        foto_ktp_url: true,
        foto_npwp_url: true,
        foto_profil_url: true,
      },
    });

    // ✅ Bersihkan dokumen lama di Google Drive yang sudah diganti (best-effort,
    // tidak boleh sampai menggagalkan response karena data DB sudah tersimpan).
    if (oldFileIdsToDelete.length) {
      await Promise.all(
        oldFileIdsToDelete.map((fileId) =>
          googleDrive.deleteFile(fileId).catch((e) =>
            console.warn(`Gagal menghapus file lama di Drive (${fileId}):`, e)
          )
        )
      );
    }

    // Kirim notifikasi "agent baru bergabung" ke principal/owner & upline —
    // dedup berdasarkan id_agent_ref dilakukan di dalam helper-nya.
    notifyNewAgentRegistration({
      id_agent: agent.id_agent,
      nama_lengkap,
      id_upline,
    }).catch((e) => console.warn("notifyNewAgentRegistration failed:", e));

    // ✅ kalau frontend butuh preview url, kirim derived_url di response saja
    return NextResponse.json({
      ok: true,
      message: "Pendaftaran agen berhasil. Menunggu verifikasi (PENDING).",
      agent,
      derived_urls: {
        foto_ktp_url: agent.foto_ktp_url ? publicDriveUrlFromId(agent.foto_ktp_url) : null,
        foto_npwp_url: agent.foto_npwp_url ? publicDriveUrlFromId(agent.foto_npwp_url) : null,
        foto_profil_url: agent.foto_profil_url ? publicDriveUrlFromId(agent.foto_profil_url) : null,
      },
    });
  } catch (err: any) {
    console.error("daftar-agent error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
