import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationFixture, PHONE } from '../scripts/lib/consultation-fixture.js';
import { createAiController } from '../services/ai_controller.js';
import { AUCTION_BUDGET_QUESTION, AUCTION_BUDGET_RANGE_QUESTION, AUCTION_BUDGET_RANGE_CLARIFICATION,
  AUCTION_BUDGET_FIT_CLARIFICATION, createBudgetInterpreter } from '../services/budget_response.js';
import { shouldSendMouDocument } from '../services/mou_document.js';

const positive = ['oke cocok', 'Oke cocok pak', 'ok cocok lanjut aja', 'cocoklah', 'iya masih masuk',
  'pas banget', 'budgetnya aman', 'nggih sampun pas', 'isih mlebu budget', 'iyo cocok', 'tidak mahal kok',
  'ora larang', 'yes it fits my budget', 'this is within my budget', 'sounds good', 'that works for me',
  'okay', '👍', '✅', 'siap lanjut'];
const negative = ['tidak cocok', 'terlalu tinggi', 'Terlalu tinggi pak', 'gak masuk budget', 'gk cocok',
  'blm sesuai', 'ketinggian harganya', 'budgetnya ga nyampe', 'saya keberatan segitu', 'mahal sih',
  'ora cukup', 'kemahalen pak', 'abot', 'too expensive', 'too high', 'over budget', 'too pricey',
  'above my budget', "I can't afford it", 'not suitable', 'nope'];

