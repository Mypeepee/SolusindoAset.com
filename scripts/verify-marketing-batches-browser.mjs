// Browser fixtures only: every marketing mutation is intercepted; no social dispatch.
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
import createLoader from "./lib/marketing-test-loader.cjs";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3102";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient(),
  load = createLoader();
const d = load("src/lib/marketing/domain.ts"),
  c = load("src/lib/marketing/campaign.ts"),
  b = load("src/lib/marketing/campaign-batches.ts"),
  selection = load("src/lib/marketing/campaign-selection.ts");
const start = "2026-11-01",
  end = "2026-11-03";
let clock = Date.parse(start + "T00:00:00+07:00"),
  zeroStock = false,
  failGenerate = false,
  failInventory = false;
let campaign = {
  id: randomUUID(),
  revision: 1,
  state: "running",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  planned: 0,
  published: 0,
  brief: {
    name: "Campaign pengujian batch",
    startDate: start,
    endDate: end,
    schedules: ["07:00", "09:00", "11:00", "14:00", "18:00"],
    listingIds: [],
    assetOrder: "fresh",
    channels: ["instagram", "whatsapp"],
    city: "",
    locations: [],
    category: "ALL",
    propertyTypes: ["RUMAH"],
    minPrice: null,
    maxPrice: null,
    minSpread: 25,
    minDrop: 50,
    discountMode: "either",
  },
  activeBrief: null,
};
campaign.activeBrief = structuredClone(campaign.brief);
const assets = Array.from({ length: 22 }, (_, index) => ({
  id: String(900010000 + index),
  assetKey: "qa-batch:" + index,
  title: "Rumah pengujian",
  address: "Jalan Pengujian " + (index + 1),
  city: "Kota Surabaya",
  price: 400e6,
  landArea: 90,
  category: "LELANG",
  propertyType: "RUMAH",
  auctionDate: new Date(
    clock + (index < 14 ? 12 : 40) * 86400000,
  ).toISOString(),
  sourceListedAt: new Date(clock - 86400000).toISOString(),
  images: ["/images/hero/pasinan1.jpg"],
  listingUrl: "/Lelang/qa",
  revision: "fixture",
  marketSpreadPct: 80,
  auctionDropPct: 60,
}));
let jobs = [],
  proposal = null;
const calls = [],
  errors = [];
