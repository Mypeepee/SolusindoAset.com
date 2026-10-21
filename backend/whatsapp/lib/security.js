import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function secretsEqual(actual, expected) {
  if (typeof actual !== 'string' || actual.length > 1024) return false;
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(actual), hash(expected));
}

export function validSignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !/^sha256=[a-f\d]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), expected);
}

export const validPhone = (phone) => typeof phone === 'string' && /^[1-9]\d{6,14}$/.test(phone);
// LID bukan nomor telepon. Jangan mengirimkannya ke JID nomor (@s.whatsapp.net).
export const validContact = (id) => validPhone(id) || (typeof id === 'string' && /^lid:\d{1,30}$/.test(id));

export function normalizeText(text) {
  return text.normalize('NFKC').toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
