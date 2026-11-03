// node scripts/test-lelang-poster.cjs [--browser]
// Fixtures only: no database, external requests, or changes to property data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

const root = resolve(__dirname, '..');
function loadTs(file, stubs = {}) {
  const source = ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.deepEqual(source.diagnostics, []);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source.outputText)(
    name => stubs[name] || require(name), mod, mod.exports,
  );
  return mod.exports;
}

const { buildLelangPosterPayload: build } = loadTs('src/lib/lelangPoster.ts', {
  '@/lib/poster/downloadPoster': {},
});
const property = {
  id_property: '123', slug: 'aset-lelang', judul: 'Aset lelang Kota Bekasi',
  alamat_lengkap: 'Jl. HM Joyo Martono No. 1, Margahayu, Bekasi Timur, Kota Bekasi, Jawa Barat.',
  kota: 'Kota Bekasi', luas_tanah: 360, legalitas: 'SHM', nomor_legalitas: '1405',
  nilai_limit_lelang: 200000000, harga: 9000000000, uang_jaminan: 20000000,
  tanggal_lelang: '2026-10-27T10:00:00.000Z', foto_list: [],
};
const event = (id, date, price, extra = {}) => ({
  id_property: id, tanggal_lelang: date, harga_efektif: price,
  cakupan: 'SAMA', is_current: id === property.id_property, ...extra,
});
const current = event('123', property.tanggal_lelang, property.nilai_limit_lelang);
const first = event('100', '2025-01-01T10:00:00.000Z', 1000000000);
const history = items => ({ ok: true, items });
const options = {
  origin: 'https://solusindoaset.com', agentCode: 'AG001',
  selfAgent: { nama: 'Agent Contoh', whatsapp: '6281234567890' },
  riwayatLelang: history([first, current]),
};

async function render(payload) {
  let captured;
  const route = loadTs('src/app/api/poster/lelang/route.ts', {
    '@/lib/server/posterRender': { renderStoryPoster: async (html, prepare) => {
      captured = { html, prepare };
      return Buffer.from('jpeg-fixture');
    } },
  });
  const response = await route.POST({ json: async () => payload });
  return { ...captured, response };
}

test('land area has its own card data, certificate numbers are omitted, and agent attribution is retained', () => {
  const payload = build({ ...property, luas_tanah: '12345.5', luas_bangunan: 240 }, options);
  assert.equal(payload.alamat, property.alamat_lengkap);
  assert.equal(payload.luasTanah, '12.345,5 m²');
  assert.equal(payload.luasTanahTerbilang, 'dua belas ribu tiga ratus empat puluh lima koma lima meter persegi');
  assert.equal(payload.luasBangunan, '240 m²');
  assert.equal(payload.legalMain, 'SHM');
  assert.equal(payload.legalSub, 'Sertifikat Hak Milik');
  assert.equal(payload.contactNum, '0812-3456-7890');
  assert.equal(payload.agentName, 'Agent Contoh');
  assert.equal(payload.qrUrl, 'https://solusindoaset.com/Lelang/aset-lelang-123/AG001');
  for (const value of [null, 0, -1, Infinity, 'invalid']) {
    assert.equal(build({ ...property, luas_tanah: value }).luasTanah, 'Belum tersedia');
    assert.equal(build({ ...property, luas_tanah: value }).luasTanahTerbilang, null);
  }
  for (const [area, words] of [
    [1000, 'seribu meter persegi'],
    [360, 'tiga ratus enam puluh meter persegi'],
    [100.05, 'seratus koma nol lima meter persegi'],
    [999.999, 'seribu meter persegi'],
  ]) {
    assert.equal(build({ ...property, luas_tanah: area }).luasTanahTerbilang, words);
  }
});

test('discount uses the first recorded auction of exactly the same fields, regardless of history order', () => {
  const items = [
    event('102', '2025-06-01T10:00:00Z', 1200000000), current,
    event('103', '2027-01-01T10:00:00Z', 4000000000),
    event('104', property.tanggal_lelang, 3000000000),
    event('105', '2024-01-01T10:00:00Z', 5000000000, { cakupan: 'LEBIH_LUAS' }),
    event('106', '2024-01-02T10:00:00Z', 4000000000, { cakupan: 'SEBAGIAN' }),
    event('107', '2024-01-03T10:00:00Z', 3000000000, { cakupan: 'BERIRISAN' }),
    first,
  ];
  const payload = build(property, { ...options, riwayatLelang: history(items) });
  assert.equal(payload.hargaLelangAwal.replace(/\s/g, ' '), 'Rp 1.000.000.000');
  assert.equal(payload.hargaLimit.replace(/\s/g, ' '), 'Rp 200.000.000');
  assert.equal(payload.diskonPct, 80);
  assert.equal(payload.hematNominal.replace(/\s/g, ' '), 'Rp 800.000.000');
});

