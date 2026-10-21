import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { generatePropertyReply, selectedAssetIdFromHistory } from '../services/property_reply.js';
import { auctionCheckReply, isAuctionScheduleQuestion } from '../services/auction_check.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';

const NOW = Date.parse('2026-10-20T16:43:00+07:00');
const asset = { id: '121820', name: 'Rumah Waru', location: 'Waru, Sidoarjo',
  address: { city: 'Sidoarjo', district: 'Waru' }, category: 'RUMAH', transaction_type: 'LELANG',
  limit_price: 417128521, auction_at: '2026-07-02T17:00:00Z', publication: { status: 'TERSEDIA' },
  detail_url: 'https://solusindoaset.com/Lelang/rumah-waru-121820' };
const inquiry = 'Halo Jason Christopher Liendo 👋\n\nSaya tertarik dengan properti berikut, apakah masih tersedia?\n\n🔨 **RUMAH – SIDOARJO · LT 101 m²**\n📍 Waru, KAB. SIDOARJO\n💰 **Rp 417.128.521**\n🔖 Kode: **121820**\n\nMohon infonya, terima kasih! 🙏';
const intro = 'saya fikri dari batujajar';
const schedule = 'unit tersebut kapan ada lelang lagi ya pak?';
const noAi = { generate() { assert.fail('An introduction or listing schedule must not need an AI response'); } };
const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
const history = [user(inquiry), assistant(auctionCheckReply(asset, { status: 'simulated' }))];
const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 30,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
function catalog(item = asset) {
  const calls = [];
  return { calls, async resolve(text, previousId, criteria) {
    calls.push({ text, previousId, criteria });
    return { asset: item, catalog: [], status: item ? 'matched' : 'not_found', source: 'simulation' };
  } };
}
function assertSchedule(reply) {
  assert.match(reply, /121820/);
  assert.match(reply, /3 Juli 2026/);
  assert.match(reply, /(?:jadwal|tanggal)[\s\S]*(?:belum|perlu)/i);
  assert.doesNotMatch(reply, /Lagi cari properti|Mau tahu bagian yang mana|Incar daerah mana|siapa saya berbicara|sudah menghubungi/i);
}

test('an introduction during an asset consultation acknowledges the name and keeps the selected unit', async () => {
  const db = catalog();
  const result = await generatePropertyReply({ catalog: db, ai: noAi, text: intro, history, previousId: asset.id, now: NOW });
  assert.match(result.reply, /Salam kenal, Fikri/);
  assert.match(result.reply, /121820/);
  assert.doesNotMatch(result.reply, /Mau tahu bagian yang mana|Lagi cari properti|Batujajar.*(?:budget|properti)/i);
  assert.equal(result.asset.id, asset.id);
  assert.ok(db.calls.every((call) => !call.criteria));
});

for (const text of [schedule, 'kapan jadwal lelang ulangnya?', 'retender kapan pak?', 'sudah ada tanggal baru?', 'jadwal lelang berikutnya kapan?']) {
  test(`the selected unit receives a factual schedule reply: ${text}`, async () => {
    const result = await generatePropertyReply({ catalog: catalog(), ai: noAi, text, history, previousId: asset.id, now: NOW });
    assertSchedule(result.reply);
    assert.equal(result.asset.id, asset.id);
  });
}

test('the next schedule is re-read from the listing, rather than copied from the old chat', async () => {
  const refreshed = { ...asset, auction_at: '2026-11-05T04:00:00Z' };
  const result = await generatePropertyReply({ catalog: catalog(refreshed), ai: noAi, text: schedule, history, previousId: asset.id, now: NOW });
  assert.match(result.reply, /5 November 2026/);
  assert.doesNotMatch(result.reply, /3 Juli 2026|sudah (?:lewat|terlewat)|jadwal.*belum/i);
});

