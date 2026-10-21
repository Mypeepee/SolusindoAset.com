// Canonical values of listing.kategori. Category preferences come from the
// buyer; words in addresses, land measurements and assistant options aren't choices.
import { assistantQuestions, normalizeBuyerLanguage, unrestrictedPreferenceAnswer } from './buyer_language.js';
export const PROPERTY_CATEGORY_LABELS = {
  RUMAH: 'rumah', RUKO: 'ruko', GUDANG: 'gudang', TANAH: 'tanah',
  APARTEMEN: 'apartemen', TOKO: 'toko', PABRIK: 'pabrik', KOS: 'kos', HOTEL_DAN_VILLA: 'hotel/vila',
};
export const isCategoryQuestion = (text = '') => assistantQuestions(text).some((part) => /\b(?:jenis|tipe|kategori)\s+(?:properti|aset)(?:nya)?\b[^?]{0,70}\b(?:apa|mana)\b/i.test(part));
export function anyPropertyCategory(text, expected = false) {
  text = normalizeBuyerLanguage(text);
  if (/\b(?:bukan|jangan|tidak|nggak|ngga|enggak|gak|ga|belum)\b[^,;.!?]{0,45}\b(?:bebas|terserah|semua|apa\s*(?:saja|aja|pun)|fleksibel)\b/i.test(text) || /[?？]/.test(text)) return false;
  return /\b(?:jenis|tipe|kategori)(?:nya)?\s+(?:(?:properti|aset)(?:nya)?\s+)?(?:(?:sih|mah|ya|itu)\s+)*(?:bebas|terserah|apa\s*(?:saja|aja|pun)|fleksibel)\b|\bsemua\s+(?:jenis|tipe|kategori)\s*(?:properti|aset)?\b/i.test(text) ||
    expected && text.split(/[,;.!…\n]/).some((part) => unrestrictedPreferenceAnswer(part));
}
export function extractPropertyCategories(text, { expected = false, includeRejected = false } = {}) {
  let clean = normalizeBuyerLanguage(text).replace(/\*/g, '').replace(/\brumah\s+sakit\b/gi, ' ')
    .replace(/\bhitung\s+tanah\b/gi, ' ')
    .replace(/\b(?:luas(?:nya)?\s+(?:tanah|lahan|bangunan)(?:nya)?|tanahnya|lahannya|lt|lb)\b/gi, ' ');
  if (/\bluas(?:nya)?\b/i.test(clean)) clean = clean.replace(/\b(?:untuk|soal)\s+(?:tanah|lahan)\b/gi, ' ');
  // Only the destination of an explicit correction is the new preference;
  // that destination can itself contain more than one category.
  const correction = /\b(?:ganti|ubah|beralih)\b[^.!?\n]*?\b(?:ke|jadi|menjadi|dengan)\b/i.exec(clean);
  if (correction) clean = clean.slice(correction.index + correction[0].length);
  const re = /\b(rumah\s+toko|hotel\s*(?:dan|&|\/)\s*vil(?:l)?a|ruko|rumah|gudang|tanah|apartemen|apartment|toko|pabrik|kos(?:-?kosan)?|kost(?:-?kostan)?|hotel|vila|villa)\b/gi;
  const choices = [];
  for (const match of clean.matchAll(re)) {
    const prefix = clean.slice(0, match.index).split(/[,;.!?\n]|\b(?:tapi|tetapi|melainkan)\b/i).at(-1);
    if (/\b(?:belum tahu|belum pasti|belum yakin|bingung)\b/i.test(prefix)) continue;
    const lastGeo = [...prefix.matchAll(/\b(?:di|daerah|kawasan|area|wilayah|sekitar|kelurahan|kel\.?|desa|kecamatan|kec\.?|kota|kabupaten|provinsi)\s+/gi)].at(-1)?.index ?? -1;
    const lastIntent = [...prefix.matchAll(/\b(?:cari(?:kan)?|mencari|butuh|ingin|mau|jenis(?:nya)?|tipe(?:nya)?|kategori(?:nya)?|pilih|ganti|ubah|beralih|ke)\b/gi)].at(-1)?.index ?? -1;
    if (lastGeo > lastIntent && !expected) continue;
    // An explicitly labelled village/district isn't a property category even
    // while a category question is pending (e.g. Kecamatan Tanah Abang).
    if (/\b(?:kelurahan|kel\.?|desa|kecamatan|kec\.?|kota|kabupaten|provinsi)\s*$/i.test(prefix)) continue;
    if (!includeRejected && /\b(?:bukan|jangan|tidak|nggak|ngga|enggak|gak|ga)\s+(?:(?:mau|ingin|cari|pilih)\s+)?(?:\w+\s+(?:dan|atau|sama)\s+)?$/i.test(prefix)) continue;
    const word = match[1].toLowerCase();
    const category = /^rumah\s+toko$|^ruko$/.test(word) ? 'RUKO' : /^(?:hotel|vil(?:l)?a)/.test(word) ? 'HOTEL_DAN_VILLA' :
      /^kos/.test(word) ? 'KOS' : /^apart/.test(word) ? 'APARTEMEN' : word.toUpperCase();
    choices.push({ category, index: match.index });
  }
  const unique = [...new Set(choices.map((c) => c.category))];
  return unique;
}

