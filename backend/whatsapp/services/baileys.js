import makeWASocket, { Browsers, DisconnectReason, jidNormalizedUser, normalizeMessageContent, generateMessageIDV2 } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { createBaileysAuth } from '../state/baileys_auth.js';
import { ServiceError, logFailure } from '../lib/http.js';
import { validatePdf } from './mou_document.js';
import { validContact, validPhone } from '../lib/security.js';
import { ignoredInbound } from './interaction_policy.js';

const directJid = (jid) => typeof jid === 'string' && /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid);
const terminalReasons = new Map([
  [DisconnectReason.loggedOut, 'logged_out'], [DisconnectReason.connectionReplaced, 'replaced'],
  [DisconnectReason.badSession, 'bad_session'], [DisconnectReason.forbidden, 'forbidden'],
  [DisconnectReason.multideviceMismatch, 'bad_session'],
]);

export function extractBaileysContent(message) {
  const content = normalizeMessageContent(message);
  if (!content) return null;
  const text = content.conversation ?? content.extendedTextMessage?.text ??
    content.buttonsResponseMessage?.selectedDisplayText ?? content.listResponseMessage?.title;
  if (typeof text === 'string') return text.trim() && text.length <= 4096 ? { type: 'text', text: text.trim() } : null;
  for (const type of ['image', 'video', 'audio', 'document', 'sticker', 'contact', 'location']) {
    if (content[`${type}Message`]) return { type, text: null };
  }
  // Reaction, receipt, edit dan pesan protokol tidak menjadi prompt AI.
  return null;
}

export class BaileysClient {
  constructor(config, {
    socketFactory = makeWASocket, authFactory = createBaileysAuth,
    qrEncoder = (qr) => QRCode.toDataURL(qr, { width: 300, margin: 2 }),
    logger = console, now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  } = {}) {
    Object.assign(this, { config, socketFactory, authFactory, qrEncoder, logger, now, schedule, cancel });
    this.socketLogger = pino({ level: 'silent' }); // QR, Signal keys dan isi pesan tidak masuk log.
    this.state = 'stopped';
    this.socket = null;
    this.auth = null;
    this.stopped = true;
    this.retries = 0;
    this.qr = null;
    this.code = null;
    this.reconnectTimer = null;
    this.aliases = new Map();
    this.destinations = new Map();
    this.messageCache = new Map();
    this.outboundIds = new Set();
    this.inbound = Promise.resolve();
    this.queuedBatches = 0;
    this.received = 0;
    this.sent = 0;
    this.lastError = null;
    this.lastMessageAt = null;
    this.lastPairingAt = 0;
  }

  getStatus() {
    return { transport: 'baileys', status: this.state, connected: this.state === 'connected',
      phone: this.socket?.user?.id ? jidNormalizedUser(this.socket.user.id).split('@')[0] : null,
      qr_ready: !!this.qr, pairing_code_ready: !!this.code, received: this.received, sent: this.sent,
      last_message_at: this.lastMessageAt, last_error: this.lastError, reconnect_attempts: this.retries };
  }

  getPairing() { return { qr: this.qr, code: this.code }; }

  start(onMessages) {
    if (this.disconnecting) throw new ServiceError('CONVERSATION_BUSY', 409);
    this.onMessages = onMessages;
    this.auth ||= this.authFactory(this.config.authFile);
    this.stopped = false;
    this.connect();
  }

