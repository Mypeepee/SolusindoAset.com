export type RegionLevel = "provinsi" | "kota" | "kecamatan" | "kelurahan";
export interface IndonesiaRegion {
  id: string;
  name: string;
}
const BASE = "https://ibnux.github.io/data-indonesia";
const cache = new Map<string, { expires: number; items: IndonesiaRegion[] }>();
/** Canonical provider shared by public region selects and verified corrections. */
export async function getIndonesiaRegions(
  level: RegionLevel,
  parentId = "",
): Promise<IndonesiaRegion[]> {
  if (level !== "provinsi" && !/^\d{2,12}$/.test(parentId))
    throw new Error("INVALID_REGION_PARENT");
  const key = `${level}:${parentId}`,
    hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.items;
  const path =
    level === "provinsi"
      ? "propinsi.json"
      : level === "kota"
        ? `kabupaten/${parentId}.json`
        : level === "kecamatan"
          ? `kecamatan/${parentId}.json`
          : `kelurahan/${parentId}.json`;
  const response = await fetch(`${BASE}/${path}`, {
    next: { revalidate: 43200 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("REGION_PROVIDER_UNAVAILABLE");
  const data: unknown = await response.json();
  if (
    !Array.isArray(data) ||
    data.some(
      (row) =>
        !row || typeof row !== "object" || !("id" in row) || !("nama" in row),
    )
  )
    throw new Error("INVALID_REGION_RESPONSE");
  const items = data
    .map((row) => ({ id: String(row.id), name: String(row.nama) }))
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  cache.set(key, { expires: Date.now() + 43_200_000, items });
  return items;
}
