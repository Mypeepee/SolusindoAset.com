// Exercise the real Next.js document endpoints without DB credentials or WhatsApp.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const secret = 'test-only-mou-token-'.padEnd(40, 'x');
const asset = { id: '121037', transaction_type: 'LELANG', full_address: 'Pacarkembang', limit_price: 350000000 };
const buffer = Buffer.from('%PDF-1.7\nmock transport body');
const fail = (error, status) => NextResponse.json({ error }, { status });
function load(file, stubs = {}) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, stubs);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
function internal({ lookup, render } = {}) {
  return load('src/app/api/internal/chatbot/mou-draft/route.ts', {
    '@/lib/prisma': {}, '@/lib/chatbot/property-knowledge': { getPropertyKnowledge: lookup || (async () => ({ asset })) },
    '@/lib/server/docxToPdf': { docxToPdf: async () => buffer },
    '@/lib/server/chatbotMouDraft.mjs': { renderMouDraft: render || (async (property) => ({ buffer, filename: `Draf_MOU_Aset_${property.id}.pdf`, assetId: property.id })) },
  });
}
const request = (body, token = secret) => new NextRequest('http://localhost:3000/api/internal/chatbot/mou-draft', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const originalSecret = process.env.CHATBOT_PROPERTY_TOKEN;
test.after(() => { if (originalSecret === undefined) delete process.env.CHATBOT_PROPERTY_TOKEN; else process.env.CHATBOT_PROPERTY_TOKEN = originalSecret; });
process.env.CHATBOT_PROPERTY_TOKEN = secret;

test('MOU endpoint authenticates before reading listings or rendering a PDF', async () => {
  let calls = 0;
  const route = internal({ lookup: async () => { calls++; return { asset }; } });
  assert.equal((await route.POST(request({ assetId: asset.id }, 'wrong'))).status, 401);
  assert.equal(calls, 0);
});

test('browser-supplied identities, prices, bank accounts, templates and malformed IDs are rejected', async () => {
  let calls = 0;
  const route = internal({ lookup: async () => { calls++; return { asset }; } });
  for (const body of [{ assetId: '../template' }, { assetId: asset.id, maxBid: -1 }, { assetId: asset.id, price: 1 },
    { assetId: asset.id, deposit: 1 }, { assetId: asset.id, uang_jaminan: 1 },
    { assetId: asset.id, nama_klien: 'Injected client' }, { assetId: asset.id, bank: 'fake' }, { assetId: asset.id, template: '/tmp/file' }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test('MOU PDF uses the fresh selected listing and explicit bid ceiling; output is private and asset-bound', async () => {
  let scope, rendered;
  const route = internal({ lookup: async (_, query) => { scope = query; return { asset }; },
    render: async (property, options) => { rendered = { property, options }; return { buffer, filename: 'Draf_MOU_Aset_121037.pdf', assetId: property.id }; } });
  const response = await route.POST(request({ assetId: asset.id, maxBid: 410000000 }));
  assert.equal(response.status, 200); assert.deepEqual(scope, { text: 'Kode 121037', previousId: null });
  assert.equal(rendered.property, asset); assert.equal(rendered.options.maxBid, 410000000);
  assert.equal(response.headers.get('x-mou-asset-id'), asset.id); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), buffer);
  assert.equal((await internal({ lookup: async () => ({ asset: null }) }).POST(request({ assetId: asset.id }))).status, 404);
  assert.equal((await internal({ lookup: async () => ({ asset: { ...asset, id: '999' } }) }).POST(request({ assetId: asset.id }))).status, 404);
});

test('MOU rendering failures stay explicit without exposing internal details or returning a fake PDF', async () => {
  const response = await internal({ render: async () => { throw new Error('private server file path'); } }).POST(request({ assetId: asset.id }));
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'MOU_PDF_UNAVAILABLE' });
});

test('transaction MOU applies the same fixed 5% commission, document fee and capped tanda jadi to the actual DOCX', async () => {
  const { default: PizZip } = await import('pizzip');
  const terms = require(resolve(__dirname, '../src/lib/server/mouPaymentTerms.mjs'));
  const costs = require(resolve(__dirname, '../src/lib/server/mouCostFields.mjs'));
  let filled;
  const transaction = { id: 1n, id_transaksi: 'TRX-TEST-MOU', tipe_komisi: 'PERSENTASE', persentase_komisi: 0.02,
    nama_lengkap_klien: 'Klien Contoh', nik_klien: '0000000000000000', alamat_klien: 'Alamat simulasi klien',
    harga_limit: 100000000n, maksimum_bidding: 130000000n, biaya_baliknama: 0n, biaya_pengosongan: 0n,
    listing: { alamat_lengkap: 'Alamat objek simulasi', luas_tanah: 100, legalitas: 'SHM', nomor_legalitas: 'SIMULASI',
      uang_jaminan: 30000000n, nilai_limit_lelang: 100000000n } };
  const route = load('src/app/api/surat/generate-MOU/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'test' } }) },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/prisma': { prisma: { mou: { findFirst: async () => transaction } } },
    '@/lib/server/mouPaymentTerms.mjs': terms,
    '@/lib/server/mouCostFields.mjs': costs,
    '@/lib/server/docxToPdf': { docxToPdf: async (docx) => { filled = docx; return buffer; } },
  });
  const response = await route.POST(new Request('http://localhost:3000/api/surat/generate-MOU', { method: 'POST',
    body: JSON.stringify({ id_transaksi: 'TRX-TEST-MOU', komisi_persen: '99', uang_tanda_jadi: '1', uang_jaminan: '1' }) }));
  assert.equal(response.status, 200);
  const text = new PizZip(filled).file('word/document.xml').asText().replace(/<[^>]*>/g, '');
  assert.match(text, /5% dari Harga Menang Lelang/); assert.doesNotMatch(text, /99%|\{\{|undefined/);
  assert.match(text, /Biaya Pengurusan Balik Nama Sertifikat8,5% dari Harga Menang Lelang \+ Rp 10\.000\.000/);
  assert.doesNotMatch(text, /18\.500\.000/);
  assert.doesNotMatch(text, /10%|nilai maksimal Rp|Biaya Pengurusan DokumenRp/);
  const refund = text.slice(text.indexOf('PASAL 11'), text.indexOf('PASAL 12'));
  assert.match(refund, /Uang Tanda Jadi.*Rp 10\.000\.000/); assert.match(refund, /Uang Jaminan Lelang.*Rp 30\.000\.000/);

  // The formal transaction generator must use the same Pasal 3 policy as
  // chatbot drafts, even when legacy stored amounts are empty or obsolete.
  Object.assign(transaction, { harga_limit: 3043000000n, maksimum_bidding: 4000000000n,
    biaya_baliknama: 1n, biaya_pengosongan: 1n });
  Object.assign(transaction.listing, { nilai_limit_lelang: 3043000000n, luas_tanah: 306, provinsi: 'Jawa Tengah' });
  const semarang = await route.POST(new Request('http://localhost:3000/api/surat/generate-MOU', { method: 'POST',
    body: JSON.stringify({ id_transaksi: 'TRX-TEST-MOU', estimasi_modal_eksekusi: '1' }) }));
  assert.equal(semarang.status, 200);
  const all = new PizZip(filled).file('word/document.xml').asText().replace(/<[^>]*>/g, '');
  const section = all.slice(all.indexOf('PASAL 3'), all.indexOf('PASAL 4'));
  for (const amount of ['384.800.000']) {
    assert.ok(section.includes(`Rp ${amount}`), `Transaction Pasal 3 contains Rp ${amount}`);
  }
  assert.match(section, /8,5% dari Harga Menang Lelang \+ Rp 10\.000\.000/);
  assert.doesNotMatch(section, /268\.655\.000|mediasi|kerohiman|BPHTB|Bea Lelang|PPN|3\.563\.805\.000|\{\{|undefined/i);
});

test('PDF download uses the logged-in agent and accepts only PDF bytes with a safe filename', async () => {
  const route = load('src/app/api/dashboard/chatbot/playground/documents/[id]/route.ts', {
    '@/lib/chatbot/server-access': { CHATBOT_HEADERS: { 'Cache-Control': 'private, no-store' }, chatbotError: fail,
      resolveChatbotAgent: async () => ({ agentId: 'AG108', base: 'https://backend.invalid', token: 'private-backend-token' }) },
  });
  const original = global.fetch; let seen;
  const id = '00000000-0000-4000-8000-000000000001';
  const download = () => route.GET(new NextRequest(`http://localhost:3000/documents/${id}`), { params: Promise.resolve({ id }) });
  try {
    global.fetch = async (url, options) => { seen = { url, options }; return new Response(buffer, { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Draf_MOU_Aset_121037.pdf"' } }); };
    const response = await download(); assert.equal(response.status, 200);
    assert.equal(seen.url, `https://backend.invalid/sandbox/AG108/documents/${id}`);
    assert.equal(response.headers.get('authorization'), null); assert.deepEqual(Buffer.from(await response.arrayBuffer()), buffer);
    global.fetch = async () => new Response('expired', { status: 404 });
    assert.equal((await download()).status, 404);
    global.fetch = async () => new Response('<html>private</html>', { headers: { 'Content-Type': 'text/html' } });
    assert.equal((await download()).status, 503);
  } finally { global.fetch = original; }
});

test('Playground validation rejects arbitrary document URLs and a PDF for a different property', () => {
  const { isPlaygroundResponse } = load('src/lib/chatbot/playground.ts');
  const id = '00000000-0000-4000-8000-000000000001';
  const attachment = { id, filename: 'Draf_MOU_Aset_121037.pdf', asset_id: '121037', mime_type: 'application/pdf', bytes: 200,
    url: `/api/dashboard/chatbot/playground/documents/${id}`, caption: 'Pelajari Pasal 3, 4, dan 11.' };
  const result = { reply: 'Draf untuk dipelajari.', asset: { id: '121037', name: 'Rumah', location: 'Pacarkembang', price_display: 'Rp350 juta', price_label: 'Harga limit' },
    knowledge: { status: 'matched', source: 'sandbox' }, attachments: [attachment] };
  assert.equal(isPlaygroundResponse(result), true);
  for (const change of [{ url: 'https://untrusted.invalid/steal' }, { asset_id: '999' }, { filename: '../secret.pdf' }, { bytes: 999999999 }, { caption: 1 }, { caption: 'x'.repeat(1001) }]) {
    assert.equal(isPlaygroundResponse({ ...result, attachments: [{ ...attachment, ...change }] }), false);
  }
});
