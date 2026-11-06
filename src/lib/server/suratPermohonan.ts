import { readFile } from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { formatTanggalSurat, suratErrors, type SuratValues } from "@/lib/suratGeneration";

export class SuratInputError extends Error {}

export function parseSuratValues(body: unknown): SuratValues {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new SuratInputError("Data surat harus berupa objek JSON.");
  const values: SuratValues = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") throw new SuratInputError(`Nilai ${key} harus berupa teks.`);
    if (value.length > 20_000) throw new SuratInputError(`Isian ${key} terlalu panjang.`);
    values[key] = value.trim();
  }
  return values;
}

export async function renderPermohonan(id: string, values: SuratValues): Promise<Buffer> {
  if (!["permohonan-eksekusi-pn", "permohonan-akte-grosse"].includes(id))
    throw new SuratInputError("Jenis permohonan tidak dikenal.");
  const errors = suratErrors(id, values);
  if (Object.keys(errors).length) throw new SuratInputError(Object.values(errors).join(" "));
  const template = id === "permohonan-eksekusi-pn" ? "Permohonan_PN_Dinamis.docx" : "Permohonan_Akta_Grosse_Dinamis.docx";
  const content = await readFile(path.join(process.cwd(), "src/app/dashboard/surat/components/templates", template));
  const data = {
    ...values,
    tanggal: formatTanggalSurat(values.tanggal_surat),
    NIK_pemohon: values.nik_pemohon,
    NIK_kuasa: values.nik_kuasa,
    nomor_risalahlelang: values.nomor_risalah,
    tanggal_risalahlelang: values.tanggal_risalah,
    jamlelang: values.pukul_lelang,
    NIP: values.nip_pejabat,
    dengan_kuasa: values.bertindakSebagai === "kuasa",
  };
  const document = new Docxtemplater(new PizZip(content), {
    paragraphLoop: true, linebreaks: true, delimiters: { start: "{{", end: "}}" },
    nullGetter: () => { throw new Error("Template surat meminta data yang belum tersedia."); },
  });
  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export function permohonanFilename(id: string, values: SuratValues): string {
  const name = values.nama_pemohon.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").slice(0, 50) || "Pemohon";
  return id === "permohonan-eksekusi-pn" ? `Permohonan_PN_${name}.pdf`
    : `Permohonan_AktaGrosse_${name}_${values.bertindakSebagai === "kuasa" ? "Kuasa" : "Sendiri"}.pdf`;
}
