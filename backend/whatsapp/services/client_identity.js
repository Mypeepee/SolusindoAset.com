// Store a chosen form of address, never an inferred gender. This information
// belongs to the conversation and must not become a property search filter.
import { isKnownRegionPhrase } from './region_directory.js';
import { transactionPreference } from './property_transaction.js';
import { acceptsAnyLocation, normalizeBuyerQuantities, unrestrictedPreferenceAnswer } from './buyer_language.js';
import { localPropertyScope, propertyScopeText } from './property_scope.js';

export const INTRODUCTION_MESSAGE = 'Halo, saya asisten virtual Solusindo Aset. Boleh tahu saya ngobrol dengan siapa? Ingin disapa Pak, Bu, Kak, atau cukup nama saja?';
export const SEARCH_INTRODUCTION_QUESTION = 'Tapi sebelum itu, boleh tahu dengan Pak atau Bu siapa saya berbicara? Kalau lebih nyaman disapa nama saja juga boleh.';
export const HELP_INVITATION = 'Ada yang bisa saya bantu?';
const titles = { pak: 'Pak', bapak: 'Pak', bu: 'Bu', ibu: 'Bu', kak: 'Kak', kakak: 'Kak', mas: 'Mas', mbak: 'Mbak' };
const titlePattern = /^(pak|bapak|bu|ibu|kak|kakak|mas|mbak)\b\s*/i;
const nameQuestion = (text = '') => text === INTRODUCTION_MESSAGE || text.endsWith(SEARCH_INTRODUCTION_QUESTION);
const greetingPrefix = /^(?:(?:halo|hallo|hai|hi|hello|pagi|siang|sore|malam|selamat\s+(?:pagi|siang|sore|malam)|assalamualaikum|permisi|salam\s+kenal)\b[\s,;:.!?🙏👋]*)+/i;
const agentNameSource = '(?:jason(?:\\s+christopher)?(?:\\s+liendo)?|christopher\\s+liendo)';
const agentName = new RegExp(`^${agentNameSource}$`, 'i');
const trailingAgentAddress = new RegExp(`\\s+(?:pak|bapak|bu|ibu|kak|kakak|mas|mbak)\\s+${agentNameSource}$`, 'i');
const nonName = /\b(?:saya|aku|sy|sya|lebih|masih|sedang|lagi|lg|sdg|waduh|gatau|gaktau|ingin|mau|pengen|pingin|pgn|cari|nyari|nyarik|mencari|tertarik|minat|berminat|butuh|beli|sewa|lelang|primary|secondary|rumah|tanah|ruko|gudang|toko|pabrik|kos|kost|apartemen|hotel|vila|villa|properti|property|aset|asset|budget|anggaran|juta|luas|lokasi|daerah|kota|kabupaten|kecamatan|kelurahan|di|dari|untuk|investasi|hunian|dihuni|tinggal|flipping|disewakan|pilih|bingung|tahu|tidak|nggak|gak|ga|belum|bukan|jangan|boleh|terserah|bebas|semua|lanjut|apa|siapa|halo|selamat|terima|kasih|oke|ok|sana|situ|sini|sebelah|sekitar|sekitaran|pak|bapak|bu|ibu|kak|mas|mbak)\b/i;
const nonNameTask = /\b(?:tolong|mohon|bantu|buat(?:kan)?|kirim(?:kan)?|cek|invoice|faktur|tagihan|rapat|meeting|kerja(?:an)?|pekerjaan|lamaran|laporan|revisi|desain|website|aplikasi|paket|cuaca|resep|pantun|film|lagu|jual(?:an)?|punya|minta|urus|urusan|bayar|transfer|menawarkan|menjual|mengirim|mengurus|membahas|bahas|koordinasi|golek|nggolek|omah|need|want|looking|lisensi|perpanjang)\b/i;
const introduction = /^(?:(?:nama(?:\s+lengkap)?\s+(?:saya|aku|sy|sya)|namaku|(?:ini\s+)?(?:saya|aku|sy|sya))\s+|(?:kenalin|perkenalkan)(?:\s+(?:nama\s+)?saya)?\s+|(?:(?:boleh|cukup)\s+)?(?:panggil|sapa)(?:\s+(?:saja|aja))?(?:\s+(?:saya|aku))?\s+)/i;
const hesitation = /^(?:h+m+|e+h+|e+m+|o+h+|ha(?:ha)+|he(?:he)+|(?:wk)+|anu|sebentar|bentar|tunggu|nanti|permisi|maaf)(?:\s+(?:ya|pak|bu|kak|dong|dulu|sebentar))*$/i;
const declined = /^(?:(?:nggak|gak|ga|tidak|tak)\s+(?:usah|perlu|mau)(?:\s+(?:sebut|kasih|menyebut|tanya))?\s+nama|(?:nggak|gak|ga|tidak|tak)\s+(?:usah|perlu)(?:\s+(?:kenalan|perkenalan))?|nama\s+(?:nanti|belakangan)(?:\s+(?:aja|saja))?|(?:lewati|skip)(?:\s+(?:dulu|aja|saja))?|langsung(?:\s+ke\s+properti)?\s+(?:aja|saja)|terserah)(?:\s+(?:pak|bu|ya))?$/i;
const introductionCourtesy = /^(?:terima\s+kasih|makasih|(?:(?:saya|aku)\s+)?(?:mau|ingin|boleh|bisa)(?:\s+(?:saya|aku))?\s+(?:tanya|bertanya|nanya|dibantu))(?:\s+(?:dulu|sebentar|ya|pak|bu|kak))*$/i;