test('payment and viewing dates are not interpreted as the auction schedule', () => {
  for (const text of ['kapan bayar lelang?', 'tanggal pembayaran jaminan lelang kapan?', 'kapan saya harus melunasi lelang?', 'jadwal survei unit tersebut kapan?']) {
    assert.equal(isAuctionScheduleQuestion(text), false, text);
  }
});

test('a missing or removed schedule never revives dates from the earlier assistant message', async () => {
  for (const item of [{ ...asset, auction_at: null }, null]) {
    const result = await generatePropertyReply({ catalog: catalog(item), ai: noAi, text: schedule, history, previousId: asset.id, now: NOW });
    assert.match(result.reply, /belum|tidak ditemukan/i);
    assert.doesNotMatch(result.reply, /3 Juli 2026/);
  }
});

test('a missing selection pointer is recovered from the actual user reference and revalidated', async () => {
  const db = catalog();
  const result = await generatePropertyReply({ catalog: db, ai: noAi, text: schedule, history: [...history, user(intro), assistant('Mau tahu bagian yang mana ya, harga, lokasi, fasilitas, atau biaya?')], now: NOW });
  assertSchedule(result.reply);
  assert.ok(db.calls.some((call) => call.text === 'Kode 121820'));
});

test('assistant prose and budget answers after a new search cannot select an old unit', () => {
  assert.equal(selectedAssetIdFromHistory([assistant('Aset kode 121820 masih tersedia.'), user(schedule)]), null);
  assert.equal(selectedAssetIdFromHistory([...history, user('cari rumah secondary di Surabaya'),
    assistant('Budget-nya sampai berapa?'), user('500')]), null);
});

test('WhatsApp preserves the unit and identity across the reported introduction and ten-minute pause', async () => {
  let now = NOW;
  const store = new MemoryStore(config, () => now), sent = [], db = catalog(), phone = '6280000000083';
  const processor = new MessageProcessor({ config, store, catalog: db, ai: noAi, now: () => now,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } },
    logger: { error(error) { assert.fail(JSON.stringify(error)); } },
  });
  for (const [index, text] of [inquiry, intro, schedule].entries()) {
    now = NOW + [0, 60000, 600000][index];
    processor.acceptBatch([{ id: randomUUID(), text, from: phone, timestamp: now, type: 'text' }]);
    await processor.drain();
    assert.equal(sent.length, index + 1);
    assert.equal(store.get(phone).asset_id, asset.id);
    if (index === 1) {
      assert.match(sent.at(-1), /Salam kenal, Fikri/);
      assert.equal(store.get(phone).client_identity.name, 'fikri');
      store.get(phone).history = store.get(phone).history.slice(-2);
    }
  }
  assertSchedule(sent.at(-1));
  assert.ok(db.calls.every((call) => !call.criteria));
});

test('Playground revalidates a browser selection when its server session is new, then owns that pointer', async (t) => {
  const db = catalog(), app = express(), token = 'x'.repeat(40);
  let conversationId = randomUUID();
  let now = NOW;
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog: db, ai: noAi, now: () => now }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const send = async (text, previousId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), previousId, history: [user(text)] }),
    });
    assert.equal(response.status, 200); return response.json();
  };
  assertSchedule((await send(schedule, asset.id)).reply);
  assertSchedule((await send(schedule, '999999')).reply);
  assert.ok(db.calls.every((call) => call.text === 'Kode 121820'));
  const callsBeforeIdle = db.calls.length;
  now += 46 * 60000;
  const idle = await send(schedule, asset.id);
  assert.equal(idle.session.asset_id, null);
  assert.equal(db.calls.length, callsBeforeIdle, 'a stale browser pointer must not bypass an intentional idle reset');
  conversationId = randomUUID();
  assert.equal((await send(inquiry, null)).session.asset_id, asset.id);
  const introduced = await send(intro, asset.id);
  assert.match(introduced.reply, /Salam kenal, Fikri/);
  assert.equal(introduced.session.asset_id, asset.id);
  now += 9 * 60000;
  assertSchedule((await send(schedule, asset.id)).reply);
});
