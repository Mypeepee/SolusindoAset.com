const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac, randomBytes } = require("node:crypto");
const { NextRequest } = require("next/server");
const createLoader = require("./lib/marketing-test-loader.cjs");

async function fixture(run) {
  const names = [
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_ACCOUNT_ID",
    "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
    "MARKETING_ENCRYPTION_KEY",
    "MARKETING_PUBLIC_ORIGIN",
  ];
  const before = Object.fromEntries(
    names.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    META_APP_ID: "123456",
    META_APP_SECRET: "webhook-private-app-secret",
    INSTAGRAM_ACCOUNT_ID: "17841419691674191",
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN:
      "webhook-private-verification-token-123456789",
    MARKETING_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    MARKETING_PUBLIC_ORIGIN: "https://marketing.example.test",
  });
  const state = {
    challenges: [],
    deliveries: [],
    events: new Map(),
    fail: false,
    owner: 200,
    connectionReads: 0,
    activeConnection: true,
    graphCalls: [],
    scopes: [
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "instagram_manage_insights",
    ],
  };
  const store = {
    challenge: async (appId) => {
      if (state.fail) throw new Error("private-storage-error");
      state.challenges.push(appId);
    },
    delivery: async (appId, events, ignored) => {
      if (state.fail) throw new Error("private-storage-error");
      state.deliveries.push({ appId, events, ignored });
      for (const event of events) {
        const old = state.events.get(event.id);
        state.events.set(event.id, {
          ...event,
          deliveries: event.deliveries + (old?.deliveries || 0),
        });
      }
    },
    status: async () => ({
      storedEvents: state.events.size,
      receivedBatches: state.deliveries.length,
    }),
  };
  const load = createLoader({
    "@/lib/prisma": {
      marketingConnection: {
        findUnique: async () => {
          state.connectionReads++;
          return { accountId: "17841419691674191" };
        },
      },
    },
    "@/lib/chatbot/server-access": {
      resolveChatbotOwner: async () => ({ status: state.owner }),
    },
    "./instagram-webhook-store.server": { webhookStore: store },
    "./instagram.server": {
      instagramToken: async () => {
        if (!state.activeConnection)
          throw new security.MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
        return {
          account: { accountId: "17841419691674191" },
          token: "private-company-token",
        };
      },
      graph: async (path, token, params, method = "GET") => {
        state.graphCalls.push({ path, params, method });
        if (path === "debug_token")
          return {
            data: {
              is_valid: true,
              app_id: "123456",
              type: "SYSTEM_USER",
              scopes: state.scopes,
            },
          };
        assert.equal(path, "17841419691674191/subscribed_apps");
        assert.equal(method, "POST");
        assert.equal(token, "private-company-token");
        return { success: true };
      },
    },
  });
  const receiver = load("src/app/api/pemasaran/instagram/webhook/route.ts");
  const owner = load(
    "src/app/api/dashboard/pemasaran/instagram/webhook/route.ts",
  );
  const security = load("src/lib/marketing/security.server.ts");
  const url = "https://marketing.example.test/api/pemasaran/instagram/webhook";
  const payload = () => ({
    object: "instagram",
    entry: [
      {
        id: "17841419691674191",
        time: 1793116800,
        changes: [
          {
            field: "comments",
            value: { id: "comment-1", text: 'Selamat malam 🌙 "quoted"' },
          },
        ],
      },
    ],
  });
  function post(value, headers = {}, exact = false) {
    const body = exact ? value : JSON.stringify(value);
    const signature =
      "sha256=" +
      createHmac("sha256", process.env.META_APP_SECRET)
        .update(body)
        .digest("hex");
    return new NextRequest(url, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        ...headers,
      },
    });
  }
  try {
    await run({ state, receiver, owner, security, url, payload, post });
  } finally {
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
}

test("Instagram webhook challenge is public, exact, private, and rejects wrong or ambiguous credentials", async () => {
  await fixture(async ({ receiver, state, url }) => {
    const query = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.challenge": "001234567890",
      "hub.verify_token": process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    });
    const valid = await receiver.GET(new NextRequest(url + "?" + query));
    assert.equal(valid.status, 200);
    assert.equal(await valid.text(), "001234567890");
    assert.match(valid.headers.get("content-type"), /text\/plain/);
    assert.match(valid.headers.get("cache-control"), /no-store/);
    assert.deepEqual(state.challenges, ["123456"]);
    query.set("hub.verify_token", "wrong-token");
    assert.equal(
      (await receiver.GET(new NextRequest(url + "?" + query))).status,
      403,
    );
    query.append(
      "hub.verify_token",
      process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    );
    assert.equal(
      (await receiver.GET(new NextRequest(url + "?" + query))).status,
      400,
    );
    assert.equal(state.challenges.length, 1);
    delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    assert.equal(
      (await receiver.GET(new NextRequest(url + "?" + query))).status,
      503,
    );
  });
});

