import "server-only";
import { MarketingError } from "./security.server";

type Account = { id: string; username: string; sourceId?: string };
type GraphResult = {
  data?: unknown;
  paging?: { next?: unknown; cursors?: { after?: unknown } };
  id?: unknown;
  username?: unknown;
};
type Read = (
  path: string,
  params: Record<string, string>,
) => Promise<GraphResult>;
type TokenMetadata = {
  user_id?: unknown;
  type?: unknown;
  granular_scopes?: unknown;
};
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^\d+$/.test(value);

function account(value: unknown): Account {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    !isId(value.id) ||
    !("username" in value) ||
    typeof value.username !== "string" ||
    !value.username
  )
    throw new MarketingError("PROVIDER_ERROR", 503);
  return { id: value.id, username: value.username };
}

function grantedInstagramIds(scopes: unknown, permission = "instagram_basic") {
  const ids = new Set<string>();
  if (!Array.isArray(scopes)) return ids;
  for (const grant of scopes) {
    // Other scopes can target business portfolios, Facebook Pages, or ads.
    // They must never become Instagram account candidates.
    if (grant?.scope !== permission || !Array.isArray(grant.target_ids))
      continue;
    for (const raw of grant.target_ids) {
      const id =
        typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0
          ? String(raw)
          : raw;
      if (!isId(id)) throw new MarketingError("PROVIDER_ERROR", 503);
      ids.add(id);
      if (ids.size > 100) throw new MarketingError("OAUTH_MULTIPLE_ACCOUNTS");
    }
  }
  return ids;
}

