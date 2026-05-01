import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toBigInt(v: number | null | undefined): bigint {
  if (v == null || !Number.isFinite(v)) return 0n;
  return BigInt(Math.round(v));
}

function toDecimal(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  return v;
}

function generateKode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRX${yy}${mm}${rand}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id_listing = BigInt(params.id);
    const body = await req.json();

    const {
      skema,                  // "PERSENTASE" | "SELISIH"
      agentId,                // string — agent yang closing
      deal,                   // number — harga deal (hanya untuk SELISIH)
      bidding,                // number — harga bidding
      limit,                  // number — nilai_limit_lelang
      komisiPct,              // number — % komisi (hanya untuk PERSENTASE)
      balikNama,              // number
      eksekusi,               // number
      cobroke,                // number
      royaltyFee,             // number
      komisiAgent,            // number — thc_agent
      pendapatanBersihKantor, // number
      jenis_transaksi,        // string — jenis transaksi listing
      rows,                   // Array<{ code, label, nominal, agentId }>
    } = body;

    if (!agentId) {
      return NextResponse.json({ ok: false, error: "agentId wajib diisi" }, { status: 400 });
    }

    const isPersen = skema === "PERSENTASE";

    /*
     * PERSENTASE: harga_deal = bidding (tidak ada "deal" terpisah),
     *             selisih = null
     * SELISIH:    harga_deal = deal (harga jual actual),
     *             selisih = deal - bidding
     */
    const harga_deal = toBigInt(isPersen ? bidding : deal);
    const harga_bidding = toDecimal(bidding);
    const harga_limit = toDecimal(limit > 0 ? limit : null);
    const selisih = isPersen ? null : toBigInt(deal - bidding);

    const pembanding = isPersen ? bidding : deal;
    const kenaikan_dari_limit =
      limit > 0 && pembanding > 0
        ? toDecimal((pembanding - limit) / limit)
        : null;

    const persentase_komisi = isPersen ? toDecimal(komisiPct / 100) : null;
    const biaya_baliknama = toBigInt(balikNama);
    const biaya_pengosongan = toBigInt(eksekusi);

    // Filter rows yang bisa disimpan ke DetailTransaksi:
    // - agentId harus ada dan bukan synthetic (bukan COPIC:: prefix)
    // - nominal > 0
    const isSyntheticId = (id: string) => id.startsWith("COPIC::");
    const validRows = (rows as any[]).filter(
      (r) => r.agentId && !isSyntheticId(String(r.agentId)) && r.nominal > 0
    );

    const result = await prisma.$transaction(async (tx) => {
      // Cek apakah sudah ada transaksi untuk listing + agent ini
      const existing = await tx.transaksi.findFirst({
        where: { id_listing, id_agent: agentId },
        orderBy: { dibuat_pada: "desc" },
      });

      const transaksiData = {
        id_listing,
        id_agent: agentId,
        jenis_transaksi: jenis_transaksi as any,
        tipe_komisi: isPersen ? "PERSENTASE" : "SELISIH",
        harga_deal,
        harga_limit,
        harga_bidding,
        selisih,
        kenaikan_dari_limit,
        persentase_komisi,
        biaya_baliknama,
        biaya_pengosongan,
        royalty_fee: toBigInt(royaltyFee),
        cobroke_fee: toBigInt(cobroke),
        tanggal_transaksi: new Date(),
        pendapatan_bersih_kantor: toBigInt(pendapatanBersihKantor),
        thc_agent: toBigInt(komisiAgent),
        status_transaksi: "CLOSING",
      };

      let transaksi;

      if (existing) {
        // Update yang sudah ada
        transaksi = await tx.transaksi.update({
          where: { id: existing.id },
          data: transaksiData,
        });
        // Hapus detail lama
        await tx.detailTransaksi.deleteMany({
          where: { id_transaksi: existing.id },
        });
      } else {
        // Buat baru
        transaksi = await tx.transaksi.create({
          data: {
            ...transaksiData,
            kode_transaksi: generateKode(),
          },
        });
      }

      // Simpan DetailTransaksi
      if (validRows.length > 0) {
        await tx.detailTransaksi.createMany({
          data: validRows.map((r: any) => ({
            id_transaksi: transaksi.id,
            id_agent: String(r.agentId),
            role: String(r.code ?? r.label ?? "CUSTOM"),
            pendapatan: toBigInt(r.nominal),
          })),
          skipDuplicates: true,
        });
      }

      // ── Tandai semua property serupa sebagai TERJUAL ──
      // Ambil identitas listing saat ini (nomor_legalitas, luas_tanah, kota)
      const currentListing = await tx.listing.findUnique({
        where: { id_property: id_listing },
        select: { nomor_legalitas: true, luas_tanah: true, kota: true },
      });

      if (currentListing) {
        // Cari semua property yang identik (logika sama dgn auction-history)
        const relatedWhere: any = {
          kota: currentListing.kota,
          ...(currentListing.nomor_legalitas
            ? { nomor_legalitas: currentListing.nomor_legalitas }
            : {}),
          ...(currentListing.luas_tanah
            ? { luas_tanah: currentListing.luas_tanah }
            : {}),
        };

        // Update semua property serupa + property ini sendiri → TERJUAL
        await tx.listing.updateMany({
          where: { OR: [{ id_property: id_listing }, relatedWhere] },
          data: { status_tayang: "TERJUAL" },
        });
      } else {
        // Minimal tandai property ini sendiri
        await tx.listing.update({
          where: { id_property: id_listing },
          data: { status_tayang: "TERJUAL" },
        });
      }

      return transaksi;
    });

    return NextResponse.json({
      ok: true,
      id: result.id.toString(),
      kode: result.kode_transaksi,
    });
  } catch (e: any) {
    console.error("[closing/save]", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
