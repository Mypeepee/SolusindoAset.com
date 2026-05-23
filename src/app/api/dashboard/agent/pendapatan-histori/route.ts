import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  const driveMatch =
    raw.match(/drive\.google\.com\/file\/d\/([^/]+)/) ??
    raw.match(/drive\.google\.com\/open\?id=([^&]+)/) ??
    raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (driveMatch?.[1]) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  return raw;
}

function firstImageProxy(raw: unknown): string {
  if (!raw) return "";
  const url = String(raw).split(",")[0].trim();
  const normalized = normalizeUrl(url);
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("http://") || normalized.startsWith("https://"))
    return `/api/img?url=${encodeURIComponent(normalized)}`;
  return "";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId) {
      return NextResponse.json({ ok: false, message: "Agent ID tidak ditemukan" }, { status: 403 });
    }

    const rows = await prisma.detailTransaksi.findMany({
      where: { id_agent: agentId },
      orderBy: { transaksi: { tanggal_transaksi: "desc" } },
      take: 20,
      select: {
        id: true,
        role: true,
        pendapatan: true,
        transaksi: {
          select: {
            id_transaksi: true,
            status_transaksi: true,
            tanggal_transaksi: true,
            mou: {
              select: {
                jenis_transaksi: true,
                listing: {
                  select: {
                    judul: true,
                    gambar: true,
                    alamat_lengkap: true,
                    kelurahan: true,
                    kecamatan: true,
                    kota: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const data = rows.map((d) => {
      const l = d.transaksi.mou.listing;
      const alamat = [l.alamat_lengkap, l.kelurahan, l.kecamatan, l.kota]
        .filter(Boolean)
        .join(", ");
      return {
        id: d.id.toString(),
        role: d.role,
        pendapatan: Number(d.pendapatan),
        kode: d.transaksi.id_transaksi,
        status: d.transaksi.status_transaksi,
        tanggal: d.transaksi.tanggal_transaksi.toISOString().slice(0, 10),
        alamat,
        foto: firstImageProxy(l.gambar),
      };
    });

    const totalPendapatan = data.reduce((sum, d) => sum + d.pendapatan, 0);

    return NextResponse.json({ ok: true, data, totalPendapatan });
  } catch (e: any) {
    console.error("[pendapatan-histori]", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
