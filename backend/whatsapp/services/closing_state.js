import { ServiceError } from '../lib/http.js';
import { propertyTransactionType } from './property_costs.js';
import { parseBudgetAmounts } from './budget_amounts.js';
import { normalizeBuyerQuantities } from './buyer_language.js';

export const SEARCH_STATE = 'Search_State';
export const CLOSING_STATE = 'Closing_State';
export const CLOSING_TOPICS = ['stock', 'stock_sold', 'clarify', 'mou', 'dp', 'schedule', 'account', 'deposit', 'bidding', 'won', 'possession', 'refund', 'readiness', 'purchase_preparation'];
export const CLOSING_FLOW_VERSION = 3;
export const CANCELLATION_TERMS_SUMMARY = 'Pasal 9 mengatur larangan pengunduran diri atau pembatalan selama 90 hari sejak penandatanganan. Seluruh dana yang telah disetor dinyatakan hangus jika jaminan tidak disetor tepat waktu, atau jika sudah menang lelang tetapi tidak melunasi paling lambat H+5 (lima hari kerja) dari tanggal lelang.';
// Scheduling remains available on request; it is conditional on the auction.
// This is the order of explanation, not the order of executing the SOP.
export const EXPLANATION_TOPICS = ['dp', 'account', 'deposit', 'bidding', 'won', 'possession', 'refund'];
export const closingStage = (topic) => ({ stock: 0, stock_sold: 0, clarify: 0, mou: 1, dp: 1, purchase_preparation: 1, schedule: 2, account: 3, deposit: 3, bidding: 4, won: 5, possession: 5, refund: 6, readiness: 0 })[topic];
const normalize = (text = '') => text.normalize('NFKC').toLowerCase()
  .replace(/\b(mou|dp|jadwal|tanggal|akun|bidding|bidder|penawaran|jaminan)(?:nya|kah)\b/g, '$1')
  .replace(/\s+/g, ' ').trim();
const refusal = /\b(?:tidak|nggak|enggak|gak|ga|belum|jangan|batal)\b/;
const affirmative = /^(?:(?:ya|iya|iya deh|oke|ok|baik|siap|sip|boleh|setuju|lanjut|lanjutkan|terus|silakan|silahkan|mau)(?:\s+(?:lanjut|pak|bu|kak|ya|dong|aja|saja))?[\s,.!]*)+$/;
// A negative answer to "any questions?" closes that discussion; it does not
// reject the purchase. Match the entire message so "tidak ada dana" stays out.
const noQuestions = /^(?:(?:tidak|tdk|nggak|ngga|enggak|gak|ga)\s+ada(?:\s+(?:lagi|pertanyaan(?:\s+lagi)?|yang (?:ingin|mau|perlu) (?:saya )?(?:tanyakan|ditanyakan)))?|(?:sudah|udah)\s+(?:cukup\s+)?jelas)(?:[\s,.!]*(?:pak|bu|kak|ya|terima kasih|makasih))*[\s,.!]*$/;
const uncertainty = /\b(?:belum|kurang|tidak|nggak|enggak|gak|ga)\s+(?:cukup\s+)?(?:jelas|paham|mengerti|ngerti)\b|\b(?:bingung|ragu|takut)\b/;
const needsTime = /\b(?:pikir(?:kan)?|pertimbangkan|nanti dulu|tunggu dulu|butuh waktu|jangan dulu|belum dulu|belum yakin|belum mantap)\b/;
const confirmsUnderstanding = (value) => !refusal.test(value) && !uncertainty.test(value) && !needsTime.test(value) &&
  !/[?？]/.test(value) && !/\b(?:kalau|jika|seandainya|misal|mungkin|apakah)\b/.test(value) &&
  /\b(?:sudah|udah|sudah cukup|udah cukup|semua(?:nya)?|semuanya sudah|semua sudah|semuanya udah|semua udah)\s+(?:jelas|paham|mengerti|ngerti)\b|\b(?:jelas|paham|mengerti|ngerti)\s+(?:semua(?:nya)?|seluruhnya)\b/.test(value);
export const readyForMou = (conversion) => conversion?.process_understood === true && ['available', 'not_required'].includes(conversion.stock_status) &&
  (conversion.whole_process_confirmed === true || EXPLANATION_TOPICS.every((topic) => conversion.explained_topics?.includes(topic)));

