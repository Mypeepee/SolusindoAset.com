import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationFixture, NOW, PHONE } from '../scripts/lib/consultation-fixture.js';
import { parseSurveyTime } from '../services/survey_time.js';
import { saleCostEstimate, purchaseCostReply } from '../services/property_costs.js';

for (const text of ['kondisinya gimana ko?', 'bangunane piye?', 'bangunannya gimana?', 'daleme piye?', 'iso mlebu ta?', 'boleh masuk cek dalemnya?', 'mau viewing besok jam 10', 'pengen survey lokasi', 'bisa liat langsung?']) {
  test(`auction: ${text}`, async t => { const f = consultationFixture('LELANG'); t.after(() => f.close());
    const reply = await f.send(text); assert.match(reply, /sendiri dari luar/); assert.match(reply, /tidak diperkenankan masuk/);
    assert.match(reply, /akses jalan/); assert.match(reply, /lingkungan/); assert.equal(f.calls.length, 0); assert.equal(f.bookings.size, 0);
    assert.equal(f.processor.store.get(PHONE).is_bot_active, true); assert.deepEqual(f.errors, []);
  });
}
for (const type of ['PRIMARY','SECONDARY']) for (const text of ['all in brp ko?', 'rincian pembeliannya dong', 'kena pajak sama AJB berapa?', 'nambah piro buat biaya beli?', 'siap dana berapa setelah beli?']) {
  test(`${type} costs: ${text}`, async t => { const f = consultationFixture(type); t.after(() => f.close());
    const reply = await f.send(text); for (const money of ['50.000.000','5.000.000','10.000.000','60.000.000','65.000.000','1.060.000.000','1.065.000.000']) assert.ok(reply.includes(money), reply);
    assert.match(reply, /NPOPTKP/); assert.match(reply, /tidak ditambahkan dua kali/); assert.match(reply, /kondisi aset/);
    assert.doesNotMatch(reply, /Bea Lelang|Fee Agent|pengosongan|worst case/); assert.deepEqual(f.errors, []);
  });
}
test('condition first -> yes -> costs, then avoids repeatedly offering the same explanation', async t => {
  const f = consultationFixture(); t.after(() => f.close());
  const condition = await f.send('kondisi dalemnya gimana?'); assert.match(condition, /pendampingan agen/); assert.match(condition, /rincian biaya/);
  const costs = await f.send('boleh'); assert.match(costs, /Cadangan BPHTB/); assert.doesNotMatch(costs, /Mau saya jelaskan kondisi/);
  assert.equal(f.bookings.size, 0); assert.deepEqual(f.errors, []);
});
test('costs first -> informal yes -> condition -> assisted appointment is stored once for the sender agent', async t => {
  const f = consultationFixture(); t.after(() => f.close());
  await f.send('itung total biayanya'); const condition = await f.send('nggih'); assert.match(condition, /pendampingan agen/);
  const proposal = await f.send('besok jam 10 pagi saya mau survey'); assert.match(proposal, /Kamis, 22 Oktober 2026 pukul 10.00 WIB/); assert.match(proposal, /Boleh saya catat/);
  assert.equal(f.bookings.size, 0);
  const receipt = await f.send('iya'); assert.match(receipt, /menunggu konfirmasi agen/); assert.equal(f.bookings.size, 1);
  assert.equal(f.calls.find(c => c.action === 'book').agent_id, 'AG108');
  await f.send('iya'); assert.equal(f.bookings.size, 1); assert.deepEqual(f.errors, []);
});
test('primary or rental viewing can collect a day, a time, and a missing name across separate bubbles', async t => {
  const f = consultationFixture('SEWA', { named: false }); t.after(() => f.close());
  assert.match(await f.send('mau viewing'), /hari atau tanggal/);
  assert.match(await f.send('sesuk'), /Pukul berapa/);
  assert.match(await f.send('jam 1 siang'), /nama/);
  assert.match(await f.send('nama saya Rina'), /Rina/);
  const reply = await f.send('setuju'); assert.match(reply, /menunggu konfirmasi/); assert.equal(f.bookings.size, 1);
  const costs = await f.send('biaya sewanya brp?'); assert.match(costs, /50.000.000/); assert.doesNotMatch(costs, /Cadangan BPHTB 5%|AJB 0,5%/);
  assert.deepEqual(f.errors, []);
});
test('full natural query keeps a time mentioned alongside the cost question', async t => {
  const f = consultationFixture('PRIMARY'); t.after(() => f.close());
  const reply = await f.send('all in brp? sekalian mau survey besok jam 10 pagi');
  assert.match(reply, /Cadangan BPHTB/); assert.match(reply, /22 Oktober 2026 pukul 10.00 WIB/); assert.equal(f.bookings.size, 0);
  await f.send('boleh'); assert.equal(f.bookings.size, 1); assert.deepEqual(f.errors, []);
});
test('a lost save receipt and restart retry the exact same request without duplicating the appointment', async t => {
  const f = consultationFixture(); t.after(() => f.close());
  await f.send('jadwalkan survey besok jam 10 pagi'); f.loseNextReceipt();
  const uncertain = await f.send('ya'); assert.match(uncertain, /belum mendapat kepastian/); assert.equal(f.bookings.size, 1);
  const key = f.calls.find(c => c.action === 'book').request_id;
  f.restart(); const recovered = await f.send('coba lagi'); assert.match(recovered, /menunggu konfirmasi/); assert.equal(f.bookings.size, 1);
  assert.equal(f.calls.filter(c => c.action === 'book').at(-1).request_id, key); assert.deepEqual(f.errors, []);
});
test('busy slots suggest alternatives and date contradictions never become a booking', async t => {
  const f = consultationFixture('SECONDARY', { blocked: ['10:00'] }); t.after(() => f.close());
  const conflict = await f.send('survey sabtu besok jam 10'); assert.match(conflict, /hari dan tanggalnya belum cocok/); assert.equal(f.calls.length, 0);
  const busy = await f.send('besok jam 10'); assert.match(busy, /belum tersedia/); assert.match(busy, /11:00/);
  const proposal = await f.send('jam 11 aja'); assert.match(proposal, /pukul 11.00 WIB/); await f.send('ya'); assert.equal(f.bookings.size, 1); assert.deepEqual(f.errors, []);
});
test('a cancelled proposal and a viewing request without an asset do not create records', async t => {
  const f = consultationFixture(); t.after(() => f.close()); await f.send('survey besok jam 10');
  assert.match(await f.send('gak jadi survey'), /belum saya kirim/); assert.equal(f.bookings.size, 0);
  const empty = consultationFixture('SECONDARY', { selected: false }); t.after(() => empty.close());
  assert.match(await empty.send('mau viewing'), /pilih satu aset/); assert.equal(empty.bookings.size, 0);
});
test('cost percentages are rounded before summing, and missing prices never invent an estimate', () => {
  const e = saleCostEstimate({ transaction_type: 'SECONDARY', asking_price: 100000009.99 });
  assert.equal(e.additional_min, e.bphtb + e.ajb + e.notary_min); assert.equal(e.total_max, e.price + e.additional_max);
  assert.equal(saleCostEstimate({ transaction_type: 'SEWA', asking_price: 1000000000 }), null);
  assert.match(purchaseCostReply({ transaction_type: 'PRIMARY' }, 'rincian biaya'), /Harga jual yang valid belum/);
});
for (const [text, date, time, error] of [
  ['besok jam 10 pagi','2026-10-22','10:00',null], ['sesuk jam 1 siang','2026-10-22','13:00',null],
  ['Senin minggu depan jam 9','2026-10-26','09:00',null], ['24/10 jam sebelas','2026-10-24','11:00',null],
  ['hari ini jam 8','2026-10-21','08:00','outside_dates'], ['Sabtu besok jam 10','2026-10-22','10:00','conflicting_date'],
  ['besok jam setengah sebelas','2026-10-22','10:30','outside_slots'], ['2026-02-30 jam 10','2026-02-30','10:00','invalid_date'],
]) test(`time meaning: ${text}`, () => assert.deepEqual(parseSurveyTime(text, NOW), { date, time, error }));
