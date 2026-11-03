const test = require("node:test");
const assert = require("node:assert/strict");
const createLoader = require("./lib/marketing-test-loader.cjs");
const load = createLoader();
const { campaignReminderDay, dueCampaignReminder } = load(
  "src/lib/marketing/campaign-reminder.ts",
);
const { campaignReminderEmail, CAMPAIGN_REMINDER_RECIPIENTS } = load(
  "src/lib/marketing/campaign-reminder-email.ts",
);
const brief = (extra = {}) => ({
  name: "Campaign contoh Surabaya",
  startDate: "2026-10-28",
  endDate: "2026-11-02",
  city: "Surabaya",
  locations: [],
  category: "ALL",
  propertyTypes: [],
  minPrice: null,
  maxPrice: null,
  schedules: ["09:00", "13:00", "18:00"],
  listingIds: [],
  assetOrder: "fresh",
  channels: ["instagram", "whatsapp"],
  ...extra,
});
const row = (extra = {}) => ({
  id: "e1c39d4e-5766-45a4-a752-8f767bf485a5",
  state: "running",
  activeBrief: brief(),
  ...extra,
});
const now = new Date("2026-11-01T01:00:00Z");

test("email Campaign destination survives sign-in and rejects external redirect targets", async () => {
  const { signInReturnUrl } = load("src/lib/auth-return-url.ts");
  const destination = "/dashboard/pemasaran?tab=campaign&campaign=" + row().id;
  const signin = new URL("https://solusindoaset.com/signin");
  signin.searchParams.set("callbackUrl", destination);
  assert.equal(
    signInReturnUrl(signin.toString()),
    "https://solusindoaset.com" + destination,
  );
  for (const unsafe of [
    "https://outside.example.test",
    "//outside.example.test",
    "javascript:alert(1)",
    "/signin",
    "/signin/",
  ]) {
    signin.searchParams.set("callbackUrl", unsafe);
    assert.equal(
      signInReturnUrl(signin.toString()),
      "https://solusindoaset.com/dashboard",
    );
  }
  assert.equal(
    signInReturnUrl("https://solusindoaset.com/Jual/rumah"),
    "https://solusindoaset.com/Jual/rumah",
  );
  const { NextRequest } = require("next/server");
  const { middleware } = createLoader({
    "next-auth/jwt": { getToken: async () => null },
  })("middleware.ts");
  const response = await middleware(
    new NextRequest("https://solusindoaset.com" + destination),
  );
  const redirect = new URL(response.headers.get("location"));
  assert.equal(redirect.pathname, "/signin");
  assert.equal(redirect.searchParams.get("callbackUrl"), destination);
});

