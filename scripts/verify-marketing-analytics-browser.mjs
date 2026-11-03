// Authenticated read-only endpoint checks. UI samples are intercepted browser fixtures;
// no publication, provider request, saved setting, or database mutation is dispatched.
import assert from "node:assert/strict";
import fs from "node:fs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
import createLoader from "./lib/marketing-test-loader.cjs";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3034";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const db = new PrismaClient();
const { DEFAULT_CONFIG, EMPTY_METRICS } = createLoader()("src/lib/marketing/domain.ts");
const month = "2026-10";
const fetchedAt = "2026-11-02T02:00:00.000Z";
const fixturePosts = Array.from({ length: 24 }, (_, i) => ({
  id: `analytics-qa-${i}`, jobId: `analytics-job-${i}`, channel: "instagram", publishedAt: `2026-10-${String(i + 1).padStart(2, "0")}T02:00:00Z`, lastSyncedAt: fetchedAt,
  permalink: "https://www.instagram.com/p/example/", errorCode: i === 23 ? "MEDIA_DELETED" : null, metricReason: i === 22 ? "METRICS_UNAVAILABLE" : null,
  asset: { id: `asset-${i}`, assetKey: `asset:${i}`, propertyType: i % 3 === 0 ? "Ruko" : "Rumah", city: i % 4 === 0 ? "Sidoarjo" : "Surabaya", address: i === 0 ? "=Rumus pengujian CSV" : `Properti pengujian ${i + 1}, alamat untuk uji tampilan panjang di kawasan Surabaya Barat`, price: (i % 3 + 1) * 450e6, landArea: (i % 3 + 1) * 90 },
  values: { ...EMPTY_METRICS, views: i === 22 ? null : 900 + i * 170, likes: i === 22 ? null : i === 0 ? 0 : 32 + i * 4, comments: i === 22 ? null : 2 + (i % 6) * 7, saved: i === 22 ? null : 8 + i, shares: i === 22 ? null : 2 + i, reach: i === 22 ? null : 700 + i * 120 },
}));
fixturePosts.push({ ...fixturePosts[0], id: "wa-qa", channel: "whatsapp", values: { ...EMPTY_METRICS, views: 40, reactions: 3, replies: 2 } });
const seed = { config: { ...DEFAULT_CONFIG, companyName: "Data pengujian Analitik" },
  connection: { instagram: { connected: true, configured: true, username: "akun_pengujian", setup: { checks: [], origin: "" } }, whatsapp: { connected: false, tested: false, phone: null, contacts: [] } },
  jobs: { items: [], total: 0, page: 1, pageSize: 20 }, planner: { month, jobs: [], now: fetchedAt, campaignPeriods: [], pendingCampaigns: [] },
  summary: { nextSlot: null, lastTickAt: null, lastError: null, published: [], needsReview: 0 } };
