import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.js';
import { propertyInquiryEntry } from '../services/property_inquiry.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';

const NOW = Date.parse('2026-11-04T10:00:00+07:00');
const PHONE = '6281234567890', OTHER = '6281234567891', LID = 'lid:987654321';
const LINK = 'https://solusindoaset.com/Lelang/apartemen-bali-kuta-resort-majapahit-18-badung-32336-31551';
const OPENING = `Halo Jason Christopher Liendo �

Saya tertarik dengan properti lelang berikut, apakah masih tersedia?

� *APARTEMENT dengan total luas 42.4 m2 di Kab. Badung*
� Indonesia, Kab. Badung
� *Rp 401.000.000*
� Kode: 31551

� Detail lengkap:
${LINK}

Mohon infonya, terima kasih! �`;
const ASSET = { id: '31551', name: 'Apartemen Bali Kuta Resort', transaction_type: 'LELANG', category: 'APARTEMEN',
  limit_price: 401000000, price_display: 'Rp 401.000.000', location: 'Kab. Badung',
  address: { city: 'Kab. Badung', province: 'Bali' }, specifications: { building_area_m2: 42.4 },
  auction_at: '2026-11-10T10:00:00+07:00', publication: { status: 'TERSEDIA' }, detail_url: LINK };

function configuration(transport = 'baileys') {
  return loadConfig({ WA_TRANSPORT: transport, ADMIN_API_TOKEN: 'a'.repeat(32), LLM_MODEL: 'test', OPENAI_API_KEY: 'fake',
    REPLY_DELAY_MS: '0', ...(transport === 'cloud' ? {
      WA_API_VERSION: 'v99.0', WA_PHONE_NUMBER_ID: '12345', WA_ACCESS_TOKEN: 'fake', WA_APP_SECRET: 'fake', WA_VERIFY_TOKEN: 'fake',
    } : {}) });
}

function fixture(t, overrides = {}) {
  let now = NOW, sequence = 0;
  const config = { ...configuration(), ...overrides };
  const database = new ConversationControl(':memory:', () => now), control = database.forTenant('AG108');
  t.after(() => database.close());
  const sent = [], reads = [], errors = [];
  const catalog = { async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria });
    const id = /\bKode\s+(\d+)/i.exec(text)?.[1] || previousId;
    const asset = id === ASSET.id ? structuredClone(ASSET) : null;
    return { asset, catalog: [], status: asset ? 'matched' : 'not_found', source: 'database_listing_publik' };
  } };
  const ai = { generate() { assert.fail('The property opening and cost flow use the existing local replies'); },
    classifyPropertyScope() { assert.fail('Ignored openings never reach the AI'); } };
  const whatsapp = { async sendText(to, text, replyTo) { sent.push({ to, text, replyTo }); return `out-${sent.length}`; } };
  const f = { config, sent, reads, errors, control, whatsapp,
    message(text, from = PHONE) { return { id: `in-${++sequence}`, from, type: 'text', text, timestamp: now }; },
    async send(text, from) { const accepted = f.processor.acceptBatch([f.message(text, from)]); await f.processor.drain(); return accepted; },
    advance(ms) { now += ms; },
    restart() {
      f.store = new MemoryStore(config, () => now, control);
      f.processor = new MessageProcessor({ config, store: f.store, catalog, ai, whatsapp, now: () => now,
        logger: { error: error => errors.push(error) } });
    },
  };
  f.restart();
  return f;
}

test('the supplied Badung opening works with broken emoji and selects the last ID in the link', () => {
  assert.deepEqual(propertyInquiryEntry(OPENING), { asset_id: '31551', url: LINK });
  assert.deepEqual(propertyInquiryEntry(OPENING.replaceAll('�', '👋').replace('Jason Christopher Liendo', 'Rina')),
    { asset_id: '31551', url: LINK });
  assert.deepEqual(propertyInquiryEntry(OPENING.replaceAll('\n', '\r\n')), { asset_id: '31551', url: LINK });
});

test('real website link variants support www, agent links and other property types', () => {
  const url = LINK.replace('solusindoaset.com', 'www.solusindoaset.com') + '/AG108';
  assert.deepEqual(propertyInquiryEntry(OPENING.replace(LINK, url + '?source=whatsapp#detail')), { asset_id: '31551', url });
  const sale = 'https://solusindoaset.com/Jual/rumah-12345';
  assert.deepEqual(propertyInquiryEntry(OPENING.replace('properti lelang berikut', 'properti berikut').replace(LINK, sale)),
    { asset_id: '12345', url: sale });
});

