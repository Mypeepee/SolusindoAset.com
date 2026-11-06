import test from 'node:test';
import assert from 'node:assert/strict';
import { nonBuyerHandoffReason, NON_BUYER_HANDOVER_MESSAGE } from '../services/conversation_purpose.js';
import { requestsPropertySearch, resolveInteractionDecision } from '../services/interaction_policy.js';
import { validatePropertyScope } from '../services/property_scope.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { ConversationControl } from '../state/conversation_control.js';
import { LEGAL_CONVERSATION, PROPERTY_OPENING, PURPOSE_PHONE, purposeFixture } from '../scripts/lib/conversation-purpose-dialogues.js';

for (const entry of ['new contact', 'admitted buyer', 'legacy search']) test(`the exact law-firm conversation hands over once without qualifying a buyer: ${entry}`, async () => {
  const f = purposeFixture({ config: entry === 'legacy search' ? { requirePropertyInquiry: false } : {} });
  if (entry === 'admitted buyer') await f.send(PROPERTY_OPENING);
  if (entry === 'legacy search') await f.send('Cari rumah lelang di Surabaya');
  const baseline = { sent: f.sent.length, reads: f.reads.length, ai: f.generated.length, clients: f.captures.length };
  for (const text of LEGAL_CONVERSATION) await f.send(text);
  assert.deepEqual(f.sent.slice(baseline.sent).map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.reads.length, baseline.reads); assert.equal(f.generated.length, baseline.ai); assert.equal(f.captures.length, baseline.clients);
  assert.equal(f.session().is_bot_active, false); assert.match(f.session().handover.reason, /non_buyer/);
  assert.equal(f.session().pending_reply, null); assert.deepEqual(f.errors, []);
});

const humanSamples = [
  LEGAL_CONVERSATION[0], LEGAL_CONVERSATION[1], LEGAL_CONVERSATION[2],
  'Saya kuasa hukum pemilik lama aset lelang ini', 'Kami hendak menebus kembali rumah klien kami',
  'Saya debitur dari rumah yang Bapak beli', 'Saya pemilik lama rumah lelang di Kutisari',
  'Kami ingin menyampaikan somasi atas aset tersebut', 'Saya sudah membeli rumah ini, mau mengurus serah terima',
  'Saya bukan cari properti, saya mau bahas pekerjaan', 'Bisa bicara langsung dengan Pak Jason?',
  'Maaf salah nomor', 'Our client wants to buy back the auction property',
  'Kami kuasa hukum mencari data atas aset lelang yang dibeli Bapak',
  'Saya ingin menjual rumah saya di Surabaya', 'Pak mau titip jual ruko di Surabaya',
];
for (const text of humanSamples) test(`non-buyer purpose is recognized before property nouns: ${text.slice(0, 65)}`, async () => {
  assert.ok(nonBuyerHandoffReason(text)); assert.equal(requestsPropertySearch(text), false);
  const f = purposeFixture(); await f.send(text);
  assert.deepEqual(f.sent.map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.reads.length, 0); assert.equal(f.generated.length, 0); assert.equal(f.captures.length, 0);
});

for (const text of [
  'Saya advokat, carikan rumah lelang di Surabaya', 'Kami law firm mau beli kantor untuk operasional',
  'Saya kuasa hukum, mencari ruko baru untuk kantor', 'Saya mewakili klien kami mencari rumah di Surabaya',
  'Saya sudah beli rumah, sekarang cari ruko baru di Surabaya', 'Cari rumah di Surabaya dengan legalitas SHM',
  'Saya cari apartemen budget 500 juta', 'Tolong carikan rumah untuk orang tua saya',
  'Saya lawyer looking for an apartment', 'Cari rumah di Surabaya yang bebas sengketa',
  'Saya ingin beli rumah untuk dijual lagi',
  'Saya ingin beli rumah lelang untuk dijual kembali',
]) test(`a real buyer is served regardless of profession or a past purchase: ${text}`, async () => {
  assert.equal(nonBuyerHandoffReason(text), null);
  const f = purposeFixture(); await f.send(PROPERTY_OPENING);
  const before = f.sent.length; await f.send(text);
  assert.ok(f.sent.length > before); assert.equal(f.session().is_bot_active, true);
  assert.ok(!f.sent.some(item => item.text === NON_BUYER_HANDOVER_MESSAGE)); assert.deepEqual(f.errors, []);
});

test('unrelated work receives one notice in live policy and cannot enter the property funnel', async () => {
  const f = purposeFixture(); await f.send('Pak tolong kirim invoice pekerjaan kemarin');
  await f.send('Surabaya'); await f.send('500 juta');
  assert.deepEqual(f.sent.map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.reads.length, 0); assert.equal(f.generated.length, 0);
});

