// Browser UI fixtures intercept every campaign mutation. No social dispatch.
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
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient(),
  errors = [],
  writes = [],
  report = [];
let browser,
  campaign = null,
  proposal = null,
  jobs = [],
  failSave = true,
  failGenerate = true,
  failSlot = true,
  failApprove = true,
  creates = 0;
let includeRecommendations = true;
let listExtras = [];
let observingSimulation = false;
const simulationRequests = [];
let inventoryTarget = 3,
  expiredSource = false;
const loader = createLoader();
const domain = loader("src/lib/marketing/domain.ts");
const campaignDomain = loader("src/lib/marketing/campaign.ts");
const selectionDomain = loader("src/lib/marketing/campaign-selection.ts");
const investorDomain = loader("src/lib/investor-deals.ts");
const day = domain.jakartaDate(new Date(Date.now() + 7 * 86400000));
const scheduled = (time) =>
  new Date(day + "T" + time + ":00+07:00").toISOString();
const assets = Array.from({ length: 25 }, (_, n) => ({
  id: String(900001 + n),
  assetKey: "fixture:" + n,
  title: "Rumah pengujian",
  address: "Jalan Pengujian " + (n + 1),
  city: "Kota Surabaya",
  price: 500e6,
  landArea: 120,
  category: n < 2 ? "LELANG" : "SECONDARY",
  propertyType: "RUMAH",
  auctionDate:
    n < 2 ? new Date(Date.parse(day) + 14 * 86400000).toISOString() : null,
  listingUrl: "/Jual/fixture",
  images: ["/images/hero/pasinan1.jpg"],
  revision: "fixture",
  marketSpreadPct: 80,
  auctionDropPct: n < 2 ? 75 : null,
}));
const [a, b, other] = assets;
const detail = () => ({
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
});
const clone = (x) => JSON.parse(JSON.stringify(x)),
  bump = () => {
    campaign.revision++;
    campaign.updatedAt = new Date().toISOString();
  };
