// Local financial regressions. Add --browser to exercise the actual cost button,
// sheet, copy and WhatsApp-share actions in desktop/mobile Chromium. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const root = resolve(__dirname, '..');
const policyPath = 'backend/whatsapp/services/auction_cost_policy.js';
const websitePath = 'src/lib/lelangBiaya.ts';
const sidebarPath = 'src/app/Lelang/[slugId]/[agentId]/components/KeperluanAgent.tsx';
const sheetPath = 'src/app/Lelang/[slugId]/[agentId]/components/RincianBiayaSheet.tsx';
const website = require(resolve(root, websitePath));
const { auctionCostEstimate, purchaseCostReply } = require(resolve(root, 'backend/whatsapp/services/property_costs.js'));
const { mouCostFields } = require(resolve(root, 'src/lib/server/mouCostFields.mjs'));
const property = { id: '121790', transaction_type: 'LELANG', category: 'GUDANG', limit_price: 3043000000,
  full_address: 'Jl. Kedungmundu Raya No. 173, Sendangguwo, Tembalang, Kota Semarang, Jawa Tengah',
  address: { province: 'Jawa Tengah', city: 'Kota Semarang' }, specifications: { land_area_m2: 306 },
  publication: { status: 'TERSEDIA' } };

test('Semarang has one worst-case total shared by website, WhatsApp and MOU', () => {
  const cost = website.hitungBiayaLelang({ limit: property.limit_price, provinsi: 'Jawa Tengah', luasTanah: 306 });
  assert.equal(cost.balikNama.subtotal, 268655000);
  assert.equal(cost.eksekusi.subtotal, 384800000);
  assert.equal(cost.feeAgent.subtotal, 152150000);
  assert.equal(cost.totalBiaya, 805605000);
  assert.equal(cost.totalModal, 3848605000);
  assert.equal(auctionCostEstimate(property).total_execution, cost.totalModal);
  assert.equal(mouCostFields({ limit: property.limit_price, province: 'Jawa Tengah', landArea: 306 }).estimasi_modal_eksekusi, '3.848.605.000');
  assert.equal('mediasi' in cost, false); assert.equal('totalModalMediasi' in cost, false);
  for (const message of [website.formatPesanBiayaLelang(cost), purchaseCostReply(property, 'rincian biaya')]) {
    const plain = message.replace(/\u00a0/g, ' ');
    assert.match(plain, /Rp 384\.800\.000/); assert.match(plain, /Rp 3\.848\.605\.000/);
    assert.equal((plain.match(/ESTIMASI MODAL/g) || []).length, 1);
    assert.doesNotMatch(plain, /mediasi|kerohiman|Opsi [12]|3\.563\.805\.000/i);
  }
});

test('execution bands, region, transport and attorney costs remain asset-specific', () => {
  for (const [price, province, execution] of [[499999999, 'Jawa Timur', 125000000],
    [500000000, 'Jawa Timur', 150000000], [2500000000, 'Jawa Tengah', 350000000],
    [5000000000, 'Jawa Tengah', 675000000], [10000000000, 'Jawa Timur', 650000000]]) {
    const result = website.hitungBiayaLelang({ limit: price, provinsi: province, luasTanah: 306 });
    assert.equal(result.eksekusi.komponen[0].nominal, execution);
    const expected = price + result.balikNama.subtotal + result.eksekusi.subtotal + result.feeAgent.subtotal;
    assert.equal(result.totalModal, expected);
  }
  const larger = website.hitungBiayaLelang({ limit: 6000000000, provinsi: 'Jawa Tengah', luasTanah: 720, luasBangunan: 400 });
  assert.equal(larger.eksekusi.komponen.find(row => row.kode === 'armada').nominal, 20400000);
  assert.equal(larger.eksekusi.komponen.find(row => row.kode === 'fee_advokat').nominal, 50000000);
  assert.equal(larger.luasTempatPerpindahan, 200);
  assert.equal(larger.eksekusi.subtotal, 748400000);
});

test('fractional source prices reconcile after rounding, and guarantees do not increase total capital', () => {
  const asset = { ...property, limit_price: 417128521.13, address: { province: 'Jawa Timur' } };
  const cost = website.hitungBiayaLelang({ limit: asset.limit_price, provinsi: 'Jawa Timur' });
  assert.equal(cost.totalModal, 643240871);
  assert.equal(auctionCostEstimate(asset).total_execution, cost.totalModal);
  assert.equal(auctionCostEstimate({ ...asset, deposit: 100000000 }).total_execution, cost.totalModal);
});

