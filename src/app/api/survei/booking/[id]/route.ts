import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

// PATCH /api/survei/booking/[id] — agent acc/tolak booking survei
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const agentId = (session?.user as any)?.agentId as string | null | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const status = body.status as string;
    if (!['CONFIRMED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Status tidak valid' }, { status: 400 });
    }

    const idBooking = BigInt(params.id);

    const existing = await prisma.$queryRaw<any[]>`
      SELECT id_booking, id_property, id_agent, id_lead, nama_klien, tanggal_survei
      FROM booking_survei
      WHERE id_booking = ${idBooking} AND id_agent = ${agentId}
    `;
    if (existing.length === 0) {
      return NextResponse.json({ ok: false, error: 'Booking tidak ditemukan' }, { status: 404 });
    }
    const booking = existing[0];

    await prisma.$executeRaw`
      UPDATE booking_survei SET status = ${status} WHERE id_booking = ${idBooking}
    `;

    // Jika ditolak, batalkan juga Acara SITE_VISIT terkait
    if (status === 'CANCELLED') {
      await prisma.acara.updateMany({
        where: {
          id_agent:      agentId,
          id_property:   BigInt(booking.id_property),
          tipe_acara:    'SITE_VISIT',
          tanggal_mulai: new Date(booking.tanggal_survei),
          status_acara:  'SCHEDULED',
        },
        data: { status_acara: 'CANCELLED' },
      });
    }

    // Khusus lead "survei": selama booking masih PENDING, lead tetap "new"
    // (auto-promote ke "contacted" di LeadDetailSheet dilewati untuk source survei).
    // Begitu agent "Terima" jadwalnya, baru dianggap sudah dikontak.
    // "Tolak" → lead dianggap dingin (cold), kecuali sudah ada progres lanjutan.
    if (booking.id_lead) {
      const lead = await prisma.lead.findUnique({
        where: { id_lead: BigInt(booking.id_lead) },
        select: { status: true },
      });
      let nextStatus: string | undefined;
      if (status === 'CONFIRMED' && lead?.status === 'new') {
        nextStatus = 'contacted';
      } else if (status === 'CANCELLED' && (lead?.status === 'new' || lead?.status === 'contacted')) {
        nextStatus = 'cold';
      }

      await prisma.lead
        .update({
          where: { id_lead: BigInt(booking.id_lead) },
          data: {
            ...(nextStatus ? { status: nextStatus as any } : {}),
            last_activity: new Date(),
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('❌ /api/survei/booking/[id] PATCH error:', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
