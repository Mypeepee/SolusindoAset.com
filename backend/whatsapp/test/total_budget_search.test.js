import test from 'node:test';
import assert from 'node:assert/strict';
import { getPropertyKnowledge, isBuyerCriteria } from '../../../src/lib/chatbot/property-knowledge.ts';

const NOW = Date.parse('2026-11-04T12:00:00+07:00');
const criteria = { location:'Badung',city:'Kab. Badung',category:'APARTEMEN',transaction_type:'LELANG',max_price:500000000,min_total_budget:400000000,max_total_budget:500000000 };
const property = (id, price) => ({ id_property:BigInt(id),judul:'Apartemen pengujian',slug:`apartemen-${id}`,jenis_transaksi:'LELANG',kategori:'APARTEMEN',
  nilai_limit_lelang:price,harga:price,harga_efektif:price,uang_jaminan:10000000,kota:'Kab. Badung',provinsi:'Bali',
  alamat_lengkap:'Alamat sintetis untuk pengujian',tanggal_lelang:new Date('2026-11-10T03:00:00Z'),luas_tanah:42,luas_bangunan:null,ada_bangunan:true });
const database = rows => ({listing:{async findMany(query){ assert.equal(query.take,64); return rows; }},
  listingSekitar:{async findUnique(){return null;}},listingTempat:{async findMany(){return [];}}});

test('total-budget criteria are bounded and cannot accept invalid monetary caps', () => {
  assert.equal(isBuyerCriteria(criteria),true);
  for (const field of ['min_total_budget','max_total_budget']) {
    for (const amount of [-1,0,Infinity,NaN,'500000000',1e16]) assert.equal(isBuyerCriteria({...criteria,[field]:amount}),false);
  }
  assert.equal(isBuyerCriteria({...criteria,min_total_budget:600000000}),false);
});

test('a cheaper listing is recommended only when its total costs also fit the captured budget', async () => {
  const result = await getPropertyKnowledge(database([property(1001,401000000),property(1002,200000000)]),{text:'Cari alternatif apartemen',criteria},NOW);
  assert.equal(result.status,'recommendations');
  assert.deepEqual(result.candidates.map(asset=>asset.id),['1002']);
  assert.equal(result.asset,null);
});

test('an empty affordable set is not misreported as a missing auction schedule', async () => {
  const result = await getPropertyKnowledge(database([property(1001,401000000)]),{text:'Cari alternatif apartemen',criteria},NOW);
  assert.equal(result.status,'not_found'); assert.deepEqual(result.candidates,[]); assert.equal(result.diagnostics,undefined);
});
