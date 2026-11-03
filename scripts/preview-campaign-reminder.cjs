const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ quiet: true });
require("dotenv").config({ path: ".env.local", override: true, quiet: true });
const load = require("./lib/marketing-test-loader.cjs")();
const { campaignReminderEmail, CAMPAIGN_REMINDER_RECIPIENTS } = load(
  "src/lib/marketing/campaign-reminder-email.ts",
);
const { jakartaDate } = load("src/lib/marketing/domain.ts");
async function main() {
  const day = jakartaDate(new Date());
  const tomorrow = jakartaDate(
    new Date(Date.parse(day + "T12:00:00+07:00") + 86400000),
  );
  const input = {
    campaignId: "preview",
    name: "Campaign contoh · Properti Surabaya",
    startDate: day,
    endDate: tomorrow,
    schedules: ["09:00", "13:00", "18:00"],
    channels: ["instagram", "whatsapp"],
    preview: true,
  };
  const email = campaignReminderEmail(input);
  const directory = path.resolve("docs/previews");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "campaign-reminder.html"),
    email.html,
  );
  await fs.writeFile(path.join(directory, "campaign-reminder.txt"), email.text);
  if (process.argv.includes("--render")) {
    const browser = await require("puppeteer").launch({
      headless: true,
      executablePath:
        process.env.MARKETING_QA_BROWSER ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage();
      for (const width of [800, 390, 320]) {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        await page.setContent(email.html, { waitUntil: "load" });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        if (overflow) throw new Error(`Email overflows at ${width}px`);
        await page.screenshot({
          path: path.join(directory, `campaign-reminder-${width}.png`),
          fullPage: true,
        });
      }
    } finally {
      await browser.close();
    }
  }
  console.log(
    JSON.stringify({
      preview: path.join(directory, "campaign-reminder.html"),
      bytes: Buffer.byteLength(email.html),
    }),
  );
  if (process.argv.includes("--send")) {
    const { sendCampaignReminderEmail } = load("src/lib/mailer.ts");
    for (const recipient of CAMPAIGN_REMINDER_RECIPIENTS) {
      const result = await sendCampaignReminderEmail(
        recipient,
        input,
        "preview-" + randomUUID(),
      );
      console.log(JSON.stringify({ recipient, ...result }));
      if (result.state !== "sent") process.exitCode = 1;
    }
  }
}
main().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
