import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3038";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
const output = "/tmp/kosku-settings-qa";
const errors = [];
const checks = [];
let browser;
let stage = "setup";
try {
  await mkdir(output, { recursive: true });
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
    : "next-auth.session-token";
  const response = await fetch(origin + "/api/dashboard/pemasaran", {
    headers: { Cookie: cookieName + "=" + token },
  });
  assert.equal(response.status, 200);
  const original = await response.json();
  let snapshot = structuredClone(original);
  let failSave = false;
  let slowSave = false;
  let postCount = 0;
  let lastSaved;
  browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 180000,
    executablePath:
      process.env.MARKETING_QA_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname === "/api/dashboard/pemasaran") {
      if (request.method() === "GET") {
        return request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            url.searchParams.get("mode") === "planner"
              ? snapshot.planner
              : snapshot,
          ),
        });
      }
      // Every marketing mutation is intercepted: no saved settings, activation or Status delivery changes.
      postCount++;
      const input = JSON.parse(request.postData());
      if (input.action !== "settings")
        return request.respond({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "INVALID_SETTINGS" }),
        });
      if (failSave) {
        failSave = false;
        return request.respond({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "SETTINGS_CONFLICT" }),
        });
      }
      lastSaved = input.config;
      snapshot.config = {
        ...input.config,
        revision: input.config.revision + 1,
      };
      const reply = () =>
        request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ config: snapshot.config }),
        });
      if (slowSave) {
        slowSave = false;
        setTimeout(() => void reply(), 700);
        return;
      }
      return reply();
    }
    if (
      url.origin === origin &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth/")
    ) {
      return request.respond({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    }
    if (!["data:", "blob:"].includes(url.protocol) && url.origin !== origin)
      return request.abort();
    return request.continue({
      headers:
        url.origin === origin
          ? { ...request.headers(), cookie: cookieName + "=" + token }
          : request.headers(),
    });
  });
  const go = async () => {
    await page.goto(origin + "/dashboard/pemasaran?tab=pengaturan", {
      waitUntil: "networkidle2",
    });
    await page.waitForSelector(".ms-workspace");
  };
  const fill = async (selector, value) => {
    await page.$eval(
      selector,
      (element, next) => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(element, next);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      },
      value,
    );
  };
  const click = async (selector) => {
    const element = await page.$(selector);
    assert.ok(element, selector);
    await element.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await element.click();
  };
  const expectFocus = async (id) => {
    await page.waitForFunction(
      (value) => document.activeElement?.id === value,
      { timeout: 10000 },
      id,
    );
  };
  stage = "responsive";
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    console.log("Responsive viewport", width);
    await page.setViewport({
      width,
      height: width <= 390 ? 844 : 1000,
      deviceScaleFactor: 1,
    });
    await go();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const geometry = await page.evaluate(() => {
      const form = document.querySelector(".ms-workspace");
      const rect = form.getBoundingClientRect();
      const footer = document.querySelector(".ms-savebar");
      return {
        viewport: innerWidth,
        contentWidth: Math.round(rect.width),
        documentWidth: document.documentElement.scrollWidth,
        overflowing: [...form.querySelectorAll("input, button, .ms-shell")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width > 0 &&
              (r.right > rect.right + 1 || r.left < rect.left - 1)
            );
          })
          .map((el) => el.id || el.className),
        columns: getComputedStyle(
          form.querySelector(".ms-grid"),
        ).gridTemplateColumns.split(" ").length,
        footerPosition: getComputedStyle(footer).position,
      };
    });
    assert.ok(geometry.documentWidth <= width + 1, JSON.stringify(geometry));
    assert.deepEqual(geometry.overflowing, [], JSON.stringify(geometry));
    assert.equal(geometry.footerPosition, "static");
    checks.push({ width, ...geometry });
    await page.screenshot({
      path: `${output}/settings-${width}.png`,
      fullPage: false,
    });
    for (const id of ["ms-accounts", "ms-selection", "ms-audience"]) {
      await page.$eval("#" + id, (el) => el.scrollIntoView({ block: "start" }));
      await new Promise((resolve) => setTimeout(resolve, 850));
      await page.screenshot({ path: `${output}/settings-${width}-${id}.png` });
    }
  }
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await go();
  stage = "save and failure";
  await fill("#marketing-companyName", "QA · pengaturan pemasaran");
  await page.waitForSelector(".ms-savebar.has-changes");
  assert.equal(await page.$eval(".ms-activate", (el) => el.disabled), true);
  failSave = true;
  await click('.ms-savebar button[type="submit"]');
  await page.waitForFunction(() =>
    document.querySelector('[role="alert"]')?.textContent.includes("sesi lain"),
  );
  assert.equal(
    await page.$eval("#marketing-companyName", (el) => el.value),
    "QA · pengaturan pemasaran",
  );
  assert.ok(await page.$(".ms-savebar.has-changes"));
  slowSave = true;
  await click('.ms-savebar button[type="submit"]');
  await page.waitForSelector('.ms-savebar button[aria-busy="true"]');
  assert.equal(
    await page.$eval('.ms-savebar button[type="submit"]', (el) => el.disabled),
    true,
  );
  await page.waitForFunction(
    () => !document.querySelector(".ms-savebar.has-changes"),
  );
  assert.equal(lastSaved.companyName, "QA · pengaturan pemasaran");
  checks.push(
    "Failed save retains draft; slow successful save disables duplicate submission and commits response.",
  );

  stage = "validation";
  await fill("#marketing-companyName", "");
  await click('.ms-savebar button[type="submit"]');
  await page.waitForSelector('#marketing-companyName[aria-invalid="true"]');
  await expectFocus("marketing-companyName");
  assert.ok(await page.$("#marketing-companyName-error"));
  await click(".ms-save-actions button:first-child");
  assert.equal(
    await page.$eval("#marketing-companyName", (el) => el.value),
    snapshot.config.companyName,
  );
  assert.equal(await page.$(".ms-savebar.has-changes"), null);

  stage = "schedules";
  assert.equal((await page.$$(".ms-chips input")).length, 8);
  const lastTypeSelected = await page.$eval(
    ".ms-chips label:last-child input",
    (el) => el.checked,
  );
  await click(".ms-chips label:last-child");
  assert.equal(
    await page.$eval(".ms-chips label:last-child input", (el) => el.checked),
    !lastTypeSelected,
  );
  await click(".ms-save-actions button:first-child");
  const slotsBefore = await page.$$(".ms-time-slot");
  await click(".ms-add-slot");
  assert.equal((await page.$$(".ms-time-slot")).length, slotsBefore.length + 1);
  const times = await page.$$eval(".ms-time-slot input", (els) =>
    els.map((el) => el.value),
  );
  assert.equal(new Set(times).size, times.length);
  await fill("#marketing-schedule-1", times[0]);
  await click('.ms-savebar button[type="submit"]');
  await page.waitForFunction(() =>
    document
      .querySelector("#marketing-schedules-help")
      ?.textContent.includes("berulang"),
  );
  await expectFocus("marketing-schedule-0");
  await click(".ms-save-actions button:first-child");
  checks.push(
    "Required identity and duplicate schedules expose associated errors and focus; cancel restores saved settings.",
  );

  stage = "keyboard select";
  await click("#marketing-category");
  await page.waitForSelector(".ms-category-options");
  const popup = await page.evaluate(() => ({
    trigger: document
      .querySelector("#marketing-category")
      .getBoundingClientRect().width,
    popup: document
      .querySelector(".ms-category-options")
      .getBoundingClientRect().width,
  }));
  assert.ok(Math.abs(popup.trigger - popup.popup) <= 1, JSON.stringify(popup));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => !document.querySelector(".ms-category-options"),
  );
  await expectFocus("marketing-category");
  await click(".ms-save-actions button:first-child");

  stage = "switches";
  const instagramBefore = await page.$eval(
    '.ms-channel-instagram input[role="switch"]',
    (el) => el.checked,
  );
  await page.focus('.ms-channel-instagram input[role="switch"]');
  await page.keyboard.press("Space");
  assert.equal(
    await page.$eval(
      '.ms-channel-instagram input[role="switch"]',
      (el) => el.checked,
    ),
    !instagramBefore,
  );
  await click(".ms-save-actions button:first-child");

  stage = "audience states";
  snapshot.connection.whatsapp.contacts = [
    { jid: "628111111111@s.whatsapp.net", name: "Contoh · kontak uji" },
    {
      jid: "628222222222@s.whatsapp.net",
      name: "Contoh · nama kontak yang sangat panjang untuk verifikasi pembungkusan teks",
    },
  ];
  snapshot.config.whatsappAudience = [];
  await go();
  await fill("#marketing-contact-search", "tidak-cocok");
  await page.waitForSelector(".ms-no-results");
  await click('[aria-label="Hapus pencarian kontak"]');
  assert.equal((await page.$$(".ms-contact-list label")).length, 2);
  await expectFocus("marketing-contact-search");
  await click(".ms-contact-list label:first-child");
  assert.ok(
    (await page.$eval(".ms-audience-summary", (el) => el.textContent)).includes(
      "1 kontak dipilih",
    ),
  );
  await click(".ms-test summary");
  assert.ok(await page.$(".ms-test[open] #marketing-testPhone"));
  assert.equal(
    await page.$eval(".ms-test-body button", (el) => el.disabled),
    true,
  );
  checks.push(
    "Search/no results/clear, contact selection, keyboard switches and authored category popup verified.",
  );

  stage = "mobile and reduced motion";
  await click(".ms-save-actions button:first-child");
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await go();
  await click("#marketing-category");
  await page.waitForSelector(".ms-category-options");
  const narrowPopup = await page.$eval(".ms-category-options", (el) => ({
    left: el.getBoundingClientRect().left,
    right: el.getBoundingClientRect().right,
  }));
  assert.ok(narrowPopup.left >= 0 && narrowPopup.right <= 390);
  await page.keyboard.press("Escape");
  await click(".ms-test summary");
  await page.focus("#marketing-testPhone");
  await page.screenshot({
    path: output + "/settings-mobile-contacts.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
    0,
  );
  snapshot.connection.whatsapp.contacts = [];
  await go();
  assert.ok(await page.$(".ms-empty-contacts"));
  checks.push(
    "Empty contacts, mobile popup collision, expanded test form and reduced motion verified.",
  );
  assert.deepEqual(errors, []);
  assert.equal(
    postCount,
    2,
    "Only the two mocked settings requests reached the network layer",
  );
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      { checks, errors, mockedMutations: postCount, persistentMutations: 0 },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks, errors, output, persistentMutations: 0 }, null, 2),
  );
} catch (error) {
  console.error("Settings QA failed at", stage, error);
  if (browser)
    await (
      await browser.pages()
    )
      .at(-1)
      ?.screenshot({ path: output + "/failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  await db.$disconnect();
}
