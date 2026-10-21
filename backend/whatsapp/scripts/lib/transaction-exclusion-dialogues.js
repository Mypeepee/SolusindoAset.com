import assert from 'node:assert/strict';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { transactionValues, TRANSACTION_TYPES } from '../../services/property_transaction.js';
import { advancedFixture, row } from './advanced-search-dialogues.js';

export const rentalExclusionAnswers = [
  'oh kecuali sewa pak...', 'kecuali sewa', 'KECUALI SEWA SIH BU', 'sewanya dikecualikan pak',
  'sewa dikecualikan', 'saya kecualikan sewa', 'sewa saya kecualikan ya', 'selain sewa',
  'selain sewa aja sih', 'tanpa sewa', 'asal bukan sewa', 'semua kecuali sewa',
  'bebas kecuali sewa', 'bebas asal tanpa sewa', 'sewa dicoret dulu', 'sewanya dihapus aja',
  'sewa dikeluarkan pak', 'keluarkan sewa', 'exclude sewa', 'sewa exclude aja',
  'hapus sewa', 'coret sewa', 'sewa jangan dimasukkan', 'jangan masukkan sewa',
  'tolong kecualikan sewa', 'sewa dikecualikan ya?', 'boleh kecualikan sewa?',
];
export const purchaseTransactions = TRANSACTION_TYPES.filter((type) => type !== 'SEWA');
export function transactionExclusionScenarios() {
  return rentalExclusionAnswers.flatMap((answer) => ['period_pending', 'period_known', 'already_qualified'].map((mode) => ({
    name: `${mode} / ${answer}`, answer, mode,
  })));
}
export function exclusionInventory() {
  return advancedFixture({ inventory: TRANSACTION_TYPES.map((type, index) => row(986001 + index, {
    jenis_transaksi: type, kecamatan: 'Benowo', kelurahan: 'Kandangan', harga: 150e6, harga_efektif: 150e6,
    nilai_limit_lelang: 150e6, tanggal_lelang: new Date('2099-01-01'),
    ...(type === 'SEWA' ? { sewaDetail: { durasi_sewa: 'TAHUNAN', harga_sewa_tahunan: 150e6 } } : {}),
  })) });
}

export async function simulateTransactionExclusion(scenario) {
  const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
    maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const f = exclusionInventory(), store = new MemoryStore(config), phone = '6280000000083';
  const replies = [], captures = [], errors = [], transcript = [];
  let sequence = 0, aiCalls = 0;
  const processor = new MessageProcessor({ config, store, catalog: f.catalog,
    ai: { generate() { aiCalls++; throw Error('Unexpected AI'); }, interpretBuyer() { aiCalls++; throw Error('Unexpected interpretation'); } },
    clients: { setName() {}, enqueue(value) { captures.push(structuredClone(value)); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { replies.push(text); return `mock-${sequence}`; } },
    logger: { error(value) { errors.push(value.event || value.code); } },
  });
  const send = async (text) => {
    const before = replies.length;
    processor.acceptBatch([{ id: `exclusion-${++sequence}`, type: 'text', from: phone, text, timestamp: Date.now() }]);
    await processor.drain();
    const session = store.get(phone), reply = replies.slice(before).join('\n');
    transcript.push({ user: text, reply, profile: structuredClone(session.buyer_state?.profile), queries: f.criteria.length });
    assert.ok(reply, 'Every turn needs a response'); assert.equal(session.is_bot_active, true);
    assert.deepEqual(errors, []); assert.equal(aiCalls, 0, 'A clear exception must not need an AI interpretation');
    return session;
  };
  const check = (session, max = 300e6) => {
    const profile = session.buyer_state.profile;
    assert.deepEqual(transactionValues(profile), purchaseTransactions, 'Only rental is removed');
    assert.equal(profile.max_price, max, 'Keep the existing purchase budget');
    assert.equal(profile.min_price, scenario.mode === 'period_pending' ? null : 100e6);
    assert.equal(profile.city, 'Surabaya'); assert.equal(profile.district.toLowerCase(), 'benowo');
    assert.equal(profile.rental_period, undefined, 'Rental period no longer applies');
    assert.equal(session.client_identity.name, 'kartini');
    assert.ok(session.buyer_state.excludedTransactions.includes('SEWA'));
    assert.doesNotMatch(replies.at(-1), /Budget sewanya|Budget sewa itu|Untuk pilihan sewa|Budget-nya sampai berapa|Mau beli atau sewa/);
  };
  try {
    await send('selamat siang');
    await send('saya dengan kartini, ingin cari aset di benowo situ');
    const range = scenario.mode === 'period_pending' ? 'di angka dibawah 300 juta' : '100–300 juta';
    await send(`bebas sih pak, budget saya ${range} pak${scenario.mode === 'already_qualified' ? ', rumah, luas tanah minimal 72m2' : ''}`);
    if (scenario.mode !== 'period_pending') await send('per tahun');
    const previousQueries = f.criteria.length;
    store.get(phone).history = store.get(phone).history.slice(-2);
    check(await send(scenario.answer));
    if (scenario.mode === 'already_qualified') {
      assert.equal(f.criteria.length, previousQueries + 1, 'Refine the existing query immediately');
      assert.equal(store.get(phone).buyer_state.profile.min_land_area_m2, 72);
    } else {
      assert.equal(f.criteria.length, previousQueries, 'Do not invent type or land preferences');
      check(await send('rumah, luas tanah bebas'));
    }
    check(await send('budget maksimal 280 juta'), 280e6);
    check(await send('transaksi bebas'), 280e6);
    const criteria = f.criteria.at(-1);
    assert.deepEqual(transactionValues(criteria), purchaseTransactions);
    assert.equal(criteria.max_price, 280e6);
    assert.deepEqual(captures.at(-1).criteria, criteria, 'CRM must retain the same corrected preferences as search');
    assert.ok(!replies.at(-1).includes('986004'), 'Excluded rental never appears in recommendations');
    for (const id of ['986001', '986002', '986003']) assert.ok(replies.at(-1).includes(id), `Keep matching purchase option ${id}`);
    return { name: scenario.name, passed: true, turns: transcript.length, transcript };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, turns: transcript.length, transcript }; }
}
