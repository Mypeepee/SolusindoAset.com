// app/api/HRM/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAgentDecisionEmail } from "@/lib/mailer";
import { rewardAgentReferral } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://solusindoaset.com";
const SUPPORT_EMAIL = "closingsystem@gmail.com";

type Status = "AKTIF" | "PENDING" | "SUSPEND";
type Role = "USER" | "AGENT";

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id_agent, status_keanggotaan } = body as {
      id_agent: string;
      status_keanggotaan: Status;
    };

    if (!id_agent || !status_keanggotaan) {
      return NextResponse.json(
        { ok: false, message: "id_agent dan status_keanggotaan wajib diisi" },
        { status: 400 }
      );
    }

    if (!["AKTIF", "PENDING", "SUSPEND"].includes(status_keanggotaan)) {
      return NextResponse.json(
        { ok: false, message: "status_keanggotaan tidak valid" },
        { status: 400 }
      );
    }

    // Ambil agent + id_pengguna (wajib untuk update role pengguna) + data untuk email
    const existingAgent = await prisma.agent.findUnique({
      where: { id_agent },
      select: {
        id_agent: true,
        id_pengguna: true,
        id_upline: true,
        status_keanggotaan: true,
        nama_kantor: true,
        pengguna: { select: { email: true, nama_lengkap: true } },
      },
    });

    if (!existingAgent) {
      return NextResponse.json(
        { ok: false, message: "Agent tidak ditemukan" },
        { status: 404 }
      );
    }

    const id_pengguna = existingAgent.id_pengguna;
    const prevStatus = existingAgent.status_keanggotaan; // untuk menentukan isi email

    // Tentukan perubahan role berdasarkan status
    // - AKTIF: role -> AGENT
    // - PENDING: role tidak diubah
    // - SUSPEND: role -> USER
    let newRole: Role | null = null;
    if (status_keanggotaan === "AKTIF") newRole = "AGENT";
    if (status_keanggotaan === "SUSPEND") newRole = "USER";

    const result = await prisma.$transaction(async (tx) => {
      // 1) update status agent selalu dilakukan
      const agent = await tx.agent.update({
        where: { id_agent },
        data: { status_keanggotaan },
      });

      // 2) update role pengguna hanya untuk AKTIF / SUSPEND
      let pengguna: any = null;
      if (newRole) {
        pengguna = await tx.pengguna.update({
          where: { id_pengguna },
          data: { peran: newRole },
          select: { id_pengguna: true, peran: true, email: true, nomor_telepon: true },
        });
      }

      return { agent, pengguna };
    });

    // 📧 Email keputusan ke AGENT (best-effort, non-blocking) — hanya bila status
    // benar-benar berubah dan menjadi AKTIF (diterima) atau SUSPEND (ditolak).
    const agentEmail = existingAgent.pengguna?.email;
    if (
      agentEmail &&
      status_keanggotaan !== prevStatus &&
      (status_keanggotaan === "AKTIF" || status_keanggotaan === "SUSPEND")
    ) {
      const accepted = status_keanggotaan === "AKTIF";
      const wasPending = prevStatus === "PENDING";
      const actionUrl = accepted
        ? `${BASE_URL}/dashboard`
        : wasPending
          ? `${BASE_URL}/gabung-jadi-agent`
          : `mailto:${SUPPORT_EMAIL}`;

      sendAgentDecisionEmail(agentEmail, {
        agentName: existingAgent.pengguna?.nama_lengkap || "Agent",
        agentId: existingAgent.id_agent,
        office: existingAgent.nama_kantor,
        decision: accepted ? "ACCEPTED" : "REJECTED",
        wasPending,
        actionUrl,
      }).catch((e) => console.warn("sendAgentDecisionEmail failed:", e));
    }

    // 🎁 REWARD REFERRAL AGENT: saat downline RESMI diverifikasi (PENDING -> AKTIF),
    // upline (id_upline) dapat +10.000 poin. Idempotent & best-effort (tidak
    // menggagalkan proses approval). Hanya pada transisi pertama dari PENDING.
    if (
      status_keanggotaan === "AKTIF" &&
      prevStatus === "PENDING" &&
      existingAgent.id_upline
    ) {
      await rewardAgentReferral({
        uplineAgentId: existingAgent.id_upline,
        downlineAgentId: existingAgent.id_agent,
        downlineNama: existingAgent.pengguna?.nama_lengkap || "Agent",
      }).catch((e) => console.warn("rewardAgentReferral failed:", e));
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          status_keanggotaan === "AKTIF"
            ? "Agent diaktifkan. Role pengguna menjadi AGENT."
            : status_keanggotaan === "SUSPEND"
            ? "Agent disuspend. Role pengguna menjadi USER."
            : "Status keanggotaan diubah menjadi PENDING.",
        ...result,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error updating agent status:", err);
    return NextResponse.json(
      { ok: false, message: "Gagal mengubah status agent" },
      { status: 500 }
    );
  }
}
