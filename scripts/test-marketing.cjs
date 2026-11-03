const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { NextRequest } = require("next/server");
const createLoader = require("./lib/marketing-test-loader.cjs");
const load = createLoader({
  "@/lib/prisma": {},
  "@/lib/chatbot/server-access": {
    resolveChatbotOwner: async () => ({ status: 200 }),
  },
});
const domain = load("src/lib/marketing/domain.ts");
const planner = load("src/lib/marketing/planner.ts");
const planDomain = load("src/lib/marketing/plan.ts");
const security = load("src/lib/marketing/security.server.ts");
const config = () => ({
  ...domain.DEFAULT_CONFIG,
  schedules: [...domain.DEFAULT_CONFIG.schedules],
  locations: [],
  propertyTypes: [],
  whatsappAudience: ["6281234567890@s.whatsapp.net"],
  companyPhone: "081234567890",
});
const listing = (id = "1", extra = {}) => ({
  id,
  assetCode: "parcel-" + id,
  title: "Rumah " + id,
  cityId: "city-1",
  cityName: "Kota Surabaya",
  kelurahanId: "kel-1",
  kelurahanName: "Banyuurip",
  districtName: "Sawahan",
  provinceName: "Jawa Timur",
  address: "Jalan Contoh " + id,
  currentAuctionPrice: 400e6,
  initialAuctionPrice: 1e9,
  landAreaSqm: 100,
  metricAuctionDropPct: 60,
  metricMarketSpreadPct: 40,
  primaryDealScore: 100,
  transactionType: "BELI",
  listingCategory: "SECONDARY",
  propertyType: "RUMAH",
  status: "TERSEDIA",
  auctionDate: null,
  imageUrl: "https://images.example.test/" + id + ".jpg",
  imageUrls: ["https://images.example.test/" + id + ".jpg"],
  listingUrl: "/Jual/rumah-" + id,
  sourceRevision: "one",
  ...extra,
});
test("default schedule is three Jakarta slots, including next-day rollover", () => {
  const now = new Date("2026-10-26T01:59:00Z"),
    c = config();
  assert.deepEqual(
    domain.scheduledSlots(c, now).map((date) => date.toISOString()),
    [
      "2026-10-26T02:00:00.000Z",
      "2026-10-26T06:00:00.000Z",
      "2026-10-26T11:00:00.000Z",
    ],
  );
  assert.equal(
    domain.nextSlot(c, new Date("2026-10-26T12:00:00Z")).toISOString(),
    "2026-10-27T02:00:00.000Z",
  );
  assert.equal(domain.DEFAULT_CONFIG.enabled, false);
});
test("settings reject duplicate/malformed times, inverted prices, invalid contacts and empty channels", () => {
  for (const change of [
    { schedules: ["09:00", "09:00"] },
    { schedules: ["25:00"] },
    { minPrice: 2, maxPrice: 1 },
    { whatsappAudience: ["123@g.us"] },
    { enabled: true, instagram: false, whatsapp: false },
    { cooldownDays: 0 },
  ])
    assert.equal(
      domain.settingsSchema.safeParse({ ...config(), ...change }).success,
      false,
    );
  assert.equal(domain.settingsSchema.safeParse(config()).success, true);
});
test("eligibility preserves independent OR thresholds and rejects unknown evidence, inactive listings and expired auctions", () => {
  const now = new Date("2026-10-26T03:00:00Z"),
    c = config();
  assert.equal(
    domain.eligibleAsset(listing("1", { metricMarketSpreadPct: null }), c, now),
    true,
  );
  assert.equal(
    domain.eligibleAsset(
      listing("1", { metricAuctionDropPct: null, metricMarketSpreadPct: null }),
      c,
      now,
    ),
    false,
  );
  for (const change of [
    { status: "TERJUAL" },
    { kelurahanId: null },
    { currentAuctionPrice: 0 },
    { transactionType: "SEWA" },
    { listingCategory: "LELANG", auctionDate: null },
    { listingCategory: "LELANG", auctionDate: "2026-10-25T01:00:00Z" },
  ])
    assert.equal(domain.eligibleAsset(listing("1", change), c, now), false);
  assert.equal(
    domain.assetIdentity(listing("2", { assetCode: "parcel-1" })),
    domain.assetIdentity(listing("1")),
  );
});
test("property search explains blocked matches without relaxing publication eligibility", () => {
  const now = new Date("2026-10-26T03:00:00Z");
  const when = new Date("2026-11-02T03:00:00Z");
  const c = config();
  const reserved = new Set(["asset:parcel-2"]);
  for (const [asset, reason] of [
    [listing("1"), null],
    [listing("2"), "ASSET_COOLDOWN"],
    [listing("3", { status: "TERJUAL" }), "LISTING_INACTIVE"],
    [listing("4", { currentAuctionPrice: 0 }), "INVALID_PRICE"],
    [
      listing("5", { listingCategory: "LELANG", auctionDate: null }),
      "AUCTION_DATE_REQUIRED",
    ],
    [
      listing("6", {
        listingCategory: "LELANG",
        auctionDate: "2026-05-20T17:00:00Z",
      }),
      "AUCTION_EXPIRED",
    ],
    [
      listing("7", {
        listingCategory: "LELANG",
        auctionDate: "2026-10-30T03:00:00Z",
      }),
      "AUCTION_BEFORE_PUBLICATION",
    ],
    [listing("8", { kelurahanId: null }), "UNVERIFIED_LOCATION"],
    [
      listing("9", { metricAuctionDropPct: null, metricMarketSpreadPct: null }),
      "NOT_WORTH_IT",
    ],
  ]) {
    assert.equal(
      planDomain.planCandidateReason(asset, c, when, reserved, now),
      reason,
    );
    if (reason && reason !== "ASSET_COOLDOWN")
      assert.equal(domain.eligibleAsset(asset, c, when), false);
  }
});
test("public caption uses facts, hides private scores and distinguishes auction limit", () => {
  const caption = domain.captionFor(
    domain.snapshotAsset(listing("1", { listingCategory: "LELANG" })),
    config(),
  );
  assert.match(caption, /Limit lelang Rp/);
  assert.match(caption, /400\.000\.000/);
  assert.match(caption, /6281234567890/);
  assert.doesNotMatch(caption, /ROI|score|100%|keuntungan|pasti/i);
});
test("sales caption connects an emotional headline, source specifications and a complete public detail URL", () => {
  const asset = domain.snapshotAsset(
    listing("71", {
      title: "Rumah untuk cerita baru",
      certificateType: "SHM",
      listingCategory: "LELANG",
      auctionDate: "2026-12-20T02:00:00Z",
      listingUrl: "/Lelang/rumah-71?ref=company",
    }),
  );
  const caption = domain.captionFor(asset, config());
  assert.match(caption.split("\n")[0], /Bayangkan/);
  for (const fact of [
    "Rumah untuk cerita baru",
    "Jalan Contoh 71",
    "100 m²",
    "SHM",
    "20 Desember 2026",
    "09.00 WIB",
  ])
    assert.ok(caption.includes(fact), fact);
  assert.match(caption, /https:\/\/[^\s]+\/Lelang\/rumah-71\?ref=company/);
  assert.ok(
    caption.indexOf("Luas tanah") < caption.indexOf("🔗 Detail properti"),
  );
  assert.match(caption, /kode properti 71/);
  assert.ok(caption.length <= 2200);
  assert.doesNotMatch(
    caption,
    /dijamin|pasti untung|termurah|tinggal satu|lokasi strategis|ROI|score/i,
  );
});
test("caption omits unknown facts, handles invalid dates and preserves the CTA when source copy is very long", () => {
  const asset = domain.snapshotAsset(
    listing("9", {
      title: "Judul panjang ".repeat(500),
      address: "Alamat panjang ".repeat(500),
      cityName: "Kota ".repeat(500),
      certificateType: null,
      landAreaSqm: null,
      listingCategory: "LELANG",
      auctionDate: "invalid",
      listingUrl: "/Lelang/detail-9",
    }),
  );
  const text = domain.captionFor(asset, {
    ...config(),
    companyName: "Perusahaan ".repeat(100),
  });
  assert.ok(text.length <= 2200);
  assert.match(text, /https:\/\/[^\s]+\/Lelang\/detail-9/);
  assert.match(text, /kode properti 9/);
  assert.doesNotMatch(
    text,
    /Luas tanah|Legalitas|Jadwal lelang|Invalid Date|undefined|null/,
  );
  const land = domain.captionFor({ ...asset, propertyType: "TANAH" }, config());
  const warehouse = domain.captionFor(
    { ...asset, propertyType: "GUDANG" },
    config(),
  );
  assert.match(land.split("\n")[0], /tumbuh/);
  assert.match(warehouse.split("\n")[0], /Usaha/);
});
test("poster and caption detail destinations reject unsafe and foreign links", () => {
  for (const link of [
    "javascript:alert(1)",
    "https://evil.example/Lelang/1",
    "//evil.example/Jual/1",
    "/dashboard/pemasaran",
    "",
  ])
    assert.equal(
      domain.marketingListingUrl(link, "https://solusindoaset.com"),
      null,
    );
  assert.equal(
    domain.marketingListingUrl(
      "/Jual/rumah-1/AG108",
      "https://solusindoaset.com",
    ),
    "https://solusindoaset.com/Jual/rumah-1/AG108",
  );
});
test("listing links use the canonical site even when media is served through a tunnel", () => {
  const old = process.env.MARKETING_PUBLIC_ORIGIN;
  process.env.MARKETING_PUBLIC_ORIGIN = "https://media-only.example.test";
  try {
    assert.equal(
      domain.marketingListingUrl("/Lelang/rumah-71"),
      "https://solusindoaset.com/Lelang/rumah-71",
    );
    assert.match(
      domain.captionFor(
        domain.snapshotAsset(listing("71", { listingUrl: "/Lelang/rumah-71" })),
        config(),
      ),
      /https:\/\/solusindoaset\.com\/Lelang\/rumah-71/,
    );
  } finally {
    if (old === undefined) delete process.env.MARKETING_PUBLIC_ORIGIN;
    else process.env.MARKETING_PUBLIC_ORIGIN = old;
  }
});
test("tokens are authenticated/encrypted; media signatures bind the job, filename and expiry", () => {
  const oldKey = process.env.MARKETING_ENCRYPTION_KEY,
    oldOrigin = process.env.MARKETING_PUBLIC_ORIGIN;
  process.env.MARKETING_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.MARKETING_PUBLIC_ORIGIN = "https://marketing.example.test";
  try {
    const encrypted = security.encryptToken("private-token");
    assert.equal(security.decryptToken(encrypted), "private-token");
    assert.ok(!encrypted.includes("private-token"));
    assert.throws(() => security.decryptToken(encrypted.slice(0, -3) + "AAA"));
    assert.notEqual(
      security.mediaSignature("a", "feed.jpg", 1),
      security.mediaSignature("b", "feed.jpg", 1),
    );
    assert.notEqual(
      security.mediaSignature("a", "feed.jpg", 1),
      security.mediaSignature("a", "story.jpg", 1),
    );
    assert.equal(security.sameSecret("", ""), false);
    assert.equal(
      new URL(security.mediaUrl("a", "feed.jpg")).origin,
      "https://marketing.example.test",
    );
  } finally {
    if (oldKey === undefined) delete process.env.MARKETING_ENCRYPTION_KEY;
    else process.env.MARKETING_ENCRYPTION_KEY = oldKey;
    if (oldOrigin === undefined) delete process.env.MARKETING_PUBLIC_ORIGIN;
    else process.env.MARKETING_PUBLIC_ORIGIN = oldOrigin;
  }
});
test("fresh OWNER authorization and mutation origin are enforced", async () => {
  for (const status of [401, 403]) {
    const guard = createLoader({
      "@/lib/prisma": {},
      "@/lib/chatbot/server-access": {
        resolveChatbotOwner: async () => ({ status }),
      },
    })("src/lib/marketing/security.server.ts");
    await assert.rejects(
      guard.requireMarketingOwner(),
      (error) => error.status === status,
    );
  }
  await assert.rejects(
    security.requireMarketingOwner(
      new NextRequest("https://ours.example.test/api", {
        headers: { origin: "https://attacker.example.test" },
      }),
      true,
    ),
    (error) => error.status === 403,
  );
  await security.requireMarketingOwner(
    new NextRequest("https://ours.example.test/api", {
      headers: { origin: "https://ours.example.test" },
    }),
    true,
  );
  await security.requireMarketingOwner(
    new NextRequest("http://localhost:3034/api", {
      headers: { host: "127.0.0.1:3034", origin: "http://127.0.0.1:3034" },
    }),
    true,
  );
  await security.requireMarketingOwner(
    new NextRequest("http://localhost:3000/api", {
      headers: {
        "x-forwarded-host": "company.example.test",
        "x-forwarded-proto": "https",
        origin: "https://company.example.test",
      },
    }),
    true,
  );
  await assert.rejects(
    security.requireMarketingOwner(
      new NextRequest("http://localhost:3000/api", {
        headers: {
          "x-forwarded-host": "company.example.test",
          "x-forwarded-proto": "https",
          origin: "https://outside.example.test",
        },
      }),
      true,
    ),
    (error) => error.status === 403,
  );
});
test("Instagram setup reports each missing configuration without exposing secret values", () => {
  const names = [
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_CONFIG_ID",
    "INSTAGRAM_ACCOUNT_ID",
    "MARKETING_PUBLIC_ORIGIN",
    "MARKETING_ENCRYPTION_KEY",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    names.forEach((name) => delete process.env[name]);
    const empty = security.instagramSetup();
    assert.equal(empty.ready, false);
    assert.equal(empty.callbackUrl, null);
    assert.equal(empty.checks.filter((check) => !check.ready).length, 5);
    process.env.META_APP_ID = "123456789";
    process.env.META_APP_SECRET = "fixture-meta-secret";
    process.env.INSTAGRAM_CONFIG_ID = "987654321";
    process.env.MARKETING_PUBLIC_ORIGIN = "https://marketing.example.test";
    process.env.MARKETING_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const ready = security.instagramSetup();
    assert.equal(ready.ready, true);
    assert.equal(
      ready.callbackUrl,
      "https://marketing.example.test/api/dashboard/pemasaran/instagram/callback",
    );
    const response = JSON.stringify(ready);
    assert.ok(!response.includes(process.env.META_APP_SECRET));
    assert.ok(!response.includes(process.env.MARKETING_ENCRYPTION_KEY));
    process.env.MARKETING_ENCRYPTION_KEY = "invalid";
    process.env.MARKETING_PUBLIC_ORIGIN = "http://localhost:3000";
    const invalid = security.instagramSetup();
    assert.equal(invalid.ready, false);
    assert.equal(invalid.callbackUrl, null);
    assert.equal(invalid.checks.filter((check) => !check.ready).length, 2);
    process.env.INSTAGRAM_ACCOUNT_ID = "invalid-account-id";
    assert.equal(security.instagramSetup().ready, false);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
test("Instagram OAuth keeps the secure state cookie on its public origin, including reverse proxies", async () => {
  const names = [
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_CONFIG_ID",
    "INSTAGRAM_ACCOUNT_ID",
    "MARKETING_PUBLIC_ORIGIN",
    "MARKETING_ENCRYPTION_KEY",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    process.env.META_APP_ID = "123456789";
    process.env.META_APP_SECRET = "fixture-meta-secret";
    process.env.INSTAGRAM_CONFIG_ID = "987654321";
    process.env.MARKETING_PUBLIC_ORIGIN = "https://marketing.example.test";
    process.env.MARKETING_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const { GET } = load(
      "src/app/api/dashboard/pemasaran/instagram/connect/route.ts",
    );
    const wrong = await GET(
      new NextRequest(
        "http://localhost:3000/api/dashboard/pemasaran/instagram/connect",
      ),
    );
    assert.equal(wrong.status, 400);
    assert.equal((await wrong.json()).error, "OAUTH_DOMAIN_MISMATCH");
    assert.equal(wrong.cookies.get("marketing_ig_state"), undefined);
    const direct = await GET(
      new NextRequest(
        "https://marketing.example.test/api/dashboard/pemasaran/instagram/connect",
      ),
    );
    const proxied = await GET(
      new NextRequest(
        "http://localhost:3000/api/dashboard/pemasaran/instagram/connect",
        {
          headers: {
            "x-forwarded-host": "marketing.example.test",
            "x-forwarded-proto": "https",
          },
        },
      ),
    );
    for (const response of [direct, proxied]) {
      assert.equal(response.status, 307);
      const target = new URL(response.headers.get("location"));
      assert.equal(target.origin, "https://www.facebook.com");
      assert.equal(target.pathname, "/dialog/oauth");
      assert.equal(target.searchParams.get("client_id"), "123456789");
      assert.equal(target.searchParams.get("config_id"), "987654321");
      assert.equal(target.searchParams.get("response_type"), "code");
      assert.equal(
        target.searchParams.get("override_default_response_type"),
        "true",
      );
      assert.equal(target.searchParams.get("prompt"), "login");
      assert.equal(target.searchParams.has("scope"), false);
      assert.equal(target.searchParams.has("client_secret"), false);
      assert.equal(
        target.searchParams.get("redirect_uri"),
        "https://marketing.example.test/api/dashboard/pemasaran/instagram/callback",
      );
      const cookie = response.cookies.get("marketing_ig_state");
      assert.equal(cookie.value, target.searchParams.get("state"));
      assert.equal(cookie.secure, true);
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, "lax");
      assert.equal(cookie.maxAge, 600);
    }
    assert.notEqual(
      direct.cookies.get("marketing_ig_state").value,
      proxied.cookies.get("marketing_ig_state").value,
    );
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
test("Instagram connection targets the OAuth route on its domain and the HTTPS website from localhost", () => {
  const oauth = load("src/lib/marketing/instagram-oauth.ts");
  assert.equal(
    oauth.instagramConnectionHref(
      "https://marketing.example.test",
      "https://marketing.example.test",
    ),
    "/api/dashboard/pemasaran/instagram/connect",
  );
  assert.equal(
    oauth.instagramConnectionHref(
      "https://marketing.example.test",
      "http://localhost:3000",
    ),
    "https://marketing.example.test/dashboard/pemasaran?tab=pengaturan",
  );
  assert.equal(
    oauth.instagramOAuthIssue("__proto__"),
    "INSTAGRAM_CONNECTION_FAILED",
  );
  assert.equal(
    oauth.instagramOAuthIssue("provider message with secret"),
    "INSTAGRAM_CONNECTION_FAILED",
  );
});

async function withUnifiedInstagram(run) {
  const names = [
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_CONFIG_ID",
    "INSTAGRAM_ACCOUNT_ID",
    "INSTAGRAM_API_VERSION",
    "MARKETING_PUBLIC_ORIGIN",
    "MARKETING_ENCRYPTION_KEY",
  ];
  const env = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  const fetch = global.fetch;
  const warn = console.warn;
  Object.assign(process.env, {
    META_APP_ID: "123456789",
    META_APP_SECRET: "fixture-meta-secret",
    INSTAGRAM_CONFIG_ID: "987654321",
    INSTAGRAM_API_VERSION: "v26.0",
    MARKETING_PUBLIC_ORIGIN: "https://marketing.example.test",
    MARKETING_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  });
  delete process.env.INSTAGRAM_ACCOUNT_ID;
  const state = {
    requests: [],
    writes: 0,
    paused: 0,
    connection: null,
    logs: [],
    tokenResponse: { access_token: "fixture-suat-token", expires_in: 0 },
    inspection: {
      is_valid: true,
      app_id: "123456789",
      expires_at: 0,
      scopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
      ],
    },
    business: { id: "999", client_business_id: "777" },
    accounts: { data: [{ id: "222", username: "company" }] },
    nextAccounts: { data: [] },
    assignedSequence: [],
    explicitAccounts: { data: [] },
    publishingCapability: { data: [{ quota_usage: 0 }] },
    headerProfileDenied: false,
    profiles: {
      222: { id: "222", username: "company" },
      555: { id: "555", username: "other_company" },
    },
  };
  console.warn = (...args) => state.logs.push(args);
  const db = {
    marketingConnection: {
      findUnique: async () => state.connection,
      findMany: async () => (state.connection ? [state.connection] : []),
      upsert: async ({ create, update }) => {
        state.writes++;
        state.connection = {
          lastError: null,
          ...state.connection,
          ...(state.connection ? update : create),
        };
        return state.connection;
      },
    },
    marketingSettings: {
      updateMany: async () => {
        state.paused++;
      },
    },
    $transaction: async (work) => work(db),
  };
  global.fetch = async (value, options = {}) => {
    const url = new URL(value);
    state.requests.push({ url, options });
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.ok(url.pathname.startsWith("/v26.0/"));
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    if (url.pathname.endsWith("/oauth/access_token")) {
      assert.equal(url.searchParams.get("client_id"), process.env.META_APP_ID);
      assert.equal(
        url.searchParams.get("client_secret"),
        process.env.META_APP_SECRET,
      );
      assert.equal(url.searchParams.get("code"), "fixture-code");
      assert.equal(
        url.searchParams.get("redirect_uri"),
        security.oauthRedirect(),
      );
      return Response.json(state.tokenResponse);
    }
    if (url.pathname.endsWith("/debug_token")) {
      assert.equal(url.searchParams.get("input_token"), "fixture-suat-token");
      assert.equal(
        options.headers.Authorization,
        "Bearer 123456789|fixture-meta-secret",
      );
      return Response.json({ data: state.inspection });
    }
    if (url.searchParams.has("access_token")) {
      assert.equal(url.searchParams.get("access_token"), "fixture-suat-token");
      assert.equal(options.headers.Authorization, undefined);
    } else
      assert.equal(options.headers.Authorization, "Bearer fixture-suat-token");
    if (url.pathname.endsWith("/assigned_instagram_accounts")) {
      if (url.pathname !== "/v26.0/me/assigned_instagram_accounts")
        return Response.json(state.explicitAccounts);
      if (state.assignedSequence.length)
        return Response.json(state.assignedSequence.shift());
      return Response.json(
        url.searchParams.has("after") ? state.nextAccounts : state.accounts,
      );
    }
    if (url.pathname === "/v26.0/me") {
      assert.ok(
        ["client_business_id", "id,name"].includes(
          url.searchParams.get("fields"),
        ),
      );
      return Response.json(state.business);
    }
    if (url.pathname === "/v26.0/777")
      return Response.json({ id: "777", name: "Fixture company" });
    if (url.pathname === "/v26.0/777/owned_instagram_accounts")
      return Response.json(state.accounts);
    if (url.pathname.endsWith("/content_publishing_limit")) {
      assert.equal(url.searchParams.get("fields"), "quota_usage");
      assert.equal(options.method, "GET");
      return Response.json(state.publishingCapability);
    }
    const profileId = url.pathname.match(/^\/v26\.0\/(\d+)$/)?.[1];
    if (profileId && Object.hasOwn(state.profiles, profileId)) {
      assert.ok(["id", "id,username"].includes(url.searchParams.get("fields")));
      if (state.headerProfileDenied && !url.searchParams.has("access_token"))
        return Response.json({
          error: {
            code: 100,
            error_subcode: 33,
            message: "Unsupported get request. fixture-private-data",
            fbtrace_id: "MetaTrace_123456789",
          },
        });
      return Response.json(state.profiles[profileId]);
    }
    if (url.pathname === "/v26.0/222/media_publish") {
      assert.equal(options.method, "POST");
      assert.equal(new URLSearchParams(options.body).get("creation_id"), "333");
      assert.ok(new URLSearchParams(options.body).get("appsecret_proof"));
      return Response.json({ id: "444" });
    }
    throw new Error("Unexpected fixture request");
  };
  const mocks = {
    "./campaign-periods.server": {
      activeCampaignPeriods: async () => [],
      pendingCampaignSummaries: async () => [],
    },
    "@/lib/prisma": db,
    "./security.server": security,
    "./instagram-reference.server": {
      referenceInstagramReads: async () => ({}),
    },
  };
  const unifiedLoad = createLoader(mocks);
  const provider = unifiedLoad("src/lib/marketing/instagram.server.ts");
  const credentials = unifiedLoad(
    "src/lib/marketing/instagram-credentials.server.ts",
  );
  const pending = unifiedLoad("src/lib/marketing/instagram-pending.server.ts");
  const diagnostics = unifiedLoad(
    "src/lib/marketing/instagram-diagnostics.server.ts",
  );
  pending.clearPendingInstagramAuthorization();
  try {
    await run({ state, provider, credentials, pending, diagnostics, db });
  } finally {
    pending.clearPendingInstagramAuthorization();
    global.fetch = fetch;
    console.warn = warn;
    for (const key of names) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }
}

test("Unified Instagram uses Meta credentials, assigned account ID, and encrypted non-expiring SUAT", async () => {
  await withUnifiedInstagram(async ({ state, provider, credentials, db }) => {
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
    assert.equal(state.connection.expiresAt, null);
    assert.equal(state.paused, 0);
    assert.doesNotMatch(
      state.connection.tokenCipher,
      /fixture-suat|123456789|987654321/,
    );
    assert.deepEqual(credentials.instagramCredential(state.connection), {
      accessToken: "fixture-suat-token",
      appId: "123456789",
      configId: "987654321",
      businessId: "777",
      accountId: "222",
    });
    assert.equal(credentials.instagramConnectionReady(state.connection), true);
    const { account, token } = await provider.instagramToken();
    await provider.publishContainer(account.accountId, "333", token);
    const requests = state.requests.length;
    await provider.checkInstagramToken();
    assert.equal(
      state.requests.length,
      requests,
      "Never-expiring SUAT must not use a legacy refresh endpoint",
    );
    const service = createLoader({
      "@/lib/prisma": db,
      "@/lib/investor-read.server": {},
      "@/lib/investor-cma-legacy.server": {},
      "./store.server": {},
      "./media.server": {},
      "./instagram.server": {},
      "./security.server": security,
      "./whatsapp.server": {
        whatsappRequest: async () => ({ connected: false }),
      },
    })("src/lib/marketing/service.server.ts");
    const connection = await service.connections();
    assert.equal(connection.instagram.connected, true);
    assert.equal(connection.instagram.expiresAt, null);
    assert.doesNotMatch(
      JSON.stringify(connection),
      /tokenCipher|fixture-suat|fixture-meta-secret/,
    );
    state.connection.lastError = "TOKEN_EXPIRED";
    assert.equal((await service.connections()).instagram.connected, false);
    await assert.rejects(
      provider.instagramToken(),
      (error) => error.code === "TOKEN_EXPIRED",
    );
  });
});

test("Failed Instagram discovery retains only a temporary encrypted authorization, never a connected account", async () => {
  await withUnifiedInstagram(
    async ({ state, provider, credentials, pending }) => {
      process.env.INSTAGRAM_ACCOUNT_ID = "222";
      state.accounts = { data: [] };
      state.profiles["222"] = {
        error: {
          code: 100,
          error_subcode: 33,
          message: "Unsupported get request. fixture-private-data",
        },
      };
      await assert.rejects(
        provider.exchangeCode("fixture-code"),
        (error) => error.code === "OAUTH_ACCOUNT_PROFILE_UNAVAILABLE",
      );
      assert.equal(state.writes, 0);
      assert.equal(state.connection, null);
      const status = pending.pendingInstagramStatus();
      assert.equal(status.available, true);
      assert.ok(
        new Date(status.expiresAt).getTime() <= Date.now() + 15 * 60_000,
      );
      assert.doesNotMatch(
        JSON.stringify(status),
        /fixture-|cipher|accessToken|businessId/,
      );
      const authorization = pending.pendingInstagramAuthorization();
      assert.doesNotMatch(
        authorization.cipher,
        /fixture-|accessToken|businessId/,
      );
      assert.equal(
        credentials.instagramConnectionReady({
          accountId: "222",
          tokenCipher: authorization.cipher,
          expiresAt: null,
        }),
        false,
      );
      await assert.rejects(
        provider.instagramToken(),
        (error) => error.code === "OAUTH_RECONNECT_REQUIRED",
      );
    },
  );
});

test("Instagram diagnosis reads independent capabilities without retaining provider text or changing a connection", async () => {
  await withUnifiedInstagram(
    async ({ state, provider, pending, diagnostics }) => {
      process.env.INSTAGRAM_ACCOUNT_ID = "222";
      state.accounts = { data: [] };
      state.inspection.type = "SYSTEM_USER";
      state.inspection.user_id = "999";
      state.profiles["222"] = {
        error: {
          code: 100,
          error_subcode: 33,
          message: "Unsupported get request. fixture-private-data",
        },
      };
      await assert.rejects(provider.exchangeCode("fixture-code"));
      const expiry = pending.pendingInstagramStatus().expiresAt;
      const before = state.requests.length;
      const report = await diagnostics.inspectPendingInstagramConnection();
      assert.equal(report.tokenValid, true);
      assert.equal(report.reads.companyProfile.providerSubcode, 33);
      assert.equal(report.reads.companyIdentity.ok, false);
      assert.equal(report.reads.publishingAccess.verified, true);
      assert.equal(report.reads.assignedAccounts.count, 0);
      assert.equal(report.reads.explicitSystemUserAccounts.count, 0);
      assert.equal(report.permissions.instagram_manage_messages, false);
      assert.equal(state.writes, 0);
      assert.equal(pending.pendingInstagramStatus().expiresAt, expiry);
      assert.doesNotMatch(
        JSON.stringify(report),
        /fixture-|accessToken|access_token|appsecret|cipher|authorization/i,
      );
      assert.ok(
        state.requests
          .slice(before)
          .every(({ options }) => options.method === "GET"),
      );
      assert.equal(
        state.requests
          .slice(before)
          .some(({ url }) => url.pathname.endsWith("/oauth/access_token")),
        false,
      );
    },
  );
});

test("Instagram diagnosis compares documented token transport without changing the active connection", async () => {
  await withUnifiedInstagram(
    async ({ state, provider, diagnostics, pending }) => {
      process.env.INSTAGRAM_ACCOUNT_ID = "222";
      state.accounts = { data: [] };
      state.headerProfileDenied = true;
      await assert.rejects(
        provider.exchangeCode("fixture-code"),
        (error) => error.code === "OAUTH_ACCOUNT_PROFILE_UNAVAILABLE",
      );
      const report = await diagnostics.inspectPendingInstagramConnection();
      assert.equal(report.reads.companyProfile.ok, false);
      assert.equal(
        report.reads.companyProfile.providerTraceId,
        "MetaTrace_123456789",
      );
      assert.equal(report.reads.parameterCompanyProfile.ok, true);
      assert.equal(report.reads.parameterCompanyProfile.matchesCompany, true);
      assert.equal(report.reads.parameterPublishingAccess.verified, true);
      assert.equal(state.writes, 0);
      assert.equal(pending.pendingInstagramStatus().available, true);
      assert.doesNotMatch(
        JSON.stringify(report),
        /fixture-|access_token|accessToken|client_secret|cipher/,
      );
      assert.ok(
        state.requests.every(({ options }) => options.method !== "POST"),
      );
      assert.doesNotMatch(
        JSON.stringify(state.logs),
        /fixture-|MetaTrace|access_token|accessToken/,
      );
    },
  );
});

test("Instagram reference reads bypass Graph fetch, redact errors, and never follow redirects", async () => {
  const { EventEmitter } = require("node:events");
  const requests = [];
  const oldSecret = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "reference-private-secret";
  const reference = createLoader({
    "node:https": {
      get(url, options, callback) {
        requests.push({ url, options });
        const request = new EventEmitter();
        request.destroy = () => {};
        queueMicrotask(() => {
          const response = new EventEmitter();
          response.destroy = () => {};
          const accounts = url.pathname.endsWith("assigned_instagram_accounts");
          const proof = url.searchParams.has("appsecret_proof");
          response.statusCode = accounts ? 200 : proof ? 400 : 302;
          response.headers = { location: "https://untrusted.example.test" };
          callback(response);
          response.emit(
            "data",
            Buffer.from(
              JSON.stringify(
                accounts
                  ? {
                      data: [
                        { id: "222", username: "reference-private-username" },
                      ],
                    }
                  : {
                      error: {
                        code: 100,
                        error_subcode: 33,
                        fbtrace_id: "MetaTrace_123456789",
                        message:
                          "reference-private-token reference-private-secret",
                      },
                    },
              ),
            ),
          );
          response.emit("end");
        });
        return request;
      },
    },
  })("src/lib/marketing/instagram-reference.server.ts");
  try {
    const report = await reference.referenceInstagramReads(
      "reference-private-token",
      "222",
    );
    assert.equal(requests.length, 5);
    assert.equal(report.referenceAssignedAccounts.count, 1);
    assert.equal(report.referenceAssignedAccounts.includesCompany, true);
    assert.equal(report.referenceCompanyProfile.providerCode, 100);
    assert.equal(report.referenceCompanyProfile.providerSubcode, 33);
    assert.equal(
      report.referenceCompanyProfile.providerTraceId,
      "MetaTrace_123456789",
    );
    assert.equal(report.referenceProfileWithoutProof.httpStatus, 302);
    assert.equal(report.referenceProfileWithoutProof.ok, false);
    for (const { url } of requests) {
      assert.equal(url.origin, "https://graph.facebook.com");
      assert.equal(
        url.searchParams.get("access_token"),
        "reference-private-token",
      );
      assert.equal(url.searchParams.get("fields"), "id,username");
      assert.ok(/^\/v(?:25|26)\.0\//.test(url.pathname));
    }
    assert.equal(requests[2].url.searchParams.has("appsecret_proof"), false);
    assert.equal(report.referencePreviousVersionProfile.providerSubcode, 33);
    assert.equal(report.referencePreviousVersionAccounts.includesCompany, true);
    assert.equal(requests[3].url.pathname, "/v25.0/222");
    assert.doesNotMatch(
      JSON.stringify(report),
      /reference-private-|access_token|appsecret_proof/,
    );
  } finally {
    if (oldSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = oldSecret;
  }
});

test("Test-token diagnosis preserves large Instagram IDs, compares both documented hosts, and redacts credentials", async () => {
  const {
    diagnoseInstagramTestToken,
  } = require("./diagnose-instagram-test-token.cjs");
  const accountId = "17841419691674191";
  const calls = [];
  const report = await diagnoseInstagramTestToken(
    {
      token: "diagnostic-private-token",
      appId: "123",
      appSecret: "diagnostic-private-secret",
      accountId,
    },
    async (url, options) => {
      calls.push(url);
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      assert.equal(options.body, undefined);
      assert.ok(
        ["graph.facebook.com", "graph.instagram.com"].includes(url.hostname),
      );
      if (url.pathname.endsWith("/debug_token"))
        return Response.json({
          data: {
            is_valid: true,
            app_id: "123",
            type: "SYSTEM_USER",
            scopes: ["instagram_basic", "diagnostic-private-permission"],
          },
        });
      if (url.hostname === "graph.instagram.com")
        return Response.json({
          user_id: accountId,
          username: "diagnostic-private-username",
        });
      if (url.pathname.endsWith("/assigned_instagram_accounts"))
        return Response.json({ data: [] });
      if (url.pathname.endsWith("/me"))
        return Response.json({ client_business_id: "777" });
      assert.equal(url.pathname, "/v26.0/" + accountId);
      return Response.json(
        {
          error: {
            code: 100,
            error_subcode: 33,
            fbtrace_id: "MetaTrace_123456789",
            message: "diagnostic-private-token",
          },
        },
        { status: 400 },
      );
    },
  );
  assert.equal(calls.length, 5);
  assert.equal(report.inspection.appMatches, true);
  assert.deepEqual(report.inspection.permissions, ["instagram_basic"]);
  assert.equal(report.facebookProfile.providerSubcode, 33);
  assert.equal(report.instagramLoginProfile.matchesCompany, true);
  assert.equal(report.business.hasBusinessId, true);
  assert.equal(report.assignedAccounts.count, 0);
  assert.doesNotMatch(
    JSON.stringify(report),
    /diagnostic-private-|access_token|cipher|appsecret_proof/,
  );
});

test("Test-token diagnosis never treats a foreign-app token as a Unified authorization", async () => {
  const {
    diagnoseInstagramTestToken,
  } = require("./diagnose-instagram-test-token.cjs");
  let calls = 0;
  const report = await diagnoseInstagramTestToken(
    {
      token: "private-token",
      appId: "123",
      appSecret: "private-secret",
      accountId: "222",
    },
    async (url) => {
      calls++;
      if (url.pathname.endsWith("/debug_token"))
        return Response.json({
          data: { is_valid: true, app_id: "456", type: "SYSTEM_USER" },
        });
      throw new Error("private-token private-secret");
    },
  );
  assert.equal(calls, 3);
  assert.equal(report.inspection.appMatches, false);
  assert.equal(report.assignedAccounts, undefined);
  assert.equal(report.facebookProfile.issue, "DIAGNOSTIC_READ_FAILED");
  assert.doesNotMatch(JSON.stringify(report), /private-token|private-secret/);
});

test("Facebook Login diagnosis discovers the company through paginated Pages without exposing tokens or following provider URLs", async () => {
  const {
    diagnoseInstagramTestToken,
  } = require("./diagnose-instagram-test-token.cjs");
  const company = "17841419691674191";
  const calls = [];
  const report = await diagnoseInstagramTestToken(
    {
      token: "private-facebook-token",
      appId: "123",
      appSecret: "private-facebook-secret",
      accountId: company,
    },
    async (url, options) => {
      calls.push(url.pathname);
      assert.equal(
        url.hostname === "graph.facebook.com" ||
          url.hostname === "graph.instagram.com",
        true,
      );
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      assert.equal(options.body, undefined);
      if (url.pathname.endsWith("/debug_token"))
        return Response.json({
          data: {
            is_valid: true,
            app_id: "123",
            type: "USER",
            scopes: [
              "instagram_basic",
              "pages_show_list",
              "instagram_content_publish",
            ],
          },
        });
      if (url.hostname === "graph.instagram.com")
        return Response.json({ error: { code: 190 } }, { status: 400 });
      if (url.pathname.endsWith("/me/accounts")) {
        assert.equal(
          url.searchParams.get("fields"),
          "id,instagram_business_account",
        );
        assert.equal(url.searchParams.has("client_secret"), false);
        if (!url.searchParams.has("after"))
          return Response.json({
            data: [
              {
                id: "555",
                name: "private-page-name",
                access_token: "private-page-token",
              },
            ],
            paging: {
              next: "https://untrusted.example/leak",
              cursors: { after: "safe-next-cursor" },
            },
          });
        assert.equal(url.searchParams.get("after"), "safe-next-cursor");
        return Response.json({
          data: [{ id: "556", instagram_business_account: { id: company } }],
        });
      }
      if (url.pathname.endsWith("/content_publishing_limit"))
        return Response.json({ data: [{ quota_usage: 0 }] });
      assert.equal(url.pathname, "/v26.0/" + company);
      return Response.json({
        id: company,
        username: "private-company-username",
      });
    },
  );
  assert.equal(calls.length, 6);
  assert.equal(report.inspection.type, "USER");
  assert.equal(report.assignedAccounts, undefined);
  assert.deepEqual(report.facebookLogin.pages, {
    ok: true,
    count: 2,
    linkedInstagramAccounts: 1,
    companyLinked: true,
  });
  assert.equal(report.facebookLogin.companyProfileReadable, true);
  assert.equal(report.facebookLogin.publishingAccess.verified, true);
  assert.equal(report.facebookLogin.readyForConnectionTest, true);
  assert.doesNotMatch(
    JSON.stringify(report),
    /private-|access_token|appsecret_proof|client_secret/,
  );
});

test("Facebook Page discovery requires a valid same-app USER token with basic and Page-list permissions", async () => {
  const {
    diagnoseInstagramTestToken,
  } = require("./diagnose-instagram-test-token.cjs");
  for (const details of [
    {
      is_valid: false,
      app_id: "123",
      type: "USER",
      scopes: ["instagram_basic", "pages_show_list"],
    },
    {
      is_valid: true,
      app_id: "456",
      type: "USER",
      scopes: ["instagram_basic", "pages_show_list"],
    },
    {
      is_valid: true,
      app_id: "123",
      type: "PAGE",
      scopes: ["instagram_basic", "pages_show_list"],
    },
    {
      is_valid: true,
      app_id: "123",
      type: "USER",
      scopes: ["instagram_basic"],
    },
    {
      is_valid: true,
      app_id: "123",
      type: "USER",
      scopes: "instagram_basic,pages_show_list",
    },
  ]) {
    let pages = 0;
    const report = await diagnoseInstagramTestToken(
      {
        token: "private-token",
        appId: "123",
        appSecret: "private-secret",
        accountId: "222",
      },
      async (url) => {
        if (url.pathname.endsWith("/debug_token"))
          return Response.json({ data: details });
        if (url.pathname.endsWith("/me/accounts")) pages++;
        return Response.json(
          { error: { code: 100, message: "private-token" } },
          { status: 400 },
        );
      },
    );
    assert.equal(pages, 0);
    assert.notEqual(report.facebookLogin?.readyForConnectionTest, true);
    assert.doesNotMatch(JSON.stringify(report), /private-token|private-secret/);
  }
});

test("Facebook Page diagnosis refuses unverified pagination, unsafe IDs and unrelated accounts", async () => {
  const {
    diagnoseInstagramTestToken,
  } = require("./diagnose-instagram-test-token.cjs");
  for (const scenario of [
    "repeated-cursor",
    "unsafe-id",
    "other-account",
    "missing-quota",
    "provider-denied",
  ]) {
    let pages = 0,
      quotas = 0;
    const report = await diagnoseInstagramTestToken(
      {
        token: "private-token",
        appId: "123",
        appSecret: "private-secret",
        accountId: "17841419691674191",
      },
      async (url) => {
        if (url.pathname.endsWith("/debug_token"))
          return Response.json({
            data: {
              is_valid: true,
              app_id: "123",
              type: "USER",
              scopes: [
                "instagram_basic",
                "pages_show_list",
                "instagram_content_publish",
              ],
            },
          });
        if (url.pathname.endsWith("/me/accounts")) {
          pages++;
          if (scenario === "provider-denied")
            return Response.json(
              { error: { code: 200, message: "private-token" } },
              { status: 403 },
            );
          return Response.json({
            data: [
              {
                id: "555",
                instagram_business_account: {
                  id:
                    scenario === "unsafe-id"
                      ? 17841419691674191
                      : scenario === "other-account"
                        ? "333"
                        : "17841419691674191",
                },
              },
            ],
            ...(scenario === "repeated-cursor"
              ? {
                  paging: {
                    next: "https://untrusted.example",
                    cursors: { after: "same-cursor" },
                  },
                }
              : {}),
          });
        }
        if (url.pathname.endsWith("/content_publishing_limit")) {
          quotas++;
          return Response.json({ data: [{}] });
        }
        return Response.json({
          id: "17841419691674191",
          username: "private-name",
        });
      },
    );
    assert.notEqual(report.facebookLogin.readyForConnectionTest, true);
    assert.equal(quotas, scenario === "missing-quota" ? 1 : 0);
    assert.equal(pages, scenario === "repeated-cursor" ? 2 : 1);
    assert.doesNotMatch(
      JSON.stringify(report),
      /private-token|private-secret|private-name/,
    );
  }
});

test("Instagram retries reuse a pending token, revalidate Meta access, and preserve its original expiry", async () => {
  await withUnifiedInstagram(async ({ state, provider, pending }) => {
    process.env.INSTAGRAM_ACCOUNT_ID = "222";
    state.accounts = { data: [] };
    state.profiles["222"] = {
      error: {
        code: 100,
        error_subcode: 33,
        message: "Unsupported get request",
      },
    };
    state.tokenResponse.expires_in = 300;
    await assert.rejects(provider.exchangeCode("fixture-code"));
    const expiry = pending.pendingInstagramAuthorization().tokenExpiresAt;
    const pendingExpiry = pending.pendingInstagramStatus().expiresAt;
    await assert.rejects(provider.retryPendingInstagramConnection());
    assert.equal(
      pending.pendingInstagramStatus().expiresAt,
      pendingExpiry,
      "A failed retry must not extend temporary retention",
    );
    state.profiles["222"] = { id: "222", username: "company" };
    await provider.retryPendingInstagramConnection();
    assert.equal(state.connection.accountId, "222");
    assert.equal(state.connection.expiresAt.getTime(), expiry);
    assert.equal(state.writes, 1);
    assert.equal(pending.pendingInstagramStatus().available, false);
    assert.equal(
      state.requests.filter(({ url }) =>
        url.pathname.endsWith("/oauth/access_token"),
      ).length,
      1,
    );
    assert.equal(
      state.requests.some(({ options }) => options.method === "POST"),
      false,
    );
  });
});

test("Temporary Instagram authorization expires and is invalidated by configuration changes or token revocation", async () => {
  for (const change of [
    () => {
      process.env.INSTAGRAM_CONFIG_ID = "111";
    },
    () => {
      process.env.META_APP_ID = "111";
    },
    () => {
      process.env.INSTAGRAM_ACCOUNT_ID = "555";
    },
    () => {
      process.env.MARKETING_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    },
  ]) {
    await withUnifiedInstagram(async ({ pending }) => {
      pending.rememberPendingInstagramAuthorization(
        "fixture-suat-token",
        "777",
        null,
        "OAUTH_ACCOUNT_NOT_SHARED",
      );
      change();
      assert.equal(pending.pendingInstagramStatus().available, false);
      assert.throws(
        () => pending.pendingInstagramAuthorization(),
        (error) => error.code === "OAUTH_PENDING_EXPIRED",
      );
    });
  }
  await withUnifiedInstagram(async ({ pending }) => {
    pending.rememberPendingInstagramAuthorization(
      "fixture-suat-token",
      "777",
      null,
      "OAUTH_ACCOUNT_NOT_SHARED",
    );
    const now = Date.now;
    const later = now() + 15 * 60_000 + 1;
    try {
      Date.now = () => later;
      assert.equal(pending.pendingInstagramStatus().available, false);
    } finally {
      Date.now = now;
    }
  });
  await withUnifiedInstagram(async ({ pending, state, provider }) => {
    pending.rememberPendingInstagramAuthorization(
      "fixture-suat-token",
      "777",
      null,
      "OAUTH_ACCOUNT_NOT_SHARED",
    );
    state.inspection.is_valid = false;
    await assert.rejects(
      provider.retryPendingInstagramConnection(),
      (error) => error.code === "TOKEN_EXPIRED",
    );
    assert.equal(pending.pendingInstagramStatus().available, false);
    assert.equal(state.writes, 0);
  });
});

test("Instagram diagnostics require fresh OWNER access and same-origin JSON for provider reads and retries", async () => {
  let status = 401,
    reads = 0,
    retries = 0;
  const access = createLoader({
    "@/lib/chatbot/server-access": {
      resolveChatbotOwner: async () => ({ status }),
    },
  })("src/lib/marketing/security.server.ts");
  const route = createLoader({
    "@/lib/marketing/security.server": access,
    "@/lib/marketing/instagram-pending.server": {
      pendingInstagramStatus: () => ({
        available: true,
        expiresAt: null,
        issue: "OAUTH_ACCOUNT_NOT_SHARED",
      }),
    },
    "@/lib/marketing/instagram-diagnostics.server": {
      inspectPendingInstagramConnection: async () => {
        reads++;
        return { tokenValid: true };
      },
    },
    "@/lib/marketing/instagram.server": {
      retryPendingInstagramConnection: async () => {
        retries++;
      },
    },
  })("src/app/api/dashboard/pemasaran/instagram/diagnostics/route.ts");
  const request = (action, origin = "https://marketing.example.test") =>
    new NextRequest(
      "https://marketing.example.test/api/dashboard/pemasaran/instagram/diagnostics",
      {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(request("inspect"))).status, 401);
  status = 403;
  assert.equal((await route.POST(request("retry"))).status, 403);
  status = 200;
  assert.equal(
    (await route.POST(request("inspect", "https://attacker.example.test")))
      .status,
    403,
  );
  assert.equal(reads, 0);
  assert.equal(retries, 0);
  assert.equal((await route.POST(request("unknown"))).status, 400);
  const response = await route.GET();
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal((await route.POST(request("inspect"))).status, 200);
  assert.equal((await route.POST(request("retry"))).status, 200);
  assert.equal(reads, 1);
  assert.equal(retries, 1);
});

test("Unified Instagram honors finite token and data-access expiration", async () => {
  await withUnifiedInstagram(async ({ state, provider, credentials }) => {
    const now = Date.now();
    state.inspection.expires_at = Math.floor(now / 1000) + 7200;
    state.inspection.data_access_expires_at = Math.floor(now / 1000) + 1800;
    state.tokenResponse.expires_in = 3600;
    await provider.exchangeCode("fixture-code");
    assert.equal(
      state.connection.expiresAt.getTime(),
      state.inspection.data_access_expires_at * 1000,
    );
    state.connection.expiresAt = new Date(now - 1);
    assert.equal(credentials.instagramConnectionReady(state.connection), false);
    await assert.rejects(
      provider.instagramToken(),
      (error) => error.code === "TOKEN_EXPIRED",
    );
  });
});

test("Unified Instagram rejects incomplete or ambiguous authorization without replacing a connection", async () => {
  const cases = [
    [
      (state) => {
        state.inspection.is_valid = false;
      },
      "TOKEN_EXPIRED",
    ],
    [
      (state) => {
        state.inspection.app_id = "000";
      },
      "TOKEN_EXPIRED",
    ],
    [
      (state) => {
        state.inspection.expires_at = Math.floor(Date.now() / 1000) - 1;
      },
      "TOKEN_EXPIRED",
    ],
    [
      (state) => {
        delete state.inspection.expires_at;
      },
      "PROVIDER_ERROR",
    ],
    [
      (state) => {
        state.inspection.scopes.pop();
      },
      "OAUTH_PERMISSIONS_MISSING",
    ],
    [
      (state) => {
        state.business = { id: "999" };
      },
      "OAUTH_BUSINESS_REQUIRED",
    ],
    [
      (state) => {
        state.accounts = { data: [] };
      },
      "OAUTH_ACCOUNT_NOT_SHARED",
    ],
    [
      (state) => {
        state.accounts.data.push({ id: "555", username: "other" });
      },
      "OAUTH_MULTIPLE_ACCOUNTS",
    ],
    [
      (state) => {
        process.env.INSTAGRAM_ACCOUNT_ID = "555";
        state.inspection.granular_scopes = [
          { scope: "instagram_basic", target_ids: ["222"] },
        ];
      },
      "OAUTH_ACCOUNT_MISMATCH",
    ],
    [
      (state) => {
        state.tokenResponse = { error: { message: "fixture-sensitive" } };
      },
      "TOKEN_EXPIRED",
    ],
  ];
  for (const [change, code] of cases) {
    await withUnifiedInstagram(async ({ state, provider }) => {
      state.connection = {
        id: "instagram",
        accountId: "previous",
        tokenCipher: "previous-cipher",
      };
      const previous = { ...state.connection };
      change(state);
      await assert.rejects(
        provider.exchangeCode("fixture-code"),
        (error) => error.code === code,
      );
      assert.deepEqual(state.connection, previous);
      assert.equal(state.writes, 0);
      assert.equal(state.paused, 0);
    });
  }
});

test("Unified Instagram selects an explicitly configured account across safe pagination", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    process.env.INSTAGRAM_ACCOUNT_ID = "555";
    state.accounts.paging = {
      next: "https://untrusted.invalid/token",
      cursors: { after: "next-page" },
    };
    state.nextAccounts = { data: [{ id: "555", username: "company_second" }] };
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "555");
    assert.equal(
      state.requests.at(-1).url.searchParams.get("after"),
      "next-page",
    );
  });
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.accounts.paging = {
      next: "https://untrusted.invalid/",
      cursors: { after: "repeated" },
    };
    state.nextAccounts = state.accounts;
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "PROVIDER_ERROR",
    );
    assert.equal(state.writes, 0);
  });
});

