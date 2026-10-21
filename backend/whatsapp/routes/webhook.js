import { Router, raw } from 'express';
import { secretsEqual, validPhone, validSignature } from '../lib/security.js';
import { ServiceError } from '../lib/http.js';
import { ignoredInbound } from '../services/interaction_policy.js';

export function extractMessages(payload, phoneNumberId, now = Date.now()) {
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    throw new ServiceError('INVALID_WEBHOOK_PAYLOAD', 400);
  }
  const messages = [];
  for (const entry of payload.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        if (!message || ignoredInbound(message) || typeof message.id !== 'string' || !message.id || message.id.length > 256 || !validPhone(message.from)) continue;
        const timestamp = Number(message.timestamp) * 1000;
        if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 300000) continue;
        const text = message.type === 'text' ? message.text?.body
          : message.type === 'interactive' ? (message.interactive?.button_reply?.title || message.interactive?.list_reply?.title)
          : message.type === 'button' ? message.button?.text : null;
        if (text != null && (typeof text !== 'string' || text.length > 4096)) continue;
        messages.push({ id: message.id, from: message.from, timestamp: Math.min(timestamp, now), text: text?.trim() || null, type: message.type || 'unknown' });
      }
    }
  }
  return messages;
}

export function createWebhookRouter(config, processor, now = Date.now) {
  const router = Router();
  router.get('/', (req, res) => {
    if (req.query['hub.mode'] !== 'subscribe' || !secretsEqual(req.query['hub.verify_token'], config.verifyToken) ||
        typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
    return res.status(200).type('text/plain').send(req.query['hub.challenge']);
  });
  // Raw body harus dipertahankan sebelum parsing; hash JSON.stringify(body) tidak valid.
  router.post('/', raw({ type: 'application/json', limit: '256kb', inflate: false }), (req, res) => {
    if (!validSignature(req.body, req.get('X-Hub-Signature-256'), config.appSecret)) return res.sendStatus(403);
    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); }
    catch { throw new ServiceError('INVALID_JSON', 400); }
    processor.acceptBatch(extractMessages(payload, config.phoneNumberId, now()));
    // Status/delivery receipts ikut di-ACK, tanpa memicu LLM. Antrean bekerja setelah ACK.
    res.status(200).send('EVENT_RECEIVED');
  });
  return router;
}
