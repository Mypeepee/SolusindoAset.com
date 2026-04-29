import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SimpanProjectSelesaiPayload = {
  id_project?: string;
  tanggal_terjual: string | null;
  durasi_hari: number;
  durasi_bulan?: number;
  roi_kotor_percent?: number;
  roi_bersih_percent: number;
  harga_jual: number;
  total_biaya_akuisisi: number;
  pph_percent: number;
  ajb_percent: number;
  agent_fee_percent: number;
  pph_nominal?: number;
  ajb_nominal?: number;
  agent_fee_nominal?: number;
  total_biaya_transaksi: number;
  profit_kotor: number;
  profit_bersih: number;
  distribusi_investor?: Array<{
    id_agent: string;
    nama?: string;
    modal: number;
    porsi_percent: number;
    profit: number;
    total_diterima: number;
  }>;
};

type ProjectRow = {
  id_project: string;
  id_listing: number;
  mulai_tanggal: Date | string | null;
};

type ProjectInvestorRow = {
  id_agent: string;
  nominal_komitmen: number | string;
  persentase_kepemilikan: number | string | null;
  status: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    // antisipasi Prisma Decimal / object numeric lain
    const asString =
      typeof (value as any).toString === "function"
        ? (value as any).toString()
        : "";
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isValidDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizePercent(raw: unknown): number {
  const num = toNumber(raw);
  if (num <= 0) return 0;
  return num > 1 ? num / 100 : num;
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id_project: string }> }
) {
  try {
    const { id_project: idProjectParam } = await context.params;
    const body = (await req.json()) as SimpanProjectSelesaiPayload;

    const id_project = String(body?.id_project || idProjectParam || "").trim();
    const tanggal_terjual = body?.tanggal_terjual;

    if (!id_project) {
      return NextResponse.json(
        { success: false, message: "id_project wajib ada." },
        { status: 400 }
      );
    }

    if (!isValidDateOnly(tanggal_terjual)) {
      return NextResponse.json(
        { success: false, message: "tanggal_terjual wajib format YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const projectRows = await prisma.$queryRaw<ProjectRow[]>(
      Prisma.sql`
        SELECT
          p.id_project,
          p.id_listing,
          p.mulai_tanggal
        FROM public.project p
        WHERE p.id_project = ${id_project}
        LIMIT 1
      `
    );

    const project = projectRows[0];

    if (!project) {
      return NextResponse.json(
        { success: false, message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!project.id_listing) {
      return NextResponse.json(
        { success: false, message: "id_listing pada project tidak ditemukan." },
        { status: 400 }
      );
    }

    const investorRows = await prisma.$queryRaw<ProjectInvestorRow[]>(
      Prisma.sql`
        SELECT
          pi.id_agent,
          pi.nominal_komitmen,
          pi.persentase_kepemilikan,
          pi.status
        FROM public.project_investor pi
        WHERE pi.id_project = ${id_project}
        ORDER BY pi.id_project_investor ASC
      `
    );

    if (!investorRows.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Data investor project tidak ditemukan di tabel project_investor.",
        },
        { status: 400 }
      );
    }

    const harga_jual = roundMoney(toNumber(body?.harga_jual));
    const total_biaya_akuisisi = roundMoney(toNumber(body?.total_biaya_akuisisi));
    const profit_kotor = roundMoney(toNumber(body?.profit_kotor));
    const pph_percent = roundPercent(toNumber(body?.pph_percent));
    const ajb_percent = roundPercent(toNumber(body?.ajb_percent));
    const agent_fee_percent = roundPercent(toNumber(body?.agent_fee_percent));
    const total_biaya_transaksi = roundMoney(toNumber(body?.total_biaya_transaksi));
    const profit_bersih = roundMoney(toNumber(body?.profit_bersih));
    const roi_bersih_percent = roundPercent(toNumber(body?.roi_bersih_percent));
    const durasi_hari = Math.max(0, Math.floor(toNumber(body?.durasi_hari)));

    const investorBase = investorRows.map((row) => ({
      id_agent: String(row.id_agent || "").trim(),
      modal: roundMoney(toNumber(row.nominal_komitmen)),
      percent_raw: normalizePercent(row.persentase_kepemilikan),
      status: String(row.status || "").trim(),
    }));

    const totalExplicitPercent = investorBase.reduce(
      (sum, item) => sum + item.percent_raw,
      0
    );

    const totalModal = investorBase.reduce((sum, item) => sum + item.modal, 0);

    const finalInvestors = investorBase.map((item) => {
      let weight = 0;

      if (totalExplicitPercent > 0) {
        weight = item.percent_raw / totalExplicitPercent;
      } else if (totalModal > 0) {
        weight = item.modal / totalModal;
      }

      const profit = roundMoney(profit_bersih * weight);
      const total_diterima = roundMoney(item.modal + profit);

      return {
        id_agent: item.id_agent,
        modal: roundMoney(item.modal),
        porsi_percent: roundPercent(weight * 100),
        profit,
        total_diterima,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.project_selesai (
          id_project,
          id_listing,
          tanggal_pembelian,
          tanggal_terjual,
          durasi_hari,
          harga_jual,
          total_biaya_akuisisi,
          profit_kotor,
          pph_percent,
          ajb_percent,
          agent_fee_percent,
          total_biaya_transaksi,
          profit_bersih,
          roi_bersih,
          dibuat_tanggal,
          diupdate_tanggal
        )
        VALUES (
          ${id_project},
          ${project.id_listing},
          ${project.mulai_tanggal},
          ${tanggal_terjual}::date,
          ${durasi_hari},
          ${harga_jual},
          ${total_biaya_akuisisi},
          ${profit_kotor},
          ${pph_percent},
          ${ajb_percent},
          ${agent_fee_percent},
          ${total_biaya_transaksi},
          ${profit_bersih},
          ${roi_bersih_percent},
          NOW(),
          NOW()
        )
        ON CONFLICT (id_project)
        DO UPDATE SET
          id_listing = EXCLUDED.id_listing,
          tanggal_pembelian = EXCLUDED.tanggal_pembelian,
          tanggal_terjual = EXCLUDED.tanggal_terjual,
          durasi_hari = EXCLUDED.durasi_hari,
          harga_jual = EXCLUDED.harga_jual,
          total_biaya_akuisisi = EXCLUDED.total_biaya_akuisisi,
          profit_kotor = EXCLUDED.profit_kotor,
          pph_percent = EXCLUDED.pph_percent,
          ajb_percent = EXCLUDED.ajb_percent,
          agent_fee_percent = EXCLUDED.agent_fee_percent,
          total_biaya_transaksi = EXCLUDED.total_biaya_transaksi,
          profit_bersih = EXCLUDED.profit_bersih,
          roi_bersih = EXCLUDED.roi_bersih,
          diupdate_tanggal = NOW()
      `);

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.project_selesai_investor
        WHERE id_project = ${id_project}
      `);

      for (const item of finalInvestors) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public.project_selesai_investor (
            id_project,
            id_agent,
            modal,
            porsi_percent,
            profit,
            total_diterima
          )
          VALUES (
            ${id_project},
            ${item.id_agent},
            ${item.modal},
            ${item.porsi_percent},
            ${item.profit},
            ${item.total_diterima}
          )
        `);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Data project selesai dan distribusi investor berhasil disimpan.",
      data: {
        investor_tersimpan: finalInvestors.length,
        distribusi: finalInvestors,
      },
    });
  } catch (error) {
    console.error("POST /api/project/[id_project]/simpan error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menyimpan data project selesai.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}