function mutate(input, config) {
  if (input.action === "inventory") {
    const v = input.inventory;
    const filtered = assets.filter(
      (a) =>
        (!v.criteria.propertyTypes.length ||
          v.criteria.propertyTypes.includes(a.propertyType)) &&
        (v.criteria.minPrice === null || a.price >= v.criteria.minPrice) &&
        (v.criteria.maxPrice === null || a.price <= v.criteria.maxPrice) &&
        investorDomain.isWorthItDeal(
          {
            metricMarketSpreadPct: a.marketSpreadPct,
            metricAuctionDropPct: a.auctionDropPct,
          },
          v.criteria.minDrop ?? config.minDrop,
          v.criteria.minSpread ?? config.minSpread,
          v.criteria.discountMode,
        ),
    );
    const matches = filtered.filter((a) =>
      [a.address, a.id, a.city]
        .join(" ")
        .toLowerCase()
        .includes(v.query.toLowerCase()),
    );
    return {
      status: 200,
      body: {
        items: expiredSource ? [] : matches.slice(v.offset, v.offset + 20),
        total: expiredSource ? 0 : matches.length,
        ...(expiredSource
          ? {
              diagnostics: {
                total: 1545,
                ready: 0,
                expired: 1545,
                closingSoon: 0,
                missingAuctionDate: 0,
                unverified: 0,
                missingEvidence: 0,
                belowThreshold: 0,
                unavailable: 0,
                missingPhotos: 0,
                latestAuctionDate: "2026-07-02T17:00:00Z",
              },
            }
          : {}),
        nextOffset: Math.min(v.offset + 20, matches.length),
        selected: v.listingIds.map((id) => ({
          id,
          asset: filtered.find((a) => a.id === id) || null,
        })),
        ...(includeRecommendations
          ? {
              recommendation: {
                assets:
                  expiredSource || !inventoryTarget ? [] : filtered.slice(0, 3),
                filled: expiredSource
                  ? 0
                  : filtered.length
                    ? inventoryTarget
                    : 0,
                target: inventoryTarget,
                expiring: 1,
                checkedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
    };
  }
  if (input.action === "save") {
    if (failSave) {
      failSave = false;
      return { status: 503, body: { error: "SERVICE_UNAVAILABLE" } };
    }
    if (!input.id) creates++;
    campaign = {
      id: campaign?.id || randomUUID(),
      revision: (campaign?.revision || 0) + 1,
      state: campaign?.state || "draft",
      brief: input.brief,
      planned: jobs.filter((job) => job.plan.listingId).length,
      published: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else if (input.action === "generate") {
    if (failGenerate) {
      failGenerate = false;
      return { status: 503, body: { error: "SERVICE_UNAVAILABLE" } };
    }
    bump();
    proposal = {
      id: randomUUID(),
      version: 1,
      approvedAt: null,
      data: {
        policyVersion: selectionDomain.CAMPAIGN_POLICY_VERSION,
        coverage: { eligible: 3, scheduled: 2, remaining: 1 },
        slots: [a, b].map((asset, i) => ({
          id: randomUUID(),
          scheduledFor: scheduled(campaign.brief.schedules[i]),
          asset,
          reason: "Aset pilihan campaign",
        })),
        unfilled: [
          {
            id: randomUUID(),
            scheduledFor: scheduled(campaign.brief.schedules[2]),
            reason: "CAMPAIGN_NO_ELIGIBLE_ASSET",
          },
        ],
        stock: 3,
        capacity: 3,
        target: 3,
        settingsRevision: config.revision,
        generatedAt: new Date().toISOString(),
        briefKey: JSON.stringify(campaign.brief),
      },
    };
  } else if (input.action === "edit-slot") {
    if (failSlot) {
      failSlot = false;
      return { status: 409, body: { error: "CAMPAIGN_SLOT_CONFLICT" } };
    }
    bump();
    const slot = proposal.data.slots.find((s) => s.id === input.slot.slotId);
    Object.assign(slot, {
      scheduledFor: input.slot.scheduledFor,
      asset: assets.find((a) => a.id === input.slot.listingId),
    });
  } else if (input.action === "preview")
    return {
      status: 200,
      body: {
        id: input.slotId,
        caption:
          "Rumah • Kota Surabaya\nJalan Pengujian\nHarga Rp500.000.000\n\nHubungi kami untuk informasi dan ketersediaan terbaru.",
        media: [
          { name: "feed.jpg", channel: "instagram" },
          { name: "photo-1.jpg", channel: "instagram" },
          { name: "story.jpg", channel: "whatsapp" },
        ],
      },
    };
  else if (input.action === "approve") {
    if (failApprove) {
      failApprove = false;
      return { status: 409, body: { error: "CAMPAIGN_CONFLICT" } };
    }
    bump();
    campaign.state = "running";
    campaign.activeBrief = clone(campaign.brief);
    campaign.planned = proposal.data.slots.length;
    proposal.approvedAt = new Date().toISOString();
    jobs = proposal.data.slots.map((s) => ({
      id: s.id,
      campaignId: campaign.id,
      campaignProposalId: proposal.id,
      scheduledFor: s.scheduledFor,
      status: "queued",
      reason: null,
      listingId: null,
      snapshot: s.asset,
      caption: domain.captionFor(s.asset, config),
      media: [],
      settingsRevision: config.revision,
      updatedAt: new Date().toISOString(),
      plan: {
        kind: "campaign",
        campaignId: campaign.id,
        proposalId: proposal.id,
        campaignName: campaign.brief.name,
        listingId: s.asset.id,
        channels: campaign.brief.channels,
        criteria: campaignDomain.campaignCriteria(campaign.brief),
      },
      publications: [],
    }));
    jobs.push(
      ...proposal.data.unfilled.map((slot) => ({
        id: slot.id,
        campaignId: campaign.id,
        campaignProposalId: proposal.id,
        scheduledFor: slot.scheduledFor,
        status: "skipped",
        reason: "CAMPAIGN_NO_ELIGIBLE_ASSET",
        listingId: null,
        snapshot: {},
        caption: "",
        media: [],
        settingsRevision: config.revision,
        updatedAt: new Date().toISOString(),
        plan: {
          kind: "campaign",
          campaignId: campaign.id,
          proposalId: proposal.id,
          campaignName: campaign.brief.name,
          listingId: null,
          channels: campaign.brief.channels,
          criteria: campaignDomain.campaignCriteria(campaign.brief),
        },
        publications: [],
      })),
    );
  } else if (input.action === "pause") {
    bump();
    campaign.state = input.paused ? "paused" : "running";
    jobs.forEach((j) => {
      if (!j.plan.listingId) return;
      j.status = input.paused ? "paused" : "queued";
      j.reason = input.paused ? "CAMPAIGN_PAUSED" : null;
    });
  } else throw new Error("Unexpected campaign action: " + input.action);
  return { status: 200, body: detail() };
}
try {
  const owner = await db.agent.findFirstOrThrow({
    where: {
      jabatan: "OWNER",
      status_keanggotaan: "AKTIF",
      pengguna: { status_akun: "AKTIF" },
    },
    select: { id_pengguna: true },
  });
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
      : "next-auth.session-token",
    headers = { Cookie: cookieName + "=" + token };
  const response = await fetch(origin + "/api/dashboard/pemasaran", {
    headers,
  });
  assert.equal(response.status, 200);
  const live = await response.json();
  assert.equal(live.config.enabled, false);
  assert.equal(
    (
      await fetch(origin + "/api/dashboard/pemasaran/campaigns", {
        method: "POST",
        headers: {
          ...headers,
          Origin: "https://wrong.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "save" }),
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(origin + "/api/dashboard/pemasaran/campaigns")).status,
    401,
  );
  const realList = await fetch(origin + "/api/dashboard/pemasaran/campaigns", {
    headers,
  });
  assert.equal(realList.status, 200);
  assert.match(realList.headers.get("cache-control"), /private.*no-store/);
  const config = {
    ...live.config,
    minSpread: 50,
    minDrop: 50,
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
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
  });
  const photo = fs.readFileSync("public/images/hero/pasinan1.jpg");
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      observingSimulation &&
      (url.pathname.startsWith("/api/dashboard/pemasaran") ||
        url.pathname.startsWith("/api/foto/"))
    )
      simulationRequests.push(request.method() + " " + url.pathname);
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
        writes.push(input);
        const r = mutate(input, config);
        return respond(r.body, r.status);
      }
      if (url.searchParams.get("mode") === "candidates")
        return respond({
          items: [{ ...other, unavailableReason: null }],
          total: 1,
          nextOffset: 1,
        });
      if (url.searchParams.get("view") === "grouped") {
        const rows = [...(campaign ? [campaign] : []), ...listExtras];
        const group = (ended, query) => {
          const matches = rows.filter(
            (row) =>
              (campaignDomain.campaignStatus(row) === "Berakhir") === ended,
          );
          const page = Math.max(
            1,
            Math.min(
              Number(url.searchParams.get(query) || 1),
              Math.ceil(matches.length / 20) || 1,
            ),
          );
          return {
            items: matches.slice((page - 1) * 20, page * 20),
            total: matches.length,
            page,
            pageSize: 20,
          };
        };
        return respond({
          current: group(false, "page"),
          ended: group(true, "endedPage"),
        });
      }
      return respond(
        url.searchParams.has("id")
          ? detail()
          : {
              items: campaign ? [campaign] : [],
              total: campaign ? 1 : 0,
              page: 1,
              pageSize: 20,
            },
      );
    }
    if (url.pathname === "/api/dashboard/pemasaran") {
      if (request.method() !== "GET") return request.abort();
      const data = {
        ...clone(live),
        config,
        planner: {
          ...live.planner,
          month: url.searchParams.get("month") || day.slice(0, 7),
          now: new Date().toISOString(),
          jobs,
          pendingCampaigns:
            campaign &&
            (campaign.state === "draft" ||
              JSON.stringify(campaign.brief) !==
                JSON.stringify(campaign.activeBrief))
              ? [
                  {
                    id: campaign.id,
                    name: campaign.brief.name,
                    assets: campaign.brief.listingIds.length,
                    applied: campaign.state !== "draft",
                    period: {
                      startDate: campaign.brief.startDate,
                      endDate: campaign.brief.endDate,
                      plan: {
                        id: campaign.id,
                        name: campaign.brief.name,
                        schedules: campaign.brief.schedules,
                        channels: campaign.brief.channels,
                        state: "draft",
                      },
                    },
                  },
                ]
              : [],
          campaignPeriods: campaign
            ? [
                (() => {
                  const applied =
                    campaign.state !== "draft" && campaign.activeBrief;
                  const brief = applied || campaign.brief;
                  return {
                    startDate: brief.startDate,
                    endDate: brief.endDate,
                    plan: {
                      id: campaign.id,
                      name: brief.name,
                      schedules: brief.schedules,
                      channels: brief.channels,
                      state: applied ? campaign.state : "draft",
                    },
                  };
                })(),
              ]
            : [],
        },
        jobs: { items: jobs, total: jobs.length, page: 1, pageSize: 20 },
      };
      return respond(
        url.searchParams.get("mode") === "planner" ? data.planner : data,
      );
    }
    if (
      url.pathname.startsWith("/api/foto/") ||
      url.pathname === "/api/dashboard/pemasaran/media"
    )
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
  const click = async (text, scope = "button") => {
    const hit = await page.waitForFunction(
      (t, s) =>
        Array.from(document.querySelectorAll(s)).find(
          (e) => e.textContent.trim() === t && !e.disabled,
        ),
      {},
      text,
      scope,
    );
    await hit.asElement().evaluate((element) =>
      element.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant",
      }),
    );
    const obstruction = await hit.asElement().evaluate((element) => {
      const r = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return top && !element.contains(top) ? top.outerHTML.slice(0, 180) : null;
    });
    assert.equal(obstruction, null, "Control must remain unobscured: " + text);
    await hit.asElement().click();
  };
  const fill = async (selector, value) => {
    await page.$eval(selector, (e) => {
      e.focus();
      e.select();
    });
    if (value) await page.keyboard.type(value);
    else await page.keyboard.press("Backspace");
  };
  const overflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  await page.setViewport({ width: 1512, height: 982 });
  await page.goto(origin + "/dashboard/pemasaran?tab=campaign", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector(".campaign-empty");
  await new Promise((resolve) => setTimeout(resolve, 900));
  fs.mkdirSync("/tmp/kosku-campaign-qa-v2", { recursive: true });
  await page.screenshot({ path: "/tmp/kosku-campaign-qa-v2/empty-1512.png" });
  await click("Buat campaign pertama");
  await page.waitForSelector("#campaign-name");
  assert.equal(
    await page.$eval('.campaign-form button[type="submit"]', (e) => e.disabled),
    false,
  );
  await page.click('.campaign-form button[type="submit"]');
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "campaign-name",
  );
  assert.equal(
    writes.some((w) => w.action === "save"),
    false,
    "invalid brief is explained before persistence",
  );
  await fill("#campaign-name", "Campaign November Rumah Sidoarjo");
  assert.equal(
    await page.$eval("#campaign-startDate", (e) => e.tagName),
    "BUTTON",
  );
  const originalDate = await page.$eval(
    "#campaign-startDate",
    (e) => e.textContent,
  );
  await page.click("#campaign-startDate");
  await page.waitForSelector(".campaign-date-popover");
  assert.equal((await page.$$(".react-datepicker__month-container")).length, 2);
  await page.waitForFunction(
    () => !!document.activeElement.querySelector("[data-date]"),
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () => !!document.activeElement.querySelector("[data-date]"),
  );
  assert.ok(
    await page.evaluate(
      () => !!document.activeElement.querySelector("[data-date]"),
    ),
    "Calendar supports arrow keys",
  );
  await click("14 hari", ".campaign-date-presets button");
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/calendar-1512.png",
  });
  await click("Batal", ".campaign-date-footer button");
  await page.waitForFunction(
    () => !document.querySelector(".campaign-date-popover"),
  );
  await page.waitForFunction(
    () => document.activeElement.id === "campaign-startDate",
  );
  assert.equal(
    await page.$eval("#campaign-startDate", (e) => e.textContent),
    originalDate,
    "Cancel preserves saved period",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "campaign-startDate",
  );
  await page.click("#campaign-startDate");
  for (
    let turn = 0;
    !(await page.$(
      ` .react-datepicker__day:not(.react-datepicker__day--outside-month) > [data-date="${day}"]`,
    )) && turn < 3;
    turn++
  )
    await page.click('[aria-label="Bulan berikutnya"]');
  await page.click(
    ` .react-datepicker__day:not(.react-datepicker__day--outside-month) > [data-date="${day}"]`,
  );
  await page.click(
    ` .react-datepicker__day:not(.react-datepicker__day--outside-month) > [data-date="${day}"]`,
  );
  await click("Terapkan", ".campaign-date-footer button");
  await fill("#campaign-minPrice", "500000000");
  assert.equal(
    await page.$eval("#campaign-minPrice", (e) => e.value),
    "500.000.000",
  );
  await page.$eval("#campaign-minPrice", (e) => {
    e.focus();
    e.setSelectionRange(1, 2);
  });
  await page.keyboard.type("2");
  assert.deepEqual(
    await page.$eval("#campaign-minPrice", (e) => ({
      value: e.value,
      caret: e.selectionStart,
    })),
    { value: "520.000.000", caret: 2 },
  );
  await fill("#campaign-minPrice", "");
  await fill("#campaign-maxPrice", "1500000000");
  assert.equal(
    await page.$eval("#campaign-maxPrice", (e) => e.value),
    "1.500.000.000",
  );
  await fill("#campaign-maxPrice", "");
  const discountMode = async (label) => {
    await page.$eval("#campaign-discountMode", (e) =>
      e.scrollIntoView({ block: "center" }),
    );
    await page.click("#campaign-discountMode");
    await page.waitForSelector('[role="option"]');
    await click(label, '[role="option"]');
  };
  await discountMode("Diskon kelurahan");
  assert.equal(await page.$("#campaign-minDrop"), null);
  await fill("#campaign-minSpread", "030");
  assert.equal(await page.$eval("#campaign-minSpread", (e) => e.value), "30");
  await fill("#campaign-minSpread", "000.5");
  assert.equal(await page.$eval("#campaign-minSpread", (e) => e.value), "0.5");
  await fill("#campaign-minSpread", "101");
  await page.waitForSelector('#campaign-minSpread[aria-invalid="true"]');
  assert.match(
    await page.$eval("#campaign-minSpread-error", (e) => e.textContent),
    /maksimal 100/,
  );
  await fill("#campaign-minSpread", "81");
  assert.equal(await page.$eval("#campaign-minSpread", (e) => e.value), "81");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-auto-assets .marketing-footnote")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await fill("#campaign-minSpread", "80");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 3,
  );
  assert.match(
    await page.$eval(".campaign-discount-facts", (e) => e.textContent),
    /Kelurahan.*80%/,
  );
  await discountMode("Penurunan lelang");
  assert.equal(await page.$("#campaign-minSpread"), null);
  await fill("#campaign-minDrop", "0050");
  assert.equal(await page.$eval("#campaign-minDrop", (e) => e.value), "50");
  await fill("#campaign-minDrop", "75");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 2,
  );
  await fill("#campaign-minDrop", "76");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-auto-assets .marketing-footnote")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await discountMode("Salah satu (atau)");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 3,
  );
  await fill("#campaign-minSpread", "90");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-auto-assets .marketing-footnote")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await fill("#campaign-minDrop", "75");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 2,
  );
  await fill("#campaign-minSpread", "60");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 3,
  );
  const appearance = await page.evaluate(() => ({
    bodyFont: getComputedStyle(document.body).fontFamily,
    formFont: getComputedStyle(document.querySelector(".campaign-form"))
      .fontFamily,
    border: getComputedStyle(document.querySelector("#campaign-name"))
      .borderColor,
    panel: getComputedStyle(
      document.querySelector(".campaign-form-section > div"),
    ).backgroundColor,
  }));
  assert.equal(appearance.formFont, appearance.bodyFont);
  assert.equal(appearance.panel, "rgb(14, 45, 39)");
  assert.equal(
    await page.$$eval(
      ".campaign-form-section > .campaign-panel-core",
      (els) =>
        new Set(els.slice(0, 3).map((e) => getComputedStyle(e).backgroundColor))
          .size,
    ),
    3,
    "Identity, filters and timing have distinct dark surfaces",
  );
  assert.match(appearance.border, /255, 255, 255/);
  await page.waitForSelector(".campaign-auto-assets .campaign-property-card");
  await page.$eval("#campaign-propertyTypes", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await page.click("#campaign-propertyTypes");
  await page.waitForSelector(".campaign-type-popover");
  assert.equal(
    await page
      .$$(".campaign-type-options [role=checkbox]")
      .then((items) => items.length),
    9,
  );
  assert.equal(
    await page
      .$$(".campaign-type-options button > svg")
      .then((items) => items.length),
    9,
    "Type icons are bundled locally",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Apartemen",
  );
  await click("Gudang", ".campaign-type-options button");
  await click("Pabrik", ".campaign-type-options button");
  await click("Selesai", ".campaign-type-footer button");
  await page.waitForFunction(
    () => !document.querySelector(".campaign-type-popover"),
  );
  await page.waitForFunction(
    () => document.activeElement.id === "campaign-propertyTypes",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "campaign-propertyTypes",
  );
  assert.match(
    await page.$eval("#campaign-propertyTypes", (e) => e.textContent),
    /Gudang, Pabrik/,
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 0,
  );
  await page.setViewport({ width: 320, height: 740 });
  await page.click("#campaign-endDate");
  await page.waitForSelector(".campaign-date-popover");
  assert.equal((await page.$$(".react-datepicker__month-container")).length, 1);
  const calendarBounds = await page.$eval(".campaign-date-popover", (e) => {
    const r = e.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      scroll: e.scrollWidth > e.clientWidth,
    };
  });
  assert.ok(
    calendarBounds.left >= 0 &&
      calendarBounds.right <= 320 &&
      calendarBounds.top >= 0 &&
      calendarBounds.bottom <= 740 &&
      !calendarBounds.scroll,
  );
  await new Promise((resolve) => setTimeout(resolve, 220));
  await page.screenshot({ path: "/tmp/kosku-campaign-qa-v2/calendar-320.png" });
  await page.setViewport({ width: 320, height: 568 });
  await page.waitForFunction(() => {
    const e = document.querySelector(".campaign-date-footer button:last-child");
    const r = e?.getBoundingClientRect();
    return r && r.bottom <= innerHeight && r.top >= 0;
  });
  await page.setViewport({ width: 320, height: 740 });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector(".campaign-date-popover"),
  );
  await page.waitForFunction(
    () => document.activeElement.id === "campaign-endDate",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "campaign-endDate",
  );
  await page.$eval(".campaign-time-add", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await page.click(".campaign-time-add");
  assert.equal(
    await page.$$eval(".campaign-times input", (els) => els.length),
    4,
    "Mobile add-time cell adds a real slot",
  );
  await page.click("#campaign-intensity-less");
  assert.equal(
    await page.$eval(
      ".campaign-type-value small",
      (e) => e.scrollWidth <= e.clientWidth,
    ),
    true,
    "Mobile type label stays readable",
  );
  await page.$eval("#campaign-propertyTypes", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await page.click("#campaign-propertyTypes");
  await page.waitForSelector(".campaign-type-popover");
  const popup = await page.$eval(".campaign-type-popover", (e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
  assert.ok(
    popup.left >= 0 &&
      popup.right <= 320 &&
      popup.top >= 0 &&
      popup.bottom <= 740,
  );
  await new Promise((resolve) => setTimeout(resolve, 220));
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/type-dropdown-320.png",
  });
  await click("Reset pilihan", ".campaign-type-footer button");
  await page.keyboard.press("Escape");
  await page.setViewport({ width: 1512, height: 982 });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-auto-assets .campaign-property-card")
        .length === 3,
  );
  const settingsHeight = await page.evaluate(
    () =>
      document.querySelector(".campaign-assets-section").getBoundingClientRect()
        .top -
      document.querySelector(".campaign-form").getBoundingClientRect().top,
  );
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/compact-form-1512.png",
  });
  console.log(
    JSON.stringify({
      compactEditor: await page.evaluate(() => {
        const form = document.querySelector(".campaign-form"),
          fields = document.querySelector(".campaign-form-fields");
        return {
          width: form.getBoundingClientRect().width,
          container: getComputedStyle(form).containerName,
          columns: getComputedStyle(fields).gridTemplateColumns,
          settingsHeight:
            document
              .querySelector(".campaign-assets-section")
              .getBoundingClientRect().top - form.getBoundingClientRect().top,
        };
      }),
    }),
  );
  assert.ok(
    settingsHeight < 800,
    "Desktop settings including discount criteria should precede the asset list within 800px, got " +
      settingsHeight,
  );
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/compact-form-1512.png",
  });
  assert.equal(await page.$("#campaign-asset-search"), null);
  assert.equal(await page.$('input[name="campaign-asset-order"]'), null);
  assert.match(
    await page.$eval(".campaign-auto-summary", (e) => e.textContent),
    /3 aset dipilih otomatis/,
  );
  assert.equal(
    writes.some((w) => w.action === "save"),
    false,
  );
  await fill("#campaign-minPrice", "600000000");
  assert.equal(
    await page.$eval('.campaign-form button[type="submit"]', (e) =>
      e.textContent.trim(),
    ),
    "Simpan draf",
    "old asset IDs cannot schedule while new filter inventory is pending",
  );
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-assets")
      ?.textContent.includes("Belum ada aset layak"),
  );
  assert.equal(
    await page.$eval('.campaign-form button[type="submit"]', (e) => e.disabled),
    false,
  );
  assert.equal(
    await page.$eval('.campaign-form button[type="submit"]', (e) =>
      e.textContent.trim(),
    ),
    "Simpan draf",
  );
  await fill("#campaign-minPrice", "");
  await page.waitForFunction(() =>
    document
      .querySelector('.campaign-form button[type="submit"]')
      .textContent.includes("Simpan ke Planner"),
  );
  const intensity = async (direction) => {
    const selector = `[aria-label="${direction === "less" ? "Kurangi" : "Tambah"} tayangan per hari"]`;
    await page.$eval(selector, (e) => e.scrollIntoView({ block: "center" }));
    await page.click(selector);
  };
  // Numeric typing and clipboard input share the same strict 24-hour mask.
  for (const [raw, expected] of [
    ["1200", "12:00"],
    ["0000", "00:00"],
    ["2359", "23:59"],
  ]) {
    await fill("#campaign-time-0", raw);
    assert.equal(
      await page.$eval("#campaign-time-0", (e) => e.value),
      expected,
    );
    assert.equal(
      await page.$eval("#campaign-time-0", (e) => e.checkValidity()),
      true,
    );
  }
  await fill("#campaign-time-0", "12:00");
  const pasteTime = async (value) => {
    await page.$eval(
      "#campaign-time-0",
      (input, text) => {
        input.focus();
        input.select();
        const data = new DataTransfer();
        data.setData("text/plain", text);
        input.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      value,
    );
  };
  await pasteTime("0930");
  assert.equal(await page.$eval("#campaign-time-0", (e) => e.value), "09:30");
  for (const value of ["2400", "12:60", "120000", "ab1200"]) {
    await pasteTime(value);
    assert.equal(
      await page.$eval("#campaign-time-0", (e) => e.value),
      "09:30",
      "invalid paste retains the previous time",
    );
    assert.match(
      await page.$eval("#campaign-schedules-error", (e) => e.textContent),
      /00–23.*00–59/,
    );
  }
  await fill("#campaign-time-0", "24");
  assert.equal(await page.$eval("#campaign-time-0", (e) => e.value), "2");
  assert.match(
    await page.$eval("#campaign-schedules-error", (e) => e.textContent),
    /00–23/,
  );
  await fill("#campaign-time-0", "23:6");
  assert.equal(await page.$eval("#campaign-time-0", (e) => e.value), "23:6");
  await fill("#campaign-time-0", "12:30");
  await page.$eval("#campaign-time-0", (e) => e.setSelectionRange(4, 5));
  await page.keyboard.type("5");
  assert.equal(await page.$eval("#campaign-time-0", (e) => e.value), "12:35");
  await page.$eval("#campaign-time-0", (e) => e.setSelectionRange(3, 3));
  await page.keyboard.press("Backspace");
  await page.waitForFunction(
    () => document.querySelector("#campaign-time-0").selectionStart === 1,
  );
  assert.equal(
    await page.$eval("#campaign-time-0", (e) => e.selectionStart),
    1,
  );
  await page.keyboard.type("8");
  assert.equal(
    await page.$eval("#campaign-time-0", (e) => e.value),
    "18:35",
    "editing hours must preserve the minutes",
  );
  await page.$eval("#campaign-time-0", (input) =>
    input.setSelectionRange(input.value.length, input.value.length),
  );
  for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
  assert.equal(
    await page.$eval("#campaign-time-0", (input) => input.value),
    "",
    "four digits require exactly four deletions",
  );
  await page.keyboard.type("1300");
  assert.equal(
    await page.$eval("#campaign-time-0", (input) => input.value),
    "13:00",
    "four digit keystrokes replace the entire time",
  );
  const savesBeforeIncompleteTime = writes.filter(
    (entry) => entry.action === "save",
  ).length;
  await fill("#campaign-time-0", "12");
  await page.keyboard.press("Tab");
  assert.match(
    await page.$eval("#campaign-schedules-error", (e) => e.textContent),
    /Lengkapi.*HH:mm/,
  );
  await page.click('.campaign-form button[type="submit"]');
  assert.equal(
    writes.filter((entry) => entry.action === "save").length,
    savesBeforeIncompleteTime,
    "an incomplete time never reaches persistence",
  );
  await fill("#campaign-time-0", "9:30");
  await page.keyboard.press("Tab");
  assert.equal(await page.$eval("#campaign-time-0", (e) => e.value), "09:30");
  await fill("#campaign-time-0", "08:15");
  for (const [index, time] of ["12:30", "15:30", "13:40"].entries())
    await fill("#campaign-time-" + index, time);
  assert.match(
    await page.$eval("#campaign-schedules-error", (e) => e.textContent),
    /Jam 3.*lebih akhir.*Jam 2.*15:30/,
  );
  assert.equal(
    await page.$eval("#campaign-time-2", (e) => e.getAttribute("aria-invalid")),
    "true",
  );
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector("#campaign-time-2"))
          .borderColor !==
        getComputedStyle(document.querySelector("#campaign-time-0"))
          .borderColor,
    ),
    true,
    "the offending time receives a visible error border",
  );
  assert.equal(
    await page.$eval("#campaign-intensity-more", (e) => e.disabled),
    true,
  );
  const beforeWrongOrder = writes.filter(
    (entry) => entry.action === "save",
  ).length;
  await page.click('.campaign-form button[type="submit"]');
  assert.equal(
    writes.filter((entry) => entry.action === "save").length,
    beforeWrongOrder,
    "reversed hours cannot be saved",
  );
  for (const [index, time] of ["08:15", "13:00", "18:00"].entries())
    await fill("#campaign-time-" + index, time);
  await fill("#campaign-time-2", "18:45");
  await intensity("less");
  assert.equal(
    await page.$$eval(".campaign-times input", (els) => els.length),
    2,
  );
  await intensity("more");
  assert.equal(
    await page.$eval("#campaign-time-2", (e) => e.value),
    "18:45",
    "Re-adding a slot restores its edited time",
  );
  for (let i = 3; i < 12; i++) await intensity("more");
  assert.equal(
    await page.$eval("#campaign-intensity-more", (e) => e.disabled),
    true,
  );
  assert.equal(
    await page.$$eval(
      ".campaign-times input",
      (els) => new Set(els.map((e) => e.value)).size,
    ),
    12,
    "Added times remain unique",
  );
  assert.equal(
    await page.$$eval(".campaign-times input", (inputs) =>
      inputs.every(
        (input, index) => index === 0 || inputs[index - 1].value < input.value,
      ),
    ),
    true,
    "all twelve generated slots stay in increasing order",
  );
  for (let i = 12; i > 1; i--) await intensity("less");
  assert.equal(
    await page.$eval("#campaign-intensity-less", (e) => e.disabled),
    true,
  );
  await intensity("more");
  await intensity("more");
  await page.$eval("#campaign-channel-instagram", (e) => e.focus());
  await page.keyboard.press("Space");
  assert.equal(
    await page.$eval("#campaign-channel-instagram", (e) => e.checked),
    false,
    "Space operates the native switch",
  );
  await page.$eval('[data-channel="instagram"]', (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await page.click('[data-channel="instagram"] .campaign-channel-name');
  assert.equal(
    await page.$eval("#campaign-channel-instagram", (e) => e.checked),
    true,
    "The whole channel row toggles",
  );
  assert.equal(
    await page.$eval(
      "#campaign-channel-whatsapp",
      (e) => e.getBoundingClientRect().height >= 44,
    ),
    true,
  );
  for (const [i, time] of ["08:15", "12:30", "17:45"].entries())
    await fill("#campaign-time-" + i, time);
  await page.setViewport({ width: 390, height: 900 });
  await page.click('.campaign-form button[aria-label="Kategori listing"]');
  await page.waitForSelector("[role=option]");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await overflow();
  fs.mkdirSync("/tmp/kosku-campaign-qa-v2", { recursive: true });
  for (const width of [390, 320, 1512]) {
    await page.setViewport({ width, height: 900 });
    for (const [selector, name] of [
      [".campaign-discount-controls", "discount-filters"],
      [".campaign-assets", "assets"],
      [".campaign-times", "times"],
    ]) {
      await page.$eval(selector, (e) => e.scrollIntoView({ block: "center" }));
      await overflow();
      await new Promise((resolve) => setTimeout(resolve, 850));
      await page.screenshot({
        path: "/tmp/kosku-campaign-qa-v2/form-" + name + "-" + width + ".png",
      });
      if (name === "discount-filters") {
        assert.equal(
          await page.$eval(
            "#campaign-minSpread",
            (e) => e.getBoundingClientRect().height >= 44,
          ),
          true,
        );
        await page.click("#campaign-discountMode");
        await page.waitForSelector('[role="listbox"]');
        const rect = await page.$eval('[role="listbox"]', (e) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right };
        });
        assert.ok(
          rect.left >= 0 && rect.right <= width,
          "discount popup fits the viewport",
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => document.activeElement.id === "campaign-discountMode",
        );
      }
    }
  }
  await click("Simpan ke Planner");
  await page
    .waitForSelector('.campaign-form [role="alert"]', { timeout: 10000 })
    .catch(async (failure) => {
      console.log(
        JSON.stringify({
          saveDiagnostic: await page.evaluate(() => ({
            values: Array.from(
              document.querySelectorAll(".campaign-form input"),
            ).map((e) => [e.id, e.value]),
            submit: document.querySelector(
              '.campaign-form button[type="submit"]',
            )?.disabled,
          })),
          actions: writes.map((w) => w.action),
        }),
      );
      await page.screenshot({
        path: "/tmp/kosku-campaign-qa-v2/compact-save-diagnostic.png",
      });
      throw failure;
    });
  assert.equal(
    await page.$eval("#campaign-name", (e) => e.value),
    "Campaign November Rumah Sidoarjo",
  );
  await click("Simpan ke Planner");
  await page.waitForFunction(
    () =>
      document.querySelector('.campaign-form [role="alert"]') &&
      !document.querySelector('.campaign-form button[type="submit"]').disabled,
  );
  assert.match(
    await page.$eval('.campaign-form [role="alert"]', (e) => e.textContent),
    /Draf campaign sudah tersimpan/,
  );
  await click("Simpan ke Planner");
  await page.waitForFunction(
    () =>
      document
        .querySelector('.campaign-form [role="alert"]')
        ?.textContent.includes("Planner belum berhasil diperbarui") &&
      !document.querySelector('.campaign-form button[type="submit"]').disabled,
  );
  assert.equal(
    jobs.length,
    0,
    "failed synchronization never invents Planner jobs",
  );
  await click("Simpan ke Planner");
  await page.waitForSelector(".campaign-proposal");
  assert.equal(campaign.state, "running");
  assert.equal(
    jobs.filter((job) => job.plan.listingId).length,
    2,
    "saving immediately assigns campaign properties in Planner",
  );
  assert.ok(
    proposal.approvedAt,
    "no separate apply action is required after Save to Planner",
  );
  await click("Planner");
  assert.equal(
    new URL(page.url()).searchParams.get("date"),
    day,
    "the ordinary Planner tab opens the first assigned campaign date",
  );
  await page.waitForSelector(".marketing-day-content");
  assert.deepEqual(
    await page.$$eval(".marketing-day-content h3", (rows) =>
      rows.map((row) => row.textContent),
    ),
    [
      "Jalan Pengujian 1",
      "Jalan Pengujian 2",
      "Belum ada properti dijadwalkan",
    ],
  );
  await click("Campaign");
  await page.waitForSelector(".campaign-proposal");
  await click("Susun ulang jadwal");
  await page.waitForFunction(
    () =>
      !!document.querySelector(".campaign-proposal button") &&
      [...document.querySelectorAll(".campaign-proposal button")].some(
        (b) => b.textContent.trim() === "Terapkan jadwal",
      ),
  );
  assert.equal(creates, 1, "generate retry must update the saved draft");
  assert.deepEqual(campaign.brief.schedules, ["08:15", "12:30", "17:45"]);
  assert.equal(campaign.brief.minSpread, 60);
  assert.equal(campaign.brief.minDrop, 75);
  assert.equal(campaign.brief.discountMode, "either");
  assert.equal(proposal.data.unfilled.length, 1);
  assert.doesNotMatch(
    await page.$eval(".campaign-workspace", (e) => e.textContent),
    /Gemini|strategi AI|pesan AI|evaluasi AI/,
  );
  await click("Atur aset & waktu");
  await page.waitForSelector(".campaign-slot-dialog");
  await page.click('.campaign-slot-dialog button[aria-label="Pilih properti"]');
  await page.waitForSelector('[role="option"]');
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await click("Simpan jadwal");
  await page.waitForSelector('.campaign-slot-dialog [role="alert"]');
  await click("Simpan jadwal");
  await page.waitForFunction(
    () => !document.querySelector(".campaign-slot-dialog"),
  );
  await click("Pratinjau");
  await page.waitForSelector(".campaign-preview-modal");
  await page.waitForSelector(".instagram-preview-media img");
  await page.keyboard.press("ArrowRight");
  await page.setViewport({ width: 320, height: 900 });
  await overflow();
  await page.screenshot({ path: "/tmp/kosku-campaign-qa-v2/preview-320.png" });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector(".campaign-preview-modal"),
  );
  await page.setViewport({ width: 1512, height: 900 });
  failApprove = true;
  await click("Terapkan jadwal");
  await click("Terapkan 2 jadwal");
  await page.waitForSelector('.marketing-small-modal [role="alert"]');
  await click("Terapkan 2 jadwal");
  await page.waitForSelector(".campaign-results-list");
  await click("Jeda campaign");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-brief .campaign-status")
      ?.textContent.includes("Dijeda"),
  );
  await click("Lanjutkan");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-brief .campaign-status")
      ?.textContent.includes("Terjadwal"),
  );
  includeRecommendations = true;
  await click("Semua campaign");
  await page.waitForSelector(".campaign-list-row");
  const endedExample = {
    ...clone(campaign),
    id: randomUUID(),
    state: "draft",
    activeBrief: null,
    brief: {
      ...clone(campaign.brief),
      name: "Campaign riwayat Sidoarjo",
      startDate: "2020-01-01",
      endDate: "2020-01-05",
    },
  };
  listExtras = [endedExample];
  await page.click('button[aria-label="Perbarui campaign"]');
  await page.waitForSelector(
    '.campaign-list[data-lifecycle="ended"] .campaign-list-row',
  );
  assert.equal(
    await page
      .$$('.campaign-list[data-lifecycle="current"] .campaign-list-row')
      .then((rows) => rows.length),
    1,
  );
  assert.match(
    await page.$eval(
      '.campaign-list[data-lifecycle="ended"] .campaign-status',
      (e) => e.textContent,
    ),
    /Berakhir/,
  );
  assert.equal(
    await page.$(".campaign-list-entry-expired .marketing-action-primary"),
    null,
    "Expired controls have a subdued secondary presentation",
  );
  await page.waitForSelector(".campaign-ready-grid article");
  assert.equal(
    await page.$$(".campaign-ready-grid article").then((items) => items.length),
    3,
  );
  await page.$eval(".campaign-list-row", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
  await page.screenshot({ path: "/tmp/kosku-campaign-qa-v2/list-1512.png" });
  const listDensity = [];
  for (const width of [1512, 1024, 768, 540, 480, 390, 360, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.$eval(".campaign-list-row", (e) =>
      e.scrollIntoView({ block: "center" }),
    );
    await overflow();
    const height = await page.$eval(".campaign-list-entry", (e) =>
      Math.ceil(e.getBoundingClientRect().height),
    );
    await (
      await page.$(".campaign-list-entry")
    ).screenshot({ path: "/tmp/kosku-campaign-qa-v2/card-" + width + ".png" });
    await (
      await page.$('.campaign-list[data-lifecycle="ended"]')
    ).screenshot({
      path: "/tmp/kosku-campaign-qa-v2/ended-group-" + width + ".png",
    });
    assert.ok(
      height <= (width >= 1512 ? 150 : width <= 540 ? 220 : 280),
      "Campaign row should stay compact at " + width + "px, got " + height,
    );
    assert.ok(
      await page.$eval(
        ".campaign-list-row .campaign-actions button",
        (e) => e.getBoundingClientRect().height >= 44,
      ),
      "Open action keeps a 44px touch target",
    );
    listDensity.push({ width, height });
  }
  console.log(JSON.stringify({ listDensity }));

  listExtras = [
    ...Array.from({ length: 21 }, (_, i) => ({
      ...clone(campaign),
      id: randomUUID(),
      brief: { ...clone(campaign.brief), name: "Campaign berjalan " + i },
    })),
    ...Array.from({ length: 21 }, (_, i) => ({
      ...clone(endedExample),
      id: randomUUID(),
      brief: { ...clone(endedExample.brief), name: "Campaign usai " + i },
    })),
  ];
  await page.click('button[aria-label="Perbarui campaign"]');
  await page.waitForSelector(
    '.campaign-list[data-lifecycle="ended"] .campaign-pagination',
  );
  const nextGroupPage = async (key) =>
    page.$eval(
      `.campaign-list[data-lifecycle="${key}"] .campaign-pagination button:last-child`,
      (e) => e.click(),
    );
  await nextGroupPage("current");
  await page.waitForFunction(
    () =>
      new URL(location.href).searchParams.get("campaignPage") === "2" &&
      !document.querySelector(".campaign-loading") &&
      document.querySelectorAll(
        '.campaign-list[data-lifecycle="current"] .campaign-list-row',
      ).length === 2,
  );
  assert.equal(
    await page
      .$$('.campaign-list[data-lifecycle="current"] .campaign-list-row')
      .then((rows) => rows.length),
    2,
  );
  assert.equal(
    await page
      .$$('.campaign-list[data-lifecycle="ended"] .campaign-list-row')
      .then((rows) => rows.length),
    20,
  );
  await nextGroupPage("ended");
  await page.waitForFunction(
    () =>
      new URL(location.href).searchParams.get("endedCampaignPage") === "2" &&
      !document.querySelector(".campaign-loading") &&
      document.querySelectorAll(
        '.campaign-list[data-lifecycle="ended"] .campaign-list-row',
      ).length === 1,
  );
  assert.equal(
    await page
      .$$('.campaign-list[data-lifecycle="ended"] .campaign-list-row')
      .then((rows) => rows.length),
    1,
  );
  listExtras = [];
  await page.click('button[aria-label="Perbarui campaign"]');
  await page.waitForFunction(
    () =>
      new URL(location.href).searchParams.get("campaignPage") === "1" &&
      new URL(location.href).searchParams.get("endedCampaignPage") === "1" &&
      !document.querySelector(".campaign-loading") &&
      document.querySelectorAll(
        '.campaign-list[data-lifecycle="current"] .campaign-list-row',
      ).length === 1 &&
      document.querySelectorAll(
        '.campaign-list[data-lifecycle="ended"] .campaign-list-row',
      ).length === 0,
  );

  await click("Edit");
  await page.waitForSelector(".campaign-inline-editor #campaign-name");
  assert.ok(
    await page.$(".campaign-list-row"),
    "Editing stays in the campaign list",
  );
  await fill("#campaign-name", "Edit langsung yang dipertahankan");
  await page.waitForFunction(
    () =>
      !document.querySelector('.campaign-inline-editor button[type="submit"]')
        .disabled,
  );
  failSave = true;
  await click("Simpan ke Planner");
  await page.waitForSelector('.campaign-inline-editor [role="alert"]');
  assert.equal(
    await page.$eval("#campaign-name", (e) => e.value),
    "Edit langsung yang dipertahankan",
  );
  await overflow();
  await click("Batal");
  await click("Buang perubahan");
  await page.waitForSelector(".campaign-ready-grid article");
  await click("Campaign baru");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-auto-summary")
      ?.textContent.includes("3 aset dipilih otomatis"),
  );
  assert.equal(await page.$('input[name="campaign-asset-order"]'), null);
  assert.equal(campaign.brief.assetOrder, "fresh");
  assert.match(
    await page.$eval(".campaign-auto-summary", (e) => e.textContent),
    /3 dari 3/,
  );
  await click("Batal");
  await click("Buang perubahan");
  await page.waitForSelector(".campaign-list-row");

  await page.setViewport({ width: 390, height: 900 });
  await page.$eval(".campaign-list-row", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await overflow();
  await new Promise((resolve) => setTimeout(resolve, 900));
  await page.screenshot({ path: "/tmp/kosku-campaign-qa-v2/list-390.png" });
  await click("Buka");
  await page.waitForSelector(".campaign-brief");
  await page.setViewport({ width: 1512, height: 900 });
  await page.$eval(".campaign-stock", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/schedule-1512.png",
  });
  await page.$eval(".campaign-slot-empty", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/empty-slot-1512.png",
  });
  for (const width of [1512, 1024, 768, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await page.evaluate(() => {
      let p = document.querySelector(".campaign-workspace");
      while (p) {
        if (p.scrollHeight > p.clientHeight) p.scrollTop = 0;
        p = p.parentElement;
      }
      window.scrollTo(0, 0);
    });
    await overflow();
    await new Promise((resolve) => setTimeout(resolve, 900));
    await page.screenshot({
      path: "/tmp/kosku-campaign-qa-v2/campaign-" + width + ".png",
      fullPage: true,
    });
    report.push({ width, overflow: false });
  }
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await click("Edit campaign");
  await page.waitForSelector("#campaign-name");
  assert.equal(
    await page.$eval(
      ".campaign-form",
      (e) =>
        getComputedStyle(e).fontFamily ===
        getComputedStyle(document.body).fontFamily,
    ),
    true,
  );
  assert.equal(
    await page.$eval(
      ".campaign-form .marketing-action",
      (e) => getComputedStyle(e).transitionDuration,
    ),
    "0s",
  );

  await fill("#campaign-name", "Draft belum disimpan");
  await click("Planner");
  await page.waitForFunction(() =>
    document
      .querySelector("[role=dialog]")
      ?.textContent.includes("Perubahan belum disimpan"),
  );
  await click("Tetap di sini");
  assert.equal(
    await page.$eval("#campaign-name", (e) => e.value),
    "Draft belum disimpan",
  );
  await click("Batal");
  await click("Buang perubahan");
  const editFixture = async (brief) => {
    campaign.brief = brief;
    await page.goto(
      origin + "/dashboard/pemasaran?tab=campaign&campaign=" + campaign.id,
      { waitUntil: "networkidle2" },
    );
    await page.waitForSelector(".campaign-brief");
    await click("Edit campaign");
    await page.waitForSelector("#campaign-name");
  };
  const generationCount = () =>
    writes.filter((w) => w.action === "generate").length;
  const beforeDraftOnly = generationCount();
  const existingJobs = clone(jobs);
  const savedBrief = clone(campaign.brief);
  await editFixture({
    ...savedBrief,
    listingIds: [],
    minSpread: 100,
    minDrop: 100,
  });
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-auto-assets .marketing-footnote")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await fill("#campaign-name", "Draf filter tanpa aset");
  await page.setViewport({ width: 320, height: 900 });
  await page.$eval(".campaign-form-footer", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await overflow();
  assert.equal(
    await page.$eval('.campaign-form button[type="submit"]', (e) => e.disabled),
    false,
  );
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/draft-save-no-assets-320.png",
  });
  await click("Simpan draf");
  await page.waitForSelector(".campaign-brief");
  assert.equal(campaign.brief.name, "Draf filter tanpa aset");
  assert.deepEqual(campaign.brief.listingIds, []);
  assert.equal(
    generationCount(),
    beforeDraftOnly,
    "empty stock must not block saving or generate a schedule",
  );
  assert.deepEqual(
    jobs,
    existingJobs,
    "saving a draft never replaces approved Planner jobs",
  );

  const today = domain.jakartaDate();
  await editFixture({
    ...savedBrief,
    startDate: today,
    endDate: today,
    schedules: ["00:00"],
    listingIds: [a.id],
  });
  await page.waitForFunction(
    () => !document.querySelector(".campaign-progress"),
  );
  assert.match(
    await page.$eval("#campaign-save-help", (e) => e.textContent),
    /Tidak ada jam tayang mendatang/,
  );
  await click("Simpan draf");
  await page.waitForSelector(".campaign-brief");
  assert.equal(campaign.brief.schedules[0], "00:00");
  assert.equal(
    generationCount(),
    beforeDraftOnly,
    "elapsed times allow draft saving without generating empty plans",
  );
  assert.deepEqual(jobs, existingJobs);
  // Stock cards must not disappear just because the campaign has no remaining hours.
  inventoryTarget = 0;
  await click("Semua campaign");
  await page.waitForSelector(".campaign-ready-grid article");
  assert.equal(
    await page.$$(".campaign-ready-grid article").then((x) => x.length),
    20,
    "the complete fetched stock page remains available in the scrollable strip",
  );
  assert.match(
    await page.$eval(".campaign-inventory-status", (e) => e.textContent),
    /Tidak ada jam tayang mendatang/,
  );
  assert.match(
    await page.$eval(".campaign-ready-summary", (e) => e.textContent),
    /25 aset siap dipilih/,
  );
  assert.doesNotMatch(
    await page.$eval(".campaign-ready-summary", (e) => e.textContent),
    /0\/0/,
  );

  expiredSource = true;
  await page.click('[aria-label="Periksa stok fresh"]');
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-inventory-status")
      ?.textContent.includes("1.545 lelang sudah lewat"),
  );
  assert.equal(
    await page.$(".campaign-ready-grid"),
    null,
    "empty state has no blank card grid",
  );
  assert.match(
    await page.$eval(".campaign-inventory-status", (e) => e.textContent),
    /1.545 aset di sumber · 0 siap tayang/,
  );
  assert.match(
    await page.$eval(".campaign-inventory-status", (e) => e.textContent),
    /3 Jul 2026/,
  );
  assert.equal(
    await page.$eval(".campaign-inventory-status a", (e) =>
      e.getAttribute("href"),
    ),
    "/dashboard/scrape",
  );
  assert.equal(
    await page.$eval(".campaign-inventory-status a", (e) => e.target),
    "_blank",
    "source refresh preserves the open draft",
  );
  await page.setViewport({ width: 320, height: 900 });
  await overflow();
  await page.$eval(".campaign-inventory-status", (e) =>
    e.scrollIntoView({ block: "center" }),
  );
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/expired-source-320.png",
  });
  expiredSource = false;
  inventoryTarget = 3;
  await click("Buka");
  await page.waitForSelector(".campaign-brief");
  await click("Buka Planner");
  await page.waitForSelector(".marketing-planner");
  await click("Riwayat konten dan pengiriman", "summary");
  await page.waitForSelector(".marketing-history[open]");
  await page.goto(origin + "/dashboard/pemasaran?tab=antrean", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector(".marketing-history[open]");
  assert.equal(
    await page.$eval(".marketing-tabs [aria-current=page]", (e) =>
      e.textContent.trim(),
    ),
    "Planner",
  );
  // Explicit local example uses real planner components with no marketing API requests.
  await page.setViewport({ width: 1512, height: 982 });
  await click("Campaign");
  await page.waitForSelector(".campaign-heading");
  const savedBeforeSimulation = JSON.stringify({ campaign, proposal, jobs });
  await click("Coba A, B, C");
  await page.waitForSelector('[data-simulation="campaign"]');
  observingSimulation = true;
  assert.equal(
    await page.$$eval(
      ".campaign-simulation-stock article",
      (els) => els.length,
    ),
    3,
  );
  assert.equal(
    await page.$$eval(
      '.campaign-simulation-slots li[data-filled="true"]',
      (els) => els.length,
    ),
    3,
  );
  assert.deepEqual(
    await page.$$eval(".campaign-simulation-slots time", (els) =>
      els.map((e) => e.textContent.replace(/\./g, ":")),
    ),
    ["09:00WIB", "13:00WIB", "18:00WIB"],
  );
  for (const [index, time] of ["12:30", "15:30", "13:40"].entries())
    await fill("#campaign-time-" + index, time);
  assert.match(
    await page.$eval("#campaign-schedules-error", (e) => e.textContent),
    /Jam 3.*lebih akhir.*15:30/,
  );
  assert.equal(
    await page.$$eval(".campaign-simulation-slots li", (slots) => slots.length),
    0,
  );
  await click("Planner");
  await page.waitForFunction(
    () => document.querySelectorAll(".marketing-day-content").length === 0,
  );
  await click("Campaign");
  await fill("#campaign-time-2", "16:40");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-simulation-slots li").length === 3,
  );
  await page.setViewport({ width: 390, height: 900 });
  await page.$eval(".campaign-schedule-section", (e) =>
    e.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await page.screenshot({ path: "/tmp/kosku-time-order-390.png" });
  await click("Lihat di Planner");
  await page.waitForSelector(".marketing-day-content");
  assert.deepEqual(
    await page.$$eval(".marketing-day-content time", (times) =>
      times.map((time) =>
        time.textContent.replace(/\s+/g, " ").replace(/\./g, ":").trim(),
      ),
    ),
    ["12:30 WIB", "15:30 WIB", "16:40 WIB"],
  );
  await click("Campaign");
  await click("Reset");
  await page.setViewport({ width: 1512, height: 982 });
  await page.screenshot({
    path: "/tmp/kosku-campaign-qa-v2/simulation-campaign-1512.png",
    fullPage: true,
  });
  await click("Lihat di Planner");
  await page.waitForSelector(".marketing-day-content");
  assert.deepEqual(
    await page.$$eval(".marketing-day-content h3", (els) =>
      els.map((e) => e.textContent),
    ),
    [
      "Aset A · rumah contoh",
      "Aset B · gudang contoh",
      "Aset C · gudang contoh",
    ],
  );
  assert.deepEqual(
    await page.$$eval(".marketing-day-content time", (els) =>
      els.map((e) =>
        e.textContent.replace(/\s+/g, " ").replace(/\./g, ":").trim(),
      ),
    ),
    ["09:00 WIB", "13:00 WIB", "18:00 WIB"],
  );
  assert.equal(
    await page.$$eval(
      '.marketing-day-content[data-planner-tone="ready"]',
      (els) => els.length,
    ),
    3,
  );
  await click("Lihat materi");
  await page.waitForSelector('[role="dialog"] .ig-carousel');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"] img')].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await click("Campaign");
  await page.click("#campaign-intensity-less");
  await fill("#campaign-time-0", "11:05");
  await click("Lihat di Planner");
  await page.waitForFunction(
    () => document.querySelectorAll(".marketing-day-content").length === 2,
  );
  assert.match(
    await page.$eval(".marketing-day-content time", (e) => e.textContent),
    /11[:.]05/,
  );
  await click("Campaign");
  await page.click("#campaign-intensity-more");
  assert.equal(
    await page.$eval("#campaign-time-2", (e) => e.value),
    "18:00",
    "removed hours survive moving between Campaign and Planner",
  );
  await page.click("#campaign-intensity-more");
  await click("Lihat di Planner");
  await page.waitForFunction(
    () => document.querySelectorAll(".marketing-day-content").length === 4,
  );
  assert.equal(
    await page.$$eval(
      '.marketing-day-content[data-planner-tone="ready"]',
      (els) => els.length,
    ),
    3,
  );
  assert.match(
    await page.$eval(".marketing-day-panel", (e) => e.textContent),
    /Stok|Belum ada properti dijadwalkan|Tidak ada properti yang ditayangkan/,
  );
  for (const width of [1512, 390, 320]) {
    await page.setViewport({ width, height: 900 });
    await overflow();
    await page.$eval(".marketing-day-panel", (element) =>
      element.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/simulation-agenda-${width}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/simulation-planner-${width}.png`,
      fullPage: true,
    });
    await click("Campaign");
    await page.waitForSelector("#campaign-time-0");
    await overflow();
    const clippedTimes = await page.$$eval(".campaign-rhythm input", (inputs) =>
      inputs
        .filter((input) => {
          const field = input
            .closest(".campaign-time-slot")
            .getBoundingClientRect();
          const rect = input.getBoundingClientRect();
          return rect.left < field.left || rect.right > field.right + 1;
        })
        .map((input) => input.id),
    );
    assert.deepEqual(
      clippedTimes,
      [],
      "time fields must fit their own cards at " + width,
    );
    await page.$eval(".campaign-schedule-section", (element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/simulation-rhythm-${width}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/simulation-campaign-${width}.png`,
      fullPage: true,
    });
    await click("Lihat di Planner");
  }
  await click("Campaign");
  await fill("#campaign-time-1", "11:05");
  await page.waitForSelector("#campaign-schedules-error");
  assert.equal(
    await page.$$eval(".campaign-simulation-slots li", (els) => els.length),
    0,
  );
  await click("Planner");
  await page.waitForFunction(
    () => document.querySelectorAll(".marketing-day-content").length === 0,
  );
  await click("Campaign");
  await click("Reset");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".campaign-simulation-slots li").length === 3,
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('[data-simulation="campaign"]');
  assert.equal(
    await page.$$eval(
      '.campaign-simulation-slots li[data-filled="true"]',
      (els) => els.length,
    ),
    3,
  );
  assert.deepEqual(
    simulationRequests,
    [],
    "simulation must not read or write real marketing data or dummy listing media",
  );
  observingSimulation = false;
  await click("Keluar simulasi");
  await page.waitForSelector(".campaign-heading");
  assert.equal(new URL(page.url()).searchParams.has("simulation"), false);
  assert.equal(await page.$('[data-simulation="campaign"]'), null);
  assert.equal(
    JSON.stringify({ campaign, proposal, jobs }),
    savedBeforeSimulation,
  );
  // A zero-asset draft explains why regular slots have no campaign property and links to its editor.
  const noticeState = clone({ campaign, proposal, jobs });
  campaign = {
    ...campaign,
    state: "draft",
    activeBrief: null,
    brief: {
      ...campaign.brief,
      startDate: day,
      endDate: domain.jakartaDate(
        new Date(Date.parse(day + "T12:00:00+07:00") + 2 * 86400000),
      ),
      schedules: ["07:00", "09:00", "11:00", "14:00", "18:00"],
      listingIds: [],
    },
  };
  proposal = null;
  jobs = [];
  await page.goto(
    origin +
      "/dashboard/pemasaran?tab=planner&month=" +
      day.slice(0, 7) +
      "&date=" +
      day,
    { waitUntil: "networkidle2" },
  );
  await page.waitForSelector(".marketing-campaign-notice");
  assert.match(
    await page.$eval(".marketing-campaign-notice", (e) => e.textContent),
    /0 aset di draf/,
  );
  for (const width of [1512, 1024, 768, 540, 390, 320]) {
    await page.setViewport({ width, height: 950 });
    await overflow();
    for (let offset = 0; offset < 3; offset++) {
      const date = domain.jakartaDate(
        new Date(Date.parse(day + "T12:00:00+07:00") + offset * 86400000),
      );
      assert.equal(
        await page.$$eval(
          `[data-day="${date}"] [data-session]`,
          (els) => els.length,
        ),
        5,
      );
    }
    const geometry = await page.$$eval(
      `[data-day="${day}"] [data-session]`,
      (els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return {
            width: r.width,
            height: r.height,
            top: r.top,
            bottom: r.bottom,
            display: getComputedStyle(e).display,
          };
        }),
    );
    assert.ok(
      geometry.every(
        (r, i) =>
          r.width > 20 &&
          r.height >= 14 &&
          r.display !== "none" &&
          (!i || r.top >= geometry[i - 1].bottom),
      ),
    );
    assert.equal(
      await page.$$eval(".marketing-day-content", (els) => els.length),
      5,
    );
    assert.equal(
      await page.$$eval(".marketing-day-panel button", (els) =>
        els.some((e) => e.textContent.includes("Siapkan materi")),
      ),
      false,
    );
    await page.$eval(".marketing-campaign-notice", (e) =>
      e.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/planner-pending-${width}.png`,
    });
    await page.$eval(".marketing-calendar-shell", (e) =>
      e.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    await page.screenshot({
      path: `/tmp/kosku-campaign-qa-v2/planner-five-sessions-${width}.png`,
    });
  }
  await click("Buka campaign");
  await page.waitForSelector(".campaign-brief");
  assert.equal(new URL(page.url()).searchParams.get("campaign"), campaign.id);
  // Saving a new intensity also invalidates an already-viewed Planner month.
  inventoryTarget = 0;
  await click("Edit campaign");
  await page.waitForSelector("#campaign-time-4");
  await page.click("button[aria-label='Tambah tayangan per hari']");
  await page.waitForFunction(() =>
    document
      .querySelector(".campaign-assets")
      ?.textContent.includes("Belum ada aset layak"),
  );
  await click("Simpan draf");
  await page.waitForSelector(".campaign-brief");
  assert.equal(campaign.brief.schedules.length, 6);
  await click("Planner", ".marketing-tabs button");
  await page.waitForSelector(".marketing-planner");
  assert.equal(
    await page.$$eval(
      `[data-day="${day}"] [data-session]`,
      (els) => els.length,
    ),
    6,
  );
  assert.equal(
    await page.$$eval(".marketing-day-content", (els) => els.length),
    6,
  );
  assert.equal(jobs.length, 0);
  inventoryTarget = 3;
  campaign = noticeState.campaign;
  proposal = noticeState.proposal;
  jobs = noticeState.jobs;
  // Lifecycle follows the approved brief even when the draft has a future period.
  const beforeLifecycle = clone({ campaign, proposal, jobs });
  const endedDay = domain.jakartaDate(new Date(Date.now() - 86400000));
  for (const state of ["draft", "running", "paused"]) {
    campaign = {
      ...clone(beforeLifecycle.campaign),
      state,
      brief: {
        ...clone(beforeLifecycle.campaign.brief),
        startDate: endedDay,
        endDate: endedDay,
      },
      activeBrief: null,
    };
    await page.goto(origin + "/dashboard/pemasaran?tab=campaign", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector('.campaign-status[data-status="Berakhir"]');
    await page.waitForSelector(".campaign-ended-panel");
    assert.equal(await page.$(".campaign-property-card"), null);
    await overflow();
  }
  campaign = {
    ...clone(beforeLifecycle.campaign),
    state: "running",
    brief: {
      ...clone(beforeLifecycle.campaign.brief),
      startDate: day,
      endDate: day,
    },
    activeBrief: {
      ...clone(beforeLifecycle.campaign.brief),
      startDate: endedDay,
      endDate: endedDay,
    },
  };
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('.campaign-status[data-status="Berakhir"]');
  await click("Buka");
  await page.waitForSelector(".campaign-brief");
  assert.match(
    await page.$eval(".campaign-brief", (e) => e.textContent),
    /Perubahan draf belum diterapkan/,
  );
  assert.equal(
    await page.$$eval(".campaign-brief button", (buttons) =>
      buttons.some(
        (b) =>
          b.textContent.includes("Lanjutkan") ||
          b.textContent.includes("Jeda campaign"),
      ),
    ),
    false,
  );
  // An open page rechecks WIB midnight on focus, without a request or reload.
  const currentDay = domain.jakartaDate();
  campaign = {
    ...clone(beforeLifecycle.campaign),
    state: "running",
    activeBrief: null,
    brief: {
      ...clone(beforeLifecycle.campaign.brief),
      startDate: currentDay,
      endDate: currentDay,
    },
  };
  await page.goto(origin + "/dashboard/pemasaran?tab=campaign", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector('.campaign-status[data-status="Aktif"]');
  const savesAtMidnight = writes.filter((w) => w.action === "save").length;
  await page.evaluate(
    (timestamp) => {
      const Original = window.Date;
      window.Date = class extends Original {
        constructor(...args) {
          super(...(args.length ? args : [timestamp]));
        }
        static now() {
          return timestamp;
        }
      };
      window.dispatchEvent(new Event("focus"));
    },
    Date.parse(currentDay + "T17:00:00Z"),
  );
  await page.waitForSelector('.campaign-status[data-status="Berakhir"]');
  await page.waitForSelector(".campaign-ended-panel");
  assert.equal(await page.$(".campaign-property-card"), null);
  assert.equal(
    writes.filter((w) => w.action === "save").length,
    savesAtMidnight,
  );
  campaign = beforeLifecycle.campaign;
  proposal = beforeLifecycle.proposal;
  jobs = beforeLifecycle.jobs;
  assert.deepEqual(errors, []);
  assert.equal(
    writes.some((w) => ["messages", "evaluate"].includes(w.action)),
    false,
  );
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "OWNER/origin/private reads",
        "automatic filtered asset selection without duplicate search or priority controls",
        "Save to Planner applies assignments without a second apply action",
        "failed apply retains the acknowledged draft and retries without duplicate campaigns",
        "ordinary Planner tab opens the first assigned date and invalidates empty month cache",
        "five sessions across three days render fifteen boxes and five agenda cards, down to 320px",
        "empty draft intensity edits refresh the existing Planner cache without creating jobs",
        "pending zero-asset draft notice links to its own campaign",
        "filter changes invalidate previous recommendation IDs",
        "ended drafts/running/paused campaigns, approved period, and live WIB midnight transition",
        "four Backspaces clear four digits and four keys produce HH:mm",
        "daily intensity stepper, 1–12 bounds, retained edited times and unique additions",
        "24-hour time mask, typed/pasted HHmm, valid ranges, caret edits and incomplete-time save protection",
        "strictly increasing hours on edits, all twelve generated slots and Campaign–Planner projection",
        "channel switches support keyboard, full-row activation and 44px targets",
        "unavailable/empty selections still allow draft saving without scheduling",
        "elapsed daily times save as draft and explain the required date/time change",
        "percentage leading zeros normalize immediately and decimal input remains usable",
        "save/generate failure retains form without duplicates",
        "inline edit retains the campaign list and recovers from save failure",
        "real-stock preview and automatic recommendation seeding",
        "stock remains visible without remaining hours; expired source counts and update link explain zero eligibility",
        "new campaigns default to fresh priority",
        "compact editor and Home type dropdown with eight local icons",
        "type multi-selection, reset, arrow keys, Escape, and focus restoration",
        "localized range calendar, presets, cancel, keyboard, and short/narrow viewport",
        "grouped min/max prices with numeric storage and stable middle-edit caret",
        "per-campaign percentage criteria, inclusive bounds, unknown evidence, explicit OR and individual metric modes",
        "percentage criteria persist into saved campaign and Planner plans",
        "dashboard DM Sans, emerald surfaces, colorful accents and neutral borders",
        "no AI calls",
        "asset and time review",
        "preview carousel keyboard",
        "approval conflict recovery",
        "pause/resume",
        "list and empty-slot visual states",
        "local font and reduced motion",
        "unsaved navigation",
        "legacy history URL",
        "explicit A/B/C simulation shares stock, rhythm and Planner with zero marketing requests",
        "simulation intensity, edited times, gaps and invalid input synchronize across tabs",
        "simulation preview, phone layouts, reload, exit and real-data isolation",
      ],
      viewports: report,
      pageErrors: errors,
    }),
  );
} catch (error) {
  if (browser) {
    const active = (await browser.pages()).find((page) =>
      page.url().includes("pemasaran"),
    );
    if (active)
      console.error(
        JSON.stringify({
          pageErrors: errors,
          state: await active.evaluate(() => ({
            url: location.pathname + location.search,
            text: document
              .querySelector(".marketing-workspace")
              ?.innerText.slice(-1800),
          })),
        }),
      );
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await db.$disconnect();
}
