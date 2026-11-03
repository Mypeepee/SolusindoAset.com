const test = require("node:test");
const assert = require("node:assert/strict");
const createLoader = require("./lib/marketing-test-loader.cjs");

function fixture() {
  class MarketingError extends Error {
    constructor(code, status = 400) {
      super(code);
      this.code = code;
      this.status = status;
    }
  }
  class InstagramError extends MarketingError {
    constructor(code, uncertain = false) {
      super(code, 503);
      this.uncertain = uncertain;
    }
  }
  const account = {
    accountId: "17841411111111111",
    username: "fixture_company",
  };
  const rows = new Map(),
    calls = [];
  const state = {
    mode: "facebook",
    scopes: [
      "instagram_manage_insights",
      "instagram_manage_comments",
      "instagram_manage_contents",
    ],
    granular: [],
    updates: [],
    owner: account.accountId,
    commentMedia: "18011111111111111",
    metricFailure: false,
    metricMissing: false,
    writeError: null,
    badAck: false,
    insertCount: 0,
    valid: true,
    after: true,
    role: 200,
  };
  const media = {
    id: "18011111111111111",
    owner: { id: account.accountId },
    caption: "Fixture posting",
    media_type: "CAROUSEL_ALBUM",
    media_product_type: "FEED",
    media_url: "https://scontent.cdninstagram.com/fixture.jpg",
    permalink: "https://www.instagram.com/p/fixture/",
    timestamp: "2026-10-28T10:00:00+0000",
    like_count: 0,
    comments_count: 2,
    is_comment_enabled: true,
    children: {
      data: [
        {
          id: "18022222222222222",
          media_type: "IMAGE",
          media_url: "https://scontent.cdninstagram.com/child.jpg",
        },
      ],
    },
  };
  const db = {
    marketingPublication: {
      updateMany: async (input) => {
        state.updates.push(input);
        return { count: 1 };
      },
    },
    $queryRaw: async (_, id) => (rows.has(id) ? [rows.get(id)] : []),
    $executeRaw: async (strings, ...values) => {
      const sql = strings.join("?");
      if (sql.startsWith("INSERT")) {
        const [id, accountId, ownerId, action, targetId, requestHash] = values;
        if (rows.has(id)) return 0;
        rows.set(id, {
          accountId,
          ownerId,
          action,
          targetId,
          requestHash,
          state: "pending",
          result: {},
        });
        state.insertCount++;
        return 1;
      }
      if (sql.includes("result =")) {
        const [json, id] = values;
        Object.assign(rows.get(id), {
          state: "succeeded",
          result: JSON.parse(json),
        });
      } else if (sql.includes("state = ?")) {
        const [value, id] = values;
        rows.get(id).state = value;
      }
      return 1;
    },
  };
  async function graph(path, token, params = {}, method = "GET") {
    calls.push({ path, params, method });
    if (method !== "GET") {
      if (state.writeError) throw state.writeError;
      return state.badAck
        ? {}
        : path.endsWith("/replies")
          ? { id: "18033333333333333" }
          : { success: true };
    }
    if (path === "debug_token")
      return {
        data: {
          is_valid: state.valid,
          app_id: "123",
          scopes: state.scopes,
          granular_scopes: state.granular,
        },
      };
    if (path === account.accountId)
      return {
        id: account.accountId,
        username: account.username,
        followers_count: 10,
        media_count: 70,
      };
    if (
      path === account.accountId + "/media" ||
      path === account.accountId + "/stories"
    )
      return {
        data: [media],
        paging: state.after
          ? {
              next: "https://evil.test/?access_token=never-forward",
              cursors: { after: "next_cursor" },
            }
          : {},
      };
    if (path.endsWith("/insights")) {
      if (state.metricFailure && params.metric.includes(","))
        throw new InstagramError("PROVIDER_ERROR");
      return {
        data: params.metric
          .split(",")
          .filter((name) => !state.metricMissing || name !== "saved")
          .map((name) => ({
            name,
            values: [{ value: name === "views" ? 0 : 20 }],
          })),
      };
    }
    if (path.endsWith("/comments") || path.endsWith("/replies"))
      return {
        data: [
          {
            id: "17911111111111111",
            text: "Fixture comment",
            username: "fixture_user",
            timestamp: "2026-10-28T10:00:00Z",
            hidden: false,
            like_count: 0,
          },
        ],
        paging: { cursors: { after: "comment_next" }, next: "untrusted" },
      };
    if (path === "17911111111111111")
      return { id: path, media: { id: state.commentMedia } };
    return { ...media, owner: { id: state.owner } };
  }
  const security = {
    MarketingError,
    instagramConfig: () => ({
      appId: "123",
      appSecret: "secret",
      loginMode: state.mode,
    }),
    encryptionKey: () => Buffer.alloc(32, 1),
    privateHeaders: { "Cache-Control": "private, no-store" },
    readJson: (request) => request.json(),
    apiFailure: (error) =>
      Response.json(
        { error: error.code || "SERVICE_UNAVAILABLE" },
        { status: error.status || 503 },
      ),
    requireMarketingOwner: async (request, write) => {
      if (state.role !== 200)
        throw new MarketingError(
          state.role === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
          state.role,
        );
      if (write && request.headers.get("origin") !== "https://app.example.test")
        throw new MarketingError("FORBIDDEN", 403);
      return { status: 200, ownerId: "OWNER_TEST" };
    },
  };
  const load = createLoader({
    "@/lib/prisma": db,
    "./security.server": security,
    "@/lib/marketing/security.server": security,
    "./instagram.server": {
      graph,
      instagramToken: async () => ({ account, token: "private-token" }),
      InstagramError,
    },
  });
  const api = load("src/lib/marketing/instagram-content.server.ts"),
    domain = load("src/lib/marketing/instagram-content.ts");
  const action = (extra = {}) => ({
    action: "delete-media",
    mediaId: media.id,
    accountId: account.accountId,
    requestId: "00000000-0000-4000-8000-000000000001",
    ...extra,
  });
  return {
    api,
    domain,
    state,
    rows,
    calls,
    media,
    action,
    load,
    InstagramError,
  };
}