export function detectClosingIntent(text, { selectedAssetId = null, history = [] } = {}) {
  const value = normalize(text);
  if (refusal.test(value) || requestsClosingExit(text)) return false;
  if (/\b(?:di|daerah|kawasan|area)\s+[\p{L}]/u.test(value) && !/\b(?:ini|itu|tersebut)\b/.test(value)) return false;
  // Interest in an area or in seeing details is still search, not purchase intent.
  if (/\b(?:langkah(?:nya)?|prosedur(?:nya)?|proses(?:nya)?|cara(?:nya)?)\s+(?:selanjutnya\s+)?(?:gimana|bagaimana|apa)\b/.test(value)) return true;
  // A question or hesitation is not a declaration of readiness, even when the
  // customer mentions the selected property explicitly.
  if (/[?？]/.test(value) || uncertainty.test(value) || needsTime.test(value) ||
      /\b(?:kalau|jika|seandainya|misal(?:nya)?|mungkin|apakah)\b/.test(value)) return false;
  const explicit = /\b(?:saya|aku|kami)\s+(?:(?:sudah|udah|mau|ingin|jadi|tertarik)\s+)?(?:serius|cocok|ambil|beli|membeli|lanjut(?:kan)?)\b/.test(value) &&
      /\b(?:aset|unit|properti|rumah|ini|itu|pembelian|lelang)\b/.test(value) ||
    /\b(?:mau|ingin|siap)\s+(?:ikut\s+lelang|proses\s+(?:beli|pembelian))\b/.test(value);
  if (explicit) return true;
  // A selected ID comes from server conversation state / fresh catalog data.
  // A list alone must not turn a vague "tertarik" into a choice of an old asset.
  if (!selectedAssetId) return false;
  const latest = history.findLast((item) => item.role === 'assistant')?.content || '';
  if (/Lihat detail:/i.test(latest) || /^[ \t]*(?:[•*-]|\d+\\?[.)])\s+\*{0,2}Kode\s*[:#-]?\s*\d+/mi.test(latest)) return false;
  if (requestsMouDocument(text)) return true;
  // Salutations may occur anywhere ("oke pak, saya serius", "saya, Pak,
  // serius"). Normalize them only for intent matching, not stored messages.
  const plain = value.replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(?:pak|bu|bapak|ibu|kak|mas|mbak|bang)\b/g, ' ').replace(/\bsy\b/g, 'saya')
    .replace(/\s+/g, ' ').trim();
  const lead = '(?:(?:wow|wah|wih|oh|hmm+|oke|ok|iya|ya|baik|sip|mantap|fix|deal)\\s+){0,8}';
  const buyer = '(?:(?:saya|aku|kami)\\s+)?';
  const property = '(?:\\s+(?:(?:dengan|sama|pada)\\s+)?(?:(?:aset|unit|properti|rumah)(?:nya)?(?:\\s+(?:yang\\s+)?(?:ini|itu|tersebut|tadi))?|yang\\s+(?:ini|itu|tersebut|tadi)))?';
  const tail = '(?:\\s+(?:nih|deh|sih|ya|banget|sekali|aja|saja))*';
  const interest = '(?:(?:jadi|sudah|udah|cukup|sangat|semakin|makin|memang|benar(?: benar)?|bener(?: bener)?)\\s+){0,2}(?:tertarik|berminat|minat|cocok|menarik|serius)';
  // Bare "lanjut" already asks for the next search results outside closing.
  // A desire/subject makes the purchase continuation explicit in this context.
  const action = '(?:lanjut(?:kan)?|ambil|beli|proses(?:kan)?)(?:\\s+(?:proses(?:nya)?|pembelian))?';
  const proceed = `(?:(?:(?:saya|aku|kami)\\s+)?(?:mau|ingin|siap|jadi|fix)\\s+|(?:saya|aku|kami)\\s+)${action}`;
  const readiness = '(?:(?:saya|aku|kami)\\s+(?:(?:sudah|udah)\\s+)?|(?:sudah|udah)\\s+)(?:mantap|yakin)';
  const continuation = `(?:\\s+(?:dan\\s+)?(?:mau|ingin|siap)\\s+${action})?`;
  // Match the whole message: interest with a question, a condition, or a new
  // requirement is handled as that request instead of becoming purchase consent.
  return new RegExp(`^${lead}(?:${buyer}${interest}${continuation}|${readiness}${continuation}|${proceed})${property}${tail}$`, 'i').test(plain);
}

export function requestsClosingExit(text) {
  return /\b(?:batal|batalkan|berhenti|tidak jadi|nggak jadi|gak jadi|belum mau lanjut)\b/.test(normalize(text)) ||
    /\b(?:cari(?:kan)?|mencari|lihat|pilih)\b.*\b(?:lain|alternatif|lagi|di\s+\S+)\b|\b(?:ada|adakah)\s+yang\s+lain\b/.test(normalize(text));
}

