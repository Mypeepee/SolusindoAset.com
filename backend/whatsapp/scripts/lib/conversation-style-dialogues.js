import assert from 'node:assert/strict';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { TRANSACTION_TYPES, transactionValues } from '../../services/property_transaction.js';
import { isBuyerCriteria } from '../../../../src/lib/chatbot/property-knowledge.ts';

export const flexibleAnswers = [
  'bebas sih', 'bebas sih pak', 'BEBAS SIH BU', 'hmm bebas sih', 'bebasss sihh pak 😂',
  'saya sih bebas', 'kalau saya bebas aja', 'aku bebas kok', 'ya bebas deh', 'bebas aja mbak',
  'bebas lah', 'bebas, pak 🙏', 'terserah sih', 'terserah aja bu', 'terserah deh pak',
  'apa aja boleh', 'apa saja sih', 'apapun boleh pak', 'yang mana aja boleh', 'mana aja sih',
  'semua boleh sih', 'semuanya boleh kok', 'semua bisa deh', 'semuanya bebas pak', 'semua aja',
  'fleksibel sih', 'saya fleksibel kok', 'ga pilih-pilih pak', 'nggak pilih pilih',
  'tidak ada preferensi', 'gak ada preferensi sih', 'terserah bapak aja', 'oke semua boleh',
  'iya, bebas kok pak', 'bebas😊', 'terserahhhh deh', 'semuanya boleh 😂', 'apa pun boleh bu',
];
const unitAnswers = ['juta pak', 'jt aja', 'iya juta sih', 'dalam juta ya bu', 'maksud saya juta pak',
  'juta rupiah kok', 'juta ya 😊', 'juta sih pak', 'juta dong'];
const periodAnswers = ['per tahun pak', 'tahun aja', 'tahunan sih', 'setahun kok bu', 'thn aja pak',
  'iya, tahunan deh', 'untuk setahun pak', 'per tahun 😊'];
const uncertainAnswers = ['belum tahu pak', 'belum ada pilihan', 'belum ada preferensi', 'bingung sih',
  'mungkin bebas', 'kayaknya bebas', 'bebas itu apa?', 'semua boleh?', 'tidak bebas', 'ga bebas sih',
  'tidak semua boleh', 'belum tentu bebas', 'yang murah aja', 'bebas ongkir', 'luas tanah bebas', 'jenis properti bebas'];
const all = TRANSACTION_TYPES;
const budget = { min_price: 100e6, max_price: 200e6 };
const base = (person = 'Kartini') => [{ text: 'selamat siang pak' }, { text: `saya ${person}` }];
const freeStep = (text, extra = {}) => ({ text, transactions: all, noQuestion: /Mau beli atau sewa|pilihannya lelang/i, ...extra });

export function conversationStyleScenarios() {
  const scenarios = [];
  for (const [index, answer] of flexibleAnswers.entries()) {
    const unit = unitAnswers[index % unitAnswers.length], period = periodAnswers[index % periodAnswers.length];
    const tail = [{ text: period, rental_period: 'TAHUNAN', ...budget }, { text: 'rumah', category: 'RUMAH' },
      { text: 'luas tanah minimal 72 m2', land: 72, queried: true }];
    scenarios.push({ name: `budget dulu / ${answer}`, kind: 'transaction', steps: [...base(),
      { text: 'saya cari aset di benowo pak budget 100 - 200 mentok', trim: true },
      { text: unit, ...budget }, freeStep(answer, budget), ...tail] });
    scenarios.push({ name: `transaksi dulu / ${answer}`, kind: 'transaction', steps: [...base('Dwi'),
      { text: 'lagi cari aset di Benowo, Surabaya' }, freeStep(answer),
      { text: 'budgetnya 100 sampai 200 juta', ...budget }, ...tail] });
    scenarios.push({ name: `jawaban gabungan / ${answer}`, kind: 'transaction', steps: [...base('Bu Rina'),
      { text: 'cari aset di Benowo, Surabaya' }, freeStep(`${answer}, budget 100–200 juta`, budget), ...tail] });
    scenarios.push({ name: `rumah dan luas sudah jelas / ${answer}`, kind: 'transaction', steps: [...base('Pak Budi'),
      { text: 'cari rumah di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2' },
      freeStep(answer, { ...budget, category: 'RUMAH', land: 72 }),
      { text: period, rental_period: 'TAHUNAN', queried: true }] });
    // The same utterance must answer its pending field, preserving transaction
    // and geographic preferences. It must not clear both type and land bounds.
    scenarios.push({ name: `jenis properti / ${answer}`, kind: 'category', steps: [...base(),
      { text: 'cari lelang aset di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2' },
      { text: answer, transactions: ['LELANG'], category: null, land: 72, queried: true,
        noQuestion: /Jenis properti apa|belum menangkap/i }] });
    scenarios.push({ name: `luas tanah / ${answer}`, kind: 'land', steps: [...base(),
      { text: 'cari lelang rumah di Benowo Surabaya budget 100–200 juta' },
      { text: answer, transactions: ['LELANG'], category: 'RUMAH', land: null, queried: true,
        noQuestion: /Ada patokan luas|belum menangkap/i }] });
  }
  for (const answer of ['transaksinya bebas sih', 'untuk transaksi bebas kok pak', 'jenis transaksi apa saja boleh',
    'jenisnya bebas sih', 'tipe transaksinya terserah pak', 'untuk transaksi sih bebas', 'transaksi mah bebas',
    'beli atau sewa sama aja', 'beli/sewa bebas sih', 'sewa atau beli dua-duanya boleh',
    'apa aja yang penting sesuai budget', 'bebas asal sesuai budget', 'bebas, yang penting murah', 'lelang primary secondary sewa semua boleh']) {
    scenarios.push({ name: `pilihan eksplisit / ${answer}`, kind: 'transaction', steps: [...base(),
      { text: 'cari rumah di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2' },
      freeStep(answer, budget), { text: 'tahunan aja', rental_period: 'TAHUNAN', queried: true }] });
  }
  for (const [answer, types] of [
    ['bebas sih, tapi jangan lelang', ['PRIMARY', 'SECONDARY', 'SEWA']],
    ['bebas asal bukan sewa', ['LELANG', 'PRIMARY', 'SECONDARY']],
    ['bebas, secondary aja sih', ['SECONDARY']],
  ]) scenarios.push({ name: `koreksi pilihan / ${answer}`, kind: 'correction', expected: types, steps: [...base(),
    { text: 'cari rumah di Benowo Surabaya budget 100–200 juta luas tanah minimal 72m2' },
    { text: answer, transactions: types }, ...(types.includes('SEWA') ? [{ text: 'tahun aja' }] : [])] });
  for (const answer of uncertainAnswers) scenarios.push({ name: `klarifikasi tetap diperlukan / ${answer}`, kind: 'uncertain', steps: [...base(),
    { text: 'cari aset di Benowo Surabaya budget 100–200 juta' }, { text: answer, transactions: [], queried: false }] });
  for (const [answer, period] of [['juta per tahun pak', 'TAHUNAN'], ['jt per bulan sih', 'BULANAN']]) {
    scenarios.push({ name: `satuan dan periode sekaligus / ${answer}`, kind: 'transaction', steps: [...base(),
      { text: 'cari aset di Benowo Surabaya' }, freeStep('bebas sih'),
      { text: 'budget 100–200', trim: true }, { text: answer, ...budget, rental_period: period },
      { text: 'rumah, luas tanah minimal 72m2', queried: true }] });
  }
  return scenarios;
}