test("Unified Instagram resolves an empty assigned list from validated Instagram token targets", async () => {
  await withUnifiedInstagram(async ({ state, provider, credentials }) => {
    state.accounts = { data: [] };
    state.inspection.granular_scopes = [
      { scope: "ads_management", target_ids: ["777"] },
      { scope: "instagram_basic", target_ids: ["222"] },
    ];
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
    assert.equal(state.connection.username, "company");
    assert.equal(credentials.instagramConnectionReady(state.connection), true);
    assert.ok(state.requests.some(({ url }) => url.pathname === "/v26.0/222"));
    assert.equal(
      state.requests.some(({ url }) => url.pathname === "/v26.0/777"),
      false,
    );
  });
});

test("Unified Instagram granular consent excludes accounts from earlier connections", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.accounts = { data: [{ id: "555", username: "previous_company" }] };
    state.inspection.granular_scopes = [
      { scope: "instagram_basic", target_ids: ["222"] },
    ];
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
  });
});

test("Unified Instagram supports explicit system-user IDs and a newly settled assignment", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.accounts = { data: [] };
    state.inspection.type = "SYSTEM_USER";
    state.inspection.user_id = "444";
    state.explicitAccounts = { data: [{ id: "222", username: "company" }] };
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
    assert.ok(
      state.requests.some(
        ({ url }) => url.pathname === "/v26.0/444/assigned_instagram_accounts",
      ),
    );
  });
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.assignedSequence = [
      { data: [] },
      { data: [{ id: "222", username: "company" }] },
    ];
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
    assert.equal(
      state.requests.filter(({ url }) =>
        url.pathname.endsWith("/assigned_instagram_accounts"),
      ).length,
      2,
    );
  });
});