test('desktop/mobile cost button opens one worst-case estimate; copy and share match',
  { skip: !process.argv.includes('--browser'), timeout: 60000 }, async () => {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const modules = Object.fromEntries([policyPath, websitePath, sidebarPath, sheetPath].map(file => [file,
      ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), { fileName: file, compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      } }).outputText]));
    const css = await require('postcss')([require('tailwindcss')({ content: [
      { raw: readFileSync(resolve(root, sidebarPath), 'utf8') + readFileSync(resolve(root, sheetPath), 'utf8'), extension: 'tsx' },
    ], corePlugins: { preflight: true } })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage(); await page.setViewport(viewport);
      await page.setRequestInterception(true);
      page.on('request', req => req.abort());
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<html lang="id"><body style="background:#080B14"><div id="root"></div></body></html>');
      await page.addStyleTag({ content: css.css });
      await page.addScriptTag({ path: resolve(root, 'node_modules/react/umd/react.development.js') });
      await page.addScriptTag({ path: resolve(root, 'node_modules/react-dom/umd/react-dom.development.js') });
      await page.evaluate(({ modules, policyPath, websitePath, sidebarPath, sheetPath, property }) => {
        const react = window.React;
        const modulesLoaded = new Map();
        const jsx = (type, props, key) => react.createElement(type, { ...props, key });
        const stubs = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: react.Fragment },
          '@iconify/react': { Icon: props => react.createElement('span', { 'aria-hidden': true, className: props.className }) },
          sonner: { toast: { success() {}, error() {} } }, 'next/link': props => react.createElement('a', props),
          '@/lib/lelangPoster': {}, '@/lib/site': { SITE_URL: 'https://solusindoaset.com' }, '@/lib/whatsapp': {} };
        const aliases = { '@/lib/lelangBiaya': websitePath, './RincianBiayaSheet': sheetPath,
          '../../backend/whatsapp/services/auction_cost_policy.js': policyPath };
        function load(name) {
          if (stubs[name]) return stubs[name];
          const path = aliases[name] || name;
          if (modulesLoaded.has(path)) return modulesLoaded.get(path).exports;
          if (!modules[path]) throw Error(`Missing fixture module ${path}`);
          const mod = { exports: {} }; modulesLoaded.set(path, mod);
          new Function('require', 'module', 'exports', modules[path])(load, mod, mod.exports);
          return mod.exports;
        }
        window.open = url => { window.sharedUrl = url; };
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async text => { window.copiedCosts = text; } } });
        window.ReactDOM.createRoot(document.getElementById('root')).render(react.createElement(load(sidebarPath).default, {
          data: { id_property: property.id, nilai_limit_lelang: property.limit_price, luas_tanah: 306,
            provinsi: 'Jawa Tengah', kota: 'Kota Semarang', alamat_lengkap: property.full_address, status_tayang: 'TERSEDIA' },
        }));
      }, { modules, policyPath, websitePath, sidebarPath, sheetPath, property });
      await page.waitForSelector('button[aria-label="Lihat rincian estimasi biaya"]');
      const triggers = await page.$$('button[aria-label="Lihat rincian estimasi biaya"]');
      let opened = false;
      for (const trigger of triggers) if (await trigger.boundingBox()) { await trigger.click(); opened = true; break; }
      assert.equal(opened, true);
      await page.waitForSelector('[role="dialog"]');
      await page.waitForFunction(() => {
        const panel = document.querySelector('[role="dialog"] > div.relative');
        return panel && Number(getComputedStyle(panel).opacity) === 1;
      });
      const text = await page.$eval('[role="dialog"]', node => node.innerText.replace(/\u00a0/g, ' '));
      assert.match(text, /Rp 384\.800\.000/); assert.match(text, /Rp 3\.848\.605\.000/);
      assert.doesNotMatch(text, /mediasi|kerohiman|3\.563\.805\.000/i);
      await page.evaluate(() => [...document.querySelectorAll('button')].find(node => node.textContent.includes('Salin untuk Klien')).click());
      const copied = await page.evaluate(() => window.copiedCosts);
      assert.match(copied, /3\.848\.605\.000/); assert.doesNotMatch(copied, /mediasi|kerohiman/i);
      await page.click('button[aria-label="Kirim rincian lewat WhatsApp"]');
      const shared = await page.evaluate(() => window.sharedUrl);
      assert.equal(new URL(shared).searchParams.get('text'), copied);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/private/tmp/Rincian_Biaya_Worst_Case_${viewport.width}.png` });
      await page.click('button[aria-label="Tutup rincian biaya"]');
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      await page.close();
    }
  } finally { await browser.close(); }
});
