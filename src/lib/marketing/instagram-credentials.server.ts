import "server-only";
import {
  decryptToken,
  encryptToken,
  instagramConfig,
  MarketingError,
} from "./security.server";

// A versioned envelope distinguishes SUAT credentials from legacy Instagram
// tokens without a database migration. The payload, including IDs, is encrypted.
const prefix = "meta-unified-v1.";
const facebookPrefix = "meta-facebook-v1.";
type Connection = {
  accountId: string;
  tokenCipher: string | null;
  expiresAt: Date | null;
  lastError?: string | null;
};
type Credential = {
  accessToken: string;
  appId: string;
  configId: string;
  businessId?: string;
  userId?: string;
  accountId: string;
};
export function encryptInstagramCredential(
  accessToken: string,
  businessId: string,
  accountId: string,
) {
  const { appId, configId } = instagramConfig();
  return (
    prefix +
    encryptToken(
      JSON.stringify({ accessToken, appId, configId, businessId, accountId }),
    )
  );
}
export function encryptFacebookInstagramCredential(
  accessToken: string,
  userId: string,
  accountId: string,
) {
  const { appId, configId, loginMode } = instagramConfig();
  if (loginMode !== "facebook")
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  return (
    facebookPrefix +
    encryptToken(
      JSON.stringify({ accessToken, appId, configId, userId, accountId }),
    )
  );
}
export function instagramCredential(account: Connection | null): Credential {
  const config = instagramConfig();
  const expectedPrefix =
    config.loginMode === "facebook" ? facebookPrefix : prefix;
  if (!account?.tokenCipher?.startsWith(expectedPrefix))
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  if (
    account.lastError === "TOKEN_EXPIRED" ||
    (account.expiresAt && account.expiresAt <= new Date())
  )
    throw new MarketingError("TOKEN_EXPIRED", 401);
  let value: Credential;
  try {
    value = JSON.parse(
      decryptToken(account.tokenCipher.slice(expectedPrefix.length)),
    );
  } catch {
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  }
  if (
    !value ||
    typeof value.accessToken !== "string" ||
    !value.accessToken ||
    (config.loginMode === "unified"
      ? typeof value.businessId !== "string" || !/^\d+$/.test(value.businessId)
      : typeof value.userId !== "string" ||
        !/^\d+$/.test(value.userId) ||
        !account.expiresAt ||
        !Number.isFinite(account.expiresAt.getTime())) ||
    value.appId !== config.appId ||
    value.configId !== config.configId ||
    value.accountId !== account.accountId ||
    (config.accountId && value.accountId !== config.accountId)
  )
    throw new MarketingError("OAUTH_RECONNECT_REQUIRED", 401);
  return value;
}
export function instagramConnectionReady(
  account: Connection | null | undefined,
) {
  if (!account || account.lastError) return false;
  try {
    instagramCredential(account);
    return true;
  } catch {
    return false;
  }
}
