import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaileysClient } from '../services/baileys.js';
import { createBaileysAuth } from '../state/baileys_auth.js';
import { loadConfig } from '../config.js';
import { createApp } from '../app.js';
import { MemoryStore } from '../state/memory_store.js';
import { MessageProcessor } from '../services/message_processor.js';
import { Catalog } from '../services/catalog.js';
import { HANDOVER_MESSAGE } from '../services/ai_controller.js';
import { ConversationControl } from '../state/conversation_control.js';
import { DEFAULT_BOT_CONTROL_PHONE as CONTROL } from '../services/bot_control.js';

const NOW = Date.parse('2026-10-08T10:00:00+07:00');
const PHONE = '6281234567890';
const config = () => loadConfig({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'test-model', GEMINI_API_KEY: 'fake-key', ADMIN_API_TOKEN: 'a'.repeat(32) });
const incoming = (id, text, jid = `${PHONE}@s.whatsapp.net`, extra = {}) => ({
  key: { id, remoteJid: jid, ...extra }, messageTimestamp: NOW / 1000, message: { conversation: text },
});

function fixture(options = {}) {
  const sockets = [], received = [], sent = [], timers = [];
  const auth = { state: { creds: {}, keys: {} }, saveCreds: () => {}, reset: () => { auth.state.creds = {}; } };
  const client = new BaileysClient(config().wa, {
    authFactory: () => auth, now: () => NOW,
    qrEncoder: async () => 'data:image/png;base64,test',
    logger: { info() {}, error() {} },
    schedule: (fn) => { const timer = { fn, cancelled: false }; timers.push(timer); return timer; },
    cancel: (timer) => { if (timer) timer.cancelled = true; },
    socketFactory: (socketConfig) => {
      const socket = { ev: new EventEmitter(), user: { id: `${PHONE}:7@s.whatsapp.net` }, socketConfig,
        authState: auth.state, end() { this.ended = true; },
        requestPairingCode: async () => 'ABCDEFGH',
        sendMessage: async (jid, message) => {
          sent.push({ jid, message });
          return { key: { id: `out-${sent.length}`, remoteJid: jid }, message };
        },
      };
      sockets.push(socket); return socket;
    },
    ...options,
  });
  client.start((batch) => { received.push(...batch); return batch.length; });
  return { client, sockets, received, sent, timers, auth };
}

test('Baileys adalah default dan tidak memerlukan credential Meta', () => {
  const c = config();
  assert.equal(c.transport, 'baileys');
  assert.ok(c.wa.authFile.endsWith('session.sqlite'));
  assert.equal(c.wa.accessToken, undefined);
  assert.throws(() => loadConfig({ WA_TRANSPORT: 'other' }), /WA_TRANSPORT/);
});

test('QR hanya tersedia pada endpoint pairing dan dihapus setelah tersambung', async () => {
  const f = fixture();
  await f.client.updateConnection(f.sockets[0], { qr: 'qr-secret' });
  assert.equal(f.client.getStatus().status, 'awaiting_scan');
  assert.equal(f.client.getStatus().qr, undefined);
  assert.match(f.client.getPairing().qr, /^data:image/);
  await f.client.updateConnection(f.sockets[0], { isNewLogin: true });
  assert.equal(f.client.getStatus().status, 'pairing');
  assert.equal(f.client.getPairing().qr, null);
  await f.client.updateConnection(f.sockets[0], { connection: 'open' });
  assert.equal(f.client.getStatus().connected, true);
  assert.equal(f.client.getStatus().phone, PHONE);
  assert.deepEqual(f.client.getPairing(), { qr: null, code: null });
  await f.client.stop();
});

test('QR yang selesai dibuat setelah socket tersambung tidak muncul kembali', async () => {
  let finish;
  const f = fixture({ qrEncoder: () => new Promise((resolve) => { finish = resolve; }) });
  const rendering = f.client.updateConnection(f.sockets[0], { qr: 'secret' });
  await f.client.updateConnection(f.sockets[0], { connection: 'open' });
  finish('stale-image');
  await rendering;
  assert.equal(f.client.getPairing().qr, null);
  await f.client.stop();
});

