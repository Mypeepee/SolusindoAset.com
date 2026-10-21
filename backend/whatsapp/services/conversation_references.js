// Resolve conversational references before extracting names. These phrases
// preserve an existing search scope; they never supply a location on their own.
import { normalizeBuyerLanguage } from './buyer_language.js';

// All callers (qualification, selection and exclusions) must read the same
// normalized message, including when they receive raw WhatsApp text.
const referenceText = (text) => normalizeBuyerLanguage(text).replace(
  /\b(properti|property|aset|rumah|unit)(?:2|\s*[-–]\s*\1)\b/gi, (_, noun) => normalizeBuyerLanguage(noun));
const pointer = '(?:yang\\s+)?(?:tersebut|itu|ini|tadi|sebelumnya|sama)';
const place = '(?:area|daerah|kawasan|wilayah|lokasi(?:nya)?|kota|kabupaten|kecamatan|kelurahan|desa)';
const property = '(?:aset|properti|rumah|unit)(?:nya)?';
const locationPattern = `\\b(?:(?:di\\s+)?${place}\\s+(?:${property}\\s+)?${pointer}|(?:di\\s*|ke\\s+)(?:sana|situ|sini)|(?:di\\s+)?sekitar\\s+(?:${property}\\s+${pointer}|sana|situ|sini))\\b`;
const count = '(?:[1-9]\\d?|(?:ke)?(?:dua|tiga|empat|lima))';
const batch = `(?:${count}\\s+(?:${property}\\s+)?${pointer}|${count}nya|(?:semua\\s+)?(?:${property}\\s+)?(?:yang\\s+)?(?:tadi|sebelumnya)|(?:semua|daftar|pilihan|opsi)\\s+${pointer})`;
const excludedBatch = `\\bselain\\s+(?:${batch}|${property}\\s+${pointer}|yang\\s+(?:ini|itu|tersebut))\\b`;

export const hasLocationReference = (text) => new RegExp(locationPattern, 'i').test(referenceText(text));
export const withoutLocationReferences = (text) => referenceText(text).replace(new RegExp(locationPattern, 'gi'), ' ');

export function isLocationReferenceAnswer(text) {
  return hasLocationReference(text) && /^(?:(?:masih|tetap|iya|ya|betul|benar|saja|aja|pak|bapak|bu|ibu|kak|dulu|dong)|[\s,.!?])*$/i.test(withoutLocationReferences(text));
}

const alternativePatterns = [
  /\b(?:ada(?:kah)?|punya)\s+(?:(?:opsi|pilihan|alternatif|aset|properti|rumah|unit)\s+)?(?:yang\s+)?lain(?:nya)?\b/gi,
  /\b(?:opsi|pilihan|alternatif|aset|properti|rumah|unit|daftar)\s+(?:yang\s+)?(?:lain(?:nya)?|berikutnya|selanjutnya|berbeda)\b/gi,
  /\b(?:cari(?:kan)?|mencari)\s+(?:yang\s+)?lain(?:nya)?\b/gi,
  /^\s*(?:(?:tolong|mohon|boleh|bisa|tampilkan|lihat|minta|saya|mau|ingin|coba)\s+)*yang\s+(?:lain(?:nya)?|berbeda)(?:\s+lagi)?(?:\s+(?:pak|bu|bapak|ibu|kak|dong|ya|aja|saja))*[.!?\s]*$/gi,
  new RegExp(excludedBatch, 'gi'),
  /\b(?:ada(?:kah)?|punya)\s+(?:pilihan\s+|opsi\s+)?selain\s+(?:ini|itu)\b/gi,
  /\b(?:tampilkan|lihat|minta|carikan)\s+(?:[1-5]\s+)?(?:properti\s+|pilihan\s+|opsi\s+)?(?:berikutnya|selanjutnya)\b/gi,
  /^\s*(?:(?:boleh|bisa|tolong|mohon)\s+)*(?:lanjut(?:kan)?|next|berikutnya|selanjutnya|(?:masih\s+)?ada(?:kah)?\s+lagi)(?:\s+(?:pak|bu|bapak|ibu|kak|dong|ya|aja|saja|lagi))*[.!?\s]*$/gi,
];

export function requestsAlternatives(input) {
  const text = referenceText(input);
  for (const pattern of alternativePatterns) for (const match of text.matchAll(pattern)) {
    const prefix = text.slice(0, match.index).split(/[,;.!?\n]|\b(?:tapi|tetapi|melainkan)\b/i).at(-1);
    if (/\b(?:jangan|tidak|nggak|ngga|enggak|gak|ga|belum|bukan)\s+(?:(?:perlu|usah|mau|ingin|minta|cari(?:kan)?|mencari|tampilkan|lihat|pilih)\s+)*$/i.test(prefix)) continue;
    return true;
  }
  return false;
}

// Asset references in an alternative request are not neighborhood names.
export function geographyWithoutReferences(text) {
  return withoutLocationReferences(text)
    .replace(alternativePatterns.at(-1), 'pilihan lain')
    .replace(new RegExp(excludedBatch, 'gi'), 'pilihan lain')
    .replace(/\b(?:opsi|pilihan|alternatif|aset|properti|rumah|unit|daftar)\s+(?:yang\s+)?(?:berikutnya|selanjutnya|berbeda)\b/gi, 'pilihan lain')
    .replace(/\b((?:yang\s+)?lain(?:nya)?)\s+lagi\b/gi, '$1')
    .replace(new RegExp(`\\b(?:selain\\s+)?${property}\\s+${pointer}\\b`, 'gi'), ' ')
    .replace(/\b(?:selain\s+)?yang\s+(?:ini|itu|tadi|tersebut|sebelumnya)\b/gi, ' ');
}
