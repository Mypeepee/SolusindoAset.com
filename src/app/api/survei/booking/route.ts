import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher-server';

// POST /api/survei/booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_property, id_agent, nama_klien, nomor_telepon, tanggal_survei, catatan, id_lead } = body;

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
    const idLead = id_lead ? BigInt(id_lead) : null;

    // Simpan ke booking_survei via raw SQL (Prisma client cache mungkin belum reload)
    const inserted = await prisma.$queryRaw<{ id_booking: bigint }[]>`
      INSERT INTO booking_survei
        (id_property, id_agent, id_klien, id_lead, nama_klien, nomor_telepon, tanggal_survei, status, catatan, tanggal_dibuat)
      VALUES
        (${BigInt(id_property)}, ${String(id_agent)}, ${idKlien}, ${idLead}, ${String(nama_klien).trim()},
         ${phone}, ${surveiDate}, 'PENDING',
         ${catatan ? String(catatan).trim() : null}, now())
      RETURNING id_booking
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

    // Broadcast ke agent — bikin notif bell auto-update real-time
    pusherServer
      .trigger(`survei-agent-${String(id_agent)}`, 'survei:new', {
        id_booking:     inserted[0]?.id_booking?.toString(),
        nama_klien:     String(nama_klien).trim(),
        judul:          listing.judul,
        tanggal_survei: surveiDate.toISOString(),
      })
      .catch((e) => console.warn('pusher trigger survei:new failed:', e));

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
