import type { SuratField } from "./data";

export type SuratFieldGroup = {
  title: string;
  keys: string[];
};

export const suratFieldGroups: SuratFieldGroup[] = [
  {
    title: "Informasi Surat",
    keys: ["kota", "tanggal_surat", "alamat_PN", "alamat_pn", "kecamatan", "provinsi", "kode_pos"],
  },
  {
    title: "Data Kuasa",
    keys: [
      "nama_kuasa",
      "nik_kuasa",
      "kotalahir_kuasa",
      "tanggallahir_kuasa",
      "kelamin_kuasa",
      "agama_kuasa",
      "alamat_kuasa",
      "pekerjaan_kuasa",
      "statuskawin_kuasa",
    ],
  },
  {
    title: "Data Pemohon",
    keys: [
      "nama_pemohon",
      "nik_pemohon",
      "kotalahir_pemohon",
      "tanggallahir_pemohon",
      "kelamin_pemohon",
      "agama_pemohon",
      "alamat_pemohon",
      "pekerjaan_pemohon",
      "statuskawin_pemohon",
    ],
  },
  {
    title: "Data Objek / Asset",
    keys: [
      "jenis_sertifikat",
      "singkatan_sertifikat",
      "nomor_nib",
      "LT",
      "lokasi_asset",
      "kelurahan_asset",
      "kecamatan_asset",
      "kota_asset",
    ],
  },
  {
    title: "Data Debitur & Bank",
    keys: ["nama_debitur", "nama_bank"],
  },
  {
    title: "Data Lelang",
    keys: ["nomor_risalah", "tanggal_risalah", "nomor_kwitansi", "tanggal_kwitansi"],
  },
];

export function groupFields(fields: SuratField[]) {
  const mapped = new Map(fields.map((field) => [field.key, field]));
  const used = new Set<string>();

  const result = suratFieldGroups
    .map((group) => {
      const items = group.keys
        .map((key) => mapped.get(key))
        .filter((item): item is SuratField => Boolean(item));

      items.forEach((item) => used.add(item.key));

      return {
        title: group.title,
        fields: items,
      };
    })
    .filter((group) => group.fields.length > 0);

  const ungrouped = fields.filter((field) => !used.has(field.key));

  if (ungrouped.length > 0) {
    result.push({
      title: "Lainnya",
      fields: ungrouped,
    });
  }

  return result;
}