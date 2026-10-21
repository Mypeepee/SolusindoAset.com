import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerContext } from '../services/buyer_profile.js';
import { resolveRegion, regionSnapshot } from '../services/region_directory.js';
import { searchReply } from '../services/search_reply.js';
import { generatePropertyReply } from '../services/property_reply.js';

const user = (content) => ({ role: 'user', content });
const noAi = { generate() { assert.fail('Region qualification must work without AI'); } };
function conversation() {
  const history = [];
  return { history, send(text) {
    history.push(user(text)); const buyer = buyerContext(history, text, null), reply = searchReply({ buyer, status: 'not_found' });
    if (reply) history.push({ role: 'assistant', content: reply });
    return { buyer, reply };
  } };
}

test('reported Jakarta Selatan request is recognized as a city without a premature property query or model', async () => {
  const text = 'halo pak, saya ingin cari lelang aset di daerah jakarta selatan, apa adakah pak?';
  const result = await generatePropertyReply({ text, history: [user(text)], ai: noAi,
    catalog: { resolve() { assert.fail('Must qualify before searching listings'); } } });
  assert.equal(result.knowledge.status, 'qualifying'); assert.equal(result.generation.mode, 'rules');
  assert.match(result.reply, /Jakarta Selatan/); assert.match(result.reply, /[Ii]ncar daerah mana/);
  assert.match(result.reply, /Pak atau Bu siapa/); assert.doesNotMatch(result.reply, /apa adakah|kota atau kabupaten mana/);
});

test('national snapshot covers every administrative level and recognizes districts beyond listing coverage', () => {
  assert.deepEqual(regionSnapshot.counts, { province: 38, city: 514, district: 7285, village: 83762 });
  for (const [district, city, province] of [
    ['Abepura', 'Kota Jayapura', 'Papua'], ['Pontianak Selatan', 'Pontianak', 'Kalimantan Barat'],
    ['Denpasar Barat', 'Denpasar', 'Bali'], ['Wara', 'Palopo', 'Sulawesi Selatan'],
    ['Cakranegara', 'Mataram', 'Nusa Tenggara Barat'], ['Tandes', 'Surabaya', 'Jawa Timur'],
  ]) {
    const result = conversation().send(`Carikan lelang aset di Kecamatan ${district} pak`);
    assert.equal(result.buyer.profile.district, district); assert.equal(result.buyer.profile.city, city);
    assert.equal(result.buyer.profile.province, province); assert.doesNotMatch(result.reply, /kelurahan mana/);
    assert.doesNotMatch(result.reply, /kota atau kabupaten mana/);
  }
});

test('longest city name, administrative prefixes, aliases and conversational tails retain the correct level', () => {
  for (const location of ['Jakarta Selatan, apa adakah pak?', 'Jakarta Selatan apakah ada pak?',
    'Kota Administrasi Jakarta Selatan pak?', 'Kota Adm. Jakarta Selatan pak?', 'Jaksel, ada pak?', 'Jakarta Selatan, tolong yang murah pak']) {
    const result = conversation().send(`Saya cari lelang aset di ${location}`);
    assert.match(result.buyer.profile.city, /Jakarta Selatan/i); assert.equal(result.buyer.profile.location, null);
    assert.equal(result.buyer.profile.province, 'Daerah Khusus Ibukota Jakarta');
    assert.match(result.reply, /[Ii]ncar daerah mana/);
  }
});

