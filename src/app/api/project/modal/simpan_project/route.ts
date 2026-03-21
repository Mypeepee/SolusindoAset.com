import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type StatusPembayaranProject =
  | "menunggu_pembayaran"
  | "dibayar_sebagian"
  | "lunas"
  | "dikembalikan"
  | "dibatalkan";

type JenisPendanaan = "terbuka" | "tertutup";

type StatusProject =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

type ProjectInvestorInput = {
  id_agent?: string;
  nominal_komitmen?: number;
  nominal_terbayar?: number;
  persentase_kepemilikan?: number | null;
  status?: StatusPembayaranProject;
  catatan?: string | null;
};

type ProjectCmaInput = {
  nama?: string;
  luas_tanah?: number;
  harga?: number;
  catatan?: string | null;
};

type CreateProjectPayload = {
  id_listing?: string;

  nama_project?: string;
  alamat_property?: string;
  provinsi?: string;
  kota?: string;
  kecamatan?: string;
  kelurahan?: string;
  gambar_thumbnail?: string;

  tanggal_pembelian?: string | null;
  harga_pembelian?: number;
  estimasi_harga_jual?: number;
  estimasi_profit_bersih?: number;
  target_pendanaan?: number;
  total_pendanaan?: number;

  jenis_pendanaan?: JenisPendanaan;
  status?: StatusProject;

  mulai_tanggal?: string | null;
  estimasi_selesai?: string | null;
  estimasi_bulan?: number;
  pendanaan_ditutup_pada?: string | null;

  deskripsi_project?: string;
  dibuat_oleh?: string;

  nilai_limit_lelang?: number;
  spare_bidding?: number;
  biaya_balik_nama?: number;
  biaya_eksekusi?: number;
  biaya_renov?: number;
  total_biaya_akuisisi?: number;
  dana_cadangan?: number;

  investor_allocations?: ProjectInvestorInput[];
  cma_entries?: ProjectCmaInput[];
};

type CreateProjectSubmitResponse = {
  success: boolean;
  message: string;
  data?: {
    id_project: string;
  };
  errors?: string[];
};

function toDecimal(value: number | string | null | undefined) {
  return new Prisma.Decimal(String(Number(value || 0)));
}

function toNullableDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toSafeString(value?: string | null) {
  return String(value ?? "").trim();
}

