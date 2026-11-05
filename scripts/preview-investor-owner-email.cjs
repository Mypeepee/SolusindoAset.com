/** Local artifact only. This script has no send mode and never contacts SMTP. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const createLoader = require('./lib/marketing-test-loader.cjs');
const fixtureFeed = require('./fixtures/investor-feed.cjs');
const load = createLoader({ '@/lib/prisma': {}, '@/lib/investor-read.server': {}, '@/lib/investor-cma-legacy.server': {} });

async function main() {
  const { qualifiesForOwnerAlert } = load('src/lib/investor-owner-alerts.ts');
  const { ownerAlertEmailOptions } = load('src/lib/investor-owner-alerts.server.ts');
  const { investorOwnerEmail } = load('src/lib/mailer.ts');
  const examples = fixtureFeed(new URLSearchParams()).items.filter((item) => qualifiesForOwnerAlert(item, new Date('2026-11-06T12:00:00+07:00'))).slice(0, 3);
  assert.ok(examples.length);
  const options = ownerAlertEmailOptions('Owner', examples, new Map());
  const photo = 'data:image/jpeg;base64,' + (await fs.readFile(path.resolve('public/images/hero/balongsari.jpeg'))).toString('base64');
  for (const item of options.aset) item.gambar = photo;
  const email = investorOwnerEmail(options);
  const logo = 'data:image/png;base64,' + (await fs.readFile(path.resolve('public/images/logo/LogoSolusindoPremier.png'))).toString('base64');
  const html = email.html.replace('INVESTOR · NOTIFIKASI OWNER', 'PRATINJAU · DATA CONTOH').replace(/https:\/\/[^"\s]+\/images\/logo\/LogoSolusindoPremier\.png/g, logo);
  const output = path.resolve('.runtime/investor-owner-alerts');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'email-preview.html'), html);
  await fs.writeFile(path.join(output, 'email-preview.txt'), 'PRATINJAU · DATA CONTOH\n\n' + email.text);
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.INVESTOR_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setOfflineMode(true);
    for (const width of [320, 390, 800]) {
      await page.setViewport({ width, height: 1000 });
      await page.setContent(html, { waitUntil: 'load' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Email overflow at ${width}px`);
      assert.equal(await page.$$eval('a', (links) => links.filter((link) => link.textContent.includes('Lihat Detail')).length), examples.length);
      await page.screenshot({ path: path.join(output, `email-preview-${width}.png`), fullPage: true });
    }
  } finally { await browser.close(); }
  console.log(`Email preview passed: 320/390/800px, same client-property cards, no overflow. No email sent. ${output}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
