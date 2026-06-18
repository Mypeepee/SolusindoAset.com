// app/api/dashboard/tugas/meta/route.ts
// Persist & read lightweight per-task UI state (channels, split, checklist, snooze)
// keyed by a stable task_key (e.g. "cobroke-123", "listing-9"), so it works even
// for auto-generated tasks that have no row in the `tugas` table.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

async function getAgentId() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized", status: 401 as const };
  const agentId = (session.user as any).agentId as string | undefined;
  if (!agentId) return { error: "Bukan akun agent", status: 403 as const };
  return { agentId };
}

// GET → { meta: { [task_key]: object } }
export async function GET() {
  const auth = await getAgentId();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const rows = await prisma.tugasMeta.findMany({
      where: { id_agent: auth.agentId },
      select: { task_key: true, meta: true },
    });
    const meta: Record<string, unknown> = {};
    for (const r of rows) meta[r.task_key] = r.meta;
    return NextResponse.json({ meta });
  } catch (e) {
    // Table belum dimigrasi → jangan bikin error, kembalikan kosong.
    console.warn("[tugas/meta] GET fallback:", e);
    return NextResponse.json({ meta: {} });
  }
}

// POST { task_key, meta } → upsert (overwrite meta for that key)
export async function POST(req: NextRequest) {
  const auth = await getAgentId();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const task_key = String(body?.task_key ?? "").trim();
    if (!task_key) return NextResponse.json({ error: "task_key wajib" }, { status: 400 });
    const meta = (body?.meta ?? {}) as object;

    await prisma.tugasMeta.upsert({
      where: { id_agent_task_key: { id_agent: auth.agentId, task_key } },
      create: { id_agent: auth.agentId, task_key, meta },
      update: { meta },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tugas/meta] POST error:", e);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan" }, { status: 500 });
  }
}
