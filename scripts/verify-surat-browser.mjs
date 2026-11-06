import assert from 'node:assert/strict';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { encode } from 'next-auth/jwt';
import puppeteer from 'puppeteer';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });
const origin = process.env.SURAT_QA_ORIGIN || 'http://127.0.0.1:3001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser, page, stage = 'setup';
const errors = [], attempts = {}, payloads = {};
let realPn = false;
const pdf = fs.readFileSync('/tmp/kosku-surat-qa/1-generate-permohonan-pn.pdf');
const trx = { id: 'MOU-QA-17', kode_transaksi: 'MOU-QA-17', tanggal_transaksi: '2026-11-04T00:00:00Z', judul_property: 'PROPERTI QA SURAT', alamat_property: 'ALAMAT ASET QA', nama_agent: 'AGENT QA', foto_url: '', harga: 100000000, label_harga: 'Harga deal' };
const invoice = { id_invoice: 'INVOICE-QA-SURAT', id_kuitansi: null, ditagihkan_ke: 'KLIEN QA', keterangan: 'Biaya QA', nominal: 1000000, tanggal_invoice: trx.tanggal_transaksi, kode_transaksi: trx.id, alamat_property: trx.alamat_property, foto_url: '', sudah_kuitansi: false };

try {
  const agent = await db.agent.findFirst({ where: { jabatan: 'OWNER', pengguna: { status_akun: 'AKTIF' } }, select: { id_agent: true, id_pengguna: true } });
  assert.ok(agent);
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: agent.id_pengguna, sub: agent.id_pengguna, peran: 'AGENT', role: 'AGENT', jabatan: 'OWNER', agentId: agent.id_agent, _refreshedAt: Date.now() } });
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setCookie({ name: process.env.NEXTAUTH_URL?.startsWith('https:') ? '__Secure-next-auth.session-token' : 'next-auth.session-token', value: token, url: origin, secure: process.env.NEXTAUTH_URL?.startsWith('https:') || false, httpOnly: true });
  await page.setViewport({ width: 1365, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/surat/generate-')) {
      const key = url.pathname.split('/').at(-1);
      if (realPn && key === 'generate-permohonan-pn') { void request.continue(); return; }
      attempts[key] = (attempts[key] || 0) + 1;
      payloads[key] = JSON.parse(request.postData());
      // Intercept every register/financial mutation. First fail, then return a
      // real fixture PDF so recovery and download behavior execute in Chrome.
      void request.respond(attempts[key] === 1
        ? { status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Kegagalan QA; silakan coba lagi.' }) }
        : { status: 200, contentType: 'application/pdf', headers: { 'Content-Disposition': `attachment; filename="${key}-QA.pdf"` }, body: pdf });
    } else if (url.pathname === '/api/surat/transaksi-list') void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify([trx]) });
    else if (url.pathname === '/api/surat/invoice-list') void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify([invoice]) });
    else if (url.pathname === '/api/surat/agent-me') void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ nama_agent: 'AGENT QA', no_agent: '0000' }) });
    else if (url.pathname === '/api/surat/ocr-ktp') void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'valid', parsed: { nama_pemohon: 'HASIL OCR QA', nik_pemohon: '1234567890123456', kotalahir_pemohon: 'KOTA OCR QA', tanggallahir_pemohon: '1 Januari 1980', alamat_pemohon: 'ALAMAT OCR QA' }, warnings: [] }) });
    else if (url.origin === origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method()))
      void request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Mutasi dinonaktifkan selama QA.' }) });
    else void request.continue();
  });
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp/kosku-surat-qa/downloads', eventsEnabled: true });
  let downloads = 0;
  client.on('Browser.downloadWillBegin', () => downloads++);

  async function open(id) {
    stage = 'open ' + id;
    console.log(stage);
    await page.goto(origin + '/dashboard/surat?template=' + id, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => !!document.querySelector('[role="dialog"], .fixed.inset-0.z-\\[9999\\]'));
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Generate|Lanjut|Buat surat/.test(b.textContent)));
  }
  async function clickText(text) {
    const handle = await page.waitForFunction(text => {
      const buttons = [...document.querySelectorAll('button')].filter(b => !b.disabled && b.getBoundingClientRect().height > 0);
      return buttons.find(b => b.textContent.trim() === text) || buttons.find(b => b.textContent.includes(text));
    }, { timeout: 20000 }, text);
    await handle.asElement().click();
  }
  async function fillVisible() {
    await page.evaluate(() => {
      for (const input of document.querySelectorAll('input:not([type="file"]), textarea')) {
        if (!input.getBoundingClientRect().height || input.disabled || input.readOnly || input.type === 'hidden' || input.type === 'checkbox') continue;
        const label = input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent : '';
        const hint = (label || input.closest('div')?.parentElement?.textContent || '') + ' ' + (input.placeholder || '') + ' ' + input.name;
        if (/Cari|Search|search/i.test(hint) && !input.name) continue;
        let value = input.value || 'DATA QA';
        if (/NIK|16 digit/i.test(hint)) value = '1234567890123456';
        else if (input.type === 'date') value = '2026-12-04';
        else if (input.type === 'datetime-local') value = '2026-11-04T10:00';
        else if (input.name === 'tanggal_surat') value = '2026-11-04';
        else if (/DD-MM-YYYY/i.test(hint)) value = '01-01-1980';
        else if (input.type === 'number' || /kompensasi|jumlah|Persen|luas|m²|Rupiah/i.test(hint) || input.placeholder === '0') value = '1000000';
        else if (input.name === 'id_transaksi') value = 'MOU-QA-17';
        const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  async function recoverAndDownload(endpoint, label) {
    stage = 'failure/retry ' + endpoint;
    const before = downloads;
    await clickText(label);
    await page.waitForFunction(() => document.body.textContent.includes('Kegagalan QA; silakan coba lagi.'));
    assert.equal(downloads, before);
    const downloaded = new Promise(resolve => client.once('Browser.downloadWillBegin', resolve));
    await clickText(label);
    await downloaded;
    assert.equal(attempts[endpoint], 2);
    assert.equal(downloads, before + 1);
  }

  for (const [id, endpoint] of [['permohonan-eksekusi-pn', 'generate-permohonan-pn'], ['permohonan-akte-grosse', 'generate-akta-grosse'], ['mou-transaksi', 'generate-MOU']]) {
    await open(id);
    if (id === 'permohonan-eksekusi-pn') {
      await clickText('Generate Surat');
      assert.equal(attempts[endpoint] || 0, 0);
      await page.waitForSelector('[aria-invalid="true"]');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'surat-kota');
      fs.writeFileSync('/tmp/kosku-surat-qa/ktp.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
      await (await page.$('#scan-pemohon')).uploadFile('/tmp/kosku-surat-qa/ktp.png');
      await page.waitForFunction(() => document.querySelector('#surat-nama_pemohon').value === 'HASIL OCR QA');
    }
    await fillVisible();
    if (id === 'permohonan-eksekusi-pn') {
      await page.setViewport({ width: 390, height: 844 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.screenshot({ path: '/tmp/kosku-surat-qa/pn-mobile.png' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.body.textContent.includes('Tutup form dan hapus isian'));
      await clickText('Lanjut mengisi');
      await page.setViewport({ width: 1365, height: 1000 });
    }
    await recoverAndDownload(endpoint, 'Generate Surat');
  }

  await open('invoice-solusindo');
  await clickText('Pilih Transaksi');
  await clickText('ALAMAT ASET QA');
  await fillVisible();
  await recoverAndDownload('generate-invoice', 'Generate Invoice');

  await open('kuitansi-solusindo');
  await clickText('INVOICE-QA-SURAT');
  await recoverAndDownload('generate-kuitansi', 'Generate Kuitansi');

  await open('tanda-terima-dokumen');
  await clickText('atau isi manual tanpa scan');
  await fillVisible();
  await clickText('Lanjut');
  await fillVisible();
  await clickText('Lanjut');
  await fillVisible();
  await recoverAndDownload('generate-tanda-terima', 'Generate PDF');

  await open('akta-kesepakatan-bersama');
  for (let step = 0; step < 3; step++) {
    await fillVisible();
    if (step === 2) { await clickText('Pilih tanggal'); await clickText('Hari ini'); }
    await clickText('Lanjut');
  }
  await recoverAndDownload('generate-akta-kesepakatan', 'Generate PDF Sekarang');

  await open('debitur-care');
  for (let step = 0; step < 2; step++) {
    await fillVisible();
    if (step === 1) { await clickText('Pilih jenis sertifikat'); await clickText('SHM'); }
    await clickText('Lanjut');
  }
  await recoverAndDownload('generate-debitur-care', 'Buat Surat & Unduh PDF');

  // PN has no database mutation: also exercise the genuine authenticated HTTP
  // handler and LibreOffice through the browser after the isolated UI matrix.
  realPn = true;
  await open('permohonan-eksekusi-pn');
  await fillVisible();
  const realDownload = new Promise(resolve => client.once('Browser.downloadWillBegin', resolve));
  await clickText('Generate Surat');
  let deadline;
  try {
    await Promise.race([realDownload, new Promise((_, reject) => { deadline = setTimeout(() => reject(Error('Actual PN download timed out')), 60000); })]);
  } finally { clearTimeout(deadline); }

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, attempts, downloads, realPn: true, mobile: true, keyboard: true, validation: true, ocrMapping: true, failureRecovery: true, persistentWrites: 0 }));
} catch (error) {
  console.error('Browser QA stage:', stage);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: '/tmp/kosku-surat-qa/browser-failure.png', fullPage: true }).catch(() => {});
    fs.writeFileSync('/tmp/kosku-surat-qa/browser-dom.txt', await page.evaluate(() => document.body.innerText).catch(() => ''));
    console.error(await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height).map(b => ({ text: b.textContent.trim(), disabled: b.disabled }))));
  }
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