  detach() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    for (const event of ['connection.update', 'creds.update', 'messages.upsert']) socket.ev.removeAllListeners(event);
    socket.end(new Error('Local connection stopped'));
  }

  connect() {
    if (this.stopped || this.socket) return;
    this.state = 'connecting';
    this.qr = null;
    this.code = null;
    let socket;
    try {
      socket = this.socketFactory({
        auth: this.auth.state, logger: this.socketLogger, browser: Browsers.macOS('Chrome'),
        // Sinkronisasi awal diperlukan untuk pemetaan LID dan kunci sesi.
        // Riwayat tetap disaring pada messages.upsert agar tidak dijawab AI.
        markOnlineOnConnect: false, syncFullHistory: false,
        emitOwnEvents: false, shouldIgnoreJid: (jid) => !!jid && !directJid(jid),
        connectTimeoutMs: 30000, defaultQueryTimeoutMs: 15000, qrTimeout: 60000,
        getMessage: async (key) => this.messageCache.get(`${key.remoteJid}/${key.id}`),
      });
    } catch (error) {
      this.lastError = 'CONNECTION_FAILED';
      logFailure(this.logger, 'baileys_connect_failed', error);
      this.retry();
      return;
    }
    this.socket = socket;
    socket.ev.on('creds.update', () => {
      if (socket !== this.socket) return;
      try { this.auth.saveCreds(); }
      catch (error) {
        this.state = 'auth_error'; this.lastError = 'AUTH_SAVE_FAILED';
        this.detach();
        logFailure(this.logger, 'baileys_auth_failed', error);
      }
    });
    socket.ev.on('connection.update', (update) => {
      this.updateConnection(socket, update).catch((error) => logFailure(this.logger, 'baileys_connection_event_failed', error));
    });
    socket.ev.on('messages.upsert', (event) => {
      if (socket !== this.socket || event.type !== 'notify') return;
      if (this.queuedBatches >= 100) { this.lastError = 'INBOUND_QUEUE_FULL'; return; }
      this.queuedBatches += 1;
      this.inbound = this.inbound.then(() => this.receive(socket, event)).catch((error) => {
        this.lastError = error.code || 'INBOUND_FAILED';
        logFailure(this.logger, 'baileys_inbound_failed', error);
      }).finally(() => { this.queuedBatches -= 1; });
    });
  }

  async updateConnection(socket, { connection, qr, lastDisconnect, isNewLogin }) {
    if (socket !== this.socket || this.stopped) return;
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      this.qr = null; this.code = null;
      this.detach();
      if (terminalReasons.has(reason)) {
        this.state = terminalReasons.get(reason);
        this.lastError = `DISCONNECTED_${reason}`;
      } else this.retry(reason === DisconnectReason.restartRequired);
      this.logger.info?.({ event: 'whatsapp_disconnected', status: this.state, code: reason || null });
      return;
    }
    if (connection === 'open') {
      this.state = 'connected'; this.retries = 0; this.lastError = null;
      this.qr = null; this.code = null;
      this.logger.info?.({ event: 'whatsapp_connected', transport: 'baileys' });
      return;
    }
    if (isNewLogin) {
      this.state = 'pairing'; this.qr = null; this.code = null; this.latestQr = null;
      return;
    }
    if (qr && !this.code) {
      this.latestQr = qr;
      const image = await this.qrEncoder(qr);
      if (socket === this.socket && this.state !== 'connected' && this.latestQr === qr && !this.code) {
        this.qr = image;
        this.state = 'awaiting_scan';
      }
    }
  }

  retry(immediate = false) {
    if (this.stopped || this.reconnectTimer) return;
    if (this.retries >= this.config.maxReconnects) {
      this.state = 'connection_failed'; this.lastError = 'RECONNECT_LIMIT'; return;
    }
    this.retries += 1;
    this.state = 'reconnecting';
    const delay = immediate ? 250 : Math.min(1000 * 2 ** (this.retries - 1), 30000);
    this.reconnectTimer = this.schedule(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer?.unref?.();
  }

  async requestPairingCode(phone) {
    if (!validPhone(phone)) throw new ServiceError('INVALID_PHONE', 400);
    if (!this.socket || this.state !== 'awaiting_scan' || this.auth.state.creds.registered) {
      throw new ServiceError('PAIRING_NOT_READY', 409);
    }
    if (this.now() - this.lastPairingAt < 60000) throw new ServiceError('PAIRING_RATE_LIMIT', 429);
    this.lastPairingAt = this.now();
    const socket = this.socket;
    this.state = 'requesting_code';
    try {
      const code = await socket.requestPairingCode(phone);
      if (socket !== this.socket) throw new ServiceError('CONNECTION_CHANGED', 409);
      this.code = code; this.qr = null; this.state = 'awaiting_code';
      return { code };
    } catch (error) {
      if (socket === this.socket) this.state = this.qr ? 'awaiting_scan' : 'connecting';
      throw new ServiceError(error.code || 'PAIRING_FAILED', 502);
    }
  }

  reconnect({ reset = false } = {}) {
    if (this.disconnecting) throw new ServiceError('CONVERSATION_BUSY', 409);
    if (this.state === 'connected') throw new ServiceError('ALREADY_CONNECTED', 409);
    if (reset && !['logged_out', 'bad_session', 'forbidden', 'replaced', 'auth_error'].includes(this.state)) {
      throw new ServiceError('RESET_NOT_REQUIRED', 409);
    }
    if (!reset && ['logged_out', 'bad_session', 'forbidden', 'replaced'].includes(this.state)) {
      throw new ServiceError('PAIR_AGAIN_REQUIRED', 409);
    }
    this.cancel(this.reconnectTimer); this.reconnectTimer = null;
    this.detach();
    if (reset) {
      this.auth.reset();
      this.aliases.clear(); this.destinations.clear(); this.messageCache.clear();
      this.received = 0; this.sent = 0; this.lastMessageAt = null; this.lastPairingAt = 0;
    }
    this.retries = 0; this.lastError = null; this.stopped = false;
    this.connect();
  }

  async resolveContact(socket, key) {
    const primary = jidNormalizedUser(key.remoteJid);
    const aliases = [primary];
    if (directJid(key.remoteJidAlt)) aliases.push(jidNormalizedUser(key.remoteJidAlt));
    if (primary.endsWith('@lid') && aliases.length === 1) {
      const phoneJid = await socket.signalRepository?.lidMapping?.getPNForLID(primary);
      if (directJid(phoneJid)) aliases.push(jidNormalizedUser(phoneJid));
    }
    const known = aliases.map((jid) => this.aliases.get(jid)).filter(Boolean);
    if (new Set(known).size > 1) throw new ServiceError('CONTACT_ALIAS_CONFLICT', 409);
    const phone = aliases.find((jid) => jid.endsWith('@s.whatsapp.net'))?.split('@')[0];
    const contact = known[0] || (validPhone(phone) ? phone : `lid:${primary.split('@')[0]}`);
    if (!validContact(contact)) throw new ServiceError('INVALID_CONTACT', 400);
    if (!this.destinations.has(contact) && this.destinations.size >= this.config.maxContacts) {
      throw new ServiceError('CONTACT_CAPACITY_REACHED', 503);
    }
    for (const alias of aliases) this.aliases.set(alias, contact);
    this.destinations.set(contact, primary);
    return contact;
  }

  getContactPhone(contact) {
    if (validPhone(contact)) return contact;
    for (const [jid, mapped] of this.aliases) {
      if (mapped === contact && jid.endsWith('@s.whatsapp.net') && validPhone(jid.split('@')[0])) return jid.split('@')[0];
    }
    return null; // A WhatsApp LID is not a phone number.
  }

  getContactAliases(contact) {
    const primary = this.aliases.get(contact.startsWith('lid:') ? `${contact.slice(4)}@lid` : `${contact}@s.whatsapp.net`) || contact;
    const contacts = new Set([contact, primary]);
    for (const [jid, mapped] of this.aliases) {
      if (mapped !== primary) continue;
      contacts.add(jid.endsWith('@lid') ? `lid:${jid.split('@')[0]}` : jid.split('@')[0]);
    }
    return [...contacts];
  }

  cache(key, message) {
    this.messageCache.set(`${key.remoteJid}/${key.id}`, message);
    while (this.messageCache.size > 1000) this.messageCache.delete(this.messageCache.keys().next().value);
  }

  async receive(socket, event) {
    if (this.stopped || socket !== this.socket) return;
    for (const message of event.messages || []) {
      const key = message.key;
      if (!key?.id || !directJid(key.remoteJid)) continue;
      if (!key.fromMe && ignoredInbound(message)) continue;
      const content = extractBaileysContent(message.message);
      if (!content) continue;
      const timestamp = Number(message.messageTimestamp) * 1000;
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > this.now() + 300000 || this.now() - timestamp > 86400000) continue;
      const contact = await this.resolveContact(socket, key);
      if (key.fromMe) {
        if (!this.outboundIds.has(key.id) && !this.config.control?.isOutbound(key.id)) {
          this.onMessages([{ id: `${contact}/${key.id}`, from: contact, timestamp: Math.min(timestamp, this.now()), type: 'human_takeover', text: content.type === 'text' ? content.text : null,
            whatsapp_id: key.id, whatsapp_jid: key.remoteJid }]);
        }
        continue;
      }
      this.cache(key, message.message);
      const accepted = this.onMessages([{ id: `${contact}/${key.id}`, from: contact,
        timestamp: Math.min(timestamp, this.now()), ...content }]);
      this.received += accepted;
      if (accepted) this.lastMessageAt = this.now();
    }
  }

  async sendText(contact, text, replyTo, options = {}) {
    if (!validContact(contact) || typeof text !== 'string' || !text.trim() || text.length > 4096) {
      throw new ServiceError('INVALID_OUTBOUND_MESSAGE', 400);
    }
    return this.sendContent(contact, { text }, options);
  }

  async acknowledgeOwnerCommand(message, command) {
    if (!directJid(message.whatsapp_jid) || !/^[A-Za-z0-9_-]{1,100}$/.test(message.whatsapp_id || '') || !['on', 'off'].includes(command)) return;
    return this.sendContent(message.from, { react: { text: command === 'on' ? '✅' : '⏸️',
      key: { remoteJid: message.whatsapp_jid, id: message.whatsapp_id, fromMe: true } } }, { countAsReply: false });
  }

  async acknowledgeControlCommand(message, text) {
    if (message.type !== 'human_takeover' || !directJid(message.whatsapp_jid) || !/^[A-Za-z0-9_-]{1,100}$/.test(message.whatsapp_id || '') || typeof text !== 'string' || text.length > 1024) return;
    return this.sendContent(message.from, { text }, { countAsReply: false });
  }

  async sendDocument(contact, file, caption = '', replyTo) {
    validatePdf(file);
    if (!validContact(contact) || typeof caption !== 'string' || caption.length > 1024) throw new ServiceError('INVALID_OUTBOUND_MESSAGE', 400);
    return this.sendContent(contact, { document: file.buffer, mimetype: 'application/pdf', fileName: file.filename, caption });
  }

  async sendContent(contact, content, { messageId: persistedId, countAsReply = true } = {}) {
    if (this.state !== 'connected' || !this.socket) throw new ServiceError('WHATSAPP_NOT_CONNECTED', 503);
    const jid = this.destinations.get(contact) || (contact.startsWith('lid:') ? `${contact.slice(4)}@lid` : `${contact}@s.whatsapp.net`);
    let timer;
    if (persistedId != null && !/^[A-F0-9]{20,64}$/.test(persistedId)) throw new ServiceError('INVALID_OUTBOUND_MESSAGE', 400);
    const messageId = persistedId || generateMessageIDV2(this.socket.user?.id);
    this.outboundIds.add(messageId);
    this.config.control?.markOutbound(messageId);
    while (this.outboundIds.size > 10000) this.outboundIds.delete(this.outboundIds.values().next().value);
    try {
      const result = await Promise.race([
        this.socket.sendMessage(jid, content, { messageId }),
        new Promise((resolve, reject) => { timer = setTimeout(() => reject(new ServiceError('WA_SEND_TIMEOUT', 504)), this.config.timeoutMs); }),
      ]);
      if (!result?.key?.id) throw new ServiceError('INVALID_WA_RESPONSE', 502);
      this.outboundIds.add(result.key.id);
      this.config.control?.markOutbound(result.key.id);
      this.cache(result.key, result.message);
      if (countAsReply) this.sent += 1;
      return result.key.id;
    } finally { clearTimeout(timer); }
  }

  async disconnect() {
    if (this.disconnecting) throw new ServiceError('CONVERSATION_BUSY', 409);
    this.disconnecting = true;
    this.stopped = true;
    this.state = 'stopped';
    this.cancel(this.reconnectTimer); this.reconnectTimer = null;
    this.qr = null; this.code = null;
    // Logout revokes this linked device. Stop always cancels local reconnects,
    // including when WhatsApp cannot acknowledge logout.
    const socket = this.socket;
    try {
      try {
        if (socket) await socket.logout();
      } finally {
        await this.stop();
      }
      this.auth?.reset();
      this.state = this.auth ? 'logged_out' : 'stopped';
    } finally { this.disconnecting = false; }
  }

  async stop() {
    this.stopped = true;
    this.cancel(this.reconnectTimer); this.reconnectTimer = null;
    this.detach(); this.qr = null; this.code = null; this.state = 'stopped';
    await this.inbound;
  }
}
