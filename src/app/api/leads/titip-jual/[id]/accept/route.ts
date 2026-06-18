// src/app/api/leads/titip-jual/[id]/accept/route.ts
// Agent terima (klaim) titip-jual. First-come-first-served.
// Race-safe: pakai conditional UPDATE — kalau rowCount=0 berarti
// sudah keburu diklaim agent lain.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let id_agent: string | null =
      (session as any)?.agentId || (session?.user as any)?.agentId || null;
    if (!id_agent) {
      const a = await prisma.agent.findFirst({
        where: { id_pengguna: session.user.id as string },
        select: { id_agent: true },
      });
      id_agent = a?.id_agent ?? null;
    }
    if (!id_agent) {
      return NextResponse.json(
        { ok: false, error: "Akun ini bukan agent" },
        { status: 403 },
      );
    }

    const id_titip = BigInt(ctx.params.id);

    // Pastikan agent ini memang ter-distribute ke titip ini
    const dist = await prisma.propertyTitipDistribution.findUnique({
      where: { id_titip_id_agent: { id_titip, id_agent } },
      select: { id: true, status: true },
    });
    if (!dist) {
      return NextResponse.json(
        { ok: false, error: "Titip tidak tersedia untuk Anda" },
        { status: 404 },
      );
    }
    if (dist.status === "ditolak") {
      return NextResponse.json(
        { ok: false, error: "Anda sudah menolak titip ini sebelumnya" },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Atomic claim: hanya berhasil kalau status masih pending
      const claimed = await tx.propertyTitip.updateMany({
        where: { id_titip, status: "pending" },
        data: {
          status: "terklaim",
          diklaim_oleh_agent: id_agent!,
          diklaim_pada: new Date(),
        },
      });

      if (claimed.count === 0) {
        return { ok: false as const, conflict: true };
      }

      await tx.propertyTitipDistribution.update({
        where: { id_titip_id_agent: { id_titip, id_agent: id_agent! } },
        data: { status: "diterima", direspon_pada: new Date() },
      });

      const titip = await tx.propertyTitip.findUnique({
        where: { id_titip },
        select: {
          id_titip: true,
          pengirim_nama: true,
          pengirim_phone: true,
          alamat_lengkap: true,
          jenis_properti: true,
          estimasi_harga: true,
          status_kepemilikan: true,
        },
      });

      return { ok: true as const, titip };
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sudah diambil agent lain",
          code: "already_claimed",
        },
        { status: 409 },
      );
    }

    // Ambil nama agent untuk ditampilkan di notifikasi agent lain
    // ("Diambil oleh Jason C."). Pakai inisial belakang biar tetap sopan
    // tanpa expose nama lengkap secara berlebihan.
    const claimer = await prisma.agent.findUnique({
      where: { id_agent },
      select: { pengguna: { select: { nama_lengkap: true } } },
    });
    const fullName = claimer?.pengguna?.nama_lengkap?.trim() ?? "";
    const parts = fullName.split(/\s+/).filter(Boolean);
    const by_agent_nama =
      parts.length === 0
        ? "Agent lain"
        : parts.length === 1
          ? parts[0]
          : `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;

    // Broadcast ke semua agent lain bahwa titip ini sudah dikunci.
    // FE akan transition jadi state "diambil oleh X" lalu fade out.
    pusherServer
      .trigger("titip-broadcast", "titip:locked", {
        id_titip: ctx.params.id,
        by_agent: id_agent,
        by_agent_nama,
        at_iso: new Date().toISOString(),
      })
      .catch((e) => console.warn("pusher trigger titip:locked failed:", e));

    return NextResponse.json({
      ok: true,
      titip: {
        ...result.titip,
        id_titip: result.titip!.id_titip.toString(),
        estimasi_harga: result.titip!.estimasi_harga?.toString() ?? null,
      },
    });
  } catch (err) {
    console.error("❌ /api/leads/titip-jual/[id]/accept error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
