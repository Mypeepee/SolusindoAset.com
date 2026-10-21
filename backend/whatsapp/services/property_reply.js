import { assetFacts } from './catalog.js';
import { parsePropertyInquiry } from './property_inquiry.js';
import { buyerContext, explicitAsset } from './buyer_profile.js';
import { needsAuctionCheck, auctionCheckExplained, auctionCheckReply, isAuctionScheduleQuestion, auctionScheduleReply, requestAuctionCheck, unsupportedAuctionCheckClaim } from './auction_check.js';
import { recommendationIds, recommendationMessages } from './recommendations.js';
import { selectedRecommendation, isRecommendationList, AMBIGUOUS_SELECTION_REPLY, INVALID_SELECTION_REPLY, MISSING_SELECTION_REPLY } from './property_selection.js';
import { purchaseCostReply, isPurchaseCostQuestion } from './property_costs.js';
import { propertyDetailsReply, requestsPropertyDetails } from './property_details.js';
import { CLARIFY_PROPERTY_MESSAGE, searchReply } from './search_reply.js';
import { CONTEXT_REQUIRED_MESSAGE, HANDOVER_MESSAGE, interactionDecision, historyPolicy, requestsPropertySearch, hasPropertyReference } from './interaction_policy.js';
import { requestsAlternatives } from './conversation_references.js';
import { shouldInterpretBuyer } from './buyer_interpreter.js';
import { UNDERSTANDING_VERSION } from './buyer_turn.js';
import { clientIntroductionTurn, clientIdentity, clientLabel, splitClientIntroduction, personalizeClientReply, inviteSearchIntroduction } from './client_identity.js';
import { normalizeBuyerLanguage } from './buyer_language.js';
import { CLOSING_STATE, detectClosingIntent, requestsClosingExit, planClosingTurn } from './closing_state.js';
import { replyFromClosingPlan } from './closing_controller.js';
import { planPurchaseIntake, isPurchasePreparationText } from './purchase_intake.js';
import { shouldParseSmartSearch, applyDiscovery, discoverySnapshot, discoveryQuestionReply } from './smart_search_parser.js';
import { assetConsultationTurn, isVisitRequest, isConditionQuestion } from './asset_consultation.js';
import { previewSurveys } from './survey_booking.js';

export const PRIVACY_REPLY = 'Saya hanya dapat membantu dengan informasi properti yang ditayangkan untuk calon pembeli. Data akun, password, rekening, identitas pribadi, serta keuangan internal perusahaan tidak tersedia melalui chatbot.\n\nProperti atau kode aset mana yang ingin Bapak/Ibu ketahui?';

export function isPrivateRequest(text, conversion = null) {
  if (isPurchasePreparationText(text, conversion)) return false;
  // Explain required document types/payment routing without exposing any
  // person's documents, credentials, or bank details. Actual identifiers stay out.
  const requirementsQuestion = !/\d{8,}/.test(text) && /\b(?:akun|pendaftaran|jaminan|refund|pengembalian)\b/i.test(text) &&
    /\b(?:apa|bagaimana|gimana|perlu|butuh|syarat|persyaratan|pakai|memakai|menggunakan|atas nama|siapkan)\b/i.test(text) &&
    !/\b(?:berikan|tampilkan|bocorkan|salin|ekspor|dump|saldo|riwayat|nomor rekening)\b/i.test(text);
  if (requirementsQuestion) text = text.replace(/\b(?:ktp|npwp|nik|otp|password|rekening)\b/gi, '');
  return /\b(password|kata[\s_-]?sandi|api[\s_-]?key|access[\s_-]?token|database_url|connection[\s_-]?string|private[\s_-]?key|otp|npwp|nik|ktp|system[\s_-]?prompt)\b|\b(keuangan|saldo|rekening|arus\s*kas|laba|om[sz]et|gaji|komisi)\b[\s\S]{0,90}\b(perusahaan|internal|agent|agen|karyawan|jason|solusindo)\b|\b(perusahaan|internal|karyawan)\b[\s\S]{0,90}\b(keuangan|saldo|rekening|arus\s*kas|laba|gaji|om[sz]et)\b|\b(?:dump|export|ekspor|seluruh|semua)\b[\s\S]{0,50}\b(?:database|tabel|pengguna|klien|pelanggan)\b|\bselect\s+.+\s+from\b/i.test(text);
}