test('pesan pribadi diproses; pesan manual Owner menjadi takeover, grup/status/reaction/history diabaikan', async () => {
  const f = fixture();
  const socket = f.sockets[0];
  socket.ev.emit('messages.upsert', { type: 'append', messages: [incoming('history', 'lama')] });
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [
    incoming('group', 'grup', '123@g.us'), incoming('status', 'status', 'status@broadcast'),
    incoming('own', 'milik bot', undefined, { fromMe: true }),
    { ...incoming('reaction', ''), message: { reactionMessage: { text: '👍' } } },
    incoming('one', 'Halo'),
    { ...incoming('two', ''), message: { ephemeralMessage: { message: { extendedTextMessage: { text: 'Mau survei lokasi' } } } } },
  ] });
  await f.client.inbound;
  assert.equal(f.received[0].type, 'human_takeover');
  assert.deepEqual(f.received.filter((m) => m.type !== 'human_takeover').map((m) => m.text), ['Halo', 'Mau survei lokasi']);
  assert.equal(f.received[0].from, PHONE);
  assert.equal(f.client.getStatus().received, 2);
  assert.equal(socket.socketConfig.syncFullHistory, false);
  assert.equal(socket.socketConfig.shouldSyncHistoryMessage, undefined, 'sinkronisasi awal memakai default Baileys');
  await f.client.stop();
});

test('echo balasan bot yang tiba sebelum sendMessage selesai tidak dianggap Owner mengambil alih', async () => {
  const f = fixture(); const socket = f.sockets[0];
  await f.client.updateConnection(socket, { connection: 'open' });
  socket.sendMessage = async (jid, message, options) => {
    await f.client.receive(socket, { type: 'notify', messages: [incoming(options.messageId, message.text, jid, { fromMe: true })] });
    return { key: { id: options.messageId, remoteJid: jid }, message };
  };
  await f.client.sendText(PHONE, 'Balasan otomatis');
  assert.deepEqual(f.received, []);
  await f.client.receive(socket, { type: 'notify', messages: [incoming('owner-reply', 'Saya bantu langsung ya', undefined, { fromMe: true })] });
  assert.equal(f.received[0].type, 'human_takeover');
  await f.client.stop();
});

test('LID tidak diperlakukan sebagai nomor telepon dan identitas tetap sama saat nomor diketahui', async () => {
  const f = fixture();
  const socket = f.sockets[0];
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [incoming('one', 'Halo', '999999@lid')] });
  await f.client.inbound;
  assert.equal(f.client.getContactPhone('lid:999999'), null);
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [incoming('two', 'Lanjut', '999999@lid', { remoteJidAlt: `${PHONE}@s.whatsapp.net` })] });
  await f.client.inbound;
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [incoming('three', 'Lanjut lagi')] });
  await f.client.inbound;
  assert.deepEqual(f.received.map((m) => m.from), ['lid:999999', 'lid:999999', 'lid:999999']);
  assert.equal(f.client.getContactPhone('lid:999999'), PHONE);
  await f.client.updateConnection(socket, { connection: 'open' });
  await f.client.sendText('lid:123456', 'Balasan');
  assert.equal(f.sent[0].jid, '123456@lid');
  await f.client.stop();
});

test('owner commands carry authenticated text and are acknowledged with a reaction that cannot trigger takeover', async () => {
  const f = fixture(), socket = f.sockets[0];
  await f.client.updateConnection(socket, { connection: 'open' });
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [incoming('owner-command', '#bot on', undefined, { fromMe: true })] });
  await f.client.inbound;
  const command = f.received[0];
  assert.equal(command.type, 'human_takeover'); assert.equal(command.text, '#bot on'); assert.equal(command.whatsapp_id, 'owner-command');
  await f.client.acknowledgeOwnerCommand(command, 'on');
  assert.equal(f.sent[0].message.react.text, '✅'); assert.equal(f.sent[0].message.react.key.id, 'owner-command');
  assert.equal(f.sent[0].message.react.key.fromMe, true);
  assert.equal(f.client.getStatus().sent, 0, 'command reactions are not counted as customer replies');
  socket.ev.emit('messages.upsert', { type: 'notify', messages: [{ ...incoming('reaction-echo', ''), key: { id: 'reaction-echo', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: true }, message: { reactionMessage: f.sent[0].message.react } }] });
  await f.client.inbound; assert.equal(f.received.length, 1);
  const aliases = f.client.getContactAliases(PHONE); assert.ok(aliases.includes(PHONE));
  await f.client.stop();
});

