import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePropertyReply } from '../services/property_reply.js';
import { clientIdentity } from '../services/client_identity.js';
import { resolveRegion, resolvePendingRegionChoice } from '../services/region_directory.js';

const noAi = { generate() { assert.fail('Parent corrections must not need AI'); } };
const noLocationQuestion = /Incar daerah mana|kelurahan mana|kecamatan mana|kota atau kabupaten mana/i;

function conversation({ bounded = false } = {}) {
  let history = [], state = {};
  const queries = [];
  const catalog = { async resolve(_text, _id, criteria) {
    queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] };
  } };
  return { queries, async send(text) {
    const result = await generatePropertyReply({ text, history, policyState: bounded ? state : undefined, catalog, ai: noAi });
    state = { buyer_state: result.buyer_state || state.buyer_state,
      client_identity: clientIdentity([...history, { role: 'user', content: text }], state.client_identity) };
    history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
    if (bounded) history = history.slice(-2);
    return { ...result, profile: result.buyer_state?.profile };
  } };
}

for (const name of ['banyuurip', 'banyu urip', 'BANYUURIP']) {
  test(`an unscoped ${name} stays ambiguous across administrative levels`, () => {
    const region = resolveRegion(name);
    assert.equal(region.city, null);
    assert.ok(region.clarification);
    const selected = resolvePendingRegionChoice('Surabaya pak', { pending: region.clarification });
    assert.equal(selected.clarification, null);
    assert.equal(selected.city, 'Surabaya');
    assert.equal(selected.district, 'Sawahan');
    assert.equal(selected.village, 'Banyu Urip');
  });
}

for (const bounded of [false, true]) {
  test(`Fikri's exact conversation retains Banyuurip on a city-only correction (${bounded ? 'bounded history' : 'full history'})`, async () => {
    for (const correction of ['bukan, di surabaya pak', 'di Surabaya maksudnya pak', 'ralat, di Surabaya', 'bukan Purworejo, tapi di Surabaya']) {
      const chat = conversation({ bounded });
      for (const text of ['siang', 'saya fikri', 'saya cari aset di banyuurip pak']) await chat.send(text);
      const corrected = await chat.send(correction);
      assert.equal(corrected.profile.city.toLowerCase(), 'surabaya', correction);
      assert.equal(corrected.profile.district, 'Sawahan', correction);
      assert.equal(corrected.profile.village.toLowerCase().replace(/\s/g, ''), 'banyuurip', correction);
      assert.match(corrected.reply, /Banyu\s*urip.*Surabaya/i);
      const choices = await chat.send('kecuali sewa pak');
      assert.doesNotMatch(choices.reply, noLocationQuestion);
      assert.match(choices.reply, /[Bb]udget/);
      await chat.send('budget 500 juta');
      await chat.send('rumah, luas tanah bebas');
      assert.equal(chat.queries.length, 1);
      assert.equal(chat.queries[0].district, 'Sawahan');
      assert.equal(chat.queries[0].village.toLowerCase().replace(/\s/g, ''), 'banyuurip');
      assert.equal(chat.queries[0].max_price, 500000000);
      assert.deepEqual(chat.queries[0].transaction_types, ['LELANG', 'PRIMARY', 'SECONDARY']);
    }
  });
}

test('a parent-only correction re-resolves the original name rather than its inferred district', async () => {
  const chat = conversation();
  await chat.send('cari rumah lelang di Benowo budget 500 juta luas tanah bebas');
  const result = await chat.send('bukan, di Purworejo pak');
  assert.equal(result.profile.city, 'Purworejo');
  assert.equal(result.profile.district, 'Bener');
  assert.equal(result.profile.village, 'Benowo');
  assert.equal(result.profile.max_price, 500000000);
  assert.doesNotMatch(result.reply, noLocationQuestion);
});

test('an explicit new city clears the old area instead of treating the move as a correction', async () => {
  const chat = conversation();
  await chat.send('cari rumah lelang di Banyu Urip, Surabaya budget 500 juta luas tanah bebas');
  const result = await chat.send('Ganti ke Kota Manado');
  assert.equal(result.profile.city, 'Kota Manado');
  assert.equal(result.profile.location, null);
  assert.equal(result.profile.village, null);
  assert.equal(result.profile.max_price, 500000000);
  assert.match(result.reply, /Incar daerah mana/i);
});

test('a rejected city does not silently place an explicitly named district in a different city', async () => {
  const chat = conversation();
  await chat.send('cari rumah lelang di Kecamatan Tandes budget 500 juta luas tanah bebas');
  const result = await chat.send('bukan, di Kota Bandung pak');
  assert.match(result.reply, /Tandes.*belum cocok.*Bandung/s);
  assert.equal(chat.queries.length, 1, 'only the original qualified search may query inventory');
});
