// Read-only QA: real client/criteria, no client edits and no outgoing messages.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.CLIENT_EMPTY_QA_ORIGIN || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const clientId = process.env.CLIENT_EMPTY_QA_ID || "KL00050";
const db = new PrismaClient();
let browser;
let stage = "setup";
let page;
try {
  const client = await db.klien.findUnique({ where: { id_klien: clientId }, select: { nama: true, id_agent: true } });
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
  let phase = "live";
  let evidence;
  page.on("response", async response => {
    if (response.url().includes(`/klien/${clientId}/rekomendasi/siap`) && response.status() === 200) {
      const data = await response.json().catch(() => null);
      if (data?.diagnosa) evidence = data;
    }
  });
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      void request.respond({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Read-only QA" }) });
    } else if (request.url().includes(`/klien/${clientId}/rekomendasi/siap`) && phase === "offline") {
      void request.abort("failed");
    } else if (request.url().includes(`/klien/${clientId}/rekomendasi/siap`) && phase !== "live") {
      void request.respond({ status: phase === "fail" ? 503 : 200, contentType: "application/json",
        body: JSON.stringify(phase === "fail" ? { ok: false, message: "Uji kegagalan pencarian" } : { ok: true }) });
    } else void request.continue();
  });
  await page.setViewport({ width: 1365, height: 1000 });
  stage = "load CRM";
  const initialResponse = page.waitForResponse(response => response.url().includes(`/klien/${clientId}/rekomendasi/siap`));
  await page.goto(origin + `/dashboard/crm?klien=${encodeURIComponent(clientId)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  stage = "open real matching results";
  const response = await initialResponse;
  assert.equal(response.status(), 200);
  evidence = await response.json();
  await page.locator("text/Ada aset sesuai, jadwal lelang perlu diperbarui").wait();
  assert.equal(evidence?.total, 0);
  assert.ok(evidence?.diagnosa?.lelangTersaringTanggal > 0);
  await page.screenshot({ path: "/tmp/kosku-client-empty-desktop.png" });
  stage = "failure and retry";
  phase = "fail";
  await page.locator("button::-p-text(Cari ulang)").click();
  await page.locator("text/Uji kegagalan pencarian").wait();
  assert.equal(await page.evaluate(() => document.body.innerText.includes("Belum ada aset yang cocok persis")), false);
  phase = "partial";
  await page.locator("button::-p-text(Coba lagi)").click();
  await page.locator("text/Hasil pencarian belum lengkap. Coba lagi.").wait();
  phase = "offline";
  await page.locator("button::-p-text(Coba lagi)").click();
  await page.locator("text/Pencarian gagal dimuat. Periksa koneksi lalu coba lagi.").wait();
  phase = "live";
  await page.locator("button::-p-text(Coba lagi)").click();
  await page.locator("text/Ada aset sesuai, jadwal lelang perlu diperbarui").wait();
  stage = "mobile and keyboard";
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const retry = await page.$('button::-p-text(Cari ulang)');
  assert.ok(retry);
  await retry.focus();
  await page.keyboard.press("Enter");
  await page.locator("text/Ada aset sesuai, jadwal lelang perlu diperbarui").wait();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "/tmp/kosku-client-empty-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, clientId, liveDatabase: true, matches: evidence.total,
    excludedByDate: evidence.diagnosa.lelangTersaringTanggal, latestMatchingAuction: evidence.diagnosa.jadwalLelangTerakhir,
    failureRetry: true, malformedResponse: true, offline: true, mobile: true, keyboard: true, reducedMotion: true, writes: 0 }));
} catch (error) {
  console.error("CRM empty-state QA stage:", stage);
  if (page && !page.isClosed()) await page.screenshot({ path: "/tmp/kosku-client-empty-failure.png" }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await db.$disconnect();
}
