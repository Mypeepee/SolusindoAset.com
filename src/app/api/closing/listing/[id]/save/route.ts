import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function toBigInt(v: number | null | undefined): bigint {
  if (v == null || !Number.isFinite(v)) return 0n;
  return BigInt(Math.round(v));
}

function toDecimal(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return null;
  return v;
}

const BULAN_ID = ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"];

async function generateIdTransaksi(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const now = new Date();
  const bulan = BULAN_ID[now.getMonth()];
  const tahun = now.getFullYear();

  const startOfMonth = new Date(tahun, now.getMonth(), 1);
  const endOfMonth   = new Date(tahun, now.getMonth() + 1, 0, 23, 59, 59, 999);

  const count = await tx.transaksi.count({
    where: { dibuat_pada: { gte: startOfMonth, lte: endOfMonth } },
  });

  const nomor = String(count + 1).padStart(3, "0");
  return `${nomor}/MOU/SPT-SBY/${bulan}/${tahun}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionAgentId = (session?.user as any)?.agentId as string | undefined;

    const id_listing = BigInt(params.id);
    const body = await req.json();

    const {
      skema,                  // "PERSENTASE" | "SELISIH"
      agentId: agentIdRaw,    // string — agent yang closing (bisa "COBROKE")
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
      agentLuarNama,          // string? — nama agent luar (hanya jika agentId === 'COBROKE')
      agentLuarKantor,        // string? — kantor agent luar
      agentLuarTelepon,       // string? — telepon agent luar
    } = body;

    // Jika agent luar (COBROKE), simpan id_agent = agent yang login (yang merekam transaksi)
    const isAgentLuar = agentIdRaw === "COBROKE";
    const agentId = isAgentLuar
      ? (sessionAgentId ?? agentIdRaw)
      : agentIdRaw;

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
        ...(isAgentLuar && {
          agent_luar_nama: agentLuarNama ?? null,
          agent_luar_kantor: agentLuarKantor ?? null,
          agent_luar_telepon: agentLuarTelepon ?? null,
        }),
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
            id_transaksi: await generateIdTransaksi(tx),
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

      // Tandai property ini sendiri + semua riwayat lelang terkait sebagai TERJUAL
      if (currentListing?.nomor_legalitas) {
        // Hanya cari riwayat terkait jika nomor_legalitas ada — hindari match terlalu luas
        await tx.listing.updateMany({
          where: {
            OR: [
              { id_property: id_listing },
              {
                nomor_legalitas: currentListing.nomor_legalitas,
                kota: currentListing.kota,
              },
            ],
          },
          data: { status_tayang: "TERJUAL" },
        });
      } else {
        // Nomor legalitas kosong — tandai property ini saja
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
      kode: result.id_transaksi,
    });
  } catch (e: any) {
    console.error("[closing/save]", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
