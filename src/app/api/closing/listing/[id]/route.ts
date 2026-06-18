import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { status_mou_enum } from "@prisma/client";
import { jsonSafeNumber } from "@/lib/jsonSafeNumber";

function splitImages(gambar: any): string[] {
  const raw = (gambar ?? "").toString();
  return raw.split(",").map((x: string) => x.trim()).filter(Boolean);
}

function firstImage(gambar: any): string {
  return splitImages(gambar)[0] || "/placeholder.jpg";
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && typeof (v as any).toString === "function")
    return Number((v as any).toString());
  return Number(v) || 0;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const raw = decodeURIComponent(params.id);

  try {
    const isNumericId = /^\d+$/.test(raw);

    const listing = await prisma.listing.findFirst({
      where: isNumericId ? { id_property: BigInt(raw) } : { slug: raw },
      include: {
        agent: { include: { pengguna: true } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, message: "listing_not_found" },
        { status: 404 }
      );
    }

    // Team Leader
    let leader = null as any;
    const tlId = (listing.agent as any)?.id_team_leader;
    if (tlId) {
      leader = await prisma.agent.findUnique({
        where: { id_agent: tlId },
        include: { pengguna: true },
      });
    }

    // MOU aktif (bukan kalah/batal)
    const mouAktif = await prisma.mou.findFirst({
      where: {
        id_listing: listing.id_property,
        status: { notIn: [status_mou_enum.kalah, status_mou_enum.batal] },
      },
      orderBy: { dibuat_pada: "desc" },
      select: {
        id: true,
        id_transaksi: true,
        id_agent: true,
        status: true,
        mou_generated: true,
        invoice_utm_generated: true,
        // prefill finansial
        tipe_komisi: true,
        harga_deal: true,
        harga_limit: true,
        maksimum_bidding: true,
        persentase_komisi: true,
        biaya_baliknama: true,
        biaya_pengosongan: true,
        termasuk_baliknama: true,
        termasuk_pengosongan: true,
        // prefill klien
        id_klien: true,
        nama_lengkap_klien: true,
        nik_klien: true,
        alamat_klien: true,
        // agent luar
        agent_luar_nama: true,
        agent_luar_kantor: true,
        agent_luar_telepon: true,
      },
    });

    // Ambil data transaksi jika ada
    let trxPrefill: any = null;
    if (mouAktif?.id_transaksi) {
      const trx = await prisma.transaksi.findUnique({
        where: { id_transaksi: mouAktif.id_transaksi },
        select: {
          harga_bidding: true,
          biaya_baliknama: true,
          biaya_pengosongan: true,
          cobroke_fee: true,
          pendapatan_bersih_kantor: true,
          thc_agent: true,
        },
      }).catch(() => null);
      if (trx) {
        trxPrefill = {
          hargaBidding: toNum(trx.harga_bidding),
          biayaBaliknama: toNum(trx.biaya_baliknama),
          biayaPengosongan: toNum(trx.biaya_pengosongan),
          cobrokeFee: toNum(trx.cobroke_fee),
          pendapatanBersih: toNum(trx.pendapatan_bersih_kantor),
          thcAgent: toNum(trx.thc_agent),
        };
      }
    }

    const gambarList = splitImages((listing as any).gambar);
    const imageUrl   = firstImage((listing as any).gambar);
    const agentNama  =
      (listing.agent as any)?.pengguna?.nama_lengkap ??
      (listing.agent as any)?.nama_kantor ??
      "-";

    return NextResponse.json(
      jsonSafeNumber({
        ok: true,
        data: {
          listing: { ...listing, imageUrl, gambar_list: gambarList, agent_nama: agentNama },
          agent: listing.agent ?? null,
          leader,
          mou: mouAktif
            ? {
                id: mouAktif.id.toString(),
                kode: mouAktif.id_transaksi,
                status: mouAktif.status,
                mou_generated: mouAktif.mou_generated,
                invoice_utm_generated: mouAktif.invoice_utm_generated,
                idAgent: mouAktif.id_agent,
                // prefill finansial
                tipeKomisi: mouAktif.tipe_komisi,
                hargaDeal: toNum(mouAktif.harga_deal),
                hargaLimit: toNum(mouAktif.harga_limit),
                maksimumBidding: toNum(mouAktif.maksimum_bidding),
                persentaseKomisi: toNum(mouAktif.persentase_komisi),
                biayaBaliknama: toNum(mouAktif.biaya_baliknama),
                biayaPengosongan: toNum(mouAktif.biaya_pengosongan),
                termasukBaliknama: mouAktif.termasuk_baliknama,
                termasukPengosongan: mouAktif.termasuk_pengosongan,
                // prefill klien
                idKlien: mouAktif.id_klien?.toString() ?? null,
                namaKlien: mouAktif.nama_lengkap_klien ?? null,
                nikKlien: mouAktif.nik_klien ?? null,
                alamatKlien: mouAktif.alamat_klien ?? null,
                // agent luar
                agentLuarNama: mouAktif.agent_luar_nama ?? null,
                agentLuarKantor: mouAktif.agent_luar_kantor ?? null,
                agentLuarTelepon: mouAktif.agent_luar_telepon ?? null,
                // transaksi existing
                trx: trxPrefill,
              }
            : null,
        },
      })
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}

/* PATCH — update tanggal_lelang saja.
   Body: { tanggal_lelang: string | null }  (ISO date) */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 }
    );
  }

  const raw = decodeURIComponent(params.id);
  const body = await req.json().catch(() => null);

  if (!body || (body.tanggal_lelang !== null && typeof body.tanggal_lelang !== "string")) {
    return NextResponse.json(
      { ok: false, message: "tanggal_lelang wajib (string ISO atau null)" },
      { status: 400 }
    );
  }

  let newDate: Date | null = null;
  if (body.tanggal_lelang) {
    const parsed = new Date(body.tanggal_lelang);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { ok: false, message: "tanggal_lelang tidak valid" },
        { status: 400 }
      );
    }
    newDate = parsed;
  }

  try {
    const isNumericId = /^\d+$/.test(raw);

    // Resolve ke id_property (BigInt) supaya bisa dipakai relasi
    const listing = await prisma.listing.findFirst({
      where: isNumericId ? { id_property: BigInt(raw) } : { slug: raw },
      select: { id_property: true },
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, message: "listing_not_found" },
        { status: 404 }
      );
    }

    // Sinkronkan 3 tabel dalam 1 transaksi: Listing → MOU aktif → Transaksi
    const result = await prisma.$transaction(async (tx) => {
      // 1. Listing.tanggal_lelang
      await tx.listing.update({
        where: { id_property: listing.id_property },
        data: { tanggal_lelang: newDate },
      });

      // 2. MOU aktif (bukan kalah/batal) — ambil id_transaksi untuk update transaksi
      const mouAktif = await tx.mou.findFirst({
        where: {
          id_listing: listing.id_property,
          status: { notIn: [status_mou_enum.kalah, status_mou_enum.batal] },
        },
        orderBy: { dibuat_pada: "desc" },
        select: { id: true, id_transaksi: true },
      });

      let mouUpdated = false;
      let transaksiUpdated = false;

      if (mouAktif) {
        // MOU.tanggal_transaksi (nullable, bisa null kalau newDate null)
        await tx.mou.update({
          where: { id: mouAktif.id },
          data: { tanggal_transaksi: newDate },
        });
        mouUpdated = true;

        // Transaksi.tanggal_transaksi (NOT NULL) — hanya update bila ada transaksi
        // dan newDate tidak null (kalau null, skip transaksi karena required)
        if (mouAktif.id_transaksi && newDate) {
          await tx.transaksi.updateMany({
            where: { id_transaksi: mouAktif.id_transaksi },
            data: {
              tanggal_transaksi: newDate,
              diperbarui_pada: new Date(),
            },
          });
          transaksiUpdated = true;
        }
      }

      return { mouUpdated, transaksiUpdated };
    });

    return NextResponse.json({
      ok: true,
      data: {
        tanggal_lelang: newDate ? newDate.toISOString() : null,
        mou_synced: result.mouUpdated,
        transaksi_synced: result.transaksiUpdated,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}
