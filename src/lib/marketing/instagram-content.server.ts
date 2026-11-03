import "server-only";
import { createHmac } from "node:crypto";
import prisma from "@/lib/prisma";
import { graph, instagramToken, InstagramError } from "./instagram.server";
import {
  instagramConfig,
  MarketingError,
  encryptionKey,
} from "./security.server";
import {
  instagramId,
  type InstagramAction,
  type InstagramCapabilities,
  type InstagramComment,
  type InstagramDetail,
  type InstagramLibrary,
  type InstagramMedia,
  type InstagramPage,
} from "./instagram-content";

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,is_comment_enabled";
const COMMENT_FIELDS = "id,text,username,timestamp,hidden,like_count";
type Row = Record<string, any>;
const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const string = (value: unknown) => (typeof value === "string" ? value : "");
const timestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
function safeUrl(value: unknown, permalink = false) {
  try {
    const url = new URL(string(value));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hosts = permalink
      ? ["instagram.com"]
      : ["cdninstagram.com", "fbcdn.net", "instagram.com"];
    return hosts.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function media(row: Row): InstagramMedia {
  return {
    id: instagramId.parse(row.id),
    caption: string(row.caption),
    type: string(row.media_type),
    product: string(row.media_product_type),
    mediaUrl: safeUrl(row.media_url),
    thumbnailUrl: safeUrl(row.thumbnail_url),
    permalink: safeUrl(row.permalink, true),
    timestamp: timestamp(row.timestamp),
    likes: count(row.like_count),
    comments: count(row.comments_count),
    commentsEnabled:
      typeof row.is_comment_enabled === "boolean"
        ? row.is_comment_enabled
        : null,
  };
}
function comment(row: Row): InstagramComment {
  return {
    id: instagramId.parse(row.id),
    text: string(row.text),
    username: string(row.username),
    timestamp: timestamp(row.timestamp),
    hidden: typeof row.hidden === "boolean" ? row.hidden : null,
    likes: count(row.like_count),
  };
}
function page<T>(result: Row, parse: (row: Row) => T): InstagramPage<T> {
  if (!Array.isArray(result.data)) throw new InstagramError("PROVIDER_ERROR");
  const cursor = result.paging?.cursors?.after;
  return {
    items: result.data.map(parse),
    after:
      result.paging?.next &&
      typeof cursor === "string" &&
      cursor.length <= 4000 &&
      /^[A-Za-z0-9_/=+.-]+$/.test(cursor)
        ? cursor
        : null,
  };
}
type Connection = Awaited<ReturnType<typeof instagramToken>>;
async function capabilities({
  account,
  token,
}: Connection): Promise<InstagramCapabilities> {
  const config = instagramConfig();
  try {
    const { data } = await graph(
      "debug_token",
      config.appId + "|" + config.appSecret,
      { input_token: token },
    );
    if (!data?.is_valid || String(data.app_id) !== config.appId)
      throw new InstagramError("TOKEN_EXPIRED");
    const has = (scope: string) => {
      if (!Array.isArray(data.scopes) || !data.scopes.includes(scope))
        return false;
      const granular =
        data.granular_scopes?.filter((entry: Row) => entry.scope === scope) ||
        [];
      return (
        !granular.length ||
        granular.some(
          (entry: Row) =>
            !entry.target_ids?.length ||
            entry.target_ids.includes(account.accountId),
        )
      );
    };
    const scopes = [
      "instagram_manage_insights",
      "instagram_manage_comments",
      "instagram_manage_contents",
    ];
    return {
      verified: true,
      insights: has(scopes[0]),
      comments: has(scopes[1]),
      deleteMedia: config.loginMode === "facebook" && has(scopes[2]),
      missing: scopes.filter((scope) => !has(scope)),
    };
  } catch (error) {
    if (error instanceof MarketingError && error.code === "TOKEN_EXPIRED")
      throw error;
    return {
      verified: false,
      insights: false,
      comments: false,
      deleteMedia: false,
      missing: [],
    };
  }
}
async function ownedMedia(
  id: string,
  connection: Connection,
  children = false,
) {
  let result: Row;
  try {
    result = await graph(id, connection.token, {
      fields:
        MEDIA_FIELDS +
        ",owner" +
        (children
          ? ",children.limit(100){id,media_type,media_url,thumbnail_url}"
          : ""),
    });
  } catch (error) {
    if (
      error instanceof InstagramError &&
      error.providerIssue === "OBJECT_UNAVAILABLE"
    )
      throw new MarketingError("INSTAGRAM_MEDIA_UNAVAILABLE", 404);
    throw error;
  }
  const owner =
    typeof result.owner === "string" ? result.owner : result.owner?.id;
  if (result.id !== id || owner !== connection.account.accountId)
    throw new MarketingError("INSTAGRAM_MEDIA_UNAVAILABLE", 404);
  return result;
}
async function ownedComment(
  id: string,
  mediaId: string,
  connection: Connection,
) {
  const result = await graph(id, connection.token, {
    fields: "id,media,parent_id",
  });
  let parentMedia =
    typeof result.media === "string" ? result.media : result.media?.id;
  if (!parentMedia && result.parent_id) {
    const parent = await graph(String(result.parent_id), connection.token, {
      fields: "media",
    });
    parentMedia =
      typeof parent.media === "string" ? parent.media : parent.media?.id;
  }
  if (result.id !== id || parentMedia !== mediaId)
    throw new MarketingError("INSTAGRAM_COMMENT_UNAVAILABLE", 404);
}
export async function instagramLibrary(
  kind: "media" | "stories",
  after?: string,
): Promise<InstagramLibrary> {
  const connection = await instagramToken();
  const [profile, content, permissions] = await Promise.all([
    graph(connection.account.accountId, connection.token, {
      fields:
        "id,username,name,profile_picture_url,followers_count,follows_count,media_count",
    }),
    graph(connection.account.accountId + "/" + kind, connection.token, {
      fields: MEDIA_FIELDS,
      limit: "24",
      ...(after ? { after } : {}),
    }),
    capabilities(connection),
  ]);
  if (profile.id !== connection.account.accountId)
    throw new MarketingError("INSTAGRAM_ACCOUNT_CHANGED", 409);
  return {
    ...page(content, media),
    account: {
      id: connection.account.accountId,
      username: string(profile.username),
      name: string(profile.name),
      picture: safeUrl(profile.profile_picture_url),
      followers: count(profile.followers_count),
      following: count(profile.follows_count),
      mediaCount: count(profile.media_count),
    },
    capabilities: permissions,
    fetchedAt: new Date().toISOString(),
  };
}
function metricsFor(product: string) {
  const base = ["views", "reach", "shares", "total_interactions"];
  return product === "STORY"
    ? [
        ...base,
        "replies",
        "follows",
        "profile_visits",
        "navigation",
        "link_clicks",
      ]
    : [
        ...base,
        "likes",
        "comments",
        "saved",
        ...(product === "REELS"
          ? [
              "ig_reels_avg_watch_time",
              "ig_reels_video_view_total_time",
              "reels_skip_rate",
            ]
          : ["follows", "profile_visits"]),
      ];
}
function metricValue(result: Row, name: string) {
  const item = result.data?.find((entry: Row) => entry.name === name);
  return count(item?.values?.[0]?.value ?? item?.total_value?.value);
}
export async function instagramDetail(id: string): Promise<InstagramDetail> {
  const connection = await instagramToken();
  const [row, permissions] = await Promise.all([
    ownedMedia(id, connection, true),
    capabilities(connection),
  ]);
  const names = metricsFor(row.media_product_type);
  const insights = names.map((name) => ({
    name,
    value: null as number | null,
    issue: permissions.insights
      ? (null as string | null)
      : "INSTAGRAM_PERMISSION_REQUIRED",
  }));
  if (permissions.insights) {
    try {
      const result = await graph(id + "/insights", connection.token, {
        metric: names.join(","),
      });
      for (const entry of insights) {
        entry.value = metricValue(result, entry.name);
        entry.issue = entry.value === null ? "METRICS_UNAVAILABLE" : null;
      }
    } catch (error) {
      if (
        error instanceof MarketingError &&
        ["TOKEN_EXPIRED", "RATE_LIMIT"].includes(error.code)
      )
        throw error;
      // Unsupported metrics are isolated. Bound concurrency and stop on rate/token failures.
      for (let offset = 0; offset < insights.length; offset += 3) {
        await Promise.all(
          insights.slice(offset, offset + 3).map(async (entry) => {
            try {
              const result = await graph(id + "/insights", connection.token, {
                metric: entry.name,
              });
              entry.value = metricValue(result, entry.name);
              entry.issue = entry.value === null ? "METRICS_UNAVAILABLE" : null;
            } catch (failure) {
              if (
                failure instanceof MarketingError &&
                ["TOKEN_EXPIRED", "RATE_LIMIT"].includes(failure.code)
              )
                throw failure;
              entry.issue = "METRICS_UNAVAILABLE";
            }
          }),
        );
      }
    }
  }
  return {
    media: media(row),
    children: (row.children?.data || []).map(media),
    insights,
    capabilities: permissions,
    fetchedAt: new Date().toISOString(),
  };
}
export async function instagramMediaComments(
  mediaId: string,
  after?: string,
  parentId?: string,
) {
  const connection = await instagramToken();
  await ownedMedia(mediaId, connection);
  const permissions = await capabilities(connection);
  if (!permissions.comments)
    throw new MarketingError("INSTAGRAM_PERMISSION_REQUIRED", 403);
  if (parentId) await ownedComment(parentId, mediaId, connection);
  return page(
    await graph(
      (parentId || mediaId) + (parentId ? "/replies" : "/comments"),
      connection.token,
      { fields: COMMENT_FIELDS, limit: "30", ...(after ? { after } : {}) },
    ),
    comment,
  );
}

type ActionRecord = { requestHash: string; state: string; result: Row };
/** Reserve before dispatch; a repeated/uncertain request is never sent twice. No comment text is retained. */
export async function instagramContentAction(
  input: InstagramAction,
  ownerId: string,
) {
  const connection = await instagramToken();
  if (input.accountId !== connection.account.accountId)
    throw new MarketingError("INSTAGRAM_ACCOUNT_CHANGED", 409);
  const requestHash = createHmac("sha256", encryptionKey())
    .update(JSON.stringify({ ownerId, ...input }))
    .digest("hex");
  await prisma.$executeRaw`UPDATE marketing_instagram_actions SET state = 'uncertain', "updatedAt" = now() WHERE "accountId" = ${input.accountId} AND state = 'pending' AND "createdAt" < now() - interval '5 minutes'`;
  const existing = await prisma.$queryRaw<
    ActionRecord[]
  >`SELECT "requestHash", state, result FROM marketing_instagram_actions WHERE id = ${input.requestId}`;
  const reconcileLocalHistory = async () => {
    if (input.action === "delete-media")
      await prisma.marketingPublication.updateMany({
        where: { channel: "instagram", externalId: input.mediaId },
        data: { errorCode: "MEDIA_DELETED", lastSyncedAt: new Date() },
      });
  };
  const replay = async (record: ActionRecord) => {
    if (record.requestHash !== requestHash)
      throw new MarketingError("INSTAGRAM_ACTION_CONFLICT", 409);
    if (record.state === "succeeded") {
      await reconcileLocalHistory();
      return record.result;
    }
    throw new MarketingError(
      record.state === "pending"
        ? "INSTAGRAM_ACTION_PENDING"
        : record.state === "uncertain"
          ? "INSTAGRAM_ACTION_UNCERTAIN"
          : "INSTAGRAM_ACTION_FAILED",
      409,
    );
  };
  if (existing[0]) return replay(existing[0]);
  const permissions = await capabilities(connection);
  if (
    input.action === "delete-media"
      ? !permissions.deleteMedia
      : !permissions.comments
  )
    throw new MarketingError(
      input.action === "delete-media"
        ? "INSTAGRAM_DELETE_UNSUPPORTED"
        : "INSTAGRAM_PERMISSION_REQUIRED",
      403,
    );
  await ownedMedia(input.mediaId, connection);
  if ("commentId" in input)
    await ownedComment(input.commentId, input.mediaId, connection);
  // Recheck the active connection just before reserving/dispatching a write.
  if ((await instagramToken()).token !== connection.token)
    throw new MarketingError("INSTAGRAM_ACCOUNT_CHANGED", 409);
  const targetId = "commentId" in input ? input.commentId : input.mediaId;
  let inserted: number;
  try {
    inserted =
      await prisma.$executeRaw`INSERT INTO marketing_instagram_actions (id, "accountId", "ownerId", action, "targetId", "requestHash", state) VALUES (${input.requestId}, ${input.accountId}, ${ownerId}, ${input.action}, ${targetId}, ${requestHash}, 'pending') ON CONFLICT (id) DO NOTHING`;
  } catch (error) {
    if ((error as { meta?: { code?: string } }).meta?.code === "23505")
      throw new MarketingError("INSTAGRAM_ACTION_BUSY", 409);
    throw error;
  }
  if (!inserted) {
    const records = await prisma.$queryRaw<
      ActionRecord[]
    >`SELECT "requestHash", state, result FROM marketing_instagram_actions WHERE id = ${input.requestId}`;
    return replay(records[0]);
  }
  let result: Row;
  try {
    if (input.action === "delete-media" || input.action === "delete-comment")
      result = await graph(targetId, connection.token, {}, "DELETE");
    else if (input.action === "reply")
      result = await graph(
        targetId + "/replies",
        connection.token,
        { message: input.message },
        "POST",
      );
    else
      result = await graph(
        targetId,
        connection.token,
        input.action === "hide-comment"
          ? { hide: String(input.hidden) }
          : { comment_enabled: String(input.enabled) },
        "POST",
      );
    if (
      input.action === "reply"
        ? !instagramId.safeParse(result.id).success
        : result.success !== true
    )
      throw new InstagramError("DELIVERY_UNCERTAIN", true);
  } catch (error) {
    const uncertain = !(error instanceof InstagramError) || error.uncertain;
    await prisma.$executeRaw`UPDATE marketing_instagram_actions SET state = ${uncertain ? "uncertain" : "failed"}, "updatedAt" = now() WHERE id = ${input.requestId}`;
    if (uncertain) throw new MarketingError("INSTAGRAM_ACTION_UNCERTAIN", 409);
    if (
      error instanceof InstagramError &&
      error.providerIssue === "PERMISSION_DENIED"
    )
      throw new MarketingError("INSTAGRAM_PERMISSION_REQUIRED", 403);
    throw error;
  }
  const response = {
    success: true,
    ...(input.action === "reply" ? { id: result.id as string } : {}),
  };
  // Provider acknowledgement is retained before local history reconciliation.
  await prisma.$executeRaw`UPDATE marketing_instagram_actions SET state = 'succeeded', result = ${JSON.stringify(response)}::jsonb, "updatedAt" = now() WHERE id = ${input.requestId}`;
  await reconcileLocalHistory();
  return response;
}
