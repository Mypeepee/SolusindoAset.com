// Land preferences are independent from price and building area. No listing or
// assistant statement may establish the client's bounds.
import { normalizeBuyerQuantities, assistantQuestions, correctedQuantityText, unrestrictedPreferenceAnswer, QUANTITY_RANGE_SEPARATOR } from './buyer_language.js';
const N = '(\\d+(?:[.,]\\d+)*)';
const U = '(m\\s*[²2]|meter\\s*(?:persegi|kuadrat)|hektar|ha|are|meter|m)';
const landLabel = /\b(?:luas\s+(?:tanah|lahan)(?:nya)?|lt)\b/i;
const minWords = '(?:minimal(?:nya)?|minimum|min(?:nya)?|setidaknya|paling kecil|di atas|diatas)';
const maxWords = '(?:maksimal(?:nya)?|maksimum|maks(?:nya)?|max(?:nya)?|paling besar|paling luas|mentok|di bawah|dibawah)';
const noLimitWords = '(?:bebas|fleksibel|terserah|tanpa\\s+(?:batas(?:an)?|patokan)|besar\\s+kecil\\s+(?:boleh|oke|tidak masalah)|(?:berapa|apa)\\s*(?:pun|saja|aja)|(?:tidak|tak|nggak|ngga|enggak|gak|ga|tdk)\\s+(?:ada\\s+(?:batas(?:an)?|patokan|minimal|maksimal)|dibatasi|dipatok|masalah))';
const noLimit = new RegExp(`\\b${noLimitWords}\\b`, 'i');
export const isLandAreaQuestion = (text = '') => assistantQuestions(text).some((part) => {
  if (/\b(?:luas\s+(?:tanah|lahan)|lt)\b/i.test(part)) return true;
  if (/\b(?:bangunan|lb)\b/i.test(part)) return false;
  return /\b(?:luas(?:nya)?|luasan(?:nya)?|ukuran(?:nya)?)\b/i.test(part) &&
    /\b(?:berapa|minimal|minimum|min|maksimal|maksimum|maks|max|batas|patokan|tertentu)\b/i.test(part);
});
const shortNoLimitAnswer = /^(?:(?:iya|ya|oh)\s+)?(?:tidak|tak|nggak|ngga|enggak|gak|ga|tdk)\s*ada(?:\s+(?:pak|bapak|bu|ibu|sih|ya|kok|dong|saja|aja|kak|mas|mbak))*\s*$/i;
const factor = (unit) => /^(?:ha|hektar)$/i.test(unit || '') ? 10000 : /^are$/i.test(unit || '') ? 100 : 1;
function sqm(value, unit) {
  const grouped = /^\d{1,3}(?:\.\d{3})+$/.test(value);
  const n = Number(grouped ? value.replace(/\./g, '') : value.replace(',', '.')) * factor(unit);
  return Number.isFinite(n) && n > 0 && n <= 1e9 ? Math.round(n * 1e6) / 1e6 : null;
}

