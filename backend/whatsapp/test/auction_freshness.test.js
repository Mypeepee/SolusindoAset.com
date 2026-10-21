import test from 'node:test';
import assert from 'node:assert/strict';
import { auctionFreshnessCutoff, isFreshAuction } from '../services/auction_freshness.js';
import { getPropertyKnowledge } from '../../../src/lib/chatbot/property-knowledge.ts';

const NOW = Date.parse('2026-10-21T09:00:00+07:00');
const auction = date => ({ jenis_transaksi: 'LELANG', tanggal_lelang: date });
test('freshness includes the entire cutoff date in WIB and ignores import/update timestamps', () => {
  assert.equal(auctionFreshnessCutoff(NOW).toISOString(), '2026-09-20T17:00:00.000Z');
  for (const date of ['2026-09-21T00:00:00+07:00', '2026-10-20T10:00:00+07:00', '2026-11-01T10:00:00+07:00']) assert.equal(isFreshAuction(auction(date), NOW), true);
  for (const date of ['2026-09-20T23:59:59+07:00', '2026-04-21T10:00:00+07:00', null, 'invalid']) assert.equal(isFreshAuction({ ...auction(date), tanggal_dibuat: new Date(NOW), tanggal_diupdate: new Date(NOW) }, NOW), false);
  assert.equal(isFreshAuction({ transaction_type: 'LELANG', auction_at: '2026-10-01T10:00:00+07:00' }, NOW), true);
  assert.equal(isFreshAuction({ jenis_transaksi: 'SECONDARY', tanggal_dibuat: '2020-01-01' }, NOW), true);
});
test('one calendar month clamps month ends and follows WIB when the UTC date differs', () => {
  for (const [now, expected] of [
    ['2026-03-31T09:00:00+07:00', '2026-02-28T00:00:00+07:00'],
    ['2028-03-31T09:00:00+07:00', '2028-02-29T00:00:00+07:00'],
    ['2026-01-01T00:30:00+07:00', '2025-12-01T00:00:00+07:00'],
  ]) assert.equal(auctionFreshnessCutoff(Date.parse(now)).getTime(), Date.parse(expected));
});
test('chatbot discovery skips six-month-old auctions but accepts a recent past auction with confirmation required', async () => {
  const rows = [
    { id_property: 101n, judul: 'Rumah lama', ...auction(new Date('2026-04-21T03:00:00Z')), kota: 'Surabaya', kategori: 'RUMAH', harga: 200000000 },
    { id_property: 102n, judul: 'Rumah baru', ...auction(new Date('2026-10-15T03:00:00Z')), kota: 'Surabaya', kategori: 'RUMAH', harga: 250000000 },
  ];
  const calls = [];
  const db = { listing: { async findMany(q) { calls.push(q); return rows; } }, listingTempat: { async findMany() { return []; } }, listingSekitar: { async findUnique() { return null; } } };
  const result = await getPropertyKnowledge(db, { text: 'Cari rumah Surabaya', criteria: { location: 'Surabaya', city: 'Surabaya', category: 'RUMAH', transaction_type: 'LELANG', max_price: 300000000 } }, NOW);
  assert.deepEqual(result.candidates.map(a => a.id), ['102']);
  assert.match(JSON.stringify(calls[0].where), /2026-09-20T17:00:00/);
  const explicit = await getPropertyKnowledge({ ...db, listing: { async findMany() { return [rows[0]]; } } }, { text: 'Kode 101' }, NOW);
  assert.equal(explicit.asset.id, '101', 'a client may still ask about an old saved link without reintroducing it into discovery');
});
