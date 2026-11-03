import { instagramErrorLabel } from "@/lib/marketing/instagram-content";

/** CSPRNG request IDs also work on browsers without the secure-context UUID API. */
export function instagramRequestId(
  source: Pick<Crypto, "getRandomValues"> &
    Partial<Pick<Crypto, "randomUUID">> = globalThis.crypto,
) {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  if (typeof source?.getRandomValues !== "function") {
    const code = "INSTAGRAM_REQUEST_ID_UNAVAILABLE";
    throw Object.assign(new Error(instagramErrorLabel(code)), { code });
  }
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export async function instagramRequest<T>(
  query: Record<string, string> = {},
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, body ? 120000 : 180000);
  try {
    const response = await fetch(
      "/api/dashboard/pemasaran/instagram/content?" +
        new URLSearchParams(query),
      {
        method: body ? "POST" : "GET",
        cache: "no-store",
        signal: controller.signal,
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      },
    );
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(instagramErrorLabel(result.error)), {
        code: result.error,
      });
    return result;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      const code = body ? "INSTAGRAM_ACTION_UNCERTAIN" : "PROVIDER_ERROR";
      throw Object.assign(new Error(instagramErrorLabel(code)), { code });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
