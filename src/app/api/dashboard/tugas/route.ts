import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

const ok  = (data: unknown, status = 200) => NextResponse.json(data, { status });
const err = (msg: string,   status = 400) => NextResponse.json({ error: msg }, { status });

/* ─────────────────────────────────────────────────────────────
   GET  /api/dashboard/tugas
   Query: tanggal (YYYY-MM-DD), status, kategori
───────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return err("agentId tidak ditemukan di session", 400);

    const { searchParams } = new URL(req.url);
    const tanggal  = searchParams.get("tanggal");   // YYYY-MM-DD
    const status   = searchParams.get("status");
    const kategori = searchParams.get("kategori");

    const where: Record<string, unknown> = { id_agent: agentId };

    if (status)   where.status   = status;
    if (kategori) where.kategori = kategori;

    if (tanggal) {
      const start = new Date(`${tanggal}T00:00:00.000Z`);
      const end   = new Date(`${tanggal}T23:59:59.999Z`);
      where.OR = [
        { tanggal_selesai: { gte: start, lte: end } },
        { tanggal_mulai:   { lte: end }, tanggal_selesai: null },
        { tanggal_mulai:   null,         tanggal_selesai: null },
      ];
    }

    const tugas = await prisma.tugas.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { prioritas: "asc" },
        { tanggal_selesai: "asc" },
        { dibuat_pada: "desc" },
      ],
      include: {
        lead:     { select: { id_lead: true, client_name: true, client_phone: true } },
        listing:  { select: { id_property: true, judul: true } },
        transaksi: { select: { id_transaksi: true } },
      },
    });

    return ok(
      tugas.map((t) => ({
        ...t,
        komisi_potensial: t.komisi_potensial ? Number(t.komisi_potensial) : null,
        id_lead:    t.id_lead    ? Number(t.id_lead)    : null,
        id_listing: t.id_listing ? Number(t.id_listing) : null,
        lead:    t.lead    ? { ...t.lead, id_lead: Number(t.lead.id_lead) } : null,
        listing: t.listing ? { ...t.listing, id_property: Number(t.listing.id_property) } : null,
      }))
    );
  } catch (e) {
    console.error("GET /api/dashboard/tugas", e);
    return err("Gagal memuat tugas", 500);
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/dashboard/tugas
   Body: judul, kategori, prioritas?, catatan?, alasan?,
         tanggal_selesai?, jam_terjadwal?, target?,
         komisi_potensial?, id_lead?, id_listing?, id_transaksi?
───────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) return err("agentId tidak ditemukan di session", 400);

    const body = await req.json();
    if (!body.judul?.trim()) return err("Judul tugas wajib diisi");

    const validKategori = ["URGENT","KONTEN","FOLLOWUP","VIEWING","PIPELINE","NETWORKING","UMUM"];
    const validPrioritas = ["TINGGI","SEDANG","RENDAH"];

    const kategori  = validKategori.includes(body.kategori)  ? body.kategori  : "UMUM";
    const prioritas = validPrioritas.includes(body.prioritas) ? body.prioritas : "SEDANG";

    const tugas = await prisma.tugas.create({
      data: {
        id_tugas:         randomUUID(),
        id_agent:         agentId,
        judul:            body.judul.trim(),
        kategori,
        prioritas,
        catatan:          body.catatan?.trim()  || null,
        alasan:           body.alasan?.trim()   || null,
        jam_terjadwal:    body.jam_terjadwal    || null,
        target:           body.target ? Number(body.target) : null,
        komisi_potensial: body.komisi_potensial ? BigInt(body.komisi_potensial) : null,
        tanggal_mulai:    body.tanggal_mulai    ? new Date(body.tanggal_mulai)  : null,
        tanggal_selesai:  body.tanggal_selesai  ? new Date(body.tanggal_selesai) : null,
        id_lead:          body.id_lead    ? BigInt(body.id_lead)    : null,
        id_listing:       body.id_listing ? BigInt(body.id_listing) : null,
        id_transaksi:     body.id_transaksi || null,
      },
      include: {
        lead:    { select: { id_lead: true, client_name: true, client_phone: true } },
        listing: { select: { id_property: true, judul: true } },
      },
    });

    return ok({
      ...tugas,
      komisi_potensial: tugas.komisi_potensial ? Number(tugas.komisi_potensial) : null,
      id_lead:    tugas.id_lead    ? Number(tugas.id_lead)    : null,
      id_listing: tugas.id_listing ? Number(tugas.id_listing) : null,
    }, 201);
  } catch (e) {
    console.error("POST /api/dashboard/tugas", e);
    return err("Gagal membuat tugas", 500);
  }
}