export function extractLandArea(text, { allowImplicit = false, expected = allowImplicit } = {}) {
  const clean = correctedQuantityText(normalizeBuyerQuantities(text)).replace(/\*/g, '')
    // A closing inventory question does not turn the preceding explicit land
    // preference into a question: "luas tanah bebas, apakah ada?".
    .replace(/[,;]\s*(?:apa(?:kah)?\s+ada|ada(?:kah)?|masih tersedia)(?:\s+(?:pak|bu|bapak|ibu))?[?？]\s*$/i, '');
  const buildingLabel = /\b(?:lb|luas(?:nya)?\s+bangunan(?:nya)?)\b/i.exec(clean);
  const label = landLabel.exec(clean) || /\b(?:luas(?:nya)?|tanahnya|lahannya)\b/i.exec(clean);
  const explicit = !!label || /\b(?:tanah|lahan)\s+(?:minimal|minimum|maksimal|maksimum|min|max|bebas|fleksibel)\b/i.test(clean);
  if (/[?？]/.test(clean) || (!explicit && !allowImplicit && !expected && !/\d\s*(?:m\s*[²2]|meter\s*(?:persegi|kuadrat)|hektar|ha|are)(?![\p{L}\p{N}])/iu.test(clean))) return null;
  // Ignore building-only answers, while an explicit land label can follow
  // building dimensions in the same message and still establish land bounds.
  if (buildingLabel && (!label || buildingLabel.index === label.index)) return null;
  if (!explicit && allowImplicit && clean.split(/[,;.!…\n]/).some((part) => unrestrictedPreferenceAnswer(part))) {
    return { min_land_area_m2: null, max_land_area_m2: null };
  }
  // A short "tidak ada" answers the preceding land-preference question.
  // Match a whole clause so "tidak ada dana/budget/rumah" cannot clear bounds,
  // while "rumah dan toko, gak ada pak" can answer both pending questions.
  if (allowImplicit && clean.split(/[,;.!…\n]/).some((part) => shortNoLimitAnswer.test(part.trim()))) {
    return { min_land_area_m2: null, max_land_area_m2: null };
  }
  // A no-limit answer can precede its field: "tidak ada batasan luasan".
  // Only attach a directly adjacent phrase, never "budget bebas" or another
  // field's preference. Stop at the next labelled field in either direction.
  const prefix = label ? clean.slice(0, label.index).split(/[,;.!?\n]|\b(?:rumah|ruko|toko|gudang|apartemen|kos|pabrik|hotel|vila|villa|budget|bujet|anggaran|harga|dana|jenis|tipe|kategori)\b/i).at(-1) : '';
  const beforeLabel = label && new RegExp(`^\\s*(?:(?:pak|bu|bapak|ibu|kak|mas|mbak|ya|sih)\\s+)*${noLimitWords}(?:\\s+(?:untuk|soal))?\\s*$`, 'i').test(prefix) &&
    !/\b(?:budget|bujet|anggaran|harga|dana|jenis|tipe|kategori)\s*$/i.test(clean.slice(0, label.index - prefix.length)) ? prefix : '';
  const scope = (beforeLabel + ' ' + (label ? clean.slice(label.index + label[0].length) : clean))
    // "Jenis bebas" relaxes the category, even after an answer mentioning
    // land area. It must not erase an already confirmed land-size filter.
    .replace(/\b(?:jenis|tipe|kategori)\s+(?:(?:properti|aset)(?:nya)?\s+)?(?:bebas|apa saja|apapun|fleksibel)\b/gi, ' ')
    .split(/\b(?:lb|luas(?:nya)?\s+bangunan|budget|bujet|anggaran|harga|dana|plafon|untuk|kelurahan|kecamatan)\b/i)[0]
    .replace(/\b(?:ya|yah|sih|lah|sekitar|kira-kira|kurang lebih|di angka|di kisaran)\b/gi, ' ')
    .replace(/\b(?:rp\.?\s*\d[\d.,]*|\d[\d.,]*\s*(?:juta|jt|miliar|milyar))\b/gi, ' ');
  if (new RegExp(`(?:^|${minWords}|${maxWords})\\s*-\\s*\\d`, 'i').test(scope)) return { error: 'invalid' };
  const bound = (words) => new RegExp(`${words}\\s*(?:luas(?:nya)?|tanah|lt|nya|[.:=])?\\s*${N}\\s*${U}?(?![\\p{L}\\p{N}])`, 'iu').exec(scope);
  const low = bound(minWords), high = bound(maxWords);
  const range = new RegExp(`${N}\\s*${U}?\\s*(?:${QUANTITY_RANGE_SEPARATOR}${/\bantara\b/i.test(scope) ? '|dan' : ''})\\s*${N}\\s*${U}?(?![\\p{L}\\p{N}])`, 'iu').exec(scope);
  const unitAllowed = (unit) => explicit || expected || allowImplicit || !!unit && !/^(?:m|meter)$/i.test(unit);
  let result;
  if (range) {
    if (!unitAllowed(range[2] || range[4])) return null;
    // An answer to the land question needs no repeated unit: "300–900"
    // already defines a square-meter range. Explicit ha/are still wins.
    result = { min_land_area_m2: sqm(range[1], range[2] || range[4]), max_land_area_m2: sqm(range[3], range[4] || range[2]) };
  } else if (low || high) {
    if (![low, high].filter(Boolean).every((match) => unitAllowed(match[2]))) return null;
    const inheritedUnit = low?.[2] || high?.[2];
    result = { ...(low ? { min_land_area_m2: sqm(low[1], low[2] || inheritedUnit) } : {}),
      ...(high ? { max_land_area_m2: sqm(high[1], high[2] || inheritedUnit) } : {}) };
  } else if ((explicit || allowImplicit && scope.split(/[,;.!…\n]/).some((part) => noLimit.test(part) &&
      !/\b(?:rumah|ruko|toko|gudang|tanah|apartemen|kos|pabrik|hotel|vila|villa)\b/i.test(part))) && noLimit.test(scope) &&
      !/\b(?:bukan|jangan|tidak|nggak|gak|ga|belum)\s+(?:bebas|fleksibel|terserah)|\b(?:belum tahu|belum pasti|belum yakin)\b/i.test(scope)) {
    return { min_land_area_m2: null, max_land_area_m2: null };
  } else {
    const exact = new RegExp(`\\b(?:pas|persis|tepat)\\s*${N}\\s*${U}?`, 'i').exec(scope);
    if (exact && unitAllowed(exact[2])) result = { min_land_area_m2: sqm(exact[1], exact[2]), max_land_area_m2: sqm(exact[1], exact[2]) };
    else if (new RegExp(`${N}\\s*${U}(?![\\p{L}\\p{N}])`, 'iu').test(scope) || (allowImplicit && /^\s*\d[\d.,]*\s*(?:pak|bu|bapak|ibu)?[.!]?\s*$/i.test(scope))) return { error: 'ambiguous' };
    else return null;
  }
  if (Object.values(result).some((v) => v == null) || (result.min_land_area_m2 != null && result.max_land_area_m2 != null && result.min_land_area_m2 > result.max_land_area_m2)) return { error: 'invalid' };
  if (low && /\b(?:maksimal(?:nya)?|maksimum|max(?:nya)?)\s+(?:bebas|tidak ada|tidak dibatasi)\b/i.test(scope)) result.max_land_area_m2 = null;
  if (high && /\b(?:minimal(?:nya)?|minimum|min(?:nya)?)\s+(?:bebas|tidak ada|tidak dibatasi)\b/i.test(scope)) result.min_land_area_m2 = null;
  return result;
}
