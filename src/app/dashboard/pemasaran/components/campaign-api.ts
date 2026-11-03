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
  if (!response.ok)
    throw new Error(
      campaignErrors[result.error] ||
        errorLabels[result.error] ||
        "Permintaan belum berhasil. Coba kembali.",
    );
  return result;
}
