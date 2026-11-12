const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const Zip = require('pizzip');
const { Prisma } = require('@prisma/client');

// Compile the actual route code with an isolated in-memory database. Never load
// the application's Prisma singleton or connect to a real database in this suite.
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = createRequire(file);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function resolve(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === '@/lib/prisma' || name.includes('authOptions')) throw Error('Real database/auth imports forbidden in tests');
      if (name.startsWith('@/')) {
        const target = path.resolve('src', name.slice(2));
        return target.endsWith('.mjs') ? localRequire(target) : load(target + '.ts');
      }
      return localRequire(name);
    }
    new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
    return module.exports;
  }
  return load;
}

const contract = loader()('src/lib/suratGeneration.ts');
const pemohon = {
  nama_pemohon: 'PEMOHON QA & REKAN', nik_pemohon: '1234567890123456',
  tempatlahir_pemohon: 'Kota Uji', tanggallahir_pemohon: '1 Januari 1980',
  alamat_pemohon: 'ALAMAT PEMOHON QA',
};
function fixture(id, mode = 'sendiri') {
  const values = { bertindakSebagai: mode, tanggal_surat: '2026-11-04' };
  for (const f of contract.suratFields(id, values)) values[f.key] = 'QA ' + f.key;
  return { ...values, ...pemohon, tanggal_surat: '2026-11-04', LT: '120',
    nama_kuasa: 'KUASA QA', nik_kuasa: '9876543210987654', tanggallahir_kuasa: '2 Februari 1982',
    tempatlahir_kuasa: 'Kota Kuasa QA', kelamin_kuasa: 'Laki-laki', agama_kuasa: 'Islam',
    warga_negara_kuasa: 'Indonesia', alamat_kuasa: 'ALAMAT PENERIMA KUASA QA',
    pekerjaan_kuasa: 'Advokat QA', statuskawin_kuasa: 'Belum Menikah',
    nomor_surat_kuasa: '1/SKP/NOV/2026', tanggal_surat_kuasa: '2026-11-04',
    nama_debitur: 'DEBITUR QA', alamat_debitur: 'ALAMAT DEBITUR QA',
    lokasi_asset: 'ALAMAT ASET QA', pengadilan: 'Pengadilan Negeri Uji',
    kpknl: 'KPKNL Uji', nomor_kwitansi: 'KUITANSI-QA-2026', tanggal_kwitansi: '3 November 2026',
    tanggal_risalah: '1 November 2026', objek: 'Tanah dan bangunan QA',
    nama_bank: 'Bank QA Indonesia', warga_negara: 'Indonesia',
  };
}

function validateProjection(modelName, args) {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName);
  for (const [key, nested] of Object.entries(args.select || args.include || {})) {
    const field = model.fields.find(f => f.name === key);
    assert.ok(field, `${modelName}.${key} does not exist in the current Prisma schema`);
    if (field.kind === 'object' && typeof nested === 'object') validateProjection(field.type, nested);
  }
  if (args.data) for (const [key, value] of Object.entries(args.data)) {
    const field = model.fields.find(f => f.name === key);
    assert.ok(field, `${modelName}.${key} write does not exist`);
    if (value != null && field.type === 'String') assert.equal(typeof value, 'string', `${modelName}.${key}`);
  }
}

const mou = {
  id: 17n, id_transaksi: 'MOU-QA-17', id_agent: 'QA-AGENT', tipe_komisi: 'PERSENTASE',
  nama_lengkap_klien: 'KLIEN QA', nik_klien: '1234567890123456', alamat_klien: 'Alamat klien QA',
  harga_deal: 750000000n, harga_limit: 500000000, maksimum_bidding: 600000000,
  biaya_baliknama: 10000000n, biaya_pengosongan: 20000000n,
  termasuk_baliknama: true, termasuk_pengosongan: true,
  listing: { judul: 'Aset QA', alamat_lengkap: 'Alamat aset QA', kota: 'Kota Uji', gambar: '',
    luas_tanah: 120, luas_bangunan: 80, provinsi: 'Jawa Timur', legalitas: 'SHM', nomor_legalitas: 'SHM-QA',
    uang_jaminan: 100000000n, nilai_limit_lelang: 500000000 },
  agent: { nama_kantor: 'Kantor QA', kota_area: 'Kota Uji', pengguna: { nama_lengkap: 'AGENT QA' } },
};

