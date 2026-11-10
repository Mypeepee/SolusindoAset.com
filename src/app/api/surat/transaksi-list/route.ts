import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

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

function extractFirstImageUrl(raw: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const candidates = str
    .split(",")
    .map((x) => normalizeUrl(x))
    .filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/"));
  return candidates[0] ?? "";
}

function toProxyImg(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://"))
    return `/api/img?url=${encodeURIComponent(url)}`;
  return "";
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(typeof v === "object" ? String(v) : v);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { agentId?: string | null };
  const agentId = user.agentId;
  if (!agentId) return NextResponse.json({ error: "Bukan agent" }, { status: 403 });

  const agentRow = await prisma.agent.findUnique({
    where: { id_agent: agentId },
    select: { jabatan: true },
  });
  const isOwner = agentRow?.jabatan === "OWNER";

  const rows = await prisma.transaksi.findMany({
    where: isOwner ? {} : { mou: { id_agent: agentId } },
    select: {
      id_transaksi: true, dibuat_pada: true, harga_bidding: true,
      mou: { select: {
        tipe_komisi: true, harga_deal: true, agent_luar_nama: true,
        listing: { select: { judul: true, alamat_lengkap: true, kota: true, gambar: true } },
        agent: { select: { pengguna: { select: { nama_lengkap: true } } } },
      } },
    },
    orderBy: { dibuat_pada: "desc" },
    take: 200,
  });

  const result = rows.map((t) => {
    const isPersentase = t.mou.tipe_komisi.toUpperCase() === "PERSENTASE";
    return {
      id: t.id_transaksi,
      kode_transaksi: t.id_transaksi,
      tanggal_transaksi: t.dibuat_pada.toISOString(),
      judul_property: t.mou.listing.judul,
      alamat_property: t.mou.listing.alamat_lengkap ?? t.mou.listing.kota,
      nama_agent: t.mou.agent_luar_nama ?? t.mou.agent.pengguna.nama_lengkap,
      foto_url: toProxyImg(extractFirstImageUrl(t.mou.listing.gambar)),
      harga: isPersentase ? toNum(t.harga_bidding) : toNum(t.mou.harga_deal),
      label_harga: isPersentase ? "Harga Bidding" : "Harga Deal",
    };
  });

  return NextResponse.json(result);
}