const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
export async function simulateConversationStyle(scenario) {
  const store = new MemoryStore(config), phone = '6280000000042', replies = [], queries = [], captures = [], errors = [], transcript = [];
  let aiCalls = 0, sequence = 0, introducedIdentity = null;
  const processor = new MessageProcessor({ config, store,
    ai: { generate() { aiCalls++; throw Error('UNEXPECTED_AI'); }, interpretBuyer() { aiCalls++; throw Error('UNEXPECTED_INTERPRETATION'); } },
    catalog: { async resolve(_text, _id, criteria) {
      assert.ok(isBuyerCriteria(criteria), 'Search criteria must pass the actual property API validator');
      queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] };
    } },
    clients: { setName() {}, enqueue(value) { captures.push(structuredClone(value)); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { replies.push(text); return `mock-${sequence}`; } },
    logger: { error(value) { errors.push(value.code || value.event); } },
  });
  try {
    for (const step of scenario.steps) {
      const before = replies.length;
      processor.acceptBatch([{ id: `style-${++sequence}`, type: 'text', from: phone, text: step.text, timestamp: Date.now() }]);
      await processor.drain();
      const session = store.get(phone), profile = session.buyer_state?.profile;
      const reply = replies.slice(before).join('\n');
      transcript.push({ user: step.text, reply, profile: structuredClone(profile), queried: queries.length > 0 });
      assert.ok(reply, `Must reply to ${step.text}`); assert.equal(session.is_bot_active, true);
      if (sequence === 2) introducedIdentity = structuredClone(session.client_identity);
      if (introducedIdentity) assert.deepEqual(session.client_identity, introducedIdentity, 'Preference answers must not rename the client');
      assert.deepEqual(errors, []); assert.equal(aiCalls, 0, 'Clear everyday language must not need an external model');
      if (profile?.city) {
        assert.equal(profile.city.toLowerCase().replace(/^kota /, ''), 'surabaya');
        assert.equal(profile.district?.toLowerCase(), 'benowo');
      }
      if (step.transactions) assert.deepEqual([...transactionValues(profile)].sort(), [...step.transactions].sort(), 'Transaction choice');
      for (const key of ['min_price', 'max_price', 'category', 'rental_period']) if (Object.hasOwn(step, key)) assert.equal(profile[key], step[key], key);
      if (Object.hasOwn(step, 'land')) assert.equal(profile.min_land_area_m2, step.land);
      if (Object.hasOwn(step, 'queried')) assert.equal(queries.length > 0, step.queried, 'Search must respect pending preferences');
      if (step.noQuestion) assert.doesNotMatch(reply, step.noQuestion, 'Do not repeat an answered question');
      if (step.trim) session.history = session.history.slice(-2);
    }
    if (scenario.kind === 'uncertain') {
      assert.equal(queries.length, 0); assert.equal(captures.length, 0);
    } else {
      assert.ok(queries.length, 'A completed dialogue must reach property search');
      const criteria = queries.at(-1), capture = captures.at(-1);
      assert.equal(criteria.min_price, 100e6); assert.equal(criteria.max_price, 200e6);
      if (['transaction', 'correction'].includes(scenario.kind)) assert.deepEqual([...transactionValues(criteria)].sort(), [...(scenario.expected || all)].sort());
      assert.deepEqual(capture.criteria, criteria, 'CRM and search must use the same preferences');
      assert.equal(capture.name, store.get(phone).client_identity.name);
      assert.equal(capture.phone, phone);
    }
    return { name: scenario.name, kind: scenario.kind, passed: true, turns: transcript.length, transcript };
  } catch (error) { return { name: scenario.name, kind: scenario.kind, passed: false, error: error.message, turns: transcript.length, transcript }; }
}
