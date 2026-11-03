const assert = require("node:assert/strict");
const { createHmac, randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient();
(async () => {
  try {
    const origin = new URL(process.env.MARKETING_PUBLIC_ORIGIN);
    assert.equal(origin.protocol, "https:");
    const base = origin.origin + "/api/pemasaran/instagram/webhook";
    const challenge = String(Date.now());
    const query = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.challenge": challenge,
      "hub.verify_token": process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    });
    const options = { redirect: "manual", signal: AbortSignal.timeout(60000) };
    const checked = await fetch(base + "?" + query, options);
    assert.equal(checked.status, 200);
    assert.equal(await checked.text(), challenge);
    query.set("hub.verify_token", "wrong-verification-token");
    assert.equal((await fetch(base + "?" + query, options)).status, 403);
    const body = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "1",
          time: Math.floor(Date.now() / 1000),
          changes: [
            {
              field: "comments",
              value: {
                id: "qa-" + randomUUID(),
                text: "Synthetic receiver test",
              },
            },
          ],
        },
      ],
    });
    const signature =
      "sha256=" +
      createHmac("sha256", process.env.META_APP_SECRET)
        .update(body)
        .digest("hex");
    const headers = {
      "content-type": "application/json",
      "x-hub-signature-256": signature,
    };
    assert.equal(
      (await fetch(base, { ...options, method: "POST", body, headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base, {
          ...options,
          method: "POST",
          body: body + " ",
          headers,
        })
      ).status,
      401,
    );
    const healthUrl =
      origin.origin + "/api/dashboard/pemasaran/instagram/webhook";
    assert.equal((await fetch(healthUrl, options)).status, 401);
    const owner = await db.agent.findFirstOrThrow({
      where: {
        jabatan: "OWNER",
        status_keanggotaan: "AKTIF",
        pengguna: { status_akun: "AKTIF" },
      },
      select: { id_pengguna: true },
    });
    const jwt = await encode({
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: 300,
      token: {
        id: owner.id_pengguna,
        sub: owner.id_pengguna,
        peran: "AGENT",
        role: "AGENT",
        jabatan: "OWNER",
        _refreshedAt: Date.now(),
      },
    });
    const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
    const health = await fetch(healthUrl, {
      ...options,
      headers: { cookie: cookieName + "=" + jwt },
    });
    assert.equal(health.status, 200);
    const status = await health.json();
    assert.equal(status.configured, true);
    assert.equal(status.callbackUrl, base);
    assert.ok(status.lastChallengeAt);
    assert.ok(status.lastDeliveryAt);
    console.log(
      JSON.stringify({
        simulated: true,
        publicHttpsChallenge: true,
        wrongVerifyTokenRejected: true,
        signatureTamperingRejected: true,
        signedSampleAccepted: true,
        ownerHealthProtected: true,
        callbackUrl: status.callbackUrl,
        storedCompanyEvents: status.storedEvents,
      }),
    );
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(
    "Webhook HTTP verification failed:",
    error.code || error.name || "FAILED",
  );
  process.exitCode = 1;
});