const trimCourtesy = (text) => text.replace(/^[\s,;:.!?🙏👋]+|[\s,;:.!?🙏👋]+$/gu, '');
const plausibleRecipientName = (text) => /^[\p{L}][\p{L}'’ -]{0,59}$/u.test(text) &&
  text.split(/\s+/).length <= 4 && !nonName.test(text) && !nonNameTask.test(text) && !/\b(?:ini|disini|namaku)\b/i.test(text);

function isRecipientAddress(text) {
  const clean = trimCourtesy(text);
  const title = titlePattern.exec(clean);
  if (!title) return agentName.test(clean);
  const name = trimCourtesy(clean.slice(title[0].length));
  return !name || plausibleRecipientName(name);
}

export function isClientGreeting(text = '') {
  const clean = trimCourtesy(text);
  const opening = greetingPrefix.exec(clean);
  return !!opening && (!clean.slice(opening[0].length) || isRecipientAddress(clean.slice(opening[0].length)));
}

function withoutAddressedGreeting(text) {
  // Separate the recipient from the explicitly introduced speaker. This works
  // for both "malam Pak Jason, saya Vera" and "halo Mas Budi saya Vera".
  for (const marker of text.matchAll(/\b(?:saya|aku|sy|sya|nama|namaku|perkenalkan|kenalin|panggil|sapa|ini|boleh|cukup)\b/gi)) {
    const before = text.slice(0, marker.index);
    const answer = text.slice(marker.index);
    if ((introduction.test(answer) || /^ini\s+/i.test(answer)) && (isClientGreeting(before) || isRecipientAddress(before))) return answer;
  }
  return text;
}

// A self-introduction's origin is background, not the requested search area.
// Keep any actual requirements that follow it, including a rejected location
// before a correction. No origin/name is sent to the property API as a filter.
function withoutIntroductionOrigin(text) {
  // "Dari owner/developer" answers a transaction question; it is not the
  // client's origin even when the optional introduction was also invited.
  if (/^dari\s+(?:owner|pemilik|developer|pengembang|lelang|primary|secondary|sewa)\b/i.test(text)) return text;
  const origin = /^(?:(?:dan|saya|aku|sy|sya)\s+)*(?:dari|(?:berasal|asli)(?:\s+(?:dari|di))?|asal(?:nya)?(?:\s+dari)?|domisili(?:nya)?(?:\s+di)?|berdomisili(?:\s+di)?|tinggal(?:nya)?\s+di)\s+/i.exec(text);
  if (!origin) return text;
  const body = text.slice(origin[0].length);
  if (!body.trim() || /^(?:mana|siapa|apa)\b/i.test(body)) return text;
  const requirement = /\b(?:(?:(?:dan|tapi|tetapi|melainkan|bukan|jangan|tidak|nggak|gak|ga)\s+)?(?:(?:saya|aku|sy|sya)\s+)?(?:(?:sedang|lagi|lg|sdg|rencana|rencananya|berencana)\s+)?(?:cari(?:kan|nya)?|nyari|nyarik|mencari|mau|ingin|pengen|pingin|pgn|tertarik|butuh)|budget|bujet|anggaran|dana|plafon|harga|luas|lt|lb)\b|[,;]\s*(?=(?:rumah|ruko|tanah|gudang|apartemen|toko|pabrik|kos|lelang|primary|secondary|sewa)\b)/i.exec(body);
  return requirement ? body.slice(requirement.index).replace(/^[\s,;]+/, '') : '';
}

export function splitClientIntroduction(text, preceding = '') {
  if (localPropertyScope(text) === 'other') return { update: null, declined: false, remaining: text, origin_provided: false };
  const original = text;
  text = withoutAddressedGreeting(text);
  const expected = nameQuestion(preceding);
  let update = null, declinedName = false;
  const parts = text.split(/([,;.!?\n]+|\s+(?=(?:(?:dan|terus|trus|btw)\s+)?(?:(?:saya|aku|sy|sya)\s+)?(?:(?:sedang|lagi|lg|sdg|rencana|rencananya|berencana)\s+)?(?:(?:tolong|mohon|bantu)\s+)?(?:cari(?:kan)?|nyari|nyarik|mencari|mau\s+(?:beli|sewa|cari|nyari)|(?:mau|boleh|bisa)\s+(?:tanya|bertanya|nanya|dibantu)|ingin|pengen|pingin|pgn|tertarik|butuh|budget|anggaran|di(?!\s+sini\b)|dari)\b))/i);
  const remaining = [];
  let implicitNameAvailable = expected || text !== original;
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i].trim();
    const separator = parts[i + 1] || '';
    if (!clause) { remaining.push(separator); continue; }
    // A greeting is courtesy, not an unanswered property requirement, and
    // does not consume the opportunity to answer a pending name question.
    if (isClientGreeting(clause)) continue;
    if (update && introductionCourtesy.test(clause)) continue;
    if (update && agentName.test(trimCourtesy(clause).replace(titlePattern, ''))) continue;
    // A name prompt applies to the first answer, not every comma-separated
    // clause. Once the client starts their requirements, bare tails stay data.
    const expectedHere = implicitNameAvailable;
    implicitNameAvailable = false;
    const originOnly = expectedHere && /^(?:(?:saya|aku|sy|sya)\s+)?(?:asal(?:nya)?|berasal|domisili(?:nya)?|berdomisili|tinggal(?:nya)?)(?:\s+(.+))?$/i.exec(clause);
    if (originOnly && (originOnly[1] || /^(?:di|dari)\s+/i.test(parts[i + 2] || ''))) {
      remaining.push(clause + separator);
      continue;
    }
    if ((expected || /\bnama\b/i.test(clause)) && declined.test(clause) &&
      !(preceding.endsWith(SEARCH_INTRODUCTION_QUESTION) && /^terserah(?:\s+(?:pak|bu|ya))?$/i.test(clause))) {
      declinedName = true;
      continue;
    }
    if (/^(?:cukup\s+)?(?:(?:panggil|sapa)(?:\s+saya)?\s+)?(?:nama(?:nya)?\s+(?:saja|aja)|tanpa\s+(?:sapaan|pak|bu))(?:\s+(?:ya|pak|bu))?$/i.test(clause)) {
      update = { ...update, salutation: null };
      continue;
    }
    // "Saya fleksibel" answers a preference, even though it starts with
    // the same pronoun as an introduction. Keep the existing client name.
    if (unrestrictedPreferenceAnswer(clause, { allowUndecided: false })) {
      remaining.push(clause + separator);
      continue;
    }
    const contextualPrefix = expectedHere && /^(?:(?:(?:saya|aku)\s+)?(?:dengan|sama|namanya)|(?:saya|aku)\s+namanya|ini(?!\s+(?:saya|aku|sy|sya)\b))\s+/i.exec(clause);
    const inverted = /^(.*?)\s+(?:namaku|nama\s+(?:saya|aku|sy)|di\s+sini|disini)(?:\s+(?:ya|pak|bu|kak))?$/i.exec(clause);
    const explicit = contextualPrefix || introduction.exec(clause) || inverted;
    if ((!explicit && !expectedHere) || separator.includes('?')) { remaining.push(clause + separator); continue; }
    let value = (inverted ? inverted[1] : clause.slice(explicit?.[0].length || 0)).trim();
    value = value.replace(trailingAgentAddress, '');
    let originTail = '';
    const originMarker = /\s+(?=(?:asal(?:nya)?|asli|berasal|domisili(?:nya)?|berdomisili|tinggal(?:nya)?)\b)/i.exec(value);
    if (originMarker) {
      const candidate = value.slice(originMarker.index).trim();
      if (/\s/.test(candidate) || /^(?:asal(?:nya)?|berasal|domisili(?:nya)?|berdomisili|tinggal(?:nya)?)$/i.test(candidate) && /^(?:di|dari)\s+/i.test(parts[i + 2] || '')) {
        originTail = candidate;
        value = value.slice(0, originMarker.index).trim();
      }
    }
    const title = titlePattern.exec(value);
    if (title) value = value.slice(title[0].length);
    // A trailing "pak" addresses the assistant. Only a title before the
    // client's own name, or their explicit chosen title, establishes a preference.
    value = value.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\s]+$/gu, '').trim();
    value = value.replace(/(?:^|\s)(?:(?:saja|aja|ya|nih|sih|dong|deh|pak|bu|bapak|ibu|kak|mas|mbak)\s*)+$/i, '').trim();
    value = value.replace(/\s+(?:di\s+sini|disini)$/i, '').trim();
    if (!explicit && !title &&
      (isKnownRegionPhrase(value) || acceptsAnyLocation(clause) || unrestrictedPreferenceAnswer(value) ||
        /\b(?:intinya|pokoknya|mana|iya|ya|sip|siap|betul|benar|(?:kota|kabupaten|kecamatan|kelurahan|wilayah|kawasan)(?:nya)?)\b/i.test(value) ||
        transactionPreference(value, { expected: true }))) {
      remaining.push(clause + separator);
      continue;
    }
    // Written-out budgets and measurements are search criteria, including
    // when the client answers them instead of the optional introduction.
    const normalizedValue = normalizeBuyerQuantities(value);
    const name = /^[\p{L}][\p{L}'’ -]{0,59}$/u.test(value) && (explicit || value.length > 1) && !hesitation.test(value) && !/^(?:ping|sih|deh|dong|nih|nih ya|hehe|hahaha|wkwk)$/i.test(value) && !/\b(?:dengan|sama|mungkin|h+m+)\b/i.test(value) && value.split(/\s+/).length <= 4 && !nonName.test(normalizedValue) && !nonNameTask.test(normalizedValue) && !/\d/.test(normalizedValue) ? value.replace(/\s+/g, ' ') : null;
    if (!name && !(title && !value)) { remaining.push(clause + separator); continue; }
    update = { ...update, ...(name ? { name } : {}), ...(title ? { salutation: titles[title[1].toLowerCase()] } : explicit && /\b(?:panggil|sapa)\b/i.test(explicit[0]) ? { salutation: null } : {}) };
    if (originTail) remaining.push(originTail + separator);
  }
  let requirements = remaining.join('').replace(/^[\s,;.!?]+|[\s,;]+$/g, '').trim();
  let originProvided = false;
  if (expected || update?.name || update?.salutation) {
    const searchRequirements = withoutIntroductionOrigin(requirements);
    originProvided = searchRequirements !== requirements;
    requirements = searchRequirements;
  }
  return { update, declined: declinedName, remaining: requirements, origin_provided: originProvided };
}

