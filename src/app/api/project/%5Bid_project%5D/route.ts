import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  __pgPool?: Pool;
};

const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (!globalForPg.__pgPool) {
  globalForPg.__pgPool = pool;
}

type RouteContext = {
  params: {
    id_project: string;
  };
};

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const idProject = params?.id_project?.trim();

  if (!idProject) {
    return NextResponse.json(
      {
        success: false,
        message: "ID project tidak valid.",
      },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectCheck = await client.query<{
      id_project: string;
      nama_project: string;
    }>(
      `
        SELECT id_project, nama_project
        FROM public.project
        WHERE id_project = $1
        LIMIT 1
      `,
      [idProject]
    );

    if (projectCheck.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: `Project ${idProject} tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    const deletedProject = await client.query<{
      id_project: string;
      nama_project: string;
    }>(
      `
        DELETE FROM public.project
        WHERE id_project = $1
        RETURNING id_project, nama_project
      `,
      [idProject]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: `Project ${deletedProject.rows[0].id_project} berhasil dihapus total.`,
      data: {
        id_project: deletedProject.rows[0].id_project,
        nama_project: deletedProject.rows[0].nama_project,
        deleted_children: [
          "project_cma",
          "project_investor",
          "project_arus_kas",
        ],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("[DELETE_PROJECT_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat menghapus project.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}