import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) {
    return Number(value.toString());
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function extractGoogleDriveFileId(input: string) {
  const value = input.trim();
  if (!value) return null;

  // kalau memang cuma file id mentah
  if (
    /^[a-zA-Z0-9_-]{20,}$/.test(value) &&
    !value.startsWith("http://") &&
    !value.startsWith("https://")
  ) {
    return value;
  }

  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const fileMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];

  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?export=view&id=FILE_ID
  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch?.[1]) return idMatch[1];

  return null;
}

function normalizePhotoUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const driveFileId = extractGoogleDriveFileId(raw);

  // pakai thumbnail google drive, paling aman buat avatar list
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w300`;
  }

  // url http/https biasa
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  // path lokal
  if (raw.startsWith("/")) {
    return raw;
  }

  return null;
}

function buildSearchBlob(values: Array<unknown>) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const idProject = searchParams.get("id_project")?.trim() || "";
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    if (!idProject) {
      return NextResponse.json(
        { message: "id_project wajib diisi." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id_project: idProject },
      select: {
        id_project: true,
        jenis_pendanaan: true,
        total_pendanaan: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project tidak ditemukan." },
        { status: 404 }
      );
    }

    const isClosedFunding = project.jenis_pendanaan === "tertutup";

    const rows = await prisma.projectInvestor.findMany({
      where: {
        id_project: idProject,
        ...(isClosedFunding
          ? {}
          : {
              OR: [
                {
                  status: {
                    not: "menunggu_pembayaran",
                  },
                },
                {
                  nominal_komitmen: {
                    gt: new Prisma.Decimal(0),
                  },
                },
              ],
            }),
      },
      orderBy: [{ nominal_komitmen: "desc" }, { dibuat_tanggal: "asc" }],
      take: q ? 100 : 20,
      select: {
        id_project_investor: true,
        id_agent: true,
        nominal_komitmen: true,
        persentase_kepemilikan: true,
        status: true,
        agent: {
          select: {
            id_agent: true,
            nama_kantor: true,
            kota_area: true,
            jabatan: true,
            nomor_whatsapp: true,
            foto_profil_url: true,
            pengguna: {
              select: {
                id_pengguna: true,
                nama_lengkap: true,
                email: true,
                nomor_telepon: true,
              },
            },
          },
        },
      },
    });

    const investors = rows
      .map((item) => {
        const agent = item.agent;
        const pengguna = agent?.pengguna;

        const namaLengkap =
          normalizeText(pengguna?.nama_lengkap) ||
          normalizeText(agent?.id_agent) ||
          item.id_agent;

        const fotoProfilUrl = normalizePhotoUrl(agent?.foto_profil_url);

        const namaKantor = normalizeText(agent?.nama_kantor);
        const kotaArea = normalizeText(agent?.kota_area);
        const jabatan = normalizeText(agent?.jabatan);

        const nomorWhatsapp =
          normalizeText(agent?.nomor_whatsapp) ||
          normalizeText(pengguna?.nomor_telepon);

        const email = normalizeText(pengguna?.email);

        return {
          id_project_investor: String(item.id_project_investor),
          id_agent: item.id_agent,
          nama: namaLengkap,
          foto_profil_url: fotoProfilUrl,
          nama_kantor: namaKantor,
          kota_area: kotaArea,
          jabatan,
          nomor_whatsapp: nomorWhatsapp,
          email,
          nominal_komitmen: toNumber(item.nominal_komitmen),
          persentase_kepemilikan: toNumber(item.persentase_kepemilikan),
          status: item.status,
          _search_blob: buildSearchBlob([
            item.id_agent,
            namaLengkap,
            namaKantor,
            kotaArea,
            jabatan,
            nomorWhatsapp,
            email,
          ]),
        };
      })
      .filter((item) => {
        if (!q) return true;
        return item._search_blob.includes(q);
      })
      .map(({ _search_blob, ...cleaned }) => cleaned);

    return NextResponse.json({
      funding_mode: project.jenis_pendanaan,
      source_label: isClosedFunding
        ? "Investor yang diundang pada pendanaan tertutup"
        : "Investor yang sudah masuk pada pendanaan terbuka",
      project_total_pendanaan: toNumber(project.total_pendanaan),
      investors,
    });
  } catch (error) {
    console.error("[PROJECT_INVESTOR_OPTIONS_GET_ERROR]", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat mengambil investor project." },
      { status: 500 }
    );
  }
}