const { createHmac } = require("node:crypto");

/** Operator-only, read-only comparison. Credentials never enter the report. */
async function diagnoseInstagramTestToken(config, request = global.fetch) {
  const { token, appId, appSecret, accountId } = config;
  if (!token || !appSecret || !/^\d+$/.test(appId) || !/^\d+$/.test(accountId))
    throw new Error("INSTAGRAM_DIAGNOSTIC_CONFIGURATION_REQUIRED");

  async function read(host, path, fields, credential, parameters = {}) {
    try {
      const url = new URL("https://" + host + "/v26.0/" + path);
      if (fields) url.searchParams.set("fields", fields);
      url.searchParams.set("access_token", credential);
      for (const [key, value] of Object.entries(parameters))
        url.searchParams.set(key, value);
      if (host === "graph.facebook.com")
        url.searchParams.set(
          "appsecret_proof",
          createHmac("sha256", appSecret).update(credential).digest("hex"),
        );
      const response = await request(url, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      const error = data?.error;
      if (!response.ok || error)
        return {
          ok: false,
          summary: {
            ok: false,
            httpStatus: response.status,
            providerCode: Number.isSafeInteger(error?.code) ? error.code : null,
            providerSubcode: Number.isSafeInteger(error?.error_subcode)
              ? error.error_subcode
              : null,
            providerTraceId:
              typeof error?.fbtrace_id === "string" &&
              /^[A-Za-z0-9_-]{8,200}$/.test(error.fbtrace_id)
                ? error.fbtrace_id
                : null,
          },
        };
      return {
        ok: true,
        data,
        summary: { ok: true, httpStatus: response.status },
      };
    } catch {
      return {
        ok: false,
        summary: { ok: false, issue: "DIAGNOSTIC_READ_FAILED" },
      };
    }
  }

  const [inspected, facebookProfile, instagramProfile] = await Promise.all([
    read("graph.facebook.com", "debug_token", "", appId + "|" + appSecret, {
      input_token: token,
    }),
    read("graph.facebook.com", accountId, "id,username", token),
    read("graph.instagram.com", "me", "user_id,username", token),
  ]);
  const details = inspected.ok ? inspected.data?.data : null;
  const names = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_messages",
    "instagram_manage_insights",
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
  ];
  const profile = (result, identityField) => ({
    ...result.summary,
    ...(result.ok
      ? {
          matchesCompany: result.data?.[identityField] === accountId,
          hasUsername:
            typeof result.data?.username === "string" && !!result.data.username,
        }
      : {}),
  });
  const report = {
    mode: "READ_ONLY_TEST_TOKEN_COMPARISON",
    inspection: {
      ...inspected.summary,
      valid: details?.is_valid === true,
      appMatches: details ? String(details.app_id) === appId : null,
      type: ["SYSTEM_USER", "USER", "PAGE", "APP"].includes(details?.type)
        ? details.type
        : null,
      permissions: names.filter(
        (name) =>
          Array.isArray(details?.scopes) && details.scopes.includes(name),
      ),
    },
    facebookProfile: profile(facebookProfile, "id"),
    instagramLoginProfile: profile(instagramProfile, "user_id"),
  };
  if (
    details?.is_valid &&
    String(details.app_id) === appId &&
    details.type === "SYSTEM_USER"
  ) {
    const [business, accounts] = await Promise.all([
      read("graph.facebook.com", "me", "client_business_id", token),
      read(
        "graph.facebook.com",
        "me/assigned_instagram_accounts",
        "id,username",
        token,
      ),
    ]);
    report.business = {
      ...business.summary,
      hasBusinessId:
        business.ok && /^\d+$/.test(business.data?.client_business_id || ""),
    };
    report.assignedAccounts = {
      ...accounts.summary,
      ...(accounts.ok
        ? {
            count: Array.isArray(accounts.data?.data)
              ? accounts.data.data.length
              : null,
            includesCompany:
              Array.isArray(accounts.data?.data) &&
              accounts.data.data.some((row) => row?.id === accountId),
          }
        : {}),
    };
  }
  if (
    details?.is_valid &&
    String(details.app_id) === appId &&
    details.type === "USER"
  ) {
    const required = ["instagram_basic", "pages_show_list"];
    const missing = required.filter(
      (permission) =>
        !Array.isArray(details.scopes) || !details.scopes.includes(permission),
    );
    report.facebookLogin = missing.length
      ? {
          attempted: false,
          issue: "FACEBOOK_PAGE_PERMISSIONS_MISSING",
          missingPermissions: missing,
        }
      : await inspectFacebookPages();
  }
  return report;

  async function inspectFacebookPages() {
    const pages = new Map();
    const seenCursors = new Set();
    let after = "";
    for (let page = 0; page < 20; page++) {
      const result = await read(
        "graph.facebook.com",
        "me/accounts",
        "id,instagram_business_account",
        token,
        { limit: "100", ...(after ? { after } : {}) },
      );
      if (!result.ok) return { attempted: true, pages: result.summary };
      if (!Array.isArray(result.data?.data) || result.data.data.length > 100)
        return { attempted: true, issue: "FACEBOOK_PAGES_INVALID_RESPONSE" };
      for (const row of result.data.data) {
        const linked = row?.instagram_business_account;
        if (
          typeof row?.id !== "string" ||
          !/^\d+$/.test(row.id) ||
          (linked != null &&
            (typeof linked?.id !== "string" || !/^\d+$/.test(linked.id)))
        )
          return { attempted: true, issue: "FACEBOOK_PAGES_INVALID_RESPONSE" };
        pages.set(row.id, linked?.id || null);
      }
      // Rebuild the fixed Meta URL using the cursor; never follow paging.next.
      if (!result.data.paging?.next) {
        const linked = [...pages.values()].filter(Boolean);
        const companyLinked = linked.includes(accountId);
        const profileMatches =
          facebookProfile.ok &&
          facebookProfile.data?.id === accountId &&
          typeof facebookProfile.data?.username === "string" &&
          !!facebookProfile.data.username;
        let publishingAccess = { attempted: false };
        if (
          companyLinked &&
          profileMatches &&
          details.scopes.includes("instagram_content_publish")
        ) {
          const quota = await read(
            "graph.facebook.com",
            accountId + "/content_publishing_limit",
            "quota_usage",
            token,
          );
          const usage = quota.ok ? quota.data?.data?.[0]?.quota_usage : null;
          publishingAccess = {
            attempted: true,
            ...quota.summary,
            verified: Number.isInteger(usage) && usage >= 0,
          };
        }
        return {
          attempted: true,
          pages: {
            ok: true,
            count: pages.size,
            linkedInstagramAccounts: new Set(linked).size,
            companyLinked,
          },
          companyProfileReadable: profileMatches,
          publishingAccess,
          readyForConnectionTest:
            companyLinked &&
            profileMatches &&
            publishingAccess.verified === true,
        };
      }
      const cursor = result.data.paging.cursors?.after;
      if (
        typeof cursor !== "string" ||
        !cursor ||
        cursor.length > 2048 ||
        seenCursors.has(cursor)
      )
        return { attempted: true, issue: "FACEBOOK_PAGINATION_UNVERIFIED" };
      seenCursors.add(cursor);
      after = cursor;
    }
    return { attempted: true, issue: "FACEBOOK_PAGINATION_UNVERIFIED" };
  }
}

module.exports = { diagnoseInstagramTestToken };

if (require.main === module) {
  const dotenv = require("dotenv");
  dotenv.config({ quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });
  const token = process.env.INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN?.trim();
  delete process.env.INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN;
  if (!token) {
    process.stdout.write(
      "Simpan token uji sementara pada INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN di .env.local, lalu jalankan kembali. Jangan kirim token ke chat.\n",
    );
    process.exitCode = 1;
  } else {
    diagnoseInstagramTestToken({
      token,
      appId: process.env.META_APP_ID?.trim() || "",
      appSecret: process.env.META_APP_SECRET?.trim() || "",
      accountId: process.env.INSTAGRAM_ACCOUNT_ID?.trim() || "",
    })
      .then((report) =>
        process.stdout.write(JSON.stringify(report, null, 2) + "\n"),
      )
      .catch(() => {
        process.stdout.write(
          "Pemeriksaan belum dapat dijalankan. Periksa konfigurasi server.\n",
        );
        process.exitCode = 1;
      });
  }
}
