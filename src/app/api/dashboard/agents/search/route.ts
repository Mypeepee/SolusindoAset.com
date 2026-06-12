import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ────────────────────────────────────────────────────────────────────
   /api/dashboard/agents/search?q=...&limit=20
   Untuk PesertaPicker di modal acara — agent bisa nyari rekan lain
   untuk di-invite ke event. Default kasih top N agent paling baru (tanpa
   filter q) supaya picker langsung punya kandidat saat dibuka.

   Exclude:
     • Current agent (tidak perlu invite diri sendiri)
     • Akun yang status_akun ≠ AKTIF (gak guna di-invite kalau gak bisa
       login)

   Search field:
     • nama_lengkap (Pengguna) — case-insensitive partial match
     • id_agent — exact prefix (mis. "AG12" → AG123, AG124)
     • email (Pengguna) — partial match
   ──────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const currentAgentId = (session.user as { agentId?: string }).agentId ?? null;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") ?? 20)));

    const where: Parameters<typeof prisma.agent.findMany>[0]["where"] = {
      ...(currentAgentId ? { NOT: { id_agent: currentAgentId } } : {}),
      pengguna: { status_akun: "AKTIF" },
    };

    if (q.length > 0) {
      where.OR = [
        { id_agent: { startsWith: q.toUpperCase() } },
        { pengguna: { nama_lengkap: { contains: q, mode: "insensitive" } } },
        { pengguna: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const agents = await prisma.agent.findMany({
      where,
      take: limit,
      // Sort: Manajemen (jabatan non-AGENT) di atas, lalu by name.
      // Ini bikin PesertaPicker default order konsisten dgn grouping
      // di dropdown (section "Manajemen" tampil duluan).
      orderBy: [{ jabatan: "asc" }, { pengguna: { nama_lengkap: "asc" } }],
      select: {
        id_agent: true,
        nama_kantor: true,
        kota_area: true,
        jabatan: true,
        foto_profil_url: true,
        pengguna: {
          select: { nama_lengkap: true, email: true },
        },
      },
    });

    const data = agents.map((a) => ({
      id_agent: a.id_agent,
      nama_lengkap: a.pengguna.nama_lengkap,
      email: a.pengguna.email,
      nama_kantor: a.nama_kantor,
      kota_area: a.kota_area,
      jabatan: a.jabatan,
      foto_profil_url: a.foto_profil_url,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[agents/search]", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
