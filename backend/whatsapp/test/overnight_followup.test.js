import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { AUCTION_COST_QUESTION } from '../services/auction_check.js';
import { NON_BUYER_HANDOVER_MESSAGE } from '../services/conversation_purpose.js';

const PHONE = '6281234567890', LID = 'lid:987654321';
const START = Date.parse('2026-11-05T23:57:36+07:00');
const OPENING = `Halo Jason Christopher Liendo 👋

Saya tertarik dengan properti lelang berikut, apakah masih tersedia?

🔨 1 bidang tanah dengan total luas 463 m² berikut bangunan di Kota Padang
📍 LUBUK KILANGAN, Kota Padang
💰 Rp 550.000.000
🔖 Kode: 191211

🔗 Detail lengkap:
https://solusindoaset.com/Lelang/1-bidang-tanah-dengan-total-luas-463-m-berikut-bangunan-di-kota-padang-1793673336016-2zwt-191211`;

function fixture(t, { aliases = false } = {}) {
  let now = START, sequence = 0, limitPrice = 550000000;
  const config = loadConfig({ ADMIN_API_TOKEN: 'a'.repeat(32), OPENAI_API_KEY: 'fake', LLM_MODEL: 'test', REPLY_DELAY_MS: '0' });
  const database = new ConversationControl(':memory:', () => now), control = database.forTenant('AG108');
  t.after(() => database.close());
  const sent = [], errors = [], reads = [], model = [];
  const whatsapp = { async sendText(_to, text) { sent.push(text); return `out-${sent.length}`; },
    ...(aliases ? { getContactAliases: () => [PHONE, LID], getContactPhone: () => PHONE } : {}) };
  const f = { sent, reads, model, errors, config, control,
    advance(ms) { now += ms; },
    setLimit(value) { limitPrice = value; },
    async send(text, from = PHONE) {
      const before = sent.length;
      const accepted = f.processor.acceptBatch([{ id: `overnight-${++sequence}`, from, type: 'text', text, timestamp: now }]);
      await f.processor.drain(); return { accepted, replies: sent.slice(before) };
    },
    session(from = PHONE) { return f.store.get(from); },
    restart() {
      f.store = new MemoryStore(config, () => now, control);
      f.processor = new MessageProcessor({ config, store: f.store, whatsapp, now: () => now,
        ai: { async generate(input) { model.push(input); return { reply: 'Alamat sesuai listing Padang Besi, Kota Padang.', qualification: {} }; } },
        catalog: { async resolve(text, previousId, criteria) {
          reads.push({ text, previousId, criteria });
          const id = /Kode\s+(\d+)/i.exec(text)?.[1] || previousId;
          return { asset: id === '191211' ? { id, name: 'Gudang pengujian kelanjutan chat', transaction_type: 'LELANG', category: 'GUDANG',
            limit_price: limitPrice, deposit: 110000000, publication: { status: 'TERSEDIA' },
            // Synthetic future schedule; no claim about the actual asset date.
            auction_at: '2026-11-20T03:00:00Z', address: { city: 'Kota Padang', district: 'Lubuk Kilangan', village: 'Padang Besi' },
            specifications: { land_area_m2: 463 }, detail_url: 'https://solusindoaset.com/Lelang/fixture-191211' } : null,
            catalog: [], status: id === '191211' ? 'matched' : 'not_found', source: 'synthetic_fixture' };
        } }, logger: { error: error => errors.push(error) } });
    },
  };
  f.restart(); return f;
}

for (const delay of [7 * 3600000 + 14 * 60000 + 9000, 48 * 3600000, 6 * 86400000]) {
  for (const restart of [false, true]) test(`Ya continues the delivered cost question after ${delay} ms; restart=${restart}`, async t => {
    const f = fixture(t); await f.send(OPENING);
    assert.ok(f.sent.at(-1).endsWith(AUCTION_COST_QUESTION));
    f.advance(delay); if (restart) f.restart();
    const result = await f.send('Ya');
    assert.equal(result.accepted, 1); assert.equal(result.replies.length, 1);
    assert.match(result.replies[0], /ESTIMASI BIAYA PEMBELIAN LELANG/);
    assert.match(result.replies[0], /550\.000\.000/); assert.doesNotMatch(result.replies[0], /siapkan draf MOU|mau beli atau sewa/i);
    assert.equal(f.session().asset_id, '191211'); assert.equal(f.model.length, 0); assert.deepEqual(f.errors, []);
  });
}