test("Unified Instagram discovery never treats Page or business grants as Instagram accounts", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.accounts = { data: [] };
    state.inspection.granular_scopes = [
      { scope: "pages_show_list", target_ids: ["222"] },
      { scope: "business_management", target_ids: ["777"] },
    ];
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "OAUTH_ACCOUNT_NOT_SHARED",
    );
    assert.equal(state.writes, 0);
    assert.equal(
      state.requests.some(({ url }) =>
        /\/v26.0\/(222|777)$/.test(url.pathname),
      ),
      false,
    );
    assert.match(JSON.stringify(state.logs), /assignedAccounts/);
    assert.doesNotMatch(
      JSON.stringify(state.logs),
      /fixture-|777|222|access_token|client_secret/,
    );
  });
});

test("Unified Instagram rejects unsafe target IDs and non-Instagram or malformed profiles", async () => {
  const cases = [
    [
      (state) => {
        state.inspection.granular_scopes[0].target_ids = [
          Number.MAX_SAFE_INTEGER + 1,
        ];
      },
      "PROVIDER_ERROR",
    ],
    [
      (state) => {
        state.publishingCapability = {
          error: {
            code: 100,
            error_subcode: 33,
            message:
              "Unsupported get request. Object fixture-private-id is not accessible.",
          },
        };
      },
      "OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE",
    ],
    [
      (state) => {
        state.profiles["222"].username = "";
      },
      "PROVIDER_ERROR",
    ],
  ];
  for (const [change, code] of cases) {
    await withUnifiedInstagram(async ({ state, provider }) => {
      state.accounts = { data: [] };
      state.inspection.granular_scopes = [
        { scope: "instagram_basic", target_ids: ["222"] },
      ];
      change(state);
      await assert.rejects(
        provider.exchangeCode("fixture-code"),
        (error) => error.code === code,
      );
      assert.equal(state.writes, 0);
    });
  }
});

