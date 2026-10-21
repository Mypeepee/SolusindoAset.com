import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseRuntime } from '../scripts/lib/purchase-intake-dialogues.js';
import { NOW, PACARKEMBANG_ASSETS } from '../scripts/lib/purchase-interest-dialogues.js';
import { ConversationControl } from '../state/conversation_control.js';
import { planPurchaseIntake } from '../services/purchase_intake.js';
import { closingCopy, parseClosingOutput } from '../services/closing_controller.js';
import { propertyDetailsReply } from '../services/property_details.js';

const chosen = PACARKEMBANG_ASSETS[3];
const textOf = replies => replies.filter(r => r.type === 'text').map(r => r.text).join('\n');
const readyPhrases = ['KTP dan cover buku tabungan sudah siap', 'dokumennya sudah siap pak', 'berkasnya lengkap',
  'KTP dan cover sudah ada, saya mau lanjut'];

test('informed interest immediately sends one property PDF, a nominal tanda jadi and practical document guidance', async t => {
  for (const options of [{}, { future: true }, { verdict: 'available' }]) {
    const f = purchaseRuntime(options); t.after(() => f.close()); await f.prepare();
    const replies = await f.send('oke saya tertarik');
    const body = textOf(replies), pdf = replies.filter(r => r.type === 'pdf');
    assert.equal(pdf.length, 1); assert.equal(pdf[0].filename, 'Draf_MOU_Aset_121037.pdf');
    assert.match(pdf[0].caption, /Pasal 3.*Pasal 4.*Pasal 11/);
    assert.match(body, /KTP.*cover buku tabungan.*atas nama Anda/);
    assert.match(body, /uang tanda jadi Rp 20\.000\.000/); assert.equal((body.match(/\?/g) || []).length, 1);
    assert.match(body, /Dari draf MOU ini, ada yang ingin ditanyakan\?$/);
    assert.doesNotMatch(body, /KTP dan cover buku tabungannya sudah siap/);
    assert.equal(f.session().conversion.pending_action, 'ask_question');
    assert.doesNotMatch(body, /10\s*%|maksimal Rp 20|mau saya jelaskan|bagian yang mana|sudah diterima/i);
    assert.match(body, options.future || options.verdict ? /setelah ketentuan MOU disetujui/ : /menunggu kepastian aset/);
    assert.equal(f.session().conversion.purchase_intake.payment_verified, false);
    assert.deepEqual(f.errors, []);
  }
});

test('varied readiness statements hand over a hot buyer without claiming documents or money are verified', async t => {
  for (const phrase of readyPhrases) {
    const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
    const replies = await f.send(phrase), s = f.session();
    assert.equal(s.conversion.phase, 'purchasing_handoff', phrase); assert.equal(s.is_bot_active, false, phrase);
    assert.equal(s.lead_status, 'hot'); assert.equal(s.conversion.asset_id, '121037');
    assert.equal(s.conversion.purchase_intake.documents_reported_ready, true);
    assert.equal(s.conversion.purchase_intake.documents_verified, false);
    assert.equal(s.conversion.purchase_intake.payment_verified, false);
    assert.match(textOf(replies), /tim Solusindo Premier/);
    assert.match(textOf(replies), /pembayaran tanda jadi menunggu konfirmasi/i);
    assert.equal(f.sent.filter(r => r.type === 'pdf').length, 1);
    assert.equal(f.catalog.calls.filter(r => r.criteria).length, 1);
    assert.deepEqual(f.errors, []);
  }
});

test('short replies to the MOU question do not report document readiness or trigger handoff', async t => {
  for (const phrase of ['ada pak', 'boleh pak', 'baik', 'sudah pak', 'udah siap', 'dua-duanya ada pak', 'belum pak']) {
    const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare();
    await f.send('saya serius');
    const reply = textOf(await f.send(phrase));
    assert.match(reply, /Bagian mana yang ingin ditanyakan\?/, phrase);
    assert.equal(f.session().is_bot_active, true, phrase);
    assert.notEqual(f.session().conversion.purchase_intake.documents_reported_ready, true, phrase);
    assert.equal(f.session().conversion.asset_id, '121037');
    assert.equal(f.sent.filter(r => r.type === 'pdf').length, 1);
    assert.deepEqual(f.errors, []);
  }
});

