import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────
   /api/dashboard/acara
   Visibility rule:
     Acara hanya tampil di kalender agent kalau:
       (a) dia OWNER (acara.id_agent === currentAgentId), atau
       (b) dia di-invite (ada row di undangan_acara untuk agent ini).
     Otherwise hidden — bukan event publik global.

   Response shape:
     • Tiap acara include relasi `undangan` dengan agent + pengguna
       supaya frontend bisa nampilin chip peserta tanpa fetch tambahan.
     • Field _isOwner: boolean — hint UI buat enable/disable edit
       (untuk versi ini, hanya owner yang boleh edit/delete).
   ──────────────────────────────────────────────────────────────────── */

function serializeBigInt(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
}

async function getCurrentAgentId(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session?.user) return null;
  const fromSession = (session.user as { agentId?: string }).agentId;
  if (fromSession) return fromSession;
  // Fallback — kalau agentId belum di-pop di session, derive dari id_pengguna.
  const userId = (session.user as { id?: string }).id;
  if (!userId) return null;
  const agent = await prisma.agent.findFirst({
    where: { id_pengguna: userId },
    select: { id_agent: true },
  });
  return agent?.id_agent ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const currentAgentId = await getCurrentAgentId(session);
    if (!currentAgentId) {
      return NextResponse.json(
        { error: "Agent tidak ditemukan untuk user ini" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const where: Prisma.AcaraWhereInput = {
      // Visibility filter — owner OR diundang
      OR: [
        { id_agent: currentAgentId },
        { undangan: { some: { id_agent: currentAgentId } } },
      ],
    };

    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.tanggal_mulai = { gte: start, lte: end };
    }

    const [acara, mouTransaksi] = await Promise.all([
      prisma.acara.findMany({
        where,
        include: {
          agent: {
            select: {
              id_agent: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
          listing: {
            select: { id_property: true, judul: true, alamat_lengkap: true },
          },
          undangan: {
            select: {
              id_undangan: true,
              id_agent: true,
              status_undangan: true,
              agent: {
                select: {
                  id_agent: true,
                  foto_profil_url: true,
                  pengguna: { select: { nama_lengkap: true } },
                },
              },
            },
          },
        },
        orderBy: { tanggal_mulai: "asc" },
      }),
      year && month
        ? prisma.mou.findMany({
            where: {
              tanggal_transaksi: {
                gte: new Date(Number(year), Number(month) - 1, 1),
                lte: new Date(Number(year), Number(month), 0, 23, 59, 59),
              },
              id_agent: currentAgentId,
            },
            select: {
              id: true,
              id_transaksi: true,
              tanggal_transaksi: true,
              status: true,
              listing: {
                select: { judul: true, kota: true, alamat_lengkap: true },
              },
              agent: {
                select: {
                  id_agent: true,
                  pengguna: { select: { nama_lengkap: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    // Konversi MOU ke format event kalender
    const mouEvents = mouTransaksi.map((m) => ({
      id_acara: `MOU-${m.id}`,
      judul_acara: `Lelang: ${m.listing.judul ?? m.listing.kota ?? "Properti"}`,
      deskripsi: m.listing.alamat_lengkap ?? null,
      tipe_acara: "CLOSING",
      tanggal_mulai: m.tanggal_transaksi,
      tanggal_selesai: m.tanggal_transaksi,
      status_acara: m.status === "proses" ? "SCHEDULED" : "COMPLETED",
      lokasi: m.listing.kota ?? null,
      agent: m.agent,
      listing: {
        id_property: null,
        judul: m.listing.judul,
        alamat_lengkap: m.listing.alamat_lengkap,
      },
      undangan: [],
      _isMou: true,
      _isOwner: m.agent.id_agent === currentAgentId,
      id_mou: m.id.toString(),
      kode: m.id_transaksi,
    }));

    // Tambah hint _isOwner untuk acara real (bukan MOU)
    const acaraWithOwnership = acara.map((a) => ({
      ...a,
      _isOwner: a.id_agent === currentAgentId,
    }));

    return NextResponse.json(
      serializeBigInt([...acaraWithOwnership, ...mouEvents]),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching acara:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data acara" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !body.judul_acara ||
      !body.tipe_acara ||
      !body.tanggal_mulai ||
      !body.tanggal_selesai
    ) {
      return NextResponse.json(
        { error: "Judul, tipe acara, tanggal mulai & selesai wajib diisi." },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const agent = await prisma.agent.findFirst({
      where: { id_pengguna: session.user.id },
      select: { id_agent: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent tidak ditemukan untuk user ini." },
        { status: 404 },
      );
    }

    const tanggalMulai = new Date(body.tanggal_mulai);
    const tanggalSelesai = new Date(body.tanggal_selesai);

    if (tanggalSelesai < tanggalMulai) {
      return NextResponse.json(
        { error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." },
        { status: 400 },
      );
    }

    // Normalize peserta list: array of agent IDs, exclude owner (self),
    // dedupe, dan validasi bahwa semua agent id-nya valid.
    const rawPeserta: unknown = body.peserta_ids;
    const pesertaIds: string[] = Array.isArray(rawPeserta)
      ? Array.from(
          new Set(
            rawPeserta
              .map((x) => (typeof x === "string" ? x.trim() : ""))
              .filter((x) => x.length > 0 && x !== agent.id_agent),
          ),
        )
      : [];

    if (pesertaIds.length > 0) {
      const validAgents = await prisma.agent.findMany({
        where: { id_agent: { in: pesertaIds } },
        select: { id_agent: true },
      });
      if (validAgents.length !== pesertaIds.length) {
        return NextResponse.json(
          { error: "Sebagian peserta tidak valid atau sudah tidak aktif." },
          { status: 400 },
        );
      }
    }

    const now = new Date();

    // Create acara + undangan dalam single transaction supaya konsisten
    const acara = await prisma.$transaction(async (tx) => {
      const created = await tx.acara.create({
        data: {
          id_agent: agent.id_agent,
          id_property: body.id_property ? BigInt(body.id_property) : null,
          judul_acara: body.judul_acara.trim(),
          deskripsi: body.deskripsi || null,
          tipe_acara: body.tipe_acara,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          lokasi: body.lokasi || null,
          durasi_pilih:
            body.tipe_acara === "PEMILU" ? body.durasi_pilih || 60 : null,
          status_acara: "SCHEDULED",
          reminder_sent: false,
          tanggal_dibuat: now,
          tanggal_diupdate: now,
        },
      });

      if (pesertaIds.length > 0) {
        await tx.undanganAcara.createMany({
          data: pesertaIds.map((id) => ({
            id_acara: created.id_acara,
            id_agent: id,
          })),
          skipDuplicates: true,
        });
      }

      return tx.acara.findUnique({
        where: { id_acara: created.id_acara },
        include: {
          agent: {
            select: {
              id_agent: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
          undangan: {
            select: {
              id_undangan: true,
              id_agent: true,
              status_undangan: true,
              agent: {
                select: {
                  id_agent: true,
                  foto_profil_url: true,
                  pengguna: { select: { nama_lengkap: true } },
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: "Acara berhasil ditambahkan",
        data: serializeBigInt(acara),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Error creating acara:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Agent atau property tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Gagal menyimpan acara. Silakan coba lagi." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id_acara, peserta_ids, ...updateData } = body;

    if (!id_acara) {
      return NextResponse.json(
        { error: "ID acara wajib diisi." },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const currentAgentId = await getCurrentAgentId(session);
    if (!currentAgentId) {
      return NextResponse.json(
        { error: "Agent tidak ditemukan untuk user ini." },
        { status: 403 },
      );
    }

    const acaraId = BigInt(id_acara);

    const existing = await prisma.acara.findUnique({
      where: { id_acara: acaraId },
      select: { id_acara: true, id_agent: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan." },
        { status: 404 },
      );
    }

    // Hanya owner yang boleh edit. Peserta yang di-invite TIDAK boleh
    // edit konten acara (cuma boleh lihat).
    if (existing.id_agent !== currentAgentId) {
      return NextResponse.json(
        { error: "Hanya pembuat acara yang bisa mengedit." },
        { status: 403 },
      );
    }

    const dataToUpdate: Prisma.AcaraUpdateInput = {
      tanggal_diupdate: new Date(),
    };

    if (updateData.judul_acara)
      dataToUpdate.judul_acara = updateData.judul_acara.trim();
    if (updateData.deskripsi !== undefined)
      dataToUpdate.deskripsi = updateData.deskripsi || null;
    if (updateData.tipe_acara) dataToUpdate.tipe_acara = updateData.tipe_acara;
    if (updateData.lokasi !== undefined)
      dataToUpdate.lokasi = updateData.lokasi || null;
    if (updateData.status_acara)
      dataToUpdate.status_acara = updateData.status_acara;
    if (updateData.tanggal_mulai)
      dataToUpdate.tanggal_mulai = new Date(updateData.tanggal_mulai);
    if (updateData.tanggal_selesai)
      dataToUpdate.tanggal_selesai = new Date(updateData.tanggal_selesai);
    if (updateData.durasi_pilih !== undefined)
      dataToUpdate.durasi_pilih = updateData.durasi_pilih;
    if (updateData.id_property !== undefined) {
      dataToUpdate.listing = updateData.id_property
        ? { connect: { id_property: BigInt(updateData.id_property) } }
        : { disconnect: true };
    }

    // Normalize peserta_ids — kalau dikirim, replace seluruh list undangan.
    let nextPesertaIds: string[] | null = null;
    if (Array.isArray(peserta_ids)) {
      nextPesertaIds = Array.from(
        new Set(
          peserta_ids
            .map((x: unknown) => (typeof x === "string" ? x.trim() : ""))
            .filter((x) => x.length > 0 && x !== currentAgentId),
        ),
      );
      if (nextPesertaIds.length > 0) {
        const validAgents = await prisma.agent.findMany({
          where: { id_agent: { in: nextPesertaIds } },
          select: { id_agent: true },
        });
        if (validAgents.length !== nextPesertaIds.length) {
          return NextResponse.json(
            { error: "Sebagian peserta tidak valid atau sudah tidak aktif." },
            { status: 400 },
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.acara.update({
        where: { id_acara: acaraId },
        data: dataToUpdate,
      });

      // Hanya replace undangan kalau client mengirim peserta_ids
      // (omit = jangan ubah, [] = kosongin semua undangan).
      if (nextPesertaIds !== null) {
        await tx.undanganAcara.deleteMany({
          where: { id_acara: acaraId },
        });
        if (nextPesertaIds.length > 0) {
          await tx.undanganAcara.createMany({
            data: nextPesertaIds.map((id) => ({
              id_acara: acaraId,
              id_agent: id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.acara.findUnique({
        where: { id_acara: acaraId },
        include: {
          agent: {
            select: {
              id_agent: true,
              pengguna: { select: { nama_lengkap: true } },
            },
          },
          undangan: {
            select: {
              id_undangan: true,
              id_agent: true,
              status_undangan: true,
              agent: {
                select: {
                  id_agent: true,
                  foto_profil_url: true,
                  pengguna: { select: { nama_lengkap: true } },
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: "Acara berhasil diperbarui",
        data: serializeBigInt(updated),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error updating acara:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui acara." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID acara wajib diisi." },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const currentAgentId = await getCurrentAgentId(session);
    const acaraId = BigInt(id);

    const existing = await prisma.acara.findUnique({
      where: { id_acara: acaraId },
      select: { id_agent: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Acara tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.id_agent !== currentAgentId) {
      return NextResponse.json(
        { error: "Hanya pembuat acara yang bisa menghapus." },
        { status: 403 },
      );
    }

    // Cascade DELETE di FK undangan_acara_acara_fk akan otomatis ngapus
    // semua undangan terkait.
    await prisma.acara.delete({
      where: { id_acara: acaraId },
    });

    return NextResponse.json(
      { message: "Acara berhasil dihapus" },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error deleting acara:", error);
    return NextResponse.json(
      { error: "Gagal menghapus acara." },
      { status: 500 },
    );
  }
}
