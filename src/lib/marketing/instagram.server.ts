import "server-only";
import { createHmac } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  instagramConfig,
  MarketingError,
  oauthRedirect,
} from "./security.server";
import {
  encryptInstagramCredential,
  encryptFacebookInstagramCredential,
  instagramCredential,
} from "./instagram-credentials.server";
import { discoverInstagramAccount } from "./instagram-accounts.server";
import { validateFacebookInstagramToken } from "./instagram-facebook.server";
import {
  clearPendingInstagramAuthorization,
  isCurrentPendingInstagramAuthorization,
  pendingInstagramAuthorization,
  rememberPendingInstagramAuthorization,
} from "./instagram-pending.server";
import { EMPTY_METRICS, type MetricValues } from "./domain";

export const apiVersion = () =>
  /^v\d+\.\d+$/.test(process.env.INSTAGRAM_API_VERSION || "")
    ? process.env.INSTAGRAM_API_VERSION!
    : "v26.0";
export class InstagramError extends MarketingError {
  providerCode?: number;
  providerSubcode?: number;
  providerTraceId?: string;
  providerIssue?:
    | "UNSUPPORTED_FIELD"
    | "OBJECT_UNAVAILABLE"
    | "PERMISSION_DENIED";
  constructor(
    code: string,
    public uncertain = false,
    public retryable = false,
  ) {
    super(
      code,
      ["TOKEN_EXPIRED", "OAUTH_RECONNECT_REQUIRED"].includes(code) ? 401 : 503,
    );
  }
}
export async function graph(
  path: string,
  token: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" | "DELETE" = "GET",
  authTransport: "bearer" | "parameter" = "bearer",
) {
  const url = new URL(
    "https://graph.facebook.com/" + apiVersion() + "/" + path,
  );
  const secret = process.env.META_APP_SECRET?.trim();
  if (secret)
    params = {
      ...params,
      appsecret_proof: createHmac("sha256", secret).update(token).digest("hex"),
    };
  if (authTransport === "parameter")
    params = { ...params, access_token: token };
  if (method !== "POST") url.search = new URLSearchParams(params).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(authTransport === "bearer"
          ? { Authorization: "Bearer " + token }
          : {}),
        ...(method === "POST"
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      ...(method === "POST"
        ? { body: new URLSearchParams(params).toString() }
        : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new InstagramError(
      method !== "GET" ? "DELIVERY_UNCERTAIN" : "PROVIDER_ERROR",
      method !== "GET",
      method === "GET",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    const code = Number(data?.error?.code);
    const error = new InstagramError(
      code === 190
        ? "TOKEN_EXPIRED"
        : response.status === 429 || [4, 17, 32, 613].includes(code)
          ? "RATE_LIMIT"
          : "PROVIDER_ERROR",
      method !== "GET" && response.status >= 500,
      response.status === 429 ||
        [4, 17, 32, 613].includes(code) ||
        (method === "GET" && response.status >= 500),
    );
    if (Number.isSafeInteger(code)) error.providerCode = code;
    const subcode = data?.error?.error_subcode;
    if (Number.isSafeInteger(subcode)) error.providerSubcode = subcode;
    const traceId = data?.error?.fbtrace_id;
    if (typeof traceId === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(traceId))
      error.providerTraceId = traceId;
    // Classify provider text while it is in memory; never retain or log it.
    const message =
      typeof data?.error?.message === "string" ? data.error.message : "";
    if (
      code === 100 &&
      /nonexisting field|unknown field|invalid field/i.test(message)
    )
      error.providerIssue = "UNSUPPORTED_FIELD";
    else if (
      code === 100 &&
      (subcode === 33 || /unsupported get request/i.test(message))
    )
      error.providerIssue = "OBJECT_UNAVAILABLE";
    else if ([10, 200].includes(code))
      error.providerIssue = "PERMISSION_DENIED";
    throw error;
  }
  if (!data || typeof data !== "object")
    throw new InstagramError("DELIVERY_UNCERTAIN", method !== "GET");
  return data;
}
export async function instagramToken() {
  const account = await prisma.marketingConnection.findUnique({
    where: { id: "instagram" },
  });
  try {
    const credential = instagramCredential(account);
    return { account: account!, token: credential.accessToken };
  } catch (error) {
    if (error instanceof MarketingError) throw new InstagramError(error.code);
    throw error;
  }
}
export function instagramAuthorization(state: string) {
  const { appId, configId, loginMode } = instagramConfig();
  if (loginMode === "facebook") {
    const params: Record<string, string> = {
      client_id: appId,
      redirect_uri: oauthRedirect(),
      response_type: "code",
      state,
      ...(configId
        ? { config_id: configId, override_default_response_type: "true" }
        : {
            scope:
              "instagram_basic,instagram_content_publish,instagram_manage_insights,instagram_manage_comments,instagram_manage_contents,pages_show_list,pages_read_engagement",
            auth_type: "rerequest",
          }),
    };
    return (
      "https://www.facebook.com/" +
      apiVersion() +
      "/dialog/oauth?" +
      new URLSearchParams(params)
    );
  }
  return (
    "https://www.facebook.com/dialog/oauth?" +
    new URLSearchParams({
      client_id: appId,
      config_id: configId,
      display: "popup",
      override_default_response_type: "true",
      redirect_uri: oauthRedirect(),
      response_type: "code",
      prompt: "login",
      state,
    }).toString()
  );
}
export async function exchangeCode(code: string) {
  clearPendingInstagramAuthorization();
  const config = instagramConfig();
  // Meta specifies a server-to-server GET for this exchange. Never log the URL,
  // response body, authorization code, or credentials.
  const exchange = new URL(
    "https://graph.facebook.com/" + apiVersion() + "/oauth/access_token",
  );
  exchange.search = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: oauthRedirect(),
    code,
  }).toString();
  let response: Response;
  try {
    response = await fetch(exchange, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new InstagramError("PROVIDER_ERROR");
  }
  const result = await response.json().catch(() => null);
  if (
    !response.ok ||
    typeof result?.access_token !== "string" ||
    !result.access_token
  )
    throw new InstagramError("TOKEN_EXPIRED");
  const token: string = result.access_token;
  if (config.loginMode === "facebook") {
    await connectFacebookInstagramToken(token, result.expires_in);
    return;
  }
  const { details, expiresAt } = await inspectInstagramAuthorization(
    token,
    result.expires_in,
  );
  await completeInstagramAuthorization(token, details, expiresAt);
}

/** Used by OAuth and the server-side operator import; never accepts browser-posted tokens. */
export async function connectFacebookInstagramToken(
  token: string,
  expiresIn?: unknown,
) {
  const config = instagramConfig();
  const initial = await validateFacebookInstagramToken(token, graph, expiresIn);
  const url = new URL(
    "https://graph.facebook.com/" + apiVersion() + "/oauth/access_token",
  );
  url.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: token,
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new InstagramError("PROVIDER_ERROR");
  }
  const exchanged = await response.json().catch(() => null);
  if (
    !response.ok ||
    typeof exchanged?.access_token !== "string" ||
    !exchanged.access_token
  )
    throw new InstagramError("TOKEN_EXPIRED");
  const verified = await validateFacebookInstagramToken(
    exchanged.access_token,
    graph,
    exchanged.expires_in,
  );
  if (verified.userId !== initial.userId)
    throw new MarketingError("OAUTH_ACCOUNT_MISMATCH", 409);
  const tokenCipher = encryptFacebookInstagramCredential(
    exchanged.access_token,
    verified.userId,
    verified.profile.id,
  );
  await prisma.$transaction(async (tx) => {
    const previous = await tx.marketingConnection.findUnique({
      where: { id: "instagram" },
    });
    let sameAccount = false;
    if (previous) {
      try {
        const old = instagramCredential(previous);
        sameAccount =
          old.accountId === verified.profile.id &&
          old.userId === verified.userId;
      } catch {}
    }
    await tx.marketingConnection.upsert({
      where: { id: "instagram" },
      create: {
        id: "instagram",
        accountId: verified.profile.id,
        username: verified.profile.username,
        tokenCipher,
        expiresAt: verified.expiresAt,
        testedAt: new Date(),
      },
      update: {
        accountId: verified.profile.id,
        username: verified.profile.username,
        tokenCipher,
        expiresAt: verified.expiresAt,
        testedAt: new Date(),
        lastError: null,
      },
    });
    if (!sameAccount)
      await tx.marketingSettings.updateMany({
        where: { id: "company" },
        data: { enabled: false, revision: { increment: 1 } },
      });
  });
  clearPendingInstagramAuthorization();
}

