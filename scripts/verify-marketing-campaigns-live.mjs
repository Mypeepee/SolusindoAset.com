// Temporary draft only. This never approves a schedule or dispatches social media.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const origin = process.env.MARKETING_QA_ORIGIN || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const db = new PrismaClient();
let id, mediaId;
try {
  const settings = await db.marketingSettings.findUniqueOrThrow({
    where: { id: "company" },
  });
  assert.equal(settings.enabled, false);
  const published = await db.marketingPublication.count({
    where: { state: "published" },
  });
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
  const cookie =
    (process.env.NEXTAUTH_URL?.startsWith("https:")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token") +
    "=" +
    token;
  const post = async (body) => {
    const response = await fetch(
      origin + "/api/dashboard/pemasaran/campaigns",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240000),
      },
    );
    const result = await response.json();
    assert.equal(response.status, 200, result.error || "Campaign HTTP failure");
    return result;
  };
  const day = (offset) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      new Date(Date.now() + offset * 86400000),
    );
  const criteria = {
    city: "",
    locations: [],
    category: "ALL",
    propertyTypes: [],
    minPrice: null,
    maxPrice: null,
  };
  const stock = await post({
    action: "inventory",
    inventory: {
      criteria,
      startDate: day(1),
      endDate: day(3),
      listingIds: [],
      query: "",
      offset: 0,
    },
  });
  assert.ok(
    stock.items.length,
    "Need real eligible stock for the renderer check",
  );
  let detail = await post({
    action: "save",
    brief: {
      name: "QA sementara · jangan diterapkan",
      startDate: day(1),
      endDate: day(3),
      schedules: ["08:15", "17:45"],
      listingIds: stock.items.map((a) => a.id),
      channels: [
        settings.config.instagram !== false ? "instagram" : "whatsapp",
      ],
      ...criteria,
    },
  });
  id = detail.campaign.id;
  detail = await post({
    action: "generate",
    id,
    revision: detail.campaign.revision,
  });
  assert.ok(detail.proposal);
  assert.equal(detail.campaign.state, "draft");
  assert.equal(detail.jobs.length, 0);
  let preview = "no-eligible-slot";
  if (detail.proposal.data.slots.length) {
    const slot = detail.proposal.data.slots[0];
    mediaId = slot.id;
    const response = await post({
      action: "preview",
      id,
      revision: detail.campaign.revision,
      proposalId: detail.proposal.id,
      slotId: slot.id,
    });
    assert.ok(
      response.media.filter((m) => m.channel === "instagram").length >= 2,
    );
    assert.ok(response.caption);
    const image = await fetch(
      origin +
        "/api/dashboard/pemasaran/media?job=" +
        mediaId +
        "&name=feed.jpg",
      { headers: { Cookie: cookie } },
    );
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type"), /image\/jpeg/);
    preview = "rendered";
  }
  assert.equal(await db.marketingJob.count({ where: { campaignId: id } }), 0);
  assert.equal(
    await db.marketingPublication.count({ where: { state: "published" } }),
    published,
  );
  assert.equal(
    (await db.marketingSettings.findUniqueOrThrow({ where: { id: "company" } }))
      .enabled,
    false,
  );
  console.log(
    JSON.stringify({
      passed: true,
      stock: detail.proposal.data.stock,
      slots: detail.proposal.data.slots.length,
      dailyTimes: detail.campaign.brief.schedules,
      preview,
      scheduledJobs: 0,
      socialDispatch: 0,
    }),
  );
} finally {
  if (id) {
    await db.marketingCampaignProposal.deleteMany({
      where: { campaignId: id },
    });
    await db.marketingCampaign.deleteMany({ where: { id } });
  }
  if (mediaId && /^[a-f0-9-]{36}$/.test(mediaId))
    await fs.rm(path.join(process.cwd(), "uploads", "marketing", mediaId), {
      recursive: true,
      force: true,
    });
  await db.$disconnect();
}
