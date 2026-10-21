import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MemoryStore } from '../../state/memory_store.js';
import { MessageProcessor } from '../../services/message_processor.js';

export const NOW = Date.parse('2026-10-19T21:33:00+07:00');
export const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
  maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
export const noAi = { generate() { assert.fail('Selecting a known administrative parent does not need an LLM'); } };
export const regionChoiceScenarios = () => ['full', 'truncated'].flatMap((memory) => [
  ...['malang pak', 'Malang', 'yang Malang saja', 'di malang pak', 'Kab. Malang', 'Kabupaten Malang', 'Jawa Timur', 'Jatim pak']
    .map((text) => ({ memory, text, city: 'Kabupaten Malang', province: 'Jawa Timur' })),
  ...['magelang pak', 'Magelang', 'yang Magelang saja', 'Kab. Magelang', 'Jawa Tengah', 'Jateng pak']
    .map((text) => ({ memory, text, city: 'Kabupaten Magelang', province: 'Jawa Tengah' })),
]);

export async function simulateRegionChoice({ text = 'malang pak', city = 'Kabupaten Malang', province = 'Jawa Timur', memory = 'full', complete = false } = {}) {
  let now = NOW;
  const store = new MemoryStore(config, () => now), transcript = [], reads = [], sent = [], phone = '6280000000001';
  const processor = new MessageProcessor({ config, store, ai: noAi, now: () => now,
    catalog: { async resolve(_text, _id, criteria) { reads.push(criteria); return { asset: null, catalog: [], status: 'not_found', source: 'simulation' }; } },
    whatsapp: { async sendText(_phone, body) { sent.push(body); return randomUUID(); } },
    logger: { error(error) { assert.fail(error.event); } } });
  const send = async (content) => {
    const before = sent.length;
    processor.acceptBatch([{ id: randomUUID(), from: phone, type: 'text', text: content, timestamp: now }]); await processor.drain();
    assert.ok(sent.length > before); transcript.push({ user: content, bot: sent.slice(before).join('\n\n') });
  };
  try {
    await send(complete ? 'Cari rumah lelang di Pakis budget 300–900 juta luas tanah bebas' : 'Cari aset lelang di Pakis');
    const session = store.get(phone);
    assert.equal(session.buyer_state.regionClarification.name, 'Pakis');
    assert.equal(session.buyer_state.regionClarification.count, 2); assert.equal(reads.length, 0);
    if (memory === 'truncated') session.history = session.history.slice(-1);
    now += 60000; await send(text);
    assert.equal(session.buyer_state.regionClarification, null);
    assert.equal(session.buyer_state.profile.city, city); assert.equal(session.buyer_state.profile.province, province);
    assert.equal(session.buyer_state.profile.district, 'Pakis'); assert.equal(session.buyer_state.profile.location, 'Pakis');
    assert.equal(session.is_bot_active, true);
    assert.doesNotMatch(sent.at(-1), /Ada beberapa wilayah|kota atau kabupaten yang mana|Kalau keduanya|Kota Malang|Kota Magelang/);
    assert.ok(sent.at(-1).includes(city)); assert.ok(sent.at(-1).includes('Pakis'));
    assert.equal(reads.length, complete ? 1 : 0);
    if (complete) {
      assert.equal(reads[0].city, city); assert.equal(reads[0].district, 'Pakis');
      assert.equal(reads[0].min_price, 300000000); assert.equal(reads[0].max_price, 900000000);
    }
    return { name: `${memory}: ${text}${complete ? ' (complete)' : ''}`, passed: true, profile: session.buyer_state.profile, transcript };
  } catch (error) {
    return { name: `${memory}: ${text}`, passed: false, error: error.message, transcript };
  }
}
