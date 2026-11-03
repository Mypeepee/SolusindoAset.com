import "server-only";
import { instagramConfig, MarketingError } from "./security.server";

type Read = (
  path: string,
  token: string,
  params?: Record<string, string>,
) => Promise<any>;
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d{0,31}$/.test(value);

/** A pinned company ID is accepted only after Meta verifies profile and publishing access. */
export async function validateFacebookInstagramToken(
  token: string,
  read: Read,
  expiresIn?: unknown,
) {
  const config = instagramConfig();
  if (config.loginMode !== "facebook")
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  const inspected = await read(
    "debug_token",
    config.appId + "|" + config.appSecret,
    { input_token: token },
  );
  const details = inspected.data;
  if (!details?.is_valid || String(details.app_id) !== config.appId)
    throw new MarketingError("TOKEN_EXPIRED", 401);
  if (details.type !== "USER" || !isId(details.user_id))
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  if (
    !Array.isArray(details.scopes) ||
    [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
    ].some((scope) => !details.scopes.includes(scope))
  )
    throw new MarketingError("OAUTH_PERMISSIONS_MISSING", 409);
  if (!Number.isSafeInteger(details.expires_at) || details.expires_at <= 0)
    throw new MarketingError("TOKEN_EXPIRED", 401);
  const expiries = [details.expires_at * 1000];
  if (details.data_access_expires_at !== undefined) {
    if (
      !Number.isSafeInteger(details.data_access_expires_at) ||
      details.data_access_expires_at < 0
    )
      throw new MarketingError("TOKEN_EXPIRED", 401);
    if (details.data_access_expires_at)
      expiries.push(details.data_access_expires_at * 1000);
  }
  if (
    typeof expiresIn === "number" &&
    Number.isFinite(expiresIn) &&
    expiresIn > 0
  )
    expiries.push(Date.now() + expiresIn * 1000);
  const expiresAt = new Date(Math.min(...expiries));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
    throw new MarketingError("TOKEN_EXPIRED", 401);
  let profile: any;
  try {
    profile = await read(config.accountId, token, { fields: "id,username" });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "providerIssue" in error &&
      ["OBJECT_UNAVAILABLE", "PERMISSION_DENIED"].includes(
        String(error.providerIssue),
      )
    )
      throw new MarketingError("OAUTH_ACCOUNT_PROFILE_UNAVAILABLE", 503);
    throw error;
  }
  if (!isId(profile?.id) || profile.id !== config.accountId)
    throw new MarketingError("OAUTH_ACCOUNT_MISMATCH", 409);
  if (typeof profile.username !== "string" || !profile.username)
    throw new MarketingError("OAUTH_ACCOUNT_PROFILE_UNAVAILABLE", 503);
  const quota = await read(profile.id + "/content_publishing_limit", token, {
    fields: "quota_usage",
  });
  const usage = quota.data?.[0]?.quota_usage;
  if (!Number.isInteger(usage) || usage < 0)
    throw new MarketingError("OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE", 503);
  return {
    userId: details.user_id as string,
    profile: { id: profile.id as string, username: profile.username as string },
    expiresAt,
  };
}
