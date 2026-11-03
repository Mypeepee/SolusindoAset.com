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
let browser, page, createdId;
let stage = "setup";
const errors = [];
try {
  const settings = await db.marketingSettings.findUniqueOrThrow({
    where: { id: "company" },
  });
  assert.equal(settings.enabled, false, "Plan QA requires paused automation");
  const publishedBefore = await db.marketingPublication.count({
    where: { state: "published" },
  });
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
  const { DEFAULT_CONFIG } = createLoader()("src/lib/marketing/domain.ts");
  const config = { ...DEFAULT_CONFIG, ...settings.config };
  const dayFor = (value) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      value,
    );
  let day, source;
  for (let offset = 30; offset < 45; offset++) {
    day = dayFor(new Date(Date.now() + offset * 86400000));
    source = new Date(`${day}T${config.schedules[0]}:00+07:00`);
    if (
      !(await db.marketingJob.findUnique({ where: { scheduledFor: source } }))
    )
      break;
    source = null;
  }
  assert.ok(source, "A vacant future slot is required");
  const time = ["10:17", "11:23", "12:37"].find(
    (value) => !config.schedules.includes(value),
  );
  assert.ok(time);
  browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 360000,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => errors.push(error.message));
  let failSave = true;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/api/dashboard/pemasaran" &&
      request.method() === "POST"
    ) {
      const input = JSON.parse(request.postData());
      if (input.action === "configure-plan" && failSave) {
        failSave = false;
        return request.respond({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "PLAN_CONFLICT" }),
        });
      }
    }
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/dashboard/pemasaran") &&
      !url.pathname.startsWith("/api/auth/") &&
      !url.pathname.startsWith("/api/foto/")
    )
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin)
      return request.abort();
    return request.continue();
  });
  const cookieName = process.env.NEXTAUTH_URL?.startsWith("https:")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const headers = { Cookie: cookieName + "=" + token };
  assert.equal(
    (
      await fetch(
        origin +
          "/api/dashboard/pemasaran?mode=candidates&when=" +
          encodeURIComponent(source.toISOString()),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(origin + "/api/dashboard/pemasaran", {
        method: "POST",
        headers: {
          ...headers,
          Origin: "https://outside.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "configure-plan", plan: {} }),
      })
    ).status,
    403,
  );
  await browser.setCookie({
    name: cookieName,
    value: token,
    url: origin,
    httpOnly: true,
    secure: cookieName.startsWith("__Secure-"),
    sameSite: "Lax",
  });
  await page.setViewport({ width: 1440, height: 1000, hasTouch: true });
  await page.goto(
    `${origin}/dashboard/pemasaran?tab=planner&month=${day.slice(0, 7)}&date=${day}`,
    { waitUntil: "networkidle2" },
  );
  stage = "editor";
  await page.waitForSelector(".marketing-day-content");
  const open = await page.evaluateHandle(() =>
    [...document.querySelectorAll(".marketing-day-content button")].find(
      (node) => node.textContent.includes("Atur rencana"),
    ),
  );
  await open.asElement().click();
  await page.waitForSelector(".marketing-plan-dialog");
  assert.equal(await page.$eval("#marketing-plan-date", node => node.type), "button", "The date uses the authored calendar trigger");
  assert.equal(await page.$('.marketing-plan-dialog input[type="date"]'), null, "The browser calendar must not be used");
  await page.click("#marketing-plan-date");
  await page.waitForSelector(".marketing-date-popover");
  assert.deepEqual(await page.$$eval('.marketing-date-popover .react-datepicker__day-name [aria-hidden="true"]', nodes => nodes.map(node => node.textContent)), ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]);
  await page.waitForFunction(() => document.activeElement?.classList.contains('react-datepicker__day'));
  await page.keyboard.press("Escape");
  await page.waitForSelector(".marketing-date-popover", { hidden: true });
  await page.waitForFunction(() => document.activeElement?.id === "marketing-plan-date");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "marketing-plan-date");
  assert.equal(await page.$('.marketing-plan-discard'), null, "Escape must close only the calendar");
  for (const [offset, index] of [[0, 1], [1, 2], [7, 3]]) {
    await page.click(`.marketing-plan-shortcuts[aria-label="Pilihan tanggal cepat"] button:nth-child(${index})`);
    assert.equal(await page.$eval("#marketing-plan-date", node => node.value), dayFor(new Date(Date.now() + offset * 86400000)));
  }
  await page.click("#marketing-plan-date");
  await page.waitForSelector('.marketing-date-popover');
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await page.$(`.marketing-date-popover [data-date="${day}"]`)) break;
    await page.click('.marketing-date-popover button[aria-label="Bulan berikutnya"]');
  }
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.marketing-date-popover')).opacity === '1');
  await page.screenshot({path: "/tmp/kosku-custom-calendar-desktop.png"});
  await page.click(`.marketing-date-popover [data-date="${day}"]`);
  await page.waitForSelector('.marketing-date-popover', {hidden:true});
  assert.equal(await page.$eval('#marketing-plan-date', node => node.value), day);
  await page.click('#marketing-plan-date');
  await page.waitForFunction(() => document.activeElement?.classList.contains('react-datepicker__day'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.marketing-date-popover', {hidden:true});
  const nextDay = new Date(Date.parse(day + 'T12:00:00Z') + 86400000).toISOString().slice(0,10);
  assert.equal(await page.$eval('#marketing-plan-date', node => node.value), nextDay, 'Keyboard selects a real date');
  await page.click('#marketing-plan-date');
  await page.waitForSelector('.marketing-date-popover');
  await page.click(`.marketing-date-popover [data-date="${day}"]`);
  await page.waitForSelector('.marketing-date-popover', {hidden:true});
  await page.focus("#marketing-plan-time");
  await page.$eval("#marketing-plan-time", node => node.select());
  await page.keyboard.type(time.replace(":", ""));
  assert.equal(
    await page.$eval("#marketing-plan-time", (node) => node.value),
    time,
  );
  if (await page.$eval("#marketing-plan-whatsapp", (node) => node.checked))
    await page.click("#marketing-plan-whatsapp");
  if (!(await page.$eval("#marketing-plan-instagram", (node) => node.checked)))
    await page.click("#marketing-plan-instagram");
  const waitCandidates = (query = "", offset = 0) =>
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/dashboard/pemasaran" &&
        url.searchParams.get("mode") === "candidates" &&
        url.searchParams.get("query") === query &&
        Number(url.searchParams.get("offset")) === offset &&
        response.status() === 200
      );
    });
  let fetched = waitCandidates();
  await page.click(".marketing-plan-mode-options input:not(:checked)");
  const initialOptions = await (await fetched).json();
  stage = "property search";
  console.log("Editor and initial property search loaded");
  assert.ok(
    initialOptions.items.length > 0,
    "Opening displays properties without typing",
  );
  await page.waitForSelector('.marketing-property-dropdown [role="option"]');
  if (initialOptions.nextOffset < initialOptions.total) {
    const nextPage = waitCandidates("", initialOptions.nextOffset);
    await page.focus('.marketing-property-dropdown input[type="search"]');
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("role")),
      "option",
    );
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("type")),
      "search",
      "Shift+Tab must return from the list to search",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert.match(
      await page.evaluate(() => document.activeElement?.textContent),
      /Muat properti berikutnya/,
    );
    await page.keyboard.press("Enter");
    await nextPage;
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(
          '.marketing-property-dropdown [role="option"]',
        ).length >= count,
      {},
      initialOptions.items.length,
    );
  }
  await page.keyboard.press("Escape");
  await page.waitForSelector(".marketing-property-dropdown", { hidden: true });
  assert.ok(await page.$(".marketing-plan-dialog"));
  assert.equal(
    await page.$(".marketing-plan-discard"),
    null,
    "Escape closes only the dropdown",
  );
  await page.waitForFunction(
    () => document.activeElement?.id === "marketing-plan-property",
  );
  fetched = waitCandidates();
  await page.click("#marketing-plan-property");
  await fetched;
  const missingQuery = "zzpropertitidakadaqaplan";
  fetched = waitCandidates(missingQuery);
  await page.focus('.marketing-property-dropdown input[type="search"]');
  await page.keyboard.type(missingQuery);
  await fetched;
  await page.waitForFunction(
    () =>
      !![
        ...document.querySelectorAll(".marketing-property-dropdown button"),
      ].find((node) => node.textContent.includes("Tampilkan semua properti")),
  );
  fetched = waitCandidates();
  await page.evaluate(() =>
    [...document.querySelectorAll(".marketing-property-dropdown button")]
      .find((node) => node.textContent.includes("Tampilkan semua properti"))
      .click(),
  );
  await fetched;
  // A real location with expired auctions must show why its matches are blocked,
  // rather than pretending no properties exist.
  fetched = waitCandidates("manukan");
  await page.focus('.marketing-property-dropdown input[type="search"]');
  await page.keyboard.type("manukan");
  const locationMatches = await (await fetched).json();
  assert.ok(
    locationMatches.items.length > 0,
    "Manukan search returns real matches",
  );
  assert.ok(
    locationMatches.items.some(
      (asset) => asset.unavailableReason === "AUCTION_EXPIRED",
    ),
  );
  await page.waitForSelector(
    '.marketing-property-dropdown [role="option"][data-disabled]',
  );
  const blocked = locationMatches.items.find(
    (asset) => asset.unavailableReason,
  );
  await page.click(`#marketing-property-option-${blocked.id}`);
  assert.ok(
    await page.$(".marketing-property-dropdown"),
    "Unavailable assets cannot be selected",
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".marketing-property-dropdown img")].some(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  await page.screenshot({ path: "/tmp/kosku-picker-manukan.png" });
  const firstEligible = initialOptions.items.find(
    (asset) => !asset.unavailableReason,
  );
  assert.ok(firstEligible, "A selectable real property is required");
  const query = firstEligible.city;
  fetched = waitCandidates(query);
  await page.focus('.marketing-property-dropdown input[type="search"]');
  await page.$eval(".marketing-property-dropdown input", (node) =>
    node.select(),
  );
  await page.keyboard.press("Backspace");
  await page.keyboard.type(query);
  const filtered = await (await fetched).json();
  assert.equal(
    await page.$eval(
      ".marketing-property-dropdown input",
      (node) => node.value,
    ),
    query,
    "Spaces in search must not select or close options",
  );
  await page.waitForSelector('.marketing-property-dropdown [role="option"]');
  const propertyId = filtered.items.find(
    (asset) => !asset.unavailableReason,
  ).id;
  await page.screenshot({ path: "/tmp/kosku-property-dropdown-desktop.png" });
  await page.focus('.marketing-property-dropdown input[type="search"]');
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("role")),
    "option",
  );
  await page.keyboard.press("Enter");
  await page.waitForSelector(".marketing-property-dropdown", { hidden: true });
  await page.waitForSelector("[data-plan-selected]");
  assert.match(
    await page.$eval("#marketing-plan-property", (node) => node.textContent),
    new RegExp(filtered.items[0].city),
  );
  fetched = waitCandidates(query);
  await page.click("#marketing-plan-property");
  await fetched;
  assert.equal(await page.$eval('.marketing-property-dropdown input', node => node.value), query, "Reopening keeps the search query");
  fetched = waitCandidates();
  await page.click('.marketing-property-dropdown button[aria-label="Hapus pencarian"]');
  await fetched;
  fetched = waitCandidates(query);
  await page.focus('.marketing-property-dropdown input[type="search"]');
  await page.keyboard.type(query);
  await fetched;
  await page.waitForSelector('.marketing-property-dropdown [role="option"]');
  assert.equal(
    await page.evaluate(
      () =>
        document.activeElement ===
        document.querySelector(".marketing-property-dropdown input"),
    ),
    true,
    "Loading results must not steal search focus after a property is selected",
  );
  await page.keyboard.press("Escape");
  await page.waitForSelector(".marketing-property-dropdown", { hidden: true });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".marketing-plan-discard");
  await page.click(".marketing-plan-discard button");
  assert.equal(
    await page.$eval("#marketing-plan-time", (node) => node.value),
    time,
  );
  await page.screenshot({ path: "/tmp/kosku-content-plan-desktop.png" });
  stage = "responsive picker";
  let lastQuery = "";
  for (const width of [1440, 1024, 768, 390, 320]) {
    stage = `responsive picker ${width}`;
    console.log(`Checking viewport ${width}`);
    const touch = width <= 1024;
    await page.setViewport({
      width,
      height: 800,
      hasTouch: true,
    });
    assert.equal(
      await page.$eval(
        ".marketing-plan-dialog",
        (node) => node.scrollWidth <= node.clientWidth,
      ),
      true,
      `Editor overflow at ${width}`,
    );
    await page.focus("#marketing-plan-time");
    await page.keyboard.press("Tab");
    const chrome = await page.$eval('.marketing-plan-editor', node => {
      const dialog = node.getBoundingClientRect();
      const heading = node.querySelector('.marketing-plan-heading').getBoundingClientRect();
      const footer = node.querySelector('.marketing-plan-footer').getBoundingClientRect();
      return { dialog: {top:dialog.top,bottom:dialog.bottom}, heading: {top:heading.top,bottom:heading.bottom}, footer: {top:footer.top,bottom:footer.bottom}, scrollTop: node.scrollTop };
    });
    assert.ok(chrome.heading.top >= chrome.dialog.top, `Header must remain visible at ${width}`);
    assert.ok(chrome.footer.bottom <= chrome.dialog.bottom + 1, `Footer must remain inside the dialog at ${width}`);
    assert.equal(chrome.scrollTop, 0, `Only the form body may scroll at ${width}`);
    await page.click('#marketing-plan-date');
    await page.waitForSelector('.marketing-date-popover');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.marketing-date-popover')).opacity === '1');
    assert.equal(await page.$eval('.marketing-date-popover', node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && node.scrollWidth <= node.clientWidth;
    }), true, `Calendar must fit at ${width}`);
    if (width === 390 || width === 320) await page.screenshot({path:`/tmp/kosku-custom-calendar-${width}.png`});
    await page.keyboard.press('Escape');
    await page.waitForSelector('.marketing-date-popover', {hidden:true});
    await page.waitForFunction(() => document.activeElement?.id === 'marketing-plan-date');
    assert.equal(
      await page.$eval(".marketing-plan-dialog", (node) =>
        node.contains(document.activeElement),
      ),
      true,
    );
    if (width === 320)
      await page.screenshot({ path: "/tmp/kosku-content-plan-mobile.png" });
    await page.$eval("#marketing-plan-property", (node) =>
      node.scrollIntoView({ block: "center" }),
    );
    const initial = waitCandidates(lastQuery);
    if (touch) await (await page.$("#marketing-plan-property")).tap();
    else await page.click("#marketing-plan-property");
    await initial;
    await page.waitForSelector(".marketing-property-dropdown");
    if (lastQuery) {
      assert.equal(await page.$eval('.marketing-property-dropdown input', node => node.value), lastQuery);
      const clearing = waitCandidates();
      await page.click('.marketing-property-dropdown button[aria-label="Hapus pencarian"]');
      await clearing;
      lastQuery = "";
    }
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '.marketing-property-dropdown [role="option"]',
        ).length > 3,
    );
    const space = await page.$eval(".marketing-property-dropdown", (node) => {
      const panel = node.getBoundingClientRect();
      const body = node.querySelector("[data-search-select-scroll]");
      const bounds = body.getBoundingClientRect();
      const visible = [...node.querySelectorAll('[role="option"]')].filter(
        (option) => {
          const row = option.getBoundingClientRect();
          return row.top >= bounds.top && row.bottom <= bounds.bottom;
        },
      ).length;
      return {
        height: panel.height,
        listHeight: bounds.height,
        visible,
        footerScrolls: body.contains(
          node.querySelector("[data-search-select-footer]"),
        ),
      };
    });
    assert.ok(
      space.listHeight >= space.height * 0.65,
      `List is too small at ${width}: ${JSON.stringify(space)}`,
    );
    assert.ok(
      space.visible >= 3,
      `At least three complete options must be visible at ${width}: ${JSON.stringify(space)}`,
    );
    assert.equal(
      space.footerScrolls,
      true,
      "Load more belongs at the end of the scrolling list",
    );
    const headerBefore = await page.$eval(
      ".marketing-property-dropdown header",
      (node) => node.getBoundingClientRect().top,
    );
    if (touch) {
      const body = await page.$eval("[data-search-select-scroll]", (node) => {
        const r = node.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + Math.min(160, r.height / 2),
        };
      });
      const session = await page.createCDPSession();
      await session.send("Input.synthesizeScrollGesture", {
        ...body,
        yDistance: -240,
        speed: 800,
        gestureSourceType: "touch",
      });
      await session.detach();
    } else {
      await page.hover("[data-search-select-scroll]");
      await page.mouse.wheel({ deltaY: 260 });
    }
    await page.waitForFunction(
      () => document.querySelector("[data-search-select-scroll]").scrollTop > 0,
    );
    assert.equal(
      await page.$eval(
        ".marketing-property-dropdown header",
        (node) => node.getBoundingClientRect().top,
      ),
      headerBefore,
      "Search header stays fixed while the list scrolls",
    );
    await page.$eval("[data-search-select-scroll]", (node) => {
      node.scrollTop = 0;
    });
    await (
      await page.$(".marketing-property-dropdown")
    ).screenshot({ path: `/tmp/kosku-picker-panel-${width}.png` });
    if (width === 320) {
      // A soft keyboard can shrink only visualViewport, leaving innerHeight intact.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, "height", {
          configurable: true,
          get: () => 380,
        });
        window.visualViewport.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(() => {
        const panel = document
          .querySelector(".marketing-property-dropdown")
          .getBoundingClientRect();
        const body = document
          .querySelector("[data-search-select-scroll]")
          .getBoundingClientRect();
        return panel.top >= 0 && panel.bottom <= 380 && body.height >= 200;
      });
      await (
        await page.$(".marketing-property-dropdown")
      ).screenshot({ path: "/tmp/kosku-picker-keyboard-space.png" });
      await page.evaluate(() => {
        delete window.visualViewport.height;
        window.visualViewport.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector(".marketing-property-dropdown")
            .getBoundingClientRect().height > 700,
      );
    }
    assert.equal(
      await page.$eval(".marketing-property-dropdown", (node) => {
        const box = node.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth &&
          node.scrollWidth <= node.clientWidth
        );
      }),
      true,
      `Dropdown overflow at ${width}`,
    );
    assert.equal(
      await page.$eval("#marketing-plan-property", (node) =>
        node.getAttribute("aria-expanded"),
      ),
      "true",
    );
    if (await page.$eval('.marketing-property-dropdown input', node => !!node.value)) {
      const cleared = waitCandidates();
      await page.click('.marketing-property-dropdown button[aria-label="Hapus pencarian"]');
      await cleared;
    }
    const idSearch = waitCandidates(propertyId);
    await page.focus('.marketing-property-dropdown input[type="search"]');
    await page.keyboard.type(propertyId);
    const exact = await (await idSearch).json();
    lastQuery = propertyId;
    assert.equal(
      exact.items.length,
      1,
      "Search by ID returns the selected property",
    );
    assert.equal(exact.items[0].unavailableReason, null);
    const option = `#marketing-property-option-${propertyId}`;
    await page.waitForSelector(option);
    await page.$eval(option, (node) =>
      node.scrollIntoView({ block: "nearest" }),
    );
    await page.waitForFunction(
      (selector) => {
        const image = document.querySelector(selector + " img");
        return image?.complete && image.naturalWidth > 0;
      },
      {},
      option,
    );
    if (width === 320)
      await page.screenshot({
        path: "/tmp/kosku-property-dropdown-mobile.png",
      });
    if (touch) await (await page.$(option)).tap();
    else await page.click(option);
    await page.waitForSelector(".marketing-property-dropdown", {
      hidden: true,
    });
    await page.waitForFunction(() => {
      const image = document.querySelector("#marketing-plan-property img");
      return image?.complete && image.naturalWidth > 0;
    });
    assert.match(
      await page.$eval("#marketing-plan-property", (node) => node.textContent),
      new RegExp(firstEligible.city),
    );
  }
  await page.click('.marketing-plan-footer button[type="submit"]');
  stage = "save recovery";
  await page.waitForSelector(".marketing-plan-form > [role=alert]");
  assert.equal(
    await page.$eval("#marketing-plan-time", (node) => node.value),
    time,
  );
  assert.equal(
    await page.$eval("#marketing-plan-whatsapp", (node) => node.checked),
    false,
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/dashboard/pemasaran"),
  );
  await page.click('.marketing-plan-footer button[type="submit"]');
  const response = await responsePromise;
  const result = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(result));
  createdId = result.job.id;
  await page.waitForSelector(".marketing-plan-dialog", { hidden: true });
  const saved = await db.marketingJob.findUniqueOrThrow({
    where: { id: createdId },
  });
  assert.equal(saved.plan.listingId, propertyId);
  assert.deepEqual(saved.plan.channels, ["instagram"]);
  assert.equal(saved.snapshot.id, propertyId);
  assert.equal(saved.listingId, null);
  assert.equal(
    saved.scheduledFor.toISOString(),
    new Date(`${day}T${time}:00+07:00`).toISOString(),
  );
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector(".marketing-day-content");
  assert.ok(await page.$('[data-planner-tone="planned"]'));
  assert.equal(
    await page.$$eval(
      '.marketing-day-content[data-planner-tone="planned"] .marketing-day-channel',
      (nodes) => nodes.length,
    ),
    1,
  );
  assert.equal(
    await page.$eval(
      '.marketing-day-content[data-planner-tone="planned"]',
      (node) => node.textContent.includes("Feed Instagram"),
    ),
    true,
  );
  assert.equal(
    (await db.marketingSettings.findUniqueOrThrow({ where: { id: "company" } }))
      .enabled,
    false,
  );
  assert.equal(
    await db.marketingPublication.count({ where: { state: "published" } }),
    publishedBefore,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      realPropertySelected: true,
      searchableDropdown: true,
      dropdownKeyboardAndEscape: true,
      savedAndReloaded: true,
      channels: ["instagram"],
      customTime: true,
      authoredCalendar: true,
      localizedCalendar: true,
      calendarKeyboardAndFocus: true,
      failedSaveRetained: true,
      dirtyClose: true,
      viewports: [1440, 1024, 768, 390, 320],
      thumbnailsLoaded: true,
      blockedSearchMatchesExplained: true,
      actualTouchSelection: true,
      spaciousListAndTouchScrolling: true,
      visualKeyboardViewport: true,
      publishedNothing: true,
    }),
  );
} catch (error) {
  console.error(JSON.stringify({ stage, error: error.message, stack: error.stack, browserErrors: errors }));
  await page
    ?.screenshot({ path: "/tmp/kosku-content-plan-failure.png" })
    .catch(() => {});
  throw error;
} finally {
  if (createdId) {
    const markers = await db.marketingJob.findMany({
      where: {
        reason: "RESCHEDULED",
        plan: { path: ["replacementId"], equals: createdId },
      },
      select: { id: true },
    });
    await db.marketingJob.deleteMany({
      where: {
        id: { in: [createdId, ...markers.map((item) => item.id)] },
        publications: { none: { attemptCount: { gt: 0 } } },
      },
    });
  }
  await db.$disconnect();
  if (browser) {
    const timeout = setTimeout(() => browser.process()?.kill("SIGKILL"), 5000);
    try {
      await browser.close();
    } finally {
      clearTimeout(timeout);
    }
  }
}