test('province, city, district and village progressively narrow without overwriting earlier budget and purpose', () => {
  const c = conversation();
  const province = c.send('Cari lelang rumah di DKI Jakarta budget 900 juta untuk dihuni sekaligus investasi');
  assert.equal(province.buyer.profile.city, null); assert.equal(province.buyer.profile.location, null);
  assert.match(province.reply, /kota atau kabupaten mana/);
  assert.match(c.send('Jakarta Selatan').reply, /[Ii]ncar daerah mana/);
  const district = c.send('Tebet pak');
  assert.equal(district.buyer.profile.city, 'Jakarta Selatan'); assert.equal(district.buyer.profile.district, 'Tebet');
  assert.doesNotMatch(district.reply, /kelurahan mana/); assert.doesNotMatch(district.reply, /kota atau kabupaten mana/);
  const village = c.send('Tebet Barat');
  assert.equal(village.buyer.profile.village, 'Tebet Barat'); assert.deepEqual(village.buyer.missing, ['land_area']);
  const final = c.send('minimal 100 m2 maksimal 200 m2');
  assert.equal(final.buyer.stage, 'recommendations'); assert.equal(final.buyer.profile.max_price, 900000000);
  assert.equal(final.buyer.profile.purpose, 'both'); assert.equal(final.buyer.profile.category, 'RUMAH');
  assert.equal(final.buyer.profile.min_land_area_m2, 100); assert.equal(final.buyer.profile.max_land_area_m2, 200);
});

test('a named village infers the complete verified chain and skips already answered geography questions', () => {
  const result = conversation().send('Cari lelang ruko di Kelurahan Manukan Kulon, budget 700 juta untuk investasi');
  assert.equal(result.buyer.profile.village, 'Manukan Kulon'); assert.equal(result.buyer.profile.district, 'Tandes');
  assert.equal(result.buyer.profile.city, 'Surabaya'); assert.equal(result.buyer.profile.province, 'Jawa Timur');
  assert.deepEqual(result.buyer.missing, ['land_area']); assert.match(result.reply, /luas tanah/);
});

test('city/regency ambiguity is explicit and a labelled answer resolves it without another clarification loop', () => {
  const c = conversation(), first = c.send('Cari lelang aset di Bandung');
  assert.equal(first.buyer.profile.city, null); assert.match(first.reply, /Kabupaten Bandung/); assert.match(first.reply, /Kota Bandung/);
  const selected = c.send('Kota Bandung');
  assert.equal(selected.buyer.profile.city, 'Kota Bandung'); assert.equal(selected.buyer.region_clarification, null);
  assert.match(selected.reply, /[Ii]ncar daerah mana/);
});

test('ambiguous districts retain the pending name and buyer criteria until a parent is supplied', () => {
  const c = conversation(), first = c.send('Cari lelang aset di Kecamatan Taman');
  assert.equal(first.buyer.profile.city, null); assert.match(first.reply, /Sidoarjo/); assert.match(first.reply, /Pemalang/); assert.match(first.reply, /Madiun/);
  const budget = c.send('700 juta untuk investasi');
  assert.equal(budget.buyer.region_clarification.name, 'Taman'); assert.equal(budget.buyer.profile.max_price, 700000000);
  const selected = c.send('Kabupaten Sidoarjo');
  assert.equal(selected.buyer.profile.district, 'Taman'); assert.equal(selected.buyer.profile.city, 'Kabupaten Sidoarjo');
  assert.equal(selected.buyer.region_clarification, null); assert.equal(selected.buyer.profile.purpose, 'investment');
  assert.doesNotMatch(selected.reply, /kelurahan mana/); assert.doesNotMatch(selected.reply, /kota atau kabupaten mana/);
});

test('a province can disambiguate a pending district through the hierarchy', () => {
  const c = conversation(); c.send('Cari lelang aset di Kecamatan Taman');
  const selected = c.send('Jawa Tengah');
  assert.equal(selected.buyer.profile.city, 'Pemalang'); assert.equal(selected.buyer.profile.district, 'Taman');
  assert.equal(selected.buyer.region_clarification, null);
});

test('duplicate villages in a confirmed regency ask for the district and retain the village after the answer', () => {
  const c = conversation(), first = c.send('Cari lelang aset di Kelurahan Sukamaju Kabupaten Bogor');
  assert.match(first.reply, /kecamatan mana/); assert.doesNotMatch(first.reply, /kota atau kabupaten mana/);
  const selected = c.send('Kecamatan Jonggol');
  assert.equal(selected.buyer.profile.village, 'Sukamaju'); assert.equal(selected.buyer.profile.district, 'Jonggol');
  assert.equal(selected.buyer.profile.city, 'Kabupaten Bogor'); assert.equal(selected.buyer.region_clarification, null);
  assert.deepEqual(selected.buyer.missing, ['max_price', 'category', 'land_area']);
});

