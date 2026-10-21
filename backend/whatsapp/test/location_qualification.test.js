import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext } from '../services/buyer_profile.js';
import { searchReply } from '../services/search_reply.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { interactionDecision, historyPolicy } from '../services/interaction_policy.js';

const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
function conversation() {
  const history = [];
  return { history, send(text) {
    history.push(user(text));
    const buyer = buyerContext(history, text, null);
    const reply = searchReply({ buyer, status: buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' });
    if (reply) history.push(assistant(reply));
    return { buyer, reply };
  } };
}

const reportedSearch = 'tolong bantu carikan lelang saya property dong di daerah surabaya';
const reportedVillage = 'lebih tepatnya manukan kulon pak...';
const reportedBudget = 'saya cari lelang rumah sih pak, budget saya di angka 350 juta pak';

test('reported combined type and budget answer retains Manukan Kulon and asks only for land size', () => {
  const c = conversation(); c.send('selamat siang'); c.send(reportedSearch);
  const village = c.send(reportedVillage);
  assert.equal(village.buyer.profile.village, 'manukan kulon');
  const result = c.send(reportedBudget);
  assert.equal(result.buyer.profile.city, 'surabaya');
  assert.equal(result.buyer.profile.location, 'Tandes'); assert.equal(result.buyer.profile.district, 'Tandes');
  assert.equal(result.buyer.profile.village, 'manukan kulon');
  assert.equal(result.buyer.profile.category, 'RUMAH'); assert.equal(result.buyer.profile.max_price, 350000000);
  assert.deepEqual(result.buyer.missing, ['land_area']);
  assert.match(result.reply, /Manukan Kulon.*Tandes.*Surabaya/s); assert.match(result.reply, /luas tanah minimal atau maksimal/);
  assert.doesNotMatch(result.reply, /kelurahan mana|kecamatan mana|kota atau kabupaten mana|Budget-nya sampai berapa|Jenis properti apa|Angka 350/i);
  const withoutLocation = buyerContext([], reportedBudget, null);
  assert.equal(withoutLocation.profile.location, null); assert.equal(withoutLocation.profile.city, null);
  assert.equal(withoutLocation.profile.max_price, 350000000);
});

test('financial prepositions and conversational type answers cannot overwrite confirmed geography', () => {
  for (const answer of [reportedBudget, 'cari lelang rumah sih pak, budget saya di kisaran Rp350 juta',
    'rumah pak, anggaran saya di rentang 300-350 juta', 'saya cari lelang rumah dong pak, budget di 350 juta',
    'cari lelang rumah saja pak dengan budget di angka Rp350.000.000', 'cari lelang rumah, budget saya sekitar 350 jt']) {
    const c = conversation(); c.send(reportedSearch); c.send(reportedVillage);
    const { buyer, reply } = c.send(answer);
    assert.equal(buyer.profile.location, 'Tandes', answer); assert.equal(buyer.profile.district, 'Tandes', answer);
    assert.equal(buyer.profile.village, 'manukan kulon', answer); assert.equal(buyer.profile.city, 'surabaya', answer);
    assert.equal(buyer.profile.category, 'RUMAH', answer); assert.equal(buyer.profile.max_price, 350000000, answer);
    assert.deepEqual(buyer.missing, ['land_area'], answer); assert.doesNotMatch(reply, /kelurahan mana|kota atau kabupaten mana/i, answer);
  }
  const c = conversation(); c.send(reportedSearch); c.send(reportedVillage);
  const { buyer } = c.send('saya cari lelang rumah sih pak');
  assert.equal(buyer.profile.village, 'manukan kulon'); assert.equal(buyer.profile.location, 'Tandes');
  assert.deepEqual(buyer.missing, ['max_price', 'land_area']);
});

test('a genuine area change remains possible before or after a financial phrase', () => {
  for (const answer of ['cari lelang rumah di Manukan Wetan, budget saya di angka 350 juta',
    'budget saya di angka 350 juta, cari lelang rumah di Manukan Wetan pak',
    'cari lelang rumah budget saya di angka 350 juta di Manukan Wetan pak',
    'cari lelang rumah di Manukan Wetan 350 juta pak', 'cari lelang rumah Manukan Wetan sekitar 350 juta pak']) {
    const c = conversation(); c.send(reportedSearch); c.send(reportedVillage);
    const { buyer } = c.send(answer);
    assert.equal(buyer.profile.city, 'surabaya', answer); assert.equal(buyer.profile.location, 'Tandes', answer);
    assert.equal(buyer.profile.village, 'Manukan Wetan', answer); assert.equal(buyer.profile.max_price, 350000000, answer);
    assert.deepEqual(buyer.missing, ['land_area'], answer);
  }
});

test('exact interest-only request opens search and confirms the city before budget, without DB or AI', async () => {
  const text = 'saya tertarik lelang di manukan';
  assert.equal(interactionDecision({ text }), 'allow');
  assert.equal(historyPolicy([assistant('unrelated'), user(text)]).out_of_scope_notified, false);
  const result = await generatePropertyReply({ text, history: [user(text)],
    catalog: { resolve() { assert.fail('Geographic clarification must precede a property query'); } },
    ai: { generate() { assert.fail('Clarification must work when the model is unavailable'); } } });
  assert.equal(result.knowledge.status, 'qualifying');
  assert.match(result.reply, /Manukan.*kota atau kabupaten mana/s);
  assert.doesNotMatch(result.reply, /Surabaya|[Bb]udget|investasi/);
});

test('area -> city -> budget -> category retains each confirmed preference', () => {
  const c = conversation(); c.send('saya tertarik lelang di manukan');
  const city = c.send('di Surabaya pak');
  assert.equal(city.buyer.profile.location, 'manukan'); assert.equal(city.buyer.profile.city, 'Surabaya');
  assert.doesNotMatch(city.reply, /kelurahan mana/); assert.doesNotMatch(city.reply, /kota atau kabupaten mana/);
  const village = c.send('kelurahan bebas'); assert.match(village.reply, /[Bb]udget/);
  const budget = c.send('700 juta pak');
  assert.deepEqual(budget.buyer.missing, ['category', 'land_area']);
  assert.doesNotMatch(budget.reply, /Budget-nya sampai berapa/);
  const category = c.send('ruko pak'); assert.deepEqual(category.buyer.missing, ['land_area']);
  const final = c.send('bebas');
  assert.equal(final.buyer.stage, 'recommendations');
  assert.equal(final.buyer.profile.max_price, 700000000); assert.equal(final.buyer.profile.category, 'RUKO'); assert.equal(final.buyer.profile.purpose, null);
  assert.equal(final.buyer.profile.location, 'manukan'); assert.equal(final.buyer.profile.city, 'Surabaya');
});

test('city-only interest asks for a specific area and budget, including unprefixed known cities', () => {
  for (const city of ['kota surabaya', 'Surabaya', 'Kabupaten Sidoarjo', 'Kota Bandung', 'Manado']) {
    const c = conversation(), opening = c.send(`saya tertarik lelang di ${city}`);
    assert.equal(opening.buyer.profile.location, null, city);
    assert.match(opening.reply, /[Ii]ncar daerah mana/); assert.match(opening.reply, /[Bb]udget/);
    assert.equal((opening.reply.match(/\?/g) || []).length, 2);
    const area = c.send('Manukan pak, budget 700 juta');
    assert.equal(area.buyer.profile.location, 'Manukan'); assert.equal(area.buyer.profile.city.toLowerCase(), city.toLowerCase());
    assert.deepEqual(area.buyer.missing, ['category', 'land_area']);
  }
});

test('reported Surabaya -> full Tandes interest reply narrows the known city instead of asking it again', () => {
  const c = conversation();
  c.send('selamat siang, saya lagi cari lelang aset di surabaya');
  const area = c.send('saya tertarik lelang di daerah tandes pak');
  assert.equal(area.buyer.profile.city, 'surabaya');
  assert.equal(area.buyer.profile.location, 'tandes');
  assert.deepEqual(area.buyer.missing, ['max_price', 'category', 'land_area']);
  assert.match(area.reply, /Tandes.*Surabaya/s); assert.doesNotMatch(area.reply, /kelurahan mana/);
  assert.doesNotMatch(area.reply, /kota atau kabupaten mana|Daerah tandes|daerah tandes/);
});

test('a unique district supplies its verified city and strips conversational area labels', () => {
  for (const answer of ['Saya tertarik lelang di daerah Tandes pak', 'Cari lelang rumah di kawasan Tandes', 'Cari lelang aset di Kecamatan Tandes']) {
    const c = conversation(), result = c.send(answer);
    assert.equal(result.buyer.profile.location, 'Tandes'); assert.equal(result.buyer.profile.city, 'Surabaya');
    assert.equal(result.buyer.profile.district, 'Tandes');
    assert.doesNotMatch(result.reply, /kelurahan mana/); assert.doesNotMatch(result.reply, /kota atau kabupaten mana|Daerah Tandes/);
  }
});

test('conversational area refinements preserve a confirmed city across multiple phrasings and cities', () => {
  const replies = ['saya tertarik lelang di daerah Tandes pak', 'saya tertarik lelang di Tandes pak', 'saya ingin di Kecamatan Tandes',
    'tolong carikan lelang aset di kawasan Tandes', 'Saya cari lelang rumah di daerah Tandes', 'di wilayah Kecamatan Tandes',
    'daerah Tandes saja pak', 'Tandes, Pak', 'di sekitar Tandes pak'];
  for (const [city, district] of [['Surabaya', 'Tandes'], ['Kota Bandung', 'Coblong'], ['Kabupaten Sidoarjo', 'Taman']]) {
    for (const phrase of replies) {
      const answer = phrase.replaceAll('Tandes', district);
      const c = conversation(); c.send(`Cari lelang aset di ${city}`);
      const area = c.send(answer);
      assert.equal(area.buyer.profile.city, city, `${city}: ${answer}`);
      assert.equal(area.buyer.profile.location, district, answer);
      assert.equal(area.buyer.profile.district, district, answer);
      assert.doesNotMatch(area.reply, /kota atau kabupaten mana/);
    }
  }
});

test('area refinement preserves an earlier budget and purpose and sends the complete scoped criteria to DB', async () => {
  const history = [], queries = [];
  const catalog = { async resolve(text, previousId, criteria) {
    queries.push(criteria); return { asset: null, catalog: [], status: 'not_found', source: 'database_listing_publik' };
  } };
  const ai = { generate() { assert.fail('Known preferences must not depend on AI'); } };
  const send = async (text) => {
    history.push(user(text));
    const result = await generatePropertyReply({ text, history, catalog, ai });
    history.push(assistant(result.reply)); return result;
  };
  const opening = await send('Cari lelang ruko di Surabaya budget 700 juta untuk investasi');
  assert.match(opening.reply, /[Ii]ncar daerah mana/); assert.equal(queries.length, 0);
  const area = await send('saya tertarik lelang di daerah Tandes pak'); assert.doesNotMatch(area.reply, /kelurahan mana/);
  const village = await send('kelurahan bebas'); assert.match(village.reply, /luas tanah/);
  const refined = await send('bebas');
  assert.equal(refined.knowledge.status, 'not_found');
  assert.equal(queries.length, 1); assert.equal(queries[0].city, 'Surabaya'); assert.equal(queries[0].location, 'Tandes');
  assert.equal(queries[0].max_price, 700000000); assert.equal(queries[0].purpose, 'investment');
  assert.doesNotMatch(refined.reply, /kota atau kabupaten mana|Budget-nya sampai berapa|dihuni sendiri, investasi/);
});

test('switching areas within the current city retains city and budget after qualification', () => {
  const c = conversation(); c.send('Cari lelang rumah di Manukan, Surabaya budget 700 juta untuk investasi');
  const changed = c.send('saya lebih tertarik lelang di daerah Tandes pak');
  assert.equal(changed.buyer.stage, 'qualifying'); assert.ok(!changed.buyer.missing.includes('village'));
  assert.equal(changed.buyer.profile.city, 'Surabaya'); assert.equal(changed.buyer.profile.location, 'Tandes');
  assert.equal(changed.buyer.profile.max_price, 700000000); assert.equal(changed.buyer.profile.purpose, 'investment');
});

test('budget supplied ahead of the city is retained, including a combined city/budget answer', () => {
  for (const reply of ['di Surabaya pak', 'Surabaya, budget 700 juta', 'Manukan, Surabaya']) {
    const c = conversation(); c.send('Saya tertarik lelang di Manukan budget 700 juta');
    const city = c.send(reply);
    assert.deepEqual(city.buyer.missing, ['category', 'land_area']); assert.equal(city.buyer.profile.max_price, 700000000);
    assert.equal(city.buyer.profile.location, 'Manukan'); assert.equal(city.buyer.profile.city, 'Surabaya');
    assert.doesNotMatch(city.reply, /Budget-nya sampai berapa/);
  }
});

test('a client can explicitly opt into the whole city without a clarification loop', () => {
  for (const answer of ['mana saja pak', 'bebas pak', 'di seluruh Surabaya', 'Surabaya mana saja']) {
    const c = conversation(); c.send('Saya tertarik lelang di Surabaya');
    const broad = c.send(answer);
    assert.equal(broad.buyer.profile.location, 'Surabaya', answer);
    assert.doesNotMatch(broad.reply, /[Ii]ncar daerah mana/);
    const criteria = c.send('Cari lelang rumah budget 700 juta'); assert.deepEqual(criteria.buyer.missing, ['land_area']);
    const final = c.send('bebas');
    assert.equal(final.buyer.stage, 'recommendations'); assert.equal(final.buyer.profile.city, 'Surabaya');
  }
});

test('explicit combined geography skips answered questions; administrative scope is preserved', () => {
  for (const [phrase, city] of [['Manukan, Surabaya', 'Surabaya'], ['Manukan di Surabaya', 'Surabaya'],
    ['Manukan Kota Surabaya', 'Kota Surabaya'], ['kota Surabaya daerah Manukan', 'kota Surabaya']]) {
    const c = conversation(), result = c.send(`Cari lelang rumah di ${phrase} budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas`);
    assert.equal(result.buyer.stage, 'recommendations', phrase);
    assert.equal(result.buyer.profile.location, 'Manukan'); assert.equal(result.buyer.profile.city, city);
  }
});

test('changing to another city clears the old area but preserves budget and purpose', () => {
  const c = conversation(); c.send('Cari lelang rumah di Manukan, Surabaya budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas');
  const changed = c.send('Ganti ke kota Manado');
  assert.equal(changed.buyer.profile.location, null); assert.equal(changed.buyer.profile.city, 'kota Manado');
  assert.deepEqual(changed.buyer.missing, ['location']);
  assert.match(changed.reply, /[Ii]ncar daerah mana/); assert.doesNotMatch(changed.reply, /Budget-nya sampai berapa/);
});

test('an explicitly restarted unscoped search asks for the city again', () => {
  const c = conversation(); c.send('Cari lelang rumah di Manukan, Surabaya budget 700 juta untuk investasi, kelurahan bebas, luas tanah bebas');
  const changed = c.send('Mulai pencarian baru, cari lelang rumah di Citraland');
  assert.equal(changed.buyer.profile.location, 'Citraland'); assert.equal(changed.buyer.profile.city, null);
  assert.deepEqual(changed.buyer.missing, ['city']); assert.match(changed.reply, /kota atau kabupaten mana/);
});

test('uncertainty or an assistant guess never establishes a city or a free-choice area', () => {
  const history = [user('Saya tertarik lelang di Manukan'), assistant('Manukan ada di Surabaya. Berapa budget Bapak/Ibu?'), user('700 juta untuk investasi')];
  const buyer = buyerContext(history, history.at(-1).content, null);
  assert.deepEqual(buyer.missing, ['city', 'category', 'land_area']); assert.equal(buyer.profile.city, null);
  const c = conversation(); c.send('Saya tertarik lelang di Surabaya');
  const uncertain = c.send('belum tahu pak');
  assert.equal(uncertain.buyer.profile.location, null); assert.ok(uncertain.buyer.missing.includes('location'));
});