test("Unified Instagram distinguishes profile access failures without logging provider text", async () => {
  for (const [code, error_subcode, message, providerIssue, issue] of [
    [
      100,
      undefined,
      "Tried accessing nonexisting field on fixture-private-object",
      "UNSUPPORTED_FIELD",
      "PROVIDER_ERROR",
    ],
    [
      100,
      33,
      "Unsupported get request. Object fixture-private-object cannot be loaded",
      "OBJECT_UNAVAILABLE",
      "OAUTH_ACCOUNT_PROFILE_UNAVAILABLE",
    ],
    [
      200,
      undefined,
      "Permissions error for fixture-private-object",
      "PERMISSION_DENIED",
      "OAUTH_ACCOUNT_PROFILE_UNAVAILABLE",
    ],
  ]) {
    await withUnifiedInstagram(async ({ state, provider }) => {
      process.env.INSTAGRAM_ACCOUNT_ID = "222";
      state.accounts = { data: [] };
      state.profiles["222"] = { error: { code, error_subcode, message } };
      await assert.rejects(
        provider.exchangeCode("fixture-code"),
        (error) => error.code === issue,
      );
      const diagnostic = state.logs.at(-1)[1];
      assert.equal(diagnostic.stage, "profile");
      assert.equal(diagnostic.providerCode, code);
      assert.equal(diagnostic.providerSubcode, error_subcode ?? null);
      assert.equal(diagnostic.providerIssue, providerIssue);
      assert.equal(state.writes, 0);
      assert.doesNotMatch(
        JSON.stringify(state.logs),
        /fixture-|access_token|client_secret/,
      );
      assert.equal(
        state.requests.some(({ url }) =>
          url.pathname.endsWith("/content_publishing_limit"),
        ),
        false,
      );
    });
  }
});