const ignoredOpenings = ['Halo', 'Halo Jason, saya Budi', 'Kode 31551', LINK,
  'Saya mencari apartemen di Badung', 'Berapa biaya lelang?', 'hubungkan CS', '#bot on',
  OPENING.replace(`\n${LINK}`, ''), OPENING.replace(/^Halo/, 'Pesan titipan: Halo'),
  OPENING.replace('Saya tertarik dengan properti lelang berikut, apakah masih tersedia?', 'Tolong lihat link ini')];

test('greetings, codes, bare links and templates without a link cannot start the bot', () => {
  for (const text of [...ignoredOpenings, null, {}, 'x'.repeat(4097)]) assert.equal(propertyInquiryEntry(text), null, String(text));
});

test('only the exact public Solusindo domain and a listing path can open the bot', () => {
  for (const link of ['https://example.com/Lelang/apartemen-31551',
    'https://solusindoaset.com.evil.example/Lelang/apartemen-31551',
    'https://evil.example/solusindoaset.com/Lelang/apartemen-31551',
    'https://solusindoaset.com@evil.example/Lelang/apartemen-31551',
    'https://evil.example@solusindoaset.com/Lelang/apartemen-31551',
    'http://solusindoaset.com/Lelang/apartemen-31551', 'https://solusindoaset.com:8443/Lelang/apartemen-31551',
    'https://solusindoaset.com/dashboard', 'https://solusindoaset.com/',
    'https://solusindoaset.com/Lelang/apartemen', 'https://solusindoaset.com/Lelang/apartemen-0']) {
    assert.equal(propertyInquiryEntry(OPENING.replace(LINK, link)), null, link);
  }
});

test('multiple property links need one unambiguous ID', () => {
  assert.equal(propertyInquiryEntry(`${OPENING}\nhttps://solusindoaset.com/Lelang/rumah-999999`), null);
  assert.deepEqual(propertyInquiryEntry(`${OPENING}\n${LINK}`), { asset_id: '31551', url: LINK });
});

test('live configuration requires the inquiry opening for Baileys and Cloud API', () => {
  for (const transport of ['baileys', 'cloud']) {
    assert.equal(configuration(transport).requirePropertyInquiry, true);
    assert.equal(configuration(transport).handoffNonBuyerMessages, true);
    assert.equal(configuration(transport).propertyInquiryIdleMs, 7 * 86400000);
  }
});

test('ignored first messages use no sessions, queue, catalog or AI and send no replies', async t => {
  const f = fixture(t);
  assert.equal(f.processor.acceptBatch(ignoredOpenings.map(text => f.message(text))), 0);
  await f.processor.drain();
  assert.equal(f.store.sessions.size, 0); assert.equal(f.store.seen.size, 0); assert.equal(f.processor.pending, 0);
  assert.deepEqual(f.reads, []); assert.deepEqual(f.sent, []); assert.deepEqual(f.errors, []);
});

test('opening -> property explanation -> cost follow-up keeps the existing flow and database facts', async t => {
  const f = fixture(t);
  assert.equal(await f.send(OPENING.replace('Rp 401.000.000', 'Rp 1.000')), 1);
  assert.equal(f.store.get(PHONE).asset_id, '31551'); assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].text, /10 November 2026/);
  assert.equal(await f.send('Boleh hitungkan semua biaya sampai balik nama?'), 1);
  assert.match(f.sent.at(-1).text, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.match(f.sent.at(-1).text, /401\.000\.000/); assert.match(f.sent.at(-1).text, /31551/);
  assert.equal(f.store.get(PHONE).client_identity.name, null, 'the addressed agent is not the buyer');
  assert.equal(await f.send('hubungkan CS'), 1);
  assert.equal(f.store.get(PHONE).is_bot_active, false);
  assert.deepEqual(f.errors, []);
});

