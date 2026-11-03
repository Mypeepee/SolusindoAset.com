// Read-only verification against the connected account. Never publishes or mutates Instagram.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const db = new PrismaClient();
try {
  const owner = await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      id: owner.id_pengguna,
      sub: owner.id_pengguna,
      peran: "AGENT",
      role: "AGENT",
      jabatan: "OWNER",
      _refreshedAt: Date.now(),
    },
  });
  const cookie =
    (process.env.NEXTAUTH_URL?.startsWith("https:")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token") +
    "=" +
    token;
  const before =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  const endpoint = origin + "/api/dashboard/pemasaran/instagram/content";
  assert.equal((await fetch(endpoint)).status, 401);
  async function read(params) {
    const response = await fetch(endpoint + "?" + new URLSearchParams(params), {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(180000),
    });
    const result = await response.json();
    assert.equal(
      response.status,
      200,
      "Instagram read: " + (result.error || response.status),
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.doesNotMatch(
      JSON.stringify(result),
      /access_token|tokenCipher|appsecret_proof/,
    );
    return result;
  }
  const media = await read({ mode: "media" });
  const stories = await read({ mode: "stories" });
  let detail = null,
    comments = null;
  if (media.items[0]) {
    detail = await read({ mode: "detail", mediaId: media.items[0].id });
    assert.equal(detail.media.id, media.items[0].id);
    if (media.capabilities.comments)
      comments = await read({ mode: "comments", mediaId: media.items[0].id });
  }
  const after =
    await db.$queryRaw`SELECT count(*)::int AS count FROM marketing_instagram_actions`;
  assert.deepEqual(
    after,
    before,
    "Read-only verification must not create Instagram actions",
  );
  console.log(
    JSON.stringify({
      verified: true,
      loadedMedia: media.items.length,
      accountMediaCount: media.account.mediaCount,
      moreMedia: !!media.after,
      activeStories: stories.items.length,
      capabilities: media.capabilities,
      detailMetrics: detail?.insights.length || 0,
      availableMetrics:
        detail?.insights.filter((metric) => metric.value !== null).length || 0,
      loadedComments: comments?.items.length ?? null,
      mutations: 0,
    }),
  );
} finally {
  await db.$disconnect();
}
