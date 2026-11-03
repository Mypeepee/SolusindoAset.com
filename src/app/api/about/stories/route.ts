import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  DEFAULT_SUCCESS_STORIES,
  type SuccessStory,
} from "@/lib/success-stories";
import { successStorySchema } from "@/lib/success-story-schema";
import { requireStoryOwner } from "./_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoryRow = Omit<
  SuccessStory,
  "marketPrice" | "dealPrice" | "tiktokUrl"
> & {
  marketPrice: { toString(): string };
  dealPrice: { toString(): string };
  tiktokUrl: string | null;
};
function toStory(row: StoryRow): SuccessStory {
  return {
    id: row.id,
    images: row.images,
    type: row.type,
    title: row.title,
    location: row.location,
    desc: row.desc,
    marketPrice: Number(row.marketPrice),
    dealPrice: Number(row.dealPrice),
    tiktokUrl: row.tiktokUrl || undefined,
  };
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<StoryRow[]>`
      SELECT id, images, type, title, location, description AS "desc",
             market_price AS "marketPrice", deal_price AS "dealPrice", tiktok_url AS "tiktokUrl"
      FROM company_profile_story ORDER BY created_at DESC, id DESC`;
    return NextResponse.json(
      { stories: [...rows.map(toStory), ...DEFAULT_SUCCESS_STORIES] },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[GET /api/about/stories]", error);
    return NextResponse.json(
      {
        stories: DEFAULT_SUCCESS_STORIES,
        error: "Proyek terbaru belum dapat dimuat.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireStoryOwner();
    if (owner instanceof NextResponse) return owner;
    const parsed = successStorySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Periksa kembali data proyek.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }
    const story = parsed.data;
    if (
      story.images.some(
        (image) =>
          !image.startsWith(`/uploads/success-stories/${owner.id_agent}/`),
      )
    ) {
      return NextResponse.json(
        { error: "Gunakan foto yang Anda unggah melalui formulir ini." },
        { status: 422 },
      );
    }
    // The client keeps the same UUID after timeouts: retrying never inserts twice.
    const inserted = await prisma.$executeRaw`
      INSERT INTO company_profile_story (id, images, type, title, location, description, market_price, deal_price, tiktok_url, created_by)
      VALUES (${story.id}::uuid, ${story.images}::text[], ${story.type}, ${story.title}, ${story.location}, ${story.desc},
              ${story.marketPrice}, ${story.dealPrice}, ${story.tiktokUrl || null}, ${owner.id_agent})
      ON CONFLICT (id) DO NOTHING`;
    const rows = await prisma.$queryRaw<StoryRow[]>`
      SELECT id, images, type, title, location, description AS "desc",
             market_price AS "marketPrice", deal_price AS "dealPrice", tiktok_url AS "tiktokUrl"
      FROM company_profile_story WHERE id = ${story.id}::uuid AND created_by = ${owner.id_agent}`;
    if (!rows[0])
      return NextResponse.json(
        { error: "Identitas proyek sudah digunakan. Buka formulir baru." },
        { status: 409 },
      );
    return NextResponse.json(
      { story: toStory(rows[0]) },
      {
        status: inserted ? 201 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[POST /api/about/stories]", error);
    return NextResponse.json(
      {
        error:
          "Proyek belum tersimpan. Data Anda tetap ada; silakan coba lagi.",
      },
      { status: 503 },
    );
  }
}