test('central owner commands control the specified client and confirmations stay in the control chat', async (t) => {
  const controls = new ConversationControl(':memory:', () => NOW), control = controls.forTenant('AG1');
  const f = fixture(), socket = f.sockets[0], target = '6288888888888';
  t.after(async () => { await f.client.stop(); controls.close(); });
  const processor = new MessageProcessor({ config: config(), store: new MemoryStore(config(), () => NOW, control), whatsapp: f.client,
    now: () => NOW, ai: { generate() { assert.fail('Control commands must not call AI'); } } });
  f.client.onMessages = messages => processor.acceptBatch(messages);
  await f.client.updateConnection(socket, { connection: 'open' });
  // WhatsApp may address the control contact by LID rather than its phone JID.
  const controlJid = '99123456789@lid', controlKey = { fromMe: true, remoteJidAlt: `${CONTROL}@s.whatsapp.net` };
  const off = incoming('central-off', `#botoff ${target}`, controlJid, controlKey);
  await f.client.receive(socket, { type: 'notify', messages: [off] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(processor.store.get(target).is_bot_active, false); assert.equal(control.get(target).resume_at, undefined);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].jid, controlJid); assert.match(f.sent[0].message.text, /dijeda tanpa batas waktu/);
  assert.equal(f.client.getStatus().sent, 0);
  // The outgoing confirmation, duplicate owner event and incoming contact text
  // must never re-enter command handling or the AI conversation.
  await f.client.receive(socket, { type: 'notify', messages: [
    incoming('out-1', f.sent[0].message.text, controlJid, controlKey), off,
    incoming('untrusted-on', `#boton ${target}`, controlJid, { ...controlKey, fromMe: false }),
  ] });
  assert.equal(processor.store.get(target).is_bot_active, false); assert.equal(f.sent.length, 1);
  await f.client.receive(socket, { type: 'notify', messages: [incoming('central-on', `#boton ${target}`, controlJid, controlKey)] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(processor.store.get(target).is_bot_active, true); assert.equal(control.get(target), undefined);
  assert.equal(f.sent.length, 2); assert.ok(f.sent.every(send => send.jid === controlJid));
  assert.match(f.sent[1].message.text, /diaktifkan kembali/);
});

test('disconnect sementara menjadwalkan satu reconnect dan memakai auth yang sama', async () => {
  const f = fixture();
  const old = f.sockets[0];
  await f.client.updateConnection(old, { connection: 'close', lastDisconnect: { error: { output: { statusCode: 515 } } } });
  await f.client.updateConnection(old, { connection: 'close' });
  assert.equal(f.timers.length, 1);
  f.timers[0].fn();
  assert.equal(f.sockets.length, 2);
  assert.equal(f.sockets[1].socketConfig.auth, f.auth.state);
  await f.client.updateConnection(f.sockets[1], { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
  assert.equal(f.client.getStatus().status, 'logged_out');
  assert.equal(f.timers.length, 1);
  await f.client.stop();
});

test('disconnect dari dashboard mencabut perangkat, membersihkan pairing, dan menghentikan reconnect', async () => {
  const f = fixture();
  let logouts = 0;
  f.auth.state.creds.registered = true;
  f.sockets[0].logout = async () => { logouts += 1; };
  await f.client.updateConnection(f.sockets[0], { connection: 'open' });
  await f.client.disconnect();
  assert.equal(logouts, 1);
  assert.equal(f.sockets[0].ended, true);
  assert.equal(f.client.getStatus().status, 'logged_out');
  assert.equal(f.client.getStatus().connected, false);
  assert.equal(f.client.getStatus().phone, null);
  assert.equal(f.auth.state.creds.registered, undefined);
  assert.deepEqual(f.client.getPairing(), { qr: null, code: null });
  f.client.retry();
  assert.equal(f.timers.length, 0, 'logout tidak menghubungkan ulang secara otomatis');
  f.client.reconnect({ reset: true });
  assert.equal(f.client.getStatus().status, 'connecting', 'pairing baru tetap dapat dimulai');
  await f.client.stop();
});

test('disconnect membatalkan reconnect yang terjadwal meskipun socket sudah hilang', async () => {
  const f = fixture();
  await f.client.updateConnection(f.sockets[0], { connection: 'close' });
  assert.equal(f.timers.length, 1);
  await f.client.disconnect();
  assert.equal(f.timers[0].cancelled, true);
  assert.equal(f.client.stopped, true);
  assert.equal(f.client.getStatus().status, 'logged_out');
});

test('logout yang belum selesai memblokir start/reconnect dan pengiriman pesan baru', async () => {
  const f = fixture();
  let finish;
  f.sockets[0].logout = () => new Promise((resolve) => { finish = resolve; });
  await f.client.updateConnection(f.sockets[0], { connection: 'open' });
  const pending = f.client.disconnect();
  assert.equal(f.client.getStatus().connected, false);
  assert.throws(() => f.client.start(() => {}), { code: 'CONVERSATION_BUSY' });
  assert.throws(() => f.client.reconnect(), { code: 'CONVERSATION_BUSY' });
  await assert.rejects(f.client.sendText(PHONE, 'Tidak boleh terkirim'), { code: 'WHATSAPP_NOT_CONNECTED' });
  await f.client.updateConnection(f.sockets[0], { connection: 'close' });
  assert.equal(f.timers.length, 0);
  finish(); await pending;
  assert.equal(f.client.getStatus().status, 'logged_out');
});

test('logout gagal tetap menghentikan socket tanpa mengklaim perangkat sudah dicabut', async () => {
  const f = fixture();
  f.auth.state.creds.registered = true;
  f.sockets[0].logout = async () => { throw new Error('network unavailable'); };
  await assert.rejects(f.client.disconnect(), /network unavailable/);
  assert.equal(f.sockets[0].ended, true);
  assert.equal(f.client.getStatus().status, 'stopped');
  assert.equal(f.auth.state.creds.registered, true);
  assert.equal(f.client.stopped, true);
});

test('endpoint disconnect memerlukan autentikasi dan menunggu proses percakapan selesai', async (t) => {
  const f = fixture(), c = config();
  const processor = { accepting: true, pending: 1 };
  let logouts = 0;
  f.sockets[0].logout = async () => { logouts += 1; assert.equal(processor.accepting, false); };
  const app = createApp({ config: c, store: new MemoryStore(c), processor, whatsapp: f.client });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await f.client.stop(); });
  const url = `http://127.0.0.1:${server.address().port}/admin/whatsapp/disconnect`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  const options = { method: 'POST', headers: { Authorization: `Bearer ${c.adminToken}`, 'Content-Type': 'application/json' }, body: '{}' };
  assert.equal((await fetch(url, options)).status, 409);
  assert.equal(logouts, 0);
  processor.pending = 0;
  const response = await fetch(url, options);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'logged_out');
  assert.equal(logouts, 1);
  assert.equal(processor.accepting, true);
});

test('pairing code menunggu QR, dibatasi frekuensinya, dan tidak bocor pada status', async () => {
  const f = fixture();
  await assert.rejects(f.client.requestPairingCode(PHONE), { code: 'PAIRING_NOT_READY' });
  await f.client.updateConnection(f.sockets[0], { qr: 'secret' });
  assert.deepEqual(await f.client.requestPairingCode(PHONE), { code: 'ABCDEFGH' });
  assert.equal(f.client.getStatus().status, 'awaiting_code');
  assert.equal(f.client.getStatus().code, undefined);
  assert.equal(f.client.getPairing().qr, null);
  await f.client.stop();
});

test('pairing ulang menghapus pemetaan kontak dan cache milik akun sebelumnya', async () => {
  const f = fixture();
  await f.client.receive(f.sockets[0], { messages: [incoming('one', 'Halo', '999999@lid', { remoteJidAlt: `${PHONE}@s.whatsapp.net` })] });
  assert.ok(f.client.aliases.size > 0);
  assert.ok(f.client.messageCache.size > 0);
  await f.client.updateConnection(f.sockets[0], { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
  f.client.reconnect({ reset: true });
  assert.equal(f.client.aliases.size, 0);
  assert.equal(f.client.destinations.size, 0);
  assert.equal(f.client.messageCache.size, 0);
  assert.equal(f.client.getStatus().received, 0);
  await f.client.stop();
});

test('kegagalan menyimpan session menghentikan socket dan tidak melakukan reconnect', async () => {
  const f = fixture();
  f.auth.saveCreds = () => { throw new Error('disk failed with private values'); };
  f.sockets[0].ev.emit('creds.update', {});
  assert.equal(f.client.getStatus().status, 'auth_error');
  assert.equal(f.sockets[0].ended, true);
  assert.equal(f.timers.length, 0);
  await assert.rejects(f.client.sendText(PHONE, 'Halo'), { code: 'WHATSAPP_NOT_CONNECTED' });
  await f.client.stop();
});

test('auth SQLite menyimpan kredensial, Buffer, tipe key baru, dan mencegah dua proses', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'solusindo-auth-test-'));
  const file = join(dir, 'session.sqlite');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const auth = createBaileysAuth(file);
  auth.state.creds.registered = true;
  auth.saveCreds();
  await auth.state.keys.set({ 'lid-mapping': { abc: '6281' }, 'tctoken': { token: Buffer.from([1, 2, 3]) }, 'app-state-sync-key': { key: { keyData: Buffer.from([4, 5]) } } });
  assert.throws(() => createBaileysAuth(file), /SESSION_IN_USE/);
  auth.close();
  const restored = createBaileysAuth(file);
  try {
    assert.equal(restored.state.creds.registered, true);
    assert.deepEqual((await restored.state.keys.get('tctoken', ['token'])).token, Buffer.from([1, 2, 3]));
    assert.deepEqual((await restored.state.keys.get('app-state-sync-key', ['key'])).key.keyData, Buffer.from([4, 5]));
    await restored.state.keys.set({ 'lid-mapping': { abc: null } });
    assert.equal((await restored.state.keys.get('lid-mapping', ['abc'])).abc, null);
    await assert.rejects(restored.state.keys.set({ 'test': { good: 'must rollback', bad: 1n } }));
    assert.equal((await restored.state.keys.get('test', ['good'])).good, null);
    assert.equal(statSync(file).mode & 0o777, 0o600);
  } finally { restored.close(); }
});

