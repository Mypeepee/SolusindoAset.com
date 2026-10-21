import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { INTRODUCTION_MESSAGE, splitClientIntroduction, clientIdentity } from '../services/client_identity.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { buyerContext } from '../services/buyer_profile.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { introductionOriginScenarios, simulateIntroductionOrigin } from '../scripts/lib/introduction-origin-dialogues.js';

const user = (content) => ({ role: 'user', content }), assistant = (content) => ({ role: 'assistant', content });
const history = [user('selamat siang'), assistant(INTRODUCTION_MESSAGE)];
const noAi = { generate() { assert.fail('Introductions need no AI'); }, interpretBuyer() { assert.fail('Introductions need no interpretation'); } };
const noCatalog = { resolve() { assert.fail('An introduction must not query inventory'); } };

test('the exact tkzin introduction receives a reply while the stated origin does not become search criteria', async () => {
  const text = 'saya tkzin dari banten';
  const result = await generatePropertyReply({ text, history, catalog: noCatalog, ai: noAi });
  assert.equal(result.suppressed, false); assert.equal(result.knowledge.status, 'client_identified');
  assert.match(result.reply, /Salam kenal, Tkzin/); assert.match(result.reply, /Lagi cari properti di daerah mana/);
  const identity = clientIdentity([...history, user(text)]);
  assert.equal(identity.name, 'tkzin'); assert.equal(identity.salutation, null);
  const buyer = buyerContext(history, text, null);
  assert.equal(buyer.searching, false);
  for (const key of ['location', 'city', 'province', 'district']) assert.equal(buyer.profile[key], null, key);
});

test('121 full conversations keep the name and acknowledge origin before searching only the area subsequently requested', async () => {
  const failures = [];
  for (const scenario of introductionOriginScenarios()) {
    const result = await simulateIntroductionOrigin(scenario);
    if (!result.passed) failures.push(`${result.name}: ${result.error}`);
  }
  assert.deepEqual(failures, []);
});

test('origin and a genuine search in the same message preserve the search and any negated city', () => {
  for (const text of [
    'saya Tkzin dari Banten, cari rumah di Benowo Surabaya',
    'saya Tkzin tinggal di Banten, saya ingin cari rumah di Benowo Surabaya',
    'saya Tkzin domisili Kab. Tangerang; cari rumah di Benowo Surabaya',
    'saya Tkzin asal Banten, bukan cari di Sidoarjo, cari di Benowo Surabaya',
  ]) {
    const parsed = splitClientIntroduction(text, INTRODUCTION_MESSAGE);
    assert.equal(parsed.update.name, 'Tkzin', text); assert.equal(parsed.origin_provided, true, text);
    assert.match(parsed.remaining, /cari rumah|cari di/i); assert.doesNotMatch(parsed.remaining, /Banten|Tangerang/);
    const buyer = buyerContext(history, text, null);
    assert.equal(buyer.searching, true); assert.equal(buyer.profile.city, 'Surabaya', text);
    assert.equal(buyer.profile.district.toLowerCase(), 'benowo', text);
  }
  const explicitProvince = buyerContext(history, 'saya Tkzin dari Surabaya, cari properti di Provinsi Banten', null);
  assert.equal(explicitProvince.profile.province, 'Banten'); assert.equal(explicitProvince.profile.city, null);
});

test('an origin without a name after the invitation still receives a property-search invitation', async () => {
  for (const text of ['saya dari Banten', 'dari Banten', 'domisili di Banten']) {
    const result = await generatePropertyReply({ text, history, catalog: noCatalog, ai: noAi });
    assert.equal(result.suppressed, false, text); assert.match(result.reply, /Lagi cari properti di daerah mana/);
    assert.equal(clientIdentity([...history, user(text)]).name, null);
  }
});

test('a name resembling an origin label remains intact, without inventing a title or correcting its spelling', async () => {
  for (const name of ['tkzin', 'Asli Putri', 'Budi Asli', 'Élina', 'Anne-Marie']) {
    const text = `saya ${name} dari Banten`;
    const parsed = splitClientIntroduction(text, INTRODUCTION_MESSAGE);
    assert.equal(parsed.update.name, name); assert.equal(parsed.remaining, '');
    assert.equal(clientIdentity([...history, user(text)]).salutation, null);
    assert.ok((await generatePropertyReply({ text, history, catalog: noCatalog, ai: noAi })).reply);
  }
});

test('an introduction with origin during qualification continues the pending search in its original area', async () => {
  const opening = 'cari aset di Benowo';
  const first = await generatePropertyReply({ text: opening, history: [], catalog: noCatalog, ai: noAi });
  const active = [user(opening), assistant(first.reply)];
  const text = 'saya tkzin dari banten';
  const result = await generatePropertyReply({ text, history: active, catalog: noCatalog, ai: noAi });
  assert.ok(result.reply); assert.equal(result.knowledge.status, 'qualifying');
  assert.doesNotMatch(result.reply, /ngobrol dengan siapa|Pak atau Bu siapa|Banten/);
  const buyer = buyerContext(active, text, null);
  assert.equal(buyer.profile.city, 'Surabaya'); assert.equal(buyer.profile.district.toLowerCase(), 'benowo');
});

test('answers about buying from an owner or developer remain transaction preferences after the combined invitation', () => {
  for (const [text, transaction] of [['dari owner langsung', 'SECONDARY'], ['dari pemilik langsung', 'SECONDARY'], ['dari developer saja', 'PRIMARY'], ['dari pengembang', 'PRIMARY']]) {
    const parsed = splitClientIntroduction(text, INTRODUCTION_MESSAGE);
    assert.equal(parsed.origin_provided, false, text); assert.equal(parsed.update, null, text);
    const buyer = buyerContext([user('cari rumah di Benowo'), assistant('Mau beli atau sewa?\n\nTapi sebelum itu, boleh tahu dengan Pak atau Bu siapa saya berbicara? Kalau lebih nyaman disapa nama saja juga boleh.')], text, null);
    assert.equal(buyer.profile.transaction_type, transaction, text);
  }
});

test('Playground replies to the exact introduction and resumes a different target area in the same server conversation', async (t) => {
  const app = express(), token = 'x'.repeat(40), queries = [], conversationId = randomUUID();
  const catalog = { async resolve(_text, _id, criteria) { queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] }; } };
  app.use('/sandbox', createSandboxRouter({ catalog, ai: noAi, config: { adminToken: token, maxSessions: 100, sessionTtlMs: 86400000 } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  for (const [index, text] of ['selamat siang', 'saya tkzin dari banten', 'cari rumah secondary di Benowo Surabaya budget 300 juta luas tanah bebas'].entries()) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }),
    });
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.suppressed, false); assert.ok(result.reply); assert.equal(result.session.is_bot_active, true);
    if (index === 1) { assert.match(result.reply, /Salam kenal, Tkzin/); assert.match(result.reply, /Lagi cari properti di daerah mana/); }
    if (index < 2) assert.equal(queries.length, 0);
  }
  assert.equal(queries.length, 1); assert.equal(queries[0].city, 'Surabaya');
  assert.equal(queries[0].district.toLowerCase(), 'benowo'); assert.equal(queries[0].province, 'Jawa Timur');
  assert.doesNotMatch(JSON.stringify(queries[0]), /banten|tkzin/i);
});
