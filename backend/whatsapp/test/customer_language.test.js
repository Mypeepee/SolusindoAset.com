import test from 'node:test';
import assert from 'node:assert/strict';
import { customerLanguageScenarios, simulateCustomerLanguage } from '../scripts/lib/customer-language-dialogues.js';
import { splitClientIntroduction, INTRODUCTION_MESSAGE, clientIdentity } from '../services/client_identity.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { shouldInterpretBuyer } from '../services/buyer_interpreter.js';

test('varied full customer conversations preserve identity, geographic hierarchy and funnel criteria', async () => {
  for (const scenario of customerLanguageScenarios()) {
    const result = await simulateCustomerLanguage(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});
for (const text of ['Waru', 'Waru sana', 'Tandes pak', 'Sidoarjo', 'lagi nyari rumah', 'sedang cari aset', 'nyari rumah di Waru', 'di Kebayoran sana', 'sy lagi nyari rumah', '500 juta', 'tdk ingin lelang', 'gk mau beli lelang', 'hmm', 'hmmm', 'bentar ya pak', 'sebentar dulu']) test(`a requirement does not become a name after greeting: ${text}`, () => {
  assert.equal(splitClientIntroduction(text, INTRODUCTION_MESSAGE).update, null);
});
test('subsequent clauses never overwrite the introduced name, while explicit corrections still work', () => {
  const text = 'saya Vera, sedang cari rumah di Sidoarjo, Waru sana, budget 500 juta';
  const parsed = splitClientIntroduction(text, INTRODUCTION_MESSAGE);
  assert.equal(parsed.update.name, 'Vera'); assert.match(parsed.remaining, /Waru sana/); assert.match(parsed.remaining, /budget 500 juta/);
  const history = [{ role: 'assistant', content: INTRODUCTION_MESSAGE }, { role: 'user', content: text }];
  assert.equal(clientIdentity([...history, { role: 'assistant', content: 'Mau beli atau sewa?' }, { role: 'user', content: 'lelang, daerah Waru saja' }]).name, 'Vera');
  assert.equal(clientIdentity([...history, { role: 'user', content: 'panggil saya Bu Vera' }]).salutation, 'Bu');
});

test('a clear budget answer skips semantic interpretation while extra unknown requirements remain eligible', () => {
  const buyer = { stage: 'qualifying', progress: ['max_price'], needs_interpretation: true, missing: ['category', 'land_area'] };
  for (const text of ['budget 500 juta mentok', 'budget maksimal Rp500.000.000 pak', 'di angka 500 jt saja', 'budget tiga ratus juta',
    'budget saya 400-600 mentok', '600 mentok', '400 sampai 600 pak']) assert.equal(shouldInterpretBuyer(buyer, text), false, text);
  assert.equal(shouldInterpretBuyer(buyer, 'budget 500 juta, buat tempat tinggal ataupun buka warung'), true);
});

test('six customers chatting concurrently keep independent names, locations, budgets and CRM captures', async () => {
  const people = [ ['Vera', 'Waru', 'Sidoarjo'], ['Budi', 'Tandes', 'Surabaya'], ['Rina', 'Tebet', 'Jakarta Selatan'],
    ['Alex', 'Menganti', 'Gresik'], ['Sari', 'Coblong', 'Kota Bandung'], ['Dwi', 'Taman', 'Sidoarjo'] ].map(([name, district, city], index) => ({
    name, district, city, phone: `628000000000${index + 1}`, budget: 500000000 + index * 100000000, land: 150 + index * 10,
  }));
  const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 100, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config), captures = new Map(), replies = new Map(), queries = [];
  const processor = new MessageProcessor({ config, store,
    ai: { generate() { assert.fail('Known customer answers do not need AI'); }, interpretBuyer() { assert.fail('Known customer answers do not need interpretation'); } },
    catalog: { async resolve(text, id, criteria) { await new Promise((resolve) => setImmediate(resolve)); queries.push(criteria); return { status: 'not_found', asset: null, catalog: [] }; } },
    whatsapp: { async sendText(phone, text) { replies.set(phone, text); return 'mock'; } },
    clients: { setName() {}, enqueue(value) { captures.set(value.phone, structuredClone(value)); }, async flush() {} },
    logger: { error(value) { assert.fail(value.event); } },
  });
  const phases = [ () => 'halo', (p) => `saya ${p.name}, sedang cari aset di ${p.city}, ${p.district} sana`,
    () => 'lelang', (p) => `budget ${p.budget / 1000000} juta`, () => 'rumah', (p) => `luas tanah minimal ${p.land} m2` ];
  for (const [index, text] of phases.entries()) {
    processor.acceptBatch(people.map((person) => ({ id: `${person.phone}/${index}`, from: person.phone, type: 'text', text: text(person), timestamp: Date.now() })));
    await processor.drain();
  }
  assert.equal(queries.length, people.length);
  for (const person of people) {
    const session = store.get(person.phone), captured = captures.get(person.phone);
    assert.equal(session.client_identity.name, person.name); assert.equal(captured.name, person.name);
    assert.equal(captured.criteria.city.toLowerCase(), person.city.toLowerCase()); assert.equal(captured.criteria.district.toLowerCase(), person.district.toLowerCase());
    assert.equal(captured.criteria.max_price, person.budget); assert.equal(captured.criteria.min_land_area_m2, person.land);
    assert.match(replies.get(person.phone), new RegExp(person.district, 'i'));
  }
});
