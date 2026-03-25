import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WALLET_KEYS = [
  "utama",
  "dokumen",
  "eksekusi",
  "renovasi",
  "cadangan",
] as const;

const JENIS_ARUS_KAS = ["pemasukan", "pengeluaran"] as const;

const KATEGORI_ARUS_KAS = [
  "setoran_modal",
  "hasil_penjualan",
  "refund",
  "pemasukan_lain",
  "pembelian_aset",
  "biaya_spare_bidding",
  "biaya_dokumen_balik_nama",
  "biaya_eksekusi_pengosongan",
  "biaya_renovasi",
  "penggunaan_dana_cadangan",
  "pengeluaran_lain",
] as const;

const STATUS_ARUS_KAS = ["tercatat", "dibatalkan"] as const;

type WalletKey = (typeof WALLET_KEYS)[number];
type JenisArusKas = (typeof JENIS_ARUS_KAS)[number];
type KategoriArusKas = (typeof KATEGORI_ARUS_KAS)[number];
type StatusArusKas = (typeof STATUS_ARUS_KAS)[number];

function isWalletKey(value: unknown): value is WalletKey {
  return typeof value === "string" && WALLET_KEYS.includes(value as WalletKey);
}

function isJenisArusKas(value: unknown): value is JenisArusKas {
  return (
    typeof value === "string" && JENIS_ARUS_KAS.includes(value as JenisArusKas)
  );
}

function isKategoriArusKas(value: unknown): value is KategoriArusKas {
  return (
    typeof value === "string" &&
    KATEGORI_ARUS_KAS.includes(value as KategoriArusKas)
  );
}

function normalizeJenis(value: unknown): JenisArusKas {
  if (value === "masuk") return "pemasukan";
  if (value === "keluar") return "pengeluaran";
  if (isJenisArusKas(value)) return value;
  return "pengeluaran";
}

function normalizeStatus(value: unknown): StatusArusKas {
  if (value === "dibatalkan") return "dibatalkan";
  if (value === "tercatat") return "tercatat";

  if (
    value === "berhasil" ||
    value === "dibayar" ||
    value === "lunas" ||
    value === "selesai" ||
    value === "success" ||
    value === "pending"
  ) {
    return "tercatat";
  }

  return "tercatat";
}

function inferKategori(
  walletKey: WalletKey,
  jenisTransaksi: JenisArusKas,
  requested?: unknown
): KategoriArusKas {
  if (isKategoriArusKas(requested)) {
    return requested;
  }

  if (jenisTransaksi === "pemasukan") {
    return "pemasukan_lain";
  }

  switch (walletKey) {
    case "dokumen":
      return "biaya_dokumen_balik_nama";
    case "eksekusi":
      return "biaya_eksekusi_pengosongan";
    case "renovasi":
      return "biaya_renovasi";
    case "cadangan":
      return "penggunaan_dana_cadangan";
    case "utama":
    default:
      return "pengeluaran_lain";
  }
}

function normalizeTanggal(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const raw = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNominal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return new Prisma.Decimal(value);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;

    try {
      const decimal = new Prisma.Decimal(cleaned);
      if (decimal.lte(0)) return null;
      return decimal;
    } catch {
      return null;
    }
  }

  return null;
}

function serializeArusKasRecord(
  record: Record<string, unknown> | null | undefined
) {
  if (!record) return null;

  return {
    ...record,
    id_project_arus_kas:
      typeof record.id_project_arus_kas === "bigint"
        ? record.id_project_arus_kas.toString()
        : record.id_project_arus_kas,
    nominal:
      record.nominal instanceof Prisma.Decimal
        ? record.nominal.toString()
        : record.nominal,
    tanggal_transaksi:
      record.tanggal_transaksi instanceof Date
        ? record.tanggal_transaksi.toISOString()
        : record.tanggal_transaksi,
    dibuat_tanggal:
      record.dibuat_tanggal instanceof Date
        ? record.dibuat_tanggal.toISOString()
        : record.dibuat_tanggal,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const idProject =
      typeof body.id_project === "string" ? body.id_project.trim() : "";
    const walletKey = body.wallet_key;
    const judulTransaksi =
      typeof body.judul_transaksi === "string"
        ? body.judul_transaksi.trim()
        : "";
    const catatan =
      typeof body.catatan === "string" && body.catatan.trim()
        ? body.catatan.trim()
        : null;

    if (!idProject) {
      return NextResponse.json(
        { message: "id_project wajib diisi." },
        { status: 400 }
      );
    }

    if (!isWalletKey(walletKey)) {
      return NextResponse.json(
        { message: "wallet_key tidak valid." },
        { status: 400 }
      );
    }

    if (!judulTransaksi) {
      return NextResponse.json(
        { message: "judul_transaksi wajib diisi." },
        { status: 400 }
      );
    }

    const tanggalTransaksi = normalizeTanggal(body.tanggal_transaksi);
    if (!tanggalTransaksi) {
      return NextResponse.json(
        { message: "tanggal_transaksi tidak valid." },
        { status: 400 }
      );
    }

    const nominal = parseNominal(body.nominal);
    if (!nominal) {
      return NextResponse.json(
        { message: "nominal harus lebih besar dari 0." },
        { status: 400 }
      );
    }

    const jenisTransaksi = normalizeJenis(body.jenis_transaksi);
    const statusTransaksi = normalizeStatus(body.status_transaksi);
    const kategoriTransaksi = inferKategori(
      walletKey,
      jenisTransaksi,
      body.kategori_transaksi
    );

    const project = await prisma.project.findUnique({
      where: { id_project: idProject },
      select: { id_project: true },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    const created = await prisma.projectArusKas.create({
      data: {
        id_project: idProject,
        wallet_key: walletKey,
        tanggal_transaksi: tanggalTransaksi,
        jenis_transaksi: jenisTransaksi,
        kategori_transaksi: kategoriTransaksi,
        judul_transaksi: judulTransaksi,
        nominal,
        status_transaksi: statusTransaksi,
        catatan,
      },
      select: {
        id_project_arus_kas: true,
        id_project: true,
        wallet_key: true,
        tanggal_transaksi: true,
        jenis_transaksi: true,
        kategori_transaksi: true,
        judul_transaksi: true,
        nominal: true,
        status_transaksi: true,
        catatan: true,
        dibuat_tanggal: true,
      },
    });

    const serialized = serializeArusKasRecord(
      created as unknown as Record<string, unknown>
    );

    return NextResponse.json(
      {
        message: "Arus kas berhasil dicatat.",
        data: serialized,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[CATAT_ARUS_KAS_POST_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menyimpan arus kas." },
      { status: 500 }
    );
  }
}