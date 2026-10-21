import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import PizZip from 'pizzip';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { fillMouDraft, renderMouDraft, mouDraftFields, terbilangDraft } from '../../../src/lib/server/chatbotMouDraft.mjs';
import { MOU_DRAFT_WATERMARK } from '../../../src/lib/server/mouPaymentTerms.mjs';
import { mouCostFields } from '../../../src/lib/server/mouCostFields.mjs';
import { mapPublicProperty } from '../../../src/lib/chatbot/property-knowledge.ts';
import { MouDocumentClient, shouldSendMouDocument, MOU_CAPTION } from '../services/mou_document.js';
import { createWhatsAppClient } from '../services/whatsapp.js';
import { BaileysClient } from '../services/baileys.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { config, noAi } from '../scripts/lib/single-recommendation-dialogues.js';
import { NOW, SERIOUS_REPORTED, interestFixture, PACARKEMBANG_ASSETS } from '../scripts/lib/purchase-interest-dialogues.js';

const ASSET = PACARKEMBANG_ASSETS[3], PHONE = '6280000000001';
const pdf = await PDFDocument.create(); pdf.addPage(); const BUFFER = Buffer.from(await pdf.save());
const file = (id = ASSET.id) => ({ assetId: id, filename: `Draf_MOU_Aset_${id}.pdf`, mimeType: 'application/pdf', buffer: BUFFER });
const textOf = (docx) => {
  const zip = new PizZip(docx);
  return Object.keys(zip.files).filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
    .map((name) => zip.file(name).asText().replace(/<[^>]*>/g, '')).join('\n');
};