test('the property ID in the trusted link controls lookup even if copied code or query differs', async t => {
  const f = fixture(t);
  await f.send(OPENING.replace('Kode: 31551', 'Kode: 999999').replace(LINK, LINK + '?next=/Lelang/properti-888888'));
  assert.equal(f.store.get(PHONE).asset_id, '31551');
  assert.ok(f.reads.length > 0); assert.ok(f.reads.every(read => read.text === 'Kode 31551'));
  assert.deepEqual(f.errors, []);
});

test('batch admission preserves order and never opens another contact', async t => {
  const f = fixture(t);
  const opening = f.message(OPENING);
  assert.equal(f.processor.acceptBatch([f.message('Halo'), opening,
    f.message('Boleh hitungkan semua biaya sampai balik nama?'), f.message('Halo', OTHER)]), 2);
  await f.processor.drain();
  assert.equal(f.store.get(OTHER), undefined);
  assert.deepEqual(f.store.get(PHONE).history.filter(row => row.role === 'user').map(row => row.content),
    [OPENING, 'Boleh hitungkan semua biaya sampai balik nama?']);
  assert.match(f.sent.at(-1).text, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(f.processor.acceptBatch([opening]), 0);
  await f.processor.drain();
  assert.deepEqual(f.errors, []);
});

test('capacity failures do not admit a contact before its opening can be queued', async t => {
  const f = fixture(t, { maxPending: 0 });
  assert.throws(() => f.processor.acceptBatch([f.message(OPENING)]), { code: 'QUEUE_FULL' });
  assert.equal(f.store.sessions.size, 0);
  assert.equal(await f.send('Boleh hitungkan semua biaya sampai balik nama?'), 0);
  assert.deepEqual(f.sent, []);
});

test('admission and the selected asset survive restart within the active conversation', async t => {
  const f = fixture(t);
  await f.send(OPENING); f.restart();
  assert.equal(await f.send('Boleh hitungkan semua biaya sampai balik nama?'), 1);
  assert.equal(f.store.get(PHONE).asset_id, '31551');
  assert.match(f.sent.at(-1).text, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(await f.send('Berapa biaya lelang?', OTHER), 0);
  assert.deepEqual(f.errors, []);
});

test('authenticated LID aliases retain admission and the selected asset after restart', async t => {
  const f = fixture(t);
  await f.send(OPENING, LID); f.restart();
  f.whatsapp.getContactAliases = contact => [PHONE, LID].includes(contact) ? [PHONE, LID] : [contact];
  f.whatsapp.getContactPhone = contact => contact === LID ? PHONE : contact;
  assert.equal(await f.send('Boleh hitungkan semua biaya sampai balik nama?'), 1);
  assert.equal(f.store.get(PHONE).asset_id, '31551');
  assert.match(f.sent.at(-1).text, /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.deepEqual(f.errors, []);
});

test('after idle expiry a new opening is required, including after restart', async t => {
  for (const restart of [false, true]) {
    const f = fixture(t);
    await f.send(OPENING); const sent = f.sent.length;
    f.advance(f.config.propertyInquiryIdleMs + 1);
    if (restart) f.restart();
    assert.equal(await f.send('Halo'), 0);
    assert.equal(await f.send('Boleh hitungkan semua biaya sampai balik nama?'), 0);
    assert.equal(f.sent.length, sent);
    assert.equal(await f.send(OPENING), 1); assert.equal(f.sent.length, sent + 1);
    assert.deepEqual(f.errors, []);
  }
});

test('a valid opening cannot override a human pause', async t => {
  const f = fixture(t);
  f.processor.takeOver(PHONE);
  assert.equal(await f.send(OPENING), 1);
  assert.equal(f.store.get(PHONE).is_bot_active, false); assert.deepEqual(f.sent, []);
  f.processor.setBotActive(PHONE, true); await f.processor.drain();
  assert.equal(f.sent.length, 1); assert.equal(f.store.get(PHONE).asset_id, '31551');
  assert.deepEqual(f.errors, []);
});

test('pending replies from before the entry policy cannot reply on activation', async t => {
  const f = fixture(t);
  const session = f.store.create(PHONE);
  f.processor.takeOver(PHONE);
  session.last_user_at = NOW;
  session.pending_reply = { message: f.message('Kode 31551'), recorded: false, expires_at: NOW + 60000 };
  f.processor.setBotActive(PHONE, true); await f.processor.drain();
  assert.deepEqual(f.sent, []); assert.deepEqual(f.reads, []);
});