test("Instagram webhook authenticates original UTF-8 bytes, encrypts content, and deduplicates exact events", async () => {
  await fixture(async ({ receiver, state, security, payload, post }) => {
    const value = payload();
    value.entry[0].changes.push({ ...value.entry[0].changes[0] });
    const first = await receiver.POST(post(value));
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true });
    assert.equal(state.events.size, 1);
    const stored = [...state.events.values()][0];
    assert.equal(stored.deliveries, 2);
    assert.doesNotMatch(
      JSON.stringify(stored),
      /Selamat|quoted|private-app-secret/,
    );
    assert.equal(
      JSON.parse(security.decryptToken(stored.payloadCipher)).value.text,
      'Selamat malam 🌙 "quoted"',
    );
    assert.equal((await receiver.POST(post(value))).status, 200);
    assert.equal([...state.events.values()][0].deliveries, 4);
    value.entry[0].time++;
    assert.equal((await receiver.POST(post(value))).status, 200);
    assert.equal(state.events.size, 2);
    assert.equal(state.connectionReads, 0);
  });
});

test("Instagram webhook rejects forged signatures, altered bodies, bad shapes and oversized signed events without storing them", async () => {
  await fixture(async ({ receiver, state, payload, post }) => {
    for (const header of ["", "sha1=bad", "sha256=" + "0".repeat(64)])
      assert.equal(
        (
          await receiver.POST(
            post(payload(), { "x-hub-signature-256": header }),
          )
        ).status,
        401,
      );
    const signed = post(payload());
    const signature = signed.headers.get("x-hub-signature-256");
    assert.equal(
      (
        await receiver.POST(
          post(
            JSON.stringify(payload()) + " ",
            { "x-hub-signature-256": signature },
            true,
          ),
        )
      ).status,
      401,
    );
    for (const invalid of [
      "{",
      JSON.stringify({ object: "page", entry: [] }),
      JSON.stringify({ object: "instagram", entry: [null] }),
      JSON.stringify({
        object: "instagram",
        entry: [{ id: "17841419691674191", changed_fields: "comments" }],
      }),
    ])
      assert.equal((await receiver.POST(post(invalid, {}, true))).status, 400);
    assert.equal(
      (await receiver.POST(post(payload(), { "content-type": "text/plain" })))
        .status,
      415,
    );
    assert.equal(
      (
        await receiver.POST(
          post(payload(), { "content-length": String(2 * 1024 * 1024 + 1) }),
        )
      ).status,
      413,
    );
    const many = payload();
    many.entry[0].changes = Array.from(
      { length: 1001 },
      () => many.entry[0].changes[0],
    );
    assert.equal((await receiver.POST(post(many))).status, 413);
    assert.equal(state.deliveries.length, 0);
  });
});

test("Instagram webhook acknowledges foreign sample accounts without saving their content and retries on storage failure", async () => {
  await fixture(async ({ receiver, state, payload, post }) => {
    const foreign = payload();
    foreign.entry[0].id = "17841400000000000";
    assert.equal((await receiver.POST(post(foreign))).status, 200);
    assert.equal(state.deliveries[0].ignored, 1);
    assert.equal(state.events.size, 0);
    state.fail = true;
    const failed = await receiver.POST(post(payload()));
    assert.equal(failed.status, 503);
    assert.doesNotMatch(
      await failed.text(),
      /private-storage-error|Selamat|quoted/,
    );
  });
});

test("Webhook health is OWNER-only and does not reveal verification tokens, app secrets or payloads", async () => {
  await fixture(async ({ owner, state, receiver, post, payload }) => {
    for (const status of [401, 403]) {
      state.owner = status;
      assert.equal((await owner.GET()).status, status);
    }
    state.owner = 200;
    await receiver.POST(post(payload()));
    const response = await owner.GET();
    const report = await response.json();
    assert.equal(response.status, 200);
    assert.equal(report.storedEvents, 1);
    assert.match(report.callbackUrl, /\/api\/pemasaran\/instagram\/webhook$/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.doesNotMatch(
      JSON.stringify(report),
      /webhook-private|payloadCipher|Selamat|quoted/,
    );
  });
});

test("Account webhook subscription requires OWNER, matching origin, an active connection and the requested permissions", async () => {
  await fixture(async ({ owner, state }) => {
    const address =
      "https://marketing.example.test/api/dashboard/pemasaran/instagram/webhook";
    const request = (fields, origin = "https://marketing.example.test") =>
      new NextRequest(address, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ action: "subscribe", fields }),
      });
    state.owner = 403;
    assert.equal((await owner.POST(request(["comments"]))).status, 403);
    state.owner = 200;
    assert.equal(
      (
        await owner.POST(
          request(["comments"], "https://untrusted.example.test"),
        )
      ).status,
      403,
    );
    for (const fields of [
      [],
      ["unknown"],
      ["comments", "comments"],
      "comments",
    ])
      assert.equal((await owner.POST(request(fields))).status, 400);
    assert.equal(state.graphCalls.length, 0);
    state.activeConnection = false;
    assert.equal((await owner.POST(request(["comments"]))).status, 401);
    state.activeConnection = true;
    state.scopes = ["instagram_basic", "instagram_manage_comments"];
    assert.equal((await owner.POST(request(["messages"]))).status, 409);
    assert.ok(state.graphCalls.every((call) => call.method === "GET"));
    state.graphCalls = [];
    const result = await owner.POST(request(["comments"]));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      subscribed: true,
      fields: ["comments"],
    });
    assert.deepEqual(state.graphCalls.at(-1), {
      path: "17841419691674191/subscribed_apps",
      params: { subscribed_fields: "comments" },
      method: "POST",
    });
  });
});
