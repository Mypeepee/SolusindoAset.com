import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveChatbotOwner } from "@/lib/chatbot/server-access";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export class MarketingError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function encryptionKey() {
  const raw = process.env.MARKETING_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new MarketingError("ENCRYPTION_NOT_CONFIGURED", 503);
  return key;
}
export function encryptToken(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((value) => value.toString("base64url"))
    .join(".");
}
export function decryptToken(value: string) {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !encrypted)
    throw new MarketingError("TOKEN_EXPIRED", 503);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new MarketingError("TOKEN_EXPIRED", 503);
  }
}
export function sameSecret(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return !!a && left.length === right.length && timingSafeEqual(left, right);
}
export function publicOrigin() {
  try {
    const url = new URL(process.env.MARKETING_PUBLIC_ORIGIN || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      /^(localhost|127\.|0\.|\[|10\.|192\.168\.|169\.254\.)/i.test(
        url.hostname,
      ) ||
      url.hostname.endsWith(".local")
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new MarketingError("PUBLIC_ORIGIN_NOT_CONFIGURED", 503);
  }
}
export const oauthRedirect = () =>
  publicOrigin() + "/api/dashboard/pemasaran/instagram/callback";
export function instagramConfig() {
  const loginMode = process.env.INSTAGRAM_LOGIN_MODE?.trim() || "unified";
  const appId = process.env.META_APP_ID?.trim() || "";
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const configId =
    (loginMode === "facebook"
      ? process.env.INSTAGRAM_FACEBOOK_CONFIG_ID
      : process.env.INSTAGRAM_CONFIG_ID
    )?.trim() || "";
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID?.trim() || "";
  if (
    !/^\d+$/.test(appId) ||
    !appSecret ||
    !["unified", "facebook"].includes(loginMode) ||
    (loginMode === "unified" && !/^\d+$/.test(configId)) ||
    (loginMode === "facebook" &&
      (!/^\d+$/.test(accountId) || (configId && !/^\d+$/.test(configId)))) ||
    (accountId && !/^\d+$/.test(accountId))
  )
    throw new MarketingError("INSTAGRAM_NOT_CONFIGURED", 503);
  return { appId, appSecret, configId, accountId, loginMode };
}
export function instagramSetup() {
  const loginMode = process.env.INSTAGRAM_LOGIN_MODE?.trim() || "unified";
  const facebook = loginMode === "facebook";
  let keyReady = false,
    origin: string | null = null;
  try {
    encryptionKey();
    keyReady = true;
  } catch {}
  try {
    origin = publicOrigin();
  } catch {}
  const checks = [
    {
      key: "META_APP_ID",
      label: "Meta App ID",
      ready: /^\d+$/.test(process.env.META_APP_ID?.trim() || ""),
    },
    {
      key: "META_APP_SECRET",
      label: "Meta App Secret",
      ready: !!process.env.META_APP_SECRET?.trim(),
    },
    ...(!facebook
      ? [
          {
            key: "INSTAGRAM_CONFIG_ID",
            label: "Configuration ID Unified Login",
            ready: /^\d+$/.test(process.env.INSTAGRAM_CONFIG_ID?.trim() || ""),
          },
        ]
      : process.env.INSTAGRAM_FACEBOOK_CONFIG_ID?.trim()
        ? [
            {
              key: "INSTAGRAM_FACEBOOK_CONFIG_ID",
              label: "Configuration ID Facebook Login",
              ready: /^\d+$/.test(
                process.env.INSTAGRAM_FACEBOOK_CONFIG_ID.trim(),
              ),
            },
          ]
        : []),
    {
      key: "MARKETING_PUBLIC_ORIGIN",
      label: "Domain HTTPS publik",
      ready: !!origin,
    },
    {
      key: "MARKETING_ENCRYPTION_KEY",
      label: "Kunci enkripsi server",
      ready: keyReady,
    },
  ];
  if (facebook || process.env.INSTAGRAM_ACCOUNT_ID?.trim())
    checks.push({
      key: "INSTAGRAM_ACCOUNT_ID",
      label: "Akun Instagram perusahaan",
      ready: /^\d+$/.test(process.env.INSTAGRAM_ACCOUNT_ID?.trim() || ""),
    });
  if (!["unified", "facebook"].includes(loginMode))
    checks.push({
      key: "INSTAGRAM_LOGIN_MODE",
      label: "Metode login Instagram",
      ready: false,
    });
  return {
    loginMode: facebook ? ("facebook" as const) : ("unified" as const),
    ready: checks.every((check) => check.ready),
    environmentReady: keyReady && !!origin,
    checks,
    origin,
    callbackUrl: origin
      ? origin + "/api/dashboard/pemasaran/instagram/callback"
      : null,
  };
}
export function requireInstagramOrigin(origin: string) {
  if (origin !== publicOrigin())
    throw new MarketingError("OAUTH_DOMAIN_MISMATCH", 400);
}
export function marketingRequestOrigin(request: NextRequest) {
  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host
  )
    .split(",")[0]
    .trim();
  const protocol = (
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(/:$/, "")
  )
    .split(",")[0]
    .trim();
  try {
    const url = new URL(protocol + "://" + host);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new MarketingError("FORBIDDEN", 403);
  }
}
export function mediaSignature(jobId: string, name: string, expires: number) {
  return createHmac("sha256", encryptionKey())
    .update(jobId + "/" + name + "/" + expires)
    .digest("base64url");
}
export function mediaUrl(
  jobId: string,
  name: string,
  expires = Date.now() + 48 * 3600000,
) {
  return (
    publicOrigin() +
    "/api/pemasaran/media/" +
    jobId +
    "/" +
    name +
    "?expires=" +
    expires +
    "&signature=" +
    mediaSignature(jobId, name, expires)
  );
}
export async function requireMarketingOwner(
  request?: NextRequest,
  write = false,
) {
  const access = await resolveChatbotOwner();
  if (access.status !== 200)
    throw new MarketingError(
      access.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      access.status,
    );
  if (write && request) {
    const origin = request.headers.get("origin");
    const allowed = [
      request.nextUrl.origin,
      marketingRequestOrigin(request),
      process.env.NEXTAUTH_URL,
      process.env.MARKETING_PUBLIC_ORIGIN,
    ].filter(Boolean);
    if (!origin || !allowed.includes(origin))
      throw new MarketingError("FORBIDDEN", 403);
  }
  return access;
}
export async function readJson(request: Request, limit = 131072) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new MarketingError("INVALID_REQUEST", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new MarketingError("INVALID_REQUEST", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new MarketingError("TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new MarketingError("INVALID_REQUEST", 400);
  }
}
export function apiFailure(error: unknown) {
  const code =
    error instanceof MarketingError
      ? error.code
      : (error as { code?: string })?.code === "P2021"
        ? "SCHEMA_NOT_READY"
        : "SERVICE_UNAVAILABLE";
  return NextResponse.json(
    { error: code },
    {
      status: error instanceof MarketingError ? error.status : 503,
      headers: privateHeaders,
    },
  );
}
