import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPropertyCategory, anyPropertyCategory } from '../services/property_category.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { priceContext, system_prompt } from '../services/ai_controller.js';

function conversation() {
  const history = [];
  return { send(text) {
    history.push({ role: 'user', content: text });
    const buyer = buyerContext(history, text, null);
    const reply = searchReply({ buyer, status: buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' });
    if (reply) history.push({ role: 'assistant', content: reply });
    assert.doesNotMatch(reply || '', /untuk dihuni|untuk investasi|tujuan pembelian|atau keduanya/i);
    return buyer;
  } };
}

test('property types and aliases map to real database categories without interpreting land size or administrative names as types', () => {
  for (const [type, category] of Object.entries({ rumah: 'RUMAH', ruko: 'RUKO', 'rumah toko': 'RUKO', gudang: 'GUDANG',
    tanah: 'TANAH', apartemen: 'APARTEMEN', apartment: 'APARTEMEN', toko: 'TOKO', pabrik: 'PABRIK', kos: 'KOS',
    kost: 'KOS', 'kos-kosan': 'KOS', hotel: 'HOTEL_DAN_VILLA', vila: 'HOTEL_DAN_VILLA', villa: 'HOTEL_DAN_VILLA', 'hotel/vila': 'HOTEL_DAN_VILLA' })) {
    assert.equal(extractPropertyCategory(`Saya cari ${type} di Sidoarjo`), category, type);
    assert.equal(extractPropertyCategory(`${type} saja pak`, { expected: true }), category, type);
  }
  for (const text of ['luas tanah minimal 120 m', 'luas tanah maksimal 200 m²', 'di Kecamatan Tanah Abang', 'Kelurahan Gudang', 'di daerah Gudang', 'dekat rumah sakit']) {
    assert.equal(extractPropertyCategory(text), null, text);
  }
  assert.equal(extractPropertyCategory('Ganti dari rumah ke gudang'), 'GUDANG');
  assert.equal(extractPropertyCategory('Bukan ruko, saya cari lelang gudang'), 'GUDANG');
  assert.equal(extractPropertyCategory('Di Waru, ruko pak'), 'RUKO');
  assert.equal(extractPropertyCategory('rumah atau ruko'), null, 'do not invent a choice');
  assert.equal(anyPropertyCategory('jenis bebas'), true);
  assert.equal(anyPropertyCategory('bebas pak', true), true);
  assert.equal(anyPropertyCategory('luas tanah bebas'), false);
});

test('reported Waru conversation keeps district scope and completes at the land answer without requiring purchase purpose', () => {
  for (const landAnswer of ['diinvestasi pak, untuk luas tanah sih minimal 120 m', 'untuk luas tanah sih minimal 120 m']) {
    const c = conversation();
    const first = c.send('selamat siang, saya sedang cari lelang ruko di daerah sidoarjo pak, apakah ada?');
    assert.equal(first.profile.category, 'RUKO'); assert.ok(!first.missing.includes('category'));
    c.send('di daerah waru pak...');
    const scoped = c.send('intinya di waru , dengan budget 600 juta pak');
    assert.equal(scoped.profile.district, 'waru'); assert.equal(scoped.profile.village, null);
    assert.deepEqual(scoped.missing, ['land_area']);
    const ready = c.send(landAnswer);
    assert.equal(ready.stage, 'recommendations'); assert.deepEqual(ready.missing, []);
    assert.equal(ready.profile.category, 'RUKO'); assert.equal(ready.profile.max_price, 600000000);
    assert.equal(ready.profile.min_land_area_m2, 120); assert.equal(ready.profile.village, null);
  }
});

test('repeating a district accepts its whole area while an explicitly named same-name village narrows the search', () => {
  for (const answer of ['Waru pak', 'di Waru saja pak', 'intinya di Waru, budget 600 juta']) {
    const c = conversation(); c.send('Cari lelang ruko di Sidoarjo'); c.send('Waru pak');
    const buyer = c.send(answer);
    assert.equal(buyer.profile.district.toLowerCase(), 'waru'); assert.equal(buyer.profile.village, null, answer);
    assert.ok(!buyer.missing.includes('village'), answer);
  }
  const c = conversation(); c.send('Cari lelang ruko di Sidoarjo'); c.send('Waru pak');
  const buyer = c.send('Kelurahan Waru pak');
  assert.equal(buyer.profile.village, 'Waru'); assert.ok(!buyer.missing.includes('village'));
});

test('unknown property type is asked once; a warehouse answer, type change and free choice retain all other filters', () => {
  const c = conversation();
  const pending = c.send('Cari lelang aset di Kecamatan Waru, Sidoarjo kelurahan bebas budget 600 juta luas tanah minimal 120 m');
  assert.deepEqual(pending.missing, ['category']);
  const warehouse = c.send('gudang pak');
  assert.equal(warehouse.stage, 'recommendations'); assert.equal(warehouse.profile.category, 'GUDANG');
  assert.equal(warehouse.profile.village, null); assert.equal(warehouse.profile.district, 'Waru');
  const shop = c.send('ganti dari gudang ke ruko');
  assert.equal(shop.profile.category, 'RUKO'); assert.equal(shop.stage, 'recommendations');
  const free = c.send('jenis bebas');
  assert.equal(free.profile.category, null); assert.equal(free.stage, 'recommendations');
  assert.equal(free.profile.max_price, 600000000); assert.equal(free.profile.min_land_area_m2, 120);
});

test('natural interest and availability questions recognize every supported property type', () => {
  for (const type of ['ruko', 'gudang', 'pabrik', 'hotel', 'vila', 'toko', 'kos']) {
    for (const text of [`Saya tertarik ${type} di Sidoarjo`, `Adakah ${type} di Sidoarjo pak?`]) {
      const buyer = buyerContext([], text, null);
      assert.equal(buyer.searching, true, text); assert.equal(buyer.profile.city, 'Sidoarjo', text);
      assert.ok(buyer.profile.category, text);
    }
  }
});

test('model instructions and numeric price context no longer solicit purchase purpose', () => {
  assert.match(system_prompt, /Jangan menanyakan tujuan pembelian/);
  const reply = priceContext({ calculation: { limit_display: 'Rp 600.000.000', market_display: null } });
  assert.doesNotMatch(reply, /dihuni|investasi|flipping|\?/i);
});
