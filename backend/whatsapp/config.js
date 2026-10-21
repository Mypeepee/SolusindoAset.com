import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BOT_CONTROL_PHONE } from './services/bot_control.js';

export const serviceDirectory = dirname(fileURLToPath(import.meta.url));

export function loadConfig(env = process.env) {
  const required = (key) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Konfigurasi ${key} wajib diisi.`);
    return value;
  };
  const integer = (key, fallback, min, max) => {
    const value = Number(env[key] || fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`Konfigurasi ${key} harus bilangan bulat ${min}–${max}.`);
    }
    return value;
  };
  const provider = env.LLM_PROVIDER || 'openai';
  if (!['openai', 'gemini'].includes(provider)) throw new Error('LLM_PROVIDER tidak valid.');
  const transport = env.WA_TRANSPORT || 'baileys';
  if (!['baileys', 'cloud'].includes(transport)) throw new Error('WA_TRANSPORT tidak valid.');
  let wa;
  if (transport === 'cloud') {
    const apiVersion = required('WA_API_VERSION');
    if (!/^v\d+\.\d+$/.test(apiVersion)) throw new Error('WA_API_VERSION harus seperti vXX.0.');
    const phoneNumberId = required('WA_PHONE_NUMBER_ID');
    if (!/^\d+$/.test(phoneNumberId)) throw new Error('WA_PHONE_NUMBER_ID harus berupa angka.');
    wa = { apiVersion, phoneNumberId, accessToken: required('WA_ACCESS_TOKEN'),
      appSecret: required('WA_APP_SECRET'), verifyToken: required('WA_VERIFY_TOKEN'),
      timeoutMs: integer('WA_TIMEOUT_MS', 10000, 1000, 60000) };
  } else {
    wa = { authFile: resolve(serviceDirectory, env.BAILEYS_AUTH_FILE || './.auth/session.sqlite'),
      timeoutMs: integer('WA_TIMEOUT_MS', 15000, 1000, 60000),
      maxReconnects: 8, maxContacts: integer('MAX_SESSIONS', 2000, 1, 100000) };
  }
  const adminToken = required('ADMIN_API_TOKEN');
  if (adminToken.length < 32) throw new Error('ADMIN_API_TOKEN minimal 32 karakter.');
  const stokerPhone = (env.STOKER_WHATSAPP_NUMBER || '6285707379606').replace(/[\s()+-]/g, '');
  if (!/^[1-9]\d{6,14}$/.test(stokerPhone)) throw new Error('STOKER_WHATSAPP_NUMBER harus nomor WhatsApp internasional yang valid.');
  const botControlPhone = (env.BOT_CONTROL_WHATSAPP_NUMBER || DEFAULT_BOT_CONTROL_PHONE).replace(/[\s()+-]/g, '');
  if (!/^[1-9]\d{6,14}$/.test(botControlPhone) || botControlPhone === stokerPhone) throw new Error('BOT_CONTROL_WHATSAPP_NUMBER harus nomor internasional valid yang berbeda dari nomor stoker.');
  const testClientPhone = (env.BOT_TEST_CLIENT_PHONE || '').replace(/[\s()+-]/g, '') || null;
  if (testClientPhone && !/^[1-9]\d{6,14}$/.test(testClientPhone)) throw new Error('BOT_TEST_CLIENT_PHONE harus nomor WhatsApp internasional yang valid.');
  let propertyDatabase = null;
  if (env.PROPERTY_API_URL || env.CHATBOT_PROPERTY_TOKEN) {
    const url = new URL(required('PROPERTY_API_URL'));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
      throw new Error('PROPERTY_API_URL harus HTTPS atau HTTP loopback tanpa kredensial/query.');
    }
    const token = required('CHATBOT_PROPERTY_TOKEN');
    if (token.length < 32 || token === adminToken) throw new Error('CHATBOT_PROPERTY_TOKEN harus token terpisah, minimal 32 karakter.');
    propertyDatabase = { url: url.href, token, timeoutMs: integer('PROPERTY_TIMEOUT_MS', 20000, 1000, 60000), maxAttempts: 3, totalTimeoutMs: 65000 };
  }
  let clientDatabase = null;
  if (env.CLIENT_API_URL || env.CHATBOT_CLIENT_TOKEN) {
    const url = new URL(required('CLIENT_API_URL'));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
      throw new Error('CLIENT_API_URL harus HTTPS atau HTTP loopback tanpa kredensial/query.');
    }
    const token = required('CHATBOT_CLIENT_TOKEN');
    if (token.length < 32 || token === adminToken || token === propertyDatabase?.token) throw new Error('CHATBOT_CLIENT_TOKEN harus token terpisah, minimal 32 karakter.');
    clientDatabase = { url: url.href, token, timeoutMs: integer('CLIENT_TIMEOUT_MS', 12000, 1000, 30000) };
  }
  return {
    production: env.NODE_ENV === 'production',
    host: env.HOST || '127.0.0.1',
    port: integer('PORT', 3100, 1, 65535),
    transport, wa, propertyDatabase, clientDatabase, stokerPhone, testClientPhone, botControlPhone,
    surveyBooking: clientDatabase ? { url: new URL('../surveys', clientDatabase.url.replace(/\/$/, '') + '/').href,
      token: clientDatabase.token, timeoutMs: Math.max(20000, clientDatabase.timeoutMs) } : null,
    recommendations: clientDatabase && transport === 'baileys' && env.AUTO_RECOMMENDATIONS !== '0' ? {
      url: new URL('../recommendations', clientDatabase.url.replace(/\/$/, '') + '/').href,
      token: clientDatabase.token, timeoutMs: Math.max(20000, clientDatabase.timeoutMs),
    } : null,
    mouDocument: propertyDatabase ? { url: new URL('./mou-draft', propertyDatabase.url).href,
      token: propertyDatabase.token, timeoutMs: 55000 } : null,
    llm: {
      provider, model: required('LLM_MODEL'),
      fallbackModel: env.LLM_FALLBACK_MODEL?.trim() || null,
      apiKey: required(provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'),
      timeoutMs: integer('LLM_TIMEOUT_MS', 30000, 1000, 120000),
    },
    adminToken,
    replyDelayMs: integer('REPLY_DELAY_MS', 2000, 0, 10000),
    manualReplyPauseMs: integer('MANUAL_REPLY_PAUSE_SECONDS', 300, -1, 86400) * 1000,
    maxAgentConnections: integer('MAX_AGENT_CONNECTIONS', 50, 1, 500),
    assetsFile: resolve(serviceDirectory, env.ASSETS_FILE || './data/assets.json'),
    defaultAssetId: env.DEFAULT_ASSET_ID?.trim() || null,
    maxSessions: integer('MAX_SESSIONS', 2000, 1, 100000),
    maxPending: integer('MAX_PENDING_MESSAGES', 500, 1, 10000),
    maxPendingPerPhone: integer('MAX_PENDING_PER_PHONE', 20, 1, 100),
    maxDedup: integer('MAX_DEDUP_ENTRIES', 20000, 1, 1000000),
    sessionTtlMs: integer('SESSION_TTL_HOURS', 24, 1, 720) * 3600000,
    sessionIdleMs: integer('SESSION_IDLE_MINUTES', 45, 30, 60) * 60000,
  };
}
