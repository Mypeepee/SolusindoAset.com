import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLandArea } from '../services/land_area.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { normalizeLandDimensions } from '../services/land_dimensions.js';

for (const value of ['7,5 x 15', '7.5 × 15', '7,5 meter dikalikan 15 meter', '7,5 m kali 15 m', '7,5 * 15']) {
  test(`rectangular land dimensions do not become a budget: ${value}`, () => {
    assert.equal(normalizeLandDimensions(value), '112.5 m2');
    const buyer = buyerContext([
      { role: 'user', content: 'Cari rumah lelang di seluruh Surabaya' },
      { role: 'assistant', content: 'Budget-nya sampai berapa? Ada patokan luas tanah minimal atau maksimal?' },
    ], value, null);
    assert.equal(buyer.profile.max_price, null); assert.equal(buyer.budget_error, null);
    assert.equal(buyer.land_area_error, 'ambiguous');
    const next = buyerContext([{ role: 'assistant', content: 'Luas tanah tadi maksudnya batas minimal, batas maksimal, atau luas persis?' }],
      'Batas minimal', null, { continuation: buyer.continuation });
    assert.equal(next.profile.min_land_area_m2, 112.5); assert.equal(next.profile.max_land_area_m2, null);
    assert.equal(next.land_area_error, null); assert.equal(next.budget_error, null);
  });
}

test('an explicitly qualified rectangular measurement sets the requested bound', () => {
  assert.deepEqual(extractLandArea('luas tanah minimal 7,5 x 15'), { min_land_area_m2: 112.5 });
  assert.deepEqual(extractLandArea('LT maksimal 10 kali 20 meter'), { max_land_area_m2: 200 });
  for (const value of ['luas bangunan 7,5 x 15', 'LB 7,5 x 15']) assert.equal(extractLandArea(value), null);
  assert.equal(normalizeLandDimensions('7,5 x 15 x 3'), '7,5 x 15 x 3');
});

test('the customer can correct a measurement and answer its bound without repeating the number', () => {
  let buyer = buyerContext([{ role: 'user', content: 'Cari rumah lelang di seluruh Surabaya budget 425 juta' },
    { role: 'assistant', content: 'Ada patokan luas tanah minimal atau maksimal?' }], '7,5 x 15', null);
  for (const content of ['120 meter persegi', '+/- 120 meter persegi', 'Batas minimal']) {
    buyer = buyerContext([{ role: 'assistant', content: searchReply({ buyer, status: 'qualifying' }) }], content,
      null, { continuation: buyer.continuation });
  }
  assert.equal(buyer.profile.min_land_area_m2, 120); assert.equal(buyer.profile.max_land_area_m2, null);
  assert.equal(buyer.profile.max_price, 425000000); assert.equal(buyer.land_area_error, null);
});

test('a bare numeric size retains its value when the customer replies with a bound', () => {
  const first = buyerContext([{ role: 'user', content: 'Cari rumah lelang di seluruh Surabaya budget 425 juta' },
    { role: 'assistant', content: 'Ada patokan luas tanah minimal atau maksimal?' }], '120', null);
  const buyer = buyerContext([{ role: 'assistant', content: searchReply({ buyer: first, status: 'qualifying' }) }],
    'batas maksimal', null, { continuation: first.continuation });
  assert.equal(buyer.profile.max_land_area_m2, 120); assert.equal(buyer.profile.max_price, 425000000);
});
