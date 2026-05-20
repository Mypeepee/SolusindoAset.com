import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toDriveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!id) return null;
  // already a full URL
  if (id.startsWith("http")) return id;
  // treat as Drive file ID
  return `https://drive.google.com/thumbnail?id=${id}&sz=w120`;
}

function mapAgent(agent: any) {
  if (!agent) return null;

  return {
    id_agent: agent.id_agent,
    nama: agent.pengguna?.nama_lengkap ?? "-",
    kantor: agent.nama_kantor ?? "-",
    jabatan: agent.jabatan ?? "-",
    foto: toDriveUrl(agent.foto_profil_url),
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const selectedAgentId = searchParams.get("agentId") ?? params.id;

    const [allAgentsRaw, selectedAgent] = await Promise.all([
      prisma.agent.findMany({
        where: { id_agent: { not: "COBROKE" } },
        include: {
          pengguna: true,
        },
        orderBy: {
          id_agent: "asc",
        },
      }),

      prisma.agent.findUnique({
        where: { id_agent: selectedAgentId },
        include: {
          pengguna: true,
          upline: {
            include: {
              pengguna: true,
            },
          },
          downlines: {
            include: {
              pengguna: true,
            },
            orderBy: {
              id_agent: "asc",
            },
          },
        },
      }),
    ]);

    if (!selectedAgent) {
      return NextResponse.json(
        { message: "Agent tidak ditemukan" },
        { status: 404 }
      );
    }

    let teamLeader = null;

    if ((selectedAgent as any).id_team_leader) {
      teamLeader = await prisma.agent.findUnique({
        where: {
          id_agent: (selectedAgent as any).id_team_leader,
        },
        include: {
          pengguna: true,
        },
      });
    }

    const agents = allAgentsRaw.map(mapAgent);

    const teamLeaderOptions = [...agents].sort((a, b) => {
      if (a?.nama === "Dwi Naryo") return -1;
      if (b?.nama === "Dwi Naryo") return 1;
      return (a?.nama ?? "").localeCompare(b?.nama ?? "");
    });

    return NextResponse.json({
      agents,
      selectedAgent: mapAgent(selectedAgent),
      upline: mapAgent(selectedAgent.upline),
      teamLeader: mapAgent(teamLeader),
      downlines: selectedAgent.downlines.map(mapAgent),
      teamLeaderOptions,
    });
  } catch (error) {
    console.error("GET_AGENT_RELATIONS_ERROR", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat mengambil data agent" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const agentId = body?.agentId ?? params.id;
    const teamLeaderId = body?.teamLeaderId ?? null;

    if (!agentId) {
      return NextResponse.json(
        { message: "agentId wajib diisi" },
        { status: 400 }
      );
    }

    if (!teamLeaderId) {
      return NextResponse.json(
        { message: "teamLeaderId wajib diisi" },
        { status: 400 }
      );
    }

    const updated = await prisma.agent.update({
      where: {
        id_agent: agentId,
      },
      data: {
        id_team_leader: teamLeaderId,
      },
      include: {
        pengguna: true,
      },
    });

    const teamLeader = await prisma.agent.findUnique({
      where: {
        id_agent: teamLeaderId,
      },
      include: {
        pengguna: true,
      },
    });

    return NextResponse.json({
      message: "Team leader berhasil diperbarui",
      agent: mapAgent(updated),
      teamLeader: mapAgent(teamLeader),
    });
  } catch (error) {
    console.error("PATCH_TEAM_LEADER_ERROR", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat menyimpan team leader" },
      { status: 500 }
    );
  }
}