function context(options = {}) {
  const writes = [];
  const docx = [];
  const trx = { id_transaksi: mou.id_transaksi, dibuat_pada: new Date('2026-11-04T00:00:00Z'), harga_bidding: 600000000, mou };
  const invoice = { id_invoice: '017/INV/QA', id_transaksi: mou.id_transaksi, nominal: 1000000n,
    ditagihkan_ke: 'KLIEN QA', keterangan: 'Biaya QA', tanggal_invoice: new Date(),
    id_kuitansi: '007/KWT/QA', tanggal_kuitansi: new Date('2026-10-01'), transaksi: trx };
  function model(name, methods) {
    return Object.fromEntries(Object.entries(methods).map(([method, fn]) => [method, async args => {
      validateProjection(name, args);
      if (['create', 'update', 'delete'].includes(method)) writes.push({ name, method, args });
      return fn(args);
    }]));
  }
  const db = {
    agent: model('Agent', { findUnique: () => ({ jabatan: 'OWNER', id_agent: 'QA-AGENT' }) }),
    mou: model('Mou', { findFirst: () => ({ ...mou, tipe_komisi: options.commission || 'PERSENTASE' }) }),
    transaksi: model('Transaksi', { findUnique: () => trx, findMany: () => [trx] }),
    invoice: model('Invoice', {
      findUnique: args => args.where.id_invoice === invoice.id_invoice ? invoice : options.existing || null,
      count: () => 7,
      create: args => { if (options.writeFailure) throw Error('QA database failure'); return args.data; },
      update: args => args.data,
    }),
    suratDebiturCare: model('SuratDebiturCare', { findFirst: () => null, create: () => ({ id: 1n }), delete: () => ({}) }),
    aktaKesepakatanBersama: model('AktaKesepakatanBersama', { findFirst: () => null, create: () => ({ id: 1n }), delete: () => ({}) }),
  };
  db.$transaction = async callback => callback({ ...db, $executeRaw: async query => {
    assert.match(query.join(''), /pg_advisory_xact_lock/);
    return 1;
  } });
  const actual = process.env.SURAT_QA_PDF === '1'
    ? loader()('src/lib/server/docxToPdf.ts').docxToPdf : null;
  const load = loader({
    'next-auth': { getServerSession: async () => options.noSession ? null : { user: { agentId: 'QA-AGENT', name: 'AGENT QA' } } },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/prisma': { prisma: db },
    '@/lib/server/docxToPdf': { docxToPdf: async (buffer, prefix) => {
      docx.push(buffer);
      if (options.convertFailure) throw Error('QA converter failure');
      return actual ? actual(buffer, prefix) : Buffer.from('%PDF-1.7\nQA');
    } },
  });
  return { load, writes, docx, invoice };
}

