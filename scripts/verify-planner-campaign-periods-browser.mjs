// Isolated browser fixtures exercise periods without creating campaigns or jobs.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
import createLoader from "./lib/marketing-test-loader.cjs";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser, page;
const errors = [], mutations = [], blockedDiagnostics = [];
const periods = [
  { startDate: "2026-11-01", endDate: "2026-11-05", plan: { id: "00000000-0000-4000-8000-000000000001", name: "Campaign utama (QA)", schedules: ["08:00", "10:30"], channels: ["instagram"], state: "running" } },
  { startDate: "2026-11-04", endDate: "2026-11-06", plan: { id: "00000000-0000-4000-8000-000000000002", name: "Campaign draf (QA)", schedules: ["09:00"], channels: ["instagram"], state: "draft" } },
  { startDate: "2026-11-28", endDate: "2026-12-03", plan: { id: "00000000-0000-4000-8000-000000000003", name: "Campaign lintas bulan (QA)", schedules: ["12:00"], channels: ["whatsapp"], state: "paused" } },
  ...Array.from({length:11}, (_, index) => {
    const day = index === 0 ? "08" : index === 1 ? "10" : "12";
    return { startDate:`2026-11-${day}`,endDate:index < 2 ? `2026-11-${day}` : "2026-11-14",plan:{id:`00000000-0000-4000-8000-${String(index+4).padStart(12,"0")}`,name:`Campaign tambahan ${index+4} (QA)`,schedules:["09:10"],channels:["instagram"],state:"draft"} };
  }),
].map((period, appearanceIndex) => ({...period,plan:{...period.plan,appearanceIndex}}));
try {
  const owner = await db.agent.findFirstOrThrow({ where: { jabatan: "OWNER", status_keanggotaan: "AKTIF", pengguna: { status_akun: "AKTIF" } }, select: { id_pengguna: true } });
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: owner.id_pengguna, sub: owner.id_pengguna, peran: "AGENT", role: "AGENT", jabatan: "OWNER", _refreshedAt: Date.now() } });
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:") ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  // Only the planner endpoint is read-only; never call the operational dashboard
  // endpoint, which can settle old queued jobs during a normal workspace refresh.
  const response = await fetch(origin + "/api/dashboard/pemasaran?mode=planner&month=2026-11", { headers: { Cookie: cookieName + "=" + token }, signal:AbortSignal.timeout(120000) });
  assert.equal(response.status, 200);
  const livePlanner = await response.json();
  const { DEFAULT_CONFIG } = createLoader()("src/lib/marketing/domain.ts");
  const settings = await db.marketingSettings.findUniqueOrThrow({where:{id:"company"},select:{config:true}});
  const seed = {
    config:{...DEFAULT_CONFIG,...settings.config},
    connection:{environmentReady:false,instagram:{connected:false,configured:false},whatsapp:{contacts:[],connected:false,tested:false}},
    jobs:{items:[],total:0,page:1},
    planner:livePlanner,
    summary:{nextSlot:null,lastTickAt:null,lastError:null,published:[],needsReview:0},
  };
  assert.ok(seed.planner.campaignPeriods.every(period => !period.plan || Number.isSafeInteger(period.plan.appearanceIndex)), "Live periods receive company-wide identities");
  let reversePeriods = false;
  const planner = (month) => ({ ...seed.planner, month, jobs: [], campaignPeriods: reversePeriods ? [...periods].reverse() : periods, pendingCampaigns: [] });
  let fixture = true;
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.MARKETING_QA_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setCookie({ name: cookieName, value: token, url: origin, secure: cookieName.startsWith("__Secure-"), httpOnly: true });
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith("/api/") && request.method() !== "GET") {
      // NextAuth may emit a development diagnostic beacon after cancelled reads.
      // Acknowledge it locally; no diagnostic or application write reaches a server.
      if (url.pathname === "/api/auth/_log") {
        blockedDiagnostics.push(url.pathname);
        return request.respond({status:204});
      }
      mutations.push(url.pathname);
      return request.abort();
    }
    if (url.pathname === "/api/dashboard/pemasaran") {
      const month = url.searchParams.get("month") || "2026-11";
      if (!fixture && url.searchParams.get("mode") === "planner") return request.continue();
      const monthData = fixture ? planner(month) : livePlanner;
      return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(url.searchParams.get("mode") === "planner" ? monthData : { ...seed, planner:monthData }) });
    }
    if (url.origin === origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/dashboard/pemasaran") && !url.pathname.startsWith("/api/auth/")) return request.respond({ status: 200, contentType: "application/json", body: "{}" });
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin + "/dashboard/pemasaran?tab=planner&month=2026-11&date=2026-11-03", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('.marketing-calendar-day[data-campaign="true"]');
  const highlighted = await page.$$eval('.marketing-calendar-day[data-campaign="true"]', nodes => nodes.map(node => node.dataset.day));
  assert.deepEqual(highlighted, ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-08", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-28", "2026-11-29", "2026-11-30"]);
  assert.equal(await page.$eval('[data-day="2026-11-01"]', node => node.dataset.campaignStart), "true");
  assert.equal(await page.$eval('[data-day="2026-11-05"]', node => node.dataset.campaignEnd), "true");
  assert.equal(await page.$eval('[data-day="2026-11-06"]', node => node.dataset.campaignState), "draft");
  assert.match(await page.$eval('[data-day="2026-11-04"]', node => node.getAttribute('aria-label')), /Campaign utama.*Campaign draf/s);
  assert.equal(await page.$$eval('[data-day="2026-11-04"] .marketing-calendar-campaign', nodes => nodes.length), 2);
  const identities = await page.$$eval('.marketing-planner-campaign-key-list button', nodes => nodes.map(node => ({id:node.dataset.campaignId,code:node.querySelector('.marketing-campaign-code').textContent,colour:getComputedStyle(node).getPropertyValue('--planner-campaign-accent'),pattern:node.dataset.pattern})));
  assert.equal(identities.length, 14);
  assert.equal(new Set(identities.slice(0,12).map(identity => identity.colour)).size,12);
  assert.equal(new Set(identities.map(identity => identity.code)).size,14);
  assert.notEqual(identities[0].pattern,identities[12].pattern);
  assert.equal(await page.$$eval('[data-day="2026-11-12"] .marketing-calendar-campaign', nodes => nodes.length),3);
  assert.equal(await page.$eval('[data-day="2026-11-12"] .marketing-calendar-campaign-more', node => node.textContent),'+6 lainnya');
  assert.match(await page.$eval('.marketing-day-campaign', node => node.textContent), /1 Nov 2026 sampai 5 Nov 2026/);
  const colours = await page.evaluate(() => ["2026-11-03", "2026-11-20"].map(day => getComputedStyle(document.querySelector(`[data-day="${day}"]`)).backgroundColor));
  assert.notEqual(colours[0], colours[1]);
  const mainColour = identities[0].colour;
  assert.equal(await page.$eval('[data-day="2026-11-03"]',node => getComputedStyle(node).getPropertyValue('--planner-campaign-accent')),mainColour);
  assert.equal(await page.$eval('.marketing-day-campaign',node => getComputedStyle(node).getPropertyValue('--planner-campaign-accent')),mainColour);
  assert.equal(await page.$eval('.marketing-planner-campaign-key-list', node => node.scrollWidth > node.clientWidth),true,'Many campaigns scroll inside the key');
  await page.click('.marketing-planner-channels [data-channel="whatsapp"]');
  assert.equal(await page.$$eval('[data-day="2026-11-03"] [data-session]', nodes => nodes.length), 0, "This channel has no campaign sessions");
  assert.equal(await page.$eval('[data-day="2026-11-03"]', node => node.dataset.campaign), "true", "An empty channel must retain the period highlight");
  assert.match(await page.$eval('.marketing-day-campaign', node => node.textContent), /Campaign utama/);
  assert.match(await page.$eval('.marketing-day-empty', node => node.textContent), /Tidak ada slot pada kanal ini.*Semua kanal/s);
  assert.equal(await page.$eval('[data-day="2026-11-03"]',node => getComputedStyle(node).getPropertyValue('--planner-campaign-accent')),mainColour);
  await page.click('.marketing-planner-channels [data-channel="all"]');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 900, hasTouch: width < 768 });
    assert.equal(await page.$eval('.marketing-calendar', node => node.scrollWidth <= node.clientWidth), true, `Calendar overflow at ${width}`);
    assert.equal(await page.$$eval('.marketing-calendar-day[data-campaign="true"]', nodes => nodes.every(node => node.scrollWidth <= node.clientWidth)), true, `Campaign labels overflow at ${width}`);
    await page.click('[data-day="2026-11-04"]');
    assert.equal(await page.$$eval('.marketing-day-campaign', nodes => nodes.length), 2);
    const overlapColours = await page.$$eval('[data-day="2026-11-04"] .marketing-calendar-campaign', nodes => nodes.map(node => getComputedStyle(node).getPropertyValue('--planner-campaign-accent')));
    assert.equal(new Set(overlapColours).size,2,`Overlaps have separate colours at ${width}`);
    assert.equal(await page.$eval('.marketing-planner-campaign-key',node => node.scrollWidth <= node.clientWidth),true,`Key overflow at ${width}`);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.marketing-planner-layout')).opacity === '1');
    if (width === 1440 || width === 390 || width === 320) await (await page.$('.marketing-calendar-shell')).screenshot({ path: `/tmp/kosku-campaign-periods-${width}.png` });
  }
  await page.click('[data-day="2026-11-12"]');
  assert.equal(await page.$$eval('.marketing-day-campaign',nodes => nodes.length),9,'The agenda exposes every overlapping campaign');
  await page.click('.marketing-planner-campaign-key-list button[data-campaign-id="00000000-0000-4000-8000-000000000003"]');
  assert.equal(await page.$eval('[data-day="2026-11-28"]',node => node.getAttribute('aria-pressed')),'true','Clicking a key moves to its real period');
  await page.focus('[data-day="2026-11-04"]');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-day') === '2026-11-05');
  assert.equal(await page.$eval('[data-day="2026-11-05"]', node => node.getAttribute('aria-pressed')), "true");
  await page.click('[data-day="2026-11-20"]');
  assert.equal(await page.$('.marketing-day-campaign'), null);
  await page.click('.marketing-planner-date-controls button[aria-label="Bulan berikutnya"]');
  await page.waitForSelector('[data-day="2026-12-01"]');
  assert.deepEqual(await page.$$eval('.marketing-calendar-day[data-campaign="true"]', nodes => nodes.map(node => node.dataset.day)), ['2026-12-01','2026-12-02','2026-12-03']);
  assert.equal(await page.$eval('[data-day="2026-12-03"]', node => node.dataset.campaignEnd), "true");
  assert.match(await page.$eval('.marketing-day-campaign', node => node.textContent), /Dijeda.*28 Nov 2026 sampai 3 Des 2026/s);
  assert.equal(await page.$eval('[data-day="2026-12-01"]',node => getComputedStyle(node).getPropertyValue('--planner-campaign-accent')),identities[2].colour,'Cross-month identity must not change');
  reversePeriods = true;
  await page.goto(origin + "/dashboard/pemasaran?tab=planner&month=2026-11&date=2026-11-03", {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.marketing-planner-campaign-key-list button');
  const reloaded = await page.$$eval('.marketing-planner-campaign-key-list button', nodes => nodes.map(node => ({id:node.dataset.campaignId,code:node.querySelector('.marketing-campaign-code').textContent,colour:getComputedStyle(node).getPropertyValue('--planner-campaign-accent'),pattern:node.dataset.pattern})));
  assert.deepEqual(reloaded,identities,'Refresh and reordered API results preserve every identity');
  fixture = false;
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin + "/dashboard/pemasaran?tab=planner&month=2026-11&date=2026-11-03", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('.marketing-calendar');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.marketing-planner-layout')).opacity === '1');
  await (await page.$('.marketing-calendar-shell')).screenshot({ path: '/tmp/kosku-campaign-periods-live.png' });
  assert.deepEqual(mutations, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, campaigns:14, distinctBaseColours:12, paletteOverflowPatterns:true, overlapCapAndFullAgenda:true, stableAcrossRefreshReorderAndMonth:true, keyAndAgendaMatch:true, periodWithoutJobs: true, inclusiveBoundaries: true, overlapsAndDrafts: true, independentOfChannelFilter: true, crossMonthPausedPeriod: true, keyboardNavigation: true, viewports: [1440,1024,768,390,320], realPlannerScreenshot: true, mutations: 0, blockedDiagnosticLogs:blockedDiagnostics.length }));
} catch (error) {
  console.error(error);
  await page?.screenshot({ path: '/tmp/kosku-campaign-periods-failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