export function requestsMouDocument(text = '') {
  return !/\b(?:jangan|tidak|gak|nggak|belum)\b/i.test(text) &&
    /\b(?:kirim(?:kan)?|minta|lihat|buka|boleh|mana|unduh|download|pelajari)\b.*\b(?:pdf|mou|draf|draft|perjanjian)\b|\b(?:pdf|mou|draf|draft|perjanjian)(?:nya)?\b.*\b(?:kirim|mana|lihat|pelajari|dong)\b/i.test(text);
}

export function isClosingTurnText(text) {
  const value = normalize(text);
  return detectClosingIntent(text) || affirmative.test(value) || noQuestions.test(value) ||
    /\b(?:mou|dp|uang muka|refund|kalah|menang|ragu|takut|risiko|resiko|jaminan|jadwal|akun|ktp|buku tabungan|virtual account|mandiri|bidding|bidder|mentok|lanjut|berikutnya|dokumen|balik nama|mediasi|eksekusi|pengosongan|jelas|paham|mengerti|ngerti)\b/.test(value);
}

export function closingDp(basePrice) {
  if (!Number.isFinite(basePrice) || basePrice <= 0 || basePrice > 1e15) return null;
  return Math.min(20_000_000, Math.round(basePrice / 10));
}

export const searchConversion = () => ({ mode: SEARCH_STATE });

// Pure conversational cursor. Consent advances an explanation, never a payment,
// signature, account creation, auction result, or real-world operation.
export function closingStockStatus(asset, check, now = Date.now()) {
  const at = Date.parse(asset?.auction_at);
  if (Number.isFinite(at) && at > now) return 'not_required';
  const confirmed = check?.stock_confirmation;
  if (Number.isFinite(at) && check?.external_check_performed === true && confirmed?.asset_id === asset.id &&
      Date.parse(confirmed.auction_at) === at && Number.isSafeInteger(confirmed.confirmed_at) &&
      confirmed.confirmed_at <= now && confirmed.confirmed_at > Math.max(at, now - 86400000) &&
      ['available', 'sold'].includes(confirmed.result)) return confirmed.result;
  return 'pending';
}

export function defaultClosingAction(topic, conversion) {
  return { stock: 'explain_dp', stock_sold: 'ask_alternatives', clarify: 'ask_question', purchase_preparation: 'ask_question',
    dp: 'explain_account',
    schedule: conversion.stock_status === 'pending' ? 'ask_question' : 'explain_account',
    account: 'explain_deposit', deposit: 'explain_bidding',
    bidding: conversion.max_bid ? 'explain_won' : 'capture_bid_limit',
    won: 'explain_possession', possession: 'explain_refund', refund: 'explain_readiness',
    readiness: 'confirm_understanding', mou: readyForMou(conversion) ? 'handoff_agreement' : 'ask_question' }[topic] || 'ask_question';
}

