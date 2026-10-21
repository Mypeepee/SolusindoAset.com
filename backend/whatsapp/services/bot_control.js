import { validPhone } from '../lib/security.js';

export const DEFAULT_BOT_CONTROL_PHONE = '6282266100102';
export function parseBotControlCommand(text = '') {
  const value = typeof text === 'string' ? text.normalize('NFKC').trim() : '';
  if (!/^#bot\s*(?:on|off)(?:\s|$)/i.test(value)) return null;
  const match = /^#bot\s*(on|off)(?:\s+(.+))?$/i.exec(value);
  const raw = match?.[2]?.trim();
  if (!match || !raw || !/^\+?[\d\s().-]+$/.test(raw)) return { error: 'INVALID_TARGET' };
  const target = raw.replace(/[\s()+.-]/g, '').replace(/^0/, '62');
  return validPhone(target) ? { command: match[1].toLowerCase(), target } : { error: 'INVALID_TARGET' };
}
export const botControlHelp = 'Format perintah: #botoff 628xxxxxxxxxx untuk menjeda tanpa batas waktu, atau #boton 628xxxxxxxxxx untuk mengaktifkan kembali. Gunakan satu nomor klien per pesan.';