async function inspectInstagramAuthorization(
  token: string,
  expiresIn: unknown = 0,
  knownExpiry: Date | null = null,
) {
  const config = instagramConfig();
  const inspection = await graph(
    "debug_token",
    config.appId + "|" + config.appSecret,
    {
      input_token: token,
    },
  );
  const details = inspection.data;
  if (!details?.is_valid || String(details.app_id) !== config.appId)
    throw new InstagramError("TOKEN_EXPIRED");
  const required = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
  ];
  if (
    !Array.isArray(details.scopes) ||
    required.some((scope) => !details.scopes.includes(scope))
  )
    throw new MarketingError("OAUTH_PERMISSIONS_MISSING");
  if (!Number.isSafeInteger(details.expires_at) || details.expires_at < 0)
    throw new InstagramError("PROVIDER_ERROR");
  const expiryTimes = [details.expires_at, details.data_access_expires_at]
    .filter(
      (value): value is number => Number.isSafeInteger(value) && value > 0,
    )
    .map((seconds) => seconds * 1000);
  if (typeof expiresIn === "number" && expiresIn > 0)
    expiryTimes.push(Date.now() + expiresIn * 1000);
  if (knownExpiry) expiryTimes.push(knownExpiry.getTime());
  const expiresAt = expiryTimes.length
    ? new Date(Math.min(...expiryTimes))
    : null;
  if (expiresAt && !Number.isFinite(expiresAt.getTime()))
    throw new InstagramError("PROVIDER_ERROR");
  if (expiresAt && expiresAt <= new Date())
    throw new InstagramError("TOKEN_EXPIRED");
  return { details, expiresAt };
}

