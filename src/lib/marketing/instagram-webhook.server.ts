import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  encryptionKey,
  encryptToken,
  MarketingError,
  publicOrigin,
  sameSecret,
} from "./security.server";
import {
  webhookStore,
  type InstagramWebhookEvent,
} from "./instagram-webhook-store.server";
import { graph, instagramToken } from "./instagram.server";

const MAX_BODY = 2 * 1024 * 1024;
const MAX_EVENTS = 1000;
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d{0,31}$/.test(value);
const object = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export const instagramWebhookPath = "/api/pemasaran/instagram/webhook";
const fieldPermission = {
  comments: "instagram_manage_comments",
  live_comments: "instagram_manage_comments",
  mentions: "instagram_manage_comments",
  messages: "instagram_manage_messages",
  message_reactions: "instagram_manage_messages",
  messaging_postbacks: "instagram_manage_messages",
  messaging_referral: "instagram_manage_messages",
  messaging_seen: "instagram_manage_messages",
  story_insights: "instagram_manage_insights",
} as const;

function configuration() {
  const appId = process.env.META_APP_ID?.trim() || "";
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  if (
    !id(appId) ||
    !appSecret ||
    verifyToken.length < 32 ||
    verifyToken.length > 256
  )
    throw new MarketingError("INSTAGRAM_WEBHOOK_NOT_CONFIGURED", 503);
  encryptionKey();
  return { appId, appSecret, verifyToken };
}

export async function verifyInstagramWebhook(url: URL) {
  const config = configuration();
  const keys = ["hub.mode", "hub.challenge", "hub.verify_token"];
  if (keys.some((key) => url.searchParams.getAll(key).length !== 1))
    throw new MarketingError("INVALID_WEBHOOK_CHALLENGE", 400);
  if (url.searchParams.get("hub.mode") !== "subscribe")
    throw new MarketingError("INVALID_WEBHOOK_CHALLENGE", 400);
  const presented = url.searchParams.get("hub.verify_token") || "";
  if (presented.length > 256 || !sameSecret(presented, config.verifyToken))
    throw new MarketingError("INVALID_WEBHOOK_TOKEN", 403);
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (!/^\d{1,200}$/.test(challenge))
    throw new MarketingError("INVALID_WEBHOOK_CHALLENGE", 400);
  await webhookStore.challenge(config.appId);
  return challenge;
}

