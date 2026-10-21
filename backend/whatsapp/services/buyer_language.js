// Normalize explicit quantities only. Location names and vague estimates are
// never corrected into facts. These helpers do not call an external service.
const digits = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
const numberWords = '(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|belas|puluh|ratus|ribu|setengah|koma)';
export const QUANTITY_RANGE_SEPARATOR = '-|–|—|−|sampai(?:\\s+dengan)?|sampe(?:\\s+dengan)?|hingga|s\\s*\\/\\s*d|s\\.\\s*d\\.?|sd';
function spokenNumber(raw) {
  const words = raw.toLowerCase().replace(/\bsepuluh\b/g, 'satu puluh').replace(/\bsebelas\b/g, 'satu belas')
    .replace(/\bseratus\b/g, 'satu ratus').replace(/\bseribu\b/g, 'satu ribu').trim().split(/\s+/);
  const whole = (parts) => {
    if (!parts.length) return 0;
    if (parts.length === 1 && parts[0] in digits) return digits[parts[0]];
    for (const [scale, value] of [['ribu', 1000], ['ratus', 100], ['puluh', 10]]) {
      const at = parts.indexOf(scale);
      if (at > 0) {
        const left = whole(parts.slice(0, at)), right = whole(parts.slice(at + 1));
        return left > 0 && left < (scale === 'ribu' ? 1000 : 10) && right != null && right < value ? left * value + right : null;
      }
    }
    if (parts.length === 2 && parts[1] === 'belas' && digits[parts[0]] > 0) return 10 + digits[parts[0]];
    return null;
  };
  if (words.at(-1) === 'setengah') {
    const value = whole(words.slice(0, -1)); return value == null ? null : value + 0.5;
  }
  const at = words.indexOf('koma');
  if (at > 0) {
    const value = whole(words.slice(0, at)), decimal = words.slice(at + 1);
    return value != null && decimal.length && decimal.every((w) => w in digits) ? Number(`${value}.${decimal.map((w) => digits[w]).join('')}`) : null;
  }
  return whole(words);
}

// Small, explicit aliases only: no fuzzy correction of place names or amounts.
export function normalizeBuyerLanguage(text) {
  return text.normalize('NFKC').replace(/\b(?:rmh|rmah)\b/gi, 'rumah')
    .replace(/\b(?:nyari|nyarik|carinya)\b/gi, 'cari').replace(/\b(?:cariin|carik(?:an|in))\b/gi, 'carikan').replace(/\basset\b/gi, 'aset')
    .replace(/\b(?:pengen|pingin|pgn)\b/gi, 'ingin')
    .replace(/\b(?:property|properties|proeprty)\b/gi, 'properti')
    .replace(/\b(property|properti|aset|rumah|unit)2(?=\s+(?:yang\s+)?(?:tersebut|ini|itu|tadi|sebelumnya|lain(?:nya)?)\b)/gi,
      (_, noun) => /^property$/i.test(noun) ? 'properti' : noun)
    .replace(/\b(jenis|tipe|kategori|properti|aset)\s+nya\b/gi, '$1nya')
    .replace(/\b(rumah|ruko|toko|gudang|tanah|apartemen|kos)\s+sm\s+(?=rumah|ruko|toko|gudang|tanah|apartemen|kos)/gi, '$1 sama ')
    .replace(/\bgpp\b/gi, 'tidak masalah').replace(/\btau\b/gi, 'tahu')
    .replace(/\bindekos\b/gi, 'kos')
    .replace(/\bbesar\s+kecil\s+(tanah|lahan)(nya)?\b/gi, 'luas $1$2')
    .replace(/\b(?:budget|bujet|anggaran|dana|harga|plafon)nya\b/gi, (word) => word.slice(0, -3))
    .replace(/\bluasan(?:nya)?\b/gi, 'luasnya')
    .replace(/\bukuran\s+(tanah|lahan|bangunan)(nya)?\b/gi, 'luas $1$2')
    .replace(/\b(?:gk|tdk)\b/gi, 'tidak');
}

// Keep the field label, discard a rejected value, and parse the correction.
// This applies to quantities only; geography has its own scoped resolver.
export function correctedQuantityText(text) {
  return text.replace(/\b(?:bukan|bukannya|tidak|nggak|gak)\s+(?=\d)[^;\n]*?\b(?:tapi|tetapi|melainkan)\s+/gi, '')
    .replace(/\b(?:jangan|tidak(?:\s+boleh)?|nggak(?:\s+boleh)?|gak(?:\s+boleh)?|ga(?:\s+boleh)?)\s+(?:di\s*atas|lebih\s+dari|melebihi)\b/gi, 'maksimal')
    .replace(/\b(?:jangan|tidak(?:\s+boleh)?|nggak(?:\s+boleh)?|gak(?:\s+boleh)?)\s+(?:di\s*bawah|kurang\s+dari)\b/gi, 'minimal');
}

