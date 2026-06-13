import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Slot waktu baku (jam lokal WIB)
export const TIME_SLOTS = [
  { label: '08:00', hour: 8 },
  { label: '09:00', hour: 9 },
  { label: '10:00', hour: 10 },
  { label: '11:00', hour: 11 },
  { label: '13:00', hour: 13 },
  { label: '14:00', hour: 14 },
  { label: '15:00', hour: 15 },
  { label: '16:00', hour: 16 },
  { label: '17:00', hour: 17 },
];

// GET /api/survei/availability?agentId=xxx&date=2026-06-13
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agentId = searchParams.get('agentId');
  const date    = searchParams.get('date'); // YYYY-MM-DD (WIB / UTC+7)

  if (!agentId || !date) {
    return NextResponse.json({ error: 'agentId and date required' }, { status: 400 });
  }

  // Rentang hari itu dalam UTC (WIB = UTC+7, jadi 00:00 WIB = 17:00 UTC sehari sebelumnya)
  const [year, month, day] = date.split('-').map(Number);
  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 3600 * 1000); // 17:00 UTC (D-1)
  const endOfDayUTC   = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 3600 * 1000 + 86400 * 1000); // 17:00 UTC (D)

  // Ambil semua acara agent yang overlap dengan hari tersebut
  // (booking survei juga sudah dibuatkan entry Acara SITE_VISIT saat POST)
  const busyAcara = await prisma.acara.findMany({
    where: {
      id_agent: agentId,
      tanggal_mulai:   { lt: endOfDayUTC },
      tanggal_selesai: { gt: startOfDayUTC },
    },
    select: { tanggal_mulai: true, tanggal_selesai: true },
  });

  console.log('[availability] agentId:', agentId, '| date:', date, '| busyAcara:', JSON.stringify(busyAcara));

  const blockedSlots = TIME_SLOTS.map((slot) => {
    // Konversi slot WIB → UTC (WIB = UTC+7)
    const slotStart = new Date(Date.UTC(year, month - 1, day, slot.hour - 7, 0, 0));
    const slotEnd   = new Date(Date.UTC(year, month - 1, day, slot.hour - 7 + 1, 0, 0));

    const blocked = busyAcara.some(
      (a) => a.tanggal_mulai < slotEnd && a.tanggal_selesai > slotStart,
    );

    return { label: slot.label, hour: slot.hour, blocked };
  });

  console.log('[availability] blockedSlots:', JSON.stringify(blockedSlots));
  return NextResponse.json({ date, blockedSlots });
}