function request(body) {
  return new Request('http://localhost/api/surat/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const akta = {
  tanggal_akta: '2026-11-04', tanggal_ttd: '2026-11-04', kota_ttd: 'Kota Uji', pukul: '10.00',
  p1_nama: 'PEMENANG QA', p1_nik: '1234567890123456', p1_tempat_lahir: 'Kota Uji', p1_tgl_lahir: '01-01-1980', p1_alamat: 'Alamat satu QA', p1_pekerjaan: 'Pekerjaan QA',
  p2_nama: 'DEBITUR QA', p2_nik: '9876543210987654', p2_tempat_lahir: 'Kota Uji', p2_tgl_lahir: '02-02-1982', p2_alamat: 'Alamat dua QA', p2_pekerjaan: 'Pekerjaan QA',
  jenis_hak: 'SHM', nib: 'NIB-QA', luas: '120', alamat_obyek: 'Alamat aset QA',
  obyek_provinsi: 'Jawa Timur', obyek_kabupaten: 'Kota Uji', obyek_kecamatan: 'Kecamatan Uji', obyek_kelurahan: 'Kelurahan Uji',
  kompensasi_total: '20000000', tahap1_jumlah: '5000000', tahap1_tanggal: '2026-11-04', batas_tanggal: '2026-12-04',
  pengadilan: 'Pengadilan Negeri Uji', risalah_nomor: 'RISALAH-QA', risalah_tanggal: '2026-11-01', kantor_lelang: 'KPKNL Uji',
};
const cases = [
  ['generate-permohonan-pn', fixture('permohonan-eksekusi-pn')],
  ['generate-permohonan-pn', fixture('permohonan-eksekusi-pn', 'kuasa')],
  ['generate-akta-grosse', fixture('permohonan-akte-grosse')],
  ['generate-akta-grosse', fixture('permohonan-akte-grosse', 'kuasa')],
  ['generate-MOU', { id_transaksi: mou.id_transaksi }],
  ['generate-MOU', { id_transaksi: mou.id_transaksi }, { commission: 'SELISIH_HARGA' }],
  ['generate-invoice', { nama_pembeli: 'KLIEN QA', keterangan: 'Biaya QA', nilai: '1000000', id_transaksi: mou.id_transaksi }],
  ['generate-kuitansi', { id_invoice: '017/INV/QA' }],
  ['generate-invoice-utm', { id_transaksi: mou.id_transaksi }],
  ['generate-tanda-terima', { nama_pemilik: 'PEMILIK QA', nik_pemilik: '1234567890123456', alamat_pemilik: 'Alamat pemilik QA', alamat_properti: 'Alamat aset QA', nama_agent: 'AGENT QA', no_agent: '0000', tanggal_ttd: '2026-11-04' }],
  ['generate-akta-kesepakatan', akta],
  ['generate-debitur-care', { nama: 'DEBITUR QA', nik: '1234567890123456', alamat_lengkap: 'Alamat debitur QA', jenis_sertifikat: 'SHM', nomor_sertifikat: 'SHM-QA', tanggal_surat: '2026-11-04' }],
];

test('form/API contracts, OCR mapping and Jakarta date boundaries', async () => {
  assert.equal(contract.tanggalWib(new Date('2026-11-03T17:05:00Z')), '2026-11-04');
  assert.equal(contract.formatTanggalSurat('2026-11-04'), '4 November 2026');
  assert.equal(contract.nomorSuratKuasaDefault('2026-11-04'), '1/SKP/NOV/2026');
  assert.equal(contract.tanggalSuratValid('2026-02-30'), false);
  assert.equal(contract.tanggalSuratValid('2024-02-29'), true);
  assert.deepEqual(contract.ktpSuratPatch({ nama_pemohon: ' QA ', nik_pemohon: '', alamat_pemohon: 'Alamat QA' }, 'kuasa'), { nama_kuasa: 'QA', alamat_kuasa: 'Alamat QA' });
  assert.deepEqual(contract.ktpSuratPatch({ warga_negara: 'Indonesia', agama_pemohon: 'Islam' }, 'kuasa'), { agama_kuasa: 'Islam', warga_negara_kuasa: 'Indonesia' });
  for (const id of ['permohonan-eksekusi-pn', 'permohonan-akte-grosse']) {
    const body = fixture(id);
    assert.deepEqual(contract.suratErrors(id, body), {});
    assert.ok(contract.suratErrors(id, { ...body, nik_pemohon: '123' }).nik_pemohon);
    assert.ok(contract.suratErrors(id, { ...body, tanggal_surat: '2026-02-30' }).tanggal_surat);
  }
  const power = fixture('permohonan-eksekusi-pn', 'kuasa');
  assert.deepEqual(contract.suratErrors('permohonan-eksekusi-pn', power), {});
  assert.ok(contract.suratErrors('permohonan-eksekusi-pn', { ...power, nomor_surat_kuasa: '1/SKP/DEC/2026' }).nomor_surat_kuasa);
  assert.ok(contract.suratErrors('permohonan-eksekusi-pn', { ...power, nomor_surat_kuasa: '0/SKP/NOV/2026' }).nomor_surat_kuasa);
  assert.ok(contract.suratErrors('permohonan-eksekusi-pn', { ...power, tanggal_surat_kuasa: '2026-12-04' }).nomor_surat_kuasa);
});

test('all letter routes render actual templates against current Prisma schema', async t => {
  for (const [index, [endpoint, body, options]] of cases.entries()) await t.test(`${index + 1}: ${endpoint}`, async () => {
    const ctx = context(options);
    const route = ctx.load(`src/app/api/surat/${endpoint}/route.ts`);
    const response = await route.POST(request(body));
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.ok(response.headers.get('content-disposition').includes('.pdf'));
    assert.equal(ctx.docx.length, 1);
    const xml = new Zip(ctx.docx[0]).file('word/document.xml').asText().replace(/<[^>]*>/g, '');
    assert.ok(!xml.includes('{{'), 'unresolved template placeholders');
    if (endpoint.includes('permohonan') || endpoint === 'generate-akta-grosse') {
      assert.ok(xml.includes('PEMOHON QA &amp; REKAN'));
      assert.ok(!/JASON CHRISTOPHER|3514120108030002|MOHAMAD MUJIB|770\/10\.01/.test(xml));
      if (endpoint === 'generate-akta-grosse') assert.equal(xml.includes('SURAT KUASA'), body.bertindakSebagai === 'kuasa');
      else {
        assert.ok(xml.includes('ALAMAT DEBITUR QA'));
        assert.ok(xml.includes('ALAMAT ASET QA'));
        assert.ok(xml.includes('Bank QA Indonesia'));
        assert.ok(xml.includes('3 November 2026'));
        if (body.bertindakSebagai === 'kuasa') {
          assert.ok(xml.includes('bangunan yang berdiri diatasnya, masing-masing sesuai'));
          for (const value of [
            'KUASA QA', '9876543210987654', 'Kota Kuasa QA', '2 Februari 1982',
            'Laki-laki', 'Islam', 'Indonesia', 'ALAMAT PENERIMA KUASA QA',
            'Advokat QA', 'Belum Menikah', '1/SKP/NOV/2026', '4 November 2026',
            'PEMBERI KUASA', 'PENERIMA KUASA', 'JUSTICIA LAWFIRM',
          ]) assert.ok(xml.includes(value), `Kuasa template is missing ${value}`);
          for (const [field, value] of Object.entries({
            kota: body.kota,
            pengadilan: body.pengadilan,
            alamat_PN: body.alamat_PN,
            nama_pemohon: 'PEMOHON QA &amp; REKAN',
            NIK_pemohon: body.nik_pemohon,
            tempatlahir_pemohon: body.tempatlahir_pemohon,
            tanggallahir_pemohon: body.tanggallahir_pemohon,
            kelamin_pemohon: body.kelamin_pemohon,
            agama_pemohon: body.agama_pemohon,
            warga_negara: body.warga_negara,
            alamat_pemohon: body.alamat_pemohon,
            pekerjaan_pemohon: body.pekerjaan_pemohon,
            statuskawin_pemohon: body.statuskawin_pemohon,
            nama_kuasa: body.nama_kuasa,
            NIK_kuasa: body.nik_kuasa,
            tempatlahir_kuasa: body.tempatlahir_kuasa,
            tanggallahir_kuasa: body.tanggallahir_kuasa,
            kelamin_kuasa: body.kelamin_kuasa,
            agama_kuasa: body.agama_kuasa,
            warga_negara_kuasa: body.warga_negara_kuasa,
            alamat_kuasa: body.alamat_kuasa,
            pekerjaan_kuasa: body.pekerjaan_kuasa,
            statuskawin_kuasa: body.statuskawin_kuasa,
            nama_debitur: body.nama_debitur,
            alamat_debitur: body.alamat_debitur,
            jenis_sertifikat: body.jenis_sertifikat,
            singkatan_sertifikat: body.singkatan_sertifikat,
            nomor_nib: body.nomor_nib,
            LT: body.LT,
            lokasi_asset: body.lokasi_asset,
            kelurahan_asset: body.kelurahan_asset,
            kecamatan_asset: body.kecamatan_asset,
            kota_asset: body.kota_asset,
            nama_bank: body.nama_bank,
            kantor_lelang: body.kantor_lelang,
            nomor_risalah: body.nomor_risalah,
            tanggal_risalah: body.tanggal_risalah,
            nomor_kwitansi: body.nomor_kwitansi,
            tanggal_kwitansi: body.tanggal_kwitansi,
          })) assert.ok(xml.includes(value), `Kuasa template field ${field} was not populated`);
        } else {
          assert.ok(!xml.includes('SURAT KUASA'));
        }
      }
    }
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    if (process.env.SURAT_QA_PDF === '1') {
      const parsed = await require('pdf-parse/lib/pdf-parse.js')(pdf);
      assert.ok(parsed.numpages > 0);
      if (endpoint === 'generate-permohonan-pn' && body.bertindakSebagai === 'kuasa') {
        for (const value of ['SURAT KUASA', '1/SKP/NOV/2026', 'ALAMAT PENERIMA KUASA QA', '4 November 2026'])
          assert.ok(parsed.text.includes(value), `Generated PDF is missing ${value}`);
      }
      fs.mkdirSync('/tmp/kosku-surat-qa', { recursive: true });
      fs.writeFileSync(`/tmp/kosku-surat-qa/${index + 1}-${endpoint}.pdf`, pdf);
      console.log(JSON.stringify({ endpoint, pages: parsed.numpages, bytes: pdf.length, database: 'in-memory' }));
    }
  });
});

test('failure paths preserve honest status and rollback reserved registers', async () => {
  for (const [endpoint, body] of cases) {
    const denied = context({ noSession: true });
    const response = await denied.load(`src/app/api/surat/${endpoint}/route.ts`).POST(request(body));
    assert.equal(response.status, 401);
    assert.equal(denied.writes.length, 0);
  }
  const ctx = context();
  const pn = ctx.load('src/app/api/surat/generate-permohonan-pn/route.ts');
  for (const invalid of [null, [], { nama_pemohon: {} }, {}, { ...fixture('permohonan-eksekusi-pn'), LT: '-1' }])
    assert.equal((await pn.POST(request(invalid))).status, 400);
  assert.equal(ctx.docx.length, 0);
  for (const endpoint of ['generate-akta-kesepakatan', 'generate-debitur-care']) {
    const failed = context({ convertFailure: true });
    const body = cases.find(row => row[0] === endpoint)[1];
    const response = await failed.load(`src/app/api/surat/${endpoint}/route.ts`).POST(request(body));
    assert.equal(response.status, 500);
    assert.deepEqual(failed.writes.map(w => w.method), ['create', 'delete']);
  }
  const failed = context({ writeFailure: true });
  const body = cases.find(row => row[0] === 'generate-invoice')[1];
  assert.equal((await failed.load('src/app/api/surat/generate-invoice/route.ts').POST(request(body))).status, 500);
});

test('regenerating a receipt preserves its original number and date', async () => {
  const ctx = context();
  await ctx.load('src/app/api/surat/generate-kuitansi/route.ts').POST(request({ id_invoice: ctx.invoice.id_invoice }));
  const update = ctx.writes.find(w => w.method === 'update');
  assert.equal(update.args.data.id_kuitansi, ctx.invoice.id_kuitansi);
  assert.equal(update.args.data.tanggal_kuitansi, ctx.invoice.tanggal_kuitansi);
});

test('transaction picker uses the current Mou relation and string primary key', async () => {
  const ctx = context();
  const response = await ctx.load('src/app/api/surat/transaksi-list/route.ts').GET();
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows[0].id, mou.id_transaksi);
  assert.equal(rows[0].judul_property, mou.listing.judul);
});

