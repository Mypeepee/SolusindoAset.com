// app/dashboard/listings/page.tsx
import prisma from "@/lib/prisma";
import ListingsPage from "./components/listings-page";
import { fetchListingHeaderStats } from "./lib/property-stats";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function isValidImageUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}
function normalizeListingImages(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    .map((s) => (isValidImageUrl(s) ? s : `https://drive.google.com/thumbnail?id=${s}`));
}
function normalizeAgentPhoto(fileId: string | null | undefined): string {
  if (!fileId || fileId.trim() === "") return "/images/default-profile.png";
  const t = fileId.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return t;
  return `https://drive.google.com/thumbnail?id=${t}&sz=w64`;
}

export default async function DashboardListingsPage() {
  const session = await getServerSession(authOptions);
  const agentId = (session?.user as any)?.agentId as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;

  // Jika belum login atau role tidak ada
  if (!session || !userRole) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda belum login atau session tidak valid.
      </div>
    );
  }

  // Jika role AGENT tapi tidak punya agentId
  if (userRole === "AGENT" && !agentId) {
    return (
      <div className="p-6 text-sm text-slate-200">
        Anda terdaftar sebagai agent, tetapi data agent belum terhubung ke akun ini.
      </div>
    );
  }

  // Filter berdasarkan role + status_tayang TERSEDIA
  const baseWhere = {
    status_tayang: "TERSEDIA" as const,
  };

  const whereClause =
    userRole === "OWNER"
      ? baseWhere                         // OWNER: semua listing TERSEDIA
      : { ...baseWhere, id_agent: agentId }; // AGENT: listing TERSEDIA miliknya

  // Stats header (gunakan baseWhere yang sama di property-stats)
  const headerStats = await fetchListingHeaderStats(userRole, agentId);

  // Data untuk kartu
  const properties = await prisma.listing.findMany({
    where: whereClause,
    orderBy: { tanggal_diupdate: "desc" },
    include: {
      agent: {
        select: {
          nama_kantor: true,
          foto_profil_url: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      },
    },
  });

  const listings = properties.map((p) => {
    const idStr = String(p.id_property);
    const slugId = `${p.slug}-${idStr}`;
    const fotoList = normalizeListingImages(p.gambar);

    return {
      id: idStr,
      slug: slugId,
      rawSlug: p.slug,
      title: p.judul,
      status: p.status_tayang ?? "",
      category: p.kategori,
      transactionType: p.jenis_transaksi,
      city: p.kota,
      area: (p as any).area_lokasi ?? "",
      address: p.alamat_lengkap ?? "",
      provinsi: p.provinsi ?? "",
      kecamatan: p.kecamatan ?? "",
      kelurahan: p.kelurahan ?? "",
      price: formatRupiah(Number(p.harga)),
      thumbnailUrl: fotoList[0] || undefined,
      views: p.dilihat ?? 0,
      priceRaw: p.nilai_limit_lelang ? Number(p.nilai_limit_lelang) : Number(p.harga),
      pricePromo: p.harga_promo != null ? Number(p.harga_promo) : null,
      photos: fotoList,
      luasTanah: Number(p.luas_tanah ?? 0),
      luasBangunan: Number(p.luas_bangunan ?? 0),
      kamarTidur: p.kamar_tidur ?? 0,
      kamarMandi: p.kamar_mandi ?? 0,
      tanggalLelang: p.tanggal_lelang ? p.tanggal_lelang.toISOString() : null,
      agentName: p.agent?.pengguna?.nama_lengkap || "Agent Kosku",
      agentPhoto: normalizeAgentPhoto(p.agent?.foto_profil_url),
      agentOffice: p.agent?.nama_kantor || "Kosku",
    };
  });

  return (
    <ListingsPage
      headerStats={headerStats}
      listings={listings}
      currentAgentId={agentId}
      userRole={userRole}
    />
  );
}

function formatRupiah(value: number) {
  if (!value) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
