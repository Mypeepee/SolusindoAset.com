const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./lib/marketing-test-loader.cjs")();
const { analyticsAsset, cleanMetrics, distinctProperties, metricValue, metricSummary, responseRate, audienceSegments, rankPosts, forecastRange, publishedDay, segmentLabel } = load("src/lib/marketing/analytics.ts");
const post = (id, values = {}, options = {}) => ({ id, jobId: id, channel: "instagram", publishedAt: "2026-10-01T12:00:00Z", errorCode: null,
  asset: { propertyType: "Rumah", city: "Surabaya", assetKey: id, price: 500e6, landArea: 100 }, values: cleanMetrics(values), ...options });

test("missing, invalid and negative values remain unknown; real zero is measured", () => {
  assert.deepEqual(cleanMetrics(null), cleanMetrics({}));
  const posts = [post("a", { views: 0, likes: -1, comments: NaN }), post("b", { views: null }), post("c", { views: Infinity })];
  assert.deepEqual(metricSummary(posts, "views"), { count: 1, total: 0 });
  assert.deepEqual(metricSummary(posts, "likes"), { count: 0, total: null });
  assert.equal(posts[0].values.comments, null);
  assert.equal(cleanMetrics({ views: "100" }).views, null);
  assert.equal(cleanMetrics({ views: 1.5 }).views, null);
  assert.equal(cleanMetrics({ views: Number.MAX_SAFE_INTEGER + 1 }).views, null);
});
test("historical malformed property facts cannot crash segments or expose extra fields", () => {
  const asset = analyticsAsset({ city: 42, propertyType: ["Rumah"], price: -1, landArea: Infinity, title: "Sumber", privateNote: "private" });
  assert.deepEqual(asset, { title: "Sumber", landArea: null });
  assert.equal(segmentLabel(post("old", {}, { asset }), "type"), "Jenis belum tercatat");
});
test("WhatsApp uses observed reactions/replies without borrowing Instagram metrics", () => {
  const item = post("a", { views: 100, likes: 900, comments: 500, reactions: 2, replies: 3 }, { channel: "whatsapp" });
  assert.equal(metricValue(item, "likes"), 2);
  assert.equal(metricValue(item, "comments"), 3);
  assert.equal(responseRate(item), 5);
});
test("response only uses complete comparable metrics with a positive denominator", () => {
  assert.equal(responseRate(post("a", { views: 100, likes: 0, comments: 0 })), 0);
  assert.equal(responseRate(post("a", { views: 0, likes: 2, comments: 1 })), null);
  assert.equal(responseRate(post("a", { views: 100, likes: 3 })), null);
  assert.equal(responseRate(post("a", { views: 100, likes: 3, comments: 2, saved: 500 })), 5);
});
test("publication dates use WIB, including next-month rollover", () => {
  assert.equal(publishedDay(post("a", {}, { publishedAt: "2026-10-31T18:01:00Z" })), "2026-11-01");
});
test("segment volume is independent of median response and outliers", () => {
  const posts = [post("1", { views: 100, likes: 1, comments: 0 }), post("2", { views: 100, likes: 2, comments: 0 }), post("3", { views: 10000, likes: 9000, comments: 0 }), post("4", { views: 100, likes: 10, comments: 0 }, { asset: { propertyType: "Ruko" } })];
  const segments = audienceSegments(posts, "type");
  assert.equal(segments[0].label, "Rumah"); assert.equal(segments[0].count, 3);
  assert.equal(segments[0].rate, 2); assert.equal(segments[0].medianViews, 100);
  assert.equal(segments[1].rate, 10);
  assert.deepEqual(posts.map(p => p.id), ["1", "2", "3", "4"]);
});
test("sorting places unknown below measured zero and remains deterministic", () => {
  const posts = [post("b"), post("c", { views: 0 }), post("a", { views: 10 })];
  assert.deepEqual(rankPosts(posts, "views").map(p => p.id), ["a", "c", "b"]);
  assert.deepEqual(posts.map(p => p.id), ["b", "c", "a"]);
});
test("price and land bands handle exact boundaries and unknown facts", () => {
  assert.equal(segmentLabel(post("a"), "price"), "Rp500 juta–<1 miliar");
  assert.equal(segmentLabel(post("a"), "land"), "100–<200 m²");
  assert.equal(segmentLabel(post("a", {}, { asset: { price: 0, landArea: null } }), "price"), "Harga belum tercatat");
});
test("forecast refuses repeated assets, immature posts and short observation spans", () => {
  const repeated = Array.from({ length: 8 }, (_, i) => post(String(i), { views: 100 }, { asset: { assetKey: "same" } }));
  assert.equal(forecastRange(repeated, "2026-11-01T00:00:00Z").ready, false);
  const immature = Array.from({ length: 5 }, (_, i) => post(String(i), { views: 100 }, { publishedAt: "2026-10-31T00:00:00Z" }));
  assert.equal(forecastRange(immature, "2026-11-01T00:00:00Z").count, 0);
  const short = Array.from({ length: 5 }, (_, i) => post(String(i), { views: 100 }));
  assert.equal(forecastRange(short, "2026-11-01T00:00:00Z").ready, false);
});
test("unknown identities do not masquerade as distinct properties, and legacy ids reconcile with source keys", () => {
  const unknown = Array.from({ length: 5 }, (_, i) => post(String(i), { views: 100 }, { asset: { propertyType: "Rumah" }, publishedAt: `2026-10-${String(i * 4 + 1).padStart(2,"0")}T12:00:00Z` }));
  assert.equal(forecastRange(unknown, "2026-11-01T00:00:00Z").ready, false);
  assert.equal(distinctProperties(unknown), 0);
  assert.equal(distinctProperties([post("a", {}, { asset: { id: "listing", assetKey: "asset:canonical" } }), post("b", {}, { asset: { id: "listing" } })]), 1);
});
test("forecast uses the middle half of eligible history, excludes deleted/unknown and never fabricates totals", () => {
  const history = [100, 200, 300, 400, 10000].map((views, i) => post(String(i), { views }, { publishedAt: `2026-10-${String(i * 4 + 1).padStart(2,"0")}T12:00:00Z` }));
  history.push(post("deleted", { views: 999999 }, { errorCode: "MEDIA_DELETED" }), post("unknown"));
  const result = forecastRange(history, "2026-11-01T00:00:00Z");
  assert.equal(result.ready, true); assert.equal(result.count, 5); assert.equal(result.low, 200); assert.equal(result.high, 400); assert.equal(result.median, 300);
  assert.equal(forecastRange([], "2026-11-01T00:00:00Z").low, null);
});
test("analytics query follows actual publication month, includes two months of history, and does no writes", async () => {
  let query;
  const server = require("./lib/marketing-test-loader.cjs")({ "@/lib/prisma": { marketingPublication: { findMany: async (q) => { query = q; return [{ id: "p", channel: "instagram", publishedAt: new Date("2026-11-01T00:00:00Z"), lastSyncedAt: null, job: { id: "j", snapshot: {} }, metrics: [{ values: { views: 0 }, reason: null }], permalink: null, errorCode: null }]; } } } })("src/lib/marketing/analytics.server.ts");
  const result = await server.marketingAnalytics("2026-11");
  assert.equal(query.where.state, "published");
  assert.equal(query.where.publishedAt.gte.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(query.where.publishedAt.lt.toISOString(), "2026-11-30T17:00:00.000Z");
  assert.equal(query.include.metrics.take, 1); assert.equal(result.posts[0].values.views, 0);
  assert.equal(result.historyStart, "2026-09"); assert.equal(query.where.scheduledFor, undefined);
});
