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

function xmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeKuasaDatePlaceholder(xml: string): string {
  const spans = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
  const text = spans.map((span) => span[1]
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")).join("");
  const placeholder = "{{tanggal surat_kuasa}}";
  const start = text.indexOf(placeholder);
  if (start < 0) throw new Error("Template kuasa tidak memiliki field tanggal surat kuasa.");
  const end = start + placeholder.length;
  let offset = 0;
  const replacements = spans.map((span, index) => {
    const value = span[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const spanStart = offset;
    const spanEnd = spanStart + value.length;
    offset = spanEnd;
    if (spanStart >= end || spanEnd <= start) return null;
    const localStart = Math.max(0, start - spanStart);
    const localEnd = Math.min(value.length, end - spanStart);
    const replacement = spanStart <= start
      ? value.slice(0, localStart) + "{{tanggal_surat_kuasa}}" + value.slice(localEnd)
      : value.slice(0, localStart) + value.slice(localEnd);
    return { index, value: replacement };
  }).filter((item): item is { index: number; value: string } => item !== null);

  let normalized = xml;
  for (const { index, value } of replacements.reverse()) {
    const span = spans[index];
    const match = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/.exec(span[0]);
    if (!match) throw new Error("Template kuasa memiliki field tanggal yang rusak.");
    const fullStart = span.index!;
    const contentStart = fullStart + match.index + match[0].indexOf(match[1]);
    normalized = normalized.slice(0, contentStart) + xmlText(value) + normalized.slice(contentStart + match[1].length);
  }
  return normalized;
}

export async function renderPermohonan(id: string, values: SuratValues): Promise<Buffer> {
  if (!["permohonan-eksekusi-pn", "permohonan-akte-grosse"].includes(id))
    throw new SuratInputError("Jenis permohonan tidak dikenal.");
  const errors = suratErrors(id, values);
  if (Object.keys(errors).length) throw new SuratInputError(Object.values(errors).join(" "));
  const isPn = id === "permohonan-eksekusi-pn";
  const isKuasa = isPn && values.bertindakSebagai === "kuasa";
  const template = isPn
    ? isKuasa ? "Permohonan_PN_DenganKuasa-digabungkan1.docx" : "Permohonan_PN_Dinamis.docx"
    : "Permohonan_Akta_Grosse_Dinamis.docx";
  const content = await readFile(path.join(process.cwd(), "src/app/dashboard/surat/components/templates", template));
  const data = {
    ...values,
    tanggal: formatTanggalSurat(values.tanggal_surat),
    tanggal_surat_kuasa: values.tanggal_surat_kuasa
      ? formatTanggalSurat(values.tanggal_surat_kuasa)
      : "",
    NIK_pemohon: values.nik_pemohon,
    NIK_kuasa: values.nik_kuasa,
    nomor_risalahlelang: values.nomor_risalah,
    tanggal_risalahlelang: values.tanggal_risalah,
    jamlelang: values.pukul_lelang,
    NIP: values.nip_pejabat,
    dengan_kuasa: values.bertindakSebagai === "kuasa",
  };
  const zip = new PizZip(content);
  if (isKuasa) {
    const mainDocument = zip.file("word/document.xml");
    if (!mainDocument) throw new Error("Template kuasa tidak memiliki isi surat.");
    zip.file("word/document.xml", normalizeKuasaDatePlaceholder(mainDocument.asText()));
  }
  const document = new Docxtemplater(zip, {
    paragraphLoop: true, linebreaks: true, delimiters: { start: "{{", end: "}}" },
    nullGetter: () => { throw new Error("Template surat meminta data yang belum tersedia."); },
  });
  document.render(data);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export function permohonanFilename(id: string, values: SuratValues): string {
  const name = values.nama_pemohon.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").slice(0, 50) || "Pemohon";
  return id === "permohonan-eksekusi-pn" ? `Permohonan_PN_${name}_${values.bertindakSebagai === "kuasa" ? "Kuasa" : "Pemohon"}.pdf`
    : `Permohonan_AktaGrosse_${name}_${values.bertindakSebagai === "kuasa" ? "Kuasa" : "Sendiri"}.pdf`;
}
