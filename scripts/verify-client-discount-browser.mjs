import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.DISCOUNT_QA_ORIGIN || "http://127.0.0.1:3036";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let browser;
let page;
let stage = "setup";
const errors = [];
try {
  const agent = await db.agent.findFirst({ where: { jabatan: "OWNER", pengguna: { status_akun: "AKTIF" } }, select: { id_agent: true, id_pengguna: true } });
  assert.ok(agent);
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { id: agent.id_pengguna, sub: agent.id_pengguna, peran: "AGENT", role: "AGENT", jabatan: "OWNER", agentId: agent.id_agent, _refreshedAt: Date.now() } });
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setCookie({ name: process.env.NEXTAUTH_URL?.startsWith("https:") ? "__Secure-next-auth.session-token" : "next-auth.session-token", value: token, url: origin, secure: process.env.NEXTAUTH_URL?.startsWith("https:") || false, httpOnly: true });
  const now = new Date().toISOString();
  const pref = { id_preferensi: "900000001", id_klien: "KL900000001", tipe_properti: "RUMAH", jenis_transaksi: null, lokasi_dicari: "Surabaya", loc_provinsi: "Jawa Timur", loc_kota: "Surabaya", loc_kecamatan: null, loc_kelurahan: null, budget_min: null, budget_max: 500000000, luas_min: null, luas_max: null, legalitas: null, dekat_nilai: null, dekat_radius: null, alamat_teks: null, tujuan_beli: null, catatan: null, diskon_jenis: null, diskon_persen: null, dibuat_pada: now };
  const client = { id_klien: pref.id_klien, id_agent: agent.id_agent, nama: "Klien QA Diskon", nomor_whatsapp: null, email: null, sumber: "website", metode_pembayaran: null, bank_kpr: null, tenor_kpr: null, tanggal_masuk: now, tanggal_kontak_terakhir: null, tanggal_follow_up: null, status: "lead_baru", catatan: null, dibuat_pada: now, diperbarui_pada: now, preferensi: [pref] };
  let attempts = 0;
  let saved;
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/dashboard/klien")) {
      let body = { ok: true, data: [], total: 0 };
      let status = 200;
      if (url.pathname === "/api/dashboard/klien") body = { ok: true, data: [client], total: 1 };
      if (url.pathname.endsWith("/statistik")) body = { ok: false };
      if (url.pathname.endsWith("/preferensi") && request.method() === "PUT") {
        attempts++;
        const payload = JSON.parse(request.postData());
        saved = payload.preferensi;
        if (attempts === 1) { status = 500; body = { ok: false, message: "Gagal menyimpan preferensi. Coba lagi." }; }
        else { client.preferensi = saved.map((row, i) => ({ ...pref, ...row, id_preferensi: String(900000002 + i) })); body = { ok: true, data: client.preferensi }; }
      }
      void request.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    } else void request.continue();
  });
  await page.setViewport({ width: 1365, height: 1000 });
  stage = "load CRM";
  await page.goto(origin + "/dashboard/crm", { waitUntil: "domcontentloaded", timeout: 180000 });
  stage = "open client";
  await page.locator("text/Klien QA Diskon").click();
  await page.waitForSelector('[title="Edit preferensi ini"]');
  await page.click('[title="Edit preferensi ini"]');
  stage = "discount dropdown";
  await page.waitForSelector("#pref-diskon-jenis");
  const open = async () => { await page.locator("#pref-diskon-jenis").click(); await page.waitForSelector('[data-search-portal][role="listbox"]', { visible: true }); };
  const checkPopup = async () => {
    const geometry = await page.evaluate(() => {
      const trigger = document.querySelector("#pref-diskon-jenis").getBoundingClientRect();
      const list = document.querySelector('[data-search-portal][role="listbox"]');
      const popup = list.getBoundingClientRect();
      return { trigger: trigger.width, popup: popup.width, left: popup.left, right: popup.right, width: innerWidth, options: [...list.querySelectorAll('[role="option"]')].map(node => ({ text: node.textContent, icons: node.querySelectorAll("svg").length })) };
    });
    assert.equal(geometry.options.length, 3);
    assert.ok(geometry.options.every(option => option.icons > 0));
    assert.ok(Math.abs(geometry.trigger - geometry.popup) <= 1, JSON.stringify(geometry));
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.width);
  };
  await open();
  await checkPopup();
  await page.keyboard.press("End");
  await page.waitForFunction(() => document.activeElement?.textContent === "Keduanya");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-search-portal][role="listbox"]', { hidden: true });
  assert.match(await page.$eval("#pref-diskon-jenis", node => node.textContent), /Keduanya/);
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.disabled), false);
  await page.screenshot({ path: "/tmp/kosku-discount-desktop.png" });
  await page.locator("#pref-diskon-persen").fill("050");
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.value), "50");
  await page.locator("text/Simpan Perubahan").click();
  stage = "save failure and retry";
  await page.locator("text/Gagal menyimpan preferensi. Coba lagi.").wait();
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.value), "50");
  await page.locator("text/Simpan Perubahan").click();
  await page.waitForSelector("#pref-diskon-jenis", { hidden: true });
  assert.equal(saved[0].diskon_jenis, "KEDUANYA");
  assert.equal(saved[0].diskon_persen, 50);
  await page.click('[title="Edit preferensi ini"]');
  await page.waitForSelector("#pref-diskon-jenis");
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.value), "50");
  await page.setViewport({ width: 390, height: 844 });
  stage = "mobile dropdown";
  await open();
  await checkPopup();
  await page.screenshot({ path: "/tmp/kosku-discount-mobile.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "pref-diskon-jenis");
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.locator('[aria-label="Hapus preferensi diskon"]').click();
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.value), "");
  assert.equal(await page.$eval("#pref-diskon-persen", node => node.disabled), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, desktop: true, mobile: true, icons: 3, keyboard: true, leadingZeros: true, failureRecovery: true, saveAndReopen: true, clear: true, reducedMotion: true, persistentClientWrites: 0 }));
} catch (error) {
  console.error("Browser QA stage:", stage);
  if (page && !page.isClosed()) await page.screenshot({ path: "/tmp/kosku-discount-browser-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
