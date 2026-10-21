import { ServiceError } from '../lib/http.js';
import { IDLE_TIMEOUT_MS } from '../services/interaction_policy.js';
import { clientIdentity } from '../services/client_identity.js';
import { CLOSING_STATE, searchConversion } from '../services/closing_state.js';

export class MemoryStore {
  constructor(config, now = Date.now, control = null) {
    this.config = config;
    this.now = now;
    this.control = control;
    this.sessions = new Map();
    this.seen = new Map();
  }

  create(phone) {
    const paused = this.control?.get(phone);
    const conversion = this.control?.getConversion?.(phone) || searchConversion();
    const remembered = this.control?.getSearch?.(phone);
    const searchFresh = remembered && this.now() - remembered.last_user_received_at <= (this.config.sessionIdleMs || IDLE_TIMEOUT_MS);
    const session = {
      phone, is_bot_active: !paused, generation: 0,
      asset_id: conversion.mode === CLOSING_STATE ? conversion.asset_id : null, conversion, out_of_scope_notified: false,
      qualification: {}, history: [], lead_status: 'new', buyer_state: searchFresh || remembered?.buyer_state?.notification_search && remembered?.outbound_recommendation?.at > this.now() - 7 * 86400000 ? remembered.buyer_state : null,
      client_identity: remembered?.client_identity || { name: null, salutation: null, asked: false, declined: false },
      message_sequence: remembered?.message_sequence || 0,
      pending_reply: searchFresh && remembered.pending_reply?.expires_at > this.now() ? { ...remembered.pending_reply, recorded: false } : null,
      outbound_recommendation: remembered?.outbound_recommendation?.at > this.now() - 7 * 86400000 ? remembered.outbound_recommendation : null,
      last_user_at: searchFresh ? remembered.last_user_at : null, last_user_received_at: searchFresh ? remembered.last_user_received_at : null, updated_at: this.now(),
      handover: paused ? { ...paused, notice: 'not_requested' } : null, delivery_error: null,
      consultation: remembered?.consultation || null, survey_state: remembered?.survey_state || null,
    };
    this.sessions.set(phone, session);
    return session;
  }

  get(phone) { return this.sessions.get(phone); }

  rememberSearch(session) {
    this.control?.saveSearch?.(session.phone, { buyer_state: session.buyer_state, client_identity: session.client_identity,
      message_sequence: session.message_sequence || 0, last_user_at: session.last_user_at,
      last_user_received_at: session.last_user_received_at, pending_reply: session.pending_reply || null,
      outbound_recommendation: session.outbound_recommendation || null, consultation: session.consultation || null, survey_state: session.survey_state || null });
  }

  resetIfIdle(session) {
    if (session.last_user_received_at == null || this.now() - session.last_user_received_at <= (this.config.sessionIdleMs || IDLE_TIMEOUT_MS)) return false;
    session.history = []; session.asset_id = session.conversion?.mode === CLOSING_STATE ? session.conversion.asset_id : null; session.qualification = {};
    if (!session.buyer_state?.notification_search || !(session.outbound_recommendation?.at > this.now() - 7 * 86400000)) session.buyer_state = null;
    session.lead_status = 'new'; session.out_of_scope_notified = false;
    session.generation += 1;
    this.rememberSearch(session);
    // Human ownership is never revoked by a timer.
    return true;
  }

  append(session, role, content) {
    session.message_sequence = (session.message_sequence || 0) + 1;
    session.history.push({ role, content, seq: session.message_sequence });
    session.client_identity = clientIdentity(session.history, session.client_identity);
    while (session.history.length > 24 || session.history.reduce((sum, item) => sum + item.content.length, 0) > 24000) {
      session.history.shift();
    }
    // Beberapa provider mensyaratkan giliran pertama adalah user.
    while (session.history[0]?.role === 'assistant') session.history.shift();
    session.updated_at = this.now();
    this.rememberSearch(session);
  }

  setConversion(session, conversion) {
    this.control?.saveConversion?.(session.phone, conversion);
    session.conversion = conversion;
    session.updated_at = this.now();
  }

  pause(session, reason, { at = this.now(), resume_at = null } = {}) {
    if (!session.is_bot_active) return false;
    session.is_bot_active = false;
    session.generation += 1;
    session.handover = { reason, at, notice: 'pending', ...(resume_at != null ? { resume_at } : {}) };
    this.control?.pause(session.phone, reason, { at, resume_at });
    session.updated_at = this.now();
    return true;
  }

  cleanup(pendingPhones = new Map()) {
    const now = this.now();
    for (const [id, record] of this.seen) {
      if (!record.pending && record.expires_at <= now) this.seen.delete(id);
    }
    for (const [phone, session] of this.sessions) {
      if (!pendingPhones.has(phone) && now - session.updated_at > this.config.sessionTtlMs) {
        if (session.is_bot_active) this.sessions.delete(phone);
        else session.history = []; // Pause tidak boleh hilang hanya karena TTL.
      }
    }
  }

  assertCapacity(newPhones, newMessages) {
    if (this.sessions.size + newPhones > this.config.maxSessions || this.seen.size + newMessages > this.config.maxDedup) {
      throw new ServiceError('MEMORY_CAPACITY_REACHED', 503);
    }
  }
}
