import "server-only";
import prisma from "@/lib/prisma";

export type InstagramWebhookEvent = {
  id: string;
  accountId: string;
  field: string;
  payloadCipher: string;
  providerTime: string | null;
  deliveries: number;
};

/** Raw, parameterized SQL also works with an already-running Prisma client. */
export function instagramWebhookStore(db = prisma) {
  return {
    async challenge(appId: string) {
      await db.$executeRaw`
        INSERT INTO marketing_instagram_webhook_state ("appId", "lastChallengeAt", "updatedAt")
        VALUES (${appId}, now(), now())
        ON CONFLICT ("appId") DO UPDATE
        SET "lastChallengeAt" = now(), "updatedAt" = now()
      `;
    },
    async delivery(
      appId: string,
      events: InstagramWebhookEvent[],
      ignored: number,
    ) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO marketing_instagram_webhook_state
            ("appId", "lastDeliveryAt", "receivedBatches", "ignoredEntries", "updatedAt")
          VALUES (${appId}, now(), 1, ${ignored}, now())
          ON CONFLICT ("appId") DO UPDATE SET
            "lastDeliveryAt" = now(),
            "receivedBatches" = marketing_instagram_webhook_state."receivedBatches" + 1,
            "ignoredEntries" = marketing_instagram_webhook_state."ignoredEntries" + ${ignored},
            "updatedAt" = now()
        `;
        if (events.length) {
          const rows = JSON.stringify(events);
          await tx.$executeRaw`
            INSERT INTO marketing_instagram_webhook_events
              (id, "appId", "accountId", field, "payloadCipher", "providerTime", deliveries,
               "receivedAt", "lastReceivedAt", "expiresAt")
            SELECT x.id, ${appId}, x."accountId", x.field, x."payloadCipher",
              x."providerTime"::timestamptz, x.deliveries, now(), now(), now() + interval '30 days'
            FROM jsonb_to_recordset(${rows}::jsonb) AS x(
              id text, "accountId" text, field text, "payloadCipher" text,
              "providerTime" text, deliveries integer)
            ON CONFLICT (id) DO UPDATE SET
              deliveries = marketing_instagram_webhook_events.deliveries + EXCLUDED.deliveries,
              "lastReceivedAt" = now()
          `;
        }
        await tx.$executeRaw`
          DELETE FROM marketing_instagram_webhook_events WHERE "expiresAt" <= now()
        `;
      });
    },
    async prune(appId?: string) {
      if (appId)
        return db.$executeRaw`
          DELETE FROM marketing_instagram_webhook_events
          WHERE "appId" = ${appId} AND "expiresAt" <= now()
        `;
      return db.$executeRaw`
        DELETE FROM marketing_instagram_webhook_events WHERE "expiresAt" <= now()
      `;
    },
    async status(appId: string) {
      const state = await db.$queryRaw<
        Array<{
          lastChallengeAt: Date | null;
          lastDeliveryAt: Date | null;
          receivedBatches: number;
          ignoredEntries: number;
        }>
      >`
        SELECT "lastChallengeAt", "lastDeliveryAt", "receivedBatches", "ignoredEntries"
        FROM marketing_instagram_webhook_state WHERE "appId" = ${appId}
      `;
      const counts = await db.$queryRaw<Array<{ storedEvents: number }>>`
        SELECT count(*)::int AS "storedEvents" FROM marketing_instagram_webhook_events
        WHERE "appId" = ${appId} AND "expiresAt" > now()
      `;
      return {
        lastChallengeAt: state[0]?.lastChallengeAt ?? null,
        lastDeliveryAt: state[0]?.lastDeliveryAt ?? null,
        receivedBatches: state[0]?.receivedBatches ?? 0,
        ignoredEntries: state[0]?.ignoredEntries ?? 0,
        storedEvents: counts[0]?.storedEvents ?? 0,
      };
    },
  };
}

export const webhookStore = instagramWebhookStore();