test("H-1 begins at 08:00 WIB, catches up until midnight, and handles month/year/leap rollovers", () => {
  assert.equal(campaignReminderDay(new Date("2026-11-01T00:59:59Z")), null);
  assert.equal(campaignReminderDay(now), "2026-11-02");
  assert.equal(
    campaignReminderDay(new Date("2026-11-01T16:59:59Z")),
    "2026-11-02",
  );
  assert.equal(campaignReminderDay(new Date("2026-11-01T17:00:00Z")), null);
  assert.equal(
    campaignReminderDay(new Date("2026-12-31T01:00:00Z")),
    "2027-01-01",
  );
  assert.equal(
    campaignReminderDay(new Date("2028-02-28T01:00:00Z")),
    "2028-02-29",
  );
  assert.equal(
    campaignReminderDay(new Date("2026-01-31T01:00:00Z")),
    "2026-02-01",
  );
});
test("only approved running campaigns due tomorrow qualify; unapproved edits cannot move the reminder", () => {
  assert.ok(dueCampaignReminder(row(), now));
  for (const state of ["draft", "paused", "ended"])
    assert.equal(dueCampaignReminder(row({ state }), now), null);
  for (const endDate of ["2026-11-01", "2026-11-03"])
    assert.equal(
      dueCampaignReminder(row({ activeBrief: brief({ endDate }) }), now),
      null,
    );
  assert.equal(dueCampaignReminder(row({ activeBrief: {} }), now), null);
  assert.equal(
    dueCampaignReminder(row(), new Date("2026-11-01T00:59:59Z")),
    null,
  );
  const edited = {
    ...row(),
    brief: brief({ name: "Draf baru", endDate: "2026-12-01" }),
  };
  assert.equal(
    dueCampaignReminder(edited, now).name,
    "Campaign contoh Surabaya",
  );
  assert.ok(
    dueCampaignReminder(
      row({ activeBrief: brief({ startDate: "2026-11-02" }) }),
      now,
    ),
    "one-day approved campaigns also receive H-1 reminders",
  );
});
test("email has escaped real data, Indonesian dates, plain text and a public deep link", () => {
  const email = campaignReminderEmail({
    campaignId: row().id,
    ...brief({ name: '<img src=x onerror="alert(1)">' }),
  });
  assert.ok(email.html.includes("&lt;img"));
  assert.ok(!email.html.includes("<img src=x"));
  assert.match(email.text, /Senin, 2 November 2026/);
  assert.match(email.text, /planner konten untuk besok/);
  const link = new URL(email.url);
  assert.equal(link.protocol, "https:");
  assert.notEqual(link.hostname, "localhost");
  assert.equal(link.pathname, "/dashboard/pemasaran");
  assert.equal(link.searchParams.get("tab"), "campaign");
  assert.equal(link.searchParams.get("campaign"), row().id);
  assert.ok(email.html.length < 102400, "below Gmail clipping threshold");
  assert.match(email.html, /v:roundrect/);
  assert.doesNotMatch(email.html, /<script|<img/);
  const preview = campaignReminderEmail({
    campaignId: "example",
    ...brief(),
    preview: true,
  });
  assert.match(preview.subject, /^\[PRATINJAU\]/);
  assert.match(preview.html, /Data campaign di bawah adalah contoh/);
  assert.equal(new URL(preview.url).searchParams.has("campaign"), false);
});