function withDocuments(f) {
  const documents = [], generated = [];
  f.processor.documents = { async generate(id) { generated.push(id); return {
    assetId: id, filename: `Draf_MOU_Aset_${id}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nTest reading draft'),
  }; } };
  f.processor.whatsapp.sendDocument = async (_phone, file, caption) => { documents.push({ file, caption }); return `pdf-${documents.length}`; };
  return { documents, generated };
}

for (const text of positive) test(`clear acceptance sends the selected MOU once: ${text}`, async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  const { documents } = withDocuments(f);
  await f.send('rincian biaya');
  const reply = await f.send(text);
  assert.match(reply, /draf MOU aset kode/); assert.equal(documents.length, 1);
  assert.equal(documents[0].file.assetId, f.asset.id);
  const state = f.processor.store.get(PHONE);
  assert.equal(state.conversion.draft_document.status, 'sent');
  assert.equal(state.conversion.purchase_intake.payment_verified, false);
  assert.equal(state.qualification.funds, undefined);
  await f.send('baik'); assert.equal(documents.length, 1);
  assert.deepEqual(f.errors, []);
});

for (const text of negative) test(`price objection asks the range and sends no MOU: ${text}`, async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close());
  const { documents } = withDocuments(f);
  await f.send('rincian biaya');
  assert.equal(await f.send(text), AUCTION_BUDGET_RANGE_QUESTION);
  assert.equal(documents.length, 0);
  assert.equal(f.processor.store.get(PHONE).conversion.mode, 'Search_State');
  assert.deepEqual(f.errors, []);
});

for (const [text, min, max] of [['400–500 juta', 400000000, 500000000], ['400 sampai 500 jt', 400000000, 500000000],
  ['budget saya 500 juta', null, 500000000], ['500', null, 500000000], ['Rp 500.000.000', null, 500000000],
  ['I have 400 to 500 million', 400000000, 500000000], ['empat ratus sampai lima ratus juta', 400000000, 500000000]]) {
  test(`budget range is remembered as total spending: ${text}`, async t => {
    const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
    await f.send('rincian biaya'); await f.send('terlalu tinggi');
    const reply = await f.send(text), state = f.processor.store.get(PHONE);
    assert.match(reply, /Dari properti yang Anda kirim/);
    assert.equal(state.consultation.min_total_budget, min); assert.equal(state.consultation.total_budget, max);
    assert.equal(state.conversion.mode, 'Search_State'); assert.equal(documents.length, 0);
    await f.send('boleh');
    assert.equal(f.processor.store.get(PHONE).buyer_state.profile.max_total_budget, max);
    assert.deepEqual(f.errors, []);
  });
}

for (const text of ['mungkin cocok', 'cocok tapi masih pikir dulu', 'kalau harganya turun saya cocok',
  'oke cocok tapi jangan kirim MOU', 'not sure', 'maybe', 'cocok?', 'saya belum yakin']) {
  test(`uncertainty never sends a draft: ${text}`, async t => {
    const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
    await f.send('rincian biaya'); const reply = await f.send(text);
    assert.match(reply, /dipertimbangkan|tidak salah menangkap/);
    assert.equal(documents.length, 0); assert.equal(f.processor.store.get(PHONE).conversion.mode, 'Search_State');
    assert.deepEqual(f.errors, []);
  });
}

test('yes after a range question requests a number instead of opening MOU', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
  await f.send('rincian biaya'); await f.send('kemahalan');
  assert.equal(await f.send('oke'), AUCTION_BUDGET_RANGE_CLARIFICATION);
  assert.match(await f.send('500 juta'), /500\.000\.000/);
  assert.equal(documents.length, 0); assert.deepEqual(f.errors, []);
});

const semanticCases = [
  ['Ça me convient parfaitement', 'within'], ['Ces frais dépassent mes moyens', 'outside'],
  ['Sí, encaja con mi presupuesto', 'within'], ['Está fuera de mi presupuesto', 'outside'],
  ['المبلغ مناسب لميزانيتي', 'within'], ['هذا المبلغ مرتفع جدا', 'outside'],
  ['这个预算合适', 'within'], ['这个价格太高了', 'outside'],
];
for (const [text, intent] of semanticCases) test(`semantic adapter routes a supported interpretation: ${text}`, async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
  let requests = 0;
  const ai = createAiController({ provider: 'gemini', model: 'fixture', apiKey: 'fake', timeoutMs: 1000 }, {
    fetchImpl: async (_url, options) => {
      requests++; const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseJsonSchema.properties.intent.type, 'string');
      assert.equal(body.contents.length, 2);
      assert.ok(body.contents[0].parts[0].text.endsWith(AUCTION_BUDGET_QUESTION));
      assert.equal(body.contents[1].parts[0].text, text);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ intent, evidence: text, confidence: 0.99 }) }] } }] });
    },
  });
  f.processor.ai.interpretBudget = ai.interpretBudget;
  await f.send('rincian biaya'); const reply = await f.send(text);
  assert.equal(requests, 1);
  if (intent === 'within') { assert.match(reply, /draf MOU/); assert.equal(documents.length, 1); }
  else { assert.equal(reply, AUCTION_BUDGET_RANGE_QUESTION); assert.equal(documents.length, 0); }
  assert.deepEqual(f.errors, []);
});

for (const kind of ['provider_failure', 'low_confidence', 'invented_evidence', 'malformed_json']) {
  test(`untrusted or unavailable interpretation clarifies without a draft: ${kind}`, async t => {
    const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
    const text = 'Cela demande réflexion';
    f.processor.ai.interpretBudget = createBudgetInterpreter({ provider: 'gemini', model: 'fixture', apiKey: 'fake', timeoutMs: 1000 }, {
      fetchImpl: async () => {
        if (kind === 'provider_failure') throw new Error('offline test failure');
        const result = kind === 'malformed_json' ? 'broken' : JSON.stringify({ intent: 'within',
          evidence: kind === 'invented_evidence' ? 'I agree' : text, confidence: kind === 'low_confidence' ? 0.5 : 0.99 });
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: result }] } }] });
      },
    });
    await f.send('rincian biaya'); assert.equal(await f.send(text), AUCTION_BUDGET_FIT_CLARIFICATION);
    assert.equal(documents.length, 0); assert.deepEqual(f.errors, []);
  });
}

test('document failure and an unknown send receipt preserve the existing no-duplicate policy', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close()); const { generated, documents } = withDocuments(f);
  f.processor.whatsapp.sendDocument = async () => { throw new Error('Uncertain send'); };
  await f.send('rincian biaya'); assert.match(await f.send('oke cocok'), /belum berhasil saya kirim/);
  assert.equal(f.processor.store.get(PHONE).conversion.draft_document.status, 'uncertain');
  await f.send('baik'); assert.equal(generated.length, 1); assert.equal(documents.length, 0);
});

test('sold stock prevents the MOU even when budget fits', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
  f.asset.auction_at = '2026-10-10T03:00:00Z';
  f.processor.checks = { stockResult: asset => ({asset_id:asset.id,auction_at:asset.auction_at,result:'sold',confirmed_at:Date.parse('2026-10-21T08:59:00+07:00')}) };
  await f.send('rincian biaya'); assert.match(await f.send('oke cocok'), /terjual/);
  assert.equal(documents.length, 0); assert.deepEqual(f.errors, []);
});

test('budget acceptance cannot bypass a human pause', async t => {
  const f = consultationFixture('LELANG'); t.after(() => f.close()); const { documents } = withDocuments(f);
  await f.send('rincian biaya'); f.processor.takeOver(PHONE);
  assert.equal(await f.send('oke cocok'), ''); assert.equal(documents.length, 0);
});

test('PDF eligibility uses the interpreted acceptance only for this turn', () => {
  const asset = {id:'123'}, conversion={mode:'Closing_State',asset_id:'123',topic:'purchase_preparation'};
  assert.equal(shouldSendMouDocument({asset,conversion,text:'nggak mahal',selectedAssetId:'123',budgetFitAccepted:true}),true);
  assert.equal(shouldSendMouDocument({asset,conversion,text:'jangan kirim',selectedAssetId:'123'}),false);
});
