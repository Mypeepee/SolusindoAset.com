import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { scenarios, simulateDialogue, dialogueFixture, OPENING, ORIGINAL, REPORTED, NOW, BASE_CRITERIA } from '../scripts/lib/context-dialogues.js';
import { generatePropertyReply, resolvePropertyContext } from '../services/property_reply.js';
import { buyerContext, explicitAsset } from '../services/buyer_profile.js';
import { auctionCheckReply } from '../services/auction_check.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { isBuyerCriteria, planPropertyLookup, getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const initialHistory = () => [user(OPENING), assistant(auctionCheckReply(ORIGINAL, { status: 'simulated' }))];
const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };

for (const scenario of scenarios) test(`context simulation: ${scenario.name}`, () => simulateDialogue(scenario));

test('formatted templates establish a pointer without importing price, area or category as buyer preferences', () => {
  for (const text of [OPENING, '**Kode:** **114108**', '*Kode: 114108*', '**114108**']) {
    assert.equal(explicitAsset(text), true);
    assert.deepEqual(planPropertyLookup(text).ids, ['114108']);
    const buyer = buyerContext([], text, null);
    for (const field of ['max_price', 'min_land_area_m2', 'max_land_area_m2', 'category', 'location']) assert.equal(buyer.profile[field], null);
    assert.equal(buyer.searching, false);
  }
});

test('detail questions and backup refusals remain on the selected asset without changing search filters', async () => {
  for (const text of ['Di sana ada berapa kamar?', 'Di area tersebut banjir?', 'Aset itu luasnya berapa?',
    'Tidak perlu, fokus aset ini dulu', 'Saya belum mau cari yang lain pak']) {
    const fixture = dialogueFixture(), history = initialHistory();
    const context = await resolvePropertyContext(fixture.catalog, text, ORIGINAL.id, history, NOW);
    assert.equal(context.buyer.searching, false, text);
    assert.equal(context.asset.id, ORIGINAL.id, text);
    assert.equal(fixture.reads.filter((r) => r.criteria).length, 0, text);
    if (text.endsWith('?')) {
      const next = await resolvePropertyContext(fixture.catalog, REPORTED, ORIGINAL.id, [...history, user(text), assistant('Informasi itu perlu dikonfirmasi.')], NOW);
      assert.equal(next.buyer.profile.city, 'Surabaya'); assert.equal(next.buyer.profile.location, 'Tandes');
    }
  }
});

test('short reference replies and references alongside a budget keep the verified scope', async () => {
  for (const text of ['iya di sana pak', 'tetap di situ', 'masih di area tersebut pak, budget 500 juta',
    'tetap di sana, budget 500 juta', 'lokasi yang sama, budget 500 juta']) {
    const fixture = dialogueFixture();
    const context = await resolvePropertyContext(fixture.catalog, text, ORIGINAL.id, initialHistory(), NOW);
    assert.equal(context.buyer.profile.city, 'Surabaya', text); assert.equal(context.buyer.profile.location, 'Tandes', text);
    assert.equal(context.buyer.searching, true, text);
  }
});

test('village references retain a confirmed village and cannot create a village named Tersebut', () => {
  const history = [user('Cari lelang rumah di kelurahan Manukan Kulon, Surabaya, budget 500 juta, luas tanah bebas')];
  const context = buyerContext(history, 'Ada rumah lain di kelurahan tersebut?', null);
  assert.equal(context.profile.village, 'Manukan Kulon'); assert.equal(context.profile.district, 'Tandes');
  assert.equal(context.profile.max_price, 500000000); assert.equal(context.stage, 'recommendations');
});

test('missing public asset and missing location cannot be recovered from unverified template prose', async () => {
  const unavailable = dialogueFixture({ original: null });
  const result = await resolvePropertyContext(unavailable.catalog, REPORTED, ORIGINAL.id, initialHistory(), NOW);
  assert.equal(result.asset, null); assert.equal(result.status, 'not_found');
  const noLocation = dialogueFixture({ original: { ...ORIGINAL, address: {} } });
  const unclear = await generatePropertyReply({ ...noLocation, history: initialHistory(), text: REPORTED, previousId: ORIGINAL.id, now: NOW });
  assert.match(unclear.reply, /kota atau kabupaten mana/); assert.doesNotMatch(unclear.reply, /Tandes|Surabaya|Tersebut/);
});

test('alternative exclusions accept bounded public IDs and are enforced by the database query', async () => {
  const criteria = { ...BASE_CRITERIA, transaction_type: 'LELANG', exclude_ids: ['114108', '900001', '900002', '900003'] };
  assert.equal(isBuyerCriteria(criteria), true);
  assert.equal(isBuyerCriteria({ ...criteria, exclude_ids: Array.from({ length: 64 }, (_, n) => String(n + 1)) }), true);
  assert.equal(isBuyerCriteria({ ...criteria, exclude_ids: Array.from({ length: 65 }, (_, n) => String(n + 1)) }), false);
  assert.equal(isBuyerCriteria({ ...criteria, exclude_ids: ['1 OR 1=1'] }), false);
  let query;
  await getPropertyKnowledge({ listing: { async findMany(input) { query = input; return []; } } }, { text: 'Ada yang lain?', criteria }, NOW);
  assert.deepEqual(query.where.id_property, { notIn: criteria.exclude_ids.map(BigInt) });
  assert.equal(query.where.status_tayang, 'TERSEDIA');
});

test('live processor preserves context across the reported reply, recommendations and a budget correction', async () => {
  const fixture = dialogueFixture(), sent = [], store = new MemoryStore(config, () => NOW), phone = '6281234567890';
  const processor = new MessageProcessor({ ...fixture, config, store, now: () => NOW,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'simulated'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of [OPENING, REPORTED, 'bebas', 'budget jadi 600 juta', 'Ada yang lain pak?']) {
    processor.acceptBatch([{ id: randomUUID(), text, from: phone, timestamp: NOW, type: 'text' }]); await processor.drain();
  }
  assert.equal(sent.length, 5); assert.match(sent[1], /Tandes.*Surabaya/); assert.match(sent[1], /500.000.000/);
  assert.equal(store.get(phone).asset_id, ORIGINAL.id); assert.equal(store.get(phone).is_bot_active, true);
  const criteria = fixture.reads.at(-1).criteria;
  assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.max_price, 600000000);
  assert.deepEqual(criteria.exclude_ids, ['114108', '900001', '900002', '900003']);
  assert.match(sent.at(-1), /[Bb]elum ketemu/);
});

test('Playground uses server-owned context for references, alternatives and a newly selected asset', async (t) => {
  const fixture = dialogueFixture(), app = express(), token = 'x'.repeat(40);
  app.use('/sandbox', createSandboxRouter({ ...fixture, config: { ...config, adminToken: token }, now: () => NOW }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text, id = conversationId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await post(OPENING);
  const followup = await post(REPORTED); assert.match(followup.reply, /Tandes.*Surabaya/); assert.match(followup.reply, /500.000.000/);
  assert.equal((await post('bebas')).knowledge.status, 'recommendations');
  assert.equal((await post('budget jadi 600 juta')).session.asset_id, ORIGINAL.id);
  assert.equal((await post('yang kedua, minta detailnya')).session.asset_id, '900002');
  const fresh = await post('Cari lelang rumah di area tersebut budget 500 juta', randomUUID());
  assert.match(fresh.reply, /kota atau kabupaten mana/); assert.equal(fresh.session.asset_id, null);
});
