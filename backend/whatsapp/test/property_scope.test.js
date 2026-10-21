import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../services/ai_controller.js';
import { resolveInteractionDecision, requestsPropertySearch, detectHandover } from '../services/interaction_policy.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { buyerContext } from '../services/buyer_profile.js';
import { isPurchaseDocumentSubmission } from '../services/purchase_intake.js';
import { validatePropertyScope } from '../services/property_scope.js';
import { scopeFixture, simulatePropertyScope } from '../scripts/lib/property-scope-dialogues.js';
import { simulateAddressedIntroductions } from '../scripts/lib/addressed-introduction-dialogues.js';

test('varied property requests and other work are distinguished throughout real conversations', async () => {
  const results = await simulatePropertyScope();
  assert.deepEqual(results.filter((item) => !item.passed).map(({ name, error }) => ({ name, error })), []);
});

test('named recipients and client introductions keep their separate roles throughout real conversations', async () => {
  const results = await simulateAddressedIntroductions();
  assert.deepEqual(results.filter((item) => !item.passed).map(({ text, error }) => ({ text, error })), []);
});

test('the semantic classifier validates evidence, extra fields and unknown values', () => {
  const text = 'Golek omah kanggo keluarga pak';
  assert.equal(validatePropertyScope({ scope: 'property_search', evidence: 'Golek omah' }, text), 'property_search');
  for (const value of [null, [], {}, { scope: 'other', evidence: 'invented' }, { scope: 'property', evidence: '' },
    { scope: 'property', evidence: 'Golek omah', reply: 'untrusted' }, { scope: 'yes', evidence: text }]) assert.equal(validatePropertyScope(value, text), null);
});

for (const provider of ['openai', 'gemini']) test(`${provider} uses structured semantic classification for unfamiliar language`, async () => {
  const text = 'Golek omah kanggo keluarga pak';
  let requests = 0;
  const ai = createAiController({ provider, model: 'test', apiKey: 'test', timeoutMs: 1000 }, {
    async fetchImpl(_url, init) {
      requests++;
      const body = JSON.parse(init.body);
      assert.match(JSON.stringify(body), /property_scope|property_search/);
      const value = JSON.stringify({ scope: 'property_search', evidence: 'Golek omah' });
      return Response.json(provider === 'openai' ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }] }
        : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: value }] } }] });
    },
  });
  const result = await generatePropertyReply({ text, history: [], ai, catalog: { resolve() { assert.fail('Qualify before searching inventory'); } } });
  assert.equal(result.suppressed, undefined);
  assert.equal(result.knowledge.status, 'qualifying');
  assert.match(result.reply, /beli atau sewa/);
  assert.equal(requests, 1);
});

test('semantic other-work classification suppresses the reply and is excluded from later property context', async () => {
  const text = 'Bisa bantu perpanjang lisensi tahunan tim?';
  const f = scopeFixture({ async classifyPropertyScope({ text: current }) { return current === text ? 'other' : null; } });
  await f.send('Kode 121791');
  assert.deepEqual(await f.send(text), []);
  await f.send('brp harganya?');
  assert.equal(f.session().asset_id, '121791');
  assert.ok(f.calls.at(-1).history.every((item) => item.content !== text));
});

test('classifier failure, malformed results and cancellation cannot invent intent or send unrelated replies', async () => {
  for (const classifyPropertyScope of [async () => { throw new Error('quota'); }, async () => null, async () => 'invalid']) {
    assert.equal(await resolveInteractionDecision({ text: 'bantu urusan anu dong', history: [], state: {} }, { classifyPropertyScope }), 'silent');
  }
  const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await assert.rejects(resolveInteractionDecision({ text: 'anu dong', history: [], state: {} }, { async classifyPropertyScope() { throw controller.signal.reason; } }, controller.signal), /cancelled/);
});

test('unfamiliar requests after the name question are not mistaken for client names', async () => {
  const f = scopeFixture({ async classifyPropertyScope({ text }) { return text.includes('omah') ? 'property_search' : 'other'; } });
  await f.send('selamat siang');
  assert.deepEqual(await f.send('saya jualan sembako'), []);
  assert.equal(f.session().client_identity.name, null);
  assert.ok((await f.send('golek omah kanggo keluarga')).length);
  assert.equal(f.session().client_identity.name, null);
  assert.equal(f.session().buyer_state.searchStarted, true);
});

test('an ignored work message does not consume the invitation to introduce oneself', async () => {
  const f = scopeFixture();
  await f.send('selamat siang');
  await f.send('Tolong kirim invoice pekerjaan kemarin');
  assert.deepEqual(await f.send('Verlyna'), ['Salam kenal, Verlyna. Ada yang bisa saya bantu?']);
  assert.equal(f.session().client_identity.name, 'Verlyna');
});

test('WhatsApp replies to a combined greeting and name, then applies the property-only scope', async () => {
  for (const text of ['selamat siang, saya vera', 'selamat siang saya vera', 'halo kak, nama saya vera']) {
    const f = scopeFixture();
    assert.deepEqual(await f.send(text), ['Salam kenal, Vera. Ada yang bisa saya bantu?'], text);
    assert.equal(f.session().client_identity.name, 'vera', text);
    assert.equal(f.reads.length, 0, text);
    assert.equal(f.calls.length, 0, text);
    assert.deepEqual(await f.send('Tolong kirim invoice pekerjaan kemarin'), [], text);
    assert.ok((await f.send('pak tolong carikan rumah di Surabaya')).length, text);
    assert.match(f.sent.at(-1), /Vera/, text);
  }
});

test('non-property goods cannot trigger a property search or a handoff through generic sales language', () => {
  for (const text of ['sewa mobil di Surabaya', 'cari kerja di rumah', 'bisa nego harga motor?', 'jadwal survei kepuasan kerja', 'tolong cek sertifikat pelatihan kerja']) {
    assert.equal(requestsPropertySearch(text), false, text);
    assert.equal(detectHandover(text), null, text);
  }
});

test('unrelated amounts and locations in mixed messages never become property filters', () => {
  for (const separator of ['. ', ', ', '; ', '\n', '. Btw ']) {
    const buyer = buyerContext([], `Cari rumah lelang di Benowo Surabaya budget 500 juta${separator}Tolong cek invoice proyek di Jakarta 2 miliar`, null);
    assert.equal(buyer.profile.city, 'Surabaya');
    assert.equal(buyer.profile.max_price, 500000000);
    assert.equal(buyer.profile.category, 'RUMAH');
  }
});

test('an unrelated invoice number during purchase preparation cannot be treated as buyer documents', () => {
  assert.equal(isPurchaseDocumentSubmission({ type: 'text', text: 'Invoice pekerjaan 1234567890123456 sudah dibayar', conversion: { purchase_intake: {} } }), false);
  assert.equal(isPurchaseDocumentSubmission({ type: 'text', text: 'NIK 1234567890123456', conversion: { purchase_intake: {} } }), true);
});

test('property questions without a selected asset still receive a reply; mixed other-work cannot trigger handoff', async () => {
  const f = scopeFixture();
  assert.ok((await f.send('Berapa biaya lelang properti?')).length);
  assert.equal(detectHandover('Carikan rumah di Surabaya, bisa nego harga mobilnya?'), null);
});
