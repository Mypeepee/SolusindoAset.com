import { Prisma } from "@prisma/client";
import { regionValueVariants } from "./regionMatch";
import { SURABAYA_REGIONS } from "./propertySearchQuery";
import type { RegionLevel } from "./regionSearch";

/** Daerah membatasi lokasi aset. Nama kecamatan/kelurahan tidak disimpan
 * pada tabel tempat, sehingga menyaring `tempat.kota` saja akan meleset. */
export function nearbyScopeWhere(wilayah: string | null | undefined): Prisma.ListingWhereInput | undefined {
  const text = wilayah?.trim();
  if (!text) return undefined;
  const sby = /^(?:kota\s+)?(?:surabaya|sby)\s+(barat|timur|selatan|utara|pusat)$/i.exec(text);
  if (sby) {
    const region = sby[1].toLowerCase() as keyof typeof SURABAYA_REGIONS;
    return {
      kota: { in: regionValueVariants("Surabaya", "kota"), mode: "insensitive" },
      kecamatan: { in: SURABAYA_REGIONS[region].flatMap((name) => regionValueVariants(name, "kecamatan")), mode: "insensitive" },
    };
  }
  // Koma memperjelas rantai wilayah: "Wiyung, Surabaya" berarti keduanya.
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return { AND: parts.map((part) => nearbyScopeWhere(part)!) };
  const level = /^(?:kec(?:amatan)?\.?)\s+/i.test(text) ? "kecamatan"
    : /^(?:kel(?:urahan)?\.?)\s+/i.test(text) ? "kelurahan"
    : /^(?:prov(?:insi)?\.?)\s+/i.test(text) ? "provinsi"
    : /^(?:kota|kab(?:upaten)?\.?)\s+/i.test(text) ? "kota" : null;
  const name = level && level !== "kota" ? text.replace(/^\S+\s+/, "") : text;
  const fields: RegionLevel[] = level ? [level] : ["kota", "provinsi", "kecamatan", "kelurahan"];
  return { OR: fields.map((field) => ({
    [field]: { in: regionValueVariants(name, field), mode: "insensitive" },
  })) };
}

/** Bentuk SQL yang sama untuk autocomplete. Alias `l` selalu tabel listing. */
export function nearbyScopeSql(wilayah: string | null | undefined): Prisma.Sql {
  const where = nearbyScopeWhere(wilayah);
  if (!where) return Prisma.sql`TRUE`;
  const compile = (node: Prisma.ListingWhereInput): Prisma.Sql => {
    const clauses: Prisma.Sql[] = [];
    for (const [key, value] of Object.entries(node)) {
      if (key === "AND" || key === "OR") {
        const nodes = (Array.isArray(value) ? value : [value]) as Prisma.ListingWhereInput[];
        clauses.push(Prisma.sql`(${Prisma.join(nodes.map(compile), key === "AND" ? " AND " : " OR ")})`);
      } else if (["kota", "provinsi", "kecamatan", "kelurahan"].includes(key)) {
        const names = (value as { in: string[] }).in.map((name) => name.toLowerCase());
        // Identifier berasal dari daftar tetap di atas; semua nama wilayah
        // tetap menjadi parameter, termasuk teks yang dikirim pengguna.
        clauses.push(Prisma.sql`lower(${Prisma.raw(`l.${key}`)}) IN (${Prisma.join(names)})`);
      }
    }
    return clauses.length ? Prisma.sql`(${Prisma.join(clauses, " AND ")})` : Prisma.sql`FALSE`;
  };
  return compile(where);
}
