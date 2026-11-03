const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient();
const appId = "qa-webhook-" + randomUUID();
const load = createLoader({
  "@/lib/prisma": { __esModule: true, default: db },
  "@/lib/chatbot/server-access": {
    resolveChatbotOwner: async () => ({ status: 200 }),
  },
});
const store = load(
  "src/lib/marketing/instagram-webhook-store.server.ts",
).instagramWebhookStore(db);
const security = load("src/lib/marketing/security.server.ts");
(async () => {
  try {
    const content = JSON.stringify({
      text: "Uji database webhook 🌙",
      id: randomUUID(),
    });
    const event = {
      id: createHash("sha256").update(appId).digest("hex"),
      accountId: "17841419691674191",
      field: "comments",
      payloadCipher: security.encryptToken(content),
      providerTime: "2026-10-27T15:00:00.000Z",
      deliveries: 1,
    };
    await store.challenge(appId);
    await Promise.all([
      store.delivery(appId, [event], 0),
      store.delivery(appId, [event], 1),
    ]);
    const status = await store.status(appId);
    assert.equal(status.receivedBatches, 2);
    assert.equal(status.ignoredEntries, 1);
    assert.equal(status.storedEvents, 1);
    assert.ok(status.lastChallengeAt instanceof Date);
    const rows = await db.$queryRaw`
      SELECT "accountId", "payloadCipher", deliveries, "expiresAt"
      FROM marketing_instagram_webhook_events WHERE "appId" = ${appId}
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].accountId, event.accountId);
    assert.equal(rows[0].deliveries, 2);
    assert.equal(security.decryptToken(rows[0].payloadCipher), content);
    assert.ok(rows[0].expiresAt.getTime() > Date.now() + 29 * 86400000);
    await db.$executeRaw`UPDATE marketing_instagram_webhook_events
      SET "expiresAt" = now() - interval '1 second' WHERE "appId" = ${appId}`;
    assert.equal((await store.status(appId)).storedEvents, 0);
    assert.equal(await store.prune(appId), 1);
    console.log(
      JSON.stringify({
        encryptedPersistence: true,
        concurrentDeduplication: true,
        largeIdPreserved: true,
        retentionCleanup: true,
      }),
    );
  } finally {
    await db.$executeRaw`DELETE FROM marketing_instagram_webhook_events WHERE "appId" = ${appId}`;
    await db.$executeRaw`DELETE FROM marketing_instagram_webhook_state WHERE "appId" = ${appId}`;
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(
    "Webhook DB verification failed:",
    error.code || error.name || "FAILED",
  );
  process.exitCode = 1;
});