const removeCommand = /\b(?:hapus(?:kan)?|coret|keluarkan|batal(?:kan)?|jangan|bukan|(?:tidak|nggak|ngga|enggak|gak|ga)\s+(?:mau|usah|ingin|jadi|perlu))\b/i;
const addCommand = /\b(?:tambah(?:kan|in)?|sekalian|masukkan|sertakan)\b/i;
const setCommand = /\b(?:ganti|ubah|beralih|pilih(?:annya)?|cari(?:kan|nya)?|mencari|butuh|ingin(?:nya)?|mau(?:nya)?|maksud\s+saya)\b/i;
const commandBoundary = /([,;.!?\n]+|\b(?:tapi|tetapi|melainkan|lalu|kemudian)\b|\b(?:dan|serta)\s+(?=(?:hapus(?:kan)?|coret|keluarkan|batal(?:kan)?|jangan|bukan|tambah(?:kan|in)?|sekalian|masukkan|sertakan|ganti|ubah|pilih)\b))/i;

// Commands apply to a whole list, including comma/newline-separated members.
// Apply successive edits in order; removing the last member leaves the type
// unanswered, never "any type". Replacement sources are not new preferences.
export function categoryPreference(text, { expected = false, previous = [] } = {}) {
  const clean = normalizeBuyerLanguage(text).replace(/\b(?:ganti|ubah|beralih)\b[^.!?\n]*?\b(?:ke|jadi|menjadi|dengan)\b/gi, 'ganti ');
  const parts = clean.split(commandBoundary);
  let values = [...previous], mode = 'set', replace = true, touched = false, operation = 'set';
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i], separator = parts[i - 1] || '';
    const negative = removeCommand.test(clause);
    // "dan juga" joins members of a new list; "toko juga boleh" adds to it.
    const additive = addCommand.test(clause) || !/\b(?:dan|atau|serta)\s+juga\b/i.test(clause) && /\bjuga(?:\s+(?:boleh|bisa|oke|pak|bu|ya|aja|saja))*\s*$/i.test(clause);
    const explicitSet = setCommand.test(clause) && !negative && !additive;
    const choices = extractPropertyCategories(clause, { expected, includeRejected: negative || mode === 'remove' });
    if (!choices.length) continue;
    if (negative) mode = 'remove';
    else if (additive) mode = 'add';
    else if (explicitSet || /\b(?:tapi|tetapi|melainkan)\b/i.test(separator) || mode === 'remove' && /\b(?:saja|aja|boleh|bisa|oke)\b/i.test(clause)) {
      mode = 'set'; replace = true;
    } else if (/[;.!?]/.test(separator) || /\b(?:lalu|kemudian)\b/i.test(separator)) {
      if (mode !== 'set') replace = true;
      mode = 'set';
    }
    if (mode === 'remove') values = values.filter((value) => !choices.includes(value));
    else {
      if (mode === 'set' && replace) values = [];
      values = [...new Set([...values, ...choices])];
      replace = false;
    }
    touched = true; operation = mode;
  }
  return touched ? { values, answered: values.length > 0, operation } : null;
}

// Legacy callers asking for a single enum never silently receive just the
// first of several choices. Search qualification uses the plural extractor.
export function extractPropertyCategory(text, options) {
  const categories = extractPropertyCategories(text, options);
  return categories.length === 1 ? categories[0] : null;
}
