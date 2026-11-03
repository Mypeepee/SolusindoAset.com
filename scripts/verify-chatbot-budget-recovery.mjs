// Read-only local integration probe: no real WhatsApp, CRM writes or LLM calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { getPropertyKnowledge } from '../src/lib/chatbot/property-knowledge.ts';
import { DatabaseCatalog } from '../backend/whatsapp/services/property_database.js';
import { MessageProcessor } from '../backend/whatsapp/services/message_processor.js';
import { MemoryStore } from '../backend/whatsapp/state/memory_store.js';
import { recommendationIds } from '../backend/whatsapp/services/recommendations.js';

for (const name of ['.env.local', '.env']) {
  const file = new URL(`../${name}`, import.meta.url);
  if (!fs.existsSync(file)) continue;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
    if (process.env[key] == null) process.env[key] = value;
  }
}
const db = new PrismaClient({ log: [] });
const now = Date.now();
const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const sent = [], lookups = [], store = new MemoryStore(config, () => now);
const catalog = new DatabaseCatalog({ url: 'https://read-only-probe.invalid/properties', token: 'local-probe', timeoutMs: 20000 }, {
  async fetchImpl(_url, request) {
    const input = JSON.parse(request.body);
    const result = await getPropertyKnowledge(db, input, now);
    lookups.push({ input, result });
    return Response.json(result);
  },
});
const processor = new MessageProcessor({ config, store, catalog, now: () => now,
  ai: { generate() { assert.fail('The reported conversation must work without an LLM'); } },
  whatsapp: { async sendText(_phone, text) { sent.push(text); return randomUUID(); } },
  logger: { error() { assert.fail('The read-only property lookup failed'); } },
});

try {
  const turns = ['siang', 'saya jason', 'mau cari rumah', 'surabaya, lelang pak', 'timur',
    '100000000', 'bebas', '300000000', '500000000'];
  for (const text of turns) {
    processor.acceptBatch([{ id: randomUUID(), from: '6280000000001', type: 'text', text, timestamp: now }]);
    await processor.drain();
  }
  assert.equal(sent.length, turns.length); assert.equal(lookups.length, 3);
  for (const [index, budget] of [100e6, 300e6, 500e6].entries()) {
    const { input, result } = lookups[index];
    assert.equal(input.criteria.max_price, budget); assert.equal(input.criteria.region_group, 'timur');
    assert.equal(input.criteria.category, 'RUMAH'); assert.equal(input.criteria.transaction_type, 'LELANG');
    assert.equal(result.asset, null, 'A budget answer must not select an ID');
    const numeric = await catalog.resolve(String(budget), null, input.criteria);
    const labelled = await catalog.resolve(`budget maksimal ${budget} rupiah`, null, input.criteria);
    assert.equal(numeric.status, labelled.status);
    assert.deepEqual(numeric.catalog.map(p => p.id), labelled.catalog.map(p => p.id));
    assert.deepEqual(numeric.diagnostics, labelled.diagnostics);
    const reply = sent[index + 6];
    assert.deepEqual(recommendationIds(reply), result.candidates.map(p => p.id));
    if (result.diagnostics) {
      assert.match(reply, /Ada listing.*masih tayang di situs/); assert.doesNotMatch(reply, /Belum ketemu/);
    }
    console.log(JSON.stringify({ budget, status: result.status, matched_properties: result.candidates.length,
      diagnostics: result.diagnostics || null, real_whatsapp_sent: false, database_writes: false }));
  }
} finally {
  await db.$disconnect();
}
