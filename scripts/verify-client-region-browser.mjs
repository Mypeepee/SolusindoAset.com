// Local fixture QA: all API traffic is intercepted; no client data is written.
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { encode } from "next-auth/jwt";
import puppeteer from "puppeteer";

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.REGION_QA_ORIGIN || "http://127.0.0.1:3036";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const user = { id: "REGION_QA", sub: "REGION_QA", name: "QA Wilayah", peran: "AGENT", role: "AGENT", jabatan: "OWNER", agentId: "AG_REGION_QA" };
const now = new Date().toISOString();
const base = { id_preferensi: "910000001", id_klien: "KL_REGION_QA", tipe_properti: "RUMAH", maksud: "BELI", jenis_transaksi: null, loc_provinsi: null, loc_kota: "Kabupaten Sidoarjo", loc_kecamatan: "Sukodono", loc_kelurahan: null, lokasi_dicari: "Sukodono, Kabupaten Sidoarjo", budget_min: null, budget_max: null, luas_min: null, luas_max: null, diskon_jenis: null, diskon_persen: null, legalitas: null, dekat_nilai: null, dekat_radius: null, alamat_teks: null, tujuan_beli: null, catatan: null, dibuat_pada: now };
const client = { id_klien: base.id_klien, id_agent: user.agentId, nama: "Klien QA Wilayah", nomor_whatsapp: null, email: null, sumber: "website", metode_pembayaran: null, bank_kpr: null, tenor_kpr: null, tanggal_masuk: now, tanggal_kontak_terakhir: null, tanggal_follow_up: null, status: "lead_baru", catatan: null, dibuat_pada: now, diperbarui_pada: now, preferensi: [base, { ...base, id_preferensi: "910000002", loc_kota: "Kabupaten Lumajang" }] };
const regions = {
  "provinsi:": [{ id: "35", name: "Jawa Timur" }],
  "kota:35": [{ id: "3515", name: "Kabupaten Sidoarjo" }, { id: "3508", name: "Kabupaten Lumajang" }],
  "kecamatan:3515": [{ id: "351501", name: "Sukodono" }, { id: "351502", name: "Waru" }],
  "kecamatan:3508": [{ id: "350801", name: "Sukodono" }],
  "kelurahan:351501": [{ id: "35150101", name: "Sukodono" }],
  "kelurahan:351502": [{ id: "35150201", name: "Sukodono" }],
  "kelurahan:350801": [{ id: "35080101", name: "Sukodono" }],
};
let browser, page, stage = "setup", saved, failSave = true, slowSidoarjo = false, failLumajang = false;
const errors = [];
try {
  browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => errors.push(error.message));
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { ...user, _refreshedAt: Date.now() } });
  for (const name of ["next-auth.session-token", "__Secure-next-auth.session-token"]) {
    await page.setCookie({ name, value: token, url: origin, httpOnly: true, secure: name.startsWith("__Secure") });
  }
  await page.setRequestInterception(true);
  page.on("request", async request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) { await request.continue(); return; }
    let body = { ok: true, data: [], total: 0 }, status = 200;
    if (url.pathname === "/api/auth/session") body = { user, expires: "2099-01-01T00:00:00.000Z" };
    if (url.pathname === "/api/dashboard/klien") body = { ok: true, data: [client], total: 1 };
    if (url.pathname.endsWith("/statistik")) body = { ok: false };
    if (url.pathname === `/api/dashboard/klien/${client.id_klien}`) body = { ok: true, data: client };
    if (url.pathname.endsWith("/preferensi") && request.method() === "PUT") {
      saved = JSON.parse(request.postData()).preferensi;
      if (failSave) { failSave = false; status = 500; body = { ok: false, message: "Uji gagal simpan wilayah. Coba lagi." }; }
      else { client.preferensi = saved.map((row, i) => ({ ...base, ...row, id_preferensi: String(910000010 + i) })); body = { ok: true, data: client.preferensi }; }
    }
    if (url.pathname === "/api/regions/cities") body = { cities: regions["kota:35"].map(row => ({ ...row, province: "Jawa Timur" })) };
    if (url.pathname === "/api/regions/wilayah") {
      const key = `${url.searchParams.get("level")}:${url.searchParams.get("parentId") || ""}`;
      if (key === "kecamatan:3515" && slowSidoarjo) { slowSidoarjo = false; await new Promise(resolve => setTimeout(resolve, 900)); }
      if (key === "kecamatan:3508" && failLumajang) { failLumajang = false; status = 503; body = { ok: false }; }
      else body = { ok: true, items: regions[key] || [] };
    }
    await request.respond({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
  });
  await page.setViewport({ width: 1365, height: 1000 });
  stage = "open legacy preferences";
  await page.goto(origin + "/dashboard/crm", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("text/Klien QA Wilayah").click();
  const edit = async () => {
    await page.locator('[title="Edit preferensi ini"]').click();
    await page.waitForSelector('[role="button"][aria-label="Lokasi"]');
  };
  const open = async () => {
    await page.focus('[role="button"][aria-label="Lokasi"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-search-portal][role="dialog"]', { visible: true });
  };
  const dialog = '[data-search-portal][role="dialog"]';
  const goBack = async () => page.locator(`${dialog} button[aria-label="Kembali"]`).click();
  const city = async name => {
    await page.locator(`${dialog} input`).fill(name.replace("Kabupaten ", ""));
    await page.locator(`${dialog} button[aria-label="Lihat Kecamatan di ${name}"]`).click();
  };
  const selectDistrict = async name => page.locator(`${dialog} button[aria-label="Sukodono, ${name}"]`).click();
  const apply = async () => {
    await page.locator(`${dialog} button::-p-text(Terapkan)`).click();
    await page.waitForSelector(dialog, { hidden: true });
  };
  const save = async () => {
    await page.locator('button::-p-text(Simpan Perubahan)').click();
    await page.waitForSelector('[role="button"][aria-label="Lokasi"]', { hidden: true });
  };
  await edit();
  assert.match(await page.$eval('[role="button"][aria-label="Lokasi"]', el => el.textContent), /Sukodono, Kabupaten Sidoarjo.*Sukodono, Kabupaten Lumajang/);
  await open();
  await city("Kabupaten Sidoarjo");
  await page.waitForSelector(`${dialog} button[aria-label="Sukodono, Kabupaten Sidoarjo"][aria-pressed="true"]`);
  // Unchecking a saved legacy selection must not append a duplicate with a province.
  await selectDistrict("Kabupaten Sidoarjo");
  await page.waitForSelector(`${dialog} button[aria-label="Sukodono, Kabupaten Sidoarjo"][aria-pressed="false"]`);
  await selectDistrict("Kabupaten Sidoarjo");
  await apply();
  stage = "save failure, retry, reopen and reload";
  await page.locator('button::-p-text(Simpan Perubahan)').click();
  await page.locator("text/Uji gagal simpan wilayah. Coba lagi.").wait();
  await save();
  assert.equal(saved.length, 2);
  assert.deepEqual(new Set(saved.map(row => row.loc_kota)), new Set(["Kabupaten Sidoarjo", "Kabupaten Lumajang"]));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("text/Klien QA Wilayah").click();
  await edit();
  assert.match(await page.$eval('[role="button"][aria-label="Lokasi"]', el => el.textContent), /Sukodono, Kabupaten/);
  await open();
  stage = "stale child response and region fetch failure";
  slowSidoarjo = true;
  await city("Kabupaten Sidoarjo");
  await goBack();
  failLumajang = true;
  await city("Kabupaten Lumajang");
  await page.locator(`${dialog} [role="alert"]`).wait();
  await page.locator(`${dialog} button::-p-text(Coba lagi)`).click();
  await page.waitForSelector(`${dialog} button[aria-label="Sukodono, Kabupaten Lumajang"]`);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(await page.$(`${dialog} button[aria-label="Sukodono, Kabupaten Sidoarjo"]`), null);
  stage = "namesake villages in different cities and districts";
  await page.locator(`${dialog} button::-p-text(Reset)`).click();
  await page.locator(`${dialog} button[aria-label="Lihat Kelurahan di Sukodono"]`).click();
  await page.locator(`${dialog} button[aria-label="Sukodono, Sukodono, Kabupaten Lumajang"]`).click();
  await goBack();
  await goBack();
  await city("Kabupaten Sidoarjo");
  await page.locator(`${dialog} button[aria-label="Lihat Kelurahan di Sukodono"]`).click();
  await page.locator(`${dialog} button[aria-label="Sukodono, Sukodono, Kabupaten Sidoarjo"]`).click();
  await goBack();
  await page.locator(`${dialog} button[aria-label="Lihat Kelurahan di Waru"]`).click();
  await page.locator(`${dialog} button[aria-label="Sukodono, Waru, Kabupaten Sidoarjo"]`).click();
  await apply();
  await save();
  assert.equal(saved.length, 3);
  assert.ok(saved.every(row => row.loc_kelurahan === "Sukodono" && row.loc_provinsi === "Jawa Timur"));
  assert.equal(new Set(saved.map(row => `${row.loc_kecamatan}|${row.loc_kota}`)).size, 3);
  await edit();
  await page.screenshot({ path: "/tmp/kosku-region-desktop.png" });
  await save();
  assert.equal(saved.length, 3);
  stage = "narrow viewport, keyboard, clear and reduced motion";
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await edit();
  await page.focus('[role="button"][aria-label="Lokasi"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${dialog}[aria-modal="true"]`);
  await page.locator(`${dialog} input`).fill("wilayah tidak ada");
  await page.locator('text/Tidak ada wilayah cocok untuk').wait();
  await page.locator(`${dialog} button[aria-label="Bersihkan"]`).click();
  assert.equal(await page.$eval(`${dialog} input`, el => el === document.activeElement && el.value === ""), true);
  await page.keyboard.press("Escape");
  await page.waitForSelector(dialog, { hidden: true });
  assert.equal(await page.$eval('[role="button"][aria-label="Lokasi"]', el => el === document.activeElement), true);
  await open();
  const popup = await page.$eval(dialog, el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth, height: r.height }; });
  assert.ok(popup.left >= 0 && popup.right <= popup.width && popup.height > 0);
  await page.screenshot({ path: "/tmp/kosku-region-mobile.png" });
  await apply();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  stage = "incomplete legacy scope requires reselection";
  client.preferensi = [{ ...base, loc_kota: null }];
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("text/Klien QA Wilayah").click();
  await edit();
  await page.locator("text/Pilih ulang kecamatan Sukodono beserta kota/kabupatennya.").wait();
  assert.equal(await page.$eval('button::-p-text(Simpan Perubahan)', el => el.disabled), true);
  await open();
  await page.locator(`${dialog} button::-p-text(Reset)`).click();
  await city("Kabupaten Sidoarjo");
  await selectDistrict("Kabupaten Sidoarjo");
  await apply();
  await save();
  assert.equal(saved[0].loc_kota, "Kabupaten Sidoarjo");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, districtSaveReload: true, namesakeVillages: 3, legacyUncheck: true, legacyRepair: true, failureRetry: true, staleResponses: true, keyboard: true, mobile: true, reducedMotion: true, realApiWrites: 0 }));
} catch (error) {
  console.error("Region browser QA stage:", stage);
  if (page && !page.isClosed()) await page.screenshot({ path: "/tmp/kosku-region-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
}