test('authenticated LID/phone changes retain the last delivered question overnight', async t => {
  const f = fixture(t, { aliases: true }); await f.send(OPENING, LID);
  f.advance(8 * 3600000); f.restart();
  const result = await f.send('Ya', PHONE);
  assert.match(result.replies[0], /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(f.session().asset_id, '191211'); assert.deepEqual(f.errors, []);
});

test('an overnight reply reads the current listing price rather than the copied opening price', async t => {
  const f = fixture(t); await f.send(OPENING);
  f.advance(8 * 3600000); f.setLimit(600000000); f.restart();
  const { replies } = await f.send('Ya');
  assert.match(replies[0], /600\.000\.000/); assert.doesNotMatch(replies[0], /550\.000\.000/);
  assert.deepEqual(f.errors, []);
});

test('budget collection keeps its question and numeric range across an overnight restart', async t => {
  const f = fixture(t); await f.send(OPENING); await f.send('Ya'); await f.send('terlalu tinggi');
  f.advance(8 * 3600000); f.restart();
  const { replies } = await f.send('400–500 juta');
  assert.match(replies[0], /Dari properti yang Anda kirim/);
  assert.match(replies[0], /Rp 400\.000\.000–Rp 500\.000\.000/);
  assert.equal(f.session().consultation.total_budget, 500000000); assert.deepEqual(f.errors, []);
});

test('unknown contacts cannot start the bot with Ya or an unverified old code', async t => {
  const f = fixture(t);
  for (const text of ['Ya', 'Kode 191211', 'Saya cari gudang di Padang']) assert.equal((await f.send(text)).accepted, 0);
  assert.deepEqual(f.sent, []); assert.deepEqual(f.reads, []);
});

test('the property-specific inactivity window expires and can be renewed only by a website opening', async t => {
  const f = fixture(t); await f.send(OPENING);
  f.advance(f.config.propertyInquiryIdleMs + 1); f.restart();
  assert.equal((await f.send('Ya')).accepted, 0);
  assert.equal((await f.send(OPENING)).accepted, 1); assert.deepEqual(f.errors, []);
});

test('a later delivered answer clears an older confirmation across restart', async t => {
  const f = fixture(t); await f.send(OPENING); await f.send('Alamat gudang di mana?');
  assert.equal(f.control.getSearch(PHONE).property_followup.kind, null);
  f.advance(8 * 3600000); f.restart();
  const result = await f.send('Ya');
  assert.ok(result.replies.every(reply => !/ESTIMASI BIAYA PEMBELIAN LELANG|siapkan draf MOU/i.test(reply)));
  assert.equal(f.session().conversion.mode, 'Search_State'); assert.deepEqual(f.errors, []);
});

test('a later answer through a phone alias supersedes the older LID question', async t => {
  const f = fixture(t, { aliases: true }); await f.send(OPENING, LID);
  f.advance(8 * 3600000); await f.send('Alamat gudang di mana?', PHONE);
  f.advance(3600000); f.restart();
  const { replies } = await f.send('Ya', PHONE);
  assert.ok(replies.every(reply => !/ESTIMASI BIAYA PEMBELIAN LELANG|siapkan draf MOU/i.test(reply)));
  assert.equal(f.session().conversion.mode, 'Search_State'); assert.deepEqual(f.errors, []);
});

test('handover and manual pauses stay silent despite the longer buyer window', async t => {
  for (const legal of [false, true]) {
    const f = fixture(t); await f.send(OPENING);
    if (legal) await f.send('Saya kuasa hukum, klien kami mau membeli kembali aset ini');
    else f.processor.takeOver(PHONE);
    const before = f.sent.length, reads = f.reads.length;
    f.advance(8 * 3600000); f.restart(); await f.send('Ya');
    assert.equal(f.sent.length, before); assert.equal(f.reads.length, reads); assert.equal(f.session().is_bot_active, false);
    if (legal) assert.equal(f.sent.at(-1), NON_BUYER_HANDOVER_MESSAGE);
  }
});