test("Unified Instagram never silently selects among multiple granular account grants", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.accounts = { data: [] };
    state.inspection.granular_scopes = [
      { scope: "instagram_basic", target_ids: ["222", "555"] },
    ];
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "OAUTH_MULTIPLE_ACCOUNTS",
    );
    assert.equal(state.writes, 0);
    assert.equal(
      state.requests.some(({ url }) => url.pathname === "/v26.0/222"),
      false,
    );
    process.env.INSTAGRAM_ACCOUNT_ID = "555";
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "555");
  });
});

test("Unified Instagram validates an explicit company ID with profile and read-only publishing access", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    process.env.INSTAGRAM_ACCOUNT_ID = "222";
    state.accounts = { data: [] };
    await provider.exchangeCode("fixture-code");
    assert.equal(state.connection.accountId, "222");
    assert.ok(
      state.requests.some(
        ({ url }) => url.pathname === "/v26.0/222/content_publishing_limit",
      ),
    );
    assert.equal(
      state.requests.some(({ options }) => options.method === "POST"),
      false,
    );
  });
  await withUnifiedInstagram(async ({ state, provider }) => {
    process.env.INSTAGRAM_ACCOUNT_ID = "222";
    state.accounts = { data: [] };
    state.publishingCapability = { data: [] };
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE",
    );
    assert.equal(state.writes, 0);
  });
  await withUnifiedInstagram(async ({ state, provider }) => {
    process.env.INSTAGRAM_ACCOUNT_ID = "555";
    state.accounts = { data: [] };
    state.inspection.granular_scopes = [
      { scope: "instagram_basic", target_ids: ["222"] },
    ];
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "OAUTH_ACCOUNT_MISMATCH",
    );
    assert.equal(
      state.requests.some(({ url }) => url.pathname.startsWith("/v26.0/555")),
      false,
    );
    assert.equal(state.writes, 0);
  });
});

test("Unified Instagram account discovery respects the asset targets of publishing permissions", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    state.inspection.granular_scopes = [
      { scope: "instagram_basic", target_ids: ["222"] },
      { scope: "instagram_content_publish", target_ids: ["555"] },
    ];
    await assert.rejects(
      provider.exchangeCode("fixture-code"),
      (error) => error.code === "OAUTH_PERMISSIONS_MISSING",
    );
    assert.equal(state.writes, 0);
  });
});

