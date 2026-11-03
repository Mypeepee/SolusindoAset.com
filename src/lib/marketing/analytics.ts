import type { AssetSnapshot, Channel, MetricValues } from "./domain";

export const ANALYTICS_METRICS = ["views", "likes", "comments"] as const;
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];
export type AnalyticsDimension = "type" | "city" | "price" | "land";
export type AnalyticsPost = {
  id: string;
  jobId: string;
  channel: Channel;
  publishedAt: string;
  lastSyncedAt: string | null;
  permalink: string | null;
  errorCode: string | null;
  metricReason: string | null;
  asset: Partial<AssetSnapshot>;
  values: MetricValues;
};
export type AnalyticsDataset = {
  month: string;
  historyStart: string;
  fetchedAt: string;
  posts: AnalyticsPost[];
};

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
});
export const publishedDay = (post: AnalyticsPost) => dayFormat.format(new Date(post.publishedAt));
/** Historical records may lack facts. Only public property fields enter analytics. */
export function analyticsAsset(value: unknown): Partial<AssetSnapshot> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  for (const key of ["id", "assetKey", "title", "address", "city", "propertyType", "category"]) {
    if (typeof source[key] === "string") result[key] = source[key];
  }
  for (const key of ["price", "landArea"]) {
    if (typeof source[key] === "number" && Number.isFinite(source[key]) && source[key] > 0) result[key] = source[key];
    else if (key === "landArea") result[key] = null;
  }
  return result as Partial<AssetSnapshot>;
}
/** Zero is measured; missing, corrupt and negative provider values are unknown. */
export function cleanMetrics(value: unknown): MetricValues {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    ["views", "reach", "likes", "comments", "saved", "shares", "replies", "reactions"].map((key) => {
      const n = source[key];
      return [key, typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null];
    }),
  ) as MetricValues;
}
export function metricValue(post: AnalyticsPost, metric: AnalyticsMetric): number | null {
  return post.values[post.channel === "whatsapp" ? metric === "likes" ? "reactions" : metric === "comments" ? "replies" : metric : metric];
}
export function metricSummary(posts: AnalyticsPost[], metric: AnalyticsMetric) {
  const values = posts.map((post) => metricValue(post, metric)).filter((n): n is number => n !== null);
  return { count: values.length, total: values.length ? values.reduce((sum, n) => sum + n, 0) : null };
}
export function quantile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}
/** Comparable response excludes save/share: not every provider exposes them. */
export function responseRate(post: AnalyticsPost): number | null {
  const views = metricValue(post, "views"), likes = metricValue(post, "likes"), comments = metricValue(post, "comments");
  return views !== null && views > 0 && likes !== null && comments !== null
    ? (likes + comments) / views * 100 : null;
}
export function segmentLabel(post: AnalyticsPost, dimension: AnalyticsDimension): string {
  const asset = post.asset;
  if (dimension === "type") return asset.propertyType?.trim() || "Jenis belum tercatat";
  if (dimension === "city") return asset.city?.trim() || "Lokasi belum tercatat";
  if (dimension === "price") {
    const price = asset.price;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return "Harga belum tercatat";
    return price < 500e6 ? "Di bawah Rp500 juta" : price < 1e9 ? "Rp500 juta–<1 miliar" : price < 2e9 ? "Rp1–<2 miliar" : "Rp2 miliar ke atas";
  }
  const area = asset.landArea;
  if (typeof area !== "number" || !Number.isFinite(area) || area <= 0) return "Luas belum tercatat";
  return area < 100 ? "Di bawah 100 m²" : area < 200 ? "100–<200 m²" : area < 500 ? "200–<500 m²" : "500 m² ke atas";
}
export function audienceSegments(posts: AnalyticsPost[], dimension: AnalyticsDimension) {
  const groups = new Map<string, AnalyticsPost[]>();
  for (const post of posts) {
    const label = segmentLabel(post, dimension);
    const key = label.toLocaleLowerCase("id-ID");
    const group = groups.get(key) || [];
    group.push(post);
    groups.set(key, group);
  }
  return [...groups.values()].map((items) => {
    const views = items.map((post) => metricValue(post, "views")).filter((n): n is number => n !== null);
    const rates = items.map(responseRate).filter((n): n is number => n !== null);
    return { label: segmentLabel(items[0], dimension), posts: items, count: items.length,
      measured: views.length, responseCount: rates.length,
      medianViews: quantile(views, .5), rate: quantile(rates, .5),
      likes: metricSummary(items, "likes").total, comments: metricSummary(items, "comments").total };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "id-ID"));
}
export type AudienceSegment = ReturnType<typeof audienceSegments>[number];
export function distinctProperties(posts: AnalyticsPost[]): number {
  const keysById = new Map(posts.filter((post) => post.asset.id && post.asset.assetKey).map((post) => [post.asset.id!, post.asset.assetKey!]));
  return new Set(posts.map((post) => post.asset.assetKey || (post.asset.id ? keysById.get(post.asset.id) || post.asset.id : null)).filter(Boolean)).size;
}
export function rankPosts(posts: AnalyticsPost[], metric: AnalyticsMetric | "response") {
  const value = metric === "response" ? responseRate : (post: AnalyticsPost) => metricValue(post, metric);
  return [...posts].sort((a, b) => {
    const av = value(a), bv = value(b);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    return (bv ?? 0) - (av ?? 0) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
  });
}
/** Historical middle 50%, not a confidence interval or a sales prediction. */
export function forecastRange(posts: AnalyticsPost[], now: string) {
  const mature = posts.filter((post) => post.errorCode !== "MEDIA_DELETED" && Date.parse(now) - Date.parse(post.publishedAt) >= 72 * 3600000 && metricValue(post, "views") !== null);
  const assets = distinctProperties(mature);
  const days = mature.map((post) => Date.parse(post.publishedAt));
  const span = days.length ? (Math.max(...days) - Math.min(...days)) / 86400000 : 0;
  const ready = mature.length >= 5 && assets >= 3 && span >= 14;
  const values = mature.map((post) => metricValue(post, "views")!);
  return { ready, count: mature.length, assets, span: Math.floor(span),
    low: ready ? quantile(values, .25) : null, high: ready ? quantile(values, .75) : null,
    median: ready ? quantile(values, .5) : null };
}
