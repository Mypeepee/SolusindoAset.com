import "server-only";
import { createHmac } from "node:crypto";
import { get } from "node:https";

type Kind = "accounts" | "profile";

/** Read-only reference requests, independent of Next fetch and our Graph helper. */
export async function referenceInstagramReads(
  token: string,
  accountId: string,
) {
  const reads: Record<string, Promise<Record<string, unknown>>> = {};
  function read(
    path: string,
    kind: Kind,
    withProof: boolean,
    version: "v26.0" | "v25.0" = "v26.0",
  ) {
    return new Promise<Record<string, unknown>>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      };
      const unavailable = () =>
        finish({ ok: false, issue: "REFERENCE_READ_FAILED" });
      try {
        // Fixed official host and allowlisted versions; no external redirects.
        const url = new URL(
          "https://graph.facebook.com/" + version + "/" + path,
        );
        url.searchParams.set("fields", "id,username");
        url.searchParams.set("access_token", token);
        const secret = process.env.META_APP_SECRET?.trim();
        if (withProof && secret)
          url.searchParams.set(
            "appsecret_proof",
            createHmac("sha256", secret).update(token).digest("hex"),
          );
        const request = get(
          url,
          { headers: { Accept: "application/json" } },
          (response) => {
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("error", unavailable);
            response.on("aborted", unavailable);
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > 128 * 1024) {
                unavailable();
                response.destroy();
                return;
              }
              chunks.push(chunk);
            });
            response.on("end", () => {
              try {
                const result = JSON.parse(
                  Buffer.concat(chunks).toString("utf8"),
                );
                const status = response.statusCode ?? 0;
                if (status < 200 || status >= 300 || result?.error) {
                  const error = result?.error;
                  finish({
                    ok: false,
                    httpStatus: status,
                    providerCode: Number.isSafeInteger(error?.code)
                      ? error.code
                      : null,
                    providerSubcode: Number.isSafeInteger(error?.error_subcode)
                      ? error.error_subcode
                      : null,
                    providerTraceId:
                      typeof error?.fbtrace_id === "string" &&
                      /^[A-Za-z0-9_-]{8,200}$/.test(error.fbtrace_id)
                        ? error.fbtrace_id
                        : null,
                  });
                  return;
                }
                finish(
                  kind === "accounts"
                    ? {
                        ok: true,
                        httpStatus: status,
                        count: Array.isArray(result?.data)
                          ? result.data.length
                          : null,
                        includesCompany:
                          Array.isArray(result?.data) &&
                          result.data.some(
                            (row: { id?: unknown }) => row?.id === accountId,
                          ),
                        hasMore: !!result?.paging?.next,
                      }
                    : {
                        ok: true,
                        httpStatus: status,
                        matchesCompany: result?.id === accountId,
                        hasUsername:
                          typeof result?.username === "string" &&
                          !!result.username,
                      },
                );
              } catch {
                unavailable();
              }
            });
          },
        );
        request.on("error", unavailable);
        timer = setTimeout(() => {
          unavailable();
          request.destroy();
        }, 25000);
      } catch {
        unavailable();
      }
    });
  }
  reads.referenceAssignedAccounts = read(
    "me/assigned_instagram_accounts",
    "accounts",
    true,
  );
  if (/^\d+$/.test(accountId)) {
    reads.referenceCompanyProfile = read(accountId, "profile", true);
    reads.referenceProfileWithoutProof = read(accountId, "profile", false);
    // Diagnostic comparison only; the production API version is unchanged.
    reads.referencePreviousVersionProfile = read(
      accountId,
      "profile",
      true,
      "v25.0",
    );
    reads.referencePreviousVersionAccounts = read(
      "me/assigned_instagram_accounts",
      "accounts",
      true,
      "v25.0",
    );
  }
  return Object.fromEntries(
    await Promise.all(
      Object.entries(reads).map(async ([key, value]) => [key, await value]),
    ),
  );
}