test("Unified Instagram requires reconnection for legacy, corrupt, or mismatched credentials", async () => {
  await withUnifiedInstagram(async ({ state, provider, credentials }) => {
    await provider.exchangeCode("fixture-code");
    const valid = { ...state.connection };
    for (const tokenCipher of [
      null,
      security.encryptToken("legacy-token"),
      "meta-unified-v1.corrupt",
    ]) {
      state.connection = { ...valid, tokenCipher };
      assert.equal(
        credentials.instagramConnectionReady(state.connection),
        false,
      );
      await assert.rejects(
        provider.instagramToken(),
        (error) => error.code === "OAUTH_RECONNECT_REQUIRED",
      );
    }
    state.connection = { ...valid, accountId: "000" };
    assert.equal(credentials.instagramConnectionReady(state.connection), false);
    state.connection = valid;
    process.env.INSTAGRAM_CONFIG_ID = "111";
    await assert.rejects(
      provider.instagramToken(),
      (error) => error.code === "OAUTH_RECONNECT_REQUIRED",
    );
  });
});

test("Unified Instagram pauses automation when the connected account or business changes", async () => {
  await withUnifiedInstagram(async ({ state, provider }) => {
    await provider.exchangeCode("fixture-code");
    await provider.exchangeCode("fixture-code");
    assert.equal(
      state.paused,
      0,
      "Reconnecting the same account and portfolio retains the current settings",
    );
    state.business.client_business_id = "888";
    await provider.exchangeCode("fixture-code");
    assert.equal(state.paused, 1);
    state.accounts.data = [{ id: "555", username: "other_company" }];
    await provider.exchangeCode("fixture-code");
    assert.equal(state.paused, 2);
  });
});
test("Instagram callback explains safe failure stages and never leaks codes, state or provider text", async () => {
  let ownerError = null;
  const exchanged = [];
  const logs = [];
  const previousWarn = console.warn;
  const callback = createLoader({
    "@/lib/marketing/security.server": {
      ...security,
      requireMarketingOwner: async () => {
        if (ownerError) throw new security.MarketingError(ownerError);
      },
      publicOrigin: () => "https://marketing.example.test",
    },
    "@/lib/marketing/instagram.server": {
      exchangeCode: async (code) => {
        exchanged.push(code);
        if (code === "fixture-rejected-code")
          throw new security.MarketingError("TOKEN_EXPIRED");
        if (code === "fixture-provider-failure")
          throw new Error("fixture-sensitive-provider-text");
      },
    },
  })("src/app/api/dashboard/pemasaran/instagram/callback/route.ts");
  const call = async (query, cookie = "fixture-state") => {
    const response = await callback.GET(
      new NextRequest(
        "https://marketing.example.test/api/dashboard/pemasaran/instagram/callback?" +
          new URLSearchParams(query),
        { headers: { cookie: "marketing_ig_state=" + cookie } },
      ),
    );
    assert.equal(response.cookies.get("marketing_ig_state").maxAge, 0);
    const location = response.headers.get("location");
    assert.doesNotMatch(
      location,
      /fixture-|sensitive-provider|error_description/,
    );
    return new URL(location);
  };
  console.warn = (...args) => logs.push(args);
  try {
    const success = await call({
      state: "fixture-state",
      code: "fixture-code",
    });
    assert.equal(success.searchParams.get("instagram"), "success");
    assert.equal(success.searchParams.get("instagramError"), null);
    assert.equal(
      (await call({ state: "wrong", code: "fixture-code" })).searchParams.get(
        "instagramError",
      ),
      "OAUTH_STATE_INVALID",
    );
    assert.equal(
      (
        await call({
          state: "fixture-state",
          error: "access_denied",
          error_description: "fixture-sensitive-provider-text",
        })
      ).searchParams.get("instagramError"),
      "OAUTH_ACCESS_DENIED",
    );
    assert.equal(
      (await call({ state: "fixture-state" })).searchParams.get(
        "instagramError",
      ),
      "OAUTH_CODE_MISSING",
    );
    assert.deepEqual(
      exchanged,
      ["fixture-code"],
      "Invalid state and rejected/missing authorization never exchange a code",
    );
    assert.equal(
      (
        await call({ state: "fixture-state", code: "fixture-rejected-code" })
      ).searchParams.get("instagramError"),
      "OAUTH_TOKEN_REJECTED",
    );
    assert.equal(
      (
        await call({ state: "fixture-state", code: "fixture-provider-failure" })
      ).searchParams.get("instagramError"),
      "INSTAGRAM_CONNECTION_FAILED",
    );
    ownerError = "UNAUTHENTICATED";
    assert.equal(
      (
        await call({ state: "fixture-state", code: "fixture-code" })
      ).searchParams.get("instagramError"),
      "OAUTH_SESSION_REQUIRED",
    );
    ownerError = "FORBIDDEN";
    assert.equal(
      (
        await call({ state: "fixture-state", code: "fixture-code" })
      ).searchParams.get("instagramError"),
      "OAUTH_FORBIDDEN",
    );
    assert.doesNotMatch(JSON.stringify(logs), /fixture-|sensitive-provider/);
  } finally {
    console.warn = previousWarn;
  }
});
function workerFixture() {
  const c = { ...config(), enabled: true, whatsappAccount: "6281234567890" },
    assets = [listing()],
    publications = [];
  let job = {
    id: "11111111-1111-4111-8111-111111111111",
    scheduledFor: new Date(Date.now() - 10000),
    settingsRevision: 1,
    status: "queued",
    reason: null,
    listingId: "1",
    assetKey: domain.assetIdentity(assets[0]),
    snapshot: domain.snapshotAsset(assets[0]),
    caption: domain.captionFor(domain.snapshotAsset(assets[0]), c),
    media: [
      { name: "feed.jpg", channel: "instagram" },
      { name: "story.jpg", channel: "whatsapp" },
    ],
  };
  const calls = {
      instagram: 0,
      whatsapp: 0,
      render: 0,
      ranked: [],
      slots: [],
      whatsappBodies: [],
      mediaReads: [],
    },
    state = {
      failWa: false,
      ambiguousIg: false,
      failPhotos: new Set(),
      excluded: new Set(),
      currentPrice: 400e6,
      inactive: false,
      marketed: [],
      assigned: [],
    };
  const apply = (row, data) => {
    for (const [key, value] of Object.entries(data))
      row[key] =
        value && typeof value === "object" && "increment" in value
          ? (row[key] || 0) + value.increment
          : value;
    return { ...row };
  };
  const matches = (row, where) =>
    !where ||
    Object.entries(where).every(([key, value]) => {
      if (key === "jobId") return row.jobId === value;
      if (value && typeof value === "object" && "in" in value)
        return value.in.includes(row[key]);
      return row[key] === value;
    });
  const db = {
    listing: {
      findUnique: async ({ where }) => {
        const asset = assets.find(
          (item) => item.id === String(where.id_property),
        );
        return asset
          ? {
              status_tayang: state.inactive ? "TERJUAL" : "TERSEDIA",
              bukan_properti: false,
              jenis_transaksi: asset.listingCategory,
              harga: state.currentPrice,
              harga_promo: null,
              nilai_limit_lelang: null,
              tanggal_lelang: asset.auctionDate
                ? new Date(asset.auctionDate)
                : null,
              gambar: asset.imageUrls.join(","),
              alamat_lengkap: asset.address,
              luas_tanah: asset.landAreaSqm,
            }
          : null;
      },
    },
    marketingJob: {
      findMany: async ({ where } = {}) => {
        if (where?.publications) return state.marketed;
        if (where?.status?.in)
          return state.assigned.filter(
            (other) =>
              !where.scheduledFor?.lt ||
              other.scheduledFor < where.scheduledFor.lt,
          );
        return [];
      },
      updateMany: async () => ({ count: 0 }),
      findUnique: async ({ where }) =>
        (
          where.id
            ? where.id === job.id
            : where.scheduledFor?.getTime() === job.scheduledFor.getTime()
        )
          ? { ...job, publications }
          : null,
      upsert: async ({ create }) => {
        if (job.scheduledFor.getTime() !== create.scheduledFor.getTime())
          job = {
            ...job,
            ...create,
            listingId: null,
            assetKey: null,
            snapshot: {},
            caption: "",
            status: "queued",
          };
        return { ...job, publications };
      },
      createMany: async ({ data }) => {
        calls.slots.push(...data);
        return { count: data.length };
      },
      update: async ({ data }) => {
        job = apply(job, data);
        return { ...job };
      },
    },
    marketingSettings: { updateMany: async () => ({ count: 1 }) },
    marketingConnection: { updateMany: async () => ({ count: 1 }) },
    marketingPublication: {
      findMany: async ({ where } = {}) =>
        publications
          .filter((row) => matches(row, where))
          .map((row) => ({ ...row })),
      findUniqueOrThrow: async ({ where }) => ({
        ...publications.find((row) => row.id === where.id),
      }),
      upsert: async ({ create }) => {
        const existing = publications.find(
          (row) => row.jobId === create.jobId && row.channel === create.channel,
        );
        if (existing) return { ...existing };
        const row = {
          ...create,
          id: create.channel + "-id",
          state: "pending",
          containerId: null,
          attemptCount: 0,
          nextAttemptAt: null,
        };
        publications.push(row);
        return { ...row };
      },
      update: async ({ where, data }) =>
        apply(
          publications.find((row) => row.id === where.id),
          data,
        ),
      updateMany: async ({ where, data }) => {
        const rows = publications.filter((row) => matches(row, where));
        rows.forEach((row) => apply(row, data));
        return { count: rows.length };
      },
    },
  };
  class InstagramError extends security.MarketingError {
    constructor(code, uncertain = false, retryable = false) {
      super(code, 503);
      this.uncertain = uncertain;
      this.retryable = retryable;
    }
  }
  const mocks = {
    "./campaigns.server": { refreshCampaignQueues: async () => false },
    "./campaign-reminders.server": { runCampaignReminders: async () => ({}) },
    "./campaign-periods.server": {
      activeCampaignPeriods: async () => state.campaignPeriods || [],
      pendingCampaignSummaries: async () => state.pendingCampaigns || [],
    },
    "@/lib/prisma": { default: db, __esModule: true },
    "@/lib/chatbot/server-access": {
      resolveChatbotOwner: async () => ({ status: 200 }),
    },
    "@/lib/investor-read.server": {
      withInvestorRead: async (callback) => callback({}),
    },
    "@/lib/investor-cma-legacy.server": {
      getMarketingInvestorCandidates: async (
        reader,
        filters,
        excluded,
        offset = 0,
      ) => {
        calls.ranked.push({ filters, excluded: [...excluded], offset });
        const available = assets.filter(
          (item) =>
            !excluded.has(domain.assetIdentity(item)) &&
            (!filters.query || filters.query === item.id),
        );
        return {
          items: available.slice(offset, offset + 30),
          total: available.length,
        };
      },
    },
    "./store.server": {
      getSettings: async () => ({ config: c }),
      recentAssetKeys: async () => new Set(state.excluded),
      json: (value) => JSON.parse(JSON.stringify(value)),
    },
    "./security.server": {
      ...security,
      mediaUrl: (id, name) =>
        "https://marketing.example.test/" + id + "/" + name,
    },
    "./media.server": {
      buildMarketingMedia: async (id, snapshot) => {
        calls.render++;
        if (state.failPhotos.has(snapshot.id))
          throw new security.MarketingError("PHOTO_UNAVAILABLE");
        return job.media;
      },
      readMarketingMedia: async (id, name) => {
        calls.mediaReads.push(name);
        return Buffer.from("jpeg");
      },
      probePublicMedia: async () => {},
    },
    "./instagram.server": {
      InstagramError,
      instagramToken: async () => ({
        token: "test",
        account: { accountId: "123" },
      }),
      createContainer: async () => "12345",
      containerStatus: async () => ({ status_code: "FINISHED" }),
      graph: async () => ({ permalink: "https://instagram.com/p/test" }),
      publishContainer: async () => {
        calls.instagram++;
        if (state.ambiguousIg)
          throw new InstagramError("DELIVERY_UNCERTAIN", true);
        return { id: "published-id" };
      },
    },
    "./whatsapp.server": {
      whatsappRequest: async (path, body) => {
        if (path === "status")
          return {
            connected: !state.failWa,
            tested_at: Date.now(),
            phone: "6281234567890",
          };
        if (path === "statuses") {
          calls.whatsapp++;
          calls.whatsappBodies.push(body);
          return { state: "published", message_id: "wa-id" };
        }
        return { state: "uncertain" };
      },
    },
  };
  const service = createLoader(mocks)("src/lib/marketing/service.server.ts");
  return {
    service,
    db,
    config: c,
    assets,
    publications,
    calls,
    state,
    job: () => job,
    setJob: (value) => {
      job = { ...job, ...value };
    },
  };
}
test("lifetime publication evidence blocks a new job before either channel dispatches", async () => {
  const f = workerFixture();
  f.state.marketed.push({
    id: "published-months-ago",
    assetKey: "legacy-alias",
    listingId: null,
    snapshot: { id: f.job().snapshot.id },
    plan: {},
  });
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
  assert.equal(f.job().reason, "ASSET_ALREADY_MARKETED");
  assert.equal(f.job().status, "review");
});