test('hypothetical purchase questions are not mistaken for completed transactions', () => {
  for (const text of ['Kalau saya sudah menang lelang, bagaimana proses selanjutnya?', 'Jika sudah beli rumah, biaya balik nama bagaimana?',
    'Kalau sudah lunas nanti dokumennya apa saja?', 'If I already bought the property, what happens next?']) assert.equal(nonBuyerHandoffReason(text), null, text);
});

test('a non-buyer exception never grants website admission to later search messages', async () => {
  const f = purposeFixture(); await f.send(LEGAL_CONVERSATION[0]);
  assert.equal(f.session().property_inquiry_entry, null);
  f.processor.setBotActive(PURPOSE_PHONE, true);
  await f.send('Cari rumah lelang di Surabaya');
  assert.equal(f.reads.length, 0); assert.equal(f.sent.length, 1);
  await f.send(PROPERTY_OPENING); assert.equal(f.reads.length, 1);
});

test('a human pause survives restart, idle expiry and authenticated contact aliases', async t => {
  const database = new ConversationControl(':memory:'); t.after(() => database.close());
  const lid = 'lid:987654321';
  const f = purposeFixture({ control: database.forTenant('AG108'), whatsapp: {
    getContactAliases: () => [PURPOSE_PHONE, lid], getContactPhone: () => PURPOSE_PHONE,
  } });
  await f.send(LEGAL_CONVERSATION[0], lid); f.restart(); f.advance(86400000);
  await f.send(PROPERTY_OPENING); await f.send('425 juta');
  assert.deepEqual(f.sent.map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.session().is_bot_active, false); assert.equal(f.reads.length, 0);
});

test('a legal message cancels a property answer that is already in flight', async () => {
  let enter, release; const started = new Promise(resolve => { enter = resolve; });
  const f = purposeFixture({ ai: { async generate() { enter(); return new Promise(resolve => { release = resolve; }); } } });
  await f.send(PROPERTY_OPENING);
  f.processor.acceptBatch([f.message('Berapa harga rumahnya?')]); await started;
  f.processor.acceptBatch([f.message(LEGAL_CONVERSATION[0])]);
  assert.equal(f.session().is_bot_active, false);
  release({ reply: 'Stale property reply must be discarded.', qualification: {} }); await f.processor.drain();
  assert.equal(f.sent.at(-1).text, NON_BUYER_HANDOVER_MESSAGE);
  assert.ok(!f.sent.some(item => item.text.includes('Stale property')));
});

test('semantic purpose checks run before catalog and introductory sales wording', async () => {
  const text = 'Mewakili keluarga kami, ingin berkomunikasi terkait rumah di Kutisari.';
  let classified = 0;
  const f = purposeFixture({ ai: { async classifyPropertyScope() { classified++; return 'human'; } } });
  await f.send(PROPERTY_OPENING); const before = f.reads.length;
  await f.send(text);
  assert.equal(classified, 1); assert.equal(f.reads.length, before);
  assert.equal(f.sent.at(-1).text, NON_BUYER_HANDOVER_MESSAGE);
  assert.equal(f.session().is_bot_active, false);
  assert.equal(validatePropertyScope({ scope: 'human', evidence: 'Mewakili keluarga kami' }, text), 'human');
});

test('ambiguous representation is handed over when the classifier is unavailable', async () => {
  const input = { text: 'Mewakili keluarga kami, komunikasi terkait rumah di Kutisari.', history: [], state: {} };
  for (const ai of [{}, { async classifyPropertyScope() { throw new Error('provider unavailable'); } }, { async classifyPropertyScope() { return null; } }]) {
    assert.equal(await resolveInteractionDecision(input, ai), 'human');
  }
});

test('the Playground and stateless history honor the same non-buyer handoff', async () => {
  const noCatalog = { resolve() { assert.fail('Legal correspondence must not read inventory'); } };
  const first = await generatePropertyReply({ catalog: noCatalog, ai: {}, text: LEGAL_CONVERSATION[0], history: [] });
  assert.equal(first.action, 'handoff'); assert.equal(first.reply, NON_BUYER_HANDOVER_MESSAGE);
  const next = await generatePropertyReply({ catalog: noCatalog, ai: {}, text: '425 juta', history: [
    { role: 'user', content: LEGAL_CONVERSATION[0] }, { role: 'assistant', content: first.reply },
  ] });
  assert.equal(next.suppressed, true);
});