export const publicConversationHistory = (history) => history.filter((item) =>
  !(item.role === 'user' && isPrivateRequest(item.content)) && item.content !== PRIVACY_REPLY);

// Browsing a recommendation changes the selected asset, not the buyer's
// search. Keep qualification turns across details/costs, and mask the copied
// address or ordinal so it cannot become a new geographic/budget preference.
// A genuinely unrelated code starts a separate asset consultation.
function retainedSearchHistory(history) {
  let start = 0, sourceId = null, currentId = null;
  const known = new Set(), selections = new Set();
  for (const [index, item] of history.entries()) {
    if (item.role === 'assistant') {
      if (isRecommendationList(item.content)) for (const id of recommendationIds(item.content)) known.add(id);
      continue;
    }
    const selected = selectedRecommendation(item.content, history.slice(0, index));
    if (selected) {
      selections.add(index);
      if (selected.id) currentId = selected.id;
      continue;
    }
    if (!explicitAsset(item.content, history[index - 1]) && !/\b[A-Z]{2,10}-\d{2,10}\b/.test(item.content)) continue;
    const plain = normalizeBuyerLanguage(item.content).replace(/\*/g, '');
    const ids = new Set(recommendationIds(plain));
    for (const match of plain.matchAll(/(?:\b(?:kode|id|aset|properti)\s*[:#-]?\s*|#)([1-9]\d{0,17})\b/gi)) ids.add(match[1]);
    const bare = /^\s*([1-9]\d{0,17})\s*$/.exec(plain);
    if (bare) ids.add(bare[1]);
    if (!ids.size || [...ids].some((id) => id !== currentId && !known.has(id))) {
      start = index; sourceId = ids.size === 1 ? [...ids][0] : null;
      known.clear();
    }
    currentId = ids.size === 1 ? [...ids][0] : null;
    selections.add(index);
  }
  return { sourceId, assetId: currentId, history: history.slice(start).map((item, offset) => selections.has(start + offset) ? { ...item, content: '' } : item) };
}

// Recover a pointer from the client's own code/link or explicit card choice.
// Listing facts are still re-read; a later property search supersedes the unit.
export function selectedAssetIdFromHistory(history) {
  const safe = publicConversationHistory(history);
  const lastSelection = safe.findLastIndex((item, index) => item.role === 'user' &&
    (explicitAsset(item.content, safe[index - 1]) || /\b[A-Z]{2,10}-\d{2,10}\b/.test(item.content) || selectedRecommendation(item.content, safe.slice(0, index))?.id));
  const lastSearch = safe.findLastIndex((item) => item.role === 'user' && requestsPropertySearch(item.content));
  return lastSelection >= 0 && lastSearch <= lastSelection ? retainedSearchHistory(safe).assetId : null;
}

function excludedRecommendations(history, text, originalId, state) {
  const excluded = new Set([...(originalId ? [originalId] : []), ...(state?.notification_search ? state.offered_ids || [] : [])]);
  const shown = new Set();
  const conversation = history.at(-1)?.role === 'user' && history.at(-1).content === text ? history : [...history, { role: 'user', content: text }];
  for (const item of conversation) {
    if (item.role === 'assistant' && isRecommendationList(item.content)) for (const id of recommendationIds(item.content)) shown.add(id);
    if (item.role === 'user' && requestsAlternatives(item.content)) for (const id of shown) excluded.add(id);
  }
  // The retained conversation is bounded to twelve user turns / five cards.
  // IDs are exclusion pointers only, never trusted property facts.
  return [...excluded].slice(-64);
}

export async function resolvePropertyContext(catalog, text, previousId, history = [], now = Date.now(), signal, preferenceState = null, conversion = null, ai = null, consultationState = null) {
  if (!previousId && !hasPropertyReference(text) && !requestsPropertySearch(text)) previousId = selectedAssetIdFromHistory(history);
  const memory = retainedSearchHistory(publicConversationHistory(history));
  const continuation = explicitAsset(text, history.findLast((item) => item.role === 'assistant')) && memory.sourceId ? null : preferenceState;
  let buyer = buyerContext(memory.history, text, previousId, { continuation });
  // Local rules extract known expressions first. The LLM receives every retained
  // turn plus the structured memory, and can only propose a validated delta.
  let parsed = null;
  if (shouldParseSmartSearch(text, buyer) && typeof ai?.parseSearch === 'function') {
    try { parsed = await ai.parseSearch({ text, history: publicConversationHistory(history), buyer, signal }); }
    catch (error) { if (signal?.aborted) throw error; }
  }
  const understood = (value) => {
    const patch = parsed?.patch;
    if (!patch || !Object.keys(patch).length) return value;
    applyDiscovery(value.profile, patch);
    const locationChanged = !!(patch.locations?.length || patch.cities?.length || patch.route_landmarks?.length || patch.location_operation === 'clear');
    if (locationChanged) {
      value.region_clarification = null; value.city_scope = null;
      Object.assign(value.continuation, { regionClarification: null, cityScope: null, requestedArea: null, villageAnswered: true, cityFromBuyer: true, nearbyError: false });
    }
    if (patch.categories?.length) value.continuation.categoryAnswered = true;
    if (patch.min_land_area_m2 != null || patch.max_land_area_m2 != null) value.continuation.landAreaAnswered = true;
    value.missing = value.missing.filter((field) => !(locationChanged && ['region', 'nearby_radius'].includes(field)) &&
      !(field === 'city' && (value.profile.city || value.profile.cities?.length)) && !(field === 'location' && value.profile.location) &&
      !(field === 'category' && value.continuation.categoryAnswered) && !(field === 'land_area' && value.continuation.landAreaAnswered) &&
      !(field === 'max_price' && value.profile.max_price));
    value.stage = value.searching ? value.missing.length ? 'qualifying' : 'recommendations' : value.stage;
    value.parsing = parsed.generation;
    return value;
  };
  buyer = understood(buyer);
  if (catalog.resolve) {
    const lookup = (...args) => {
      if (!signal) return catalog.resolve(...args);
      return catalog.resolve(args[0], args[1], args[2], { signal });
    };
    const selection = selectedRecommendation(text, history);
    const visit = consultationState?.surveyState;
    const visitInput = visit && visit.phase !== 'booked' && (!previousId || previousId === visit.asset_id) && !explicitAsset(text) && !requestsPropertySearch(text) &&
      !(selection && /\b(?:nomor|pilih|yang|opsi)\b/i.test(text));
    const informationFollowup = previousId && !explicitAsset(text, history.findLast((item) => item.role === 'assistant')) && consultationState?.consultation?.asset_id === previousId &&
      (isVisitRequest(text) || isConditionQuestion(text) || isPurchaseCostQuestion(text) || /^(?:iya|ya|boleh|oke|ok|baik|sip|monggo|nggih|iyo)[.!\s]*$/i.test(text.trim()));
    if (visitInput || informationFollowup && !selection) return { ...await lookup(`Kode ${visitInput ? visit.asset_id : previousId}`, null), buyer: { ...buyer, searching: false, stage: 'consultation' } };
    if (selection) {
      buyer = { ...buyer, searching: false, stage: 'consultation' };
      // History only supplies a pointer. Fresh DB lookup still enforces public
      // availability; assistant text never supplies trusted prices/specs.
      if (!selection.id) return { asset: null, catalog: [], status: selection.kind === 'ambiguous' ? 'ambiguous_selection' : selection.kind === 'missing' ? 'missing_selection' : 'invalid_selection', source: 'buyer_preferences', buyer };
      return { ...await lookup(`Kode ${selection.id}`, null), buyer, selected_recommendation: selection };
    }
    if (previousId && !explicitAsset(text, history.findLast((item) => item.role === 'assistant')) &&
        !requestsClosingExit(text) && (detectClosingIntent(text, { selectedAssetId: previousId, history }) || conversion?.mode === CLOSING_STATE)) {
      return { ...await lookup(`Kode ${previousId}`, null), buyer: { ...buyer, searching: false, stage: 'consultation' } };
    }
    const lastSelection = history.findLastIndex((item, index) => item.role === 'user' &&
      (hasPropertyReference(item.content) || selectedRecommendation(item.content, history.slice(0, index))));
    const lastSearch = history.findLastIndex((item) => item.role === 'user' && requestsPropertySearch(item.content));
    const explicitSearch = requestsPropertySearch(text) || lastSearch > lastSelection;
    if (previousId && !explicitAsset(text, history.findLast((item) => item.role === 'assistant'))) {
      const remembered = understood(buyerContext(memory.history, text, previousId, { forceSearch: explicitSearch, continuation }));
      if (remembered.searching && remembered.stage === 'recommendations') {
        remembered.resumed_after_detail = true;
        remembered.excluded_ids = excludedRecommendations(memory.history, text, previousId, continuation);
        const original = memory.sourceId === previousId ? await lookup(`Kode ${previousId}`, null) : null;
        const context = await lookup(text, null, { ...remembered.profile, exclude_ids: remembered.excluded_ids });
        if (context.status === 'clarify_location') { remembered.stage = 'qualifying'; remembered.missing = ['city']; }
        return { ...context, ...(original?.asset ? { asset: original.asset, checkAsset: original.asset } : {}), buyer: remembered };
      }
      const original = await lookup(`Kode ${previousId}`, null);
      if (original.asset) {
        // Only a still-public, expired auction may open backup qualification
        // through the fixed area question. Revalidate before unlocking search.
        const searchHistory = memory.history;
        const anchor = memory.sourceId && memory.sourceId !== previousId ? (await lookup(`Kode ${memory.sourceId}`, null)).asset : original.asset;
        buyer = understood(buyerContext(searchHistory, text, previousId, { forceSearch: explicitSearch, continuation,
          allowBackupPrompt: needsAuctionCheck(original.asset, now),
          seed: anchor ? { city: anchor.address?.city || null, location: anchor.address?.district || null, district: anchor.address?.district || null, village: anchor.address?.village || null, transaction_type: anchor.transaction_type || null, category: anchor.category || null } : {} }));
        if (buyer.searching) {
          buyer.backup_for = original.asset.id;
          if (buyer.stage === 'qualifying') return { ...original, catalog: [], status: 'qualifying', buyer };
          buyer.excluded_ids = excludedRecommendations(searchHistory, text, original.asset.id, continuation);
          const context = await lookup(text, null, { ...buyer.profile, exclude_ids: buyer.excluded_ids });
          if (context.status === 'clarify_location') { buyer.stage = 'qualifying'; buyer.missing = ['city']; return { ...original, catalog: [], status: 'qualifying', buyer }; }
          // Keep the source pointer through results/empty results so later
          // budget corrections retain its area and exclusion. Selecting another
          // card still replaces it via the fresh lookup above.
          return { ...context, asset: original.asset, buyer, checkAsset: original.asset };
        }
        return { ...original, catalog: [], buyer };
      }
      // A sold/withdrawn lot is not recovered from history after the fresh lookup.
      if (!original.asset) return { ...original, buyer };
    }
    if (buyer.stage === 'qualifying') return { asset: null, catalog: [], status: 'qualifying', source: 'buyer_preferences', buyer };
    const excluded = excludedRecommendations(memory.history, text, null, continuation);
    const context = await lookup(text, previousId, buyer.stage === 'recommendations' ? { ...buyer.profile, ...(excluded.length ? { exclude_ids: excluded } : {}) } : undefined);
    if (context.status === 'clarify_location') { buyer.stage = 'qualifying'; buyer.missing = ['city']; }
    return { ...context, buyer: { ...buyer, excluded_ids: excluded } };
  }
  const inquiry = parsePropertyInquiry(text);
  const asset = inquiry ? (inquiry.code ? await catalog.get(inquiry.code) : null) : await catalog.select(text, previousId);
  const publicAsset = ['sold', 'withdrawn'].includes(asset?.availability_status) ? null : asset;
  return { asset: publicAsset, catalog: requestsPropertySearch(text) ? (await catalog.list()).slice(0, 5) : [], status: publicAsset ? 'matched' : 'not_found', source: 'operator_catalog', buyer };
}

export async function replyFromPropertyContext(input) {
  const closingIntent = detectClosingIntent(input.text, { selectedAssetId: input.selectedAssetId, history: input.history });
  if ((!input.context.buyer?.searching || isVisitRequest(input.text) && !requestsPropertySearch(input.text)) && !closingIntent) {
    const consultation = await assetConsultationTurn({ asset: input.context.asset, text: input.text, consultation: input.consultation, surveyState: input.surveyState,
      identity: input.clientIdentity || clientIdentity(input.history), phone: input.phone, agentId: input.agentId, surveys: input.surveys, history: input.history, now: input.now, persistSurvey: input.persistSurvey });
    if (consultation) return { ...consultation, knowledge: { ...consultation.knowledge,
      status: needsAuctionCheck(input.context.asset, input.now) ? 'auction_check_needed' : input.context.status,
      source: input.context.source || 'verified_listing_and_visit_policy',
      ...(input.check ? { auction_check: input.check } : {}) } };
  }
  // A concrete information request still wins over a pending preparation CTA.
  // Keep the intake, but don't interpret the next acknowledgement as consent
  // to the old question after returning details or a cost breakdown.
  if (input.conversion?.purchase_intake && !input.context.buyer?.searching &&
      input.context.asset?.id === input.conversion.asset_id &&
      (isPurchaseCostQuestion(input.text) || requestsPropertyDetails(input.text))) {
    const result = await propertyContextReply(input);
    return { ...result, conversion: { ...input.conversion, topic: 'clarify', last_topic: 'clarify',
      pending_action: 'ask_question', pending_question: null, version: input.conversion.version + 1 } };
  }
  const closingInput = { conversion: input.conversion, asset: input.context.asset,
    selectedAssetId: input.selectedAssetId,
    text: input.text, searching: input.context.buyer?.searching, allowOutcomeOnly: !hasPropertyReference(input.text),
    check: input.check, now: input.now, history: input.history };
  const closing = planPurchaseIntake(closingInput) || planClosingTurn(closingInput);
  if (closing?.topic || closing?.reply) {
    const result = await replyFromClosingPlan({ ...input, plan: closing, history: publicConversationHistory(input.history) });
    return { ...result, ...(input.consultation ? { consultation: { ...input.consultation, last_offer: null } } : {}),
      ...(closingIntent ? { survey_state: null } : {}) };
  }
  const identity = input.clientIdentity || clientIdentity(input.history);
  const introduced = !!splitClientIntroduction(input.text, input.history.findLast((item) => item.role === 'assistant')?.content).update;
  const result = inviteSearchIntroduction(personalizeClientReply(await propertyContextReply({ ...input, clientIdentity: identity }), identity,
    { introduced, replaceNeutralSalutation: !!input.context.buyer?.continuation?.notification_search }), input.context.buyer, identity);
  if (closing?.conversion) result.conversion = closing.conversion;
  if (input.context.status !== 'recommendations' || !result.reply?.includes('Lihat detail:')) return result;
  const replies = recommendationMessages(result.reply);
  return replies.length > 1 ? { ...result, reply: replies[0], replies } : result;
}

async function propertyContextReply({ context, ai, text, history, qualification = {}, check = null, signal, clarify = false, clientIdentity, now = Date.now() }) {
  const expired = needsAuctionCheck(context.asset, now);
  const checkAsset = expired ? context.asset : context.checkAsset;
  const knowledge = { status: expired && !context.buyer.searching ? 'auction_check_needed' : context.status,
    source: context.source, buyer: context.buyer, client_identity: { name: clientIdentity?.name || null, salutation: clientIdentity?.salutation || null }, locked_asset_id: context.asset?.id || null, selection: context.selection, ...(checkAsset ? { auction_check: { ...(check || { status: 'unavailable', external_check_performed: false }), asset_id: checkAsset.id } } : {}) };
  const rules = (reply) => ({ reply, qualification: {}, asset: context.asset,
    generation: { mode: 'rules' }, knowledge: { status: knowledge.status, source: knowledge.source } });
  if (context.status === 'ambiguous_selection') return rules(AMBIGUOUS_SELECTION_REPLY);
  if (context.status === 'invalid_selection') return rules(INVALID_SELECTION_REPLY);
  if (context.status === 'missing_selection') return rules(MISSING_SELECTION_REPLY);
  if (context.selected_recommendation && !context.asset) return rules('Bapak/Ibu, aset yang dipilih belum ditemukan dalam listing publik terbaru. Detail dan harga sebelumnya perlu dikonfirmasi kembali kepada tim. Saya belum dapat memastikan status penjualan atau jadwal barunya.');
  if (!context.buyer.searching) {
    const introduction = splitClientIntroduction(text, history.findLast((item) => item.role === 'assistant')?.content);
    if (context.asset && introduction.update && !introduction.remaining && clientLabel(clientIdentity)) {
      return rules(`Salam kenal, ${clientLabel(clientIdentity)}. Saya bantu untuk unit *kode ${context.asset.id}*${context.asset.location ? ` di ${context.asset.location}` : ''} yang tadi Anda tanyakan ya.`);
    }
    if (isAuctionScheduleQuestion(text)) {
      const schedule = auctionScheduleReply(context.asset, check, now);
      if (schedule) return rules(schedule);
    }
  }
  // Cost requests take priority over the expired-schedule introduction. The
  // complete backend template carries its own schedule caveat and bypasses the
  // model's four-paragraph/1800-character formatter in both live and Playground.
  const costs = context.buyer.searching ? null : purchaseCostReply(context.asset, text, { now });
  if (costs) return { reply: costs, qualification: {}, asset: context.asset,
    knowledge: { status: knowledge.status, source: knowledge.source } };
  if (!context.buyer.searching && (context.selected_recommendation || requestsPropertyDetails(text))) {
    const details = propertyDetailsReply(context.asset, { now });
    if (details) return rules(details);
  }
  if (shouldInterpretBuyer(context.buyer, text) && typeof ai?.interpretBuyer === 'function') {
    try {
      const interpretation = await ai.interpretBuyer({ text, history: publicConversationHistory(history), buyer: context.buyer, signal });
      if (signal?.aborted) throw signal.reason;
      if (interpretation?.reply) return { reply: interpretation.reply, qualification: {}, asset: context.asset,
        generation: interpretation.generation || { mode: 'rules' }, knowledge: { status: 'qualifying', source: 'buyer_preferences',
          understanding: { version: UNDERSTANDING_VERSION, mode: 'awaiting_confirmation' } } };
    } catch (error) {
      if (signal?.aborted) throw error;
      // Quota, timeout, malformed JSON or missing evidence leave the known
      // profile untouched and fall back to a focused local clarification.
    }
  }
  const search = searchReply(context, now);
  // A burst can contain a question before its final criteria bubble. Answer all
  // questions received since our last reply before acknowledging the filters.
  const unanswered = history.slice(history.findLastIndex((item) => item.role === 'assistant') + 1)
    .filter((item) => item.role === 'user').map((item) => item.content).join('\n');
  const extra = discoveryQuestionReply(unanswered || text);
  if (search || extra || clarify) return { reply: [extra, search || (extra && !context.asset ? 'Kalau sudah ada kode aset atau kriteria propertinya, boleh kirim supaya saya bantu cek lebih spesifik.' : CLARIFY_PROPERTY_MESSAGE)].filter(Boolean).join('\n\n'), qualification: {}, asset: context.asset,
    generation: context.buyer?.parsing || { mode: 'rules' }, knowledge: { status: knowledge.status, source: knowledge.source,
      ...(context.buyer?.searching ? { search: discoverySnapshot(context.buyer.profile) } : {}) } };
  // A deterministic first response guarantees both possible outcomes and an
  // honest queue acknowledgement even when an LLM is unavailable.
  let relevantHistory = publicConversationHistory(history);
  if (context.asset) {
    const lastReference = relevantHistory.findLastIndex((item, index) => item.role === 'user' && (
      hasPropertyReference(item.content) && (item.content.includes(context.asset.id) || recommendationIds(item.content).includes(context.asset.id)) ||
      selectedRecommendation(item.content, relevantHistory.slice(0, index))?.id === context.asset.id));
    if (lastReference >= 0) relevantHistory = relevantHistory.slice(lastReference);
  }
  let result = expired && !context.buyer.searching && !auctionCheckExplained(history, context.asset.id)
    ? { reply: auctionCheckReply(context.asset, check), qualification: {} }
    : await ai.generate({ history: relevantHistory, facts: assetFacts(context.asset, now), catalog: context.catalog,
      qualification, userText: text, now, knowledge, signal });
  if (checkAsset && unsupportedAuctionCheckClaim(result.reply, check)) result = { ...result, reply: auctionCheckReply(checkAsset, check, { offerBackup: !auctionCheckExplained(history, checkAsset.id) }) };
  return { ...result, asset: context.asset, knowledge: { status: knowledge.status, source: knowledge.source } };
}

export async function generatePropertyReply({ catalog, ai, text, history, previousId, qualification = {}, sandbox = true, signal, policyState, surveys = sandbox ? previewSurveys : null, agentId = 'AG108', now = Date.now() }) {
  if (!previousId && !hasPropertyReference(text) && !requestsPropertySearch(text)) previousId = selectedAssetIdFromHistory(history);
  const state = policyState || historyPolicy(history);
  previousId ||= state.survey_state?.asset_id || state.consultation?.asset_id;
  const decision = interactionDecision({ text, previousId, history, state: { ...state, canScheduleVisit: !!surveys } });
  const rules = (reply, status, action = 'reply') => ({ reply, action, suppressed: reply === null, qualification: {}, asset: null, knowledge: { status, source: 'interaction_policy' } });
  if (state.is_bot_active === false) return rules(null, 'human_handoff_paused');
  if (isPrivateRequest(text, state.conversion)) return rules(state.out_of_scope_notified ? null : CONTEXT_REQUIRED_MESSAGE, state.out_of_scope_notified ? 'waiting_for_property' : 'context_required');
  if (decision === 'handoff') return rules(HANDOVER_MESSAGE, 'handover_simulated', 'handoff');
  const client = clientIntroductionTurn({ text, history, identity: state.client_identity,
    hasContext: !!previousId || !!state.buyer_state?.searchStarted || history.some((item) => item.role === 'user' && requestsPropertySearch(item.content)) });
  if (client.reply) return rules(client.reply, client.identity.asked || client.identity.name || client.identity.salutation || client.identity.declined ? 'client_identified' : 'context_required');
  if (decision === 'silent') return rules(null, 'waiting_for_property');
  if (decision === 'nudge') return rules(CONTEXT_REQUIRED_MESSAGE, 'context_required');
  const context = await resolvePropertyContext(catalog, text, previousId, history, now, signal, state.buyer_state, state.conversion, ai, { surveyState: state.survey_state, consultation: state.consultation });
  const check = await requestAuctionCheck({ asset: context.checkAsset || context.asset, sandbox, now });
  const result = await replyFromPropertyContext({ context, ai, text, history, qualification, check, now, signal,
    selectedAssetId: previousId,
    conversion: state.conversion, clarify: decision === 'clarify', clientIdentity: client.identity,
    consultation: state.consultation, surveyState: state.survey_state, surveys, agentId, phone: sandbox ? '6280000000001' : null });
  if (result.action === 'out_of_scope') return rules(state.out_of_scope_notified ? null : CONTEXT_REQUIRED_MESSAGE, state.out_of_scope_notified ? 'waiting_for_property' : 'context_required');
  return { ...result, buyer_state: context.buyer?.continuation || null };
}
