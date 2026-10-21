import { recommendationIds } from './recommendations.js';
import { explicitAsset, hasSearchIntent } from './buyer_profile.js';
import { normalizeBuyerLanguage } from './buyer_language.js';

export const AMBIGUOUS_SELECTION_REPLY = 'Ada beberapa pilihan yang cocok dengan pesan tadi. Mau saya buka nomor berapa? Boleh juga kirim link detail atau kode asetnya.';
export const INVALID_SELECTION_REPLY = 'Pilihan itu belum cocok dengan daftar rekomendasi terakhir. Boleh sebutkan nomor dari daftar, atau kirim link detail/kode asetnya?';
export const MISSING_SELECTION_REPLY = 'Saya belum punya daftar rekomendasi yang bisa dijadikan acuan nomor itu. Boleh kirim link detail atau kode aset yang dimaksud?';

const key = (text) => text.normalize('NFKC').toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const contains = (text, part) => !!part && ` ${text} `.includes(` ${part} `);
const relaxed = (text) => key(text).replace(/\b(?:jl|jln)\b/g, 'jalan').replace(/\bkel\b/g, 'kelurahan')
  .replace(/\bkec\b/g, 'kecamatan').replace(/\bkab\b/g, 'kabupaten').replace(/\bno\b/g, 'nomor')
  .replace(/\b(\d+)\s+([a-z])\b/g, '$1$2');
const addressFragment = (text) => text.replace(/\b(?:boleh|bisa|tolong|mohon|minta|detail(?:nya)?|rincian|spesifikasi|jelaskan|info(?:rmasi)?|lengkap|terhadap|tentang|mengenai|untuk|saya|aset(?:nya)?|properti(?:nya)?|unit(?:nya)?|yang|ini|itu|pak|bapak|bu|ibu|ya|dong|pilih|bahas|maksud)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

function refersToOfferedProperty(text) {
  const lead = '(?:(?:iya|ya|oke|ok|baik|siap|sip|boleh|bisa|tolong|mohon|mau|ingin|pilih|lihat|liat|buka|bukain|coba|cobain|cek|bahas|saya|aku|tertarik|berminat|minat|dengan|pada|sama|detail(?:nya)?|minta|jelaskan|jelasin|info(?:nya)?|pak|bu)\\s+){0,12}';
  const pointer = '(?:ini|itu|tadi|tersebut|ditawarkan|direkomendasikan)';
  const property = `(?:(?:aset|properti|rumah|unit|listing|pilihan|opsi)(?:nya)?(?:\\s+(?:yang\\s+)?${pointer})?|(?:yang|yg)\\s+${pointer})`;
  const tail = '(?:\\s+(?:dulu|aja|saja|ya|yah|dong|deh|pak|bu|bapak|ibu|kak|mas|mbak|tolong|detail(?:nya)?|lengkap|terima kasih|makasih))*';
  // Match the whole selection request. A rejection, a budget correction, or
  // "cari di area aset tersebut" must not select the only property by accident.
  return new RegExp(`^${lead}${property}${tail}$`, 'i').test(key(normalizeBuyerLanguage(text)));
}

function acceptsOnlyOffer(text) {
  return /^(?:iya|ya|oke|ok|baik|siap|sip|boleh|mau|lanjut)(?:\s+(?:pak|bu|bapak|ibu|kak|mas|mbak|ya|dong|aja|saja))*$/.test(key(text));
}

function cardsFrom(text) {
  const headings = [...text.matchAll(/^[ \t]*(?:[•*-]|\d+\\?[.)])\s+\*{1,2}([^\n]+?)\*{1,2}[ \t]*$/gm)];
  return headings.flatMap((heading, i) => {
    const block = text.slice(heading.index, headings[i + 1]?.index ?? text.length);
    const ids = recommendationIds(block);
    return ids.length === 1 ? [{ id: ids[0], address: heading[1].replace(/\*/g, '').trim() }] : [];
  });
}