test('contradictory parents are clarified rather than silently relocating the buyer', () => {
  const c = conversation(); c.send('Cari lelang aset di Kota Bandung budget 700 juta untuk investasi');
  const conflict = c.send('Kecamatan Tandes');
  assert.equal(conflict.buyer.profile.city, 'Kota Bandung'); assert.equal(conflict.buyer.region_clarification.kind, 'conflict');
  assert.match(conflict.reply, /Surabaya/); assert.doesNotMatch(conflict.reply, /[Bb]udget/);
  const selected = c.send('Surabaya');
  assert.equal(selected.buyer.profile.city, 'Surabaya'); assert.equal(selected.buyer.profile.district, 'Tandes');
  assert.equal(selected.buyer.profile.max_price, 700000000); assert.equal(selected.buyer.region_clarification, null);
});

test('a village under a different district clarifies the district while retaining the confirmed city', () => {
  const c = conversation(); c.send('Cari lelang aset di Kecamatan Tandes');
  const conflict = c.send('Kelurahan Wiyung');
  assert.equal(conflict.buyer.profile.city, 'Surabaya');
  assert.match(conflict.buyer.region_clarification.scope, /Kecamatan Tandes, Surabaya/);
  assert.match(conflict.reply, /kecamatan mana/); assert.doesNotMatch(conflict.reply, /kota atau kabupaten mana/);
  const selected = c.send('Kecamatan Wiyung');
  assert.equal(selected.buyer.profile.village, 'Wiyung'); assert.equal(selected.buyer.profile.district, 'Wiyung');
  assert.equal(selected.buyer.profile.city, 'Surabaya'); assert.equal(selected.buyer.region_clarification, null);
});

test('administrative labels distinguish same-name levels; an informal one-word neighborhood stays conservative', () => {
  assert.equal(resolveRegion('Batu').district, null); assert.equal(resolveRegion('Kecamatan Batu').district, 'Batu');
  assert.equal(resolveRegion('Kecamatan Pamanukan').city, 'Subang');
  const c = conversation(), area = c.send('Saya tertarik lelang di Manukan');
  assert.equal(area.buyer.profile.city, null); assert.equal(area.buyer.profile.location, 'Manukan');
  const city = c.send('Surabaya');
  assert.equal(city.buyer.profile.city, 'Surabaya'); assert.equal(city.buyer.profile.district, null);
  assert.doesNotMatch(city.reply, /kelurahan mana/);
});

test('whole-city scope and switching city/regency of the same name clear stale lower-level preferences', () => {
  const c = conversation(); c.send('Cari lelang aset di Kota Malang budget 700 juta untuk investasi');
  const all = c.send('Seluruh kota pak');
  assert.equal(all.buyer.profile.location, 'Kota Malang'); assert.equal(all.buyer.profile.district, null);
  assert.doesNotMatch(all.reply, /kelurahan mana|[Ii]ncar daerah mana/);
  const switched = c.send('Ganti ke Kabupaten Malang');
  assert.equal(switched.buyer.profile.city, 'Kabupaten Malang'); assert.equal(switched.buyer.profile.location, null);
  assert.equal(switched.buyer.profile.max_price, 700000000); assert.match(switched.reply, /[Ii]ncar daerah mana/);
});

test('unknown cities never become administrative facts or trigger listing recommendations', () => {
  const result = conversation().send('Cari lelang aset di Kota Atlantis budget 700 juta untuk investasi, luas tanah bebas');
  assert.equal(result.buyer.profile.city, null); assert.equal(result.buyer.stage, 'qualifying');
  assert.equal(result.buyer.region_clarification.kind, 'unknown'); assert.match(result.reply, /ejaan/);
});
