import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { INTRODUCTION_MESSAGE, clientIdentity, splitClientIntroduction } from '../services/client_identity.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { buyerContext } from '../services/buyer_profile.js';
import { MemoryStore } from '../state/memory_store.js';
import { MessageProcessor } from '../services/message_processor.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { IDLE_TIMEOUT_MS } from '../services/interaction_policy.js';
import { addressedIntroductionSamples } from '../scripts/lib/addressed-introduction-samples.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const noAi = { generate() { assert.fail('Introductions and search qualification must not require AI'); } };
const noCatalog = { resolve() { assert.fail('Introductions and incomplete searches must not query the catalog'); } };
const introHistory = [user('selamat siang pak'), assistant(INTRODUCTION_MESSAGE)];
const config = { transport: 'baileys', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 10, maxDedup: 1000, sessionTtlMs: 86400000 };

for (const [text, name, salutation] of [
  ['Bu Rina', 'Rina', 'Bu'], ['Bu Rina pak', 'Rina', 'Bu'], ['nama saya Pak Budi Santoso', 'Budi Santoso', 'Pak'],
  ['panggil saya Kak Alex', 'Alex', 'Kak'], ['panggil Mas Dwi aja', 'Dwi', 'Mas'], ['Mbak Sari', 'Sari', 'Mbak'],
  ['Budi', 'Budi', null], ['Rina aja pak', 'Rina', null], ['nama saya Rina pak', 'Rina', null],
  ['panggil saya Budi saja', 'Budi', null], ['Bu saja', null, 'Bu'],
]) test(`explicit form of address: ${text}`, async () => {
  const identity = clientIdentity([...introHistory, user(text)]);
  assert.equal(identity.name, name);
  assert.equal(identity.salutation, salutation);
  const result = await generatePropertyReply({ text, history: introHistory, ai: noAi, catalog: noCatalog });
  assert.equal(result.suppressed, false);
  assert.match(result.reply, new RegExp([salutation, name].filter(Boolean).join(' ')));
  assert.doesNotMatch(result.reply, /Bapak\/Ibu|ngobrol dengan siapa|disapa Pak/);
});

test('greeting invites a chosen name and title; calling the bot pak or bu never establishes the client title', async () => {
  for (const text of ['selamat siang pak', 'halo bu', 'selamat pagi kak']) {
    const result = await generatePropertyReply({ text, history: [], catalog: noCatalog, ai: noAi });
    assert.equal(result.reply, INTRODUCTION_MESSAGE);
    assert.equal(clientIdentity([user(text)]).salutation, null);
  }
  assert.equal(splitClientIntroduction('terima kasih pak', INTRODUCTION_MESSAGE).update, null);
});

const combinedIntroductions = [
  'selamat siang, saya vera',
  'selamat siang saya vera',
  'selamat siang pak, saya vera',
  'halo, nama saya vera',
  'halo kak nama saya vera',
  'hai! aku vera',
  'hello 👋 saya vera',
  'assalamualaikum, perkenalkan saya vera',
  'Selamat pagi. Saya Vera.',
  'selamat sore\nsaya vera',
];

test('greetings with a named recipient identify the client separately in varied word order and punctuation', async () => {
  for (const sample of addressedIntroductionSamples()) {
    for (const history of [[], introHistory]) {
      const parsed = splitClientIntroduction(sample.text, history.at(-1)?.content);
      assert.equal(parsed.update?.name, sample.name, sample.text);
      assert.equal(parsed.remaining, '', sample.text);
      const identity = clientIdentity([...history, user(sample.text)]);
      assert.equal(identity.name, sample.name, sample.text);
      assert.equal(identity.salutation, sample.salutation, sample.text);
      const result = await generatePropertyReply({ text: sample.text, history, catalog: noCatalog, ai: noAi });
      assert.equal(result.reply, `Salam kenal, ${sample.label}. Ada yang bisa saya bantu?`, sample.text);
      assert.equal(result.suppressed, false, sample.text);
      assert.equal(buyerContext(history, sample.text, null).searching, false, sample.text);
    }
  }
});

test('a greeting addressed to the agent invites the client name without treating the agent as the client', async () => {
  for (const text of ['malam pak jason', 'halo Jason', 'selamat sore Pak Jason Christopher Liendo', 'halo Pak Budi', 'permisi Pak Jason']) {
    const result = await generatePropertyReply({ text, history: [], catalog: noCatalog, ai: noAi });
    assert.equal(result.reply, INTRODUCTION_MESSAGE, text);
    assert.equal(clientIdentity([user(text)]).name, null, text);
    assert.equal(clientIdentity([user(text)]).salutation, null, text);
  }
});

