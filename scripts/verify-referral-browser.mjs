import assert from "node:assert/strict";
import fs from "node:fs/promises";
import puppeteer from "puppeteer";

const origin = process.env.REFERRAL_QA_ORIGIN || "http://127.0.0.1:3037";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await puppeteer.launch({
  executablePath: process.env.REFERRAL_QA_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
let stage = "profile";
const errors = [];
let page;
try {
  page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  const user = {
    id: "referral-qa", id_pengguna: "referral-qa", name: "Agent QA",
    nama_lengkap: "Agent QA", email: "agent-qa@example.test", role: "AGENT",
    peran: "AGENT", nomor_telepon: "+6281234567890", kota_asal: "Surabaya",
    kode_referral: "", image: null,
  };
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith("/api/")) {
      const body = url.pathname === "/api/auth/session"
        ? { user, expires: "2099-01-01T00:00:00.000Z" }
        : url.pathname === "/api/profile"
          ? { pengguna: user, agent: { id_agent: "AG108", nama_kantor: "QA", status_keanggotaan: "AKTIF" }, stats: {} }
          : { ok: true, data: [], count: 0, unreadCount: 0 };
      void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    } else void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.referralQA = { clipboard: [], opened: [], shares: [], shareMode: "success", copyMode: "success", fallback: true };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value) => {
        if (window.referralQA.copyMode === "error") throw new Error("Denied");
        window.referralQA.clipboard.push(value);
      },
    } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (payload) => {
      window.referralQA.shares.push(payload);
      if (window.referralQA.shareMode === "abort") throw new DOMException("Cancelled", "AbortError");
      if (window.referralQA.shareMode === "error") throw new Error("Unsupported");
    } });
    document.execCommand = () => {
      window.referralQA.fallbackValue = document.querySelector("textarea[readonly]")?.value;
      return window.referralQA.fallback;
    };
    window.open = (...args) => { window.referralQA.opened.push(args); return null; };
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded", timeout: 180000 });
  const share = '[aria-label="Bagikan ajakan bergabung jadi agent"]';
  const copy = '[title="Salin pesan ajakan dan link referral"]';
  const code = '[title="Salin kode referral"]';
  await page.waitForSelector(share, { visible: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction((selector) => {
    let node = document.querySelector(selector);
    while (node) {
      if (parseFloat(getComputedStyle(node).opacity) < 0.99) return false;
      node = node.parentElement;
    }
    return true;
  }, {}, share);
  assert.equal(await page.$eval(share, (node) => node.querySelectorAll("svg").length), 1);
  assert.equal(await page.$eval(copy, (node) => node.querySelectorAll("svg").length), 1);
  await page.$eval(share, (node) => node.scrollIntoView({ block: "center" }));

  stage = "responsive row";
  const layouts = [];
  for (const width of [320, 360, 390, 466, 640, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 900 });
    const layout = await page.$eval(share, (button) => {
      const row = button.parentElement.parentElement;
      const rects = [row.firstElementChild, ...row.querySelectorAll("button")].map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, right: r.right, y: r.y, height: r.height, width: r.width };
      });
      const card = row.parentElement.getBoundingClientRect();
      const number = row.firstElementChild.children[1].firstElementChild;
      return { width: innerWidth, rects, left: card.left, right: card.right, numberClipped: number.scrollWidth > number.clientWidth };
    });
    assert.ok(layout.rects.every((r) => Math.abs(r.y + r.height / 2 - layout.rects[0].y - layout.rects[0].height / 2) < 2), JSON.stringify(layout));
    assert.ok(layout.rects.every((r) => r.x >= layout.left && r.right <= layout.right + 1), JSON.stringify(layout));
    assert.equal(layout.numberClipped, false, JSON.stringify(layout));
    assert.ok(layout.rects[2].x >= layout.rects[0].right, JSON.stringify(layout));
    layouts.push(layout);
    if ([390, 1440].includes(width)) {
      await page.$eval(share, (node) => node.scrollIntoView({ block: "center" }));
      const card = await page.$(share).then((el) => el.evaluateHandle((node) => node.parentElement.parentElement.parentElement));
      await card.screenshot({ path: `/tmp/kosku-referral-${width}.png` });
      await card.dispose();
    }
  }

  stage = "copy invitation and stable feedback";
  const before = await page.$eval(copy, (node) => node.offsetWidth);
  await page.click(copy);
  await page.waitForFunction(() => window.referralQA.clipboard.length === 1);
  const invitation = await page.evaluate(() => window.referralQA.clipboard[0]);
  assert.match(invitation, /Yuk, bergabung jadi agent/);
  assert.match(invitation, /AG108/);
  assert.match(invitation, /Gabung Jadi Agent/);
  assert.match(invitation, /https:\/\/solusindoaset\.com\/r\/AG108/);
  assert.doesNotMatch(invitation, /localhost|127\.0\.0\.1/);
  assert.equal(await page.$eval(copy, (node) => node.offsetWidth), before);
  await page.waitForFunction((selector) => document.querySelector(selector).getAttribute("aria-label") === "Salin pesan ajakan dan link referral", {}, copy);
  await page.click(code);
  assert.equal(await page.evaluate(() => window.referralQA.clipboard.at(-1)), "AG108");

  stage = "native share, cancel and WhatsApp fallback";
  await page.click(share);
  const payload = await page.evaluate(() => window.referralQA.shares.at(-1));
  assert.equal(`${payload.text}\n${payload.url}`, invitation);
  await page.evaluate(() => { window.referralQA.shareMode = "abort"; });
  await page.click(share);
  assert.equal(await page.evaluate(() => window.referralQA.opened.length), 0);
  await page.evaluate(() => { window.referralQA.shareMode = "error"; });
  await page.click(share);
  const fallback = await page.evaluate(() => window.referralQA.opened.at(-1)[0]);
  assert.equal(new URL(fallback).searchParams.get("text"), invitation);
  await page.evaluate(() => { Object.defineProperty(navigator, "share", { configurable: true, value: undefined }); });
  await page.click(share);
  assert.equal(await page.evaluate(() => window.referralQA.opened.length), 2);

  stage = "clipboard fallback and failure";
  await page.evaluate(() => { window.referralQA.copyMode = "error"; });
  await page.click(copy);
  assert.equal(await page.evaluate(() => window.referralQA.fallbackValue), invitation);
  assert.equal(await page.$$("textarea[readonly]").then((nodes) => nodes.length), 0);
  assert.equal(await page.$eval(copy, (node) => node === document.activeElement), true);
  await page.waitForFunction((selector) => document.querySelector(selector).getAttribute("aria-label") === "Salin pesan ajakan dan link referral", {}, copy);
  await page.evaluate(() => { window.referralQA.fallback = false; });
  await page.click(copy);
  await page.waitForSelector('[data-sonner-toast][data-type="error"]');
  assert.equal(await page.$eval(copy, (node) => node.getAttribute("aria-label")), "Salin pesan ajakan dan link referral");

  stage = "keyboard and reduced motion";
  await page.focus(code);
  await page.keyboard.press("Tab");
  assert.equal(await page.$eval(share, (node) => node === document.activeElement), true);
  assert.notEqual(await page.$eval(share, (node) => getComputedStyle(node).outlineStyle), "none");
  await page.keyboard.press("Tab");
  assert.equal(await page.$eval(copy, (node) => node === document.activeElement), true);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  assert.ok(await page.$eval(copy, (node) => parseFloat(getComputedStyle(node).transitionDuration) <= 0.001));

  stage = "actual HTTP referral redirect";
  for (const path of ["/r/AG108", "/r/ag0108", "/r/invalid", "/r/%25"]) {
    const response = await fetch(`${origin}${path}`, {
      redirect: "manual", headers: { "x-forwarded-host": "solusindoaset.com", "x-forwarded-proto": "https" },
    });
    assert.equal(response.status, 307);
    const location = response.headers.get("location");
    assert.equal(location, path.includes("invalid") || path.includes("%25") ? "/" : "/?ref=AG108&daftar=1");
    assert.equal(new URL(location, `https://solusindoaset.com${path}`).origin, "https://solusindoaset.com");
  }
  assert.deepEqual(errors, []);
  const report = { ok: true, layouts, checks: ["invitation copy", "code-only copy", "stable feedback", "native sharing", "cancel", "WhatsApp fallback", "clipboard denial", "keyboard", "reduced motion", "HTTP redirect"] };
  await fs.writeFile("/tmp/kosku-referral-browser.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, widths: layouts.map((row) => row.width), checks: report.checks }));
} catch (error) {
  console.error(stage, error);
  if (page) {
    console.error(JSON.stringify({ url: page.url(), errors, text: await page.$eval("body", (node) => node.innerText.slice(0, 3000)) }));
    await page.screenshot({ path: "/tmp/kosku-referral-failure.png", fullPage: true });
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