async function rawBody(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json")
    throw new MarketingError("INVALID_REQUEST", 415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY))
    throw new MarketingError("WEBHOOK_TOO_LARGE", 413);
  if (!request.body) throw new MarketingError("INVALID_REQUEST", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => {
      reject(new MarketingError("WEBHOOK_BODY_TIMEOUT", 408));
      void reader.cancel().catch(() => {});
    }, 10000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timedOut]);
      if (done) break;
      length += value.length;
      if (length > MAX_BODY) {
        await reader.cancel();
        throw new MarketingError("WEBHOOK_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    if (deadline) clearTimeout(deadline);
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function canonical(value: any, depth = 0): string {
  if (depth > 32) throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
  if (Array.isArray(value))
    return "[" + value.map((row) => canonical(row, depth + 1)).join(",") + "]";
  if (object(value))
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) => JSON.stringify(key) + ":" + canonical(value[key], depth + 1),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

async function companyAccount() {
  const pinned = process.env.INSTAGRAM_ACCOUNT_ID?.trim();
  if (pinned) {
    if (!id(pinned))
      throw new MarketingError("INSTAGRAM_WEBHOOK_NOT_CONFIGURED", 503);
    return pinned;
  }
  const connection = await prisma.marketingConnection.findUnique({
    where: { id: "instagram" },
    select: { accountId: true },
  });
  if (!id(connection?.accountId))
    throw new MarketingError("INSTAGRAM_WEBHOOK_ACCOUNT_REQUIRED", 503);
  return connection!.accountId;
}

function providerTime(value: unknown, milliseconds = false) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    return null;
  const parsed = new Date(value * (milliseconds ? 1 : 1000));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export async function receiveInstagramWebhook(request: Request) {
  const config = configuration();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!/^sha256=[a-fA-F0-9]{64}$/.test(signature))
    throw new MarketingError("INVALID_WEBHOOK_SIGNATURE", 401);
  const raw = await rawBody(request);
  const expected = createHmac("sha256", config.appSecret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
    throw new MarketingError("INVALID_WEBHOOK_SIGNATURE", 401);
  let payload: any;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
  }
  if (
    !object(payload) ||
    payload.object !== "instagram" ||
    !Array.isArray(payload.entry) ||
    payload.entry.length > MAX_EVENTS
  )
    throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
  const company = await companyAccount();
  const events = new Map<string, InstagramWebhookEvent>();
  let ignored = 0,
    count = 0;
  function add(
    accountId: string,
    field: string,
    value: any,
    time: string | null,
  ) {
    if (++count > MAX_EVENTS)
      throw new MarketingError("WEBHOOK_TOO_LARGE", 413);
    const serialized = canonical({
      accountId,
      field,
      value,
      providerTime: time,
    });
    const digest = createHash("sha256")
      .update(config.appId + "\0" + serialized)
      .digest("hex");
    const existing = events.get(digest);
    if (existing) {
      existing.deliveries++;
      return;
    }
    events.set(digest, {
      id: digest,
      accountId,
      field,
      payloadCipher: encryptToken(serialized),
      providerTime: time,
      deliveries: 1,
    });
  }
  for (const entry of payload.entry) {
    if (!object(entry))
      throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
    if (entry.id !== company) {
      ignored++;
      continue;
    }
    for (const property of ["changes", "messaging", "changed_fields"]) {
      if (entry[property] !== undefined && !Array.isArray(entry[property]))
        throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
    }
    for (const change of entry.changes || []) {
      if (
        !object(change) ||
        typeof change.field !== "string" ||
        !/^[a-z_]{1,64}$/.test(change.field)
      )
        throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
      add(
        company,
        change.field,
        change.value ?? null,
        providerTime(entry.time),
      );
    }
    for (const message of entry.messaging || []) {
      if (!object(message))
        throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
      add(company, "messaging", message, providerTime(message.timestamp, true));
    }
    for (const field of entry.changed_fields || []) {
      if (typeof field !== "string" || !/^[a-z_]{1,64}$/.test(field))
        throw new MarketingError("INVALID_WEBHOOK_PAYLOAD", 400);
      add(company, field, null, providerTime(entry.time));
    }
  }
  // Persist before acknowledging. Storage failures cause Meta to retry.
  await webhookStore.delivery(config.appId, [...events.values()], ignored);
}

export async function instagramWebhookStatus() {
  const config = configuration();
  return {
    configured: true,
    callbackUrl: publicOrigin() + instagramWebhookPath,
    ...(await webhookStore.status(config.appId)),
    retentionDays: 30,
  };
}

/** Called by OWNER after configuring the callback and fields in Meta's UI. */
export async function subscribeInstagramWebhook(input: unknown) {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > 9 ||
    input.some(
      (field) =>
        typeof field !== "string" || !Object.hasOwn(fieldPermission, field),
    ) ||
    new Set(input).size !== input.length
  )
    throw new MarketingError("INVALID_WEBHOOK_FIELDS", 400);
  const fields = input as Array<keyof typeof fieldPermission>;
  if (process.env.INSTAGRAM_LOGIN_MODE?.trim() === "facebook")
    throw new MarketingError("WEBHOOK_PAGE_SUBSCRIPTION_REQUIRED", 409);
  const config = configuration();
  const { account, token } = await instagramToken();
  const inspected = await graph(
    "debug_token",
    config.appId + "|" + config.appSecret,
    { input_token: token },
  );
  const details = inspected.data;
  if (
    !details?.is_valid ||
    String(details.app_id) !== config.appId ||
    details.type !== "SYSTEM_USER"
  )
    throw new MarketingError("TOKEN_EXPIRED", 401);
  const required = [
    "instagram_basic",
    ...fields.map((field) => fieldPermission[field]),
  ];
  if (
    !Array.isArray(details.scopes) ||
    required.some((scope) => !details.scopes.includes(scope))
  )
    throw new MarketingError("OAUTH_PERMISSIONS_MISSING", 409);
  const result = await graph(
    account.accountId + "/subscribed_apps",
    token,
    { subscribed_fields: fields.join(",") },
    "POST",
  );
  if (result.success !== true) throw new MarketingError("PROVIDER_ERROR", 503);
  return { subscribed: true, fields };
}
