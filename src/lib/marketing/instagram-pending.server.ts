import "server-only";
import {
  decryptToken,
  encryptToken,
  instagramConfig,
  MarketingError,
} from "./security.server";
import { instagramOAuthIssue } from "./instagram-oauth";

// One encrypted, short-lived authorization per server process. It is never a
// connected publishing credential and disappears when the process restarts.
const prefix = "meta-unified-pending-v1.";
const lifetime = 15 * 60_000;
type Session = {
  cipher: string;
  expiresAt: number;
  issue: ReturnType<typeof instagramOAuthIssue>;
};
type Slot = {
  session: Session | null;
  timer: ReturnType<typeof setTimeout> | null;
};
const key = Symbol.for("solusindo.marketing.instagram.pending");
const runtime = globalThis as typeof globalThis & {
  [key: symbol]: Slot | undefined;
};
const slot = runtime[key] ?? (runtime[key] = { session: null, timer: null });
type Authorization = {
  accessToken: string;
  appId: string;
  configId: string;
  accountId: string;
  businessId: string;
  tokenExpiresAt: number | null;
};

export function clearPendingInstagramAuthorization(cipher?: string) {
  if (cipher && slot.session?.cipher !== cipher) return;
  if (slot.timer) clearTimeout(slot.timer);
  slot.session = null;
  slot.timer = null;
}

export function rememberPendingInstagramAuthorization(
  accessToken: string,
  businessId: string,
  tokenExpiresAt: Date | null,
  issue: string,
) {
  const { appId, configId, accountId } = instagramConfig();
  const expiresAt = Math.min(
    Date.now() + lifetime,
    tokenExpiresAt?.getTime() ?? Infinity,
  );
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
  const cipher =
    prefix +
    encryptToken(
      JSON.stringify({
        accessToken,
        appId,
        configId,
        accountId,
        businessId,
        tokenExpiresAt: tokenExpiresAt?.getTime() ?? null,
      } satisfies Authorization),
    );
  clearPendingInstagramAuthorization();
  slot.session = { cipher, expiresAt, issue: instagramOAuthIssue(issue) };
  slot.timer = setTimeout(
    () => clearPendingInstagramAuthorization(cipher),
    expiresAt - Date.now(),
  );
  slot.timer.unref();
}

export function pendingInstagramAuthorization() {
  const session = slot.session;
  if (!session || session.expiresAt <= Date.now()) {
    clearPendingInstagramAuthorization();
    throw new MarketingError("OAUTH_PENDING_EXPIRED", 409);
  }
  try {
    const value: Authorization = JSON.parse(
      decryptToken(session.cipher.slice(prefix.length)),
    );
    const config = instagramConfig();
    if (
      value.appId !== config.appId ||
      value.configId !== config.configId ||
      value.accountId !== config.accountId ||
      typeof value.accessToken !== "string" ||
      !value.accessToken ||
      typeof value.businessId !== "string" ||
      !/^\d+$/.test(value.businessId) ||
      (value.tokenExpiresAt !== null &&
        (!Number.isFinite(value.tokenExpiresAt) ||
          value.tokenExpiresAt <= Date.now()))
    )
      throw new Error();
    return { ...value, ...session };
  } catch {
    clearPendingInstagramAuthorization();
    throw new MarketingError("OAUTH_PENDING_EXPIRED", 409);
  }
}

export function pendingInstagramStatus() {
  try {
    const pending = pendingInstagramAuthorization();
    return {
      available: true,
      expiresAt: new Date(pending.expiresAt).toISOString(),
      issue: pending.issue,
    };
  } catch {
    return { available: false, expiresAt: null, issue: null };
  }
}

export function isCurrentPendingInstagramAuthorization(cipher: string) {
  return slot.session?.cipher === cipher && slot.session.expiresAt > Date.now();
}