export function normalizeBuyerQuantities(text) {
  let clean = normalizeBuyerLanguage(text).replace(/\bsem(?:iliar|ilyar)\b/gi, '1 miliar').replace(/\bsejuta\b/gi, '1 juta')
    .replace(/\bmilyard?\b/gi, 'miliar');
  clean = clean.replace(new RegExp(`\\b(${numberWords}(?:\\s+${numberWords})*)\\s*(${QUANTITY_RANGE_SEPARATOR}|dan)\\s*(${numberWords}(?:\\s+${numberWords})*)\\s+(miliar|juta|jt|ribu|rb|hektar|ha|are|meter(?:\\s+(?:persegi|kuadrat))?|m[²2])(?![\\p{L}\\p{N}])`, 'giu'), (all, first, separator, last, unit) => {
    const low = spokenNumber(first), high = spokenNumber(last);
    return low != null && high != null && low > 0 && high > 0 ? `${low} ${separator} ${high} ${unit}` : all;
  });
  return clean.replace(new RegExp(`\\b(${numberWords}(?:\\s+${numberWords})*)\\s+(miliar|juta|jt|ribu|rb|hektar|ha|are|meter(?:\\s+(?:persegi|kuadrat))?|m[²2])(?![\\p{L}\\p{N}])`, 'giu'), (all, words, unit) => {
    const value = spokenNumber(words); return value != null && value > 0 ? `${value} ${unit}` : all;
  });
}

export const assistantQuestions = (text = '') => text.match(/[^.!?\n]*\?/g) || [];
export const isBudgetQuestion = (text = '') => assistantQuestions(text).some((part) => /\b(?:budget|bujet|anggaran|batas harga)\b/i.test(part));

// A complete answer to a pending preference, not a keyword anywhere in prose.
// Collective answers can cover both displayed optional questions; a bare
// "bebas" still answers only the first. Negations/questions never match.
export function preferenceAnswerText(text) {
  const clean = normalizeBuyerLanguage(text).toLowerCase()
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]/gu, ' ')
    // Correct stretched conversational words only, never arbitrary names.
    .replace(/\bbebas+\b/g, 'bebas').replace(/\bterserah+\b/g, 'terserah')
    .replace(/\bsih+\b/g, 'sih').replace(/\biy+a+\b/g, 'iya')
    .replace(/^[\s,.!…]+|[\s,.!…]+$/g, '').trim()
    .replace(/^(?:kalau|kalo)\s+(?:saya|aku)[\s,]+/i, '')
    .replace(/^(?:(?:saya|aku|iya|ya|yah|oke|ok|oh|h+m+|e+m+|sebenarnya|sebetulnya|sih|pak|bu|bapak|ibu|kak|kakak|mas|mbak|min|gan|bos)[\s,]+)+/i, '');
  const words = clean.split(/[\s,]+/).filter(Boolean);
  const particle = /^(?:pak|bu|bapak|ibu|kak|kakak|mas|mbak|min|gan|bos|ya|yah|sih|kok|dong|deh|mah|lah|nih|loh|lho|saja|aja|juga|dulu|ha(?:ha)+|he(?:he)+|(?:wk)+)$/i;
  while (words.length > 1 && particle.test(words.at(-1))) {
    // "Apa saja" is a choice; removing "saja" would change its meaning.
    if (/^(?:saja|aja)$/.test(words.at(-1)) && /^(?:apa|berapa|mana|sama)$/.test(words.at(-2))) break;
    words.pop();
  }
  return words.join(' ');
}

export function unrestrictedPreferenceAnswer(text, { collectiveOnly = false, allowUndecided = true } = {}) {
  const clean = preferenceAnswerText(text);
  if (/^(?:semua(?:nya)?|keduanya|dua[- ]?duanya|dua2nya)(?:\s+(?:juga\s+)?(?:boleh|bisa|bebas|oke|tidak masalah|gapapa|gak apa apa))?$/i.test(clean)) return true;
  if (collectiveOnly) return false;
  if (allowUndecided && clean === 'belum ada pilihan') return true;
  return /^(?:bebas|terserah(?:\s+(?:anda|bapak|ibu))?|fleksibel|(?:yang\s+)?(?:apa|berapa|mana)\s*(?:saja|aja|pun)(?:\s+(?:boleh|bisa|oke|tidak masalah))?|(?:tidak|nggak|ngga|enggak|gak|ga)\s+(?:pilih[ -]?pilih|ada\s+preferensi)|tidak masalah|gapapa|gak apa apa)$/i.test(clean);
}

