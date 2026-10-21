import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { resolveRegion, resolvePendingRegionChoice } from '../services/region_directory.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { config, noAi, NOW, regionChoiceScenarios, simulateRegionChoice } from '../scripts/lib/region-choice-dialogues.js';

const user = (content) => ({ role: 'user', content });
function conversation() {
  const history = [];
  return { send(text) {
    const buyer = buyerContext(history, text, null);
    const reply = searchReply({ buyer, status: buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' });
    history.push(user(text), { role: 'assistant', content: reply });
    return { buyer, reply };
  } };
}
const pending = () => resolveRegion('Kecamatan Pakis').clarification;

test('short parent names select within Pakis choices while national city/regency ambiguity remains intact', () => {
  assert.equal(resolveRegion('Malang').clarification.count, 2);
  assert.equal(resolveRegion('Magelang').clarification.count, 2);
  for (const [text, city, province] of [['malang pak', 'Kabupaten Malang', 'Jawa Timur'],
    ['magelang pak', 'Kabupaten Magelang', 'Jawa Tengah'], ['Jatim', 'Kabupaten Malang', 'Jawa Timur']]) {
    const selected = resolvePendingRegionChoice(text, { pending: pending() });
    assert.equal(selected.clarification, null); assert.equal(selected.city, city);
    assert.equal(selected.district, 'Pakis'); assert.equal(selected.area, 'Pakis'); assert.equal(selected.province, province);
  }
  assert.equal(resolvePendingRegionChoice('malang pak'), null);
  assert.equal(resolvePendingRegionChoice('malang pak', { pending: resolveRegion('Malang').clarification }), null);
});

test('a partial province choice narrows the pending district instead of opening a new city question', () => {
  const c = conversation(); c.send('Cari lelang rumah di Kecamatan Taman budget 300–900 juta luas tanah bebas');
  const province = c.send('Jawa Timur');
  assert.equal(province.buyer.region_clarification.name, 'Taman'); assert.equal(province.buyer.region_clarification.count, 2);
  const result = c.send('madiun pak');
  assert.equal(result.buyer.region_clarification, null); assert.equal(result.buyer.profile.city, 'Kota Madiun');
  assert.equal(result.buyer.profile.district, 'Taman'); assert.equal(result.buyer.profile.min_price, 300000000);
  assert.equal(result.buyer.profile.max_price, 900000000);
  assert.doesNotMatch(result.reply, /Kabupaten Madiun|Ada beberapa wilayah/);
});

test('parent selection can narrow villages beyond the five displayed candidates and retain the village through district choice', () => {
  const c = conversation(); const first = c.send('Cari rumah lelang di Kelurahan Sukamaju budget 500 juta luas tanah bebas');
  assert.ok(first.buyer.region_clarification.count > 5);
  const county = c.send('Kabupaten Bogor');
  assert.equal(county.buyer.region_clarification.name, 'Sukamaju'); assert.equal(county.buyer.region_clarification.count, 4);
  assert.equal(county.buyer.profile.city, 'Kabupaten Bogor');
  const district = c.send('Jonggol pak');
  assert.equal(district.buyer.region_clarification, null); assert.equal(district.buyer.profile.village, 'Sukamaju');
  assert.equal(district.buyer.profile.district, 'Jonggol'); assert.equal(district.buyer.profile.city, 'Kabupaten Bogor');
  assert.equal(district.buyer.profile.max_price, 500000000);
});

test('an incompatible parent never creates Pakis in Kota Malang; an explicit location restart can choose that city', () => {
  const c = conversation(); c.send('Cari rumah lelang di Pakis budget 300–900 juta luas tanah bebas');
  const wrong = c.send('Kota Malang');
  assert.equal(wrong.buyer.region_clarification.kind, 'conflict'); assert.equal(wrong.buyer.region_clarification.name, 'Pakis');
  assert.equal(wrong.buyer.profile.city, null); assert.equal(wrong.buyer.profile.district, null);
  assert.equal(wrong.buyer.stage, 'qualifying');
  const corrected = c.send('malang pak');
  assert.equal(corrected.buyer.region_clarification, null); assert.equal(corrected.buyer.profile.city, 'Kabupaten Malang');
  assert.equal(corrected.buyer.profile.district, 'Pakis');
  const restart = conversation(); restart.send('Cari rumah lelang di Pakis budget 300–900 juta luas tanah bebas');
  const newCity = restart.send('Ganti ke Kota Malang');
  assert.equal(newCity.buyer.profile.city, 'Kota Malang'); assert.equal(newCity.buyer.profile.district, null);
  assert.equal(newCity.buyer.profile.location, null); assert.equal(newCity.buyer.region_clarification, null);
});

test('a budget answer does not discard unresolved Pakis choices', () => {
  const c = conversation(); c.send('Cari aset lelang di Pakis');
  const budget = c.send('budget 300–900 juta');
  assert.equal(budget.buyer.region_clarification.name, 'Pakis'); assert.equal(budget.buyer.region_clarification.count, 2);
  const chosen = c.send('malang pak');
  assert.equal(chosen.buyer.region_clarification, null); assert.equal(chosen.buyer.profile.city, 'Kabupaten Malang');
  assert.equal(chosen.buyer.profile.min_price, 300000000); assert.equal(chosen.buyer.profile.max_price, 900000000);
});

test('WhatsApp remembers the original choices across short parent answers and bounded chat history', async () => {
  for (const scenario of [...regionChoiceScenarios(), { complete: true }]) {
    const result = await simulateRegionChoice(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('Playground interprets Malang within the pending Pakis candidates and searches only Kabupaten Malang', async (t) => {
  const app = express(), token = 'x'.repeat(40), reads = [];
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, ai: noAi, now: () => NOW,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const conversationId = randomUUID();
  const post = async (text) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox/AG108/messages`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, requestId: randomUUID(), history: [user(text)] }) });
    assert.equal(response.status, 200); return response.json();
  };
  const first = await post('Cari rumah lelang di Pakis budget 300–900 juta luas tanah bebas');
  assert.match(first.reply, /Kabupaten Magelang/); assert.match(first.reply, /Kabupaten Malang/); assert.equal(reads.length, 0);
  const selected = await post('malang pak');
  assert.equal(selected.session.is_bot_active, true); assert.equal(reads.length, 1);
  assert.equal(reads[0].city, 'Kabupaten Malang'); assert.equal(reads[0].district, 'Pakis');
  assert.equal(reads[0].min_price, 300000000); assert.equal(reads[0].max_price, 900000000);
  assert.doesNotMatch(selected.reply, /Ada beberapa wilayah|Kota Malang|kota atau kabupaten yang mana/);
});