test('handover melalui Baileys menghentikan AI dan membalas sekali', async () => {
  const f = fixture();
  const c = config();
  const store = new MemoryStore(c, () => NOW);
  let aiCalls = 0;
  const processor = new MessageProcessor({ config: c, store, whatsapp: f.client, catalog: new Catalog(),
    ai: { generate: async () => { aiCalls += 1; return { reply: 'Halo', qualification: {} }; } }, now: () => NOW });
  f.client.onMessages = (messages) => processor.acceptBatch(messages);
  await f.client.updateConnection(f.sockets[0], { connection: 'open' });
  const batch = { type: 'notify', messages: [incoming('trigger', 'survei lokasi'), incoming('after', 'Halo lagi')] };
  f.sockets[0].ev.emit('messages.upsert', batch);
  await f.client.inbound; await processor.drain();
  f.sockets[0].ev.emit('messages.upsert', batch);
  await f.client.inbound; await processor.drain();
  assert.equal(aiCalls, 0);
  assert.equal(store.get(PHONE).is_bot_active, false);
  assert.deepEqual(f.sent.map((item) => item.message.text), [HANDOVER_MESSAGE]);
  await f.client.stop();
});

test('status dan QR memerlukan token; health tidak menyatakan tersambung sebelum pairing', async (t) => {
  const f = fixture();
  const c = config();
  const store = new MemoryStore(c);
  const processor = { accepting: true, pending: 0 };
  const app = createApp({ config: c, store, processor, whatsapp: f.client });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await f.client.stop(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(`${url}/health`)).json();
  assert.equal(health.whatsapp_connected, false);
  assert.equal((await fetch(`${url}/admin/whatsapp/pairing`)).status, 401);
  const headers = { Authorization: `Bearer ${c.adminToken}` };
  assert.equal((await (await fetch(`${url}/admin/whatsapp/status`, { headers })).json()).bot_accepting, true);
  processor.accepting = false;
  assert.equal((await (await fetch(`${url}/admin/whatsapp/status`, { headers })).json()).bot_accepting, false);
  processor.accepting = true;
  await f.client.updateConnection(f.sockets[0], { qr: 'secret' });
  const pairing = await (await fetch(`${url}/admin/whatsapp/pairing`, { headers })).json();
  assert.ok(pairing.qr.startsWith('data:'));
  assert.equal((await fetch(`${url}/webhook`)).status, 404);
  const page = await fetch(`${url}/connect`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});