test("an earlier paused assignment blocks a duplicate dispatch while a later duplicate cannot block the first job", async () => {
  const f = workerFixture();
  f.state.assigned.push({
    id: "earlier-paused-job",
    assetKey: f.job().assetKey,
    snapshot: {},
    plan: {},
    scheduledFor: new Date(f.job().scheduledFor.getTime() - 8 * 86400000),
  });
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
  assert.equal(f.job().reason, "SELECTED_ASSET_UNAVAILABLE");
  const first = workerFixture();
  first.state.assigned.push({
    id: "later-duplicate",
    assetKey: first.job().assetKey,
    snapshot: {},
    plan: {},
    scheduledFor: new Date(first.job().scheduledFor.getTime() + 8 * 86400000),
  });
  await first.service.processMarketingJob(first.job(), first.config);
  assert.equal(first.calls.instagram, 1);
  assert.equal(first.calls.whatsapp, 1);
  assert.equal(first.job().status, "completed");
});

test("restart records every missed Jakarta slot across a multi-day outage without sending a backlog", async () => {
  const f = workerFixture();
  await f.service.ensureSlots(
    f.config,
    new Date("2026-10-29T05:00:00Z"),
    new Date("2026-10-26T04:00:00Z"),
  );
  assert.equal(f.calls.slots.length, 15);
  const missed = f.calls.slots.filter((slot) => slot.status === "skipped");
  assert.equal(missed.length, 10);
  assert.ok(missed.every((slot) => slot.reason === "MISSED_SLOT"));
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
  f.config.enabled = false;
  await f.service.ensureSlots(
    f.config,
    new Date("2026-10-29T05:00:00Z"),
    new Date("2026-10-26T04:00:00Z"),
  );
  assert.ok(
    f.calls.slots
      .slice(15)
      .filter((slot) => slot.status === "skipped")
      .every((slot) => slot.reason === "PAUSED"),
  );
});
test("partial failure retries only the failed channel and never republishes Instagram", async () => {
  const f = workerFixture();
  f.state.failWa = true;
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.calls.instagram, 1);
  assert.equal(f.calls.whatsapp, 0);
  assert.equal(
    f.publications.find((row) => row.channel === "instagram").state,
    "published",
  );
  const wa = f.publications.find((row) => row.channel === "whatsapp");
  assert.equal(wa.state, "pending");
  wa.nextAttemptAt = new Date(0);
  f.state.failWa = false;
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.calls.instagram, 1);
  assert.equal(f.calls.whatsapp, 1);
  assert.equal(f.calls.whatsappBodies[0].caption, "");
  assert.equal(
    f.calls.whatsappBodies[0].imageBase64,
    Buffer.from("jpeg").toString("base64"),
  );
  assert.deepEqual(f.calls.mediaReads, ["story.jpg"]);
  assert.equal(f.job().status, "completed");
});
test("ambiguous Instagram publication remains reviewable and is not sent again after restart", async () => {
  const f = workerFixture();
  f.state.ambiguousIg = true;
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(
    f.publications.find((row) => row.channel === "instagram").state,
    "uncertain",
  );
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.calls.instagram, 1);
  assert.equal(f.calls.whatsapp, 1);
  assert.equal(f.job().status, "review");
});
test("price and availability are verified against the source even when a stored valuation remains unchanged", async () => {
  for (const change of [{ currentPrice: 800e6 }, { inactive: true }]) {
    const f = workerFixture();
    Object.assign(f.state, change);
    await f.service.processMarketingJob(f.job(), f.config);
    assert.equal(f.calls.instagram, 0);
    assert.equal(f.calls.whatsapp, 0);
    assert.equal(f.job().status, "skipped");
  }
});
test("pause or changed rule revision blocks side effects", async () => {
  for (const change of [{ enabled: false }, { revision: 2 }]) {
    const f = workerFixture();
    Object.assign(f.config, change);
    await f.service.processMarketingJob(f.job(), f.config);
    assert.equal(f.calls.instagram, 0);
    assert.equal(f.calls.whatsapp, 0);
  }
});
test("selection scans beyond page one, uses shared ranking and respects asset cooldown", async () => {
  const f = workerFixture();
  f.setJob({ listingId: null, assetKey: null });
  f.assets.splice(
    0,
    f.assets.length,
    ...Array.from({ length: 35 }, (_, index) => listing(String(index + 1))),
  );
  for (let index = 1; index <= 30; index++)
    f.state.failPhotos.add(String(index));
  f.state.excluded.add("asset:parcel-31");
  const prepared = await f.service.prepareMarketingJob(f.job(), f.config);
  assert.equal(prepared.listingId, "32");
  assert.equal(f.calls.ranked[1].offset, 30);
  assert.equal(f.calls.ranked[0].filters.dataState, "deals");
  assert.equal(f.calls.ranked[0].filters.sort, "score");
  assert.ok(f.calls.ranked[0].excluded.includes("asset:parcel-31"));
});
test("no matching asset skips the slot without relaxing filters", async () => {
  const f = workerFixture();
  f.assets.length = 0;
  f.setJob({ listingId: null, assetKey: null });
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().reason, "NO_ELIGIBLE_ASSET");
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
});
test("Instagram provider handles per-metric absence and makes no claims about private viewer lists", async () => {
  const previous = global.fetch;
  global.fetch = async (url) => {
    const metric = new URL(url).searchParams.get("metric");
    return Response.json(
      metric === "views"
        ? { data: [{ name: "views", values: [{ value: 42 }] }] }
        : metric.includes(",")
          ? { data: [{ name: "views", values: [{ value: 42 }] }] }
          : { data: [] },
    );
  };
  try {
    const provider = createLoader({
      "@/lib/prisma": {},
      "./security.server": security,
    })("src/lib/marketing/instagram.server.ts");
    const result = await provider.instagramMetrics("123", "test-token");
    assert.equal(result.values.views, 42);
    assert.equal(result.values.likes, null);
    assert.equal(result.reason, "METRICS_UNAVAILABLE");
  } finally {
    global.fetch = previous;
  }
});
test("Instagram explicit rate rejection is retryable, while publication timeout is uncertain", async () => {
  const previous = global.fetch;
  const provider = createLoader({
    "@/lib/prisma": {},
    "./security.server": security,
  })("src/lib/marketing/instagram.server.ts");
  try {
    global.fetch = async () =>
      Response.json({ error: { code: 4 } }, { status: 429 });
    await assert.rejects(
      provider.publishContainer("1", "2", "test"),
      (error) =>
        error.code === "RATE_LIMIT" && error.retryable && !error.uncertain,
    );
    global.fetch = async () => {
      throw new Error("network");
    };
    await assert.rejects(
      provider.publishContainer("1", "2", "test"),
      (error) => error.code === "DELIVERY_UNCERTAIN" && error.uncertain,
    );
  } finally {
    global.fetch = previous;
  }
});