function toSafeNumber(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseBigIntId(value?: string | null) {
  const trimmed = toSafeString(value);

  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function getBiayaBalikNamaBreakdown(acquisitionBase: number) {
  const base = toSafeNumber(acquisitionBase);

  const bea_lelang = base * 0.02;
  const bphtb = base * 0.05;
  const ppn_lelang = base * 0.011;
  const roya = base * 0.001;
  const balik_nama = base * 0.002;

  return {
    bea_lelang,
    bphtb,
    ppn_lelang,
    roya,
    balik_nama,
    total: bea_lelang + bphtb + ppn_lelang + roya + balik_nama,
  };
}

function getProjectAcquisitionFinancials(body: CreateProjectPayload) {
  const nilaiLimitLelang = toSafeNumber(body.nilai_limit_lelang);
  const hargaPembelian = toSafeNumber(body.harga_pembelian);

  const acquisition_base =
    nilaiLimitLelang > 0 ? nilaiLimitLelang : hargaPembelian;

  const spare_bidding = toSafeNumber(body.spare_bidding);
  const biaya_eksekusi = toSafeNumber(body.biaya_eksekusi);
  const target_pendanaan = toSafeNumber(body.target_pendanaan);

  const autoBreakdown = getBiayaBalikNamaBreakdown(acquisition_base);
  const manualBiayaBalikNama = toSafeNumber(body.biaya_balik_nama);

  const biaya_balik_nama_total =
    manualBiayaBalikNama > 0 ? manualBiayaBalikNama : autoBreakdown.total;

  const total_biaya_akuisisi =
    acquisition_base + spare_bidding + biaya_balik_nama_total + biaya_eksekusi;

  const dana_cadangan = target_pendanaan - total_biaya_akuisisi;

  return {
    acquisition_base,
    spare_bidding,
    biaya_balik_nama_total,
    biaya_eksekusi,
    total_biaya_akuisisi,
    dana_cadangan,
    target_pendanaan,
  };
}

function normalizeInvestorAllocations(
  items: ProjectInvestorInput[] = []
): Required<ProjectInvestorInput>[] {
  const map = new Map<string, Required<ProjectInvestorInput>>();

  for (const item of items) {
    const id_agent = toSafeString(item.id_agent);
    if (!id_agent) continue;

    const existing = map.get(id_agent);

    map.set(id_agent, {
      id_agent,
      nominal_komitmen:
        toSafeNumber(existing?.nominal_komitmen) +
        Math.max(0, toSafeNumber(item.nominal_komitmen)),
      nominal_terbayar:
        toSafeNumber(existing?.nominal_terbayar) +
        Math.max(0, toSafeNumber(item.nominal_terbayar)),
      persentase_kepemilikan:
        item.persentase_kepemilikan === null ||
        item.persentase_kepemilikan === undefined
          ? existing?.persentase_kepemilikan ?? null
          : toSafeNumber(item.persentase_kepemilikan),
      status:
        item.status ??
        existing?.status ??
        ("menunggu_pembayaran" as StatusPembayaranProject),
      catatan: toSafeString(item.catatan) || null,
    });
  }

  return Array.from(map.values());
}

function normalizeCmaEntries(items: ProjectCmaInput[] = []) {
  return items
    .map((item) => ({
      nama: toSafeString(item.nama),
      luas_tanah: Math.max(0, toSafeNumber(item.luas_tanah)),
      harga: Math.max(0, toSafeNumber(item.harga)),
      catatan: toSafeString(item.catatan) || null,
    }))
    .filter((item) => {
      return (
        item.nama.length > 0 ||
        item.luas_tanah > 0 ||
        item.harga > 0 ||
        Boolean(item.catatan)
      );
    });
}

export async function POST(request: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;

    if (!session?.user) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Sesi login tidak ditemukan. Silakan login ulang.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateProjectPayload;

    const idListingRaw = toSafeString(body.id_listing);
    const namaProject = toSafeString(body.nama_project);

    // Prioritaskan agentId dari NextAuth, bukan dari frontend
    const sessionAgentId = toSafeString(session?.user?.agentId);
    const bodyDibuatOleh = toSafeString(body.dibuat_oleh);
    const dibuatOleh = sessionAgentId || bodyDibuatOleh;

    const jenisPendanaan =
      body.jenis_pendanaan === "tertutup" ? "tertutup" : "terbuka";

    const statusProject = (body.status ??
      "pendanaan_terbuka") as StatusProject;

    if (!idListingRaw) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Property wajib dipilih.",
        },
        { status: 400 }
      );
    }

    const idListing = parseBigIntId(idListingRaw);

    if (!idListing) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "ID property tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!namaProject) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Nama project wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!dibuatOleh) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message:
            "Akun ini tidak terhubung ke data agent. session.user.agentId tidak ditemukan.",
        },
        { status: 400 }
      );
    }

    const investorAllocations = normalizeInvestorAllocations(
      body.investor_allocations ?? []
    );

    if (jenisPendanaan === "tertutup" && investorAllocations.length === 0) {
      return NextResponse.json<CreateProjectSubmitResponse>(
        {
          success: false,
          message: "Pendanaan tertutup wajib memiliki minimal 1 investor.",
        },
        { status: 400 }
      );
    }

    const cmaEntries = normalizeCmaEntries(body.cma_entries ?? []);
    const financials = getProjectAcquisitionFinancials(body);

    const project = await prisma.$transaction(async (tx) => {
      const [listing, agent] = await Promise.all([
        tx.listing.findUnique({
          where: { id_property: idListing },
          select: { id_property: true },
        }),
        tx.agent.findUnique({
          where: { id_agent: dibuatOleh },
          select: { id_agent: true, id_pengguna: true },
        }),
      ]);

      if (!listing) {
        throw new Error("LISTING_NOT_FOUND");
      }

      if (!agent) {
        throw new Error("AGENT_NOT_FOUND");
      }

      const createdProject = await tx.project.create({
        data: {
          id_listing: idListing,
          nama_project: namaProject,
          alamat_property: toSafeString(body.alamat_property) || null,
          provinsi: toSafeString(body.provinsi) || null,
          kota: toSafeString(body.kota) || null,
          kecamatan: toSafeString(body.kecamatan) || null,
          kelurahan: toSafeString(body.kelurahan) || null,
          gambar_thumbnail: toSafeString(body.gambar_thumbnail) || null,

          tanggal_pembelian: toNullableDate(body.tanggal_pembelian),

          harga_pembelian: toDecimal(body.harga_pembelian),
          estimasi_harga_jual: toDecimal(body.estimasi_harga_jual),
          estimasi_profit_bersih: toDecimal(body.estimasi_profit_bersih),
          target_pendanaan: toDecimal(body.target_pendanaan),
          total_pendanaan: toDecimal(body.total_pendanaan),

          jenis_pendanaan: jenisPendanaan,
          status: statusProject,

          mulai_tanggal: toNullableDate(body.mulai_tanggal),
          estimasi_selesai: toNullableDate(body.estimasi_selesai),
          estimasi_bulan: Math.max(0, Math.trunc(toSafeNumber(body.estimasi_bulan))),
          pendanaan_ditutup_pada: toNullableDate(body.pendanaan_ditutup_pada),

          deskripsi_project: toSafeString(body.deskripsi_project) || null,
          dibuat_oleh: dibuatOleh,

          nilai_limit_lelang: toDecimal(body.nilai_limit_lelang),
          spare_bidding: toDecimal(body.spare_bidding),
          biaya_balik_nama: toDecimal(financials.biaya_balik_nama_total),
          biaya_eksekusi: toDecimal(body.biaya_eksekusi),
          biaya_renov: toDecimal(body.biaya_renov),
          total_biaya_akuisisi: toDecimal(financials.total_biaya_akuisisi),
          dana_cadangan: toDecimal(financials.dana_cadangan),

          investorProject:
            investorAllocations.length > 0
              ? {
                  create: investorAllocations.map((item) => ({
                    id_agent: item.id_agent,
                    nominal_komitmen: toDecimal(item.nominal_komitmen),
                    nominal_terbayar: toDecimal(item.nominal_terbayar),
                    persentase_kepemilikan:
                      item.persentase_kepemilikan === null
                        ? null
                        : toDecimal(item.persentase_kepemilikan),
                    status: item.status,
                    catatan: item.catatan,
                  })),
                }
              : undefined,

          cmaEntries:
            cmaEntries.length > 0
              ? {
                  create: cmaEntries.map((item) => ({
                    nama: item.nama || "-",
                    luas_tanah: toDecimal(item.luas_tanah),
                    harga: toDecimal(item.harga),
                    catatan: item.catatan,
                  })),
                }
              : undefined,
        },
        select: {
          id_project: true,
        },
      });

      return createdProject;
    });

    return NextResponse.json<CreateProjectSubmitResponse>(
      {
        success: true,
        message: "Project Berhasil Disimpan!",
        data: {
          id_project: project.id_project,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST_PROJECT_ERROR]", error);

    if (error instanceof Error) {
      if (error.message === "LISTING_NOT_FOUND") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message: "Listing/property tidak ditemukan.",
          },
          { status: 404 }
        );
      }

      if (error.message === "AGENT_NOT_FOUND") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message:
              "Data agent pembuat project tidak ditemukan. Pastikan akun login sudah punya relasi ke tabel agent.",
          },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message: "Data project duplikat atau melanggar unique constraint.",
          },
          { status: 409 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json<CreateProjectSubmitResponse>(
          {
            success: false,
            message:
              "Relasi data tidak valid. Pastikan listing, agent, dan investor benar.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<CreateProjectSubmitResponse>(
      {
        success: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Gagal menyimpan project.",
      },
      { status: 500 }
    );
  }
}