/** Isolated browser checks: all status writes are intercepted by the QA harness. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

export default async function verifySold({ page, errors, requests, setResponse }) {
  const output = path.resolve(".runtime/investor-sold-qa");
  await fs.mkdir(output, { recursive: true });
  page.on("dialog", async (dialog) => {
    errors.push(`Unexpected native dialog: ${dialog.type()}`);
    await dialog.dismiss();
  });
  const button = ".investor-property:first-child .investor-sold-action";
  const dialog = ".investor-sold-dialog";
  const close = async () => {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".investor-sold-dialog"));
    assert.equal(await page.$eval(button, (el) => el === document.activeElement), true);
  };
  const layouts = [];
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [640, 700], [768, 1024], [1024, 768], [1440, 1000], [1920, 1080]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.evaluate(async () => {
      document.querySelector(".investor-property").scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const card = await page.evaluate(() => {
      const card = document.querySelector(".investor-property");
      const action = card.querySelector(".investor-sold-action");
      const footer = card.querySelector(".investor-card-actions");
      const rect = action.getBoundingClientRect();
      const controls = [...footer.querySelectorAll("button, a")].map((el) => el.getBoundingClientRect());
      const label = action.querySelector(".investor-sold-label");
      return {
        height: card.getBoundingClientRect().height,
        fullyVisible: card.getBoundingClientRect().top >= 0 && card.getBoundingClientRect().bottom <= innerHeight,
        width: rect.width,
        actionHeight: rect.height,
        fullWidth: Math.abs(rect.width - footer.clientWidth) <= 1,
        labelFits: label.scrollWidth <= label.clientWidth,
        targets: controls.every((r) => r.width >= 44 && r.height >= 44),
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: card.scrollHeight > card.clientHeight + 1,
        overlaps: controls.some((r, i) => controls.some((s, j) => j > i && r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top)),
      };
    });
    assert.equal(card.fullWidth && card.labelFits && card.targets, true, `${width}: ${JSON.stringify(card)}`);
    assert.equal(card.overflow || card.clipped || card.overlaps, false, `${width}: ${JSON.stringify(card)}`);
    if (width === 320) assert.ok(card.height <= height - 100 && card.fullyVisible, `Short phone card: ${JSON.stringify(card)}`);
    if ([320, 390, 1440].includes(width))
      await page.screenshot({ path: path.join(output, `button-${width}.png`) });
    await page.click(button);
    await page.waitForSelector(dialog);
    await page.waitForFunction(() => document.activeElement?.classList.contains("investor-sold-cancel"));
    assert.match(await page.$eval(dialog, (el) => el.textContent), /semua listing historisnya/);
    assert.equal(requests.length, 0, "Opening a confirmation must never write");
    const modal = await page.$eval(dialog, (el) => {
      const r = el.getBoundingClientRect();
      const footer = el.querySelector(".investor-sold-dialog-footer").getBoundingClientRect();
      const confirm = el.querySelector(".investor-sold-confirm");
      const label = confirm.querySelector(".investor-sold-label");
      return {
        fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        footerVisible: footer.bottom <= innerHeight && footer.top >= r.top,
        labelFits: label.scrollWidth <= label.clientWidth,
        targets: [...el.querySelectorAll("button")].every((button) => button.clientHeight >= 44 && button.clientWidth >= 44),
      };
    });
    assert.ok(modal.fits && modal.footerVisible && modal.targets && modal.labelFits, `${width}: ${JSON.stringify(modal)}`);
    // Tab and Shift+Tab stay within the dialog and never submit Batal.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert.equal(await page.$eval(dialog, (el) => el.contains(document.activeElement)), true);
    }
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    if ([320, 390, 1440].includes(width))
      await page.screenshot({ path: path.join(output, `confirmation-${width}.png`) });
    await close();
    layouts.push({ width, height, card, modal });
  }
  await page.setViewport({ width: 320, height: 568 });
  await page.click(button);
  await page.waitForSelector(dialog);
  // Stress long addresses and short landscape screens without changing source fixtures.
  await page.$eval(`${dialog} .investor-sold-asset-copy p`, (el) => {
    el.textContent = "Jalan Permukiman Utama Nomor 123, Kabupaten Kepulauan Siau Tagulandang Biaro. ".repeat(6);
  });
  await page.setViewport({ width: 568, height: 320 });
  assert.ok(await page.$eval(dialog, (el) => {
    const body = el.querySelector(".investor-sold-dialog-body");
    const footer = el.querySelector(".investor-sold-dialog-footer").getBoundingClientRect();
    return body.scrollHeight > body.clientHeight && footer.bottom <= innerHeight && footer.top >= 0;
  }), "Long content scrolls while confirmation stays visible");
  await close();
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.click(button);
  await page.waitForSelector(dialog);
  assert.equal(await page.$eval(dialog, (el) => getComputedStyle(el).animationName), "none");
  await page.click(".investor-sold-cancel");
  await page.waitForFunction(() => !document.querySelector(".investor-sold-dialog"));
  assert.equal(requests.length, 0, "Cancel never writes");
  await page.emulateMediaFeatures([]);
  await page.click(button);
  await page.waitForSelector(dialog);
  const before = await page.$eval(".investor-sold-confirm", (el) => ({ width: el.clientWidth, height: el.clientHeight }));
  setResponse(503, 900);
  await page.click(".investor-sold-confirm");
  await page.waitForFunction(() => document.querySelector(".investor-sold-confirm")?.getAttribute("aria-busy") === "true");
  await page.$eval(".investor-sold-confirm", (el) => { el.click(); el.click(); });
  await page.keyboard.press("Escape");
  assert.ok(await page.$(dialog), "Busy dialog cannot dismiss");
  const busy = await page.$eval(".investor-sold-confirm", (el) => ({ width: el.clientWidth, height: el.clientHeight, disabled: el.disabled }));
  assert.deepEqual({ width: busy.width, height: busy.height }, before, "Busy button has stable geometry");
  assert.equal(busy.disabled, true);
  await page.waitForSelector(".investor-sold-error");
  assert.equal(requests.length, 1, "Duplicate submission blocked");
  assert.match(await page.$eval(".investor-sold-error", (el) => el.textContent), /belum dapat disimpan/);
  await page.screenshot({ path: path.join(output, "retry-mobile.png") });
  const id = await page.$eval(".investor-property", (el) => el.dataset.listingId);
  setResponse(200);
  await page.click(".investor-sold-confirm");
  await page.waitForFunction(() => !document.querySelector(".investor-sold-dialog"));
  await page.waitForFunction((id) => !document.querySelector(`.investor-property[data-listing-id="${id}"]`), {}, id);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].id, id);
  assert.equal(requests[1].method, "PATCH");
  assert.deepEqual(JSON.parse(requests[1].body), { status: "TERJUAL" });
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ layouts, requests: requests.length }, null, 2));
  console.log(`Investor sold action passed: eight widths (320–1920px), short landscape, touch targets, focus trap/restore, cancel, reduced motion, stable pending state, duplicate prevention, inline error/retry, confirmed refresh. Artifacts: ${output}`);
}