export function planClosingTurn({ conversion, asset, text, searching = false, allowOutcomeOnly = true, check, now = Date.now(), history = [] }) {
  const value = normalize(text), active = conversion?.mode === CLOSING_STATE;
  const interested = detectClosingIntent(text, { selectedAssetId: asset?.id, history });
  if (requestsClosingExit(text) || searching && !interested || active && asset && asset.id !== conversion.asset_id) {
    if (!interested) return { conversion: searchConversion() };
    conversion = null;
  }
  if (!active && !interested) return null;
  // A won lot may disappear from public stock. Its trusted outcome still
  // supports aftercare, without recovering prices/details from stale history.
  if (!asset && active && conversion?.outcome && !searching && allowOutcomeOnly) asset = { id: conversion.asset_id, transaction_type: 'LELANG' };
  if (!asset) return interested || active ? { conversion: searchConversion(),
    reply: 'Boleh, saya bantu langkah awalnya. Aset yang ingin dilanjutkan kode atau link-nya yang mana?' } : null;
  if (propertyTransactionType(asset) !== 'LELANG') return { conversion: searchConversion() };
  const continuing = conversion?.mode === CLOSING_STATE && conversion.asset_id === asset.id;
  let current = continuing ? conversion : {
    mode: CLOSING_STATE, asset_id: asset.id, topic: 'dp', stage: 1, max_bid: null,
    last_topic: null, outcome: null, outcome_event: null, version: 0,
  };
  const stock = closingStockStatus(asset, check, now);
  const previousTopic = current.topic;
  const legacyQuestion = current.pending_question || history.findLast((item) => item.role === 'assistant')?.content || '';
  const previousAction = current.pending_action || (/\bada\b[^?]{0,120}\b(?:ditanyakan|pertanyaan|dipastikan|mengganjal)\b|sudah (?:cukup )?jelas\?/i.test(legacyQuestion) ? 'ask_question' : null);
  if (current.flow_version !== CLOSING_FLOW_VERSION) current = { ...current,
    flow_version: CLOSING_FLOW_VERSION, phase: current.outcome ? 'aftercare' : stock === 'pending' ? 'awaiting_stock' : 'explanation',
    explained_topics: [], process_understood: false,
    ...(!current.outcome ? { topic: stock === 'pending' ? 'stock' : 'dp', last_topic: null } : {}),
  };
  const next = { ...current, stock_status: stock, explained_topics: [...current.explained_topics], version: current.version + 1 };
  if (uncertainty.test(value) || needsTime.test(value)) next.process_understood = false;
  if (!refusal.test(value) && (current.last_topic === 'bidding' || /\b(?:harga mentok|batas penawaran|maksimal penawaran)\b/.test(value))) {
    const amount = parseBudgetAmounts(normalizeBuyerQuantities(value));
    if (amount?.max_price && !/\b(?:dp|uang muka|jaminan|luas)\b/.test(value)) next.max_bid = amount.max_price;
  }
  let topic = current.topic;
  const amount = !refusal.test(value) && current.last_topic === 'bidding' ? parseBudgetAmounts(normalizeBuyerQuantities(value)) : null;
  const refundQuestion = /\b(?:refund|kalah|ragu|takut|risiko|resiko|uang kembali|uang balik|jaminan kembali)\b/.test(value);
  const direct = refundQuestion ? 'refund' : /\b(?:dp|uang muka)\b/.test(value) ? 'dp'
    : /\b(?:mou)\b/.test(value) ? 'mou' : /\b(?:stok|terjual|ketersediaan)\b/.test(value) ? 'stock'
      : /\b(?:jadwal|tanggal|lelang ulang|retender)\b/.test(value) ? 'schedule'
        : /\b(?:virtual account|va|mandiri|uang jaminan|setoran jaminan|bayar jaminan)\b/.test(value) ? 'deposit'
          : /\b(?:akun|pendaftaran|ktp|buku tabungan)\b/.test(value) ? 'account'
            : /\b(?:mediasi|eksekusi|pengosongan|debitur)\b/.test(value) ? 'possession'
              : /\b(?:bidding|bidder|mentok|penawaran)\b/.test(value) ? 'bidding'
                : /\b(?:menang|dokumen|balik nama)\b/.test(value) ? 'won' : null;
  const remaining = EXPLANATION_TOPICS.filter((item) => !current.explained_topics.includes(item));
  const consenting = affirmative.test(value);
  const questionsAnswered = previousAction === 'ask_question' && noQuestions.test(value);
  if (!next.outcome && previousAction === 'handoff_agreement' && readyForMou(next) && consenting) {
    return { asset, topic: 'mou', stage: 1, action: 'handoff', conversion: { ...next, phase: 'handoff' },
      reply: 'Siap, saya teruskan ke tim Solusindo Premier untuk membantu menyiapkan draf kesepakatan dan memastikan ketentuan DP aset ini. Silakan dipelajari bersama tim sebelum memutuskan tanda tangan atau pembayaran.' };
  }
  if (!next.outcome && stock === 'sold' && previousAction === 'ask_alternatives' && affirmative.test(value)) {
    return { conversion: searchConversion(), reply: 'Siap, saya bantu carikan alternatifnya. Di daerah mana Anda ingin mencari aset pengganti?' };
  }
  if (next.outcome) {
    if (consenting && previousAction === 'ask_question') topic = 'clarify';
    else if (next.outcome === 'won' && (direct === 'possession' || consenting && previousAction === 'explain_possession')) topic = 'possession';
    else topic = next.outcome === 'won' ? 'won' : 'refund';
  }
  else if (stock === 'sold') topic = 'stock_sold';
  else if (stock === 'pending' && /\b(?:bayar|transfer|setor|siap dp|mau dp)\b/.test(value) && /\bdp\b/.test(value)) topic = 'stock';
  else if (direct && direct !== 'mou') topic = direct;
  else if (stock !== 'pending' && confirmsUnderstanding(value) &&
      (!remaining.length || current.whole_process_confirmed === true || /\b(?:semua(?:nya)?|seluruh|alur(?:nya)?|proses(?:nya)?)\b/.test(value))) {
    next.process_understood = true;
    next.whole_process_confirmed = true;
    topic = 'mou'; next.topic = topic;
  } else if (direct === 'mou') {
    // An early MOU question gets an explanation, never an invitation to sign.
    topic = 'mou';
  } else if (questionsAnswered) {
    // Continue the explanation from the discussion just closed, including
    // persisted sessions whose previous DP CTA still invited questions.
    const discussed = current.topic === 'clarify' ? current.explained_topics.at(-1) || 'stock' : current.topic;
    const continuation = defaultClosingAction(discussed, next);
    if (continuation.startsWith('explain_')) topic = continuation.slice(8);
    else if (continuation === 'capture_bid_limit' || continuation === 'confirm_bid_limit') topic = 'bidding';
    else topic = 'readiness';
  } else if (continuing && !refusal.test(value) && (affirmative.test(value) || confirmsUnderstanding(value))) {
    // Consent refers to the CTA actually delivered, not the next item in a list.
    if (stock !== 'pending' && ['stock', 'clarify'].includes(previousTopic)) topic = 'dp';
    else if (previousAction === 'explain_readiness') topic = remaining[0] || 'readiness';
    else if (previousAction?.startsWith('explain_')) topic = previousAction.slice(8);
    else if (previousAction === 'confirm_bid_limit' && next.max_bid) { next.bid_limit_confirmed = true; topic = 'won'; }
    else if (previousAction === 'capture_bid_limit') topic = 'bidding';
    else topic = current.topic === 'readiness' ? 'readiness' : 'clarify';
  } else if (amount?.max_price && previousAction === 'capture_bid_limit') {
    topic = 'bidding';
  } else if (interested && continuing) {
    topic = stock === 'pending' ? 'stock' : readyForMou(current) ? 'mou' : remaining[0] || 'readiness';
  }
  if (stock === 'pending' && topic === 'readiness') topic = 'stock';
  // Preparation has its own planner/copy. Unmatched follow-ups are clarified
  // here rather than requesting an undefined legacy SOP response.
  if (topic === 'purchase_preparation') topic = 'clarify';
  // Record only what this response explains, never what a user/model claims
  // was already explained. The caller commits this plan after delivery.
  if (EXPLANATION_TOPICS.includes(topic) && !next.explained_topics.includes(topic)) next.explained_topics.push(topic);
  next.topic = topic;
  next.stage = closingStage(topic);
  next.phase = next.outcome ? 'aftercare' : stock === 'sold' ? 'unavailable' : stock === 'pending' ? 'awaiting_stock' : topic === 'mou' && readyForMou(next) ? 'agreement'
    : topic === 'readiness' ? 'ready_check' : 'explanation';
  next.pending_action = defaultClosingAction(topic, next);
  next.last_topic = topic;
  return { conversion: next, topic, stage: closingStage(topic), asset,
    ...(questionsAnswered ? { acknowledge_no_questions: true } : {}) };
}