let browser;
const timeDay = (when) => d.jakartaDate(new Date(when));
function jobFor(slot) {
  return {
    id: randomUUID(),
    scheduledFor: slot.when.toISOString(),
    status: slot.asset ? "queued" : "skipped",
    reason: slot.asset ? null : slot.reason,
    listingId: null,
    assetKey: slot.asset?.assetKey || null,
    snapshot: slot.asset || {},
    caption: "",
    media: [],
    settingsRevision: 1,
    campaignId: campaign.id,
    campaignProposalId: proposal?.id || randomUUID(),
    publications: [],
    plan: {
      kind: "campaign",
      campaignId: campaign.id,
      proposalId: proposal?.id || randomUUID(),
      campaignName: campaign.brief.name,
      listingId: slot.asset?.id || null,
      channels: campaign.brief.channels,
      criteria: c.campaignCriteria(campaign.brief),
      selectionReason: slot.reason,
    },
  };
}
function fillNew() {
  const taken = new Set(jobs.filter((j) => j.assetKey).map((j) => j.assetKey));
  const dates = b
    .campaignPreparationDates(campaign.activeBrief, new Date(clock))
    .filter(
      (date) =>
        !jobs.some((j) => Date.parse(j.scheduledFor) === date.getTime()),
    );
  const projected = selection.selectCampaignAssets(
    zeroStock ? [] : assets.filter((a) => !taken.has(a.assetKey)),
    dates,
    7,
    () => new Set(),
    () => false,
    "fresh",
    undefined,
    { ...campaign.activeBrief, noRepeat: true },
  );
  jobs.push(...projected.map(jobFor));
  campaign.planned = jobs.filter((j) => j.assetKey).length;
  if (projected.length) campaign.revision++;
}
fillNew();
function queue() {
  const batch = b.campaignBatch(campaign.activeBrief, new Date(clock));
  return {
    campaignId: campaign.id,
    campaignName: campaign.brief.name,
    revision: campaign.revision,
    active: campaign.state !== "draft",
    batch,
    checkedAt: new Date(clock).toISOString(),
    inventoryError: failInventory,
    inventory: failInventory
      ? null
      : {
          eligible: zeroStock ? 0 : assets.length,
          upcomingSlots: b.campaignPreparationDates(
            campaign.activeBrief,
            new Date(clock),
          ).length,
          checkedAt: new Date(clock).toISOString(),
          diagnostics: {
            total: zeroStock ? 2090 : assets.length,
            ready: zeroStock ? 0 : assets.length,
            expired: zeroStock ? 2089 : 0,
            missingEvidence: zeroStock ? 1 : 0,
            closingSoon: 0,
            missingAuctionDate: 0,
            unverified: 0,
            belowThreshold: 0,
            unavailable: 0,
            missingPhotos: 0,
            alreadyMarketed: 0,
            latestAuctionDate: zeroStock
              ? "2026-06-28T17:00:00.000Z"
              : assets[0].auctionDate,
          },
        },
    days: batch
      ? [
          batch.startDate,
          ...(batch.endDate !== batch.startDate ? [batch.endDate] : []),
        ].map((day) => ({
          date: day,
          slots: campaign.activeBrief.schedules.map((time) => {
            const when = new Date(day + "T" + time + ":00+07:00").toISOString(),
              job = jobs.find((j) => j.scheduledFor === when);
            return {
              scheduledFor: when,
              asset: job?.snapshot?.id ? job.snapshot : null,
              status: job?.status || "unfilled",
              reason: job?.reason || null,
            };
          }),
        }))
      : [],
  };
}
function detail() {
  return {
    campaign,
    proposal,
    jobs: jobs.map((j) => ({
      id: j.id,
      scheduledFor: j.scheduledFor,
      status: j.status,
      reason: j.reason,
      address: j.snapshot?.address || "",
      publications: j.publications,
    })),
    jobsTotal: jobs.length,
  };
}
try {
  const owner = await db.agent.findFirst({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
  assert.ok(owner);
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    token: {
      id: owner.id_pengguna,
      sub: owner.id_pengguna,
      peran: "AGENT",
      role: "AGENT",
      jabatan: "OWNER",
      _refreshedAt: Date.now(),
    },
  });
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const live = await (
    await fetch(origin + "/api/dashboard/pemasaran", {
      headers: { Cookie: cookieName + "=" + token },
    })
  ).json();
  assert.equal(live.config.enabled, false);
  const config = {
    ...live.config,
    schedules: ["09:00", "13:00", "18:00"],
    instagram: true,
    whatsapp: true,
  };
  browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
    protocolTimeout: 180000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
  });
  await page.evaluateOnNewDocument((timestamp) => {
    const Native = Date;
    window.__batchClock = timestamp;
    window.Date = class extends Native {
      constructor(...args) {
        super(...(args.length ? args : [window.__batchClock]));
      }
      static now() {
        return window.__batchClock;
      }
    };
  }, clock);
  const photo = fs.readFileSync("public/images/hero/pasinan1.jpg");
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const respond = (body, status = 200) =>
      request.respond({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.origin !== origin) return request.abort();
    if (url.pathname === "/api/dashboard/pemasaran/campaigns") {
      if (request.method() === "POST") {
        const input = JSON.parse(request.postData());
        calls.push(input);
        if (input.action === "refresh-queue") {
          if (campaign.state !== "draft") fillNew();
          return respond(queue());
        }
        if (input.action === "inventory")
          return respond({
            items: zeroStock ? [] : assets.slice(0, 10),
            total: zeroStock ? 0 : assets.length,
            nextOffset: 10,
            selected: [],
            recommendation: {
              assets: zeroStock ? [] : assets.slice(0, 10),
              filled: zeroStock ? 0 : 10,
              target: 10,
              expiring: 0,
              checkedAt: new Date(clock).toISOString(),
            },
          });
        if (input.action === "save") {
          assert.equal(input.id, campaign.id);
          campaign = {
            ...campaign,
            brief: input.brief,
            revision: campaign.revision + 1,
          };
          return respond(detail());
        }
        if (input.action === "generate") {
          assert.equal(input.queue, true);
          if (failGenerate) {
            failGenerate = false;
            return respond({ error: "SERVICE_UNAVAILABLE" }, 503);
          }
          const dates = b.campaignPreparationDates(
            campaign.brief,
            new Date(clock),
          );
          proposal = {
            id: randomUUID(),
            version: 1,
            approvedAt: null,
            data: {
              policyVersion: selection.CAMPAIGN_POLICY_VERSION,
              batch: b.campaignBatch(campaign.brief, new Date(clock)),
              slots: [],
              unfilled: dates.map((date) => ({
                id: randomUUID(),
                scheduledFor: date.toISOString(),
                reason: "CAMPAIGN_NO_ELIGIBLE_ASSET",
              })),
              stock: 0,
              capacity: dates.length,
              target: dates.length,
              settingsRevision: config.revision,
              generatedAt: new Date(clock).toISOString(),
              briefKey: JSON.stringify(campaign.brief),
            },
          };
          campaign.revision++;
          return respond(detail());
        }
        if (input.action === "approve") {
          campaign.activeBrief = structuredClone(campaign.brief);
          campaign.revision++;
          proposal.approvedAt = new Date(clock).toISOString();
          jobs = jobs.filter((job) =>
            job.publications.some((p) => p.state === "published"),
          );
          jobs.push(
            ...proposal.data.unfilled.map((slot) =>
              jobFor({
                when: new Date(slot.scheduledFor),
                asset: null,
                reason: slot.reason,
              }),
            ),
          );
          return respond(detail());
        }
        return respond({ error: "INVALID_REQUEST" }, 400);
      }
      if (url.searchParams.get("mode") === "queue") return respond(queue());
      if (url.searchParams.get("view") === "grouped")
        return respond({
          current: { items: [campaign], total: 1, page: 1, pageSize: 20 },
          ended: { items: [], total: 0, page: 1, pageSize: 20 },
        });
      return respond(
        url.searchParams.has("id")
          ? detail()
          : { items: [campaign], total: 1, page: 1, pageSize: 20 },
      );
    }
    if (url.pathname === "/api/dashboard/pemasaran") {
      if (request.method() !== "GET") return request.abort();
      const batch = b.campaignBatch(campaign.activeBrief, new Date(clock));
      const planner = {
        ...live.planner,
        month: url.searchParams.get("month") || "2026-11",
        now: new Date(clock).toISOString(),
        jobs,
        pendingCampaigns: [],
        campaignPeriods: [
          {
            startDate: start,
            endDate: end,
            plan: {
              id: campaign.id,
              name: campaign.brief.name,
              schedules: campaign.activeBrief.schedules,
              channels: campaign.activeBrief.channels,
              state: campaign.state,
              preparedThrough: batch?.endDate,
            },
          },
        ],
      };
      return respond(
        url.searchParams.get("mode") === "planner"
          ? planner
          : {
              ...live,
              config,
              planner,
              jobs: { items: jobs, total: jobs.length, page: 1, pageSize: 20 },
            },
      );
    }
    if (url.pathname.startsWith("/api/foto/"))
      return request.respond({
        status: 200,
        contentType: "image/jpeg",
        body: photo,
      });
    if (
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth/")
    )
      return respond({});
    return request.continue();
  });
  const click = async (text, selector = "button") => {
    const hit = await page.waitForFunction(
      (text, selector) =>
        Array.from(document.querySelectorAll(selector)).find(
          (e) => e.textContent.trim() === text && !e.disabled,
        ),
      {},
      text,
      selector,
    );
    await hit
      .asElement()
      .evaluate((e) =>
        e.scrollIntoView({ block: "center", behavior: "instant" }),
      );
    await hit.asElement().click();
  };
  const overflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  await page.setViewport({ width: 1512, height: 1050 });
  await page.goto(
    origin +
      "/dashboard/pemasaran?tab=campaign&simulation=archive&archiveCampaign=" +
      campaign.id,
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector(
    '.campaign-batch-day[data-batch-day="2026-11-02"]',
  );
  assert.equal(new URL(page.url()).searchParams.has("simulation"), false);
  assert.equal(
    await page.$$eval(".campaign-property-card", (els) => els.length),
    10,
  );
  assert.equal(
    await page.$$eval("button", (els) =>
      els.some((e) =>
        /Coba A, B, C|Pratinjau Planner|Coba arsip/.test(e.textContent),
      ),
    ),
    false,
  );
  const originalDay2 = jobs
    .filter((job) => timeDay(job.scheduledFor) === "2026-11-02")
    .map((job) => [job.id, job.assetKey]);
  await click("Buka Planner");
  await page.waitForSelector(".marketing-planner");
  for (const day of [start, "2026-11-02", end])
    assert.equal(
      await page.$$eval(
        `[data-day="${day}"] [data-session]`,
        (els) => els.length,
      ),
      5,
    );
  assert.equal(
    await page.$$eval(
      '[data-day="2026-11-03"] .marketing-event-awaiting',
      (els) => els.length,
    ),
    5,
  );
  assert.equal(
    await page.$$eval(".marketing-day-content img", (els) => els.length),
    5,
  );
  await click("Campaign", ".marketing-tabs button");
  await page.waitForSelector(".campaign-live-queue");
  const posted = new Set();
  for (const job of jobs.filter((job) => timeDay(job.scheduledFor) === start)) {
    posted.add(job.assetKey);
    job.status = "completed";
    job.publications = [
      {
        id: randomUUID(),
        channel: "instagram",
        state: "published",
        attemptCount: 1,
        publishedAt: job.scheduledFor,
        metrics: [],
      },
    ];
  }
  clock = Date.parse("2026-11-02T00:00:00+07:00");
  assets.push({
    ...assets[0],
    id: "900019999",
    assetKey: "qa-batch:new",
    auctionDate: "2026-11-09T00:00:00+07:00",
  });
  await page.evaluate((timestamp) => {
    window.__batchClock = timestamp;
    window.dispatchEvent(new Event("focus"));
  }, clock);
  await page.waitForSelector(
    '.campaign-batch-day[data-batch-day="2026-11-03"]',
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".campaign-property-card").length === 5,
  );
  assert.equal(
    await page.$$eval(".campaign-batch-day", (els) => els.length),
    1,
  );
  const nextJobs = jobs.filter((job) => timeDay(job.scheduledFor) === end);
  assert.equal(nextJobs.length, 5);
  assert.ok(nextJobs.every((job) => !posted.has(job.assetKey)));
  assert.deepEqual(
    jobs
      .filter((job) => timeDay(job.scheduledFor) === "2026-11-02")
      .map((job) => [job.id, job.assetKey]),
    originalDay2,
  );
  fs.mkdirSync("/tmp/kosku-batch-qa", { recursive: true });
  for (const width of [1512, 1024, 768, 540, 390, 320]) {
    await page.setViewport({ width, height: 1050 });
    await overflow();
    const card = await page.$eval(".campaign-property-card", (e) => ({
      width: e.getBoundingClientRect().width,
      height: e.getBoundingClientRect().height,
    }));
    assert.ok(card.width >= 200 && card.height > 300);
    await page.$eval(".campaign-live-queue", (e) =>
      e.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await page.screenshot({ path: `/tmp/kosku-batch-qa/queue-${width}.png` });
  }
  await click("Edit campaign");
  await page.waitForSelector("#campaign-time-4");
  const fill = async (selector, value) => {
    await page.$eval(selector, (e) => {
      e.focus();
      e.select();
    });
    await page.keyboard.type(value, { delay: 10 });
  };
  await fill("#campaign-minPrice", "1234500");
  assert.equal(
    await page.$eval("#campaign-minPrice", (e) => e.value),
    "1.234.500",
  );
  await fill("#campaign-minSpread", "0030");
  assert.equal(await page.$eval("#campaign-minSpread", (e) => e.value), "30");
  await fill("#campaign-time-2", "0600");
  await page.waitForSelector('#campaign-time-2[aria-invalid="true"]');
  await fill("#campaign-time-2", "1100");
  assert.equal(await page.$eval("#campaign-time-2", (e) => e.value), "11:00");
  zeroStock = true;
  failGenerate = true;
  await page.click('button[aria-label="Periksa ketersediaan aset"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-assets")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await click("Simpan ke Planner");
  await page.waitForFunction(() =>
    document
      .querySelector('.campaign-form [role="alert"]')
      ?.textContent.includes("Draf campaign sudah tersimpan"),
  );
  await click("Simpan ke Planner");
  await page.waitForSelector(".campaign-brief");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-live-queue")
      ?.textContent.includes("0 properti"),
  );
  assert.equal(
    await page.$$eval(
      ".campaign-live-queue .campaign-property-card",
      (els) => els.length,
    ),
    0,
  );
  assert.equal(
    await page.$$eval(".campaign-batch-gaps li", (els) => els.length),
    5,
  );
  assert.equal(campaign.brief.minPrice, 1234500);
  assert.equal(campaign.brief.minSpread, 30);
  assert.equal(
    jobs.filter((job) => job.publications.some((p) => p.state === "published"))
      .length,
    5,
  );
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-live-queue .campaign-inventory-status")
      ?.textContent.includes("2.089 lelang sudah lewat"),
  );
  const beforeReadOnlyChecks = calls.length;
  campaign.state = "draft";
  campaign.revision++;
  jobs = [];
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-live-queue")
      ?.textContent.includes("Campaign masih draf dan stok siap tayang kosong"),
  );
  assert.match(
    await page.$eval(".campaign-queue-summary", (e) => e.textContent),
    /Belum diterapkan ke Planner/,
  );
  assert.match(
    await page.$eval(".campaign-inventory-status", (e) => e.textContent),
    /29 Jun 2026/,
  );
  const sourceLink = await page.$eval(
    '.campaign-live-queue a[href="/dashboard/scrape"]',
    (e) => ({ target: e.target, label: e.getAttribute("aria-label") }),
  );
  assert.equal(sourceLink.target, "_blank");
  assert.match(sourceLink.label, /pengambilan data lelang/);
  assert.doesNotMatch(
    await page.$eval(".campaign-batch-gaps", (e) => e.textContent),
    /Belum ada properti yang memenuhi/,
  );
  await page.setViewport({ width: 320, height: 860 });
  await overflow();
  await page.$eval(".campaign-live-queue", (e) =>
    e.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.screenshot({
    path: "/tmp/kosku-batch-qa/queue-diagnosis-320.png",
  });

  zeroStock = false;
  await page.click('button[aria-label="Perbarui antrean properti"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-live-queue .marketing-warning")
      ?.textContent.includes("properti memenuhi syarat"),
  );
  assert.equal(
    await page.$$eval(
      ".campaign-live-queue .campaign-property-card",
      (els) => els.length,
    ),
    0,
  );
  failInventory = true;
  await page.waitForSelector(
    'button[aria-label="Perbarui antrean properti"]:not(:disabled)',
  );
  await page.click('button[aria-label="Perbarui antrean properti"]');
  await page.waitForFunction(() =>
    document
      .querySelector('.campaign-live-queue [role="alert"]')
      ?.textContent.includes("belum berhasil diperiksa"),
  );
  assert.equal(
    await page.$(".campaign-live-queue .campaign-inventory-status"),
    null,
  );
  failInventory = false;
  await page.waitForSelector(
    'button[aria-label="Perbarui antrean properti"]:not(:disabled)',
  );
  await page.click('button[aria-label="Perbarui antrean properti"]');
  await page.waitForSelector(".campaign-live-queue .campaign-inventory-status");
  assert.ok(
    calls
      .slice(beforeReadOnlyChecks)
      .every((call) => call.action === "refresh-queue"),
  );
  assert.equal(jobs.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "no simulation or archive UI, including old deep links",
        "ten actual assigned jobs grouped into two dated horizontal carriages",
        "five Planner sessions per date and awaiting-batch state",
        "next batch one day early, odd final day, five new assets",
        "committed day-two assignments retained and published parcels excluded",
        "320–1512px, no page overflow and large property cards",
        "four-digit time order, grouped currency and leading-zero percentages",
        "empty stock applies honest slots without archive substitution",
        "save retry retains campaign ID and refreshes Planner",
        "draft source diagnosis, expired auction dates and source-update link at 320px",
        "eligible draft stock and retry after inventory failure never apply the campaign",
      ],
      marketingCalls: calls.map((call) => call.action),
      pageErrors: errors,
    }),
  );
} catch (error) {
  console.error(error.stack);
  if (browser) {
    const pages = await browser.pages();
    const page = pages.at(-1);
    if (page) {
      console.error(
        await page
          .$eval(".marketing-workspace", (e) => e.textContent.slice(-5000))
          .catch(() => "No workspace"),
      );
      await page.screenshot({ path: "/tmp/kosku-batch-failed.png" });
    }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await db.$disconnect();
}
