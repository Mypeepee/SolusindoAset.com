import { ServiceError, logFailure } from '../lib/http.js';
import { detectHandover, HANDOVER_MESSAGE } from './ai_controller.js';
import { resolvePropertyContext, selectedAssetIdFromHistory, isPrivateRequest, replyFromPropertyContext } from './property_reply.js';
import { needsAuctionCheck, requestAuctionCheck } from './auction_check.js';
import { ignoredInbound, interactionDecision, resolveInteractionDecision, CONTEXT_REQUIRED_MESSAGE, requestsPropertySearch } from './interaction_policy.js';
import { clientIntroductionTurn } from './client_identity.js';
import { ignorePropertyTurn } from './property_scope.js';
import { qualifiedClientFunnel } from './client_capture.js';
import { validPhone, validContact } from '../lib/security.js';
import { CLOSING_STATE, applyClosingOutcome, searchConversion } from './closing_state.js';
import { MouDocumentClient, shouldSendMouDocument, validatePdf, MOU_CAPTION } from './mou_document.js';
import { isPurchaseDocumentSubmission, purchaseHandoffText } from './purchase_intake.js';
import { recommendationPreference } from './new_property_notifications.js';
import { offeredPropertyIds, savedRecommendationSearch } from './recommendation_policy.js';
import { recommendationIds, withPresentingAgent } from './recommendations.js';
import { isRecommendationList } from './property_selection.js';
import { SurveyBookingClient } from './survey_booking.js';
import { DEFAULT_BOT_CONTROL_PHONE, parseBotControlCommand, botControlHelp } from './bot_control.js';

const DAY = 24 * 3600000;
const FALLBACK = 'Maaf, layanan analisis sedang terkendala. Silakan coba lagi sebentar, atau ketik "hubungkan CS" agar dibantu Senior Agent kami.';