test('actual DOCX fills the chosen property, preserves unknowns and does not guess client identity or KPKNL Surabaya', async () => {
  const { docx, fields } = await fillMouDraft(ASSET), text = textOf(docx);
  assert.match(text, /DRAF-ASET-121037/); assert.match(text, /Pacarkembang/);
  assert.match(text, /350\.000\.000/); assert.match(text, /100\.000\.000/);
  assert.match(text, /LAINNYA/); assert.match(text, /200 m²/); assert.doesNotMatch(text, /200 m² m²/);
  assert.match(text, /BELUM DITENTUKAN KLIEN/); assert.match(text, /NIK BELUM DILENGKAPI/);
  assert.match(text, /5% dari Harga Menang Lelang/); assert.match(text, /KANTOR DAN ALAMAT KPKNL DIKONFIRMASI TIM/);
  assert.doesNotMatch(text, /KPKNL SURABAYA|KPKNL Surabaya|Jl\. Indrapura|\{\{|undefined/);
  assert.match(text, /Biaya Pengurusan Balik Nama Sertifikat8,5% dari Harga Menang Lelang \+ Rp 10\.000\.000 \(sepuluh juta rupiah\)/);
  assert.match(text, /PASAL 13/); assert.doesNotMatch(text, /39\.750\.000/);
  assert.doesNotMatch(text, /Biaya Pengurusan DokumenRp 7\.000\.000|BELUM DISEPAKATI/);
  assert.equal(fields.biaya_baliknama, '39.750.000');
  assert.equal(fields.estimasi_fee_agent, '17.500.000');
  const confirmed = await fillMouDraft(ASSET, { maxBid: 410000000 });
  assert.match(textOf(confirmed.docx), /410\.000\.000/); assert.match(textOf(confirmed.docx), /empat ratus sepuluh juta rupiah/);
  assert.equal(terbilangDraft(350000000), 'tiga ratus lima puluh juta rupiah');
  assert.throws(() => mouDraftFields({ ...ASSET, transaction_type: 'SEWA' }), /UNAVAILABLE/);
  assert.throws(() => mouDraftFields({ ...ASSET, publication: { status: 'TERJUAL' } }), /UNAVAILABLE/);
  assert.throws(() => mouDraftFields(ASSET, { maxBid: -1 }), /INVALID_MAX_BID/);
  assert.equal(mouDraftFields({ ...ASSET, specifications: { land_area_m2: 200.5 } }).luas_tanah, '200,5');
});

test('preferred Pasal 3 table keeps payments, fixes commission at 5%, uses a transfer formula and includes execution', async () => {
  const semarang = { ...ASSET, id: '121790', category: 'GUDANG',
    full_address: 'Jl. Kedungmundu Raya No. 173, Sendangguwo, Tembalang, Kota Semarang, Jawa Tengah',
    address: { province: 'Jawa Tengah' }, limit_price: 3043000000, deposit: 610000000,
    specifications: { land_area_m2: 306 }, auction_at: '2026-06-18T00:00:00+07:00' };
  const { fields, docx } = await fillMouDraft(semarang, { maxBid: 4000000000 });
  const expected = { estimasi_bea_lelang: '60.860.000', estimasi_bphtb: '152.150.000',
    estimasi_ppn_lelang: '33.473.000', estimasi_roya_balik_nama: '12.172.000',
    biaya_baliknama: '268.655.000', biaya_pengurusan_dokumen: '10.000.000',
    estimasi_eksekusi_pengosongan: '350.000.000', estimasi_transportasi: '6.800.000',
    estimasi_konsumsi: '3.000.000', estimasi_advokat_eksekusi: '25.000.000', biaya_pengosongan: '384.800.000',
    estimasi_fee_agent: '152.150.000', estimasi_modal_eksekusi: '3.848.605.000' };
  for (const [key, value] of Object.entries(expected)) assert.equal(fields[key], value, key);
  assert.equal(fields.uang_jaminan, '610.000.000');
  assert.equal(fields.uang_tanda_jadi, '20.000.000');
  const text = textOf(docx), costs = text.slice(text.indexOf('PASAL 3'), text.indexOf('PASAL 4'));
  for (const value of ['3.043.000.000', '4.000.000.000', '20.000.000', '610.000.000', '384.800.000']) assert.ok(costs.includes(`Rp ${value}`), value);
  assert.match(costs, /Komisi PIHAK KEDUA5% dari Harga Menang Lelang/);
  assert.match(costs, /Biaya Pengurusan Balik Nama Sertifikat8,5% dari Harga Menang Lelang \+ Rp 10\.000\.000/);
  assert.match(costs, /Biaya Eksekusi Pengosongan \(Worst Case\)Rp 384\.800\.000/);
  assert.match(costs, /Nominal akhir biaya pengurusan balik nama dihitung setelah Harga Menang Lelang ditetapkan/);
  assert.match(costs, /tempat perpindahan barang masih tentatif/);
  assert.doesNotMatch(costs, /268\.655\.000|152\.150\.000|3\.848\.605\.000/);
  assert.doesNotMatch(costs, /BPHTB|Bea Lelang|PPN|Roya|konsumsi|truk|advokat|Subtotal|ESTIMASI MODAL|maksimal Rp 20/i);
  const xml = new PizZip(docx).file('word/document.xml').asText();
  const table = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].find((match) => match[0].includes('KOMPONEN BIAYA'))[0];
  assert.equal((table.match(/<w:tr[\s>]/g) || []).length, 8, 'header and seven main rows, including execution');
  assert.doesNotMatch(costs, /mediasi|kerohiman|3\.563\.805\.000|4\.120\.655\.000|3\.868\.605\.000|\{\{|undefined/i);
  assert.equal('estimasi_modal_mediasi' in fields, false);
});

test('draft guarantee follows the website listing field, including fresh values unrelated to the tanda jadi', async () => {
  for (const guarantee of ['610000000', '720000000']) {
    const asset = mapPublicProperty({ id_property: 121790n, jenis_transaksi: 'LELANG', kategori: 'GUDANG',
      alamat_lengkap: 'Jl. Kedungmundu Raya No. 173', provinsi: 'Jawa Tengah', kota: 'Kota Semarang',
      nilai_limit_lelang: '3043000000', uang_jaminan: guarantee, status_tayang: 'TERSEDIA', luas_tanah: 306 }, NOW);
    const { docx, fields } = await fillMouDraft(asset);
    assert.equal(fields.uang_jaminan, Number(guarantee).toLocaleString('id-ID'));
    assert.equal(fields.uang_tanda_jadi, '20.000.000');
    const text = textOf(docx), payment = text.slice(text.indexOf('PASAL 4'), text.indexOf('PASAL 5'));
    assert.ok(payment.includes(`Uang Jaminan Lelang sebesar Rp ${fields.uang_jaminan}`));
    assert.doesNotMatch(payment, /DIKONFIRMASI TIM|10%|maksimal Rp 20/);
    const section3 = text.slice(text.indexOf('PASAL 3'), text.indexOf('PASAL 4'));
    assert.equal((section3.match(/BELUM DITENTUKAN KLIEN/g) || []).length, 1);
  }
});

test('MOU execution estimates follow website region, area and price bands, with unknown data left explicit', () => {
  const input = { limit: 3043000000, province: 'Jawa Tengah', landArea: 306 };
  assert.equal(mouCostFields({ ...input, province: 'Jawa Timur' }).biaya_pengosongan, '359.800.000');
  const larger = mouCostFields({ ...input, landArea: 720, buildingArea: 400 });
  assert.equal(larger.estimasi_transportasi, '20.400.000');
  assert.equal(larger.biaya_pengosongan, '398.400.000');
  assert.match(larger.label_transportasi, /×3/); assert.match(larger.keterangan_tempat_perpindahan, /200 m²/);
  const lower = mouCostFields({ ...input, limit: 500000000 });
  assert.equal(lower.estimasi_eksekusi_pengosongan, '175.000.000');
  assert.equal(lower.biaya_baliknama, '52.500.000');
  const unknown = mouCostFields({ ...input, province: null });
  assert.equal(unknown.biaya_pengosongan, '[DIKONFIRMASI TIM]');
  assert.equal(unknown.estimasi_modal_eksekusi, '[DIKONFIRMASI TIM]');
  assert.equal(unknown.biaya_baliknama, '268.655.000');
  assert.equal(mouCostFields({ ...input, limit: 0 }).estimasi_modal_eksekusi, '[DIKONFIRMASI TIM]');
});

test('PDF renderer prepends a reading cover and marks every page as a draft without creating a transaction', async () => {
  let input;
  const result = await renderMouDraft(ASSET, { convertDocx: async (docx) => { input = docx; return BUFFER; } });
  assert.match(textOf(input), /Pacarkembang/);
  assert.equal(result.filename, 'Draf_MOU_Aset_121037.pdf');
  assert.equal(result.buffer.subarray(0, 5).toString(), '%PDF-');
  const rendered = await PDFDocument.load(result.buffer);
  assert.equal(rendered.getPageCount(), 2); assert.equal(rendered.getTitle(), 'Draf MOU Aset 121037');
  const watermarkHex = Buffer.from(MOU_DRAFT_WATERMARK).toString('hex').toUpperCase();
  for (const [index, page] of rendered.getPages().entries()) {
    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    const text = refs.map((ref) => Buffer.from(decodePDFRawStream(rendered.context.lookup(ref, PDFRawStream)).decode()).toString()).join('\n');
    assert.ok(text.includes(`<${watermarkHex}> Tj`), 'Every page contains the requested Draft - untuk dipelajari watermark');
    if (index === 0) {
      assert.ok(text.includes(Buffer.from('8,5%').toString('hex').toUpperCase()));
      assert.ok(text.includes(Buffer.from('10.000.000').toString('hex').toUpperCase()));
      assert.ok(!text.includes(Buffer.from('39.750.000').toString('hex').toUpperCase()), 'Cover cannot quote a limit-based transfer amount as a contract fee');
    }
  }
});

test('payment clauses distinguish tanda jadi from auction guarantee, apply the cap, and refund the exact tanda jadi within five days', async () => {
  for (const [limit, guarantee, tanda] of [[100000000, 10000000, '10.000.000'], [100000000, 30000000, '10.000.000'],
    [150000000, 5000000, '15.000.000'], [200000000, 50000000, '20.000.000'], [350000000, 100000000, '20.000.000']]) {
    const { docx, fields } = await fillMouDraft({ ...ASSET, limit_price: limit, deposit: guarantee });
    assert.equal(fields.uang_tanda_jadi, tanda); assert.equal(fields.komisi_persen, '5');
    assert.equal(fields.biaya_pengurusan_dokumen, '10.000.000');
    assert.equal(fields.uang_jaminan, guarantee.toLocaleString('id-ID'));
    const text = textOf(docx), section = (number, next) => text.slice(text.indexOf(`PASAL ${number}`), text.indexOf(`PASAL ${next}`));
    const payment = section(4, 5), cancellation = section(9, 10), refund = section(11, 12);
    assert.doesNotMatch(payment, /10\s*%|sepuluh persen|nilai maksimal|maksimal Rp 20\.000\.000|yaitu sebesar/i);
    assert.ok(payment.includes(`Uang Tanda Jadi`) && payment.includes(`Rp ${tanda}`));
    assert.match(payment, /Virtual Account resmi kepesertaan lelang atas nama PIHAK PERTAMA/);
    assert.match(payment, /Uang Jaminan Lelang tidak disetorkan ke rekening PIHAK KEDUA/);
    assert.match(cancellation, /90 \(sembilan puluh\) hari sejak tanggal penandatanganan Perjanjian/);
    assert.match(cancellation, /a\.\s+Apabila PIHAK PERTAMA tidak melakukan setoran jaminan pada waktu yang telah ditentukan, maka seluruh dana yang telah disetor dinyatakan HANGUS dan tidak dapat dikembalikan/);
    assert.match(cancellation, /b\.\s+Apabila PIHAK PERTAMA dinyatakan menang lelang namun tidak melakukan pelunasan paling lambat H\+5 \(lima hari kerja\) dari tanggal lelang, maka seluruh dana yang telah disetor dinyatakan HANGUS/);
    assert.doesNotMatch(cancellation, /Uang Tanda Jadi/);
    assert.ok(refund.includes(`100% (seratus persen) Uang Tanda Jadi`) && refund.includes(`Rp ${tanda}`));
    assert.match(refund, /tanpa potongan.*rekening atas nama PIHAK PERTAMA paling lambat 5 \(lima\) hari sejak hasil lelang/);
    assert.doesNotMatch(refund, /5 \(lima\) hari kerja/);
    assert.match(refund, /Uang Jaminan Lelang.*dikembalikan oleh penyelenggara/);
  }
});

test('document service is asset-bound, streams a bounded PDF and rejects an upstream HTML or wrong-property file', async () => {
  const calls = [], options = { url: 'https://property.invalid/mou-draft', token: 'fake', timeoutMs: 1000 };
  const client = new MouDocumentClient(options, { fetchImpl: async (url, init) => {
    calls.push({ url, init }); return new Response(BUFFER, { headers: { 'Content-Type': 'application/pdf', 'X-MOU-Asset-ID': ASSET.id } });
  } });
  assert.equal((await client.generate(ASSET.id, 410000000)).assetId, ASSET.id);
  assert.deepEqual(JSON.parse(calls[0].init.body), { assetId: ASSET.id, maxBid: 410000000 });
  for (const headers of [{ 'Content-Type': 'text/html', 'X-MOU-Asset-ID': ASSET.id }, { 'Content-Type': 'application/pdf', 'X-MOU-Asset-ID': '123' }]) {
    const bad = new MouDocumentClient(options, { fetchImpl: async () => new Response(BUFFER, { headers }) });
    await assert.rejects(bad.generate(ASSET.id), /MOU_PDF_UNAVAILABLE/);
  }
});

test('draft is separate from signing, never re-sent on baik, and never sent for sold assets or rejected intent', () => {
  const conversion = { mode: 'Closing_State', asset_id: ASSET.id, topic: 'stock', stock_status: 'pending' };
  const params = { asset: ASSET, conversion, text: SERIOUS_REPORTED, history: [{ role: 'assistant', content: 'DETAIL ASET — Kode 121037' }] };
  assert.equal(shouldSendMouDocument(params), true);
  for (const change of [{ mode: 'Search_State' }, { asset_id: '123' }, { stock_status: 'sold' }, { outcome: 'won' },
    { draft_document: { asset_id: ASSET.id, status: 'sent' } }, { draft_document: { asset_id: ASSET.id, status: 'uncertain' } }]) {
    assert.equal(shouldSendMouDocument({ ...params, conversion: { ...conversion, ...change } }), false);
  }
  assert.equal(shouldSendMouDocument({ ...params, text: 'jangan kirim MOU' }), false);
  assert.equal(shouldSendMouDocument({ ...params, history: [], text: 'kirim ulang PDF MOU',
    conversion: { ...conversion, draft_document: { asset_id: ASSET.id, status: 'sent' } } }), true);
});

function runtime({ documents, sendDocument, sendText } = {}) {
  const store = new MemoryStore(config, () => NOW), catalog = interestFixture({ example: 'pacarkembang' });
  const sent = [], generated = [], errors = [], docs = [];
  const processor = new MessageProcessor({ config, store, catalog, ai: noAi, now: () => NOW,
    documents: documents || { async generate(id, maxBid) { generated.push({ id, maxBid }); return file(id); } },
    whatsapp: { async sendText(to, body) { if (sendText) await sendText(body); sent.push(body); return randomUUID(); },
      async sendDocument(to, file, caption) { if (sendDocument) await sendDocument(file); docs.push({ to, file, caption }); return randomUUID(); } },
    logger: { error(event) { errors.push(event); } } });
  const send = async (text) => { processor.acceptBatch([{ id: randomUUID(), from: PHONE, type: 'text', text, timestamp: NOW }]); await processor.drain(); };
  const prepare = async () => { await send(catalog.example.opening); await send(catalog.example.choice); await send(catalog.example.cost); };
  return { processor, store, catalog, sent, generated, docs, errors, send, prepare };
}

test('real chat sends one PDF and preparation guidance, supports explicit re-send, then hands ready buyer to the agent', async () => {
  const f = runtime(); await f.prepare(); assert.equal(f.docs.length, 0);
  await f.send(SERIOUS_REPORTED);
  const session = f.store.get(PHONE);
  assert.equal(f.docs.length, 1); assert.equal(f.generated[0].id, '121037'); assert.equal(f.generated[0].maxBid, null);
  assert.equal(f.docs[0].to, PHONE); assert.equal(f.docs[0].caption, MOU_CAPTION);
  assert.equal(session.conversion.topic, 'purchase_preparation'); assert.equal(session.conversion.process_understood, false);
  assert.equal(session.conversion.draft_document.status, 'sent'); assert.equal(session.is_bot_active, true);
  await f.send('baik'); assert.equal(session.conversion.topic, 'purchase_preparation'); assert.equal(f.docs.length, 1);
  assert.match(f.sent.at(-1), /Rp 20\.000\.000/);
  await f.send('kirim ulang PDF MOU'); assert.equal(f.docs.length, 2); assert.equal(session.is_bot_active, true);
  await f.send('KTP dan cover buku tabungan sudah siap');
  assert.equal(session.conversion.phase, 'purchasing_handoff'); assert.equal(session.is_bot_active, false);
  assert.equal(session.conversion.purchase_intake.documents_verified, false); assert.equal(f.docs.length, 2);
  assert.equal(f.catalog.calls.filter((call) => call.criteria).length, 1); assert.deepEqual(f.errors, []);
});

test('failed PDF generation preserves the delivered CTA and does not claim attachment delivery or repeatedly retry', async () => {
  const f = runtime({ documents: { async generate() { throw new Error('private internal details'); } } });
  await f.prepare(); await f.send(SERIOUS_REPORTED);
  const session = f.store.get(PHONE);
  assert.equal(f.docs.length, 0); assert.equal(session.conversion.draft_document.status, 'failed');
  assert.match(f.sent.at(-1), /belum berhasil/); assert.doesNotMatch(f.sent.at(-1), /private internal/);
  await f.send('baik'); assert.equal(session.conversion.topic, 'purchase_preparation'); assert.equal(f.errors.length, 1);
});

test('the selected asset survives bounded history, and an explicit document request can start the reading journey', async () => {
  const bounded = runtime(); await bounded.prepare();
  bounded.store.get(PHONE).history = bounded.store.get(PHONE).history.slice(-1);
  await bounded.send(SERIOUS_REPORTED); assert.equal(bounded.docs.length, 1); assert.equal(bounded.docs[0].file.assetId, '121037');
  const requested = runtime(); await requested.prepare(); await requested.send('tolong kirim MOU');
  assert.equal(requested.docs.length, 1); assert.equal(requested.store.get(PHONE).conversion.process_understood, false);
  assert.equal(requested.store.get(PHONE).is_bot_active, true);
});

test('failed text delivery and manual takeover during generation cannot send an unwanted PDF', async () => {
  let rejectText = false;
  const failed = runtime({ sendText: async () => { if (rejectText) throw new Error('send failed'); } });
  await failed.prepare(); rejectText = true; await failed.send(SERIOUS_REPORTED);
  assert.equal(failed.generated.length, 0); assert.equal(failed.docs.length, 0);
  let finish, started;
  const pending = new Promise((resolve) => { started = resolve; });
  const f = runtime({ documents: { generate: () => new Promise((resolve) => { finish = resolve; started(); }) } });
  await f.prepare(); const running = f.send(SERIOUS_REPORTED); await pending;
  f.processor.takeOver(PHONE); finish(file()); await running;
  assert.equal(f.docs.length, 0); assert.equal(f.store.get(PHONE).is_bot_active, false);
});

test('an uncertain document send is persisted and does not resend after process restart', async () => {
  const f = runtime({ sendDocument: async () => { throw new Error('send status unknown'); } });
  await f.prepare(); await f.send(SERIOUS_REPORTED);
  const original = f.store.get(PHONE).conversion;
  assert.equal(original.draft_document.status, 'uncertain');
  const db = new ConversationControl(':memory:');
  try {
    const control = db.forTenant('AG108'); control.saveConversion(PHONE, original);
    const restarted = new MemoryStore(config, () => NOW, control).create(PHONE);
    assert.equal(shouldSendMouDocument({ asset: ASSET, conversion: restarted.conversion, text: 'baik',
      history: [{ role: 'assistant', content: 'DETAIL ASET' }] }), false);
  } finally { db.close(); }
});

test('Baileys sends PDF bytes with the correct filename and marks the bot message for takeover detection', async () => {
  const client = new BaileysClient({ timeoutMs: 1000, maxContacts: 20 }); const sent = [];
  client.state = 'connected';
  client.socket = { user: { id: `${PHONE}@s.whatsapp.net` }, async sendMessage(jid, content, options) {
    sent.push({ jid, content, options }); return { key: { id: options.messageId, remoteJid: jid }, message: content };
  } };
  const id = await client.sendDocument(PHONE, file(), MOU_CAPTION);
  assert.equal(sent[0].content.mimetype, 'application/pdf'); assert.equal(sent[0].content.fileName, file().filename);
  assert.equal(sent[0].content.document, BUFFER); assert.equal(client.outboundIds.has(id), true);
});

test('Cloud API uploads the private PDF and sends a document by media ID, without a public file URL', async () => {
  const calls = [], client = createWhatsAppClient({ apiVersion: 'v23.0', phoneNumberId: '123', accessToken: 'test', timeoutMs: 1000 },
    { fetchImpl: async (url, options) => { calls.push({ url, options }); return Response.json(calls.length === 1 ? { id: '456' } : { messages: [{ id: 'wamid.mock' }] }); } });
  assert.equal(await client.sendDocument(PHONE, file(), MOU_CAPTION, 'inbound'), 'wamid.mock');
  assert.match(calls[0].url, /\/media$/); assert.ok(calls[0].options.body instanceof FormData);
  const sent = JSON.parse(calls[1].options.body);
  assert.deepEqual(sent.document, { id: '456', filename: file().filename, caption: MOU_CAPTION });
  assert.equal(sent.context.message_id, 'inbound');
});

test('Playground exposes an authenticated PDF preview isolated by agent and expiring after 15 minutes', async (t) => {
  let now = NOW;
  const token = 'x'.repeat(40), app = express(), catalog = interestFixture({ example: 'pacarkembang' });
  app.use('/sandbox', createSandboxRouter({ config: { ...config, adminToken: token }, catalog, ai: noAi, now: () => now,
    documents: { async generate(id) { return file(id); } } }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.code || 'ERROR' }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`, conversationId = randomUUID();
  const send = async (text) => {
    const response = await fetch(`${base}/sandbox/AG108/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, history: [{ role: 'user', content: text }] }) });
    assert.equal(response.status, 200); return response.json();
  };
  await send(catalog.example.opening); await send(catalog.example.choice); await send(catalog.example.cost);
  const result = await send(SERIOUS_REPORTED); const attachment = result.attachments[0];
  assert.equal(attachment.caption, MOU_CAPTION);
  assert.equal(attachment.asset_id, '121037'); assert.equal(result.session.conversion.process_understood, false);
  const url = `${base}/sandbox/AG108/documents/${attachment.id}`;
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200); assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await fetch(url.replace('AG108', 'AG999'), { headers: { Authorization: `Bearer ${token}` } })).status, 404);
  assert.equal((await send('baik')).attachments, undefined);
  now += 15 * 60000 + 1;
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
});
