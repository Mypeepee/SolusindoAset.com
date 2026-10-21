import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationFollowupFixture, PHONE } from '../scripts/lib/notification-followup-fixture.js';
import { recommendationIds } from '../services/recommendations.js';

test('four-property automatic offer -> number 3 -> fresh detail -> four new alternatives -> no more matches', async t => {
  const f = await notificationFollowupFixture(); t.after(() => f.close());
  assert.equal(f.queue.status('AG108').delivered, 4);
  assert.deepEqual(recommendationIds(f.sent[0].text), ['9001001', '9001002', '9001003', '9001004']);
  const detail = await f.send('yang nomor 3');
  assert.match(detail, /DETAIL ASET — Kode 9001003/); assert.match(detail, /785\.000\.000/);
  assert.match(detail, /tanah-tandes-9001003\/AG108/);
  assert.doesNotMatch(detail, /Kode 9001001|Budget-nya sampai berapa|Incar daerah mana/);
  assert.equal(f.processor.store.get(PHONE).asset_id, '9001003');
  const alternatives = await f.send('ada yang lain?');
  assert.deepEqual(recommendationIds(alternatives), ['9001005', '9001006', '9001007', '9001008']);
  assert.equal((alternatives.match(/\/AG108/g) || []).length, 4);
  assert.match(alternatives, /Kriterianya tetap|kriterianya tetap/); assert.match(alternatives, /luas tanah minimal 100/);
  assert.doesNotMatch(alternatives, /Incar daerah mana|Budget-nya sampai berapa/);
  const criteria = f.queries.findLast(q => q.criteria).criteria;
  assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.max_price, 1000000000); assert.equal(criteria.min_land_area_m2, 100);
  assert.equal(criteria.district, null); assert.equal(criteria.category, 'TANAH');
  assert.deepEqual(new Set(criteria.exclude_ids), new Set(['9001001', '9001002', '9001003', '9001004']));
  const nextDetail = await f.send('nomor 3'); assert.match(nextDetail, /DETAIL ASET — Kode 9001007/);
  const exhausted = await f.send('ada yang lain?');
  assert.equal(recommendationIds(exhausted).length, 0); assert.match(exhausted, /belum ada pilihan lain yang belum saya tawarkan/);
  assert.match(exhausted, /sampai Koko menentukan perubahannya/); assert.deepEqual(f.errors, []);
});

test('saved CRM criteria and all previous offer exclusions survive idle, restart and LID aliases', async t => {
  const f = await notificationFollowupFixture({ previousIds: ['9001005'] }); t.after(() => f.close());
  f.advance(2 * 3600000); f.restart();
  const reply = await f.send('ada yang lain?', 'lid:987654321');
  assert.deepEqual(recommendationIds(reply), ['9001006', '9001007', '9001008']);
  assert.doesNotMatch(reply, /Incar daerah mana|Budget-nya sampai berapa|Boleh tahu saya ngobrol dengan siapa/);
  const criteria = f.queries.findLast(q => q.criteria).criteria;
  assert.equal(criteria.max_price, 1000000000); assert.equal(criteria.min_land_area_m2, 100);
  assert.ok(criteria.exclude_ids.includes('9001005')); assert.deepEqual(f.errors, []);
});

test('an invalid or ambiguous number clarifies without guessing a property', async t => {
  const f = await notificationFollowupFixture(); t.after(() => f.close());
  const invalid = await f.send('nomor 9'); assert.match(invalid, /belum cocok dengan daftar/);
  assert.equal(f.queries.length, 0);
  const ambiguous = await f.send('nomor 2 atau nomor 3'); assert.match(ambiguous, /beberapa pilihan/); assert.equal(f.queries.length, 0);
  const detail = await f.send('nomor 3'); assert.match(detail, /Kode 9001003/); assert.deepEqual(f.errors, []);
});

test('the second batch remains selectable after restart and older offers stay excluded', async t => {
  const f = await notificationFollowupFixture(); t.after(() => f.close());
  await f.send('ada yang lain?'); f.advance(3600000); f.restart();
  const detail = await f.send('nomor 3'); assert.match(detail, /Kode 9001007/);
  const empty = await f.send('ada yang lain?'); assert.match(empty, /belum ada pilihan lain/); assert.equal(recommendationIds(empty).length, 0);
  assert.deepEqual(f.errors, []);
});