test('having no questions about the MOU does not report document readiness or confirm an agreement', async t => {
  for (const options of [{}, { future: true }]) {
    const f = purchaseRuntime(options); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
    const reply = textOf(await f.send('tidak ada pak'));
    assert.equal(f.session().is_bot_active, true);
    assert.notEqual(f.session().conversion.purchase_intake.documents_reported_ready, true);
    assert.equal(f.session().conversion.process_understood, false);
    assert.doesNotMatch(reply, /Boleh disiapkan dulu|sudah siap, atau masih perlu disiapkan/);
    assert.equal(f.session().conversion.asset_id, '121037');
    assert.deepEqual(f.errors, []);
  }
});

test('missing or partially prepared documents do not become ready and a buyer can request assistance', async t => {
  for (const phrase of ['KTP belum siap', 'cover buku tabungan belum ada', 'KTP sudah siap tapi cover buku tabungan belum']) {
    const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya tertarik');
    const replies = await f.send(phrase);
    assert.match(textOf(replies), /Boleh disiapkan dulu/);
    assert.equal(f.session().is_bot_active, true);
    assert.equal(f.session().conversion.purchase_intake.documents_reported_ready, false);
    await f.send('boleh'); assert.equal(f.session().is_bot_active, false);
  }
});

test('a detail or cost follow-up answers the request and retains preparation without inheriting an old CTA', async t => {
  const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
  assert.match(textOf(await f.send('minta detail asetnya lagi')), /DETAIL ASET — Kode 121037/);
  assert.match(textOf(await f.send('boleh breakdown biaya lagi')), /ESTIMASI BIAYA PEMBELIAN LELANG/);
  assert.equal(f.session().is_bot_active, true); assert.ok(f.session().conversion.purchase_intake);
  assert.equal(f.sent.filter(r => r.type === 'pdf').length, 1);
  await f.send('KTP dan cover buku tabungan sudah siap');
  assert.equal(f.session().conversion.phase, 'purchasing_handoff'); assert.deepEqual(f.errors, []);
});

test('questions about losing retain refund facts and the next explicit readiness returns to purchase preparation', async t => {
  const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
  const refund = textOf(await f.send('kalau kalah uang tanda jadi balik tidak?'));
  assert.match(refund, /100%/); assert.match(refund, /20\.000\.000/); assert.match(refund, /5 hari/);
  assert.equal(f.session().is_bot_active, true);
  const continueReply = textOf(await f.send('boleh'));
  assert.match(continueReply, /Mau saya teruskan ke tim/);
  assert.equal(f.session().conversion.pending_action, 'purchase_handoff');
  await f.send('KTP dan cover buku tabungan sudah siap');
  assert.equal(f.session().conversion.phase, 'purchasing_handoff');
});

test('a payment claim requires human reconciliation and does not mark payment verified', async t => {
  const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
  const reply = textOf(await f.send('saya sudah bayar tanda jadi'));
  assert.match(reply, /Informasi pembayaran Anda akan diperiksa/);
  assert.equal(f.session().conversion.purchase_intake.payment_reported, true);
  assert.equal(f.session().conversion.purchase_intake.payment_verified, false);
  assert.equal(f.session().is_bot_active, false);
});

test('document submissions pause for review and never enter the model or conversation history as document contents', async t => {
  for (const message of [{ text: '', type: 'document' }, { text: '', type: 'image' },
    { text: 'NIK 0000000000000000 SIMULATION ONLY', type: 'text' }]) {
    let modelCalls = 0;
    const f = purchaseRuntime({ ai: { generate() { modelCalls++; throw new Error('unexpected model call'); } } });
    t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
    const baseline = modelCalls, replies = await f.send(message.text, message.type);
    assert.equal(modelCalls, baseline); assert.equal(f.session().is_bot_active, false);
    assert.match(textOf(replies), /perlu diperiksa tim/);
    assert.equal(f.session().conversion.purchase_intake.attachment_pending_review, true);
    assert.equal(f.session().conversion.purchase_intake.documents_verified, false);
    assert.ok(!JSON.stringify(f.session().history).includes('0000000000000000'));
  }
});

