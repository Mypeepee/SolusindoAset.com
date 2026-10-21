import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { isBuyerCriteria } from '../../../../src/lib/chatbot/property-knowledge.ts';

export const PRICE_RANGES = [
  ['budget 300 - 900 juta pak', 300e6, 900e6],
  ['300–900jt', 300e6, 900e6],
  ['anggaran antara 300 dan 900 juta', 300e6, 900e6],
  ['budget 300 juta sampai dengan 900 juta', 300e6, 900e6],
  ['budget 300jt s/d 900jt', 300e6, 900e6],
  ['budget 300 s.d. 900 juta', 300e6, 900e6],
  ['budget minimal 300 maksimal 900 juta', 300e6, 900e6],
  ['dana Rp300.000.000–Rp900.000.000', 300e6, 900e6],
  ['budget tiga ratus sampai sembilan ratus juta', 300e6, 900e6],
  ['hmmm mungkin di angka 500 sampai 1m pak', 500e6, 1e9],
  ['budget 500 juta - 1 miliar', 500e6, 1e9],
  ['budget 0,5—1 miliar', 500e6, 1e9],
  ['budget lima ratus juta sampai satu miliar', 500e6, 1e9],
  ['budget 1 sampai 2M', 1e9, 2e9],
  ['budget 1,2–1,5 miliar', 1.2e9, 1.5e9],
];
export const LAND_RANGES = [
  ['luas tanah 100 - 200 m2', 100, 200],
  ['LT 100–200m²', 100, 200],
  ['luas tanah antara 100 dan 200 meter persegi', 100, 200],
  ['LT 100 m2 sampai dengan 200 m2', 100, 200],
  ['LT 100 s.d. 200 m2', 100, 200],
  ['luas tanah minimal 100 maksimal 200 m2', 100, 200],
  ['luas tanah seratus sampai dua ratus meter persegi', 100, 200],
  ['luas tanah 1–2 are', 100, 200],
  ['luas tanah 0,01 sampai 0,02 ha', 100, 200],
  ['LT 100,5 sampai 200,5 m2', 100.5, 200.5],
];
export function quantityRangeScenarios() {
  return PRICE_RANGES.flatMap((price) => LAND_RANGES.flatMap((land) => ['price-first', 'land-first'].map((order) => ({ price, land, order,
    name: `${order}: ${price[0]} / ${land[0]}` }))));
}
export async function simulateQuantityRange(scenario) {
  const { price, land, order } = scenario, sent = [], reads = [], captures = [];
  const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const now = () => Date.parse('2026-10-17T15:50:00Z'), store = new MemoryStore(config, now), transcript = [];
  const phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, now,
    catalog: { async resolve(_text, _id, criteria) { assert.ok(isBuyerCriteria(criteria)); reads.push(criteria); return { asset: null, catalog: [], status: 'not_found' }; } },
    ai: { generate() { assert.fail('Explicit ranges must work without AI'); } },
    clients: { setName() {}, enqueue(value) { captures.push(value); }, async flush() {} },
    whatsapp: { async sendText(_contact, text) { sent.push(text); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } },
  });
  try {
    for (const text of ['Saya Vera, saya cari rumah lelang di Surabaya Barat', ...(order === 'price-first' ? [price[0], land[0]] : [land[0], price[0]])]) {
      processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text, timestamp: now() }]);
      await processor.drain(); transcript.push({ user: text, reply: sent.at(-1) });
    }
    assert.equal(reads.length, 1, 'Only the complete request may query properties');
    for (const criteria of [reads[0], captures.at(-1)?.criteria, store.get(phone).buyer_state.profile]) {
      assert.ok(criteria, 'Search, CRM capture and continuation must all retain ranges');
      assert.equal(criteria.min_price, price[1]); assert.equal(criteria.max_price, price[2]);
      assert.equal(criteria.min_land_area_m2, land[1]); assert.equal(criteria.max_land_area_m2, land[2]);
      assert.equal(criteria.region_group, 'barat'); assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.transaction_type, 'LELANG');
    }
    assert.doesNotMatch(sent.at(-1), /Budget-nya sampai berapa|Jenis properti apa|Ada patokan luas tanah/);
    assert.equal(store.get(phone).client_identity.name, 'Vera');
    return { name: scenario.name, passed: true, transcript, criteria: reads[0] };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, transcript }; }
}
