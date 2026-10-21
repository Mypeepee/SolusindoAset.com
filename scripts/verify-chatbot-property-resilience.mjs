// Read-only local integration probe. Replies stay in memory: no WhatsApp,
// CRM writes, LLM calls, persisted conversations or customer messages.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { loadConfig } from '../backend/whatsapp/config.js';
import { DatabaseCatalog } from '../backend/whatsapp/services/property_database.js';
import { MessageProcessor } from '../backend/whatsapp/services/message_processor.js';
import { MemoryStore } from '../backend/whatsapp/state/memory_store.js';
import { recommendationIds } from '../backend/whatsapp/services/recommendations.js';
import { SURABAYA_REGIONS } from '../backend/whatsapp/services/search_scope.js';

const env = dotenv.parse(fs.readFileSync(fileURLToPath(new URL('../backend/whatsapp/.env', import.meta.url))));
const propertyConfig = loadConfig(env).propertyDatabase;
assert.ok(propertyConfig, 'Property API must be configured');
const turns = ['halo', 'feli, saya mau cari rumah', 'lelang', 'surabaya', 'surabaya timur', '300 juta', 'bebas'];
const normalized = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

for (const mode of ['normal', 'temporary_timeout_and_503']) {
  const config = { transport: 'baileys', maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const sent = [], errors = [], responses = [];
  let requests = 0;
  const catalog = new DatabaseCatalog(propertyConfig, { fetchImpl: async (url, options) => {
    requests += 1;
    if (mode !== 'normal' && requests === 1) throw new DOMException('Simulated timeout', 'TimeoutError');
    if (mode !== 'normal' && requests === 2) return Response.json({ error: 'PROPERTY_LOOKUP_UNAVAILABLE' }, { status: 503 });
    const response = await fetch(url, options);
    responses.push({ status: response.status, data: await response.clone().json() });
    return response;
  } });
  const store = new MemoryStore(config);
  const processor = new MessageProcessor({ config, store, catalog,
    ai: { generate() { assert.fail('Clear search must not need AI'); } },
    whatsapp: { async sendText(_phone, text) { sent.push(text); return `test-only-${sent.length}`; } },
    logger: { error(error) { errors.push(error); } } });
  const started = performance.now();
  for (const [index, text] of turns.entries()) {
    processor.acceptBatch([{ id: `${mode}-${index}`, from: '628123456789', type: 'text', text, timestamp: Date.now() }]);
    await processor.drain();
  }
  assert.deepEqual(errors, []); assert.equal(responses.length, 1);
  assert.equal(responses[0].status, 200);
  const result = responses[0].data;
  assert.equal(result.status, 'recommendations'); assert.ok(result.candidates.length > 0);
  for (const property of result.candidates) {
    assert.equal(property.transaction_type, 'LELANG'); assert.equal(property.category, 'RUMAH');
    assert.ok(property.limit_price > 0 && property.limit_price <= 300000000);
    assert.match(property.address.city, /surabaya/i);
    assert.ok(SURABAYA_REGIONS.timur.some((district) => normalized(property.address.district || '').includes(normalized(district))));
  }
  const ids = sent.flatMap((reply) => recommendationIds(reply));
  assert.deepEqual(ids, result.candidates.map((property) => property.id));
  assert.doesNotMatch(sent.join('\n'), /belum dapat diakses|sedang terkendala/);
  assert.equal(requests, mode === 'normal' ? 1 : 3);
  console.log(JSON.stringify({ mode, duration_ms: Math.round(performance.now() - started), requests,
    matched_properties: ids.length, real_whatsapp_sent: false }));
}
