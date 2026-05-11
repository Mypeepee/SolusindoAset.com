import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const revalidate = 300; // Cache 5 menit

export async function GET() {
  try {
    const counts = await prisma.listing.groupBy({
      by: ['kategori'],
      where: { status_tayang: 'TERSEDIA' },
      _count: { kategori: true },
    });

    const result: Record<string, number> = {};
    for (const row of counts) {
      result[row.kategori] = row._count.kategori;
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
