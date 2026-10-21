import { normalizeText } from '../lib/security.js';
import { explicitAsset, hasSearchIntent, hasLocationInterest, buyerContext, BACKUP_AREA_QUESTION, declinesBackupSearch } from './buyer_profile.js';
import { parsePropertyInquiry } from './property_inquiry.js';
import { isPurchaseCostQuestion } from './property_costs.js';
import { selectedRecommendation } from './property_selection.js';
import { requestsAlternatives } from './conversation_references.js';
import { normalizeBuyerLanguage, unrestrictedPreferenceAnswer } from './buyer_language.js';
import { confirmedPreferenceText } from './buyer_turn.js';
import { transactionPreference } from './property_transaction.js';
import { INTRODUCTION_MESSAGE, isClientGreeting } from './client_identity.js';
import { CLOSING_STATE, detectClosingIntent, isClosingTurnText } from './closing_state.js';
import { discoveryQuestionReply, localDiscovery } from './smart_search_parser.js';
import { localPropertyScope, propertyScopeText } from './property_scope.js';

export const CONTEXT_REQUIRED_MESSAGE = 'Halo, saya asisten virtual Solusindo Aset. Ada yang bisa saya bantu?';
export const HANDOVER_MESSAGE = 'Untuk proses lanjutan seperti jadwal survei lokasi, dokumen legalitas, dan teknis lelang, agen kami (Jason) akan segera mengambil alih chat ini dan menghubungi Bapak/Ibu secepatnya. Mohon ditunggu ya.';
export const IDLE_TIMEOUT_MS = 45 * 60000;

export function ignoredInbound(message) {
  const jid = message?.key?.remoteJid || message?.remoteJid || message?.from || '';
  return message?.isGroup === true || message?.isStatus === true || message?.isBroadcast === true || message?.broadcast === true ||
    message?.fromMe === true || message?.key?.fromMe === true || /@(?:g\.us|broadcast|newsletter)$/.test(jid);
}

export function requestsPropertySearch(text) {
  text = normalizeBuyerLanguage(text);
  if (localPropertyScope(text) === 'other') return false;
  text = propertyScopeText(text);
  const discovery = localDiscovery(text);
  return !!discovery.locations?.length || !!discovery.route_landmarks?.length || !!discovery.cities?.length || !!transactionPreference(text) || requestsAlternatives(text) || hasLocationInterest(text) ||
    /\b(?:cari(?:kan)?|mencari)\s+(?:di|daerah|kawasan|wilayah|area)\s+[\p{L}]/iu.test(text) ||
    hasSearchIntent(text) && /\b(aset|properti|property|rumah|tanah|ruko|kos|kost|toko|pabrik|gudang|apartemen|hotel|vila|villa|lelang|alternatif|pilihan lain)\b/i.test(text);
}

export function hasPropertyReference(text) {
  return explicitAsset(text) || /\b[A-Z]{2,10}-\d{2,10}\b/.test(text);
}

const handoverTriggers = [
  'minta rekening', 'mau transfer', 'ketemu agen', 'lokasi kantor', 'survei lokasi',
  'survey lokasi', 'hubungkan cs', 'bicara dengan cs', 'bicara dengan manusia',
  'hubungkan agen', 'minta agen', 'jadwal viewing', 'mau viewing', 'ingin viewing',
  'jadwalkan viewing', 'jadwalkan survei', 'atur survei', 'mau survei', 'ingin survei',
];

