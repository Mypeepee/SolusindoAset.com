import { postJson, ServiceError, logFailure } from '../lib/http.js';
import { validPhone } from '../lib/security.js';
import { CLOSING_STATE } from './closing_state.js';
import { RECOMMENDATION_BATCH_SIZE, offeredPropertyIds, validRecommendationSearch, savedRecommendationSearch } from './recommendation_policy.js';

export function recommendationHours(now) {
  const hour = new Date(now + 7 * 3600000).getUTCHours();
  return hour >= 8 && hour < 20;
}
export const recommendationDay = now => new Date(now + 7 * 3600000).toISOString().slice(0, 10);
export function nextRecommendationMorning(now) {
  const today = Date.parse(`${recommendationDay(now)}T08:00:00+07:00`);
  return now < today ? today : today + 86400000;
}
export function recommendationPreference(text = '') {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, '');
  if (/^(?:tolong\s+)?(?:berhenti(?:kan)?|stop|jangan\s+kirim(?:kan)?)\s+(?:pesan\s+)?rekomendasi(?:\s+(?:aset|properti))?(?:\s+(?:otomatis|lagi))?$/.test(t)) return false;
  if (/^(?:tolong\s+)?aktifkan(?:\s+lagi)?\s+rekomendasi(?:\s+(?:aset|properti|otomatis))?$/.test(t)) return true;
  return null;
}
const validId = v => typeof v === 'string' && /^[1-9]\d{0,17}$/.test(v);
const validCursor = v => typeof v === 'string' && /^(?:0|[1-9]\d{0,17})$/.test(v);
export class NewPropertyNotifications {
  constructor({ queue, connection, entries, now = Date.now, fetchImpl = fetch, logger = console }) {
    Object.assign(this, { queue, connection, entries, now, fetchImpl, logger });
    this.running = null; this.stopping = false;
  }
  async call(agent, action, input = {}) {
    const r = await postJson(this.connection.url, { body: { agent_id: agent, action, ...input },
      headers: { Authorization: `Bearer ${this.connection.token}` }, timeoutMs: this.connection.timeoutMs, fetchImpl: this.fetchImpl });
    if (!r || typeof r !== 'object' || r.unavailable) throw new ServiceError('RECOMMENDATIONS_UNAVAILABLE', 503);
    return r;
  }
  flush() {
    if (this.stopping) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.run().finally(() => { this.running = null; });
    return this.running;
  }
  async run() {
    for (const [agent, entry] of this.entries()) {
      if (this.stopping || !/^AG\d{1,18}$/.test(agent)) continue;
      try { await this.tick(agent, entry); }
      catch (error) {
        this.queue.error(agent, error.status === 401 ? 'RECOMMENDATIONS_AUTH_FAILED' : error.code || 'RECOMMENDATIONS_UNAVAILABLE');
        logFailure(this.logger, 'new_property_notifications_failed', error);
      }
    }
  }
  async tick(agent, entry) {
    const setting = this.queue.agent(agent);
    // Acknowledge already-sent messages even while notifications are paused.
    for (const batch of this.queue.acknowledgements(agent)) {
      if (this.stopping) return;
      const ack = await this.call(agent, 'acknowledge', { receipt: JSON.parse(batch.payload).receipt });
      if (ack.acknowledged !== true) throw new ServiceError('INVALID_RECOMMENDATION_ACK', 502);
      this.queue.acknowledged(batch.id);
    }
    if (!setting.enabled) return;
    if (setting.cursor == null) {
      const r = await this.call(agent, 'initialize');
      if (!validCursor(r.cursor)) throw new ServiceError('INVALID_RECOMMENDATION_CURSOR', 502);
      this.queue.initialize(agent, r.cursor);
    }
    // Bound each turn, preserve the cursor for the following minute.
    for (let page = 0; page < 4 && !this.stopping; page += 1) {
      const cursor = this.queue.agent(agent).cursor;
      const r = await this.call(agent, 'scan', { cursor });
      if (!validCursor(r.cursor) || BigInt(r.cursor) < BigInt(cursor) || !Array.isArray(r.candidates) ||
        r.candidates.some(c => !/^KL\d{1,18}$/.test(c.client_id) || !validId(c.property_id) || BigInt(c.property_id) <= BigInt(cursor) || BigInt(c.property_id) > BigInt(r.cursor)) ||
        typeof r.more !== 'boolean' || r.more && r.cursor === cursor) throw new ServiceError('INVALID_RECOMMENDATION_PAGE', 502);
      this.queue.page(agent, cursor, r.cursor, r.candidates);
      if (!r.more) break;
    }
    // Catch up the 08:00 WIB pass after downtime, including existing inventory
    // and newly saved preferences. Offline WhatsApp holds delivery, not matching.
    if (recommendationHours(this.now())) for (let page = 0; page < 2 && !this.stopping; page++) {
      const day = recommendationDay(this.now()), daily = this.queue.daily(agent, day);
      if (daily.daily_completed_at) break;
      const r = await this.call(agent, 'daily', { after_client: daily.daily_after_client });
      if (typeof r.after_client !== 'string' || !/^(?:|KL\d{1,18})$/.test(r.after_client) || r.after_client < daily.daily_after_client ||
        typeof r.more !== 'boolean' || r.more && r.after_client === daily.daily_after_client ||
        !Number.isSafeInteger(r.checked) || r.checked < 0 || r.checked > 10 || !Number.isSafeInteger(r.matched) || r.matched < 0 || r.matched > r.checked ||
        !Array.isArray(r.candidates) || r.candidates.length > r.matched * RECOMMENDATION_BATCH_SIZE || r.candidates.some(c => !/^KL\d{1,18}$/.test(c.client_id) || !validId(c.property_id))) throw new ServiceError('INVALID_DAILY_RECOMMENDATION_PAGE', 502);
      this.queue.dailyPage(agent, day, daily.daily_after_client, r);
      if (!r.more) break;
    }
    if (!recommendationHours(this.now()) || !entry.whatsapp.getStatus().connected) return;
    for (const group of this.queue.pending(agent).slice(0, 25)) {
      if (this.stopping || !entry.whatsapp.getStatus().connected) break;
      const { processor } = entry;
      if (processor.pending >= processor.config.maxPending) break;
      const draft = await this.call(agent, 'prepare', { client_id: group.client, property_ids: group.properties });
      if (draft.skipped === true) { this.queue.skip(agent, group.client, group.properties); continue; }
      if (!validPhone(draft.phone) || typeof draft.text !== 'string' || !draft.text.trim() || draft.text.length > 4096 ||
        typeof draft.receipt !== 'string' || draft.receipt.length > 5000 || !Array.isArray(draft.property_ids) || !draft.property_ids.length || draft.property_ids.length > RECOMMENDATION_BATCH_SIZE ||
        draft.search_criteria != null && !validRecommendationSearch(draft.search_criteria) ||
        draft.property_ids.some(id => !validId(id) || !group.properties.includes(id))) throw new ServiceError('INVALID_RECOMMENDATION_DRAFT', 502);
      this.queue.skip(agent, group.client, group.properties.filter(id => !draft.property_ids.includes(id)));
      const previouslyDelivered = this.queue.alreadyDelivered(agent, draft.phone, draft.property_ids);
      if (previouslyDelivered.length) { this.queue.skip(agent, group.client, previouslyDelivered); continue; }
      if (!this.queue.recipientAllows(agent, draft.phone)) { this.queue.skip(agent, group.client, group.properties); continue; }
      if (this.queue.cooling(agent, draft.phone) || processor.blockedContact(draft.phone) || processor.ownership(draft.phone)) continue;
      const aliases = processor.contactAliases(draft.phone);
      // A message being composed, a live client query or closing takes priority.
      if (aliases.some(a => processor.pendingByPhone.has(a))) continue;
      const session = aliases.map(a => processor.store.get(a)).find(Boolean);
      if (session?.conversion?.mode === CLOSING_STATE || session?.last_user_received_at > this.now() - 10 * 60000) continue;
      await processor.enqueue(session?.phone || draft.phone, async () => {
        if (this.stopping || !processor.accepting || !this.queue.agent(agent).enabled || !entry.whatsapp.getStatus().connected ||
          processor.blockedContact(draft.phone) || processor.ownership(draft.phone) || !this.queue.recipientAllows(agent, draft.phone)) return;
        const batch = this.queue.begin(agent, group.client, draft);
        if (!batch) return;
        try {
          const messageId = await entry.whatsapp.sendText(draft.phone, draft.text);
          this.queue.sent(batch, messageId);
        } catch (error) {
          this.queue.uncertain(batch);
          logFailure(this.logger, 'new_property_delivery_uncertain', error);
          return;
        }
        const target = session || processor.store.get(draft.phone) || processor.store.create(draft.phone);
        target.asset_id = null;
        const offered = offeredPropertyIds(draft.previous_property_ids || [], target.buyer_state?.offered_ids || [], draft.property_ids);
        const saved = savedRecommendationSearch(draft.search_criteria, offered, target.message_sequence, agent);
        if (saved) target.buyer_state = saved;
        target.outbound_recommendation = { text: draft.text, at: this.now(), property_ids: draft.property_ids,
          offered_ids: offered, search_criteria: draft.search_criteria || null, name: draft.name || null, agent_id: agent };
        if (!target.client_identity.name && typeof draft.name === 'string') target.client_identity = { ...target.client_identity, name: draft.name, asked: true };
        processor.store.append(target, 'assistant', draft.text);
      });
    }
  }
  status(agent) {
    const connection = [...this.entries()].find(([id]) => id === agent)?.[1].whatsapp.getStatus();
    return { configured: true, ...this.queue.status(agent), max_per_message: RECOMMENDATION_BATCH_SIZE, interval_hours: 24, hours: '08.00–20.00 WIB',
      daily_time: '08.00 WIB', next_daily_at: nextRecommendationMorning(this.now()),
      whatsapp_connected: !!connection?.connected, whatsapp_status: connection?.status || (connection?.connected ? 'connected' : 'stopped') };
  }
  setEnabled(agent, enabled) { this.queue.enabled(agent, enabled); return this.status(agent); }
  reviewDelivery(agent, id, resolution) {
    if (!this.queue.review(agent, id, resolution)) throw new ServiceError('DELIVERY_NOT_FOUND', 404);
    return this.status(agent);
  }
  forAgent(agent) { return { setEnabled: (phone, enabled) => this.queue.recipientEnabled(agent, phone, enabled) }; }
  async stop() { this.stopping = true; await this.running; }
}
