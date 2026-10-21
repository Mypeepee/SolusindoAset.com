import { postJson, ServiceError } from '../lib/http.js';
import { validPhone } from '../lib/security.js';
import { validatePdf } from './mou_document.js';

export function createWhatsAppClient(config, { fetchImpl = fetch } = {}) {
  return {
    async sendDocument(to, file, caption = '', replyTo) {
      validatePdf(file);
      if (!validPhone(to) || typeof caption !== 'string' || caption.length > 1024) throw new ServiceError('INVALID_OUTBOUND_MESSAGE', 400);
      const form = new FormData();
      form.set('messaging_product', 'whatsapp'); form.set('type', 'application/pdf');
      form.set('file', new Blob([file.buffer], { type: 'application/pdf' }), file.filename);
      const uploaded = await fetchImpl(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.accessToken}` }, body: form,
        signal: AbortSignal.timeout(config.timeoutMs), redirect: 'error' });
      if (!uploaded.ok) throw new ServiceError('WA_MEDIA_UPLOAD_FAILED', 502);
      const media = await uploaded.json();
      if (typeof media.id !== 'string' || !/^\d+$/.test(media.id)) throw new ServiceError('INVALID_WA_RESPONSE', 502);
      const data = await postJson(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
        headers: { Authorization: `Bearer ${config.accessToken}` }, body: { messaging_product: 'whatsapp', recipient_type: 'individual', to,
          type: 'document', document: { id: media.id, filename: file.filename, caption },
          ...(replyTo ? { context: { message_id: replyTo } } : {}) }, timeoutMs: config.timeoutMs, fetchImpl });
      if (!data.messages?.[0]?.id) throw new ServiceError('INVALID_WA_RESPONSE', 502);
      return data.messages[0].id;
    },
    async sendText(to, text, replyTo) {
      if (!validPhone(to) || typeof text !== 'string' || !text.trim() || text.length > 4096) {
        throw new ServiceError('INVALID_OUTBOUND_MESSAGE', 400);
      }
      const data = await postJson(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
        body: {
          messaging_product: 'whatsapp', recipient_type: 'individual', to,
          type: 'text', text: { preview_url: false, body: text },
          ...(replyTo ? { context: { message_id: replyTo } } : {}),
        },
        timeoutMs: config.timeoutMs, fetchImpl,
      });
      if (!data.messages?.[0]?.id) throw new ServiceError('INVALID_WA_RESPONSE', 502);
      return data.messages[0].id;
    },
  };
}