// A request for affordability changes ordering, never the budget or asset
// value. Reject negative/question uses and let explicit corrections clear it.
export function priceOrderPreference(text) {
  for (const clause of normalizeBuyerLanguage(text).split(/[,;.!\n]|\b(?:tapi|tetapi|melainkan)\b/i).reverse()) {
    if (/[?？]/.test(clause)) continue;
    if (/\b(?:nggak|ngga|enggak|gak|ga|tidak|bukan|jangan)\b[^,;.!?]{0,50}\b(?:murah|termurah|terjangkau|harga terendah)\b/i.test(clause)) return null;
    if (/\b(?:cari(?:kan)?|ingin|mau|pengen|utamakan|prioritaskan|pilih|yang penting|pokoknya|asal(?:kan)?|urutkan)\b[^,;.!?]{0,80}\b(?:murah|termurah|terjangkau|harga terendah)\b/i.test(clause)) return 'price_asc';
  }
  return undefined;
}

export function maskLandPreferences(text, { expected = false } = {}) {
  let clean = text.replace(/\b(?:(?:bebas|terserah|fleksibel|tanpa\s+(?:batas(?:an)?|patokan)|(?:nggak|ngga|enggak|gak|ga|tidak|tak)\s+(?:masalah|ada\s+(?:batas(?:an)?|patokan)|dibatasi|dipatok))\s+(?:(?:soal|untuk)\s+)?)?(?:luas(?:nya)?(?:\s+(?:tanah|lahan|bangunan)(?:nya)?)?|tanahnya|lahannya|lt|lb)\b.*?(?=\b(?:budget|bujet|anggaran|harga|dana|plafon|jenis(?:nya)?|tipe(?:nya)?|kategori(?:nya)?|cari(?:kan)?|mencari|di|daerah|kota|kabupaten|kecamatan|kelurahan|desa)\b|[,;\n]|$)/gi, ' ');
  if (expected) {
    clean = clean.replace(/\b(?:tidak|tak|nggak|ngga|enggak|gak|ga)\s+ada\s+(?:batas(?:an)?|patokan)\b/gi, ' ');
    // An unlabelled "100–120 m" answers the pending land question. Keep
    // numeric region names such as "11 Ilir"; only measurement spans are masked.
    clean = clean.replace(/\b(?:(?:antara|sekitar|kira-kira|kurang lebih)\s+)?\d+(?:[.,]\d+)*\s*(?:m[²2]?|meter(?:\s+(?:persegi|kuadrat))?|hektar|ha|are)?\s*(?:-|–|—|−|sampai(?:\s+dengan)?|sampe|hingga|s\s*\/\s*d|s\.\s*d\.?|sd|dan)\s*\d+(?:[.,]\d+)*\s*(?:m[²2]?|meter(?:\s+(?:persegi|kuadrat))?|hektar|ha|are)?(?![\p{L}\p{N}])/giu, ' ')
      .replace(/\b\d+(?:[.,]\d+)*\s*(?:m[²2]?|meter(?:\s+(?:persegi|kuadrat))?|hektar|ha|are)(?![\p{L}\p{N}])/giu, ' ');
  }
  return clean;
}

export function geographicScopeText(text, { landExpected = false } = {}) {
  // "Jenis bebas" or "luas tanah bebas" cannot widen the search area.
  return maskLandPreferences(text, { expected: landExpected }).replace(/\b(?:(?:bebas|terserah|fleksibel|(?:nggak|gak|ga|tidak)\s+masalah)\s+(?:(?:soal|untuk)\s+)?)?(?:luas(?:\s+(?:tanah|lahan|bangunan))?|lt|lb|budget|bujet|anggaran|harga|dana|jenis|tipe|kategori)(?:nya)?\b.*?(?=\b(?:di|daerah|kota|kabupaten|kecamatan|kecamatannya|kelurahan|kelurahannya|desa|lokasi(?:nya)?|area|wilayah)\b|[,;\n]|$)/gi, ' ');
}

export function acceptsAnyLocation(text) {
  const value = geographicScopeText(text);
  if (/[?？]|\b(?:bukan|jangan|tidak|nggak|gak|ga)\s+(?:bebas|semua|seluruh|terserah|fleksibel)\b/i.test(value)) return false;
  return /\b(?:mana\s*(?:saja|aja|pun)|dimana\s*(?:saja|aja|pun)|seluruh|semua|se[- ]?(?:kota|kabupaten)|terserah|bebas|fleksibel|belum ada (?:pilihan|preferensi) (?:area|kawasan))\b|\b(?:nggak|gak|ga|tidak)\s+(?:masalah|membatasi)\b/i.test(value);
}

export function positiveGeographyText(text) {
  // Corrections may mention the rejected city first. Never turn "bukan
  // Gresik, ganti ke Sidoarjo" into a search in the rejected city.
  return text.replace(/\b(?:bukan|jangan|tidak|nggak|gak|ga)\s+(?!(?:masalah|membatasi|ada|dibatasi|dipatok)\b)(?:di\s+)?[\p{L}][\p{L}\s.-]*?(?=[,;.!?\n]|\b(?:tapi|tetapi|melainkan|ganti|ubah|budget|bujet|anggaran|luas|lt|lb|jenis)\b|$)/giu, ' ');
}