let browser, page;
let stage = "auth";
const errors = [], reads = [], checks = [];
try {
  const owner = await db.agent.findFirstOrThrow({ where: { jabatan: "OWNER", status_keanggotaan: "AKTIF", pengguna: { status_akun: "AKTIF", peran: "AGENT" } }, select: { id_pengguna: true } });
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: owner.id_pengguna, sub: owner.id_pengguna, peran: "AGENT", role: "AGENT", jabatan: "OWNER", _refreshedAt: Date.now() } });
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:") ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  stage = "real-endpoint";
  const response = await fetch(origin + "/api/dashboard/pemasaran?mode=analytics&month=" + month, { headers: { Cookie: `${cookieName}=${token}` } });
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private.*no-store/);
  const actual = await response.json(); assert.equal(actual.month, month); assert.ok(Array.isArray(actual.posts));
  assert.equal((await fetch(origin + "/api/dashboard/pemasaran?mode=analytics&month=" + month)).status, 401);
  assert.equal((await fetch(origin + "/api/dashboard/pemasaran?mode=analytics&month=invalid", { headers: { Cookie: `${cookieName}=${token}` } })).status, 400);
  checks.push("authenticated/private read, unauthenticated rejection, invalid month rejection");
  browser = await puppeteer.launch({ headless: true, protocolTimeout: 180000, executablePath: process.env.MARKETING_QA_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
  page = await browser.newPage(); page.setDefaultTimeout(90000); page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setCookie({ name: cookieName, value: token, url: origin, secure: cookieName.startsWith("__Secure-"), httpOnly: true });
  let scenario = "populated", failOnce = false, delayedMonth = null;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin && !["data:", "blob:"].includes(url.protocol)) return request.abort();
    const json = (body, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/dashboard/pemasaran") {
      const mode = url.searchParams.get("mode"), selected = url.searchParams.get("month") || month;
      if (request.method() !== "GET") return json({ error: "QA_WRITE_BLOCKED" }, 403);
      if (mode === "analytics") {
        reads.push(selected);
        if (failOnce) { failOnce = false; return json({ error: "SERVICE_UNAVAILABLE" }, 503); }
        const payload = { month: selected, historyStart: "2026-08", fetchedAt, posts: scenario === "empty" || selected !== month ? [] : fixturePosts };
        if (delayedMonth === selected) { delayedMonth = null; setTimeout(() => void json(payload).catch(() => {}), 600); return; }
        return json(payload);
      }
      if (mode === "planner") return json({ ...seed.planner, month: selected });
      if (mode === "comments") return json({ items: [{ id: "comment-qa", username: "pengujian", text: "Komentar pengujian, tanpa pengiriman ke Instagram.", timestamp: fetchedAt }], after: null });
      return json(seed);
    }
    if (url.pathname.startsWith("/api/dashboard/pemasaran/media")) return request.respond({ status: 404, body: "" });
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) return json({ items: [], total: 0 });
    return request.continue();
  });
  const click = async (label, scope = ".marketing-analytics-workspace") => {
    await page.waitForFunction(({ label, scope }) => [...(document.querySelector(scope)?.querySelectorAll("button") || [])].some(button => (button.textContent.trim() === label || button.getAttribute("aria-label") === label) && !button.disabled && button.getClientRects().length), {}, { label, scope });
    await page.evaluate(({ label, scope }) => { const button = [...document.querySelector(scope).querySelectorAll("button")].find((b) => b.textContent.trim() === label || b.getAttribute("aria-label") === label); if (!button) throw new Error("Missing button " + label); button.click(); }, { label, scope });
  };
  const capture = async (path) => {
    await page.waitForFunction(() => [...document.querySelectorAll(".analytics-panel")].filter(node => {
      const rect = node.getBoundingClientRect(); return rect.top < innerHeight && rect.bottom > 80;
    }).every(node => Number(getComputedStyle(node).opacity) >= .99));
    await page.screenshot({ path, fullPage: false });
  };
  const navigate = async (query = "") => {
    await page.goto(origin + `/dashboard/pemasaran?tab=analitik&month=${month}` + query, { waitUntil: "networkidle2" });
    await page.waitForSelector(".analytics-content"); await page.evaluate(() => document.fonts.ready);
  };
  stage = "populated";
  await page.setViewport({ width: 1512, height: 1200 }); await navigate();
  assert.match(await page.$eval(".analytics-kpis", e => e.textContent), /24/);
  assert.equal(await page.$$eval(".analytics-table tbody tr:not(.analytics-detail-row)", e => e.length), 10);
  assert.match(await page.$eval(".analytics-forecast", e => e.textContent), /Kisaran views/);
  await capture("docs/previews/analytics-desktop.png");
  await page.evaluate(() => document.querySelector(".analytics-insights-grid").scrollIntoView({ block: "start" }));
  await capture("docs/previews/analytics-insights.png");
  await page.evaluate(() => document.querySelector(".analytics-posts").scrollIntoView({ block: "start" }));
  await capture("docs/previews/analytics-posts.png");
  stage = "sort-popup";
  await page.click('[aria-label="Urutkan performa posting"]'); await page.waitForSelector('[role="listbox"]');
  const popup = await page.evaluate(() => { const t = document.querySelector('[aria-label="Urutkan performa posting"]'), p = document.querySelector('[role="listbox"]'); return { trigger: t.getBoundingClientRect().width, popup: p.getBoundingClientRect().width }; });
  assert.ok(Math.abs(popup.trigger - popup.popup) <= 1, JSON.stringify(popup));
  await page.keyboard.press("Home");
  await page.waitForFunction(() => document.activeElement?.textContent.includes("Views tertinggi"));
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.textContent.includes("Like terbanyak"));
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.textContent.includes("Komentar terbanyak"));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("analyticsSort") === "comments");
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  await page.evaluate(() => document.querySelector('[aria-label="Tanggal pada grafik performa"]').scrollIntoView({ block: "center" }));
  await page.focus('[aria-label="Tanggal pada grafik performa"]');
  await page.keyboard.press("Home");
  assert.equal(await page.$eval('[aria-label="Tanggal pada grafik performa"]', node => Number(node.value)), 0);
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.$eval('[aria-label="Tanggal pada grafik performa"]', node => Number(node.value)), 1);
  checks.push("sort keyboard navigation, popup width, URL restoration; chart keyboard date selection");
  stage = "search";
  await page.click('[aria-label="Cari posting"]');
  await page.type('[aria-label="Cari posting"]', "Tidak ditemukan xyz", { delay: 15 });
  await page.waitForFunction(() => document.querySelector(".analytics-posts").textContent.includes("Tidak ada posting yang cocok"));
  await click("Hapus pencarian posting");
  assert.equal(await page.$$eval(".analytics-table tbody tr:not(.analytics-detail-row)", e => e.length), 10);
  await click("Halaman posting berikutnya"); assert.match(page.url(), /analyticsPage=2/);
  checks.push("search/no-results/clear, pagination");
  stage = "detail";
  await page.click(".analytics-post-toggle"); await page.waitForSelector('.analytics-detail-row:not([hidden])');
  assert.match(await page.$eval('.analytics-detail-row:not([hidden])', e => e.textContent), /Disimpan/);
  await click("Komentar", '.analytics-detail-row:not([hidden])'); await page.waitForSelector('[role="dialog"]');
  assert.match(await page.$eval('[role="dialog"]', e => e.textContent), /Komentar pengujian/);
  await page.keyboard.press("Escape");
  checks.push("expand details, saved/share metrics, comments dialog, Escape");
  stage = "refresh-failure";
  failOnce = true; await click("Perbarui data analitik"); await page.waitForSelector(".analytics-error");
  assert.ok(await page.$(".analytics-content")); await click("Coba kembali"); await page.waitForFunction(() => !document.querySelector(".analytics-error"));
  checks.push("refresh failure preserves data and retry recovers");
  stage = "channel";
  await click("Status WhatsApp"); await page.waitForFunction(() => document.querySelector(".analytics-kpis").textContent.includes("Reaksi teramati"));
  assert.match(await page.$eval(".analytics-kpis", e => e.textContent), /40/); assert.match(await page.$eval(".analytics-forecast", e => e.textContent), /Menunggu dasar proyeksi/);
  await click("Instagram");
  checks.push("isolated WhatsApp observed metrics and insufficient forecast");
  stage = "segment";
  await click("Lokasi"); await page.click(".analytics-segment-link"); await page.waitForFunction(() => new URL(location.href).searchParams.has("analyticsSegment"));
  await click("Hapus filter");
  checks.push("audience dimensions and segment-to-post filtering");
  stage = "csv";
  await page.evaluate(() => {
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { window.__analyticsExportBlob = blob; return originalCreate(blob); };
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.startsWith("analitik-")) { window.__analyticsExportName = this.download; return; }
      return originalClick.call(this);
    };
  });
  await click("Ekspor CSV");
  await page.waitForFunction(() => !!window.__analyticsExportBlob && !!window.__analyticsExportName);
  const csv = await page.evaluate(() => window.__analyticsExportBlob.text());
  assert.equal(await page.evaluate(() => window.__analyticsExportName), `analitik-instagram-${month}.csv`);
  assert.match(csv, /'=Rumus pengujian CSV/); assert.equal(csv.trim().split("\r\n").length, 25);
  checks.push("filtered CSV content and filename with spreadsheet formula protection");
  stage = "responsive";
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewport({ width, height: width <= 390 ? 844 : 1100 });
    await page.evaluate(() => document.querySelector(".marketing-analytics-workspace").scrollIntoView({ block: "start" }));
    const sizes = await page.$eval(".marketing-analytics-workspace", e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    assert.ok(sizes.scroll <= sizes.width + 1, `${width}: ${JSON.stringify(sizes)}`);
    await capture(`docs/previews/analytics-${width}.png`);
  }
  await page.evaluate(() => document.querySelector(".analytics-insights-grid").scrollIntoView({ block: "start" }));
  await capture("docs/previews/analytics-insights-320.png");
  await page.click('[aria-label="Jenis properti untuk proyeksi"]');
  await page.waitForSelector('[role="listbox"]');
  const narrowPopup = await page.$eval('[role="listbox"]', node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }));
  assert.ok(narrowPopup.left >= 0 && narrowPopup.right <= 320);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Jenis properti untuk proyeksi");
  await page.evaluate(() => document.querySelector(".analytics-posts").scrollIntoView({ block: "start" }));
  await capture("docs/previews/analytics-posts-320.png");
  checks.push("1512/1024/768/390/320 layouts without analytics horizontal overflow; narrow popup/Escape/focus restoration");
  stage = "empty-reduced-motion";
  scenario = "empty"; await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]); await navigate();
  assert.match(await page.$eval(".analytics-kpis", e => e.textContent), /Belum tersedia/);
  assert.match(await page.$eval(".analytics-posts", e => e.textContent), /Belum ada publikasi/);
  await capture("docs/previews/analytics-empty-320.png");
  checks.push("honest empty state and reduced motion");
  stage = "month-race";
  delayedMonth = "2026-11"; await click("Bulan analitik berikutnya"); await click("Bulan analitik berikutnya");
  await page.waitForFunction(() => document.querySelector(".analytics-period").textContent.includes("Desember"));
  await page.waitForSelector(".analytics-content");
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.match(await page.$eval(".analytics-period", e => e.textContent), /Desember/);
  assert.ok(!await page.$(".analytics-error"));
  checks.push("rapid month changes abort superseded analytics reads");
  assert.deepEqual(errors, []);
  const report = { passed: true, checks, actualEndpointPosts: actual.posts.length, analyticsReads: reads.length, errors };
  fs.writeFileSync("docs/previews/analytics-verification.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error("Failed stage:", stage, error.message);
  if (page) {
    console.error(await page.evaluate(() => ({ path: location.pathname + location.search, active: document.activeElement?.outerHTML.slice(0, 300), query: document.querySelector('[aria-label="Cari posting"]')?.value, results: document.querySelector(".analytics-results-meta")?.textContent, errors: document.querySelector(".analytics-error")?.textContent })).catch(() => ({})));
    await page.screenshot({ path: "docs/previews/analytics-failure.png" }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) {
    await Promise.race([browser.close().catch(() => {}), new Promise(resolve => { const timer = setTimeout(resolve, 5000); timer.unref(); })]);
    browser.process()?.kill("SIGTERM");
  }
  await db.$disconnect();
}