test("planner calendar handles Jakarta month boundaries, Monday alignment and leap years", () => {
  assert.equal(planner.monthDays("2028-02").length, 29);
  assert.equal(
    planner.monthBounds("2026-10").start.toISOString(),
    "2026-09-30T17:00:00.000Z",
  );
  assert.deepEqual(planner.calendarDays("2026-10").slice(0, 4), [
    null,
    null,
    null,
    "2026-10-01",
  ]);
  assert.equal(planner.calendarDays("2026-10").length % 7, 0);
  assert.equal(planner.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(planner.shiftMonth("2026-01", -1), "2025-12");
  assert.throws(() => planner.monthBounds("2026-13"));
});
test("month reads use one bounded query without connection probes or slot writes", async () => {
  const f = workerFixture();
  let queries = 0;
  const jobs = [{ ...f.job(), publications: [] }];
  f.db.marketingJob.findMany = async ({ where, include }) => {
    queries++;
    assert.equal(
      where.scheduledFor.gte.toISOString(),
      "2026-09-30T17:00:00.000Z",
    );
    assert.equal(
      where.scheduledFor.lt.toISOString(),
      "2026-10-31T17:00:00.000Z",
    );
    assert.equal(include.publications.include.metrics.take, 1);
    return jobs;
  };
  // An accidental dashboard/connection read fails because its DB methods are
  // deliberately absent from this fixture.
  const result = await f.service.plannerMonth("2026-10");
  assert.equal(result.month, "2026-10");
  assert.equal(result.jobs, jobs);
  assert.ok(result.now instanceof Date);
  assert.equal(queries, 1);
  assert.equal(f.calls.slots.length, 0);
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
  await assert.rejects(f.service.plannerMonth("2026-13"));
  assert.equal(queries, 1);
});
test("campaign appearance keeps creation identity across months, reordered results and new campaigns", async () => {
  const f = workerFixture();
  let identities = ["old", "first", "second"].map((id) => ({ id }));
  f.db.marketingCampaign = {
    findMany: async (query) => {
      assert.deepEqual(query.select, { id: true });
      assert.deepEqual(query.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
      return identities;
    },
  };
  const period = (id) => ({
    startDate: "2026-10-28",
    endDate: "2026-11-05",
    plan: {
      id,
      name: id,
      state: "running",
      channels: ["instagram"],
      schedules: ["10:00"],
    },
  });
  f.state.campaignPeriods = [period("second"), period("first")];
  const october = await f.service.plannerMonth("2026-10");
  assert.deepEqual(
    october.campaignPeriods.map((p) => [p.plan.id, p.plan.appearanceIndex]),
    [
      ["second", 2],
      ["first", 1],
    ],
  );
  identities = [...identities, { id: "new" }];
  f.state.campaignPeriods = [period("first"), period("second"), period("new")];
  const november = await f.service.plannerMonth("2026-11");
  assert.deepEqual(
    november.campaignPeriods.map((p) => [p.plan.id, p.plan.appearanceIndex]),
    [
      ["first", 1],
      ["second", 2],
      ["new", 3],
    ],
  );
  assert.equal(f.calls.slots.length, 0);
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
});
test("campaign references remain distinct after the colour palette repeats", () => {
  const { plannerCampaignAppearance } = load(
    "src/app/dashboard/pemasaran/components/planner-campaign-appearance.ts",
  );
  const identities = Array.from({ length: 40 }, (_, appearanceIndex) =>
    plannerCampaignAppearance({ id: String(appearanceIndex), appearanceIndex }),
  );
  assert.equal(
    new Set(
      identities
        .slice(0, 12)
        .map((identity) => identity.style["--planner-campaign-accent"]),
    ).size,
    12,
  );
  assert.equal(new Set(identities.map((identity) => identity.code)).size, 40);
  assert.equal(
    identities[0].style["--planner-campaign-accent"],
    identities[12].style["--planner-campaign-accent"],
  );
  assert.notEqual(identities[0].pattern, identities[12].pattern);
  assert.notEqual(identities[12].pattern, identities[24].pattern);
});
test("planner projects future slots and preserves actual history without inventing past posts", () => {
  const now = new Date("2026-10-26T01:00:00Z"),
    c = config();
  const history = {
    id: "past",
    scheduledFor: new Date("2026-10-20T02:00:00Z"),
    status: "completed",
    listingId: "1",
    publications: [{ channel: "instagram", state: "published" }],
  };
  const slots = planner.plannerSlots(c, [history], "2026-10", now);
  assert.equal(slots.length, 19);
  assert.equal(slots.filter((slot) => slot.date < "2026-10-26").length, 1);
  assert.deepEqual(slots.find((slot) => slot.key === "past").channels, [
    "instagram",
  ]);
  assert.equal(planner.slotState(null), "automatic");
  assert.equal(planner.slotState({ ...history, status: "queued" }), "ready");
  assert.equal(planner.slotState(history), "completed");
});
test("planning is limited to saved future slots within ninety days", () => {
  const c = config(),
    now = new Date("2026-10-26T01:00:00Z");
  assert.equal(
    planner.canPrepareSlot(c, new Date("2026-10-26T02:00:00Z"), now),
    true,
  );
  assert.equal(
    planner.canPrepareSlot(c, new Date("2026-10-26T02:01:00Z"), now),
    false,
  );
  assert.equal(
    planner.canPrepareSlot(c, new Date("2026-10-25T02:00:00Z"), now),
    false,
  );
  assert.equal(
    planner.canPrepareSlot(c, new Date("2027-03-01T02:00:00Z"), now),
    false,
  );
  assert.equal(planner.canPrepareSlot(c, new Date("invalid"), now), false);
});
test("preparing a dated slot works while paused and never publishes a channel", async () => {
  const f = workerFixture();
  f.config.enabled = false;
  const when = domain
    .scheduledSlots(f.config, new Date(Date.now() + 86400000))[0]
    .toISOString();
  const result = await f.service.preparePlannedSlot(when);
  assert.equal(new Date(result.scheduledFor).toISOString(), when);
  assert.equal(result.listingId, "1");
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
  f.setJob({ status: "publishing" });
  await assert.rejects(
    f.service.preparePlannedSlot(when),
    (error) => error.code === "PLANNING_SLOT_LOCKED",
  );
});
test("future content excludes an auction that ends before the planned publication date", async () => {
  const f = workerFixture();
  f.assets.splice(
    0,
    f.assets.length,
    listing("1", {
      listingCategory: "LELANG",
      auctionDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    }),
    listing("2"),
  );
  f.setJob({
    listingId: null,
    scheduledFor: new Date(Date.now() + 3 * 86400000),
  });
  const result = await f.service.prepareMarketingJob(f.job(), f.config);
  assert.equal(result.listingId, "2");
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
});
test("manual plan validation accepts custom future minutes and rejects invalid times, empty channels and stale edits", () => {
  const when = planDomain.localPlanTime("2026-10-27", "10:17");
  assert.equal(when.toISOString(), "2026-10-27T03:17:00.000Z");
  assert.equal(planDomain.localPlanTime("2026-02-30", "10:17"), null);
  assert.equal(planDomain.localPlanTime("2026-10-27", "24:00"), null);
  assert.equal(
    planDomain.validPlanTime(when, new Date("2026-10-26T00:00:00Z")),
    true,
  );
  assert.equal(
    planDomain.validPlanTime(when, new Date("2026-10-28T00:00:00Z")),
    false,
  );
  const input = {
    sourceScheduledFor: when.toISOString(),
    scheduledFor: when.toISOString(),
    listingId: null,
    channels: ["instagram"],
  };
  assert.equal(planDomain.configurePlanSchema.safeParse(input).success, true);
  assert.equal(
    planDomain.configurePlanSchema.safeParse({ ...input, channels: [] })
      .success,
    false,
  );
  assert.equal(
    planDomain.configurePlanSchema.safeParse({
      ...input,
      channels: ["instagram", "instagram"],
    }).success,
    false,
  );
  assert.equal(
    planDomain.configurePlanSchema.safeParse({
      ...input,
      jobId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
  assert.equal(
    planDomain.editablePlan({ status: "skipped", publications: [] }),
    true,
  );
  for (const state of ["published", "sending", "uncertain"])
    assert.equal(
      planDomain.editablePlan({
        status: "queued",
        publications: [{ state, attemptCount: 0 }],
      }),
      false,
    );
});
test("a manually chosen property never falls back to another ranked asset", async () => {
  const f = workerFixture();
  f.assets.push(listing("2"));
  f.setJob({
    listingId: null,
    plan: { kind: "manual", listingId: "2", channels: ["instagram"] },
  });
  assert.equal(
    (await f.service.prepareMarketingJob(f.job(), f.config)).listingId,
    "2",
  );
  f.assets.pop();
  await assert.rejects(
    f.service.prepareMarketingJob(f.job(), f.config),
    (error) => error.code === "SELECTED_ASSET_UNAVAILABLE",
  );
  assert.equal(f.calls.render, 1);
});
test("manual channels survive preparation and a configuration revision without publishing other channels", async () => {
  const f = workerFixture();
  f.setJob({
    plan: { kind: "manual", listingId: "1", channels: ["instagram"] },
  });
  f.config.revision++;
  await f.service.processMarketingJob(f.job(), f.config);
  assert.equal(f.job().settingsRevision, f.config.revision);
  assert.equal(f.calls.instagram, 1);
  assert.equal(f.calls.whatsapp, 0);
  assert.equal(f.publications.length, 1);
});
test("a moved slot suppresses its original automatic projection and keeps its own channels", () => {
  const now = new Date("2026-10-26T01:00:00Z");
  const jobs = [
    {
      id: "moved",
      scheduledFor: "2026-10-27T03:17:00Z",
      status: "queued",
      listingId: null,
      plan: { kind: "manual", listingId: "1", channels: ["instagram"] },
      publications: [],
    },
    {
      id: "marker",
      scheduledFor: "2026-10-27T02:00:00Z",
      status: "skipped",
      reason: "RESCHEDULED",
      listingId: null,
      publications: [],
    },
  ];
  const slots = planner.plannerSlots(config(), jobs, "2026-10", now);
  assert.equal(
    slots.some(
      (slot) =>
        new Date(slot.scheduledFor).getTime() ===
        Date.parse(jobs[1].scheduledFor),
    ),
    false,
  );
  assert.deepEqual(slots.find((slot) => slot.key === "moved").channels, [
    "instagram",
  ]);
  assert.equal(planner.slotState(jobs[0], now), "planned");
});
test("a saved custom-time plan can prepare media while automation is paused", async () => {
  const f = workerFixture();
  f.config.enabled = false;
  const when = new Date(Date.now() + 86400000);
  when.setUTCHours(3, 17, 0, 0);
  f.setJob({
    scheduledFor: when,
    listingId: null,
    plan: { kind: "manual", listingId: "1", channels: ["instagram"] },
  });
  const prepared = await f.service.preparePlannedSlot(when.toISOString());
  assert.equal(prepared.listingId, "1");
  assert.equal(prepared.scheduledFor.toISOString(), when.toISOString());
  assert.equal(f.calls.instagram + f.calls.whatsapp, 0);
});

test("carousel materials preserve every source photo after the design cover, including a single photo", async () => {
  const sharp = require("sharp");
  const fs = require("node:fs/promises");
  const source = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#a02b37" },
  })
    .jpeg()
    .toBuffer();
  const writes = new Map();
  const rendered = [];
  const mediaModule = createLoader({
    "node:dns/promises": { lookup: async () => [{ address: "93.184.216.34" }] },
    "node:fs/promises": {
      mkdir: async () => {},
      readFile: fs.readFile,
      writeFile: async (file, bytes) =>
        writes.set(require("node:path").basename(file), bytes),
    },
    "@/lib/server/posterRender": {
      renderStoryPoster: async (html) => {
        rendered.push(html);
        return source;
      },
    },
    "@/lib/fotoListing": { resolveFetchableImage: (value) => value },
  })("src/lib/marketing/media.server.ts");
  const previousFetch = global.fetch;
  global.fetch = async () =>
    new Response(source, { headers: { "content-type": "image/jpeg" } });
  try {
    for (const count of [1, 3]) {
      writes.clear();
      const asset = domain.snapshotAsset(
        listing("1", {
          imageUrls: Array.from(
            { length: count },
            (_, i) => `https://property.example.test/${i}.jpg`,
          ),
        }),
      );
      const result = await mediaModule.buildMarketingMedia(
        "a0000000-0000-0000-0000-000000000001",
        asset,
        config(),
      );
      assert.deepEqual(
        result
          .filter((item) => item.channel === "instagram")
          .map((item) => item.name),
        [
          "feed.jpg",
          ...Array.from({ length: count }, (_, i) => `photo-${i + 1}.jpg`),
        ],
      );
      assert.ok(
        writes.has("photo-1.jpg"),
        "The cover's source photograph must still have its own detail slide",
      );
      const photo = await sharp(writes.get("photo-1.jpg")).metadata();
      assert.equal(photo.width, 1080);
      assert.equal(photo.height, 1350);
    }
    assert.equal(rendered.length, 4);
    assert.ok(
      rendered.every(
        (html) =>
          html.includes("story-frame") && html.includes("Informasi properti"),
      ),
    );
    assert.equal(
      mediaModule.validMediaPath(
        "a0000000-0000-0000-0000-000000000001",
        "photo-3.jpg",
      ),
      true,
    );
    assert.equal(
      mediaModule.validMediaPath(
        "a0000000-0000-0000-0000-000000000001",
        "../photo-3.jpg",
      ),
      false,
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test("Instagram dispatch requires a carousel and preserves cover-to-photo order", async () => {
  const instagram = load("src/lib/marketing/instagram.server.ts");
  const calls = [];
  const previousFetch = global.fetch;
  global.fetch = async (_url, init) => {
    calls.push(new URLSearchParams(init.body));
    return Response.json({ id: String(100 + calls.length) });
  };
  try {
    for (const urls of [[], ["cover"], ["1", "2", "3", "4", "5"]])
      await assert.rejects(
        () => instagram.createContainer("222", "test-token", urls, "Caption"),
        (error) => error.code === "CAROUSEL_REQUIRED",
      );
    assert.equal(
      calls.length,
      0,
      "Invalid media must fail before any external dispatch",
    );
    const id = await instagram.createContainer(
      "222",
      "test-token",
      ["https://example.test/cover.jpg", "https://example.test/photo.jpg"],
      "Caption",
    );
    assert.equal(id, "103");
    assert.equal(calls[0].get("image_url"), "https://example.test/cover.jpg");
    assert.equal(calls[1].get("image_url"), "https://example.test/photo.jpg");
    assert.equal(calls[2].get("media_type"), "CAROUSEL");
    assert.equal(calls[2].get("children"), "101,102");
  } finally {
    global.fetch = previousFetch;
  }
});

test("cover artwork escapes source facts and omits unknown prices", () => {
  const { propertyCoverHtml } = load("src/lib/marketing/property-cover.ts");
  const html = propertyCoverHtml({
    brand: "Solusindo",
    title: '<img src=x onerror="alert(1)">',
    location: "A & B",
    category: "Rumah",
    photo: "data:image/jpeg;base64,AAAA",
    sample: true,
  });
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("A &amp; B"));
  assert.equal(html.includes("<img src=x"), false);
  assert.equal(html.includes("Harga penawaran"), false);
  assert.ok(html.includes("BUKAN PENAWARAN AKTIF"));
});

test("an overdue queued planner slot is missed without hiding provider evidence", () => {
  const now = new Date("2026-11-01T04:00:00Z");
  const job = {
    status: "queued",
    scheduledFor: "2026-11-01T02:00:00Z",
    publications: [],
  };
  assert.equal(planner.slotState(job, now), "missed");
  assert.notEqual(
    planner.slotState({ ...job, publications: [{ state: "sending" }] }, now),
    "missed",
  );
  assert.notEqual(
    planner.slotState({ ...job, publications: [{ state: "published" }] }, now),
    "missed",
  );
});
