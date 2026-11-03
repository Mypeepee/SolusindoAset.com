import assert from "node:assert/strict";
export default async function verifyRoi({
  page,
  errors,
  setRoiState,
  setFailProof,
}) {
  const dialog = ".investor-roi-dialog";
  const button = (id) =>
    `.investor-property[data-listing-id="${id}"] .investor-primary`;
  const money = async (selector) =>
    Number(
      (await page.$eval(selector, (el) => el.textContent)).replace(
        /[^\d-]/g,
        "",
      ),
    );
  async function open(id = "901") {
    await page.$eval(button(id), (el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.click(button(id));
    await page.waitForSelector(dialog);
  }
  async function close(id = "901") {
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".investor-roi-dialog"),
    );
    await page.waitForFunction(
      (selector) => document.activeElement === document.querySelector(selector),
      {},
      button(id),
    );
  }
  async function selectHistory() {
    await page.focus("#investor-tab-cma");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#investor-tab-history")
          .getAttribute("aria-selected") === "true",
    );
  }
  const layouts = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewport({
      width,
      height: width === 320 ? 568 : 1000,
      deviceScaleFactor: 1,
    });
    await open();
    await page.waitForSelector(".investor-proof-table tbody tr");
    await page.$eval(dialog, (el) =>
      Promise.allSettled(el.getAnimations().map((a) => a.finished)),
    );
    const layout = await page.$eval(dialog, (el) => {
      const rect = el.getBoundingClientRect();
      const table = [...el.querySelectorAll(".investor-proof-table tbody tr")];
      const price = table.map((row) => Number(row.dataset.pricePerSqm));
      const [left, right] = [
        ...el.querySelector(".investor-roi-layout").children,
      ].map((child) => child.getBoundingClientRect());
      const close = el
        .querySelector(".investor-dialog-close")
        .getBoundingClientRect();
      return {
        width: innerWidth,
        modalWidth: rect.width,
        centered: Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 2,
        overflow:
          el.scrollWidth > el.clientWidth ||
          document.documentElement.scrollWidth > innerWidth,
        rows: table.length,
        targets: el.querySelectorAll("[data-target]").length,
        sorted: price.every((p, i) => i === 0 || price[i - 1] >= p),
        columns: left.x < right.x && Math.abs(left.y - right.y) < 1,
        closeVisible: close.top >= 0 && close.bottom <= innerHeight,
        closeSize: close.width,
        verticalScrollers: [...el.querySelectorAll("*")].filter(
          (child) =>
            ["auto", "scroll"].includes(getComputedStyle(child).overflowY) &&
            child.scrollHeight > child.clientHeight + 1,
        ).length,
      };
    });
    assert.equal(layout.centered, true, JSON.stringify(layout));
    assert.equal(layout.overflow, false, JSON.stringify(layout));
    assert.equal(layout.rows, 10);
    assert.equal(layout.targets, 1);
    assert.equal(layout.sorted, true);
    assert.equal(layout.columns, width >= 1024);
    assert.equal(
      layout.verticalScrollers,
      0,
      "Only modal owns vertical scrolling",
    );
    assert.equal(layout.closeVisible, true);
    assert.equal(layout.closeSize, 44);
    assert.equal(await money('[data-cost="total"]'), 406250000);
    const cmaText = await page.$eval(
      "#investor-panel-cma",
      (el) => el.innerText,
    );
    assert.match(cmaText, /Aset ini/);
    assert.match(cmaText, /Limit awal/);
    assert.match(cmaText, /Limit saat ini/);
    assert.equal(
      await page.$$eval(".investor-cma-photo img", (els) => els.length),
      10,
    );
    await page.screenshot({ path: `/tmp/investor-roi-cma-${width}.png` });
    await selectHistory();
    await page.waitForFunction(() =>
      document
        .querySelector("#investor-panel-history")
        .innerText.includes("SAAT INI"),
    );
    assert.match(
      await page.$eval("#investor-panel-history", (el) => el.innerText),
      /75,0%/,
    );
    assert.ok(
      await page.$("#investor-panel-history svg"),
      "Canonical limit chart is present",
    );
    const historyOverflow = await page.$eval(
      dialog,
      (el) => el.scrollWidth > el.clientWidth,
    );
    assert.equal(historyOverflow, false, `history overflow ${width}`);
    await page.screenshot({ path: `/tmp/investor-roi-history-${width}.png` });
    await page.$eval(dialog, (el) => {
      el.scrollTop = el.scrollHeight;
    });
    assert.equal(
      await page.$eval(".investor-dialog-close", (el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
      true,
    );
    await close();
    layouts.push(layout);
  }
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await open();
  await page.waitForSelector(".investor-proof-table");
  await page.click(".investor-roi-section-heading button");
  await page.waitForSelector("#investor-purchase-price");
  await page.$eval("#investor-purchase-price", (el) => el.select());
  await page.type("#investor-purchase-price", "1000000000");
  assert.equal(await money('[data-cost="total"]'), 1220000000);
  await page.focus("#investor-purchase-price");
  assert.equal(
    await page.$eval(
      "#investor-purchase-price",
      (el) => getComputedStyle(el).borderColor,
    ),
    "rgb(203, 213, 225)",
  );
  const readScenario = (name) =>
    page.$eval(`[data-scenario="${name}"]`, (el) => ({
      resale: Number(
        el
          .querySelector('[data-value="resale"]')
          .textContent.replace(/[^\d-]/g, ""),
      ),
      profit: Number(
        el
          .querySelector('[data-value="profit"]')
          .textContent.replace(/[^\d-]/g, ""),
      ),
      roi: Number(
        el
          .querySelector('[data-value="roi"]')
          .textContent.replace("%", "")
          .replace(",", "."),
      ),
    }));
  for (const name of ["Rata-rata", "Termurah"]) {
    const result = await readScenario(name);
    assert.equal(result.profit, result.resale - 1220000000);
    assert.ok(
      Math.abs(result.roi - (result.profit / 1220000000) * 100) <= 0.051,
    );
  }
  await page.$eval("#investor-purchase-price", (el) => el.select());
  await page.keyboard.press("Backspace");
  await page.waitForSelector('.investor-roi-assumptions + [role="alert"]');
  assert.equal(
    (await page.$eval('[data-cost="total"]', (el) => el.innerText)).trim(),
    "—",
  );
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((el) => el.textContent.includes("Reset asumsi"))
      .click(),
  );
  assert.equal(await money('[data-cost="total"]'), 406250000);
  await close();
  await open("902");
  await page.waitForSelector(".investor-proof-table");
  assert.equal(await page.$("#investor-tab-history"), null);
  assert.equal(await money('[data-cost="total"]'), 73850000);
  assert.equal(await page.$('[data-cost="eviction"]'), null);
  await close("902");
  setRoiState({ delay: 1300 });
  await open();
  await page.waitForSelector('#investor-panel-cma [role="status"]');
  assert.equal(await money('[data-cost="total"]'), 406250000);
  await page.waitForSelector(".investor-proof-table");
  await close();
  setRoiState({ delay: 0 });
  setFailProof(true);
  await open();
  await page.waitForSelector('#investor-panel-cma [role="alert"]');
  await selectHistory();
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-panel-history")
      .innerText.includes("SAAT INI"),
  );
  await page.focus("#investor-tab-history");
  await page.keyboard.press("Home");
  setFailProof(false);
  await page.click("#investor-panel-cma .investor-button");
  await page.waitForSelector(".investor-proof-table");
  await close();
  setRoiState({ failHistory: true, expanded: true });
  await open();
  await page.waitForSelector(".investor-proof-table");
  assert.match(
    await page.$eval("#investor-panel-cma", (el) => el.innerText),
    /Sampel terbatas/,
  );
  await selectHistory();
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-panel-history")
      .innerText.includes("gagal dimuat"),
  );
  setRoiState({ failHistory: false, expanded: false });
  await page.evaluate(() =>
    [...document.querySelectorAll("#investor-panel-history button")]
      .find((el) => el.textContent.includes("Coba lagi"))
      .click(),
  );
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-panel-history")
      .innerText.includes("SAAT INI"),
  );
  await close();
  setRoiState({ missingLand: true });
  await open();
  await page.waitForSelector(".investor-proof-table");
  assert.equal(await money('[data-cost="total"]'), 406250000);
  assert.equal(
    (await page.$eval('[data-value="roi"]', (el) => el.innerText)).trim(),
    "—",
  );
  await close();
  setRoiState({ missingLand: false });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await open();
  await page.waitForSelector(".investor-proof-table");
  assert.equal(
    await page.$eval(dialog, (el) => getComputedStyle(el).animationName),
    "none",
  );
  // Radix focus remains inside the modal through repeated keyboard navigation.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.$eval(dialog, (el) => el.contains(document.activeElement)),
      true,
    );
  }
  await close();
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await open("910");
  await page.waitForSelector(".investor-proof-table");
  assert.equal(await page.$("#investor-tab-history"), null);
  assert.equal(await money('[data-cost="total"]'), 211000000);
  assert.match(
    await page.$eval("#investor-panel-cma", (el) => el.innerText),
    /Data Kelurahan Belum Terverifikasi/,
  );
  assert.equal(
    (await page.$eval('[data-value="roi"]', (el) => el.innerText)).trim(),
    "—",
  );
  await close("910");
  await page.click('[aria-label="Transaksi"]');
  await page.waitForSelector("#investor-transaction-sewa");
  await page.click("#investor-transaction-sewa");
  await page.waitForSelector('.investor-property[data-listing-id="920"]');
  await open("920");
  await page.waitForSelector(".investor-proof-table");
  assert.equal(await page.$("#investor-tab-history"), null);
  assert.equal(await page.$('[data-cost="total"]'), null);
  assert.equal(await page.$('[data-value="roi"]'), null);
  assert.match(
    await page.$eval(".investor-roi-financials", (el) => el.innerText),
    /Per bulan/,
  );
  await close("920");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "Investor centered ROI passed",
      layouts,
      checks:
        "target + top nine, descending per-m², photos, independent loading/retry, full history/chart/current marker, acquisition costs, scenarios/total denominator, local edit/reset, Primary/Secondary, SEWA period isolation, missing land, focus trap/restore/Escape, neutral focus and reduced motion",
    }),
  );
}