export function clientIdentity(history = [], seed = {}) {
  history = history.filter((item) => !item.property_ignored);
  let identity = { name: null, salutation: null, asked: false, declined: false, ...seed };
  for (const [index, item] of history.entries()) {
    if (item.role === 'assistant' && nameQuestion(item.content)) identity.asked = true;
    if (item.role !== 'user' || item.property_ignored) continue;
    const parsed = splitClientIntroduction(item.content, history[index - 1]?.role === 'assistant' ? history[index - 1].content : '');
    if (parsed.update) identity = { ...identity, ...parsed.update, declined: false };
    if (parsed.declined) identity.declined = true;
  }
  return identity;
}

export const clientLabel = (identity) => {
  const name = identity?.name;
  const display = name && name === name.toLocaleLowerCase('id-ID')
    ? name.replace(/(^|[\s-])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase('id-ID')) : name;
  return [identity?.salutation, display].filter(Boolean).join(' ');
};

export function clientIntroductionTurn({ text, history = [], identity: seed = {}, hasContext = false }) {
  const before = history.at(-1)?.role === 'user' && history.at(-1).content === text ? history.slice(0, -1) : history;
  const identity = clientIdentity([...before, { role: 'user', content: text }], seed);
  const parsed = splitClientIntroduction(text, before.at(-1)?.role === 'assistant' ? before.at(-1).content : '');
  const label = clientLabel(identity);
  if (isClientGreeting(text) && !hasContext && !identity.asked && !identity.declined && !label) {
    return { identity, reply: INTRODUCTION_MESSAGE };
  }
  if ((parsed.update || parsed.declined || parsed.origin_provided) && !parsed.remaining && !hasContext) {
    return { identity, reply: `${parsed.declined ? 'Tidak masalah.' : label ? `Salam kenal, ${label}.` : parsed.origin_provided ? 'Baik.' : 'Baik, saya pakai sapaan netral ya.'} ${HELP_INVITATION}` };
  }
  return { identity, answered: !!parsed.update, remaining: parsed.remaining };
}