test('sold and changed-property searches never request purchase documents or inherit the old intake', async t => {
  const f = purchaseRuntime({ verdict: 'sold' }); t.after(() => f.close()); await f.prepare();
  const replies = await f.send('saya serius');
  assert.equal(f.session().conversion.topic, 'stock_sold');
  assert.equal(replies.some(r => r.type === 'pdf'), false); assert.doesNotMatch(textOf(replies), /KTP|uang tanda jadi Rp/);
  const g = purchaseRuntime(); t.after(() => g.close()); await g.prepare(); await g.send('saya tertarik');
  await g.send('cari rumah lain di Tambaksari');
  assert.equal(g.session().conversion.mode, 'Search_State'); assert.equal(g.session().conversion.purchase_intake, undefined);
});

test('documents arriving after readiness handoff are recorded for review while the bot stays silent', async t => {
  const f = purchaseRuntime(); t.after(() => f.close()); await f.prepare(); await f.send('saya serius');
  await f.send('KTP dan cover buku tabungan sudah siap');
  assert.equal(f.session().is_bot_active, false);
  const replies = await f.send('', 'document'); assert.deepEqual(replies, []);
  assert.equal(f.session().conversion.purchase_intake.attachment_pending_review, true);
  assert.equal(f.session().conversion.purchase_intake.documents_verified, false);
  assert.equal(f.session().is_bot_active, false); assert.deepEqual(f.errors, []);
});

test('persistent intake survives restart without repeating PDF, and ready buyer still reaches human review', async t => {
  const db = new ConversationControl(':memory:'); t.after(() => db.close()); const control = db.forTenant('AG108');
  const first = purchaseRuntime({ control }); t.after(() => first.close());
  await first.prepare(); await first.send('saya serius');
  const restarted = purchaseRuntime({ control }); t.after(() => restarted.close());
  const replies = await restarted.send('KTP dan cover buku tabungan sudah siap');
  assert.equal(restarted.session().conversion.phase, 'purchasing_handoff');
  assert.equal(replies.some(r => r.type === 'pdf'), false);
  assert.equal(restarted.session().conversion.draft_document.status, 'sent');
});

test('LLM rewrites retain the preparation facts and payment gate; invented payment requests fall back', async t => {
  const plan = planPurchaseIntake({ asset: chosen, text: 'saya serius', now: NOW,
    history: [{ role: 'assistant', content: propertyDetailsReply(chosen, { now: NOW }) }] });
  const copy = closingCopy(plan, NOW);
  assert.doesNotThrow(() => parseClosingOutput(JSON.stringify({ body: copy.body, cta_id: 0 }), plan, copy));
  for (const body of [copy.body.replace('Pembayaran tanda jadi menunggu kepastian aset dari tim dan persetujuan ketentuan MOU.', ''),
    copy.body.replace('20.000.000', '35.000.000'), copy.body.replace('cover buku tabungan', 'NPWP'),
    `${copy.body} Segera transfer DP ke rekening saya.`, `${copy.body} Uang Anda sudah diterima.`]) {
    assert.throws(() => parseClosingOutput(JSON.stringify({ body, cta_id: 0 }), plan, copy), body);
  }
  const f = purchaseRuntime({ ai: { generateClosing: async () => ({ body: 'Segera transfer Rp 99.000.000.', cta_id: 0 }) } });
  t.after(() => f.close()); await f.prepare(); const replies = await f.send('saya serius');
  assert.match(textOf(replies), /uang tanda jadi Rp 20\.000\.000/); assert.doesNotMatch(textOf(replies), /99\.000\.000/);
});
