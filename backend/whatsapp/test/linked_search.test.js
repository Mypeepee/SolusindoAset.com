import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationFixture, PHONE } from '../scripts/lib/consultation-fixture.js';
import { ClientOutbox } from '../state/client_outbox.js';
import { inferredSearch, inferredSearchSummary, LINKED_SEARCH_CONFIRMATION, LINKED_SEARCH_CORRECTION } from '../services/linked_search.js';

function fixture(t, { village = 'Legian', district = 'Kuta', category = 'RUMAH' } = {}) {
  const f = consultationFixture('LELANG');
  t.after(() => f.close());
  f.asset.category = category;
  f.asset.address = { city: 'Kab. Badung', province: 'Bali', district, village };
  f.asset.location = 'Kab. Badung'; f.asset.full_address = 'Alamat sumber sintetis di Badung';
  const saved = [], queries = [];
  const clients = new ClientOutbox(':memory:', { url: 'http://localhost/mock-clients', token: 'x'.repeat(40), timeoutMs: 1000 }, {
    fetchImpl: async (_url, options) => { saved.push(JSON.parse(options.body)); return Response.json({ id_klien: 'KL0000001', id_agent: 'AG108', status: saved.length === 1 ? 'created' : 'updated' }); },
  });
  f.processor.clients = clients; t.after(() => clients.close());
  const originalResolve = f.processor.catalog.resolve;
  f.processor.catalog.resolve = async (text, previousId, criteria) => {
    if (!criteria) return originalResolve(text, previousId);
    queries.push(structuredClone(criteria));
    return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' };
  };
  return { ...f, saved, queries, clients,
    async send(text) { const reply = await f.send(text); await clients.flush(); return reply; },
    async prepare() { await f.send('rincian biaya'); await f.send('terlalu tinggi'); return f.send('400–500 juta'); },
  };
}

test('the summary proposes location and property type from the link and the customer budget only', async t => {
  const f = fixture(t);
  const reply = await f.prepare();
  assert.match(reply, /rumah di Kelurahan Legian, Kecamatan Kuta, Kab\. Badung/);
  assert.match(reply, /Rp 400\.000\.000–Rp 500\.000\.000/);
  assert.ok(reply.endsWith(LINKED_SEARCH_CONFIRMATION));
  assert.doesNotMatch(reply, /Mau saya bantu carikan aset lain|minimal 120|1\.000\.000\.000/);
  assert.equal(f.queries.length, 0); assert.equal(f.saved.length, 0);
});

for (const text of ['iya', 'ya betul', 'betul pak', 'oke', 'cocok', 'nggih']) test(`confirmation searches the proposed criteria and saves the client: ${text}`, async t => {
  const f = fixture(t); await f.prepare();
  const reply = await f.send(text);
  assert.match(reply, /rumah lelang.*Legian/s);
  assert.equal(f.queries.length, 1); assert.equal(f.saved.length, 1);
  const c = f.saved[0].criteria;
  assert.equal(c.city, 'Kab. Badung'); assert.equal(c.district, 'Kuta'); assert.equal(c.village, 'Legian');
  assert.equal(c.category, 'RUMAH'); assert.equal(c.min_total_budget, 400000000); assert.equal(c.max_total_budget, 500000000);
  assert.equal(c.min_land_area_m2, null); assert.equal(c.max_land_area_m2, null);
  assert.equal(f.processor.store.get(PHONE).conversion.mode, 'Search_State');
  assert.deepEqual(f.queries[0].exclude_ids, [f.asset.id]);
  assert.deepEqual(f.errors, []);
});

for (const text of ['oh saya apartemen saja', 'apartemen aja', 'saya mau apartemen', 'ganti ke apartemen']) test(`a type correction accepts the retained location and budget: ${text}`, async t => {
  const f = fixture(t); await f.prepare();
  const reply = await f.send(text);
  assert.match(reply, /apartemen lelang/); assert.doesNotMatch(reply, /Budget-nya sampai berapa|Jenis properti apa|Luas tanah.*berapa/i);
  assert.equal(f.queries.length, 1); assert.equal(f.saved.length, 1);
  for (const c of [f.queries[0], f.saved[0].criteria]) {
    assert.equal(c.category, 'APARTEMEN'); assert.equal(c.city, 'Kab. Badung'); assert.equal(c.village, 'Legian');
    assert.equal(c.max_total_budget, 500000000);
  }
  assert.deepEqual(f.errors, []);
});

