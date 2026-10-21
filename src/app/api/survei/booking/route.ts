import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import prisma from '@/lib/prisma';
import { pusherServer } from '@/lib/pusher-server';
import { lockSurveyAgent, ensureSurveyAvailable, SurveyBookingError } from '@/lib/chatbot/survey-booking';

class SurveyPhoneConflict extends Error {}

// POST /api/survei/booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_property, id_agent, nama_klien, nomor_telepon, tanggal_survei, catatan, id_lead } = body;

    if (!id_property || !id_agent || !nama_klien || !nomor_telepon || !tanggal_survei) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const clientName = typeof nama_klien === 'string' ? nama_klien.trim() : '';
    const phone = typeof nomor_telepon === 'string' ? normalizePhone(nomor_telepon) : '';
    if (!clientName || clientName.length > 100 || !/^\+62\d{7,12}$/.test(phone)) {
      return NextResponse.json({ error: 'Nama atau nomor telepon tidak valid' }, { status: 400 });
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

    const acaraEnd = new Date(surveiDate.getTime() + 60 * 60 * 1000);
    const keterangan = `Booking survei oleh ${clientName} (${phone})${catatan ? '. Catatan: ' + String(catatan).trim() : ''}`;
    const idLead = id_lead ? BigInt(id_lead) : null;

    // Profil, booking, dan kalender harus tersimpan bersama. Identitas akun
    // hanya berasal dari session, bukan id pengguna yang dikirim dari browser.
    const inserted = await prisma.$transaction(async (tx) => {
      await lockSurveyAgent(tx, String(id_agent));
      await ensureSurveyAvailable(tx, String(id_agent), surveiDate);
      if (idKlien) {
        const pengguna = await tx.pengguna.findUnique({
          where: { id_pengguna: idKlien },
          select: { nomor_telepon: true },
        });
        if (pengguna && !pengguna.nomor_telepon?.trim()) {
          const localDigits = phone.slice(3);
          const existingPhone = await tx.pengguna.findFirst({
            where: {
              id_pengguna: { not: idKlien },
              nomor_telepon: { in: [phone, phone.slice(1), localDigits, `0${localDigits}`] },
            },
            select: { id_pengguna: true },
          });
          if (existingPhone) throw new SurveyPhoneConflict();

          // Jangan menimpa nomor yang sudah dilengkapi dari halaman lain.
          await tx.pengguna.updateMany({
            where: { id_pengguna: idKlien, nomor_telepon: pengguna.nomor_telepon },
            data: { nomor_telepon: phone, wa_terverifikasi: false, diperbarui_pada: new Date() },
          });
        }
      }

      // Raw SQL tetap dipakai untuk kompatibilitas cache Prisma client.
      const bookings = await tx.$queryRaw<{ id_booking: bigint }[]>`
        INSERT INTO booking_survei
          (id_property, id_agent, id_klien, id_lead, nama_klien, nomor_telepon, tanggal_survei, status, catatan, tanggal_dibuat)
        VALUES
          (${BigInt(id_property)}, ${String(id_agent)}, ${idKlien}, ${idLead}, ${clientName},
           ${phone}, ${surveiDate}, 'PENDING',
           ${catatan ? String(catatan).trim() : null}, now())
        RETURNING id_booking
      `;

      // SITE_VISIT digunakan availability untuk memblokir slot survei.
      await tx.acara.create({
        data: {
          id_agent:        String(id_agent),
          id_property:     BigInt(id_property),
          judul_acara:     `Survei: ${listing.judul} (${clientName})`,
          deskripsi:       keterangan,
          tipe_acara:      'SITE_VISIT',
          tanggal_mulai:   surveiDate,
          tanggal_selesai: acaraEnd,
          status_acara:    'SCHEDULED',
        },
      });
      return bookings;
    });

    // Broadcast ke agent — bikin notif bell auto-update real-time
    pusherServer
      .trigger(`survei-agent-${String(id_agent)}`, 'survei:new', {
        id_booking:     inserted[0]?.id_booking?.toString(),
        nama_klien:     clientName,
        judul:          listing.judul,
        tanggal_survei: surveiDate.toISOString(),
      })
      .catch((e) => console.warn('pusher trigger survei:new failed:', e));

    return NextResponse.json({ success: true, message: 'Booking survei berhasil disimpan' });
  } catch (err) {
    if (err instanceof SurveyBookingError) return NextResponse.json({ error: err.code === 'SURVEY_SLOT_TAKEN' ? 'Jadwal tersebut sudah terisi. Silakan pilih jam lain.' : 'Tanggal atau jam survei tidak valid.' }, { status: err.status });
    if (err instanceof SurveyPhoneConflict || (err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Nomor telepon sudah digunakan akun lain. Gunakan nomor Anda yang belum terdaftar atau masuk dengan akun tersebut.' }, { status: 409 });
    }
    console.error('[POST /api/survei/booking]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

function normalizePhone(phone: string): string {
  if (!/^[+\d\s().-]+$/.test(phone)) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  return `+62${digits}`;
}