// Called only through the authenticated operator API, never from user text/LLM.
export function applyClosingOutcome(conversion, event) {
  if (!event || Array.isArray(event) || Object.keys(event).some((key) => !['event_id', 'asset_id', 'outcome', 'reference'].includes(key)) ||
      typeof event.event_id !== 'string' || !/^[\w-]{8,100}$/.test(event.event_id) ||
      typeof event.asset_id !== 'string' || !event.asset_id || event.asset_id.length > 100 ||
      !['won', 'lost'].includes(event.outcome) || typeof event.reference !== 'string' ||
      !event.reference.trim() || event.reference.length > 200) throw new ServiceError('INVALID_CLOSING_EVENT', 400);
  if (conversion?.mode !== CLOSING_STATE || conversion.asset_id !== event.asset_id) throw new ServiceError('CLOSING_ASSET_MISMATCH', 409);
  if (conversion.outcome_event?.event_id === event.event_id) {
    if (['event_id', 'asset_id', 'outcome', 'reference'].some((key) => conversion.outcome_event[key] !== event[key])) throw new ServiceError('CLOSING_EVENT_CONFLICT', 409);
    return conversion;
  }
  if (conversion.outcome) throw new ServiceError('CLOSING_OUTCOME_ALREADY_SET', 409);
  const topic = event.outcome === 'won' ? 'won' : 'refund';
  return { ...conversion, outcome: event.outcome, outcome_event: { ...event }, topic,
    phase: 'aftercare', stage: closingStage(topic), last_topic: null, version: conversion.version + 1 };
}
