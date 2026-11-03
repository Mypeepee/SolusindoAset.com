import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { BaileysClient } from "../services/baileys.js";
import { MarketingStatusStore } from "../state/marketing_status.js";
const PHONE = "6281234567890",
  RECIPIENT = "6287777777777@s.whatsapp.net";
const ID = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "marketing-wa-"));
  const calls = [],
    received = [],
    socket = {
      user: { id: PHONE + ":7@s.whatsapp.net" },
      ev: new EventEmitter(),
      end() {},
      sendMessage: async (jid, content, options) => {
        calls.push({ jid, content, options });
        return {
          key: { id: options.messageId, remoteJid: jid },
          message: content,
        };
      },
    };
  const client = new BaileysClient(
    {
      authFile: join(directory, "session.sqlite"),
      timeoutMs: 1000,
      maxContacts: 100,
      maxReconnects: 0,
    },
    {
      authFactory: () => ({ state: { creds: {}, keys: {} }, saveCreds() {} }),
      socketFactory: () => socket,
      logger: { info() {}, error() {} },
    },
  );
  client.start((messages) => {
    received.push(...messages);
    return messages.length;
  });
  await client.updateConnection(socket, { connection: "open" });
  const image = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#103b2a" },
  })
    .jpeg()
    .toBuffer();
  return {
    client,
    socket,
    calls,
    received,
    body: {
      id: ID,
      imageBase64: image.toString("base64"),
      caption: "Status uji",
      audience: [RECIPIENT],
      test: true,
    },
    close: async () => {
      await client.stop();
      rmSync(directory, { recursive: true, force: true });
    },
    directory,
  };
}
test("Status requires a successful test, sends to status broadcast, and deduplicates the publication ID", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.client.sendMarketingStatus({ ...f.body, test: false }),
      (error) => error.code === "WA_TEST_REQUIRED",
    );
    assert.equal(f.calls.length, 0);
    const result = await f.client.sendMarketingStatus(f.body);
    assert.equal(result.state, "published");
    assert.equal(f.calls[0].jid, "status@broadcast");
    assert.deepEqual(f.calls[0].options.statusJidList, [RECIPIENT]);
    await f.client.sendMarketingStatus(f.body);
    assert.equal(f.calls.length, 1);
    assert.ok(f.client.marketingStatus().tested_at);
    assert.equal(result.values.views, null);
  } finally {
    await f.close();
  }
});
test("viewer receipts and reactions deduplicate; Status replies bypass the AI processor", async () => {
  const f = await fixture();
  try {
    const result = await f.client.sendMarketingStatus(f.body),
      messageId = result.message_id;
    const receipt = {
      key: { id: messageId, remoteJid: "status@broadcast" },
      receipt: { userJid: RECIPIENT, readTimestamp: 123 },
    };
    f.socket.ev.emit("message-receipt.update", [receipt, receipt]);
    const reaction = {
      key: { id: messageId, remoteJid: "status@broadcast" },
      reaction: { text: "👍", key: { remoteJid: RECIPIENT } },
    };
    f.socket.ev.emit("messages.reaction", [reaction, reaction]);
    f.socket.ev.emit("messages.upsert", {
      type: "notify",
      messages: [
        {
          key: { id: "reply-1", remoteJid: RECIPIENT },
          messageTimestamp: Date.now() / 1000,
          message: {
            extendedTextMessage: {
              text: "Saya tertarik",
              contextInfo: {
                stanzaId: messageId,
                remoteJid: "status@broadcast",
              },
            },
          },
        },
      ],
    });
    await f.client.inbound;
    const metrics = f.client.marketingMetrics(ID);
    assert.deepEqual(metrics.values, { views: 1, replies: 1, reactions: 1 });
    assert.equal(f.received.length, 0);
  } finally {
    await f.close();
  }
});
test("ambiguous status survives restart and the same ID is never sent again", async () => {
  const f = await fixture();
  try {
    f.socket.sendMessage = async () => {
      f.calls.push("attempt");
      throw new Error("connection lost");
    };
    assert.equal(
      (await f.client.sendMarketingStatus(f.body)).state,
      "uncertain",
    );
    f.client.marketingStore.close();
    f.client.marketingStore = null;
    assert.equal(
      (await f.client.sendMarketingStatus(f.body)).state,
      "uncertain",
    );
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test("concurrent sends share one durable dispatch intent", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      f.client.sendMarketingStatus(f.body),
      f.client.sendMarketingStatus(f.body),
    ]);
    assert.equal(f.calls.length, 1);
    assert.ok(results.some((row) => row.state === "published"));
  } finally {
    await f.close();
  }
});
test("an observed receipt resolves ambiguous delivery without another send", async () => {
  const f = await fixture();
  try {
    f.socket.sendMessage = async () => {
      f.calls.push("attempt");
      throw new Error("acknowledgement lost");
    };
    const result = await f.client.sendMarketingStatus(f.body);
    assert.equal(result.state, "uncertain");
    f.socket.ev.emit("message-receipt.update", [
      {
        key: { id: result.message_id, remoteJid: "status@broadcast" },
        receipt: { userJid: RECIPIENT, readTimestamp: 123 },
      },
    ]);
    assert.equal(f.client.marketingMetrics(ID).state, "published");
    assert.equal(f.client.marketingMetrics(ID).values.views, 1);
    f.client.marketingStore.uncertain(ID);
    assert.equal(f.client.marketingMetrics(ID).state, "published");
    await f.client.sendMarketingStatus(f.body);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test("account replacement clears contacts and does not inherit a previous account test", async () => {
  const store = new MarketingStatusStore(":memory:");
  try {
    store.bindAccount(PHONE);
    store.contacts([{ jid: RECIPIENT, name: "Kontak uji" }]);
    store.begin(ID, "message-1", PHONE, true);
    store.sent(ID);
    assert.equal(store.listContacts().length, 1);
    assert.ok(store.latestTest(PHONE));
    store.bindAccount("6289999999999");
    assert.equal(store.listContacts().length, 0);
    assert.equal(store.latestTest("6289999999999"), null);
  } finally {
    store.close();
  }
});
test("expired Status preserves observed counts without inventing absent metrics", () => {
  let now = Date.now();
  const store = new MarketingStatusStore(":memory:", () => now);
  try {
    store.begin(ID, "message-1", PHONE, true);
    store.sent(ID);
    store.observe("message-1", "views", RECIPIENT);
    now += 86400001;
    assert.equal(store.observe("message-1", "views", "another"), false);
    assert.equal(store.metrics(ID).reason, "STATUS_EXPIRED");
    assert.equal(store.metrics(ID).values.views, 1);
    assert.equal(store.metrics(ID).values.replies, null);
  } finally {
    store.close();
  }
});
