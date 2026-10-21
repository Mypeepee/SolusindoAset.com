import assert from 'node:assert/strict';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { isBuyerCriteria } from '../../../../src/lib/chatbot/property-knowledge.ts';

const people = [['tkzin', 'tkzin', null], ['Pak Zhafran', 'Zhafran', 'Pak'], ['Nadya Putri', 'Nadya Putri', null], ['Anne-Marie', 'Anne-Marie', null]];
const origins = ['Banten', 'Kab. Tangerang', 'D.I. Yogyakarta'];
const styles = [
  (name, place) => `saya ${name} dari ${place}`,
  (name, place) => `nama saya ${name}, asal dari ${place}`,
  (name, place) => `dengan ${name}, domisili di ${place}`,
  (name, place) => `aku ${name} tinggal di ${place}`,
  (name, place) => `saya ${name} berasal dari ${place}`,
  (name, place) => `saya ${name} asli ${place}`,
  (name, place) => `saya ${name} berdomisili ${place}`,
  (name, place) => `${name} dari ${place}`,
  (name, place) => `saya ${name}, saya dari ${place}`,
  (name, place) => `sy ${name} domisili ${place} 😊`,
];
export function introductionOriginScenarios() {
  return [{ name: 'tkzin dari banten persis', text: 'saya tkzin dari banten', identity: { name: 'tkzin', salutation: null } },
    ...people.flatMap(([label, name, salutation]) => origins.flatMap((place) => styles.map((style, index) => ({
      name: `${label} / ${place} / gaya ${index + 1}`, text: style(label, place), identity: { name, salutation },
    }))))];
}

export async function simulateIntroductionOrigin(scenario) {
  const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20,
    maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
  const store = new MemoryStore(config), phone = '6280000000024', replies = [], queries = [], captures = [], errors = [], transcript = [];
  let sequence = 0, aiCalls = 0;
  const processor = new MessageProcessor({ config, store,
    ai: { generate() { aiCalls++; throw Error('Unexpected AI'); }, interpretBuyer() { aiCalls++; throw Error('Unexpected interpretation'); } },
    catalog: { async resolve(_text, _id, criteria) {
      assert.ok(isBuyerCriteria(criteria)); queries.push(structuredClone(criteria));
      return { status: 'not_found', asset: null, catalog: [] };
    } },
    clients: { setName() {}, enqueue(value) { captures.push(structuredClone(value)); }, async flush() {} },
    whatsapp: { async sendText(_phone, text) { replies.push(text); return `mock-${sequence}`; } },
    logger: { error(value) { errors.push(value.event || value.code); } },
  });
  const send = async (text) => {
    const count = replies.length;
    processor.acceptBatch([{ id: `origin-${++sequence}`, from: phone, type: 'text', text, timestamp: Date.now() }]); await processor.drain();
    const session = store.get(phone);
    transcript.push({ user: text, reply: replies.at(-1), identity: structuredClone(session.client_identity), profile: structuredClone(session.buyer_state?.profile) });
    assert.equal(replies.length, count + 1, `Must reply to ${text}`);
    assert.deepEqual(errors, []); assert.equal(aiCalls, 0); assert.equal(session.is_bot_active, true);
    return session;
  };
  try {
    await send('selamat siang');
    const introduced = await send(scenario.text);
    assert.equal(introduced.client_identity.name, scenario.identity.name);
    assert.equal(introduced.client_identity.salutation, scenario.identity.salutation);
    assert.match(replies.at(-1), /Salam kenal/); assert.match(replies.at(-1), /Lagi cari properti di daerah mana/);
    assert.doesNotMatch(replies.at(-1), /Mau beli atau sewa|ngobrol dengan siapa/);
    assert.equal(queries.length, 0); assert.equal(captures.length, 0);
    assert.ok(!introduced.buyer_state?.searchStarted, 'Origin alone must not start a property search');
    introduced.history = introduced.history.slice(-2);
    const qualified = await send('cari rumah secondary di Benowo Surabaya budget 300 juta luas tanah bebas');
    assert.equal(queries.length, 1);
    const criteria = queries[0];
    assert.equal(criteria.city, 'Surabaya'); assert.equal(criteria.district.toLowerCase(), 'benowo');
    assert.equal(criteria.province, 'Jawa Timur'); assert.equal(criteria.max_price, 300e6);
    assert.equal(criteria.transaction_type, 'SECONDARY');
    assert.equal(qualified.client_identity.name, scenario.identity.name);
    assert.deepEqual(captures.at(-1).criteria, criteria); assert.equal(captures.at(-1).name, scenario.identity.name);
    assert.doesNotMatch(JSON.stringify(criteria), /banten|tangerang|yogyakarta|tkzin/i);
    return { name: scenario.name, passed: true, turns: transcript.length, transcript };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, turns: transcript.length, transcript }; }
}