test('missing, failed, unrelated, undated and non-discounted history never produces a discount', () => {
  for (const riwayatLelang of [
    undefined, null, { ok: false, items: [first, current] }, history([]), history([current]),
    history([first]), history([first, { ...current, id_property: 'unrelated' }]),
    history([{ ...first, tanggal_lelang: null }, current]),
    history([{ ...first, tanggal_lelang: 'invalid' }, current]),
    history([{ ...first, harga_efektif: null }, current]),
    history([{ ...first, harga_efektif: Infinity }, current]),
    history([{ ...first, harga_efektif: 200000000 }, current]),
    history([{ ...first, harga_efektif: 100000000 }, current]),
  ]) {
    const payload = build(property, { ...options, riwayatLelang });
    assert.equal(payload.hargaLelangAwal, null);
    assert.equal(payload.diskonPct, null);
    assert.equal(payload.hematNominal, null);
  }
  const undated = build({ ...property, tanggal_lelang: null }, {
    ...options, riwayatLelang: history([first, { ...current, tanggal_lelang: null }]),
  });
  assert.equal(undated.diskonPct, null);
  const nearlyFree = build({ ...property, nilai_limit_lelang: 1 }, options);
  assert.equal(nearlyFree.diskonPct, 99.9);
});

test('poster endpoint renders struck-through first price and a separate percentage badge, and escapes text', async () => {
  const payload = build({ ...property, judul: '<script>alert(1)</script>', luas_bangunan: 240 }, options);
  const { html, response } = await render(payload);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(html, /Luasan Tanah/);
  assert.match(html, /class="land-main">360 m²/);
  assert.match(html, /class="land-words">tiga ratus enam puluh meter persegi/);
  assert.match(html, /Luas bangunan 240 m²/);
  assert.match(html, /class="legal-main">SHM<\/div>/);
  assert.match(html, /class="ticket-compare-price">Rp\s1\.000\.000\.000<\/s>/);
  assert.match(html, /class="ticket-discount-value">80%/);
  assert.match(html, /class="ticket-saving">Lebih hemat Rp\s800\.000\.000/);
  assert.match(html, /class="ticket-price-amount">200\.000\.000/);
  assert.match(html, /class="ticket-compare-label">Harga pasaran/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /\{\{|Tanggal Lelang|addr-specs|No\. 1405|Limit lelang sekarang|Limit lelang pertama|<script>/);
  const withoutDiscount = await render(build(property));
  assert.doesNotMatch(withoutDiscount.html, /class="ticket-discount"|class="ticket-compare"|class="ticket-saving"/);
  const invalidDiscount = await render({ ...payload, diskonPct: 100 });
  assert.doesNotMatch(invalidDiscount.html, /class="ticket-discount"|class="ticket-compare"/);
});

test('successive downloads use template edits without restarting the server', async () => {
  let reads = 0;
  const rendered = [];
  const route = loadTs('src/app/api/poster/lelang/route.ts', {
    'fs/promises': { readFile: async () => `${++reads}:{{HERO_TITLE}}` },
    '@/lib/server/posterRender': { renderStoryPoster: async html => {
      rendered.push(html);
      return Buffer.from('jpeg-fixture');
    } },
  });
  const request = { json: async () => build(property, options) };
  assert.equal((await route.POST(request)).status, 200);
  assert.equal((await route.POST(request)).status, 200);
  assert.deepEqual(rendered, ['1:Aset lelang Kota Bekasi', '2:Aset lelang Kota Bekasi']);
});

test('Chromium renders the poster without overlap at story and mobile viewing sizes',
  { skip: !process.argv.includes('--browser'), timeout: 60000 }, async () => {
  const browser = await require('puppeteer').launch({ headless: true });
  try {
    for (const scenario of [
      { name: 'discount', payload: build(property, options) },
      { name: 'no-history', payload: build(property) },
      { name: 'large-values', payload: build({ ...property, nilai_limit_lelang: 200000000000, luas_tanah: 1234567.89 }, {
        ...options, riwayatLelang: history([{ ...first, harga_efektif: 1000000000000 }, current]),
      }) },
      { name: 'missing-area', payload: build({ ...property, luas_tanah: null, luas_bangunan: null }) },
      { name: 'screenshot-prices', payload: build({
        ...property, nilai_limit_lelang: 3938814000, uang_jaminan: 1500000000, luas_tanah: 1000,
      }, { ...options, riwayatLelang: history([{ ...first, harga_efektif: 5626877000 }, current]) }) },
      { name: 'long-address', payload: build({
        ...property,
        judul: '1 bidang tanah dengan total luas 360 m² berikut bangunan di Kota Bekasi',
        alamat_lengkap: 'Kelurahan Margahayu (dh. Desa Margahayu), Kecamatan Bekasi Timur (dh. Kec. Bekasi), Kota Bekasi (dh. Kab. Bekasi), Provinsi Jawa Barat. Setempat dikenal Jl. HM Joyo Martono No.1, RT.003 RW.21, Kelurahan Margahayu (dh. Desa Margahayu), Kecamatan Bekasi Timur (dh. Kec. Bekasi), Kota Bekasi (dh. Kab. Bekasi), Provinsi Jawa Barat.',
      }, options) },
    ]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
      await page.setRequestInterception(true);
      page.on('request', request => request.url().startsWith('data:') ? request.continue() : request.abort());
      const { html, prepare } = await render(scenario.payload);
      await page.setContent(html, { waitUntil: 'load' });
      await prepare(page);
      const layout = await page.evaluate(() => {
        const rect = selector => {
          const { left, right, top, bottom } = document.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom };
        };
        const price = document.querySelector('.ticket-price');
        const area = document.querySelector('.land-main');
        return {
          price: rect('.ticket-price'), badge: document.querySelector('.ticket-discount') && rect('.ticket-discount'),
          firstPrice: document.querySelector('.ticket-compare-price') && rect('.ticket-compare-price'),
          priceSize: parseFloat(getComputedStyle(price).fontSize),
          firstPriceSize: document.querySelector('.ticket-compare-price') &&
            parseFloat(getComputedStyle(document.querySelector('.ticket-compare-price')).fontSize),
          firstPriceFits: !document.querySelector('.ticket-compare-price') ||
            document.querySelector('.ticket-compare-price').scrollWidth <= document.querySelector('.ticket-compare-price').clientWidth,
          stub: rect('.ticket-stub'), ticket: rect('.ticket'), footer: rect('.footer'), card: rect('.card'),
          addressText: document.querySelector('.address-card').innerText,
          priceFits: price.scrollWidth <= price.clientWidth,
          areaFits: area.scrollWidth <= area.clientWidth,
        };
      });
      assert.equal(layout.priceFits, true, `${scenario.name}: price overflow`);
      assert.equal(layout.areaFits, true, `${scenario.name}: land area overflow`);
      assert.equal(layout.firstPriceFits, true, `${scenario.name}: first price overflow`);
      assert.equal(layout.price.right <= layout.stub.left, true);
      if (layout.badge) {
        assert.equal(layout.firstPrice.right <= layout.badge.left, true);
        assert.equal(layout.badge.bottom <= layout.price.top, true);
      }
      assert.equal(layout.ticket.bottom <= layout.footer.top, true);
      assert.equal(layout.footer.bottom <= layout.card.bottom, true);
      assert.doesNotMatch(layout.addressText, /Luas|m²/);
      if (scenario.name === 'discount') {
        await page.screenshot({ path: '/private/tmp/kosku-poster-lelang-preview.png' });
        await page.setViewport({ width: 390, height: 844 });
        await page.addStyleTag({ content: '.story-frame { transform: scale(.361111); transform-origin: top left; }' });
        await page.screenshot({ path: '/private/tmp/kosku-poster-lelang-mobile.png' });
      }
      if (scenario.name === 'screenshot-prices') {
        assert.equal(layout.firstPriceSize >= 18, true, 'first price remains prominent');
        assert.equal(layout.priceSize >= 32, true, 'current price remains the headline');
        const pricePanel = await page.$('.ticket');
        await pricePanel.screenshot({ path: '/private/tmp/kosku-poster-lelang-redesign.png' });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