test('download validates PDF, exposes both API error formats, and delays URL cleanup', async () => {
  const { downloadSurat } = loader()('src/lib/suratDownload.ts');
  const original = { fetch: global.fetch, document: global.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL,
    setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
  const timers = [], events = [];
  let response;
  global.fetch = async () => response;
  global.setTimeout = (fn, delay) => { const timer = { fn, delay }; timers.push(timer); return timer; };
  global.clearTimeout = () => {};
  URL.createObjectURL = () => 'blob:qa';
  URL.revokeObjectURL = url => events.push(['revoke', url]);
  global.document = {
    body: { appendChild: () => events.push(['append']) },
    createElement: () => ({ click() { events.push(['click', this.download]); }, remove() { events.push(['remove']); } }),
  };
  try {
    response = new Response('%PDF-1.7\nQA', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename*=UTF-8''Surat%20QA.pdf" } });
    assert.equal(await downloadSurat('/qa', {}, 'fallback.pdf'), 'Surat QA.pdf');
    assert.deepEqual(events, [['append'], ['click', 'Surat QA.pdf'], ['remove']]);
    timers.find(timer => timer.delay === 30000).fn();
    assert.deepEqual(events.at(-1), ['revoke', 'blob:qa']);
    for (const body of [{ detail: 'QA detail' }, { error: 'QA error' }]) {
      response = Response.json(body, { status: 500 });
      await assert.rejects(() => downloadSurat('/qa', {}, 'fallback.pdf'), /QA/);
    }
    for (const [body, type] of [['<html>Login</html>', 'text/html'], ['', 'application/pdf']]) {
      response = new Response(body, { headers: { 'Content-Type': type } });
      await assert.rejects(() => downloadSurat('/qa', {}, 'fallback.pdf'), /PDF yang valid/);
    }
    response = Response.json({}, { status: 401 });
    await assert.rejects(() => downloadSurat('/qa', {}, 'fallback.pdf'), /Sesi login berakhir/);
    global.fetch = async (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    const pending = downloadSurat('/qa', {}, 'fallback.pdf');
    timers.at(-1).fn();
    await assert.rejects(() => pending, /batas waktu/);
  } finally {
    global.fetch = original.fetch; global.document = original.document;
    global.setTimeout = original.setTimeout; global.clearTimeout = original.clearTimeout;
    URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke;
  }
});

test('long Grosse content keeps all pages and the optional power of attorney', { skip: process.env.SURAT_QA_PDF !== '1' }, async () => {
  const ctx = context();
  const body = fixture('permohonan-akte-grosse', 'kuasa');
  body.alamat_pemohon = Array.from({ length: 80 }, (_, i) => `Alamat QA baris ${i}`).join('\n') + '\nAKHIR ALAMAT QA';
  const response = await ctx.load('src/app/api/surat/generate-akta-grosse/route.ts').POST(request(body));
  assert.equal(response.status, 200);
  const pdf = Buffer.from(await response.arrayBuffer());
  const parsed = await require('pdf-parse/lib/pdf-parse.js')(pdf);
  fs.writeFileSync('/tmp/kosku-surat-qa/long-grosse.pdf', pdf);
  fs.writeFileSync('/tmp/kosku-surat-qa/long-grosse.txt', parsed.text);
  assert.ok(parsed.numpages > 2);
  assert.ok(parsed.text.includes('AKHIR ALAMAT QA'));
  assert.match(parsed.text, /SURAT\s+KUASA/);
});
