import { NextResponse } from "next/server";
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