export function detectHandover(text, { closing = false, canScheduleVisit = false } = {}) {
  if (localPropertyScope(text) === 'other') return null;
  text = propertyScopeText(text);
  const normalized = ` ${normalizeText(text)} `;
  const trigger = handoverTriggers.find((trigger) => normalized.includes(` ${trigger} `));
  if (trigger && !(canScheduleVisit && /viewing|survei|survey/.test(trigger))) return trigger;
  if (/\b(nego(?:siasi)?|tawar|menawar|diskon|grosse)\b|\bharga\b.{0,35}\b(?:kurang(?!\s+dari)|turun|diturunkan|nego)\b|\b(?:kurangi|turunkan)\s+harga\b/i.test(text) || !canScheduleVisit && /\b(viewing|survei|survey)\b/i.test(text)) return 'negotiation_or_viewing';
  const legalPreference = /\b(?:wajib|harus|hanya|mau|pilih|syarat|legalitas|sertifikat)\b[^?\n]{0,60}\b(?:shm|hgb|shgb)\b/i.test(text) &&
    !/\b(?:asli|sengketa|cek|periksa|nomor|dokumen)\b/i.test(text);
  if (!legalPreference && !parsePropertyInquiry(text) && /\b(shm|shgb|hgb|sertifikat|akta|sengketa)|dokumen\s+(?:legalitas|legal)\b/i.test(text)) return 'specific_legal_document';
  const explainingAftercare = closing && /\b(?:kalau|jika|setelah)\s+(?:saya\s+)?menang\b|\b(?:apa|bagaimana|gimana|jelaskan)\b/i.test(text);
  if (/\b(?:ajukan|lakukan|jalankan|jadwalkan|urus)\s+(?:permohonan\s+)?(?:eksekusi|pengosongan)\b/i.test(text) ||
      /\bproses\s+(?:permohonan\s+)?(?:eksekusi|pengosongan)\b/i.test(text) && !explainingAftercare) return 'specific_legal_document';
  if (/\b(eksekusi|pengosongan)\b/i.test(text) && !isPurchaseCostQuestion(text) &&
      !explainingAftercare) return 'specific_legal_document';
  return null;
}

const propertyTopic = /\b(lelang|aset|properti|rumah|tanah|ruko|gudang|apartemen|harga|limit|luas|alamat|lokasi|letak|dekat|fasilitas|akses|jalan|jaminan|pelunasan|pendaftaran|daftar|djkn|kpknl|ketersediaan|tersedia|laku|terjual|retender|jadwal|kapan|biaya|pajak|bphtb|kondisi|penghuni|kamar|lantai|listrik|air|surat|link|tautan|foto|gambar|budget|bujet|anggaran|investasi|hunian|dihuni|ditempati|flipping|detail|prosedur|alur|syarat|persyaratan|caranya)(?:nya|kah)?\b/i;
const unrelated = /\b(cuaca|resep|politik|pemilu|presiden|bola|horoskop|zodiak|puisi|pantun|jokes?|lelucon|pacar|film|lagu|coding|javascript|python|password|otp)\b/i;
const greeting = /^(?:(?:halo|hallo|hai|hi|hello|p|ping|pagi|siang|sore|malam|selamat\s+(?:pagi|siang|sore|malam)|assalamualaikum|terima\s*kasih|makasih|thanks|oke|ok|sip|siap)[\s!.,🙏👋]*)+$/i;

export function historyPolicy(history) {
  const lastNudge = history.findLastIndex((item) => item.role === 'assistant' && [CONTEXT_REQUIRED_MESSAGE, INTRODUCTION_MESSAGE].includes(item.content));
  const lastContext = history.findLastIndex((item) => item.role === 'user' && (hasPropertyReference(item.content) || requestsPropertySearch(item.content)));
  return { out_of_scope_notified: lastNudge > lastContext,
    is_bot_active: !history.some((item) => item.role === 'assistant' && item.content.startsWith(HANDOVER_MESSAGE)) };
}