function harness(deliveries = [], configured = true) {
  const records = new Map(),
    sent = [];
  let campaigns = [row()];
  const model = {
    async upsert({ where, create }) {
      const key = JSON.stringify(where.campaignId_endDate_recipient);
      if (!records.has(key))
        records.set(key, {
          id: String(records.size + 1),
          state: "pending",
          attempts: 0,
          ...create,
        });
      return { ...records.get(key) };
    },
    async updateMany({ where, data }) {
      if (!where.id) return { count: 0 };
      const record = [...records.values()].find((r) => r.id === where.id);
      if (
        !where.state.in.includes(record.state) ||
        record.attempts >= 5 ||
        (record.nextAttemptAt && record.nextAttemptAt > now)
      )
        return { count: 0 };
      Object.assign(record, { ...data, attempts: record.attempts + 1 });
      return { count: 1 };
    },
    async update({ where, data }) {
      Object.assign(
        [...records.values()].find((r) => r.id === where.id),
        data,
      );
    },
  };
  const run = createLoader({
    "@/lib/prisma": {
      marketingCampaignReminder: model,
      marketingCampaign: { findMany: async () => campaigns },
    },
    "@/lib/mailer": {
      isMailConfigured: () => configured,
      sendCampaignReminderEmail: async (to, input) => {
        sent.push({ to, input });
        return deliveries.shift() || { state: "sent", messageId: "test" };
      },
    },
  })("src/lib/marketing/campaign-reminders.server.ts").runCampaignReminders;
  return {
    run,
    records,
    sent,
    setCampaigns: (next) => {
      campaigns = next;
    },
  };
}
test("repeat and overlapping worker ticks send exactly once per campaign/end date/recipient", async () => {
  const h = harness();
  await Promise.all([h.run(now), h.run(now)]);
  await h.run(now);
  assert.deepEqual(
    h.sent.map((s) => s.to).sort(),
    [...CAMPAIGN_REMINDER_RECIPIENTS].sort(),
  );
  assert.equal(h.records.size, 2);
  assert.ok([...h.records.values()].every((r) => r.state === "sent"));
  h.setCampaigns([row({ activeBrief: brief({ endDate: "2026-11-03" }) })]);
  await h.run(new Date("2026-11-02T01:00:00Z"));
  assert.equal(
    h.sent.length,
    4,
    "an approved period extension gets a new H-1 reminder",
  );
});
test("recipient failures stay independent; retry is delayed and uncertain delivery never auto-resends", async () => {
  for (const state of ["retry", "uncertain"]) {
    const h = harness([
      { state, errorCode: "TEST_FAILURE" },
      { state: "sent" },
    ]);
    await h.run(now);
    await h.run(now);
    assert.equal(h.sent.length, 2);
    if (state === "retry") {
      for (const r of h.records.values())
        if (r.state === "retry") r.nextAttemptAt = null;
      await h.run(now);
      assert.equal(h.sent.length, 3);
    } else {
      await h.run(new Date("2026-11-01T05:00:00Z"));
      assert.equal(h.sent.length, 2);
    }
  }
  const h = harness([], false);
  assert.equal((await h.run(now)).configured, false);
  assert.equal(h.records.size, 0);
});
test("SMTP acceptance, explicit rejection, authentication failure and ambiguous DATA timeout are distinguished", async () => {
  const saved = {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
  };
  process.env.GMAIL_USER = "sender@example.test";
  process.env.GMAIL_APP_PASSWORD = "test-password";
  try {
    for (const [outcome, expected] of [
      [
        { accepted: [CAMPAIGN_REMINDER_RECIPIENTS[0]], messageId: "id" },
        "sent",
      ],
      [{ accepted: [] }, "retry"],
      [
        Object.assign(new Error("rejected"), {
          responseCode: 451,
          command: "DATA",
        }),
        "retry",
      ],
      [Object.assign(new Error("auth"), { code: "EAUTH" }), "retry"],
      [
        Object.assign(new Error("timeout"), {
          code: "ETIMEDOUT",
          command: "CONN",
        }),
        "retry",
      ],
      [
        Object.assign(new Error("timeout"), {
          code: "ETIMEDOUT",
          command: "DATA",
        }),
        "uncertain",
      ],
    ]) {
      const mailer = createLoader({
        nodemailer: {
          createTransport: () => ({
            sendMail: async () => {
              if (outcome instanceof Error) throw outcome;
              return outcome;
            },
          }),
        },
      })("src/lib/mailer.ts");
      assert.equal(
        (
          await mailer.sendCampaignReminderEmail(
            CAMPAIGN_REMINDER_RECIPIENTS[0],
            { campaignId: row().id, ...brief() },
            "test-id",
          )
        ).state,
        expected,
      );
    }
  } finally {
    for (const [key, value] of [
      ["GMAIL_USER", saved.user],
      ["GMAIL_APP_PASSWORD", saved.password],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("Pemasaran sits between Dashboard and Tugas for OWNER with a bundled genuine Solar icon", () => {
  const { getDashboardMenu } = load(
    "src/app/dashboard/components/list-menu.tsx",
  );
  const menu = getDashboardMenu("OWNER");
  assert.deepEqual(
    menu.homepage.slice(0, 3).map((i) => i.label),
    ["Dashboard", "Pemasaran", "Tugas"],
  );
  assert.ok(!menu.apps.some((i) => i.label === "Pemasaran"));
  const solar = require("@iconify-json/solar/icons.json");
  assert.equal(
    menu.homepage[1].icon.body,
    solar.icons["volume-loud-linear"].body,
  );
  for (const role of ["ADMIN", "AGENT", "PRINCIPAL", "TEAMLEADER", null])
    assert.ok(
      !getDashboardMenu(role).homepage.some((i) => i.label === "Pemasaran"),
    );
});