async function completeInstagramAuthorization(
  token: string,
  details: Parameters<typeof discoverInstagramAccount>[2],
  expiresAt: Date | null,
  expectedBusinessId?: string,
  pendingCipher?: string,
) {
  const config = instagramConfig();
  const business = await graph("me", token, { fields: "client_business_id" });
  const businessId = business.client_business_id;
  if (
    typeof businessId !== "string" ||
    !/^\d+$/.test(businessId) ||
    (expectedBusinessId && businessId !== expectedBusinessId)
  )
    throw new MarketingError("OAUTH_BUSINESS_REQUIRED");
  let profile: Awaited<ReturnType<typeof discoverInstagramAccount>>;
  try {
    profile = await discoverInstagramAccount(
      (path, params) => graph(path, token, params),
      config.accountId,
      details,
      business.id,
    );
  } catch (error) {
    if (
      !pendingCipher &&
      error instanceof MarketingError &&
      error.code !== "TOKEN_EXPIRED"
    )
      rememberPendingInstagramAuthorization(
        token,
        businessId,
        expiresAt,
        error.code,
      );
    throw error;
  }
  const tokenCipher = encryptInstagramCredential(token, businessId, profile.id);
  // Complete every provider check before replacing the previous connection.
  await prisma.$transaction(async (tx) => {
    const previous = await tx.marketingConnection.findUnique({
      where: { id: "instagram" },
      select: { accountId: true, tokenCipher: true, expiresAt: true },
    });
    if (pendingCipher && !isCurrentPendingInstagramAuthorization(pendingCipher))
      throw new MarketingError("OAUTH_PENDING_EXPIRED", 409);
    let sameAccount = false;
    if (previous) {
      try {
        const old = instagramCredential(previous);
        sameAccount =
          old.accountId === profile.id && old.businessId === businessId;
      } catch {}
    }
    await tx.marketingConnection.upsert({
      where: { id: "instagram" },
      create: {
        id: "instagram",
        accountId: profile.id,
        username: profile.username,
        tokenCipher,
        expiresAt,
      },
      update: {
        accountId: profile.id,
        username: profile.username,
        tokenCipher,
        expiresAt,
        lastError: null,
      },
    });
    if (previous && !sameAccount)
      await tx.marketingSettings.updateMany({
        where: { id: "company" },
        data: { enabled: false, revision: { increment: 1 } },
      });
  });
  if (pendingCipher) clearPendingInstagramAuthorization(pendingCipher);
}

