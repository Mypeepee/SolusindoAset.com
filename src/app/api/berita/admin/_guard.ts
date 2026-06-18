// Shared access guard for berita admin endpoints.
// Only agents whose jabatan is OWNER/ADMIN/PRINCIPAL may manage berita.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { canManageBerita } from "@/lib/berita";

export type Editor = {
  id_agent: string;
  jabatan: string;
  penulis: string;
};

/**
 * Returns the authenticated editor, or a NextResponse error to return early.
 * Usage:
 *   const guard = await requireBeritaEditor();
 *   if (guard instanceof NextResponse) return guard;
 *   const editor = guard;
 */
export async function requireBeritaEditor(): Promise<Editor | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = (session.user as any)?.agentId ?? null;
  if (!agentId) {
    return NextResponse.json({ error: "Akun bukan agent." }, { status: 403 });
  }

  const agent = await prisma.agent.findUnique({
    where: { id_agent: String(agentId) },
    select: { id_agent: true, jabatan: true, pengguna: { select: { nama_lengkap: true } } },
  });

  if (!agent || !canManageBerita(agent.jabatan)) {
    return NextResponse.json(
      { error: "Hanya Admin / Owner yang dapat mengelola berita." },
      { status: 403 }
    );
  }

  return {
    id_agent: agent.id_agent,
    jabatan: String(agent.jabatan),
    penulis: agent.pengguna?.nama_lengkap || "Tim Redaksi",
  };
}
