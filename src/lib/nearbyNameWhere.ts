import type { Prisma } from "@prisma/client";
import { normalNama, tebakKelasDariNama } from "./tempat/normalisasi.ts";

// Keep the facility class when accepting its optional prefix: "mall Gandaria
// City" can match "Gandaria City", but SD Sukamaju cannot match a clinic.
export function nearbyNameWhere(query: string): Prisma.TempatWhereInput {
  const normalized = normalNama(query);
  const alternatives: Prisma.TempatWhereInput[] = [{ nama_normal: { contains: normalized } }, { brand_normal: normalized }, { alias: { some: { alias_normal: normalized } } }];
  const inferred = tebakKelasDariNama(query)?.kelas;
  const bare = normalized.replace(/^(?:rumah sakit|pintu tol|mall|plaza|stasiun|sekolah|rsud|rsup|rsu|rsia|rs|sd|smp|sma|smk|kampus|univ)\s+/, "");
  if (inferred && bare !== normalized && bare.length >= 3) alternatives.push({ kelas: inferred, OR: [{ nama_normal: { contains: bare } }, { alias: { some: { alias_normal: bare } } }] });
  return { OR: alternatives };
}