export async function retryPendingInstagramConnection() {
  const pending = pendingInstagramAuthorization();
  try {
    const { details, expiresAt } = await inspectInstagramAuthorization(
      pending.accessToken,
      0,
      pending.tokenExpiresAt === null ? null : new Date(pending.tokenExpiresAt),
    );
    await completeInstagramAuthorization(
      pending.accessToken,
      details,
      expiresAt,
      pending.businessId,
      pending.cipher,
    );
  } catch (error) {
    if (
      error instanceof MarketingError &&
      ["TOKEN_EXPIRED", "OAUTH_BUSINESS_REQUIRED"].includes(error.code)
    )
      clearPendingInstagramAuthorization(pending.cipher);
    throw error;
  }
}

// SUAT expiration is established by token inspection at connect time. In the
// selected "Never" configuration there is no Instagram 60-day refresh endpoint.
export async function checkInstagramToken() {
  await instagramToken();
}
export async function createContainer(
  accountId: string,
  token: string,
  urls: string[],
  caption: string,
) {
  if (urls.length < 2 || urls.length > 4)
    throw new MarketingError("CAROUSEL_REQUIRED", 400);
  const children: string[] = [];
  for (const url of urls) {
    const child = await graph(
      accountId + "/media",
      token,
      { image_url: url, is_carousel_item: "true" },
      "POST",
    );
    if (!child.id) throw new InstagramError("PROVIDER_ERROR");
    children.push(child.id);
  }
  return (
    await graph(
      accountId + "/media",
      token,
      { media_type: "CAROUSEL", children: children.join(","), caption },
      "POST",
    )
  ).id as string;
}
export const containerStatus = async (id: string, token: string) =>
  graph(id, token, { fields: "status_code" });
export const publishContainer = async (
  accountId: string,
  id: string,
  token: string,
) => graph(accountId + "/media_publish", token, { creation_id: id }, "POST");
export async function instagramMetrics(id: string, token: string) {
  const values: MetricValues = { ...EMPTY_METRICS };
  const metrics = [
    "views",
    "reach",
    "likes",
    "comments",
    "saved",
    "shares",
  ] as const;
  try {
    const result = await graph(id + "/insights", token, {
      metric: metrics.join(","),
    });
    for (const metric of metrics) {
      const entry = result.data?.find(
        (item: { name: string }) => item.name === metric,
      );
      const raw = entry?.values?.[0]?.value ?? entry?.total_value?.value;
      values[metric] =
        typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    }
    // Some integrations omit metric names for a single returned entry.
    if (
      !result.data?.length ||
      result.data.every((item: { name?: string }) => item.name)
    ) {
      return {
        values,
        reason: metrics.some((metric) => values[metric] === null)
          ? "METRICS_UNAVAILABLE"
          : null,
      };
    }
  } catch (error) {
    if (
      error instanceof MarketingError &&
      ["TOKEN_EXPIRED", "RATE_LIMIT"].includes(error.code)
    )
      throw error;
  }
  let missing = false;
  // Per-metric isolation: an unsupported metric must not discard available counts.
  for (const metric of metrics) {
    try {
      const result = await graph(id + "/insights", token, { metric });
      const raw =
        result.data?.[0]?.values?.[0]?.value ??
        result.data?.[0]?.total_value?.value;
      values[metric] =
        typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      if (values[metric] === null) missing = true;
    } catch (error) {
      if (
        error instanceof MarketingError &&
        ["TOKEN_EXPIRED", "RATE_LIMIT"].includes(error.code)
      )
        throw error;
      missing = true;
    }
  }
  return { values, reason: missing ? "METRICS_UNAVAILABLE" : null };
}
export async function instagramComments(
  id: string,
  token: string,
  after?: string,
) {
  const result = await graph(id + "/comments", token, {
    fields: "id,text,username,timestamp",
    limit: "30",
    ...(after ? { after } : {}),
  });
  return {
    items: (result.data || []).map((item: Record<string, unknown>) => ({
      id: item.id,
      text: item.text,
      username: item.username,
      timestamp: item.timestamp,
    })),
    after: result.paging?.next ? result.paging?.cursors?.after || null : null,
  };
}
