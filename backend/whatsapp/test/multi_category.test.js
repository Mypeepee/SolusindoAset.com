import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryPreference } from '../services/property_category.js';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { multiCategoryScenarios, runMultiCategoryScenario } from '../scripts/lib/multi-category-dialogues.js';

test('all supported multi-type combinations, four-type list permutations and ordered edits reach search intact', async () => {
  for (const scenario of multiCategoryScenarios()) {
    const result = await runMultiCategoryScenario(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});

test('ordered commands keep list scope and can remove then restore the same category', () => {
  const previous = ['GUDANG', 'PABRIK', 'TANAH', 'RUKO'];
  for (const [text, expected] of [
    ['hapus gudang, pabrik, tanah', ['RUKO']],
    ['hapus gudang dan pabrik lalu tambahkan rumah', ['TANAH', 'RUKO', 'RUMAH']],
    ['tambahkan rumah dan hapus gudang', ['PABRIK', 'TANAH', 'RUKO', 'RUMAH']],
    ['hapus gudang lalu tambahkan gudang', ['PABRIK', 'TANAH', 'RUKO', 'GUDANG']],
    ['ganti dari gudang, pabrik, tanah ke ruko', ['RUKO']],
    ['ganti gudang dengan pabrik dan tanah', ['PABRIK', 'TANAH']],
    ['gudang dan juga pabrik', ['GUDANG', 'PABRIK']],
  ]) assert.deepEqual(categoryPreference(text, { previous }).values, expected, text);
});

test('four-type answer acknowledges every type and asks only for missing land preference', () => {
  const history = [{ role: 'user', content: 'Cari lelang aset di Kecamatan Menganti, Kabupaten Gresik, kelurahan bebas, budget 400 juta' },
    { role: 'assistant', content: 'Jenis properti apa yang dicari? Apakah ada batas luas tanah?' }];
  const buyer = buyerContext(history, 'gudang, pabrik, tanah, atau ruko pak', null);
  assert.deepEqual(buyer.missing, ['land_area']);
  const reply = searchReply({ buyer });
  assert.match(reply, /gudang, pabrik, tanah, atau ruko/);
  assert.match(reply, /(?:batas|patokan) luas tanah/);
  assert.doesNotMatch(reply, /Jenis properti apa/);
});
