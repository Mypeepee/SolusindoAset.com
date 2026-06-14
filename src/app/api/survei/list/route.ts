import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/survei/list?status=ALL|PENDING|CONFIRMED|CANCELLED — semua booking survei milik agent
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const status = (req.nextUrl.searchParams.get('status') || 'ALL').toUpperCase();
    const validStatuses = ['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ ok: false, error: 'Status tidak valid' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT b.id_booking, b.id_property, b.nama_klien, b.nomor_telepon,
             b.tanggal_survei, b.status, b.catatan, b.tanggal_dibuat,
             l.judul, l.slug
      FROM booking_survei b
      JOIN listing l ON l.id_property = b.id_property
      WHERE b.id_agent = ${agentId}
        AND (${status} = 'ALL' OR b.status = ${status})
      ORDER BY b.tanggal_survei DESC
      LIMIT 100
    `;

    const items = rows.map((r) => ({
      id_booking:     r.id_booking.toString(),
      id_property:    r.id_property.toString(),
      judul:          r.judul,
      slug:           r.slug,
      nama_klien:     r.nama_klien,
      nomor_telepon:  r.nomor_telepon,
      tanggal_survei: new Date(r.tanggal_survei).toISOString(),
      status:         r.status,
      catatan:        r.catatan,
      tanggal_dibuat: new Date(r.tanggal_dibuat).toISOString(),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error('❌ /api/survei/list error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
