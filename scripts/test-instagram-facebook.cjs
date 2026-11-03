const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const createLoader = require("./lib/marketing-test-loader.cjs");

async function fixture(run) {
  const keys = [
    "INSTAGRAM_LOGIN_MODE",
    "INSTAGRAM_FACEBOOK_CONFIG_ID",
    "INSTAGRAM_CONFIG_ID",
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_ACCOUNT_ID",
    "MARKETING_ENCRYPTION_KEY",
    "MARKETING_PUBLIC_ORIGIN",
  ];
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, {
    INSTAGRAM_LOGIN_MODE: "facebook",
    META_APP_ID: "123",
    META_APP_SECRET: "private-app-secret",
    INSTAGRAM_ACCOUNT_ID: "17841419691674191",
    MARKETING_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    MARKETING_PUBLIC_ORIGIN: "https://marketing.example.test",
    INSTAGRAM_CONFIG_ID: "999",
  });
  delete process.env.INSTAGRAM_FACEBOOK_CONFIG_ID;
  const now = Math.floor(Date.now() / 1000);
  const state = {
    requests: [],
    row: null,
    writes: 0,
    pauses: 0,
    short: {
      is_valid: true,
      app_id: "123",
      type: "USER",
      user_id: "777",
      expires_at: now + 3600,
      data_access_expires_at: now + 90 * 86400,
      scopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
      ],
    },
    long: null,
    profile: { id: "17841419691674191", username: "company" },
    quota: { data: [{ quota_usage: 0 }] },
  };
  const db = {
    marketingConnection: {
      findUnique: async () => state.row,
      upsert: async ({ create, update }) => {
        state.writes++;
        state.row = { ...(state.row || {}), ...(state.row ? update : create) };
        return state.row;
      },
    },
    marketingSettings: {
      updateMany: async () => {
        state.pauses++;
        return { count: 1 };
      },
    },
    $transaction: async (fn) => fn(db),
  };
  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    state.requests.push({ url, options });
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.redirect, "error");
    if (url.pathname.endsWith("/oauth/access_token")) {
      if (url.searchParams.get("grant_type") === "fb_exchange_token") {
        assert.equal(
          url.searchParams.get("fb_exchange_token"),
          "private-short-token",
        );
        return Response.json({
          access_token: "private-long-token",
          expires_in: 60 * 86400,
        });
      }
      return Response.json({
        access_token: "private-short-token",
        expires_in: 3600,
      });
    }
    if (url.pathname.endsWith("/debug_token")) {
      const long = url.searchParams.get("input_token") === "private-long-token";
      return Response.json({
        data: long
          ? state.long || { ...state.short, expires_at: now + 60 * 86400 }
          : state.short,
      });
    }
    if (url.pathname.endsWith("/content_publishing_limit"))
      return Response.json(state.quota);
    assert.equal(url.pathname, "/v26.0/17841419691674191");
    return Response.json(state.profile);
  };
  const load = createLoader({ "@/lib/prisma": db });
  try {
    await run({
      state,
      provider: load("src/lib/marketing/instagram.server.ts"),
      credentials: load("src/lib/marketing/instagram-credentials.server.ts"),
      security: load("src/lib/marketing/security.server.ts"),
      load,
    });
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

test("Facebook connection validates the pinned company and publishing edge, exchanges and encrypts a finite-lived USER credential", async () => {
  await fixture(async ({ state, provider, credentials }) => {
    await provider.connectFacebookInstagramToken("private-short-token");
    assert.equal(state.writes, 1);
    assert.equal(state.pauses, 1);
    assert.equal(state.row.accountId, "17841419691674191");
    assert.ok(state.row.tokenCipher.startsWith("meta-facebook-v1."));
    assert.doesNotMatch(state.row.tokenCipher, /private-|178414/);
    assert.ok(state.row.expiresAt.getTime() > Date.now() + 59 * 86400000);
    const value = credentials.instagramCredential(state.row);
    assert.equal(value.accessToken, "private-long-token");
    assert.equal(value.userId, "777");
    assert.equal(value.businessId, undefined);
    assert.equal(
      state.requests.some(
        ({ url }) =>
          url.pathname.includes("assigned_instagram_accounts") ||
          url.pathname.includes("/me"),
      ),
      false,
    );
    assert.equal(
      state.requests.filter(({ url }) =>
        url.pathname.endsWith("/content_publishing_limit"),
      ).length,
      2,
    );
    const auth = new URL(provider.instagramAuthorization("private-state"));
    assert.equal(auth.searchParams.has("config_id"), false);
    assert.ok(auth.searchParams.get("scope").includes("pages_show_list"));
    assert.equal(auth.searchParams.get("response_type"), "code");
    process.env.INSTAGRAM_LOGIN_MODE = "unified";
    assert.throws(
      () => credentials.instagramCredential(state.row),
      (e) => e.code === "OAUTH_RECONNECT_REQUIRED",
    );
  });
});

test("Facebook OAuth shares validated token exchange and honors a separate USER configuration", async () => {
  await fixture(async ({ state, provider }) => {
    process.env.INSTAGRAM_FACEBOOK_CONFIG_ID = "888";
    const auth = new URL(provider.instagramAuthorization("private-state"));
    assert.equal(auth.searchParams.get("config_id"), "888");
    assert.equal(auth.searchParams.has("scope"), false);
    assert.equal(
      auth.searchParams.get("override_default_response_type"),
      "true",
    );
    await provider.exchangeCode("private-code");
    assert.equal(state.writes, 1);
  });
});

test("Facebook tokens cannot replace a connection on app, type, expiry, permission, profile, or quota failure", async () => {
  for (const scenario of [
    "foreign-app",
    "system-user",
    "expired",
    "missing-scope",
    "wrong-account",
    "missing-name",
    "no-quota",
    "changed-user",
  ]) {
    await fixture(async ({ state, provider }) => {
      state.row = { accountId: "old", tokenCipher: "old-encrypted-connection" };
      if (scenario === "foreign-app") state.short.app_id = "456";
      if (scenario === "system-user") state.short.type = "SYSTEM_USER";
      if (scenario === "expired") state.short.expires_at = 1;
      if (scenario === "missing-scope") state.short.scopes = [];
      if (scenario === "wrong-account") state.profile.id = "333";
      if (scenario === "missing-name") delete state.profile.username;
      if (scenario === "no-quota") state.quota = { data: [] };
      if (scenario === "changed-user")
        state.long = { ...state.short, user_id: "888" };
      await assert.rejects(
        provider.connectFacebookInstagramToken("private-short-token"),
      );
      assert.equal(state.writes, 0);
      assert.equal(state.pauses, 0);
      assert.equal(state.row.tokenCipher, "old-encrypted-connection");
    });
  }
});

test("Facebook credentials bind app, login config, company and expiry; setup requires the company ID", async () => {
  await fixture(async ({ state, provider, credentials, security }) => {
    await provider.connectFacebookInstagramToken("private-short-token");
    state.row.expiresAt = new Date(1);
    assert.throws(
      () => credentials.instagramCredential(state.row),
      (e) => e.code === "TOKEN_EXPIRED",
    );
    state.row.expiresAt = new Date(Date.now() + 60000);
    process.env.INSTAGRAM_FACEBOOK_CONFIG_ID = "555";
    assert.throws(
      () => credentials.instagramCredential(state.row),
      (e) => e.code === "OAUTH_RECONNECT_REQUIRED",
    );
    delete process.env.INSTAGRAM_FACEBOOK_CONFIG_ID;
    process.env.INSTAGRAM_ACCOUNT_ID = "333";
    assert.throws(
      () => credentials.instagramCredential(state.row),
      (e) => e.code === "OAUTH_RECONNECT_REQUIRED",
    );
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    assert.equal(security.instagramSetup().ready, false);
    assert.throws(() => security.instagramConfig());
  });
});

test("Facebook mode does not treat a publishing USER token as a Page webhook subscription credential", async () => {
  await fixture(async ({ load, state }) => {
    const webhook = load("src/lib/marketing/instagram-webhook.server.ts");
    await assert.rejects(
      webhook.subscribeInstagramWebhook(["comments"]),
      (error) =>
        error.code === "WEBHOOK_PAGE_SUBSCRIPTION_REQUIRED" &&
        error.status === 409,
    );
    assert.equal(state.requests.length, 0);
  });
});