test('a greeting and explicit introduction in one message receive the neutral welcome without AI or inventory access', async () => {
  for (const history of [[], introHistory]) {
    for (const text of combinedIntroductions) {
      const parsed = splitClientIntroduction(text, history.at(-1)?.content);
      assert.equal(parsed.update?.name.toLowerCase(), 'vera', text);
      assert.equal(parsed.remaining, '', text);
      const identity = clientIdentity([...history, user(text)]);
      assert.equal(identity.name.toLowerCase(), 'vera', text);
      assert.equal(identity.salutation, null, text);
      const result = await generatePropertyReply({ text, history, catalog: noCatalog, ai: noAi });
      assert.equal(result.reply, 'Salam kenal, Vera. Ada yang bisa saya bantu?', text);
      assert.equal(result.suppressed, false, text);
      assert.equal(buyerContext(history, text, null).searching, false, text);
    }
  }
});

test('combined greetings retain an explicit client title and the actual search after the introduction', async () => {
  const titled = await generatePropertyReply({ text: 'selamat siang pak, saya Bu Vera', history: [], catalog: noCatalog, ai: noAi });
  assert.equal(titled.reply, 'Salam kenal, Bu Vera. Ada yang bisa saya bantu?');
  for (const text of [
    'selamat siang, saya vera dari Banten, cari rumah lelang di Benowo Surabaya budget 500 juta',
    'halo saya vera, cari rumah lelang di Benowo Surabaya budget 500 juta',
    'malam Pak Jason, saya vera dari Banten, cari rumah lelang di Benowo Surabaya budget 500 juta',
    'malam Pak Jason saya vera tolong carikan rumah lelang di Benowo Surabaya budget 500 juta',
    'halo Mas Budi saya vera mohon cari rumah lelang di Benowo Surabaya budget 500 juta',
  ]) {
    const parsed = splitClientIntroduction(text);
    assert.equal(parsed.update.name, 'vera', text);
    assert.match(parsed.remaining, /cari(?:kan)? rumah lelang/, text);
    const buyer = buyerContext([], text, null);
    assert.equal(buyer.profile.city, 'Surabaya', text);
    assert.equal(buyer.profile.max_price, 500000000, text);
    assert.equal(buyer.profile.category, 'RUMAH', text);
    const result = await generatePropertyReply({ text, history: [], catalog: noCatalog, ai: noAi });
    assert.ok(result.reply, text);
    assert.equal(result.knowledge.status, 'qualifying', text);
    assert.doesNotMatch(result.reply, /Ada yang bisa saya bantu|Banten/, text);
  }
});

test('ordinary search answers, questions and addresses are not personal names even after the introduction prompt', () => {
  for (const text of ['saya cari rumah', 'saya mau investasi', 'saya flipping', 'di Tandes pak', 'toko', 'lelang', 'semua boleh', 'nama saya siapa?', 'panggil saya siapa?', 'rumah', 'saya belum tahu', 'dana satu miliar', 'semiliar', 'seratus meter']) {
    assert.equal(splitClientIntroduction(text, INTRODUCTION_MESSAGE).update, null, text);
  }
  for (const text of ['Pak Budi punya rumah?', 'saya cari rumah Bu Rina', 'halo Pak Budi', 'Budi']) {
    assert.equal(splitClientIntroduction(text).update, null, text);
  }
});

test('skipping or declining introductions never prevents property search', async () => {
  for (const text of ['saya tertarik aset lelang di Surabaya pak', 'nggak usah nama, cari lelang rumah di Surabaya']) {
    const result = await generatePropertyReply({ text, history: introHistory, catalog: noCatalog, ai: noAi });
    assert.match(result.reply, /Surabaya/);
    assert.doesNotMatch(result.reply, /ngobrol dengan siapa|disapa Pak/);
  }
  for (const text of ['skip dulu', 'nama nanti aja', 'nggak usah nama', 'langsung aja pak', 'gak usah pak', 'nggak perlu kenalan']) {
    const result = await generatePropertyReply({ text, history: introHistory, catalog: noCatalog, ai: noAi });
    assert.match(result.reply, /Tidak masalah\. Ada yang bisa saya bantu\?/);
    assert.equal(clientIdentity([...introHistory, user(text)]).name, null);
  }
});