test("library reads all account media through a fixed edge, returns only cursor and no credentials", async () => {
  const f = fixture();
  const result = await f.api.instagramLibrary("media", "previous_cursor");
  assert.equal(result.items[0].likes, 0);
  assert.equal(result.after, "next_cursor");
  assert.equal(result.account.mediaCount, 70);
  assert.equal(result.capabilities.deleteMedia, true);
  assert.equal(
    f.calls.find((call) => call.path.endsWith("/media")).params.after,
    "previous_cursor",
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-token|access_token|evil.test|secret/,
  );
});
test("stories use the active-story edge and unsafe media URLs are discarded", async () => {
  const f = fixture();
  f.media.media_url = "javascript:alert(1)";
  f.media.permalink = "https://evil.test";
  const result = await f.api.instagramLibrary("stories");
  assert.ok(f.calls.some((call) => call.path.endsWith("/stories")));
  assert.equal(result.items[0].mediaUrl, null);
  assert.equal(result.items[0].permalink, null);
});
test("granular permissions and login mode gate destructive capabilities", async () => {
  const f = fixture();
  f.state.granular = [
    { scope: "instagram_manage_contents", target_ids: ["999"] },
  ];
  assert.equal(
    (await f.api.instagramLibrary("media")).capabilities.deleteMedia,
    false,
  );
  f.state.granular = [];
  f.state.mode = "unified";
  assert.equal(
    (await f.api.instagramLibrary("media")).capabilities.deleteMedia,
    false,
  );
  await assert.rejects(f.api.instagramContentAction(f.action(), "OWNER_TEST"), {
    code: "INSTAGRAM_DELETE_UNSUPPORTED",
  });
  assert.equal(f.state.insertCount, 0);
});
test("detail checks media ownership before retrieving any insights", async () => {
  const f = fixture();
  f.state.owner = "999";
  await assert.rejects(f.api.instagramDetail(f.media.id), {
    code: "INSTAGRAM_MEDIA_UNAVAILABLE",
  });
  assert.equal(
    f.calls.some((call) => call.path.endsWith("/insights")),
    false,
  );
});
test("metrics isolate unsupported fields and distinguish zero from unavailable", async () => {
  const f = fixture();
  f.state.metricFailure = true;
  f.state.metricMissing = true;
  const result = await f.api.instagramDetail(f.media.id);
  assert.equal(result.insights.find((item) => item.name === "views").value, 0);
  assert.equal(
    result.insights.find((item) => item.name === "saved").value,
    null,
  );
  assert.equal(result.children.length, 1);
  f.media.media_product_type = "STORY";
  const story = await f.api.instagramDetail(f.media.id);
  assert.ok(story.insights.some((item) => item.name === "navigation"));
  assert.equal(
    story.insights.some((item) => item.name === "likes"),
    false,
  );
});
test("comments require permissions and replies must belong to the selected media", async () => {
  const f = fixture();
  f.state.scopes = [];
  await assert.rejects(f.api.instagramMediaComments(f.media.id), {
    code: "INSTAGRAM_PERMISSION_REQUIRED",
  });
  f.state.scopes = ["instagram_manage_comments"];
  f.state.commentMedia = "999";
  await assert.rejects(
    f.api.instagramMediaComments(f.media.id, undefined, "17911111111111111"),
    { code: "INSTAGRAM_COMMENT_UNAVAILABLE" },
  );
});
test("deletion is reserved before dispatch, records history and replays without a second DELETE", async () => {
  const f = fixture();
  const input = f.action();
  assert.deepEqual(await f.api.instagramContentAction(input, "OWNER_TEST"), {
    success: true,
  });
  assert.equal(f.rows.get(input.requestId).state, "succeeded");
  await f.api.instagramContentAction(input, "OWNER_TEST");
  assert.equal(f.calls.filter((call) => call.method === "DELETE").length, 1);
  assert.equal(f.state.updates[0].data.errorCode, "MEDIA_DELETED");
});
test("reusing an idempotency key for a different operation or owner is rejected", async () => {
  const f = fixture();
  const input = f.action();
  await f.api.instagramContentAction(input, "OWNER_TEST");
  await assert.rejects(
    f.api.instagramContentAction(
      { ...input, action: "comments-enabled", enabled: false },
      "OWNER_TEST",
    ),
    { code: "INSTAGRAM_ACTION_CONFLICT" },
  );
  await assert.rejects(f.api.instagramContentAction(input, "OTHER_OWNER"), {
    code: "INSTAGRAM_ACTION_CONFLICT",
  });
});
test("account changes and foreign comments cannot cause external writes", async () => {
  const f = fixture();
  await assert.rejects(
    f.api.instagramContentAction(f.action({ accountId: "999" }), "OWNER_TEST"),
    { code: "INSTAGRAM_ACCOUNT_CHANGED" },
  );
  f.state.commentMedia = "999";
  await assert.rejects(
    f.api.instagramContentAction(
      f.action({ action: "delete-comment", commentId: "17911111111111111" }),
      "OWNER_TEST",
    ),
    { code: "INSTAGRAM_COMMENT_UNAVAILABLE" },
  );
  assert.equal(
    f.calls.some((call) => call.method !== "GET"),
    false,
  );
});
test("reply, comment visibility and comment-enabled use Meta's exact parameter names", async () => {
  const f = fixture();
  const operations = [
    f.action({
      action: "reply",
      commentId: "17911111111111111",
      message: "Fixture reply",
    }),
    f.action({
      action: "hide-comment",
      commentId: "17911111111111111",
      hidden: true,
      requestId: "00000000-0000-4000-8000-000000000002",
    }),
    f.action({
      action: "comments-enabled",
      enabled: false,
      requestId: "00000000-0000-4000-8000-000000000003",
    }),
  ];
  for (const input of operations)
    await f.api.instagramContentAction(input, "OWNER_TEST");
  const writes = f.calls.filter((call) => call.method === "POST");
  assert.deepEqual(
    writes.map((call) => call.params),
    [
      { message: "Fixture reply" },
      { hide: "true" },
      { comment_enabled: "false" },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify([...f.rows.values()]),
    /Fixture reply|private-token/,
  );
});
test("ambiguous provider acknowledgement never retries a reply", async () => {
  const f = fixture();
  f.state.badAck = true;
  const input = f.action({
    action: "reply",
    commentId: "17911111111111111",
    message: "Fixture reply",
  });
  await assert.rejects(f.api.instagramContentAction(input, "OWNER_TEST"), {
    code: "INSTAGRAM_ACTION_UNCERTAIN",
  });
  await assert.rejects(f.api.instagramContentAction(input, "OWNER_TEST"), {
    code: "INSTAGRAM_ACTION_UNCERTAIN",
  });
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
});
test("permission loss at dispatch leaves a failed audit record and no automatic resend", async () => {
  const f = fixture();
  f.state.writeError = Object.assign(new f.InstagramError("PROVIDER_ERROR"), {
    providerIssue: "PERMISSION_DENIED",
  });
  await assert.rejects(f.api.instagramContentAction(f.action(), "OWNER_TEST"), {
    code: "INSTAGRAM_PERMISSION_REQUIRED",
  });
  assert.equal(f.rows.get(f.action().requestId).state, "failed");
  await assert.rejects(f.api.instagramContentAction(f.action(), "OWNER_TEST"), {
    code: "INSTAGRAM_ACTION_FAILED",
  });
  assert.equal(f.calls.filter((call) => call.method === "DELETE").length, 1);
});
test("input schemas reject paths, invalid cursors, empty replies and missing account pins", () => {
  const f = fixture();
  assert.equal(f.domain.instagramId.safeParse("../me").success, false);
  assert.equal(
    f.domain.instagramCursor.safeParse("https://evil.test").success,
    false,
  );
  assert.equal(
    f.domain.instagramActionSchema.safeParse(
      f.action({
        action: "reply",
        commentId: "17911111111111111",
        message: "   ",
      }),
    ).success,
    false,
  );
  assert.equal(
    f.domain.instagramActionSchema.safeParse(f.action({ accountId: undefined }))
      .success,
    false,
  );
});
test("HTTP endpoints enforce active OWNER, matching Origin, schemas, and private no-store reads", async () => {
  const f = fixture(),
    route = f.load(
      "src/app/api/dashboard/pemasaran/instagram/content/route.ts",
    );
  const request = (query = "", options) => {
    const req = new Request(
      "https://app.example.test/api/dashboard/pemasaran/instagram/content" +
        query,
      options,
    );
    req.nextUrl = new URL(req.url);
    return req;
  };
  f.state.role = 401;
  assert.equal((await route.GET(request())).status, 401);
  f.state.role = 403;
  assert.equal((await route.GET(request())).status, 403);
  f.state.role = 200;
  assert.equal(
    (
      await route.POST(
        request("", {
          method: "POST",
          headers: { origin: "https://evil.test" },
          body: JSON.stringify(f.action()),
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await route.GET(request("?mode=detail&mediaId=../me"))).status,
    400,
  );
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(
    f.calls.some((call) => call.method !== "GET"),
    false,
  );
});

test("simultaneous requests with the same key dispatch at most one external write", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.api.instagramContentAction(f.action(), "OWNER_TEST"),
    f.api.instagramContentAction(f.action(), "OWNER_TEST"),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal(f.calls.filter((call) => call.method === "DELETE").length, 1);
  assert.equal(f.state.insertCount, 1);
});

test("a metrics refresh racing with deletion cannot clear the deleted history marker", async () => {
  for (const fail of [false, true]) {
    const f = fixture();
    const publication = {
      id: "publication",
      channel: "instagram",
      state: "published",
      externalId: f.media.id,
      errorCode: null,
    };
    const db = {
      marketingPublication: {
        findUnique: async () => ({ ...publication }),
        updateMany: async ({ where, data }) => {
          if (where.OR && publication.errorCode === "MEDIA_DELETED")
            return { count: 0 };
          Object.assign(publication, data);
          return { count: 1 };
        },
      },
      marketingMetric: { create: async () => ({}) },
      $transaction: (operations) => Promise.all(operations),
    };
    const service = createLoader({
      "@/lib/prisma": db,
      "@/lib/investor-read.server": {},
      "@/lib/investor-cma-legacy.server": {},
      "./store.server": { json: (value) => value },
      "./media.server": {},
      "./whatsapp.server": {},
      "./security.server": { MarketingError: f.InstagramError },
      "./instagram-credentials.server": {},
      "./instagram.server": {
        instagramToken: async () => ({ token: "fixture-token" }),
        instagramMetrics: async () => {
          publication.errorCode = "MEDIA_DELETED";
          if (fail) throw new f.InstagramError("PROVIDER_ERROR");
          return { values: { views: 1 }, reason: null };
        },
      },
    })("src/lib/marketing/service.server.ts");
    if (fail) await assert.rejects(service.syncMetrics(publication.id));
    else await service.syncMetrics(publication.id);
    assert.equal(publication.errorCode, "MEDIA_DELETED");
  }
});

test("Graph DELETE uses the official host, Bearer transport and uncertain outcome semantics", async () => {
  const originalFetch = global.fetch;
  const load = createLoader({
    "@/lib/prisma": {},
    "@/lib/chatbot/server-access": {},
  });
  try {
    global.fetch = async (input, options) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://graph.facebook.com");
      assert.equal(url.searchParams.has("access_token"), false);
      assert.equal(
        options.headers.Authorization,
        "Bearer private-fixture-token",
      );
      assert.equal(options.method, "DELETE");
      assert.equal(options.redirect, "error");
      return Response.json({ success: true });
    };
    const provider = load("src/lib/marketing/instagram.server.ts");
    assert.equal(
      (
        await provider.graph(
          "18011111111111111",
          "private-fixture-token",
          {},
          "DELETE",
        )
      ).success,
      true,
    );
    global.fetch = async () => {
      throw new Error("fixture network loss");
    };
    await assert.rejects(
      provider.graph(
        "18011111111111111",
        "private-fixture-token",
        {},
        "DELETE",
      ),
      (error) =>
        error.uncertain === true && error.code === "DELIVERY_UNCERTAIN",
    );
  } finally {
    global.fetch = originalFetch;
  }
});
