import "server-only";
import { graph, InstagramError } from "./instagram.server";
import { instagramConfig, MarketingError } from "./security.server";
import { referenceInstagramReads } from "./instagram-reference.server";
import {
  clearPendingInstagramAuthorization,
  isCurrentPendingInstagramAuthorization,
  pendingInstagramAuthorization,
} from "./instagram-pending.server";

const permissions = [
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "business_management",
] as const;
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^\d+$/.test(value);

/** OWNER-only diagnosis. Every provider request here is read-only. */
export async function inspectPendingInstagramConnection() {
  const pending = pendingInstagramAuthorization();
  const config = instagramConfig();
  const inspection = await graph(
    "debug_token",
    config.appId + "|" + config.appSecret,
    {
      input_token: pending.accessToken,
    },
  );
  const details = inspection.data;
  if (!details?.is_valid || String(details.app_id) !== config.appId) {
    clearPendingInstagramAuthorization(pending.cipher);
    throw new MarketingError("TOKEN_EXPIRED", 401);
  }
  const business = await graph("me", pending.accessToken, {
    fields: "client_business_id",
  });
  if (business.client_business_id !== pending.businessId) {
    clearPendingInstagramAuthorization(pending.cipher);
    throw new MarketingError("OAUTH_BUSINESS_REQUIRED", 409);
  }
  async function probe(
    path: string,
    params: Record<string, string>,
    select: (result: any) => Record<string, unknown>,
    authTransport: "bearer" | "parameter" = "bearer",
  ) {
    try {
      const result = await graph(
        path,
        pending.accessToken,
        params,
        "GET",
        authTransport,
      );
      return { ok: true, ...select(result) };
    } catch (error) {
      return {
        ok: false,
        issue:
          error instanceof InstagramError &&
          ["TOKEN_EXPIRED", "RATE_LIMIT", "PROVIDER_ERROR"].includes(error.code)
            ? error.code
            : "PROVIDER_ERROR",
        providerCode:
          error instanceof InstagramError ? (error.providerCode ?? null) : null,
        providerSubcode:
          error instanceof InstagramError
            ? (error.providerSubcode ?? null)
            : null,
        providerIssue:
          error instanceof InstagramError
            ? (error.providerIssue ?? null)
            : null,
        providerTraceId:
          error instanceof InstagramError
            ? (error.providerTraceId ?? null)
            : null,
      };
    }
  }
  const assigned = (result: any) => ({
    count: Array.isArray(result.data) ? result.data.length : null,
    includesCompany:
      Array.isArray(result.data) &&
      result.data.some((row: any) => row?.id === config.accountId),
    hasMore: !!result.paging?.next,
  });
  const reads = [
    [
      "systemUserProfile",
      () =>
        probe("me", { fields: "id,name" }, (result) => ({
          name: typeof result.name === "string" ? result.name : null,
          matchesInspectedUser: result.id === details.user_id,
        })),
    ],
    [
      "clientBusiness",
      () =>
        probe(pending.businessId, { fields: "id,name" }, (result) => ({
          name: typeof result.name === "string" ? result.name : null,
          matchesBusiness: result.id === pending.businessId,
        })),
    ],
    [
      "businessOwnedAccounts",
      () =>
        probe(
          pending.businessId + "/owned_instagram_accounts",
          { fields: "id,username", limit: "100" },
          assigned,
        ),
    ],
    [
      "assignedAccounts",
      () =>
        probe(
          "me/assigned_instagram_accounts",
          { fields: "id,username", limit: "100" },
          assigned,
        ),
    ],
    [
      "parameterAssignedAccounts",
      () =>
        probe(
          "me/assigned_instagram_accounts",
          { fields: "id,username", limit: "100" },
          assigned,
          "parameter",
        ),
    ],
    ...(isId(details.user_id)
      ? ([
          [
            "explicitSystemUserAccounts",
            () =>
              probe(
                details.user_id + "/assigned_instagram_accounts",
                { fields: "id,username", limit: "100" },
                assigned,
              ),
          ],
        ] as const)
      : []),
    ...(config.accountId
      ? ([
          [
            "companyIdentity",
            () =>
              probe(config.accountId, { fields: "id" }, (result) => ({
                matchesCompany: result.id === config.accountId,
              })),
          ],
          [
            "companyProfile",
            () =>
              probe(config.accountId, { fields: "id,username" }, (result) => ({
                matchesCompany: result.id === config.accountId,
                hasUsername:
                  typeof result.username === "string" && !!result.username,
              })),
          ],
          [
            "publishingAccess",
            () =>
              probe(
                config.accountId + "/content_publishing_limit",
                { fields: "quota_usage" },
                (result) => ({
                  verified:
                    Array.isArray(result.data) &&
                    typeof result.data[0]?.quota_usage === "number" &&
                    Number.isInteger(result.data[0].quota_usage) &&
                    result.data[0].quota_usage >= 0,
                }),
              ),
          ],
          [
            "parameterCompanyProfile",
            () =>
              probe(
                config.accountId,
                { fields: "id,username" },
                (result) => ({
                  matchesCompany: result.id === config.accountId,
                  hasUsername:
                    typeof result.username === "string" && !!result.username,
                }),
                "parameter",
              ),
          ],
          [
            "parameterPublishingAccess",
            () =>
              probe(
                config.accountId + "/content_publishing_limit",
                { fields: "quota_usage" },
                (result) => ({
                  verified:
                    Array.isArray(result.data) &&
                    typeof result.data[0]?.quota_usage === "number" &&
                    Number.isInteger(result.data[0].quota_usage) &&
                    result.data[0].quota_usage >= 0,
                }),
                "parameter",
              ),
          ],
        ] as const)
      : []),
  ] as const;
  const [results, referenceReads] = await Promise.all([
    Promise.all(reads.map(async ([name, read]) => [name, await read()])),
    referenceInstagramReads(pending.accessToken, config.accountId),
  ]);
  if (!isCurrentPendingInstagramAuthorization(pending.cipher))
    throw new MarketingError("OAUTH_PENDING_EXPIRED", 409);
  return {
    expiresAt: new Date(pending.expiresAt).toISOString(),
    tokenValid: true,
    appMatches: true,
    isSystemUser: details.type === "SYSTEM_USER",
    // IDs are returned only to an authenticated OWNER, never console logs.
    clientBusinessId: pending.businessId,
    systemUserId: isId(details.user_id) ? details.user_id : null,
    permissions: Object.fromEntries(
      permissions.map((permission) => [
        permission,
        Array.isArray(details.scopes) && details.scopes.includes(permission),
      ]),
    ),
    instagramTargetCount: Array.isArray(details.granular_scopes)
      ? details.granular_scopes
          .filter((scope: any) => scope?.scope === "instagram_basic")
          .reduce(
            (count: number, scope: any) =>
              count +
              (Array.isArray(scope.target_ids) ? scope.target_ids.length : 0),
            0,
          )
      : 0,
    reads: { ...Object.fromEntries(results), ...referenceReads },
  };
}