test('combined self introduction and search keeps names out of geography and database filters', async () => {
  const text = 'nama saya Bu Rina, saya cari rumah lelang di seluruh Kecamatan Tandes, Surabaya budget 350 juta luas tanah bebas';
  const criteria = [];
  const result = await generatePropertyReply({ text, history: introHistory, ai: noAi, catalog: {
    async resolve(_text, _id, filters) { criteria.push(filters); return { status: 'not_found', catalog: [] }; },
  } });
  assert.equal(result.knowledge.status, 'not_found');
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].city, 'Surabaya');
  assert.equal(criteria[0].district, 'Tandes');
  assert.equal(criteria[0].max_price, 350000000);
  assert.doesNotMatch(JSON.stringify(criteria), /Rina|salutation|client_identity/);
});

test('explicit title corrections and name-only preferences supersede previous choices', () => {
  const history = [...introHistory, user('Pak Dwi'), assistant('Salam kenal, Pak Dwi.')];
  assert.equal(clientIdentity([...history, user('bukan Pak, panggil saya Bu Dwi')]).salutation, 'Bu');
  assert.equal(clientIdentity([...history, user('panggil Dwi aja')]).salutation, null);
  assert.equal(clientIdentity([...history, user('cukup nama saja')]).salutation, null);
});

test('names and salutations cannot supply the location when the client introduces themselves mid-search', () => {
  const history = [user('Cari lelang aset di Surabaya'), assistant('Incar daerah mana? Budget-nya sampai berapa?')];
  const buyer = buyerContext(history, 'nama saya Bu Rina', null);
  assert.equal(buyer.profile.city, 'Surabaya');
  assert.equal(buyer.profile.location, null);
  assert.equal(buyer.profile.max_price, null);
});

test('server identity survives bounded history and idle search resets, without leaking to another contact', () => {
  let now = 1;
  const store = new MemoryStore(config, () => now), session = store.create('first');
  store.append(session, 'user', 'halo');
  store.append(session, 'assistant', INTRODUCTION_MESSAGE);
  store.append(session, 'user', 'Bu Rina');
  for (let i = 0; i < 30; i++) store.append(session, i % 2 ? 'assistant' : 'user', 'terima kasih');
  assert.ok(session.history.length <= 24);
  assert.equal(session.client_identity.name, 'Rina');
  session.last_user_received_at = now;
  now += IDLE_TIMEOUT_MS + 1;
  assert.equal(store.resetIfIdle(session), true);
  assert.equal(session.client_identity.salutation, 'Bu');
  assert.equal(store.create('second').client_identity.name, null);
});

test('WhatsApp asks once, recognizes the answer without going silent, then uses the chosen form of address', async () => {
  const store = new MemoryStore(config), sent = [];
  const processor = new MessageProcessor({ config, store, catalog: noCatalog, ai: noAi,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of ['selamat siang pak', 'Bu Rina pak', 'saya cari lelang rumah di Surabaya']) {
    processor.acceptBatch([{ id: randomUUID(), from: '628123456789', type: 'text', text, timestamp: Date.now() }]);
    await processor.drain();
  }
  assert.equal(sent.length, 3);
  assert.equal(sent[0], INTRODUCTION_MESSAGE);
  assert.match(sent[1], /Salam kenal, Bu Rina/);
  assert.match(sent[2], /^Siap, Bu Rina/);
  assert.match(sent[2], /Surabaya/);
  assert.equal(store.get('628123456789').client_identity.salutation, 'Bu');
});

test('Playground persists chosen address per server conversation and permits an anonymous search', async (t) => {
  const token = 'x'.repeat(40), app = express();
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog: noCatalog, ai: noAi }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const post = async (text, conversationId) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG1/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = randomUUID(), second = randomUUID();
  assert.equal((await post('selamat siang pak', first)).reply, INTRODUCTION_MESSAGE);
  assert.match((await post('Budi aja pak', first)).reply, /Salam kenal, Budi/);
  const search = await post('cari rumah lelang di Surabaya', first);
  assert.match(search.reply, /^Siap, Budi/);
  assert.doesNotMatch(search.reply, /Pak Budi|Bu Budi/);
  assert.equal((await post('halo', second)).reply, INTRODUCTION_MESSAGE);
  const anonymous = await post('cari rumah lelang di Surabaya', second);
  assert.match(anonymous.reply, /Surabaya/);
  assert.doesNotMatch(anonymous.reply, /Budi|ngobrol dengan siapa/);
  const direct = randomUUID();
  assert.match((await post(directOpening, direct)).reply, /sebelum itu.*Pak atau Bu siapa/i);
  const named = await post('Bu Rina', direct);
  assert.match(named.reply, /Bu Rina/);
  assert.match(named.reply, /Manukan.*kota atau kabupaten mana/s);
  assert.doesNotMatch(named.reply, /Pak atau Bu siapa/);
  assert.match((await post('Surabaya pak', direct)).reply, /Manukan.*Surabaya/s);
  for (const text of combinedIntroductions) {
    const welcomed = await post(text, randomUUID());
    assert.equal(welcomed.reply, 'Salam kenal, Vera. Ada yang bisa saya bantu?', text);
    assert.equal(welcomed.suppressed, false, text);
  }
  for (const text of ['malam pak jason, saya vera', 'malam pak jason saya vera', 'halo Mas Budi, ini saya vera', 'selamat malam Pak Jason, Vera di sini']) {
    const welcomed = await post(text, randomUUID());
    assert.equal(welcomed.reply, 'Salam kenal, Vera. Ada yang bisa saya bantu?', text);
    assert.equal(welcomed.suppressed, false, text);
  }
});

