// Read-only browser QA against the real CRM response; blocks all writes.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.CLIENT_DISCOUNT_QA_ORIGIN || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const clientId = process.env.CLIENT_DISCOUNT_QA_ID || "KL00050";
const db = new PrismaClient();
let browser;
let page;
try {
  const client = await db.klien.findUnique({ where: { id_klien: clientId }, select: { id_agent: true } });
  assert.ok(client);
  const agent = await db.agent.findUnique({ where: { id_agent: client.id_agent }, select: { id_pengguna: true, jabatan: true } });
  assert.ok(agent);
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: {
    id: agent.id_pengguna, sub: agent.id_pengguna, peran: "AGENT", role: "AGENT",
    jabatan: agent.jabatan, agentId: client.id_agent, _refreshedAt: Date.now(),
  } });
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setCookie({ name: "next-auth.session-token", value: token, url: origin, httpOnly: true });
  if (process.env.NEXTAUTH_URL?.startsWith("https:")) {
    await page.setCookie({ name: "__Secure-next-auth.session-token", value: token, url: origin, secure: true, httpOnly: true });
  }
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      void request.respond({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Read-only QA" }) });
    } else void request.continue();
  });
  await page.setViewport({ width: 1365, height: 1000 });
  const responsePromise = page.waitForResponse(response => response.url().includes(`/klien/${clientId}/rekomendasi/siap`));
  await page.goto(origin + `/dashboard/crm?klien=${encodeURIComponent(clientId)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const data = await response.json();
  const expected = data.items.filter(item => item.diskon && Object.values(item.diskon).some(value => value !== null)).map(item => {
    const formatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
    return [item.diskon.kelurahan, item.diskon.turunLelang].filter(value => value !== null).map(value => formatter.format(value) + "%");
  });
  assert.ok(expected.length > 0, "Requires real eligible listings with a discount preference");
  const selector = 'dl[aria-label="Diskon aset sesuai preferensi"]';
  await page.waitForFunction((selector, count) => document.querySelectorAll(selector).length === count, {}, selector, expected.length);
  const values = await page.$$eval(selector, nodes => nodes.map(node => [...node.querySelectorAll("dd")].map(value => value.textContent)));
  assert.deepEqual(values, expected);
  await page.screenshot({ path: "/tmp/kosku-discount-cards-desktop.png" });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  for (const width of [390, 320]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await page.$$eval(selector, nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      const card = node.closest(".group");
      const overflow = [...card.querySelectorAll("p,span,button,a,dl,dt,dd")].some(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < 0 || rect.right > innerWidth + 1);
      });
      return { left: box.left, right: box.right, width: innerWidth, fits: node.scrollWidth <= node.clientWidth, overflow };
    }));
    assert.ok(bounds.every(box => box.left >= 0 && box.right <= box.width && box.fits && !box.overflow), JSON.stringify(bounds));
    await page.screenshot({ path: width === 390 ? "/tmp/kosku-discount-cards-mobile.png" : "/tmp/kosku-discount-cards-320.png" });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, clientId, cards: expected.length, canonicalValues: true, desktop: true, mobile: [390, 320], reducedMotion: true, writes: 0 }));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: "/tmp/kosku-discount-cards-failure.png" }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