/** Resolve only accounts assigned to the SUAT or named by its Instagram grant. */
export async function discoverInstagramAccount(
  read: Read,
  preferred: string,
  metadata: TokenMetadata,
  meId: unknown,
): Promise<Account> {
  const diagnostic = {
    stage: "assigned_accounts",
    tokenType: ["SYSTEM_USER", "USER", "PAGE", "APP"].includes(
      String(metadata.type),
    )
      ? String(metadata.type)
      : "OTHER",
    assignedAccounts: 0,
    grantedAccounts: 0,
    profileReads: 0,
    explicitSystemUser: false,
    retriedAssignedRead: false,
    preferredAccount: !!preferred,
    configuredAccountRead: false,
    publishingAccessVerified: false,
  };
  try {
    async function assigned(user: string) {
      diagnostic.stage = "assigned_accounts";
      const accounts = new Map<string, Account>();
      const seen = new Set<string>();
      let after = "";
      for (let page = 0; page < 20; page++) {
        const result = await read(user + "/assigned_instagram_accounts", {
          fields: "id,username",
          limit: "100",
          ...(after ? { after } : {}),
        });
        if (!Array.isArray(result.data))
          throw new MarketingError("PROVIDER_ERROR", 503);
        for (const value of result.data) {
          const profile = account(value);
          accounts.set(profile.id, profile);
        }
        if (preferred && accounts.has(preferred)) return accounts;
        if (!result.paging?.next) return accounts;
        const cursor = result.paging.cursors?.after;
        if (typeof cursor !== "string" || !cursor || seen.has(cursor))
          throw new MarketingError("PROVIDER_ERROR", 503);
        seen.add(cursor);
        after = cursor;
      }
      throw new MarketingError("PROVIDER_ERROR", 503);
    }
    async function profileById(id: string) {
      diagnostic.stage = "profile";
      diagnostic.profileReads++;
      // Request only fields documented for the current IG User API. The old
      // Graph shadow-user reference lists ig_id, which this setup may reject.
      const result = await read(id, { fields: "id,username" });
      return { ...account(result), sourceId: id };
    }
    async function verifyPublishingAccess(profile: Account) {
      diagnostic.stage = "publishing_access";
      // This Instagram-specific, read-only edge verifies the object type and
      // publishing access without depending on legacy identity fields.
      const capability = await read(profile.id + "/content_publishing_limit", {
        fields: "quota_usage",
      });
      const usage = Array.isArray(capability.data)
        ? capability.data[0]?.quota_usage
        : null;
      if (typeof usage !== "number" || !Number.isInteger(usage) || usage < 0)
        throw new MarketingError("OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE");
      diagnostic.publishingAccessVerified = true;
    }
    function permittedProfile(profile: Account) {
      for (const permission of [
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
      ]) {
        const targets = grantedInstagramIds(
          metadata.granular_scopes,
          permission,
        );
        if (
          targets.size &&
          !targets.has(profile.id) &&
          !(profile.sourceId && targets.has(profile.sourceId))
        )
          throw new MarketingError("OAUTH_PERMISSIONS_MISSING");
      }
      return profile;
    }

    const granted = grantedInstagramIds(metadata.granular_scopes);
    diagnostic.grantedAccounts = granted.size;
    let accounts = await assigned("me");
    if (
      !accounts.size &&
      metadata.type === "SYSTEM_USER" &&
      isId(metadata.user_id) &&
      metadata.user_id !== meId
    ) {
      diagnostic.explicitSystemUser = true;
      accounts = await assigned(metadata.user_id);
    }
    if (!accounts.size && !granted.size) {
      // A second bounded read lets a newly completed asset assignment settle.
      diagnostic.retriedAssignedRead = true;
      accounts = await assigned("me");
    }
    diagnostic.assignedAccounts = accounts.size;

    if (granted.size) {
      // Granular consent restricts discovery even when /assigned_* includes
      // additional accounts from earlier connections.
      const candidates = new Map<string, Account>();
      const targets =
        preferred && granted.has(preferred) ? [preferred] : [...granted];
      if (!preferred && targets.length > 1)
        throw new MarketingError("OAUTH_MULTIPLE_ACCOUNTS");
      for (const id of targets) {
        let profile = accounts.get(id);
        if (!profile) {
          profile = permittedProfile(await profileById(id));
          await verifyPublishingAccess(profile);
        }
        candidates.set(profile.id, profile);
        if (preferred && profile.id === preferred) break;
      }
      accounts = candidates;
    }

    if (preferred && !accounts.has(preferred) && !granted.size) {
      // A server-configured company ID is only a lookup hint. Read both its
      // Instagram profile and its publishing capability with this SUAT before
      // accepting it; never bypass explicit granular account restrictions.
      diagnostic.configuredAccountRead = true;
      const profile = await profileById(preferred);
      if (profile.id !== preferred)
        throw new MarketingError("OAUTH_ACCOUNT_MISMATCH");
      permittedProfile(profile);
      await verifyPublishingAccess(profile);
      accounts.set(profile.id, profile);
    }

    if (preferred) {
      const profile = accounts.get(preferred);
      if (profile) return permittedProfile(profile);
      throw new MarketingError("OAUTH_ACCOUNT_MISMATCH");
    }
    if (!accounts.size) throw new MarketingError("OAUTH_ACCOUNT_NOT_SHARED");
    if (accounts.size > 1) throw new MarketingError("OAUTH_MULTIPLE_ACCOUNTS");
    return permittedProfile([...accounts.values()][0]);
  } catch (error) {
    const provider = error && typeof error === "object" ? error : {};
    const unavailable =
      error instanceof MarketingError &&
      error.code === "PROVIDER_ERROR" &&
      "providerIssue" in provider &&
      ["OBJECT_UNAVAILABLE", "PERMISSION_DENIED"].includes(
        String(provider.providerIssue),
      );
    const issue =
      unavailable && diagnostic.stage === "profile"
        ? "OAUTH_ACCOUNT_PROFILE_UNAVAILABLE"
        : unavailable && diagnostic.stage === "publishing_access"
          ? "OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE"
          : error instanceof MarketingError
            ? error.code
            : "PROVIDER_ERROR";
    // Counts and static issue codes only: no token, authorization code, URLs,
    // usernames, account IDs, or raw provider responses enter this log.
    console.warn("[Pemasaran Instagram account discovery]", {
      ...diagnostic,
      issue,
      providerCode:
        "providerCode" in provider &&
        typeof provider.providerCode === "number" &&
        Number.isSafeInteger(provider.providerCode)
          ? provider.providerCode
          : null,
      providerSubcode:
        "providerSubcode" in provider &&
        typeof provider.providerSubcode === "number" &&
        Number.isSafeInteger(provider.providerSubcode)
          ? provider.providerSubcode
          : null,
      providerIssue:
        "providerIssue" in provider &&
        typeof provider.providerIssue === "string" &&
        [
          "UNSUPPORTED_FIELD",
          "OBJECT_UNAVAILABLE",
          "PERMISSION_DENIED",
        ].includes(provider.providerIssue)
          ? provider.providerIssue
          : null,
    });
    if (error instanceof MarketingError && issue !== error.code)
      throw new MarketingError(issue, 503);
    throw error;
  }
}
