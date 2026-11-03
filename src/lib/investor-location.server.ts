import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildCityRegistry } from "@/lib/investor-regions";
import { normWilayah, parseKota } from "@/lib/auctionHistory";
import { getIndonesiaRegions } from "@/lib/indonesia-regions.server";
import { invalidateInvestorCache } from "@/lib/investor-cma-legacy.server";

type Row = {
  id_property: bigint;
  judul: string;
  provinsi: string | null;
  kota: string;
  kecamatan: string | null;
  kelurahan: string | null;
  revision: string;
};
const revision = Prisma.sql`md5(jsonb_build_array(id_property,kota,provinsi,kecamatan,kelurahan,tanggal_diupdate)::text)`;
async function target(
  id: string,
  tx: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
  lock = false,
) {
  if (!/^\d{1,20}$/.test(id) || BigInt(id) > BigInt("9223372036854775807"))
    throw new Error("INVALID_ID");
  const rows = await tx.$queryRaw<
    Row[]
  >`SELECT id_property,judul,provinsi,kota,kecamatan,kelurahan,${revision} revision FROM listing WHERE id_property=${BigInt(id)} ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`;
  if (!rows[0]) throw new Error("LISTING_NOT_FOUND");
  return rows[0];
}
const key = (v: string | null | undefined) =>
  (normWilayah(v) || "").replace(/\s/g, "");
async function verifiedCity(row: Row) {
  const registry = buildCityRegistry([row]),
    city = [...registry.records.values()][0];
  if (!city) throw new Error("CITY_NOT_VERIFIED");
  const provinces = await getIndonesiaRegions("provinsi");
  const province = provinces.filter(
    (p) => key(p.name) === key(city.provinceName),
  );
  if (province.length !== 1) throw new Error("CITY_NOT_VERIFIED");
  const cities = await getIndonesiaRegions("kota", province[0].id),
    raw = parseKota(row.kota);
  const candidates = cities.filter((c) => {
    const parsed = parseKota(c.name);
    return (
      key(parsed.core) === key(raw.core) &&
      (!raw.tipe || parsed.tipe === raw.tipe)
    );
  });
  if (candidates.length !== 1) throw new Error("CITY_NOT_VERIFIED");
  return candidates[0];
}
export async function getInvestorLocationOptions(
  id: string,
  districtId?: string,
) {
  const row = await target(id),
    city = await verifiedCity(row),
    districts = await getIndonesiaRegions("kecamatan", city.id);
  const selected = districtId
    ? districts.find((d) => d.id === districtId)
    : districts.find((d) => key(d.name) === key(row.kecamatan));
  if (districtId && !selected) throw new Error("INVALID_DISTRICT");
  const kelurahan = selected
    ? await getIndonesiaRegions("kelurahan", selected.id)
    : [];
  return {
    listingId: id,
    title: row.judul,
    cityName: city.name,
    revision: row.revision,
    currentKelurahan: row.kelurahan,
    districts,
    selectedDistrictId: selected?.id || "",
    kelurahan,
  };
}
export interface LocationCorrection {
  districtId: string;
  kelurahanId: string;
  revision: string;
}
export async function correctInvestorLocation(
  id: string,
  input: LocationCorrection,
) {
  if (
    !/^\d{2,12}$/.test(input.districtId) ||
    !/^\d{2,12}$/.test(input.kelurahanId) ||
    !/^[a-f0-9]{32}$/.test(input.revision)
  )
    throw new Error("INVALID_LOCATION");
  const row = await target(id),
    city = await verifiedCity(row),
    districts = await getIndonesiaRegions("kecamatan", city.id);
  const district = districts.find((d) => d.id === input.districtId);
  if (!district) throw new Error("INVALID_DISTRICT");
  const choices = await getIndonesiaRegions("kelurahan", district.id),
    kel = choices.find((k) => k.id === input.kelurahanId);
  if (!kel) throw new Error("INVALID_KELURAHAN");
  await prisma.$transaction(async (tx) => {
    const latest = await target(id, tx, true);
    if (latest.revision !== input.revision)
      throw new Error("LOCATION_CONFLICT");
    await tx.$executeRaw`UPDATE listing SET kecamatan=${district.name},kelurahan=${kel.name},tanggal_diupdate=clock_timestamp() WHERE id_property=${BigInt(id)}`;
  });
  invalidateInvestorCache();
  return { id, districtName: district.name, kelurahanName: kel.name };
}