for (const text of ['oh saya cari minim luasan 100', 'minimal luasan 100', 'minim luas 100', 'luas tanah minimal 100', 'saya cari minimal 100 m2', 'luasan minimal 100 m²']) {
  test(`an added minimum always filters and stores land area: ${text}`, async t => {
    const f = fixture(t); await f.prepare(); await f.send('oh saya apartemen saja');
    const reply = await f.send(text);
    assert.match(reply, /luas tanah minimal 100 m²/);
    assert.equal(f.queries.length, 2); assert.equal(f.saved.length, 2);
    const c = f.saved.at(-1).criteria;
    assert.equal(c.min_land_area_m2, 100); assert.equal(c.max_land_area_m2, null);
    assert.equal(c.category, 'APARTEMEN'); assert.equal(c.village, 'Legian'); assert.equal(c.city, 'Kab. Badung');
    assert.equal(c.max_total_budget, 500000000); assert.ok(!Object.keys(c).some(key => /building|bangunan/.test(key)));
    assert.deepEqual(f.errors, []);
  });
}

test('a minimum can be supplied as the first correction without restating type or budget', async t => {
  const f = fixture(t); await f.prepare();
  await f.send('oh saya cari minim luasan 120');
  assert.equal(f.saved.length, 1); assert.equal(f.saved[0].criteria.category, 'RUMAH');
  assert.equal(f.saved[0].criteria.min_land_area_m2, 120); assert.equal(f.saved[0].criteria.max_total_budget, 500000000);
});

test('a rejected summary asks which criterion to change and saves nothing', async t => {
  const f = fixture(t); await f.prepare();
  assert.equal(await f.send('bukan'), LINKED_SEARCH_CORRECTION);
  assert.equal(f.saved.length, 0); assert.equal(f.queries.length, 0);
  await f.send('apartemen saja'); assert.equal(f.saved.length, 1); assert.equal(f.saved[0].criteria.category, 'APARTEMEN');
});

test('an invalid source district and an absent village are not invented', t => {
  const f = fixture(t, { village: null, district: 'Indonesia', category: 'APARTEMEN' });
  const s = inferredSearch(f.asset, 500000000, 400000000), reply = inferredSearchSummary(s);
  assert.equal(s.profile.city, 'Kab. Badung'); assert.equal(s.profile.district, null); assert.equal(s.profile.village, null);
  assert.equal(s.profile.location, 'Kab. Badung');
  assert.match(reply, /Kelurahan belum tercantum/); assert.doesNotMatch(reply, /di Indonesia|Kecamatan Indonesia|Legian/);
});

test('explicit building area does not silently become a land preference', async t => {
  const f = fixture(t); await f.prepare(); await f.send('iya');
  await f.send('luas bangunan minimal 100 m2');
  assert.equal(f.processor.store.get(PHONE).buyer_state.profile.min_land_area_m2, null);
});

test('an invalid land range is clarified before another search or CRM save', async t => {
  const f = fixture(t); await f.prepare(); await f.send('apartemen saja');
  const reply = await f.send('luas tanah 200–100 m2');
  assert.match(reply, /luas.*(?:valid|besar|maksimal|minimal|batas|rentang)|rentang.*luas/i);
  assert.equal(f.saved.length, 1); assert.equal(f.queries.length, 1);
});

test('the source listing area is never used as a minimum land requirement', async t => {
  const f = fixture(t); f.asset.specifications.land_area_m2 = 900;
  await f.prepare(); await f.send('apartemen saja');
  assert.equal(f.saved[0].criteria.min_land_area_m2, null);
});

test('an explicit city correction is retained by later land and property corrections', async t => {
  const f = fixture(t); await f.prepare(); await f.send('apartemen saja');
  await f.send('Surabaya'); await f.send('seluruh Surabaya'); await f.send('luas tanah minimal 150');
  const criteria = f.saved.at(-1).criteria;
  assert.match(criteria.city, /Surabaya/); assert.equal(criteria.village, null); assert.equal(criteria.district, null);
  assert.equal(criteria.category, 'APARTEMEN'); assert.equal(criteria.min_land_area_m2, 150);
  assert.equal(criteria.max_total_budget, 500000000); assert.deepEqual(f.errors, []);
});
