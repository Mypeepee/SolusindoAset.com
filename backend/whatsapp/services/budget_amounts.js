import { preferenceAnswerText, QUANTITY_RANGE_SEPARATOR } from './buyer_language.js';

const N = '(\\d+(?:[.,]\\d+)*)';
const U = '(miliar|milyar|milyard|juta|jt|ribu|rb|rupiah|m)';
const FACTORS = { miliar: 1e9, milyar: 1e9, milyard: 1e9, m: 1e9, juta: 1e6, jt: 1e6, ribu: 1000, rb: 1000, rupiah: 1 };
const minimum = '(?:minimal|minimum|min|setidaknya|paling sedikit|di\\s*atas)';
const maximum = '(?:maksimal|maksimum|maks|max|mentok|paling banyak|di\\s*bawah|sampai|hingga)';
const endpoint = `(?:rp\\.?\\s*)?${N}\\s*${U}?(?![\\p{L}\\p{N}])`;

function scalar(value) {
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(value);
  return Number(grouped ? value.replace(/[.,]/g, '') : value.replace(',', '.'));
}
function amount(value, unit) {
  const n = scalar(value) * (FACTORS[unit?.toLowerCase()] || 1);
  return Number.isSafeInteger(n) && n > 0 && n <= 1e15 ? n : null;
}
function implicitPurchaseUnit(value, implicitUnit) {
  // Hundreds are common shorthand for millions when buying property. Small
  // figures such as 1–2 can mean millions or billions and still need a unit.
  const n = scalar(value);
  return implicitUnit === 'juta' && n >= 100 && n < 1000 ? 'juta' : null;
}
function bounds(first, firstUnit, last, lastUnit, { implicitUnit, defaultUnit, explicitRupiah = false } = {}) {
  let lowerUnit = firstUnit || lastUnit, upperUnit = lastUnit || firstUnit;
  if (!lowerUnit && !upperUnit) {
    if (explicitRupiah) lowerUnit = upperUnit = 'rupiah';
    else if (defaultUnit) lowerUnit = upperUnit = defaultUnit;
    else if (implicitPurchaseUnit(first, implicitUnit) && implicitPurchaseUnit(last, implicitUnit)) lowerUnit = upperUnit = 'juta';
  }
  // In an Indonesian property budget, "500 sampai 1M" expresses a move
  // from hundreds of millions to billions. Small same-scale ranges such as
  // "1–2M" still inherit billions on both ends. Explicit units always win.
  if (!firstUnit && FACTORS[lastUnit?.toLowerCase()] === 1e9 &&
      scalar(first) >= 100 && scalar(first) < 1000 && scalar(last) > 0 && scalar(last) < 100 && scalar(first) > scalar(last)) lowerUnit = 'juta';
  if (!lowerUnit && !upperUnit && (scalar(first) < 1e5 || scalar(last) < 1e5)) return { error: 'ambiguous' };
  const min = amount(first, lowerUnit), max = amount(last, upperUnit);
  return !min || !max || min > max ? { error: 'invalid' } : { min_price: min, max_price: max };
}

// Caller establishes budget intent and removes land/building preferences.
// A malformed range must not fall through to a single endpoint's price.
export function parseBudgetAmounts(text, { implicitUnit = null, defaultUnit = null } = {}) {
  if (/\b(?:per|tiap|setiap)\s*(?:m\s*[²2]|meter|hektar|ha)\b/iu.test(text)) return null;
  if (/(?:^|\b(?:budget|anggaran|harga|minimal|minimum|maksimal|maksimum|mentok))\s*(?:rp\.?\s*)?-\s*\d/i.test(text)) return { error: 'invalid' };
  const range = new RegExp(`(?<![\\p{L}\\p{N}.,])${endpoint}\\s*(?:${QUANTITY_RANGE_SEPARATOR}${/\bantara\b/i.test(text) ? '|dan' : ''})\\s*${endpoint}`, 'iu').exec(text);
  if (range) return bounds(range[1], range[2], range[3], range[4], { implicitUnit, defaultUnit, explicitRupiah: /\brp\.?\s*\d/i.test(range[0]) });
  if (new RegExp(`${endpoint}\\s*(?:${QUANTITY_RANGE_SEPARATOR})(?![\\p{L}\\p{N}])`, 'iu').test(text)) return { error: 'ambiguous' };
  const low = new RegExp(`\\b${minimum}\\s*(?:nya|[.:=])?\\s*${endpoint}`, 'iu').exec(text);
  const high = new RegExp(`\\b${maximum}\\s*(?:nya|[.:=])?\\s*${endpoint}`, 'iu').exec(text);
  if (low && high) return bounds(low[1], low[2], high[1], high[2], { implicitUnit, defaultUnit, explicitRupiah: /\brp\.?\s*\d/i.test(low[0] + high[0]) });
  const amounts = [...text.matchAll(new RegExp(endpoint, 'giu'))];
  const match = low || high || amounts.find((item) => item[2]) || amounts.find((item) => /^rp/i.test(item[0])) || amounts[0];
  if (!match) return null;
  // Only the caller's confirmed purchase context can enable shorthand.
  const rupiah = /\brp\.?\s*\d/i.test(match[0]);
  const unit = match[2] || (rupiah ? null : defaultUnit || implicitPurchaseUnit(match[1], implicitUnit));
  if (!unit && scalar(match[1]) < 1e5 && !rupiah) return { error: 'ambiguous' };
  const value = amount(match[1], unit);
  return !value ? { error: 'invalid' } : low ? { min_price: value, max_price: null } : { min_price: null, max_price: value };
}

// A unit-only answer completes the client's pending amount, never a guess.
export function budgetUnitAnswer(text) {
  return /^(?:(?:dalam|satuan(?:nya)?|maksud(?:nya|\s+saya)|pakai|itu)\s+)*(miliar|milyar|juta|jt|ribu|rb|rupiah)(?:\s+rupiah)?(?:\s+(?:per|tiap|setiap|se)\s*(?:hari|minggu|bulan|tahun))?$/.exec(preferenceAnswerText(text))?.[1] || null;
}