// Assistant prose alone cannot establish a property context. Unclear property
// follow-ups ask for clarification; only actual handover requests pause the bot.
export function interactionDecision({ text = '', type = 'text', previousId, history = [], state = {} }) {
  if (state.is_bot_active === false) return 'silent';
  // This gate precedes property lookup, pending survey answers and handoff.
  // A previous property conversation never authorizes answering other work.
  if (localPropertyScope(text) === 'other') return 'silent';
  text = propertyScopeText(text);
  if (text && detectHandover(text, { closing: state.conversion?.mode === CLOSING_STATE, canScheduleVisit: state.canScheduleVisit })) return 'handoff';
  if (state.canScheduleVisit && (state.survey_state && state.survey_state.phase !== 'booked' || /\b(?:viewing|survei|survey|kondisi|kondisine|bangunane|nengok|tilik|mampir|janjian)\b/i.test(text))) return 'allow';
  const nudge = () => state.out_of_scope_notified ? 'silent' : 'nudge';
  if (!['text', 'interactive', 'button'].includes(type) || !text.trim()) return 'silent';
  if (detectClosingIntent(text, { selectedAssetId: previousId || state.asset_id, history }) || state.conversion?.mode === CLOSING_STATE && isClosingTurnText(text)) return 'allow';
  if (confirmedPreferenceText(text, history.findLast((item) => item.role === 'assistant')?.content)) return 'allow';
  if (selectedRecommendation(text, history)) return 'allow';
  if (discoveryQuestionReply(text)) return 'allow';
  const activeSearch = state.buyer_state?.searchStarted || history.some((item) => item.role === 'user' && requestsPropertySearch(item.content));
  if (activeSearch && /^(?:(?:ok|oke|okay|siap|sip|baik|carikan|lanjut|pak|bu|ko|koko|ya)\s*)+[.!\s]*$/i.test(text.trim())) return 'allow';
  if (greeting.test(text.trim()) || isClientGreeting(text)) return previousId || activeSearch ? 'silent' : nudge();
  if (hasPropertyReference(text) || requestsPropertySearch(text) || parsePropertyInquiry(text)) return 'allow';
  const lastReference = history.findLastIndex((item) => item.role === 'user' && hasPropertyReference(item.content));
  const backup = previousId ? buyerContext(history.slice(Math.max(0, lastReference)), text, previousId, { allowBackupPrompt: true }) : null;
  const searching = state.buyer_state?.searchStarted || history.some((item) => item.role === 'user' && requestsPropertySearch(item.content)) || backup?.searching;
  // "Dekat lapangan bola?" is a facility question for a selected property.
  // Mixed/ambiguous topics still go through the model's semantic scope check.
  if (unrelated.test(text) && !((previousId || searching) && propertyTopic.test(text))) return 'silent';
  if (backup?.backupAccepted && backup.searching) return 'allow';
  if (previousId && declinesBackupSearch(text) && history.some((item) => item.role === 'assistant' && item.content.includes(BACKUP_AREA_QUESTION))) return 'allow';
  if (previousId || searching) {
    if (isPurchaseCostQuestion(text) || propertyTopic.test(text) || /\b(?:masih ada|di mana|dimana|brp|tinggal)\b/i.test(text) || /\b(yang|opsi|pilihan|unit)\s+(pertama|kedua|ketiga|keempat|kelima|[1-5])\b/i.test(text) ||
        /^(?:yang\s+)?(?:pertama|kedua|ketiga|keempat|kelima|[1-5])[.!]?$/i.test(text.trim())) return 'allow';
    if (searching && (/\b(juta|jt|miliar|milyar|mentok|keduanya|dua[\s-]*duanya|dua2nya|belum tahu|belum yakin|tidak tahu)\b/i.test(text) ||
        /\bkota (?:apa|mana)\b[^?]*\?/i.test(history.findLast((item) => item.role === 'assistant')?.content || ''))) return 'allow';
    return 'clarify';
  }
  return localPropertyScope(text) === 'property' && !/\b(?:ini|itu|tadi|tersebut)\b|\b\w+nya\b/i.test(text) ? 'allow' : 'silent';
}

// Use semantic understanding only where local rules have no clear answer.
// Provider failure leaves the local decision intact and never invents intent.
export async function resolveInteractionDecision(input, ai, signal) {
  const decision = interactionDecision(input);
  const { text = '', history = [], state = {}, previousId } = input;
  if (state.is_bot_active === false || !text.trim() || input.type && !['text', 'interactive', 'button'].includes(input.type) ||
      greeting.test(text.trim()) || isClientGreeting(text) || localPropertyScope(text) !== 'unknown' || decision === 'handoff' ||
      typeof ai?.classifyPropertyScope !== 'function') return decision;
  // Recognized answers already matched a specific property question locally.
  if (decision === 'allow') return decision;
  if (unrestrictedPreferenceAnswer(text) || /^(?:belum|tidak|nggak|gak|ga)\s+(?:tahu|tau|yakin|pasti)(?:\s+(?:pak|bu|ya))?$/i.test(text.trim())) return decision;
  try {
    const hasContext = !!previousId || !!state.buyer_state?.searchStarted || history.some((item) => item.role === 'user' && requestsPropertySearch(item.content));
    const scope = await ai.classifyPropertyScope({ text, history, hasContext, signal });
    if (signal?.aborted) throw signal.reason;
    if (scope === 'other') return 'silent';
    if (scope === 'property_search') return 'search';
    if (scope === 'property') return decision === 'silent' ? 'clarify' : decision;
  } catch (error) { if (signal?.aborted) throw error; }
  return decision;
}
