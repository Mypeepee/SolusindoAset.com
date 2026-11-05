/** Read-only browser presentation checks with isolated auction-date fixtures. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

export default async function verifyAuctionDate({ page, errors }) {
  const output = path.resolve(".runtime/investor-auction-date-qa");
  await fs.mkdir(output, { recursive: true });
  const layouts = [];
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1440, 1000], [1920, 1080]]) {
    await page.setViewport({ width, height });
    await page.evaluate(async () => {
      document.querySelector(".investor-property").scrollIntoView({ block: "start", behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".investor-property")];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        pills: cards.slice(0, 3).map((card) => {
          const pill = card.querySelector(".investor-card-auction-date");
          const photo = card.querySelector(".investor-card-photo").getBoundingClientRect();
          const category = card.querySelector(".investor-card-category").getBoundingClientRect();
          const rect = pill.getBoundingClientRect();
          const label = pill.querySelector("span");
          return {
            text: label.textContent,
            state: [...pill.classList].find((name) => name.startsWith("is-")),
            rightInset: Math.round(photo.right - rect.right),
            topInset: Math.round(rect.top - photo.top),
            nowrap: getComputedStyle(pill).whiteSpace === "nowrap",
            fits: rect.right <= photo.right && rect.left >= photo.left && rect.left >= category.right + 4 && label.scrollWidth <= label.clientWidth,
            singleLine: label.clientHeight <= parseFloat(getComputedStyle(label).lineHeight) + 1,
            dateTime: pill.dateTime,
            accessibleDate: pill.getAttribute("aria-label"),
          };
        }),
        omitted: cards.slice(3, 7).every((card) => !card.querySelector(".investor-card-auction-date")),
      };
    });
    assert.equal(layout.overflow, false);
    assert.equal(layout.omitted, true, "No misleading date on undated, invalid, Primary or rental cards");
    assert.deepEqual(layout.pills.map((pill) => pill.text), ["5 hari lagi", "4 hari lalu", "Hari ini"]);
    assert.deepEqual(layout.pills.map((pill) => pill.state), ["is-upcoming", "is-past", "is-today"]);
    for (const pill of layout.pills) {
      assert.ok(pill.fits && pill.nowrap && pill.singleLine, `${width}: ${JSON.stringify(pill)}`);
      assert.equal(pill.rightInset, 12);
      assert.equal(pill.topInset, 12);
      assert.ok(pill.dateTime && pill.accessibleDate.startsWith("Lelang "));
    }
    layouts.push({ width, ...layout });
    if ([320, 390, 1440].includes(width))
      await page.screenshot({ path: path.join(output, `auction-pill-${width}.png`) });
  }
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width: 320, height: 568 });
  assert.equal(await page.$eval(".investor-card-auction-date", (pill) => getComputedStyle(pill).animationName), "none");
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify(layouts, null, 2));
  console.log("Investor auction date passed: 320–1920px, single-line upper-right pills, future/past/today, genuine accessible dates, no overlap or overflow, and no pill for missing/invalid/non-auction schedules.");
}