export class MessageProcessor {
  constructor({ config, store, ai, whatsapp, catalog, checks, clients, recommendationPreferences, documents, surveys, agentId, logger = console, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
    Object.assign(this, { config, store, ai, whatsapp, catalog, checks, clients, recommendationPreferences, logger, now });
    this.documents = documents || (config.mouDocument ? new MouDocumentClient(config.mouDocument) : null);
    this.surveys = surveys || (config.surveyBooking ? new SurveyBookingClient(config.surveyBooking) : null);
    this.agentId = agentId;
    this.botControlPhone = config.botControlPhone || DEFAULT_BOT_CONTROL_PHONE;
    this.sleep = sleep;
    this.tails = new Map();
    this.pendingByPhone = new Map();
    this.propertyLookups = new Map();
    this.pending = 0;
    this.accepting = true;
  }

  contactAliases(phone) {
    const aliases = new Set([phone, ...(this.whatsapp.getContactAliases?.(phone) || [])]);
    const actual = this.whatsapp.getContactPhone?.(phone) || (validPhone(phone) ? phone : null);
    if (actual) aliases.add(actual);
    for (const session of this.store.sessions.values()) {
      if (!aliases.has(session.phone) && (!actual || this.whatsapp.getContactPhone?.(session.phone) !== actual)) continue;
      aliases.add(session.phone);
      for (const alias of this.whatsapp.getContactAliases?.(session.phone) || []) aliases.add(alias);
    }
    return [...aliases].filter(validContact);
  }

  blockedContact(phone) {
    const actual = this.whatsapp.getContactPhone?.(phone) || phone;
    if (actual === this.botControlPhone) return 'bot_control_contact';
    if (this.config.stokerPhone && actual === this.config.stokerPhone && actual !== this.config.testClientPhone) return 'internal_stock_contact';
    if (actual === this.whatsapp.getStatus?.().phone) return 'connected_account';
    return null;
  }

  ownership(phone) {
    const rows = [];
    const aliases = this.contactAliases(phone);
    const resumedAt = Math.max(0, ...aliases.map((alias) => this.store.control?.getResumeAt?.(alias) || this.store.get(alias)?.bot_resumed_at || 0));
    for (const alias of aliases) {
      const persisted = this.store.control?.get(alias);
      const session = this.store.get(alias);
      if (persisted && persisted.at >= resumedAt) rows.push(persisted);
      else if (!persisted && session && !session.is_bot_active && session.handover?.at >= resumedAt) rows.push(session.handover);
    }
    // A timed manual pause must never displace an explicit/handover lock.
    return rows.sort((a, b) => Number(a.resume_at != null) - Number(b.resume_at != null) || b.at - a.at)[0] || null;
  }

  listConversations() {
    const contacts = new Set([...(this.store.control?.list() || []).map((row) => row.contact), ...this.store.sessions.keys()]);
    const items = new Map();
    for (const key of contacts) {
      const aliases = this.contactAliases(key);
      const contact = this.whatsapp.getContactPhone?.(key) || aliases.find(validPhone) || key;
      const sessions = aliases.map((alias) => this.store.get(alias)).filter(Boolean);
      const ownership = this.ownership(key), blocked = this.blockedContact(key);
      const expired = ownership?.resume_at != null && ownership.resume_at <= this.now();
      const active = !ownership || expired;
      const pending = sessions.some((s) => s.pending_reply?.expires_at > this.now());
      const processing = aliases.some((alias) => this.pendingByPhone.has(alias));
      const failure = sessions.find((s) => s.delivery_error)?.delivery_error;
      items.set(contact, { contact, is_bot_active: active && !blocked,
        updated_at: ownership?.at || Math.max(0, ...sessions.map((s) => s.updated_at)),
        reason: blocked || (expired ? null : ownership?.reason) || null,
        resume_at: !expired ? ownership?.resume_at ?? null : null, pending_reply: pending,
        blocked_reason: blocked,
        reply_state: blocked ? 'excluded' : !active ? ownership.resume_at != null ? 'manual_temporary' : 'paused'
          : processing ? 'processing' : failure ? 'delivery_failed' : pending ? 'waiting_connection' : 'ready',
        delivery_error: failure?.code || null });
    }
    const rows = [...items.values()];
    return { total: rows.length, attention: rows.filter((row) => !row.is_bot_active && !row.blocked_reason).length,
      server_now: this.now(), manual_pause_seconds: (this.config.manualReplyPauseMs ?? 300000) / 1000, bot_control_phone: this.botControlPhone,
      items: rows.sort((a, b) => Number(a.is_bot_active || !!a.blocked_reason) - Number(b.is_bot_active || !!b.blocked_reason) || b.updated_at - a.updated_at).slice(0, 100) };
  }

  pinHandover(session, reason) {
    this.cancelPropertyLookup(session.phone);
    session.is_bot_active = false; session.generation += 1; session.pending_reply = null;
    session.handover = { reason, at: this.now(), notice: 'not_requested' };
    for (const alias of this.contactAliases(session.phone)) this.store.control?.pause(alias, reason);
    this.store.rememberSearch(session);
  }

  cancelPropertyLookup(phone) {
    for (const alias of this.contactAliases(phone)) this.propertyLookups.get(alias)?.abort();
  }

  ownerEvent(message) {
    if (this.controlOwnerEvent(message)) return;
    if (this.blockedContact(message.from)) return;
    const ownerId = message.whatsapp_id || message.id;
    const seenKey = `owner:${ownerId}`;
    if (this.store.seen.has(seenKey) || this.store.control?.hasOwnerMessage?.(ownerId)) return;
    const resumedAt = Math.max(0, ...this.contactAliases(message.from).map((alias) => this.store.control?.getResumeAt?.(alias) || this.store.get(alias)?.bot_resumed_at || 0));
    const at = Number.isFinite(message.timestamp) ? Math.min(message.timestamp, this.now()) : this.now();
    // WhatsApp timestamps have second precision. IDs handle duplicates within
    // that second; the persisted watermark handles old echoes after restart.
    if (at < Math.floor(resumedAt / 1000) * 1000) return;
    this.store.seen.set(seenKey, { pending: false, expires_at: this.now() + 7 * DAY });
    this.store.control?.markOwnerMessage?.(ownerId);
    const command = /^#bot\s+(on|off)\s*$/i.exec(message.text || '')?.[1].toLowerCase();
    if (command === 'on') {
      if (!this.store.get(message.from)) this.store.create(message.from);
      this.setBotActive(message.from, true);
    } else this.takeOver(message.from, { source: command === 'off' ? 'command' : 'whatsapp', at });
    if (command && this.whatsapp.acknowledgeOwnerCommand) {
      void this.whatsapp.acknowledgeOwnerCommand(message, command).catch((error) => logFailure(this.logger, 'owner_command_ack_failed', error));
    }
  }

  controlOwnerEvent(message) {
    const source = this.whatsapp.getContactPhone?.(message.from) || message.from;
    if (source !== this.botControlPhone) return false;
    // Only ownerEvent calls this method: Baileys authenticated fromMe, after
    // excluding the bot's own sends. Incoming contact text never reaches it.
    const parsed = parseBotControlCommand(message.text);
    if (!parsed) return true;
    const ownerId = message.whatsapp_id || message.id, seenKey = `owner:${ownerId}`;
    if (this.store.seen.has(seenKey) || this.store.control?.hasOwnerMessage?.(ownerId)) return true;
    const complete = reply => {
      this.store.seen.set(seenKey, { pending: false, expires_at: this.now() + 7 * DAY });
      this.store.control?.markOwnerMessage?.(ownerId);
      if (this.whatsapp.acknowledgeControlCommand) void this.whatsapp.acknowledgeControlCommand(message, reply)
        .catch(error => logFailure(this.logger, 'bot_control_ack_failed', error));
    };
    if (parsed.error) { complete(botControlHelp); return true; }
    const { target, command } = parsed;
    if (this.blockedContact(target)) { complete('Nomor tersebut dipakai untuk operasional atau merupakan akun WhatsApp pengirim. Gunakan nomor klien yang ingin dikendalikan.'); return true; }
    const at = Number.isFinite(message.timestamp) ? Math.min(message.timestamp, this.now()) : this.now();
    const watermark = Math.max(0, ...this.contactAliases(target).flatMap(alias => [
      this.store.control?.getResumeAt?.(alias) || this.store.get(alias)?.bot_resumed_at || 0,
      this.store.control?.get(alias)?.at || this.store.get(alias)?.handover?.at || 0,
    ]));
    if (at < Math.floor(watermark / 1000) * 1000) return true;
    try {
      if (!this.contactAliases(target).some(alias => this.store.get(alias))) this.store.assertCapacity(1, 0);
      if (command === 'off') this.takeOver(target, { source: 'command', at });
      else {
        if (!this.store.get(target) && !this.contactAliases(target).some(alias => this.store.get(alias))) this.store.create(target);
        this.setBotActive(target, true);
      }
      complete(command === 'off' ? `⏸️ Bot untuk +${target} dijeda tanpa batas waktu. Aktifkan kembali dengan #boton ${target}.`
        : `✅ Bot untuk +${target} diaktifkan kembali.`);
    } catch (error) {
      logFailure(this.logger, 'bot_control_failed', error);
      complete('Status bot belum berhasil diubah. Boleh kirim ulang perintahnya sebentar lagi.');
    }
    return true;
  }

  flushManualPauses() {
    if (!this.accepting || this.whatsapp.getStatus && !this.whatsapp.getStatus().connected) return;
    const contacts = new Set([...(this.store.control?.list() || []).filter((row) => row.resume_at != null && row.resume_at <= this.now()).map((row) => row.contact),
      ...[...this.store.sessions.values()].filter((s) => !s.is_bot_active && s.handover?.resume_at != null && s.handover.resume_at <= this.now()).map((s) => s.phone)]);
    for (const phone of contacts) {
      const ownership = this.ownership(phone);
      if (ownership?.reason === 'manual_cs' && ownership.resume_at != null && ownership.resume_at <= this.now()) this.setBotActive(phone, true);
    }
    for (const session of this.store.sessions.values()) if (session.is_bot_active) this.queuePendingReply(session);
  }

  queuePendingReply(session) {
    const pending = session.pending_reply;
    if (!pending || !session.is_bot_active || this.pending >= this.config.maxPending ||
      this.whatsapp.getStatus && !this.whatsapp.getStatus().connected) return false;
    session.pending_reply = null; this.store.rememberSearch(session);
    if (pending.expires_at <= this.now() || this.blockedContact(session.phone)) return false;
    const message = { ...pending.message, from: session.phone };
    session.reply_version = (session.reply_version || 0) + 1;
    const generation = session.generation, replyVersion = session.reply_version;
    this.enqueue(session.phone, async () => {
      try { await this.process(message, session, { generation, replyVersion, handover: false, alreadyRecorded: pending.recorded }); }
      catch (error) { logFailure(this.logger, 'resumed_message_failed', error); }
    });
    return true;
  }

  acceptBatch(messages) {
    if (!this.accepting) throw new ServiceError('SHUTTING_DOWN', 503);
    this.store.cleanup(this.pendingByPhone);
    for (const message of messages) {
      if (message.type === 'human_takeover') this.ownerEvent(message);
    }
    // Internal contacts stay excluded, apart from an explicitly configured
    // client test number. Resolve Baileys LID aliases for both roles.
    messages = messages.filter((message) => message.type !== 'human_takeover' && !['internal_stock_contact', 'bot_control_contact'].includes(this.blockedContact(message.from)));
    const unique = [...new Map(messages.filter((message) => !ignoredInbound(message)).map((message) => [message.id, message])).values()]
      .filter((message) => !this.store.seen.has(message.id));
    const newPhones = new Set(unique.filter((message) => !this.store.get(message.from)).map((message) => message.from));
    this.store.assertCapacity(newPhones.size, unique.length);
    const additions = new Map();
    for (const message of unique) additions.set(message.from, (additions.get(message.from) || 0) + 1);
    if (this.pending + unique.length > this.config.maxPending || [...additions].some(([phone, count]) =>
      count + (this.pendingByPhone.get(phone) || 0) > this.config.maxPendingPerPhone)) {
      throw new ServiceError('QUEUE_FULL', 503);
    }
    // Semua validasi kapasitas selesai sebelum reservasi; batch diterima secara utuh.
    for (const message of unique) {
      const preference = recommendationPreference(message.text);
      const contactPhone = this.whatsapp.getContactPhone?.(message.from) || message.from;
      if (preference != null && validPhone(contactPhone)) this.recommendationPreferences?.setEnabled(contactPhone, preference);
      const session = this.store.get(message.from) || this.store.create(message.from);
      const ownership = this.ownership(message.from);
      if (ownership?.resume_at != null && ownership.resume_at <= this.now() && ownership.reason === 'manual_cs') this.setBotActive(message.from, true, { replayPending: false });
      else if (!ownership && !session.is_bot_active && session.handover) this.setBotActive(message.from, true, { replayPending: false });
      else if (ownership && (session.is_bot_active || session.handover?.at !== ownership.at || session.handover?.reason !== ownership.reason)) {
        session.is_bot_active = false; session.generation += 1;
        session.handover = { ...ownership, notice: 'not_requested' };
      }
      this.store.resetIfIdle(session);
      session.last_user_received_at = this.now();
      session.last_user_at = Math.max(session.last_user_at || 0, message.timestamp);
      session.updated_at = this.now();
      session.reply_version = (session.reply_version || 0) + 1;
      const trigger = message.text ? detectHandover(message.text, { closing: session.conversion?.mode === CLOSING_STATE, canScheduleVisit: !!this.surveys }) ||
        (interactionDecision({ text: message.text, type: message.type, previousId: session.asset_id, history: session.history, state: { ...session, canScheduleVisit: !!this.surveys } }) === 'handoff' ? 'unrecognized_language' : null) : null;
      // Pause sinkron membatalkan hasil LLM yang sedang berjalan pada nomor ini.
      const handover = trigger ? this.store.pause(session, `keyword:${trigger}`) : false;
      // Release a slow lookup immediately when CS takes over or a newer turn
      // replaces the reply; retries must not hold up the contact's queue.
      if (handover || !session.is_bot_active || this.config.replyDelayMs) this.cancelPropertyLookup(session.phone);
      const purchaseSubmission = isPurchaseDocumentSubmission({ ...message, conversion: session.conversion });
      if (!session.is_bot_active && session.handover?.resume_at != null && (trigger || purchaseSubmission)) this.pinHandover(session, purchaseSubmission ? 'purchase_documents_pending_review' : `keyword:${trigger}`);
      if (!session.is_bot_active) {
        // Keep one unanswered, non-sensitive text. A newer manual answer clears
        // it; neither activation nor expiry may replay an older customer turn.
        session.pending_reply = message.type === 'text' && !trigger && !purchaseSubmission && !isPrivateRequest(message.text || '', session.conversion)
          ? { message: { ...message }, recorded: false, expires_at: this.now() + 15 * 60000 } : null;
        this.store.rememberSearch(session);
      }
      const record = { pending: true, expires_at: this.now() + 7 * DAY };
      this.store.seen.set(message.id, record);
      const generation = session.generation;
      const replyVersion = session.reply_version;
      this.enqueue(message.from, async () => {
        try { await this.process(message, session, { handover, generation, replyVersion }); }
        catch (error) { logFailure(this.logger, 'message_processing_failed', error); }
        finally { record.pending = false; }
      });
    }
    return unique.length;
  }

  enqueue(phone, task) {
    this.pending += 1;
    this.pendingByPhone.set(phone, (this.pendingByPhone.get(phone) || 0) + 1);
    const previous = this.tails.get(phone) || Promise.resolve();
    const work = previous.then(task);
    const settled = work.catch(() => {}).finally(() => {
      this.pending -= 1;
      const remaining = this.pendingByPhone.get(phone) - 1;
      if (remaining) this.pendingByPhone.set(phone, remaining);
      else this.pendingByPhone.delete(phone);
      if (this.tails.get(phone) === settled) this.tails.delete(phone);
    });
    this.tails.set(phone, settled);
    return work;
  }

  inServiceWindow(session) {
    return session.last_user_at != null && (this.config.transport === 'baileys' || this.now() - session.last_user_at < DAY);
  }

  conversationHistory(session) {
    const source = this.contactAliases(session.phone).map(alias => this.store.get(alias) || this.store.control?.getSearch?.(alias))
      .filter(item => item?.outbound_recommendation?.at > this.now() - 7 * DAY).sort((a, b) => b.outbound_recommendation.at - a.outbound_recommendation.at)[0];
    const sent = source?.outbound_recommendation;
    if (sent && !session.buyer_state) {
      session.buyer_state = source.buyer_state?.notification_search ? { ...structuredClone(source.buyer_state), last_sequence: session.message_sequence - 1 }
        : savedRecommendationSearch(sent.search_criteria, sent.offered_ids || sent.property_ids, session.message_sequence - 1, sent.agent_id);
      if (!session.client_identity.name && sent.name) session.client_identity = { ...session.client_identity, name: sent.name, asked: true };
      this.store.rememberSearch(session);
    }
    return sent && !session.history.some(item => item.role === 'assistant' && item.content === sent.text)
      ? [{ role: 'assistant', content: sent.text }, ...session.history] : session.history;
  }

  async deliver(session, text, replyTo, { human = false, handover = false } = {}) {
    const generation = session.generation;
    const replyVersion = session.reply_version;
    if (!human && this.config.replyDelayMs) await this.sleep(this.config.replyDelayMs);
    if (!human && (session.generation !== generation || !handover && (!session.is_bot_active || this.config.replyDelayMs && session.reply_version !== replyVersion))) return null;
    if (!this.inServiceWindow(session)) throw new ServiceError('SERVICE_WINDOW_CLOSED', 409);
    try {
      const id = await this.whatsapp.sendText(session.phone, text, replyTo);
      if (session.buyer_state?.notification_search && isRecommendationList(text)) {
        const ids = recommendationIds(text);
        session.buyer_state.offered_ids = offeredPropertyIds(session.buyer_state.offered_ids || [], ids);
        session.outbound_recommendation = { text, at: this.now(), property_ids: ids, offered_ids: session.buyer_state.offered_ids,
          search_criteria: session.buyer_state.profile, name: session.client_identity.name || null, agent_id: session.buyer_state.sender_agent_id || null };
      }
      this.store.append(session, 'assistant', text);
      session.delivery_error = null;
      return id;
    } catch (error) {
      session.delivery_error = { code: error.code || 'SEND_FAILED', at: this.now() };
      throw error;
    }
  }

  async sendHandover(session, message, text = HANDOVER_MESSAGE) {
    try {
      const id = await this.deliver(session, text, message.id, { handover: true });
      if (id) session.handover.notice = 'sent';
    } catch (error) {
      session.handover.notice = 'failed';
      // Kegagalan notifikasi tidak mengaktifkan bot kembali.
      logFailure(this.logger, 'handover_notice_failed', error);
    }
  }

  async process(message, session, { handover, generation, replyVersion, alreadyRecorded = false }) {
    if (session.generation !== generation) return;
    const purchaseSubmission = isPurchaseDocumentSubmission({ ...message, conversion: session.conversion });
    if (!alreadyRecorded) this.store.append(session, 'user', purchaseSubmission
      ? '[Lampiran atau data pembelian; isi tidak diproses AI dan menunggu pemeriksaan tim]'
      : message.text || `[Pesan ${message.type}; konten media tidak diproses]`);
    if (session.pending_reply?.message.id === message.id) { session.pending_reply.recorded = true; this.store.rememberSearch(session); }
    if (handover && session.generation === generation) {
      await this.sendHandover(session, message);
      return;
    }
    const stillActive = () => session.is_bot_active && session.generation === generation && (!this.config.replyDelayMs || session.reply_version === replyVersion);
    if (purchaseSubmission) {
      this.store.setConversion(session, { ...session.conversion, phase: 'purchasing_handoff',
        purchase_intake: { ...session.conversion.purchase_intake, stage: 'agent_review',
          attachment_pending_review: true, documents_verified: false, payment_verified: false } });
      session.lead_status = 'hot';
      // Documents may arrive after the buyer already handed the conversation
      // to a human. Record pending review without resuming/replying over CS.
      if (!stillActive() || !this.inServiceWindow(session)) return;
      this.store.pause(session, 'purchase_documents_pending_review');
      await this.sendHandover(session, message, `Lampiran atau data pembelian sudah masuk ke percakapan dan perlu diperiksa tim. ${purchaseHandoffText({ stockStatus: session.conversion.stock_status })}`);
      return;
    }
    if (!stillActive() || !this.inServiceWindow(session)) return;
    const preference = recommendationPreference(message.text);
    if (preference != null && this.recommendationPreferences) {
      await this.deliver(session, preference ? 'Rekomendasi aset otomatis sudah diaktifkan kembali. Saya akan kabari kalau ada listing baru yang sesuai.' : 'Baik, rekomendasi aset otomatis saya hentikan. Kalau ingin menerima lagi, ketik “aktifkan rekomendasi”.', message.id);
      return;
    }
    const conversation = this.conversationHistory(session);
    const history = conversation.filter((item) => !item.property_ignored);
    session.asset_id ||= session.survey_state?.asset_id || session.consultation?.asset_id || selectedAssetIdFromHistory(history);
    let decision = interactionDecision({ text: message.text || '', type: message.type, previousId: session.asset_id, history, state: { ...session, canScheduleVisit: !!this.surveys } });
    const client = clientIntroductionTurn({ text: message.text || '', history, identity: session.client_identity,
      hasContext: !!session.asset_id || conversation !== session.history || !!session.buyer_state?.searchStarted || history.some((item) => item.role === 'user' && requestsPropertySearch(item.content)) });
    const phone = this.whatsapp.getContactPhone?.(message.from) || (validPhone(message.from) ? message.from : null);
    try {
      if (phone && client.identity?.name) this.clients?.setName(phone, client.identity.name);
      if (phone && session.client_capture && this.clients) {
        this.clients.enqueue({ ...session.client_capture, phone, name: client.identity?.name || null });
        void this.clients.flush();
      }
    }
    catch (error) { logFailure(this.logger, 'client_identity_save_failed', error); }
    if (client.reply && decision !== 'handoff' && !isPrivateRequest(message.text || '', session.conversion) && message.type === 'text') {
      session.out_of_scope_notified = true;
      await this.deliver(session, client.reply, message.id);
      return;
    }
    if (isPrivateRequest(message.text || '', session.conversion)) { ignorePropertyTurn(session.history, message.text); return; }
    const scopeLookup = new AbortController();
    this.propertyLookups.set(session.phone, scopeLookup);
    try { decision = await resolveInteractionDecision({ text: message.text || '', type: message.type, previousId: session.asset_id, history, state: { ...session, canScheduleVisit: !!this.surveys } }, this.ai, scopeLookup.signal); }
    finally { if (this.propertyLookups.get(session.phone) === scopeLookup) this.propertyLookups.delete(session.phone); }
    if (!stillActive()) return;
    if (decision === 'silent') { ignorePropertyTurn(session.history, message.text); return; }
    if (decision === 'nudge') {
      if (!session.out_of_scope_notified) { session.out_of_scope_notified = true; await this.deliver(session, CONTEXT_REQUIRED_MESSAGE, message.id); }
      return;
    }
    if (decision === 'handoff') { this.store.pause(session, 'unrecognized_language'); await this.sendHandover(session, message); return; }
    const previouslySelectedAssetId = session.asset_id;
    const lookup = new AbortController();
    this.propertyLookups.set(session.phone, lookup);
    let context;
    try { context = await resolvePropertyContext(this.catalog, message.text, session.asset_id, history, this.now(), lookup.signal, session.buyer_state, session.conversion, this.ai, { surveyState: session.survey_state, consultation: session.consultation }, decision === 'search'); }
    catch (error) {
      if (lookup.signal.aborted) return;
      logFailure(this.logger, 'property_lookup_failed', error);
      if (stillActive()) await this.deliver(session, 'Maaf, data properti sedang belum dapat diakses. Mohon coba lagi sebentar atau ketik "hubungkan CS" untuk dibantu Senior Agent kami.', message.id);
      return;
    }
    finally { if (this.propertyLookups.get(session.phone) === lookup) this.propertyLookups.delete(session.phone); }
    if (!stillActive()) return;
    const presentingAgent = context.buyer?.continuation?.notification_search && context.buyer.continuation.sender_agent_id;
    if (presentingAgent) {
      context.asset = withPresentingAgent(context.asset, presentingAgent);
      if (context.checkAsset) context.checkAsset = withPresentingAgent(context.checkAsset, presentingAgent);
      context.catalog = (context.catalog || []).map(asset => withPresentingAgent(asset, presentingAgent));
    }
    session.buyer_state = context.buyer?.continuation || null;
    this.store.rememberSearch(session);
    try {
      // Keep a qualified snapshot even while Baileys only knows an opaque LID.
      // It can be saved once authenticated phone metadata becomes available.
      const capture = qualifiedClientFunnel({ buyer: context.buyer, identity: client.identity, now: this.now() });
      if (capture) session.client_capture = capture;
      if (capture && phone && this.clients) { this.clients.enqueue({ ...capture, phone }); void this.clients.flush(); }
    } catch (error) { logFailure(this.logger, 'client_capture_enqueue_failed', error); }
    const asset = context.asset;
    if (session.asset_id !== (asset?.id || null)) {
      // Kesiapan dana untuk aset lama tidak otomatis berlaku bagi aset baru.
      session.qualification = session.qualification.purpose ? { purpose: session.qualification.purpose } : {};
    }
    session.asset_id = asset?.id || null;
    let check = null;
    try { check = await requestAuctionCheck({ asset: context.checkAsset || asset, checks: this.checks, contact: session.phone, now: this.now() }); }
    catch (error) {
      logFailure(this.logger, 'asset_check_enqueue_failed', error);
      check = { status: 'unavailable', external_check_performed: false };
    }
    if (!stillActive()) return;
    let result;
    try {
      result = await replyFromPropertyContext({ context, ai: this.ai, check, text: message.text,
        selectedAssetId: previouslySelectedAssetId,
        history: history.map((item) => ({ ...item })), qualification: session.qualification, conversion: session.conversion,
        now: this.now(), clarify: decision === 'clarify', clientIdentity: client.identity,
        consultation: session.consultation, surveyState: session.survey_state, phone, agentId: this.agentId, surveys: this.surveys,
        persistSurvey: visit => { session.survey_state = structuredClone(visit); this.store.rememberSearch(session); } });
    } catch (error) {
      logFailure(this.logger, 'ai_generation_failed', error);
      if (stillActive()) await this.deliver(session, FALLBACK, message.id);
      return;
    }
    // Pemeriksaan kedua penting jika trigger tiba saat menunggu API LLM.
    if (result.consultation) session.consultation = result.consultation;
    if ('survey_state' in result) session.survey_state = result.survey_state;
    this.store.rememberSearch(session);
    if (!stillActive()) return;
    if (result.action === 'handoff') {
      if (result.conversion) this.store.setConversion(session, result.conversion);
      if (result.conversion?.phase === 'purchasing_handoff') session.lead_status = 'hot';
      this.store.pause(session, result.conversion?.phase === 'purchasing_handoff' ? 'purchase_preparation_requested'
        : result.conversion?.phase === 'handoff' ? 'closing_agreement_requested' : 'ai_requires_human');
      await this.sendHandover(session, message, result.reply); return;
    }
    if (result.action === 'out_of_scope') {
      ignorePropertyTurn(session.history, message.text);
      return;
    }
    session.out_of_scope_notified = false;
    Object.assign(session.qualification, result.qualification);
    const q = session.qualification;
    const isHot = !!asset && !needsAuctionCheck(asset, this.now()) && q.purpose?.value && q.funds?.value === 'ready' && q.settlement?.value === 'ready';
    session.lead_status = isHot ? 'hot' : Object.keys(q).length ? 'warm' : 'new';
    if (isHot && result.conversion?.mode !== CLOSING_STATE) {
      this.store.pause(session, 'qualified_hot_lead_self_report');
      await this.sendHandover(session, message);
      return;
    }
    for (const reply of result.replies || [result.reply]) {
      if (!stillActive()) return;
      if (reply.length > 4096) throw new ServiceError('AI_REPLY_TOO_LONG', 502);
      const delivered = await this.deliver(session, reply, message.id);
      if (!delivered || !stillActive()) return;
    }
    if (result.conversion) this.store.setConversion(session, result.conversion);
    if (this.documents && this.whatsapp.sendDocument && shouldSendMouDocument({ asset,
      conversion: result.conversion, history: session.history, text: message.text, selectedAssetId: previouslySelectedAssetId })) {
      const previous = result.conversion;
      const record = { asset_id: asset.id, status: 'preparing', at: this.now() };
      result.conversion = { ...previous, draft_document: record };
      // Persist before sending. An uncertain send must not duplicate itself on
      // the next "baik" or after restart. Explicit re-send remains possible.
      this.store.setConversion(session, result.conversion);
      try {
        const file = validatePdf(await this.documents.generate(asset.id, previous.max_bid || null));
        if (file.assetId !== asset.id) throw new ServiceError('MOU_ASSET_MISMATCH', 502);
        if (!stillActive() || !this.inServiceWindow(session)) return;
        record.status = 'sending'; this.store.setConversion(session, result.conversion);
        const id = await this.whatsapp.sendDocument(session.phone, file, MOU_CAPTION, message.id);
        record.status = 'sent'; record.message_id = id; record.filename = file.filename;
        this.store.append(session, 'assistant', `[PDF ${file.filename}] ${MOU_CAPTION}`);
        this.store.setConversion(session, result.conversion);
      } catch (error) {
        record.status = record.status === 'sending' ? 'uncertain' : 'failed';
        record.code = error.code || 'MOU_PDF_UNAVAILABLE';
        this.store.setConversion(session, result.conversion);
        logFailure(this.logger, 'mou_document_failed', error);
        if (stillActive()) await this.deliver(session, 'Draf PDF-nya belum berhasil saya kirim. Pembahasan asetnya tetap bisa dilanjutkan; Anda bisa meminta saya mengirim ulang PDF-nya.', message.id);
      }
    }
  }

  recordClosingOutcome(phone, event) {
    if ((this.pendingByPhone.get(phone) || 0) > 0) throw new ServiceError('CONVERSATION_BUSY', 409);
    const session = this.store.get(phone) || (this.store.control?.getConversion?.(phone) ? this.store.create(phone) : null);
    if (!session) throw new ServiceError('CONVERSATION_NOT_FOUND', 404);
    const conversion = applyClosingOutcome(session.conversion, event);
    this.store.setConversion(session, conversion);
    return conversion;
  }

  setBotActive(phone, isActive, { replayPending = true } = {}) {
    if (this.blockedContact(phone)) throw new ServiceError('BOT_CONTACT_EXCLUDED', 409);
    if (!isActive) return this.takeOver(phone);
    const aliases = this.contactAliases(phone), ownership = this.ownership(phone);
    const sessions = aliases.map((alias) => this.store.get(alias)).filter(Boolean)
      .sort((a, b) => (b.last_user_received_at || 0) - (a.last_user_received_at || 0) || b.history.length - a.history.length);
    if (!sessions.length && ownership) sessions.push(this.store.create(phone));
    const session = sessions[0];
    if (!session) throw new ServiceError('CONVERSATION_NOT_FOUND', 404);
    const wasPaused = !!ownership || sessions.some((s) => !s.is_bot_active);
    const preserveSearch = ownership?.reason === 'manual_cs' || !ownership && session.handover?.reason === 'manual_cs';
    const pending = sessions.map((s) => s.pending_reply).filter(Boolean).sort((a, b) => b.message.timestamp - a.message.timestamp)[0];
    for (const alias of aliases) this.store.control?.resume(alias);
    for (const current of sessions) {
      current.bot_resumed_at = this.now();
      if (!wasPaused) continue;
      current.is_bot_active = true; current.generation += 1; current.handover = null;
      current.pending_reply = null; current.qualification = {}; current.lead_status = 'new';
      if (!preserveSearch) {
        current.history = []; current.asset_id = null; current.buyer_state = null;
        this.store.setConversion(current, searchConversion());
      }
      current.out_of_scope_notified = false; current.updated_at = this.now();
      this.store.rememberSearch(current);
    }
    if (wasPaused && replayPending && pending) {
      // Resetting a human handoff also clears history; its pending text must
      // then be appended once before generating the resumed reply.
      session.pending_reply = { ...pending, recorded: preserveSearch && pending.recorded && session.history.some((m) => m.role === 'user' && m.content === pending.message.text) };
      this.store.rememberSearch(session); this.queuePendingReply(session);
    }
    return session;
  }

  takeOver(phone, { source = 'dashboard', at = this.now() } = {}) {
    const aliases = this.contactAliases(phone), ownership = this.ownership(phone);
    const session = aliases.map((alias) => this.store.get(alias)).find(Boolean) || this.store.create(phone);
    const pauseMs = this.config.manualReplyPauseMs ?? 300000;
    const resume_at = source === 'whatsapp' && pauseMs >= 0 ? at + pauseMs : null;
    if (source === 'whatsapp' && (ownership?.at > at || pauseMs > 0 && resume_at <= this.now())) return session;
    this.cancelPropertyLookup(phone);
    const pinned = source === 'whatsapp' && ownership && ownership.resume_at == null;
    const handover = pinned ? ownership : { reason: 'manual_cs', at, ...(resume_at != null ? { resume_at } : {}) };
    for (const alias of this.contactAliases(phone)) {
      const current = this.store.get(alias);
      if (current) {
        current.is_bot_active = false; current.generation += 1; current.pending_reply = null;
        current.handover = { ...handover, notice: 'not_requested' }; current.updated_at = this.now();
        this.store.rememberSearch(current);
      }
      this.store.control?.pause(alias, handover.reason, handover);
    }
    return session;
  }

  async sendHumanMessage(phone, text) {
    const session = this.store.get(phone);
    if (!session) throw new ServiceError('CONVERSATION_NOT_FOUND', 404);
    if (session.is_bot_active) throw new ServiceError('PAUSE_BOT_FIRST', 409);
    if (!this.accepting || this.pending >= this.config.maxPending ||
        (this.pendingByPhone.get(phone) || 0) >= this.config.maxPendingPerPhone) {
      throw new ServiceError('QUEUE_FULL', 503);
    }
    return this.enqueue(phone, async () => {
      if (session.is_bot_active) throw new ServiceError('PAUSE_BOT_FIRST', 409);
      return this.deliver(session, text, undefined, { human: true });
    });
  }

  async drain() {
    while (this.tails.size) await Promise.all(this.tails.values());
  }
}
