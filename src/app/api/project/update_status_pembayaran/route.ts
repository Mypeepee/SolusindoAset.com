import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  return new Prisma.Decimal(0);
}

function parsePayment(value: unknown) {
  try {
    const payment = new Prisma.Decimal(String(value ?? "").replace(/[^\d.-]/g, ""));
    return payment.gt(0) ? payment : null;
  } catch {
    return null;
  }
}

async function recalcOwnershipCache(tx: Prisma.TransactionClient, idProject: string, target: Prisma.Decimal) {
  const investors = await tx.projectInvestor.findMany({
    where: { id_project: idProject },
    select: { id_project_investor: true, nominal_terbayar: true },
  });
  const totalPaid = investors.reduce((sum, row) => sum.plus(toDecimal(row.nominal_terbayar)), new Prisma.Decimal(0));
  const denominator = totalPaid.gt(target) ? totalPaid : target;
  if (!investors.length) return;
  if (denominator.lte(0)) {
    await tx.$executeRaw(Prisma.sql`UPDATE project_investor SET persentase_kepemilikan = 0 WHERE id_project = ${idProject}`);
    return;
  }
  const cases = investors.map((row) => {
    const percentage = toDecimal(row.nominal_terbayar).div(denominator).mul(100).toDecimalPlaces(6);
    return Prisma.sql`WHEN id_project_investor = ${row.id_project_investor} THEN ${percentage}::numeric`;
  });
  await tx.$executeRaw(Prisma.sql`
    UPDATE project_investor
    SET persentase_kepemilikan = CASE ${Prisma.join(cases, " ")} ELSE persentase_kepemilikan END
    WHERE id_project = ${idProject}
  `);
}

export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const currentAgentId = typeof token?.agentId === "string" ? token.agentId : typeof token?.id_agent === "string" ? token.id_agent : null;
    if (!currentAgentId) return NextResponse.json({ success: false, message: "Unauthorized. Agent tidak ditemukan di session." }, { status: 401 });

    const body = await request.json().catch(() => null);
    let investorId: bigint;
    try { investorId = BigInt(body?.id_project_investor); } catch { return NextResponse.json({ success: false, message: "Investor tidak valid." }, { status: 400 }); }

    const investor = await prisma.projectInvestor.findUnique({
      where: { id_project_investor: investorId },
      select: {
        id_project_investor: true, id_agent: true, nominal_komitmen: true, nominal_terbayar: true,
        project: { select: { id_project: true, dibuat_oleh: true, target_pendanaan: true } },
        agent: { select: { pengguna: { select: { nama_lengkap: true } } } },
      },
    });
    if (!investor) return NextResponse.json({ success: false, message: "Data investor project tidak ditemukan." }, { status: 404 });
    if (investor.project.dibuat_oleh !== currentAgentId) return NextResponse.json({ success: false, message: "Hanya penyelenggara project yang dapat mencatat pembayaran investor." }, { status: 403 });

    const committed = toDecimal(investor.nominal_komitmen);
    const paidBefore = toDecimal(investor.nominal_terbayar);
    const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), committed.minus(paidBefore));
    if (remaining.lte(0)) return NextResponse.json({ success: false, message: "Investor ini sudah melunasi seluruh komitmennya." }, { status: 400 });

    // Kompatibilitas aksi lama: mengirim status lunas akan langsung mengisi
    // seluruh sisa. UI baru selalu mengirim nominal_bayar.
    const payment = body?.nominal_bayar !== undefined ? parsePayment(body.nominal_bayar) : body?.status === "lunas" ? remaining : null;
    if (!payment) return NextResponse.json({ success: false, message: "Masukkan nominal pembayaran yang diterima." }, { status: 400 });
    if (payment.gt(remaining)) return NextResponse.json({ success: false, message: `Nominal melebihi sisa komitmen investor (Rp ${Math.round(Number(remaining.toString())).toLocaleString("id-ID")}).` }, { status: 400 });

    const paidAfter = paidBefore.plus(payment);
    const isSettled = paidAfter.gte(committed);
    const nextStatus: "lunas" | "dibayar_sebagian" = isSettled
      ? "lunas"
      : "dibayar_sebagian";
    const investorName = investor.agent?.pengguna?.nama_lengkap?.trim() || investor.id_agent;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectInvestor.update({
        where: { id_project_investor: investorId },
        data: { nominal_terbayar: paidAfter, status: nextStatus },
        select: { id_project_investor: true, nominal_terbayar: true, status: true, diupdate_tanggal: true },
      });
      await tx.projectArusKas.create({
        data: {
          id_project: investor.project.id_project,
          wallet_key: "utama",
          tanggal_transaksi: new Date(),
          jenis_transaksi: "pemasukan",
          kategori_transaksi: "setoran_modal",
          judul_transaksi: `Setoran modal ${investorName}`,
          nominal: payment,
          status_transaksi: "tercatat",
          catatan: isSettled ? "Pelunasan komitmen investor." : "Pembayaran sebagian komitmen investor.",
          id_project_investor: investorId,
        },
      });
      await recalcOwnershipCache(tx, investor.project.id_project, toDecimal(investor.project.target_pendanaan));
      return updated;
    });

    if (investor.id_agent) pusherServer.trigger(`project-investor-${investor.id_agent}`, "pembayaran:diterima", { id_project: investor.project.id_project, nominal: Number(payment.toString()), status: nextStatus }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: isSettled ? "Pelunasan investor tercatat sebagai uang masuk." : "Pembayaran sebagian tercatat sebagai uang masuk.",
      data: {
        id_project_investor: result.id_project_investor.toString(), status: result.status,
        paid: Number(result.nominal_terbayar.toString()), remaining: Number(Prisma.Decimal.max(new Prisma.Decimal(0), committed.minus(result.nominal_terbayar)).toString()),
        diupdate_tanggal: result.diupdate_tanggal.toISOString(),
      },
    });
  } catch (error) {
    console.error("[UPDATE_STATUS_PEMBAYARAN_ERROR]", error);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server." }, { status: 500 });
  }
}
