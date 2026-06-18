import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";

const ok  = (data: unknown, status = 200) => NextResponse.json(data, { status });
const err = (msg: string,   status = 400) => NextResponse.json({ error: msg }, { status });

/* ─────────────────────────────────────────────────────────────
   PATCH /api/dashboard/tugas/[id]
   Update status, progress, catatan, atau field lain
───────────────────────────────────────────────────────────── */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return err("agentId tidak ditemukan di session", 400);

    const existing = await prisma.tugas.findFirst({
      where: { id_tugas: params.id, id_agent: agentId },
    });
    if (!existing) return err("Tugas tidak ditemukan", 404);

    const body = await req.json();

    const validStatus   = ["BELUM","DALAM_PROSES","SELESAI","DIBATALKAN"];
    const validPrioritas = ["TINGGI","SEDANG","RENDAH"];
    const validKategori  = ["URGENT","KONTEN","FOLLOWUP","VIEWING","PIPELINE","NETWORKING","UMUM"];

    const data: Record<string, unknown> = { diperbarui_pada: new Date() };

    if (body.status    && validStatus.includes(body.status))     data.status    = body.status;
    if (body.prioritas && validPrioritas.includes(body.prioritas)) data.prioritas = body.prioritas;
    if (body.kategori  && validKategori.includes(body.kategori))  data.kategori  = body.kategori;
    if (body.judul    !== undefined) data.judul    = body.judul?.trim() || existing.judul;
    if (body.catatan  !== undefined) data.catatan  = body.catatan?.trim() || null;
    if (body.alasan   !== undefined) data.alasan   = body.alasan?.trim()  || null;
    if (body.progress !== undefined) data.progress = Number(body.progress);
    if (body.target   !== undefined) data.target   = body.target ? Number(body.target) : null;
    if (body.jam_terjadwal  !== undefined) data.jam_terjadwal  = body.jam_terjadwal  || null;
    if (body.tanggal_selesai !== undefined)
      data.tanggal_selesai = body.tanggal_selesai ? new Date(body.tanggal_selesai) : null;
    if (body.komisi_potensial !== undefined)
      data.komisi_potensial = body.komisi_potensial ? BigInt(body.komisi_potensial) : null;

    // Catat waktu ketika benar-benar selesai
    if (data.status === "SELESAI" && existing.status !== "SELESAI") {
      data.selesai_pada = new Date();
    }
    if (data.status !== "SELESAI" && data.status !== undefined) {
      data.selesai_pada = null;
    }

    // Auto-selesai jika progress mencapai target
    if (
      data.progress !== undefined &&
      existing.target !== null &&
      Number(data.progress) >= existing.target
    ) {
      data.status       = "SELESAI";
      data.selesai_pada = new Date();
    }

    const updated = await prisma.tugas.update({
      where: { id_tugas: params.id },
      data,
      include: {
        lead:    { select: { id_lead: true, client_name: true, client_phone: true } },
        listing: { select: { id_property: true, judul: true } },
      },
    });

    return ok({
      ...updated,
      komisi_potensial: updated.komisi_potensial ? Number(updated.komisi_potensial) : null,
      id_lead:    updated.id_lead    ? Number(updated.id_lead)    : null,
      id_listing: updated.id_listing ? Number(updated.id_listing) : null,
    });
  } catch (e) {
    console.error("PATCH /api/dashboard/tugas/[id]", e);
    return err("Gagal mengupdate tugas", 500);
  }
}

/* ─────────────────────────────────────────────────────────────
   DELETE /api/dashboard/tugas/[id]
───────────────────────────────────────────────────────────── */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return err("agentId tidak ditemukan di session", 400);

    const existing = await prisma.tugas.findFirst({
      where: { id_tugas: params.id, id_agent: agentId },
    });
    if (!existing) return err("Tugas tidak ditemukan", 404);

    await prisma.tugas.delete({ where: { id_tugas: params.id } });

    return ok({ deleted: true });
  } catch (e) {
    console.error("DELETE /api/dashboard/tugas/[id]", e);
    return err("Gagal menghapus tugas", 500);
  }
}