const directOpening = 'siang pak, saya tertarik dengan aset lelang di daerah manukan apakah ada pak?';
test('a direct search also asks the name once, then resumes the unanswered location question', async () => {
  const history = [];
  const send = async (text) => {
    const result = await generatePropertyReply({ text, history, ai: noAi, catalog: noCatalog });
    history.push(user(text), assistant(result.reply));
    return result;
  };
  const opening = await send(directOpening);
  assert.match(opening.reply, /Manukan.*kota atau kabupaten mana/s);
  assert.match(opening.reply, /sebelum itu.*Pak atau Bu siapa/i);
  const named = await send('Pak Budi');
  assert.match(named.reply, /Pak Budi/);
  assert.match(named.reply, /Manukan.*kota atau kabupaten mana/s);
  assert.doesNotMatch(named.reply, /Pak atau Bu siapa/);
  const city = await send('Surabaya pak');
  assert.match(city.reply, /Manukan.*Surabaya/s);
  assert.doesNotMatch(city.reply, /Pak atau Bu siapa|kota atau kabupaten mana/);
  assert.equal(clientIdentity(history).name, 'Budi');
  assert.equal(buyerContext(history, 'budget 350 juta', null).profile.max_price, 350000000);
});

test('a location or transaction answer after the combined invitation never becomes a client name', async () => {
  for (const [opening, answer] of [[directOpening, 'Surabaya pak'], ['Cari aset di Surabaya', 'seken aja'],
    ['Cari aset di Surabaya', 'ngontrak'], ['Cari aset di Surabaya', 'terserah'], ['Cari lelang aset di Surabaya', 'Tandes pak'],
    ['Cari lelang ruko di Gresik', 'dimana aja boleh, dana satu miliar']]) {
    const reply = await generatePropertyReply({ text: opening, history: [], ai: noAi, catalog: noCatalog });
    assert.match(reply.reply, /Pak atau Bu siapa/);
    const history = [user(opening), assistant(reply.reply)];
    const result = await generatePropertyReply({ text: answer, history, ai: noAi, catalog: noCatalog });
    assert.equal(clientIdentity([...history, user(answer)]).name, null, answer);
    assert.equal(result.knowledge.status, 'qualifying');
    assert.doesNotMatch(result.reply, /Pak atau Bu siapa/);
  }
});

test('WhatsApp appends the introduction to a direct search and resumes after the chosen name', async () => {
  const store = new MemoryStore(config), sent = [], phone = '628123456789';
  const processor = new MessageProcessor({ config, store, catalog: noCatalog, ai: noAi,
    whatsapp: { async sendText(_phone, text) { sent.push(text); return 'mock'; } }, logger: { error(error) { assert.fail(JSON.stringify(error)); } } });
  for (const text of [directOpening, 'Pak Budi', 'Surabaya pak']) {
    processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text, timestamp: Date.now() }]);
    await processor.drain();
  }
  assert.equal(sent.length, 3);
  assert.match(sent[0], /Pak atau Bu siapa/);
  assert.match(sent[1], /Pak Budi/);
  assert.match(sent[1], /kota atau kabupaten mana/);
  assert.match(sent[2], /Manukan.*Surabaya/s);
  assert.equal(store.get(phone).client_identity.name, 'Budi');
  assert.equal(sent.filter((reply) => reply.includes('Pak atau Bu siapa')).length, 1);
});
