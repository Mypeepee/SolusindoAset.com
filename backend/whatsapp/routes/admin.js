import { Router, json } from 'express';
import { secretsEqual, validContact } from '../lib/security.js';
import { ServiceError } from '../lib/http.js';

export function createAdminRouter({ token, store, processor, whatsapp, checks, clients = processor?.clients, notifications, agentId }) {
  const router = Router();
  router.use((req, res, next) => {
    const header = req.get('Authorization');
    if (!header?.startsWith('Bearer ') || !secretsEqual(header.slice(7), token)) return res.sendStatus(401);
    next();
  });
  router.use(json({ limit: '16kb' }));
  router.get('/recommendations', (req, res) => {
    res.json(notifications && agentId ? notifications.status(agentId) : { configured: false });
  });
  router.patch('/recommendations', (req, res) => {
    if (!notifications || !agentId) throw new ServiceError('RECOMMENDATIONS_NOT_CONFIGURED', 503);
    if (!req.is('application/json') || !req.body || Array.isArray(req.body)) throw new ServiceError('INVALID_REQUEST', 400);
    if (Object.keys(req.body).join(',') === 'enabled' && typeof req.body.enabled === 'boolean') {
      res.json(notifications.setEnabled(agentId, req.body.enabled)); void notifications.flush(); return;
    }
    if (Object.keys(req.body).sort().join(',') === 'delivery_id,resolution' && /^[a-f0-9-]{36}$/.test(req.body.delivery_id) && ['delivered', 'skipped'].includes(req.body.resolution)) {
      res.json(notifications.reviewDelivery(agentId, req.body.delivery_id, req.body.resolution)); return;
    }
    throw new ServiceError('INVALID_REQUEST', 400);
  });
  router.param('phone', (req, res, next, phone) => {
    if (!validContact(phone)) throw new ServiceError('INVALID_CONTACT', 400);
    next();
  });
  router.get('/whatsapp/status', (req, res) => {
    res.json({ ...(whatsapp?.getStatus?.() || { transport: 'cloud', status: 'not_probed', connected: null }),
      bot_accepting: typeof processor?.accepting === 'boolean' ? processor.accepting : null,
      handovers: processor.listConversations?.().attention ?? [...store.sessions.values()].filter((session) => !session.is_bot_active).length });
  });
  router.get('/client-capture', (req, res) => {
    res.json(clients ? clients.status() : { configured: false, pending: null, retrying: null, last_saved_at: null, probe: null });
  });
  router.post('/client-capture/check', async (req, res) => {
    if (!clients) throw new ServiceError('CLIENT_CAPTURE_NOT_CONFIGURED', 503);
    if (!req.is('application/json') || !req.body || Array.isArray(req.body) || Object.keys(req.body).length) throw new ServiceError('INVALID_REQUEST', 400);
    res.json(await clients.checkDatabase());
  });
  router.post('/whatsapp/connect', (req, res) => {
    if (!whatsapp?.start) throw new ServiceError('PAIRING_UNAVAILABLE', 409);
    const state = whatsapp.getStatus().status;
    if (!whatsapp.auth) whatsapp.start((messages) => processor.acceptBatch(messages));
    else if (!['connected', 'connecting', 'reconnecting', 'pairing', 'awaiting_scan', 'requesting_code', 'awaiting_code'].includes(state)) whatsapp.reconnect();
    void notifications?.flush();
    res.status(202).json(whatsapp.getStatus());
  });
  router.get('/whatsapp/pairing', (req, res) => {
    if (!whatsapp?.getPairing) throw new ServiceError('PAIRING_UNAVAILABLE', 409);
    res.json(whatsapp.getPairing());
  });
  router.post('/whatsapp/disconnect', async (req, res) => {
    if (!whatsapp?.disconnect) throw new ServiceError('PAIRING_UNAVAILABLE', 409);
    if (processor.pending || checks?.running) throw new ServiceError('CONVERSATION_BUSY', 409);
    const accepting = processor.accepting;
    processor.accepting = false;
    try {
      await whatsapp.disconnect();
      res.json(whatsapp.getStatus());
    } finally {
      processor.accepting = accepting;
    }
  });
  router.post('/whatsapp/pairing-code', async (req, res) => {
    if (!whatsapp?.requestPairingCode) throw new ServiceError('PAIRING_UNAVAILABLE', 409);
    res.json(await whatsapp.requestPairingCode(req.body?.phone));
  });
  router.post('/whatsapp/reconnect', (req, res) => {
    if (!whatsapp?.reconnect) throw new ServiceError('PAIRING_UNAVAILABLE', 409);
    const reset = req.body?.reset === true;
    if (reset && processor.pending) throw new ServiceError('CONVERSATION_BUSY', 409);
    whatsapp.reconnect({ reset });
    if (reset) { store.sessions.clear(); store.seen.clear(); }
    res.status(202).json(whatsapp.getStatus());
  });
  router.get('/leads', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const leads = [...store.sessions.values()].filter((session) => !session.is_bot_active)
      .sort((a, b) => b.updated_at - a.updated_at);
    res.json({
      total: leads.length,
      items: leads.slice(offset, offset + limit).map(({ history, generation, ...lead }) => lead),
    });
  });
  router.get('/asset-checks', (req, res) => {
    if (!checks) throw new ServiceError('ASSET_CHECK_UNAVAILABLE', 503);
    res.json(checks.list());
  });
  router.patch('/asset-checks/:checkId', (req, res) => {
    if (!checks) throw new ServiceError('ASSET_CHECK_UNAVAILABLE', 503);
    if (req.body?.status !== 'completed' || Object.keys(req.body).some((key) => !['status', 'result', 'reference'].includes(key))) throw new ServiceError('INVALID_ASSET_CHECK', 400);
    const { result, reference } = req.body;
    res.json(checks.complete(req.params.checkId, result != null || reference != null ? { result, reference } : {}));
  });
  router.post('/asset-checks/:checkId/retry', async (req, res, next) => {
    try {
      if (!checks?.retry) throw new ServiceError('ASSET_CHECK_UNAVAILABLE', 503);
      if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) throw new ServiceError('INVALID_ASSET_CHECK', 400);
      res.json(await checks.retry(req.params.checkId));
    } catch (error) { next(error); }
  });
  router.get('/conversations/:phone', (req, res) => {
    const session = store.get(req.params.phone);
    if (!session) throw new ServiceError('CONVERSATION_NOT_FOUND', 404);
    res.json(session);
  });
  router.get('/conversations', (req, res) => {
    if (processor.listConversations) return res.json(processor.listConversations());
    const contacts = new Map((store.control?.list() || []).map((row) => [row.contact, { contact: row.contact, is_bot_active: false, updated_at: row.at, reason: row.reason }]));
    for (const session of store.sessions.values()) {
      const contact = whatsapp.getContactPhone?.(session.phone) || session.phone;
      if (contact !== session.phone) contacts.delete(session.phone);
      contacts.set(contact, { contact, is_bot_active: session.is_bot_active, updated_at: session.updated_at, reason: session.handover?.reason || null });
    }
    const items = [...contacts.values()];
    res.json({ total: items.length, attention: items.filter((row) => !row.is_bot_active).length,
      items: items.sort((a, b) => Number(a.is_bot_active) - Number(b.is_bot_active) || b.updated_at - a.updated_at).slice(0, 100) });
  });
  router.patch('/conversations/:phone/bot', (req, res) => {
    if (typeof req.body?.is_bot_active !== 'boolean' || req.body.replay_pending != null && typeof req.body.replay_pending !== 'boolean') throw new ServiceError('BOOLEAN_REQUIRED', 400);
    const session = processor.setBotActive(req.params.phone, req.body.is_bot_active, { replayPending: req.body.replay_pending !== false });
    res.json({ phone: session.phone, is_bot_active: session.is_bot_active });
  });
  router.post('/conversations/:phone/closing-outcome', (req, res) => {
    res.json({ conversion: processor.recordClosingOutcome(req.params.phone, req.body) });
  });
  router.post('/conversations/:phone/messages', async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim() || text.length > 4096) throw new ServiceError('INVALID_TEXT', 400);
    const messageId = await processor.sendHumanMessage(req.params.phone, text.trim());
    res.status(202).json({ message_id: messageId, status: 'accepted_by_whatsapp' });
  });
  return router;
}