// Extract identity only from user messages. Leave assistant questions in place
// for qualification, and keep all the property clauses of a combined answer.
export function propertyOnlyConversation(history = [], text = '') {
  const before = history.at(-1)?.role === 'user' && history.at(-1).content === text ? history.slice(0, -1) : history;
  const cleanText = splitClientIntroduction(propertyScopeText(text), before.at(-1)?.role === 'assistant' ? before.at(-1).content : '').remaining;
  return { text: cleanText, history: history.map((item, index) => item.role === 'user'
    ? { ...item, content: splitClientIntroduction(propertyScopeText(item.content), history[index - 1]?.role === 'assistant' ? history[index - 1].content : '').remaining }
    : item) };
}

export function personalizeClientReply(result, identity, { introduced = false, replaceNeutralSalutation = false } = {}) {
  const label = clientLabel(identity);
  if (!label || !result.reply) return result;
  const apply = (reply) => {
    if (replaceNeutralSalutation) reply = reply.replace(/\bBapak\/Ibu\b/g, label);
    if (introduced && /^Oke, /i.test(reply)) return reply.replace(/^Oke, (\p{L})/iu, (_, first) => `Salam kenal, ${label}. ${first.toLocaleUpperCase('id-ID')}`);
    return reply.replace(/(^|\n\n)Siap, saya (bantu|catat|carikan)/i, (_, prefix, verb) => `${prefix}Siap, ${label}. Saya ${verb}`);
  };
  return { ...result, reply: apply(result.reply), ...(result.replies ? { replies: result.replies.map(apply) } : {}) };
}

export function inviteSearchIntroduction(result, buyer, identity) {
  if (!result.reply || result.action && result.action !== 'reply' || result.knowledge?.status !== 'qualifying' ||
    !buyer?.searching || buyer.search_turn !== 1 || identity.asked || identity.declined || clientLabel(identity)) return result;
  // Keep the introduction without stacking several independent questions.
  const lines = result.reply.split('\n');
  let questionSeen = false;
  result = { ...result, reply: lines.filter((line) => {
    if (!line.includes('?')) return true;
    if (questionSeen) return false;
    questionSeen = true; return true;
  }).join('\n') };
  return { ...result, reply: `${result.reply}\n\n${SEARCH_INTRODUCTION_QUESTION}` };
}
