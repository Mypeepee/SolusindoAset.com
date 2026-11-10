import { campaignErrors } from "@/lib/marketing/campaign";
import { errorLabels } from "@/lib/marketing/domain";
export async function campaignApi(
  body?: unknown,
  query = "",
  signal?: AbortSignal,
) {
  const response = await fetch("/api/dashboard/pemasaran/campaigns" + query, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const code =
      typeof result?.error === "string"
        ? result.error
        : `HTTP_${response.status}`;
    throw Object.assign(
      new Error(
        campaignErrors[code] ||
          errorLabels[code] ||
          `Permintaan gagal (${code}). Coba kembali beberapa saat lagi.`,
      ),
      { code, status: response.status },
    );
  }
  return result;
}
