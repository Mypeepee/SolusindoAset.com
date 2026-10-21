import assert from 'node:assert/strict';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';

const config = { transport: 'baileys', replyDelayMs: 0, maxSessions: 10, maxPending: 20, maxPendingPerPhone: 10, maxDedup: 100, sessionTtlMs: 86400000 };
const names = [ ['Vera', 'Vera', null], ['Vera Anindita', 'Vera Anindita', null], ['Pak Budi Santoso', 'Budi Santoso', 'Pak'],
  ['Bu Rina', 'Rina', 'Bu'], ['Kak Alex', 'Alex', 'Kak'], ['Dwi', 'Dwi', null], ["Siti Nur'Aini", "Siti Nur'Aini", null], ['Anne-Marie', 'Anne-Marie', null] ];
const regions = [ ['Sidoarjo', 'Waru'], ['Sidoarjo', 'Taman'], ['Surabaya', 'Tandes'], ['Gresik', 'Menganti'],
  ['Jakarta Selatan', 'Tebet'], ['Kota Bandung', 'Coblong'] ];
const styles = [
  (name, city, district) => `saya ${name}, sedang cari aset di ${city}, ${district} sana`,
  (name, city, district) => `aku ${name} lagi nyari rumah di ${district} ${city}`,
  (name, city, district) => `nama saya ${name}; butuh rumah lelang di ${city} tepatnya ${district}`,
  (name, city, district) => `panggil saya ${name} aja, nyari rumah di daerah ${district}, ${city}`,
  (name, city, district) => `sy ${name}, lg nyari asset di ${city}, ${district} sekitar situ`,
  (name, city, district) => `${name} nih, lagi cari rmh lelang di area ${district}, ${city}, budget 500jt`,
  (name, city, district) => `lagi cari aset di ${district}, ${city}, nama saya ${name}`,
  (name, city, district) => `saya ${name} dan saya ingin cari aset di ${city}, daerah ${district}`,
  (name, city, district) => `dengan ${name}, mencari aset di ${district} ${city}`,
  (name, city, district) => `saya ${name}, cari rumah lelang di ${city}, ${district}; budget 500jt; luas tanah bebas`,
];
export function customerLanguageScenarios() {
  const scenarios = [{ name: 'percakapan Vera yang dilaporkan', opening: 'saya vera, sedang cari aset di sidoarjo, waru sana', identity: { name: 'vera', salutation: null }, city: 'Sidoarjo', district: 'Waru' }];
  for (const [label, name, salutation] of names) for (const [city, district] of regions) for (const [index, style] of styles.entries()) scenarios.push({
    name: `${label} / ${district}, ${city} / gaya ${index + 1}`, opening: style(label, city, district), identity: { name, salutation }, city, district,
  });
  const holdouts = [
    'ini Vera, rencananya cari rmh di Sidoarjo, daerah Waru',
    'saya namanya Vera, pengen cari rumah di Waru, Sidoarjo',
    'namanya Vera pak, nyari aset di Sidoarjo Waru',
    'Vera namaku, cari rumah di Sidoarjo Waru',
    'Vera nama saya, lagi cari rumah di Waru Sidoarjo',
    'kenalin saya Vera, lagi cari aset di Sidoarjo, Waru sana',
    'perkenalkan nama saya Vera, cari rumah di Waru Sidoarjo',
    'Vera 😊, lagi cari rumah di Waru Sidoarjo',
    'saya Vera 🙏 sedang nyari rumah di Waru Sidoarjo',
    'Vera di sini, rencana cari rumah lelang di Waru Sidoarjo',
    'saya Vera, cari rumah di Waru Sidoarjo, sama dekat sekolah',
    'Vera dari Surabaya, cari aset di Sidoarjo Waru',
    'nama saya Vera dari Jakarta, lagi cari rumah di Waru Sidoarjo',
    'saya Vera, bukan cari di Surabaya, maunya di Sidoarjo daerah Waru',
    'saya Vera, yang di Waru Sidoarjo, mau rumah lelang',
    'vera, maunya rumah, carinya di Sidoarjo, Waru',
    'Saya Vera, domisili Surabaya. Tapi carinya rumah daerah Waru Sidoarjo.',
    'saya Vera, pengen aset di sidoarjo daerah waru',
    'ini Vera, cari di Waru Sidoarjo',
    'saya Vera, pingin aset di Waru Sidoarjo',
    'sy Vera, pgn cari aset di Waru Sidoarjo',
    'sya Vera, sedang cari rumah di Waru Sidoarjo',
    'Vera, mau rumah di Waru Sidoarjo budget 500jt',
    'dengan Vera, cari rumah lelang daerah Waru Sidoarjo',
    'sama Vera, lagi nyari aset daerah Waru Sidoarjo',
    'saya Vera, cari rumah di Waru Sidoarjo, budget tetap 500 juta, sama aja yang penting rumah',
    'saya Vera, cari rumah di Waru Sidoarjo. Namanya daerahnya Waru ya pak',
    'Vera, lagi cari rumah deket sekolah di Waru Sidoarjo',
    'nama aku Vera, aku mau cari rumah di Waru Sidoarjo',
    'saya Vera dan saya sedang mencari rumah di Waru Sidoarjo',
  ];
  for (const [index, opening] of holdouts.entries()) scenarios.push({ name: `kalimat bebas ${index + 1}`, opening,
    identity: { name: index === 15 ? 'vera' : 'Vera', salutation: null }, city: 'Sidoarjo', district: 'Waru' });
  for (const name of ['Sari', 'Bandung', 'Waru']) scenarios.push({ name: `nama pribadi mirip wilayah: ${name}`, opening: `nama saya ${name}, lagi cari rumah di Tandes Surabaya`,
    identity: { name, salutation: null }, city: 'Surabaya', district: 'Tandes' });
  return scenarios;
}
const key = (value) => value?.toLowerCase().replace(/^(?:kota(?: administrasi)?|kabupaten)\s+/, '');
export async function simulateCustomerLanguage(scenario) {
  const store = new MemoryStore(config), phone = '6280000000001', replies = [], queries = [], captures = [], failures = [], transcript = [];
  let modelCalls = 0;
  const processor = new MessageProcessor({ config, store,
    ai: { generate() { modelCalls++; throw Error('UNEXPECTED_AI_GENERATION'); }, interpretBuyer() { modelCalls++; throw Error('UNEXPECTED_AI_INTERPRETATION'); } },
    catalog: { async resolve(text, id, criteria) { queries.push(structuredClone(criteria)); return { status: 'not_found', asset: null, catalog: [] }; } },
    clients: { setName() {}, enqueue(value) { captures.push(structuredClone(value)); }, async flush() {} },
    whatsapp: { async sendText(contact, text) { replies.push(text); return 'mock-message'; } },
    logger: { error(value) { failures.push(value.code || value.event || 'PROCESSING_ERROR'); } },
  });
  let sequence = 0;
  const send = async (text) => {
    const before = replies.length;
    processor.acceptBatch([{ id: `test-${++sequence}`, from: phone, timestamp: Date.now(), type: 'text', text }]); await processor.drain();
    assert.equal(replies.length, before + 1, `Expected one reply to: ${text}`);
    const session = store.get(phone); transcript.push({ user: text, reply: replies.at(-1), identity: { ...session.client_identity }, profile: structuredClone(session.buyer_state?.profile) });
    assert.deepEqual(failures, []); assert.equal(modelCalls, 0, 'Supported customer wording must not depend on a model call'); return session;
  };
  try {
    await send('halo');
    let session = await send(scenario.opening);
    const checkScope = () => {
      assert.equal(session.client_identity.name, scenario.identity.name, 'Name must never come from another clause');
      assert.equal(session.client_identity.salutation, scenario.identity.salutation);
      assert.equal(key(session.buyer_state?.profile.city), key(scenario.city));
      assert.equal(key(session.buyer_state?.profile.district), key(scenario.district));
      assert.doesNotMatch(replies.at(-1), /kota atau kabupaten mana|Incar daerah mana|kelurahan mana|ngobrol dengan siapa|Pak atau Bu siapa/i);
    };
    checkScope();
    if (!session.buyer_state.profile.transaction_type) { session = await send('lelang aja pak'); checkScope(); }
    if (!session.buyer_state.profile.max_price) { session = await send('budget 500 juta mentok'); checkScope(); }
    if (!session.buyer_state.profile.category) { session = await send('rumah'); checkScope(); }
    if (!session.buyer_state.landAreaAnswered) { session = await send('minimal 150 m2'); checkScope(); }
    const criteria = queries.at(-1);
    assert.ok(criteria, 'The completed funnel must reach the search query');
    assert.equal(key(criteria.city), key(scenario.city)); assert.equal(key(criteria.district), key(scenario.district));
    assert.equal(criteria.category, 'RUMAH'); assert.equal(criteria.transaction_type, 'LELANG'); assert.equal(criteria.max_price, 500000000);
    assert.equal(criteria.min_land_area_m2, /luas tanah bebas/.test(scenario.opening) ? null : 150);
    assert.equal(captures.at(-1)?.name, scenario.identity.name, 'The CRM capture must use the actual introduced name');
    assert.equal(captures.at(-1)?.phone, phone); assert.deepEqual(captures.at(-1)?.criteria, criteria);
    const { name, salutation } = scenario.identity;
    assert.ok(!JSON.stringify(criteria).toLowerCase().includes(name.toLowerCase()), 'The name must never become a search filter');
    return { name: scenario.name, passed: true, turns: transcript.length, transcript };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, transcript }; }
}
