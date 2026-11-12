import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { refreshOwnershipCache } from "../../_lib/cash";

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function parseNominal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;

  try {
    const nominal = new Prisma.Decimal(raw);
    return nominal.isFinite() && nominal.gte(0) ? nominal : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id_project_investor: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const currentAgentId =
      typeof (session?.user as { agentId?: unknown } | undefined)?.agentId ===
      "string"
        ? (session!.user as { agentId: string }).agentId
        : null;
    if (!currentAgentId) {
      throw new HttpError("Unauthorized. Silakan masuk kembali.", 401);
    }

    const { id_project_investor: rawInvestorId } = await context.params;
    let investorId: bigint;
    try {
      investorId = BigInt(rawInvestorId);
    } catch {
      throw new HttpError("Investor tidak valid.", 400);
    }

    const body = await request.json().catch(() => null);
    const nominalHistoris = parseNominal(body?.nominal_historis);
    if (!nominalHistoris) {
      throw new HttpError("Masukkan nominal setoran yang valid.", 400);
    }

    const investor = await prisma.projectInvestor.findUnique({
      where: { id_project_investor: investorId },
      select: {
        id_project_investor: true,
        id_project: true,
        project: { select: { dibuat_oleh: true } },
      },
    });
    if (!investor) throw new HttpError("Investor tidak ditemukan.", 404);
    if (investor.project.dibuat_oleh !== currentAgentId) {
      throw new HttpError(
        "Hanya penyelenggara project yang boleh mengoreksi setoran.",
        403
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id_project FROM project WHERE id_project = ${investor.id_project} FOR UPDATE`
      );

      const currentInvestor = await tx.projectInvestor.findUnique({
        where: { id_project_investor: investorId },
        select: {
          nominal_komitmen: true,
          nominal_terbayar: true,
          project: { select: { target_pendanaan: true } },
        },
      });
      if (!currentInvestor) throw new HttpError("Investor tidak ditemukan.", 404);

      const recorded = await tx.projectArusKas.aggregate({
        where: {
          id_project: investor.id_project,
          id_project_investor: investorId,
          kategori_transaksi: { in: ["setoran_modal", "talangan_investor"] },
          status_transaksi: { not: "dibatalkan" },
        },
        _sum: { nominal: true },
      });

      const recordedModal = new Prisma.Decimal(recorded._sum.nominal ?? 0);
      const paidBefore = new Prisma.Decimal(currentInvestor.nominal_terbayar ?? 0);
      // Baris virtual menampilkan sisa modal historis yang belum punya baris
      // ledger. Koreksi hanya mengganti sisa ini; setoran yang sudah tercatat
      // tetap menjadi bagian dari total modal disetor.
      const nominalVirtualSaatIni = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        paidBefore.minus(recordedModal)
      );
      if (nominalVirtualSaatIni.lte(0)) {
        throw new HttpError(
          "Setoran historis ini sudah tidak tersedia untuk dikoreksi. Muat ulang halaman.",
          409
        );
      }

      const paidAfter = recordedModal.plus(nominalHistoris);
      const commitment = new Prisma.Decimal(currentInvestor.nominal_komitmen ?? 0);
      const status = paidAfter.gte(commitment) && commitment.gt(0)
        ? "lunas"
        : paidAfter.gt(0)
          ? "dibayar_sebagian"
          : "menunggu_pembayaran";

      await tx.projectInvestor.update({
        where: { id_project_investor: investorId },
        data: { nominal_terbayar: paidAfter, status },
      });
      await refreshOwnershipCache(
        tx,
        investor.id_project,
        new Prisma.Decimal(currentInvestor.project.target_pendanaan ?? 0)
      );

      return { nominalHistoris, paidAfter, status };
    });

    return NextResponse.json({
      success: true,
      message: "Nominal setoran historis berhasil dikoreksi.",
      data: {
        nominal_historis: Number(result.nominalHistoris.toString()),
        nominal_terbayar: Number(result.paidAfter.toString()),
        status: result.status,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[KOREKSI_MODAL_LEGACY_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan saat mengoreksi setoran." },
      { status: 500 }
    );
  }
}