// Normalize conversational decoration for intent parsing only. Addresses,
// prices and the original message remain intact for catalog lookup / replies.
function selectionText(text) {
  return normalizeBuyerLanguage(text).replace(/\byg\b/gi, 'yang')
    .replace(/\b(?:dlu|dl)\b/gi, 'dulu').replace(/\bbs\b/gi, 'bisa').replace(/\bcb\b/gi, 'coba')
    .replace(/\b(?:nomr|nmr|nomer)(?=\b|\d)/gi, 'nomor')
    .replace(/\b(?:detailin|detailkan)\b/gi, 'detail')
    // "Boleh gak" is a request; "gak mau" remains a refusal.
    .replace(/\b(boleh|bisa)(?:kah)?\s+(?:tidak|nggak|ngga|enggak|gak|ga)\b/gi, '$1')
    .replace(/\b(?:pak|bapak|bu|ibu|kak|mas|mbak|ya|yah|dong|deh|nih|sih|aja|saja|dulu)\b/gi, ' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const selectionPrefix = (text) => text.split(/\b(?:tapi|tetapi|melainkan|namun)\b/i).at(-1)
  .replace(/[,;.!?…\n]+/g, ' ').replace(/\s+/g, ' ').trim();

function ordinalChoices(text) {
  text = selectionText(text);
  const values = { pertama: 0, satu: 0, kedua: 1, dua: 1, ketiga: 2, tiga: 2, keempat: 3, empat: 3, kelima: 4, lima: 4 };
  const number = '(pertama|kedua|ketiga|keempat|kelima|satu|dua|tiga|empat|lima|[0-9]+)';
  const pattern = new RegExp(`\\b((?:yang|opsi|pilihan|unit|listing|aset|properti|rumah)(?:nya)?(?:\\s+(?:nomor|no\\.?))?|nomor|no\\.?|urutan)\\s*[:=]?\\s*(?:urut\\s+)?(?:ke[-\\s]*)?#?\\s*${number}(?:nya)?\\b`, 'gi');
  const choices = [];
  // Address matching runs first. An unmatched street/house number must never
  // silently fall back to the same number in the recommendation list.
  if (/\b(?:jalan|jl\.?|jln\.?|blok)\b/i.test(text)) return choices;
  let previousEnd = 0, previousDenied = false;
  for (const match of text.matchAll(pattern)) {
    const prefix = selectionPrefix(text.slice(0, match.index));
    const between = text.slice(previousEnd, match.index).replace(/[,;.!?…\n]+/g, ' ').trim();
    const suffix = text.slice(match.index + match[0].length);
    previousEnd = match.index + match[0].length;
    if (/^\.\d/.test(suffix) || /^\s*(?:[.,]\d+\s*)?(?:kamar|lantai|juta|jt|ribu|rb|rupiah|miliar|milyar|milyard|m[²2]?|meter|hektar|ha)\b/i.test(suffix)) { previousDenied = false; continue; }
    const denied = /\b(?:bukan|jangan|tidak|nggak|ngga|enggak|gak|ga|belum|batal|batalkan|ogah|skip|lewati|lupakan|coret|hapus|tolak|kecuali|selain)\s*(?:(?:tertarik|berminat|minat|mau|ingin|pilih|suka|lihat|melihat|ambil|coba|cek|buka|boleh|bisa|jadi)\s*){0,4}$/i.test(prefix) ||
      /^\s*(?:jangan|bukan|nggak|tidak|gak|ga|belum|batal|batalkan|skip|lewati|lupakan|coret|hapus|tolak)\b/i.test(suffix) ||
      previousDenied && /^(?:dan|atau|&|\/)$/i.test(between);
    previousDenied = denied;
    if (denied) continue;
    // A number explicitly referring to the offered list doesn't require a
    // fixed verb immediately before it. Exclude unrelated identifiers/budgets,
    // unless a later selection request clearly starts a new part of the turn.
    if (/^(?:nomor|no\.?)/i.test(match[1]) && prefix) {
      const field = [...prefix.matchAll(/\b(?:budget|bujet|anggaran|plafon|dana|rekening|telepon|hp|ktp|npwp|nik|sertifikat|shm|shgb|dokumen|akta|surat|kamar|lantai|pelanggan|klien|karyawan|peserta|bidder)\b/gi)].at(-1);
      if (field && !/\b(?:pilih|lihat|liat|buka|bukain|dibuka|dibukain|cek|dicek|coba|cobain|detail|spesifikasi|infokan)\b/i.test(prefix.slice(field.index + field[0].length))) continue;
    }
    choices.push(values[match[2].toLowerCase()] ?? Number(match[2]) - 1);
    const additional = new RegExp(`^\\s*(?:dan|atau|&|/|,)\\s*(?:nomor\\s*|no\\.?\\s*)?${number}\\b`, 'i').exec(suffix);
    if (additional) choices.push(values[additional[1].toLowerCase()] ?? Number(additional[1]) - 1);
  }
  const lead = '(?:(?:saya|aku|tolong|mohon|boleh|bisa|coba|cobain|mau|ingin|pilih|lihat|liat|buka|bukain|tampilkan|tunjukkan|tunjukin|detail(?:nya)?|minta|cek|bahas|jelaskan|jelasin|yang)\\s+){0,8}';
  const tail = '(?:\\s+(?:dulu|aja|saja|ya|yah|dong|deh|pak|bu|bapak|ibu|kak|mas|mbak|tolong|detail(?:nya)?|lengkap))*[,;.!?…\\s]*';
  const bareText = text.replace(/(?<=[\p{L}])[,;:!?…\s]+|[,;:!?…]+(?=\s*[\p{L}])/gu, ' ').replace(/\s+/g, ' ').trim();
  const bare = new RegExp(`^\\s*${lead}(?:ke[-\\s]*)?#?\\s*${number}(?:nya)?${tail}$`, 'i').exec(bareText);
  if (bare) choices.push(values[bare[1].toLowerCase()] ?? Number(bare[1]) - 1);
  const pair = new RegExp(`^\\s*${lead}${number}\\s*(?:dan|atau|&|/|,)\\s*${number}${tail}$`, 'i').exec(bareText);
  if (pair) for (const value of pair.slice(1)) choices.push(values[value.toLowerCase()] ?? Number(value) - 1);
  return [...new Set(choices)];
}

const startsCrmOffer = text => /^Halo [^\n]*\bsaya ada \d+ [^\n]*\bcocok\b/mi.test(text);
export function isRecommendationList(text) {
  return recommendationIds(text).length > 0 && (text.includes('Lihat detail:') ||
    startsCrmOffer(text) ||
    /^[ \t]*(?:[•*-]|\d+\\?[.)])\s+\*{1,2}Kode\s*[:#-]?\s*\d+/mi.test(text));
}

function previousRecommendations(history) {
  const lastIndex = history.findLastIndex((item) => item.role === 'assistant');
  const last = history[lastIndex];
  if (!last) return null;
  if ([AMBIGUOUS_SELECTION_REPLY, INVALID_SELECTION_REPLY].includes(last.content) || /^\*{1,2}DETAIL ASET\b/m.test(last.content)) {
    // Our selection clarification or property detail preserves the prior list.
    // An unrelated question about two options must not reuse old property IDs.
    const prior = history.findLastIndex((item, index) => index < lastIndex && item.role === 'assistant' && isRecommendationList(item.content));
    return prior < 0 ? null : previousRecommendations(history.slice(0, prior + 1));
  }
  if (!isRecommendationList(last.content)) return null;
  let start = lastIndex;
  while (start > 0 && !startsCrmOffer(history[start].content) && history[start - 1].role === 'assistant' && isRecommendationList(history[start - 1].content)) start--;
  return { ...last, content: history.slice(start, lastIndex + 1).map((item) => item.content).join('\n\n') };
}

export function selectedRecommendation(text, history) {
  const ordinals = ordinalChoices(text);
  // A code/link is already an explicit pointer; an address or ordinal must not
  // override it. Bare 1–5 after cards remains an ordinal, not an asset code.
  if (explicitAsset(text) && !/^\s*\d{1,2}\s*[.!?]?\s*$/.test(text)) return null;
  const last = previousRecommendations(history);
  if (!last) return ordinals.length && /\b(?:nomor|nomer|nmr|no|yang|yg|opsi|pilihan|pilih|lihat|coba|buka|detail)\b/i.test(text) ? { id: null, kind: 'missing' } : null;
  const detail = /\b(?:detail(?:nya)?|rincian|spesifikasi|jelaskan|info(?:rmasi)? lengkap|pilih|bahas|maksud)\b/i.test(text) ||
    ordinals.length > 0 && /\b(?:info(?:nya)?|informasi|cek|lihat|liat|buka)\b/i.test(text);
  if (hasSearchIntent(text) && !detail) return null;
  const ids = recommendationIds(last.content);
  const cards = cardsFrom(last.content);
  const result = (matches, kind = 'address') => {
    const matchesIds = [...new Set(matches.map((card) => card.id))];
    return matchesIds.length === 1 ? { id: matchesIds[0], kind } : { id: null, kind: 'ambiguous' };
  };
  // Prefer the literal full heading. In particular, the user's exact "34A"
  // must select that listing even if another heading says "34 A".
  const strict = cards.filter((card) => contains(key(text), key(card.address)));
  if (strict.length) return result(strict);
  // A card can append the province to the source street address. Also match a
  // specific copied address inside the heading before relaxing "34 A" to "34A".
  const literalFragment = addressFragment(key(text));
  const words = literalFragment.split(' ').filter(Boolean);
  const specific = words.length >= 3 && /\d/.test(literalFragment) && words.filter((word) => /\p{L}/u.test(word)).length >= 2;
  const canMatchFragment = specific || detail && words.length >= 2;
  const literal = canMatchFragment ? cards.filter((card) => contains(key(card.address), literalFragment)) : [];
  if (literal.length) return result(literal);
  const full = cards.filter((card) => contains(relaxed(text), relaxed(card.address)));
  if (full.length) return result(full);
  const fragment = relaxed(literalFragment);
  const partial = canMatchFragment ? cards.filter((card) => contains(relaxed(card.address), fragment)) : [];
  if (partial.length) return result(partial);
  if (ordinals.length > 1) return { id: null, kind: 'ambiguous' };
  if (ordinals.length) {
    const index = ordinals[0];
    return { id: ids[index] || null, kind: ids[index] ? 'ordinal' : 'invalid' };
  }
  if (refersToOfferedProperty(text)) return result(ids.map((id) => ({ id })), 'reference');
  // Bare consent refers to the selection CTA only while the latest assistant
  // turn is the actual list. It cannot reopen a list after details/closing.
  const immediate = history.findLast((item) => item.role === 'assistant')?.content || '';
  if (acceptsOnlyOffer(text) && isRecommendationList(immediate) &&
      /ada yang menarik|sebutkan nomor|mau.*(?:lihat|cek|buka).*(?:detail|aset)|ingin.*(?:detail|aset)/i.test(immediate)) {
    return result(ids.map((id) => ({ id })), 'single');
  }
  if (!cards.length) return null;
  if (detail && (!fragment || /\b(?:aset|properti|unit|yang ini|yang itu)\b/i.test(text))) {
    return !fragment ? result(cards) : { id: null, kind: 'invalid' };
  }
  return null;
}
