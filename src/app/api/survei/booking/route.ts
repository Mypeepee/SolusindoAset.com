import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

// POST /api/survei/booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_property, id_agent, nama_klien, nomor_telepon, tanggal_survei, catatan } = body;

    if (!id_property || !id_agent || !nama_klien || !nomor_telepon || !tanggal_survei) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const surveiDate = new Date(tanggal_survei);
    if (isNaN(surveiDate.getTime())) {
      return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
    }

    // Verifikasi listing ada
    const listing = await prisma.listing.findUnique({
      where: { id_property: BigInt(id_property) },
      select: { id_property: true, judul: true },
    });
    if (!listing) return NextResponse.json({ error: 'Listing tidak ditemukan' }, { status: 404 });

    // Verifikasi agent ada
    const agent = await prisma.agent.findUnique({
      where: { id_agent: String(id_agent) },
      select: { id_agent: true },
    });
    if (!agent) return NextResponse.json({ error: 'Agent tidak ditemukan' }, { status: 404 });

    // Simpan id_pengguna jika user sudah login
    let idKlien: string | null = null;
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      idKlien = String(session.user.id);
    }

    const phone    = normalizePhone(String(nomor_telepon));
    const acaraEnd = new Date(surveiDate.getTime() + 60 * 60 * 1000);
    const keterangan = `Booking survei oleh ${String(nama_klien).trim()} (${phone})${catatan ? '. Catatan: ' + String(catatan).trim() : ''}`;

    // Simpan ke booking_survei via raw SQL (Prisma client cache mungkin belum reload)
    await prisma.$executeRaw`
      INSERT INTO booking_survei
        (id_property, id_agent, id_klien, nama_klien, nomor_telepon, tanggal_survei, status, catatan, tanggal_dibuat)
      VALUES
        (${BigInt(id_property)}, ${String(id_agent)}, ${idKlien}, ${String(nama_klien).trim()},
         ${phone}, ${surveiDate}, 'PENDING',
         ${catatan ? String(catatan).trim() : null}, now())
    `;

    // Buat Acara SITE_VISIT → digunakan oleh /api/survei/availability untuk blok slot
    await prisma.acara.create({
      data: {
        id_agent:        String(id_agent),
        id_property:     BigInt(id_property),
        judul_acara:     `Survei: ${listing.judul} (${String(nama_klien).trim()})`,
        deskripsi:       keterangan,
        tipe_acara:      'SITE_VISIT',
        tanggal_mulai:   surveiDate,
        tanggal_selesai: acaraEnd,
        status_acara:    'SCHEDULED',
      },
    });

    return NextResponse.json({ success: true, message: 'Booking survei berhasil disimpan' });
  } catch (err) {
    console.error('[POST /api/survei/booking]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

function normalizePhone(phone: string): string {
  const p = phone.trim().replace(/\s+/g, '');
  if (p.startsWith('+62')) return p;
  if (p.startsWith('62'))  return '+' + p;
  if (p.startsWith('0'))   return '+62' + p.slice(1);
  return p;
}
