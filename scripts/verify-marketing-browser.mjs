import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3034";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser, page;
const errors = [];
const localDay = (date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(date);
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
  const headers = { Cookie: cookieName + "=" + token };
  const data = await (
    await fetch(origin + "/api/dashboard/pemasaran", { headers })
  ).json();
  assert.equal(
    data.config.enabled,
    false,
    "Browser QA requires paused automation",
  );
  const monthlyResponse = await fetch(
    origin +
      "/api/dashboard/pemasaran?mode=planner&month=" +
      data.planner.month,
    { headers },
  );
  assert.equal(monthlyResponse.status, 200);
  const monthly = await monthlyResponse.json();
  assert.deepEqual(Object.keys(monthly).sort(), [
    "campaignPeriods",
    "jobs",
    "month",
    "now",
    "pendingCampaigns",
  ]);
  const beforePublished = await db.marketingPublication.count({
    where: { state: "published" },
  });
  const wrongOrigin = await fetch(origin + "/api/dashboard/pemasaran", {
    method: "POST",
    headers: {
      ...headers,
      Origin: "https://outside.example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "preview" }),
  });
  assert.equal(wrongOrigin.status, 403);
  const badSlot = await fetch(origin + "/api/dashboard/pemasaran", {
    method: "POST",
    headers: { ...headers, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "plan",
      scheduledFor: "2020-01-01T02:00:00Z",
    }),
  });
  assert.equal(badSlot.status, 400);
  assert.equal((await badSlot.json()).error, "INVALID_PLANNING_SLOT");
  browser = await puppeteer.launch({
    protocolTimeout: 360000,
    headless: true,
    executablePath:
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().startsWith(origin + "/api/dashboard/pemasaran")
    )
      return;
    try {
      const action = JSON.parse(response.request().postData()).action;
      const body = await response.json();
      console.log(
        JSON.stringify({
          action,
          status: response.status(),
          error: body.error || null,
        }),
      );
    } catch {}
  });
  await page.setRequestInterception(true);
  let failMonthOnce = null;
  let slowMonthOnce = null;
  let signedIn = false;
  const reads = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const requestOptions =
      signedIn && url.origin === origin
        ? {
            headers: { ...request.headers(), cookie: cookieName + "=" + token },
          }
        : undefined;
    if (
      request.method() === "GET" &&
      url.pathname === "/api/dashboard/pemasaran"
    ) {
      reads.push({
        mode: url.searchParams.get("mode"),
        month: url.searchParams.get("month"),
      });
      if (slowMonthOnce && url.searchParams.get("month") === slowMonthOnce) {
        slowMonthOnce = null;
        setTimeout(
          () => void request.continue(requestOptions).catch(() => {}),
          700,
        );
        return;
      }
    }
    if (
      failMonthOnce &&
      request.method() === "GET" &&
      url.pathname === "/api/dashboard/pemasaran" &&
      url.searchParams.get("month") === failMonthOnce
    ) {
      failMonthOnce = null;
      return request.respond({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVICE_UNAVAILABLE" }),
      });
    }
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/dashboard/pemasaran") &&
      !url.pathname.startsWith("/api/auth/")
    )
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin)
      return request.abort();
    return request.continue(requestOptions);
  });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  assert.equal(
    await page.evaluate(
      async () => (await fetch("/api/dashboard/pemasaran")).status,
    ),
    401,
  );
  assert.equal(
    await page.evaluate(
      async () => (await fetch("/api/dashboard/pemasaran?mode=planner")).status,
    ),
    401,
  );
  // Attach the test session only to this loopback origin after anonymous checks.
  signedIn = true;
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await page.goto(origin + "/dashboard/pemasaran", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector(".marketing-calendar");
  assert.equal(
    await page.$eval(".marketing-planner-toolbar", (node) =>
      node.textContent.includes("Asia/Jakarta"),
    ),
    false,
  );
  assert.ok(
    await page.$eval(".marketing-planner-toolbar", (node) => {
      const month = node.querySelector(".marketing-planner-month");
      const channels = node.querySelector(".marketing-planner-channels");
      return (
        Math.abs(
          month.getBoundingClientRect().top -
            channels.getBoundingClientRect().top,
        ) < 8
      );
    }),
    "Desktop month controls and channels share one row",
  );
  assert.equal(await page.$eval("h1", (node) => node.textContent), "Pemasaran");
  assert.match(
    await page.$eval(".marketing-live", (node) => node.textContent),
    /dijeda/,
  );
  const today = localDay(new Date());
  await page.focus(`button[data-day="${today}"]`);
  await page.keyboard.press("ArrowRight");
  const tomorrow = localDay(new Date(Date.now() + 86400000));
  await page.waitForFunction(
    (day) =>
      document
        .querySelector(`button[data-day="${day}"]`)
        ?.getAttribute("aria-pressed") === "true" &&
      document.activeElement?.getAttribute("data-day") === day,
    {},
    tomorrow,
  );
  assert.equal(new URL(page.url()).searchParams.get("date"), tomorrow);
  await page.screenshot({
    path: "/tmp/kosku-planner-before.png",
    fullPage: true,
  });
  let prepared = false;
  // Opt-in creates one real, reversible asset plan. It never activates automation.
  if (process.env.MARKETING_QA_PREPARE === "1") {
    const hasMaterial = await page.$(".marketing-day-content img");
    if (!hasMaterial) {
      const prepare = await page.evaluateHandle(() =>
        [...document.querySelectorAll(".marketing-day-content button")].find(
          (node) => node.textContent.includes("Siapkan materi"),
        ),
      );
      const button = prepare.asElement();
      assert.ok(button);
      await button.evaluate((node) => node.scrollIntoView({ block: "center" }));
      await button.click();
      await page.waitForFunction(
        () =>
          !!document.querySelector(".marketing-preview-modal") ||
          !!document.querySelector(".marketing-banner[role=alert]"),
        { timeout: 290000 },
      );
      const failure = await page.$(".marketing-banner[role=alert]");
      assert.equal(
        failure ? await failure.evaluate((node) => node.textContent) : null,
        null,
      );
      assert.ok(await page.$(".marketing-preview-images img"));
      await page.screenshot({ path: "/tmp/kosku-planner-material.png" });
      await page.keyboard.press("Escape");
      await page.waitForSelector(".marketing-preview-modal", { hidden: true });
      prepared = true;
    }
  }
  // Assigned properties already have source photos before media is rendered.
  // Only rendered content exposes the material preview action.
  if (
    await page.evaluate(() =>
      [...document.querySelectorAll(".marketing-day-content button")].some(
        (node) => node.textContent.includes("Lihat materi"),
      ),
    )
  ) {
    const material = await page.evaluateHandle(() =>
      [...document.querySelectorAll(".marketing-day-content button")].find(
        (node) => node.textContent.includes("Lihat materi"),
      ),
    );
    const button = material.asElement();
    await button.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await button.click();
    await page.waitForSelector(".marketing-preview-modal");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".marketing-preview-images img")].every(
        (node) => node.complete && node.naturalWidth > 0,
      ),
    );
    assert.deepEqual(
      await page.$$eval(".marketing-preview-images img", (nodes) =>
        nodes.map((node) => [node.naturalWidth, node.naturalHeight]),
      ),
      [
        [1080, 1350],
        [1080, 1920],
      ],
    );
    await page.screenshot({ path: "/tmp/kosku-planner-material.png" });
    await page.keyboard.press("Escape");
    await page.waitForSelector(".marketing-preview-modal", { hidden: true });
  }
  await page.screenshot({
    path: "/tmp/kosku-planner-1440.png",
    fullPage: true,
  });
  await (
    await page.$(".marketing-planner-toolbar")
  ).screenshot({
    path: "/tmp/kosku-planner-toolbar.png",
  });
  const calendarReadStart = reads.length;
  const nextMonth = await page.$('button[aria-label="Bulan berikutnya"]');
  const next = new Date(
    new URL(page.url()).searchParams.get("month") + "-01T00:00:00Z",
  );
  next.setUTCMonth(next.getUTCMonth() + 1);
  const followingMonth = next.toISOString().slice(0, 7);
  failMonthOnce = followingMonth;
  await nextMonth.click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("h2")].some(
      (node) => node.textContent === "Planner bulan ini belum dapat dimuat",
    ),
  );
  assert.equal(await page.$(".marketing-calendar"), null);
  assert.ok(await page.$(".marketing-planner-toolbar"));
  assert.equal(
    await page.$eval(
      'button[aria-label="Bulan sebelumnya"]',
      (node) => node.disabled,
    ),
    false,
  );
  const retry = await page.evaluateHandle(() =>
    [...document.querySelectorAll(".marketing-empty button")].find((node) =>
      node.textContent.includes("Coba kembali"),
    ),
  );
  await retry.asElement().click();
  await page.waitForFunction(
    () =>
      !!document.querySelector(".marketing-calendar") &&
      !document.querySelector(".marketing-planner-skeleton"),
  );
  assert.ok(new URL(page.url()).searchParams.get("date").endsWith("-01"));
  await page.click('button[aria-label="Bulan sebelumnya"]');
  await page.waitForSelector(".marketing-calendar");
  const cachedReadCount = reads.length;
  const goToday = async () => {
    await page.evaluate(() =>
      [...document.querySelectorAll(".marketing-planner-date-controls button")]
        .find((node) => node.textContent.trim() === "Hari ini")
        .click(),
    );
    await page.waitForFunction(
      (day) =>
        document
          .querySelector(`button[data-day="${day}"]`)
          ?.getAttribute("aria-pressed") === "true",
      {},
      today,
    );
  };
  await page.click('button[aria-label="Bulan berikutnya"]');
  await page.waitForFunction(
    (month) => !!document.querySelector(`button[data-day="${month}-01"]`),
    {},
    followingMonth,
  );
  await goToday();
  await goToday();
  await page.click('.marketing-planner-channels [data-channel="instagram"]');
  await page.click('.marketing-planner-channels [data-channel="all"]');
  assert.equal(
    reads.length,
    cachedReadCount,
    "Cached months, same-month Today and channel filters make no requests",
  );
  assert.ok(
    reads.slice(calendarReadStart).every((read) => read.mode === "planner"),
    "Calendar navigation never reloads the full dashboard",
  );

  // Leave an uncached response pending, then go back to a cached month. An
  // aborted or late response must not replace the selected month or freeze UI.
  // A future slot may put the earlier checks in next month at month-end.
  // Today returns to the real current month; traverse all cached months first.
  for (
    let step = 0;
    step < 12 &&
    new URL(page.url()).searchParams.get("month") !== followingMonth;
    step++
  ) {
    const previous = new URL(page.url()).searchParams.get("month");
    await page.click('button[aria-label="Bulan berikutnya"]');
    await page.waitForFunction(
      (previous) => {
        const month = new URL(location.href).searchParams.get("month");
        return (
          month !== previous &&
          !!document.querySelector(`button[data-day="${month}-01"]`)
        );
      },
      {},
      previous,
    );
  }
  assert.equal(new URL(page.url()).searchParams.get("month"), followingMonth);
  next.setUTCMonth(next.getUTCMonth() + 1);
  slowMonthOnce = next.toISOString().slice(0, 7);
  await page.click('button[aria-label="Bulan berikutnya"]');
  await page.waitForFunction(
    () =>
      document
        .querySelector(".marketing-planner-calendar-region")
        ?.getAttribute("aria-busy") === "true",
  );
  assert.equal(
    await page.$eval(".marketing-workspace", (node) =>
      node.getAttribute("aria-busy"),
    ),
    "false",
  );
  assert.equal(
    await page.$eval(
      'button[aria-label="Perbarui Pemasaran"]',
      (node) => node.disabled,
    ),
    false,
  );
  await page.click('button[aria-label="Bulan sebelumnya"]');
  await page.waitForFunction(
    (month) => !!document.querySelector(`button[data-day="${month}-01"]`),
    {},
    followingMonth,
  );
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(new URL(page.url()).searchParams.get("month"), followingMonth);
  assert.ok(await page.$(`button[data-day="${followingMonth}-01"]`));
  await goToday();

  const fullReadsBeforeRefresh = reads.filter((read) => !read.mode).length;
  await page.click('button[aria-label="Perbarui Pemasaran"]');
  await page.waitForFunction(
    () =>
      !document.querySelector('button[aria-label="Perbarui Pemasaran"]')
        ?.disabled,
  );
  assert.equal(
    reads.filter((read) => !read.mode).length,
    fullReadsBeforeRefresh + 1,
  );
  const readsBeforeInvalidation = reads.length;
  const afterToday = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  afterToday.setUTCMonth(afterToday.getUTCMonth() + 1);
  await page.click('button[aria-label="Bulan berikutnya"]');
  await page.waitForFunction(
    (month) => !!document.querySelector(`button[data-day="${month}-01"]`),
    {},
    afterToday.toISOString().slice(0, 7),
  );
  assert.equal(
    reads.length,
    readsBeforeInvalidation + 1,
    "Full refresh invalidates previously cached months",
  );
  await goToday();
  const selectTab = async (name) => {
    await page.evaluate(
      (label) =>
        [...document.querySelectorAll(".marketing-tabs button")]
          .find((node) => node.textContent.trim() === label)
          .click(),
      name,
    );
  };
  await selectTab("Analitik");
  await page.waitForSelector(
    '.marketing-analytics-workspace[aria-busy="false"] .analytics-content',
  );
  assert.ok(await page.$(".analytics-coverage"));
  await page.screenshot({
    path: "/tmp/kosku-planner-analytics.png",
    fullPage: true,
  });
  await selectTab("Pengaturan");
  await page.waitForSelector("#marketing-companyName");
  await page.click(".ms-connection-actions button");
  await page.waitForSelector(".marketing-instagram-setup");
  assert.equal(
    await page.$$eval(".marketing-setup-checks li", (nodes) => nodes.length),
    data.connection.instagram.setup.checks.length,
  );
  await page.keyboard.press("Escape");
  await page.waitForSelector(".marketing-instagram-setup", { hidden: true });
  await page.$eval('button[aria-label="Kategori listing"]', (node) =>
    node.scrollIntoView({ block: "center" }),
  );
  await page.click('button[aria-label="Kategori listing"]');
  await page.waitForSelector("[role=listbox]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document.activeElement ===
        document.querySelector('button[aria-label="Kategori listing"]') &&
      !document.querySelector("[role=listbox]"),
  );
  const company = await page.$eval(
    "#marketing-companyName",
    (node) => node.value,
  );
  await page.focus("#marketing-companyName");
  await page.keyboard.press("End");
  await page.keyboard.type(" uji");
  await selectTab("Planner");
  await page.waitForSelector("[role=dialog]");
  await page.keyboard.press("Escape");
  assert.equal(
    await page.$eval("#marketing-companyName", (node) => node.value),
    company + " uji",
  );
  await selectTab("Planner");
  await page.waitForSelector("[role=dialog]");
  const discard = await page.evaluateHandle(() =>
    [...document.querySelectorAll("[role=dialog] button")].find((node) =>
      node.textContent.includes("Buang perubahan"),
    ),
  );
  await discard.asElement().click();
  await page.click(".marketing-history > summary");
  await page.waitForSelector(".marketing-history[open] .marketing-job-list");
  await selectTab("Planner");
  await page.waitForSelector(".marketing-calendar");
  const tomorrowButton = await page.$(`button[data-day="${tomorrow}"]`);
  if (tomorrowButton) await tomorrowButton.click();
  for (const width of [1024, 768, 320]) {
    await page.setViewport({
      width,
      height: width === 320 ? 720 : 1050,
      deviceScaleFactor: 1,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Page overflows at ${width}`,
    );
    await page.$eval(".marketing-workspace", (node) => {
      let parent = node.parentElement;
      while (parent) {
        if (
          parent.scrollHeight > parent.clientHeight &&
          /auto|scroll/.test(getComputedStyle(parent).overflowY)
        )
          parent.scrollTop = 0;
        parent = parent.parentElement;
      }
      window.scrollTo(0, 0);
    });
    assert.equal(
      await page.$eval(
        ".marketing-calendar",
        (node) => node.scrollWidth <= node.clientWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `/tmp/kosku-planner-${width}.png`,
      fullPage: true,
    });
  }
  await selectTab("Pengaturan");
  await page.waitForSelector("#marketing-schedule-2");
  await page.$eval("#marketing-schedule-2", (node) =>
    node.scrollIntoView({ block: "end" }),
  );
  await page.focus("#marketing-schedule-2");
  await page.waitForFunction(
    () =>
      document.querySelector("#marketing-schedule-2").getBoundingClientRect()
        .bottom <=
      document.querySelector(".marketing-savebar").getBoundingClientRect().top -
        12,
  );
  assert.deepEqual(errors, []);
  assert.equal(
    (await db.marketingSettings.findUnique({ where: { id: "company" } }))
      .enabled,
    false,
  );
  assert.equal(
    await db.marketingPublication.count({ where: { state: "published" } }),
    beforePublished,
  );
  console.log(
    JSON.stringify({
      passed: true,
      viewports: [1440, 1024, 768, 320],
      checked: [
        "OWNER/401/403",
        "calendar month navigation",
        "compact single-row desktop toolbar",
        "calendar-only requests and month cache",
        "rapid navigation cancels stale responses",
        "cache invalidation after full refresh",
        "keyboard day selection",
        "URL date state",
        "failed month recovery without stale content",
        "analytics",
        "Instagram setup",
        "unsaved changes",
        "responsive layout",
        "unobscured keyboard focus",
      ],
      preparedOneRealDraft: prepared,
      publishedNothing: true,
    }),
  );
} catch (error) {
  try {
    await page?.screenshot({
      path: "/tmp/kosku-planner-failure.png",
      fullPage: true,
    });
  } catch {}
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
