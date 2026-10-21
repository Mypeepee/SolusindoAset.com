import assert from 'node:assert/strict';
import { buyerContext } from '../../services/buyer_profile.js';
import { clientIdentity } from '../../services/client_identity.js';
import { generatePropertyReply } from '../../services/property_reply.js';

export const reportedOpening = 'selamat siang pak, saya tertarik aset lelang, rencana sih beli buat investasi tapi cari di daerah surabaya dulu pak, apakah ada?';
export const reportedMessages = [reportedOpening,
  'saya dengan pak budi, saya sih cari aset pokoknya yang murah pak, budget 500 juta mentok',
  'bebas sih pak', 'jenis property nya bebas, yang penting murah pak hahaha', 'luasnya bebas juga pak'];

export function informalPreferenceScenarios() {
  const intros = ['saya dengan Pak Budi', 'dengan Pak Budi', 'saya Pak Budi', 'nama saya Pak Budi', 'panggil saya Pak Budi'];
  const scopes = ['bebas sih pak', 'terserah aja pak', 'mana aja boleh', 'bebas deh', 'seluruh Surabaya aja pak'];
  const types = ['jenis property nya bebas, yang penting murah pak hahaha', 'jenis propertinya bebas pak',
    'tipe asetnya terserah deh', 'jenisnya bebas aja, asal murah', 'untuk jenis properti sih apa aja boleh', 'kategori nya bebas wkwk'];
  const cases = [{ name: 'percakapan-yang-dilaporkan', messages: reportedMessages }];
  for (const intro of intros) for (const scope of scopes) for (const type of types) {
    cases.push({ name: `${intro} / ${scope} / ${type}`, messages: [reportedOpening,
      `${intro}, cari yang murah pak, budget 500 juta mentok`, scope, type, 'luas tanah bebas pak'] });
  }
  return cases;
}

export async function runInformalPreferenceScenario(scenario) {
  const history = [], transcript = [], queries = [];
  let modelCalls = 0;
  const ai = { async generate() { modelCalls++; throw new Error('Unexpected model generation'); },
    async interpretBuyer() { modelCalls++; throw new Error('Known answer must not require model interpretation'); } };
  const catalog = { async resolve(_text, _id, criteria) {
    queries.push(criteria); return { status: 'not_found', asset: null, catalog: [], source: 'simulation' };
  } };
  try {
    for (const [index, text] of scenario.messages.entries()) {
      const buyer = buyerContext(history, text, null);
      const result = await generatePropertyReply({ text, history, catalog, ai });
      history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
      const identity = clientIdentity(history);
      transcript.push({ user: text, reply: result.reply, profile: buyer.profile, missing: buyer.missing, identity });
      assert.equal(result.suppressed, undefined);
      assert.equal(modelCalls, 0, 'Known answer must not reach the model');
      assert.equal(buyer.profile.city?.toLowerCase(), 'surabaya');
      assert.equal(buyer.profile.transaction_type, 'LELANG');
      assert.equal(buyer.profile.purpose, 'investment');
      if (index >= 1) {
        assert.equal(identity.name?.toLowerCase(), 'budi'); assert.equal(identity.salutation, 'Pak');
        assert.equal(buyer.profile.max_price, 500000000);
        assert.equal(buyer.profile.sort_by, 'price_asc');
      }
      if (index === 1) assert.match(result.reply, /Pak Budi/i);
      if (index >= 2) {
        assert.equal(buyer.profile.location?.toLowerCase(), 'surabaya');
        assert.equal(buyer.profile.district, null); assert.equal(buyer.profile.village, null);
        assert.doesNotMatch(result.reply, /Incar daerah mana|Di kelurahan mana|Apakah maksud/i);
      }
      if (index === 2) assert.deepEqual(buyer.missing, ['category', 'land_area']);
      if (index === 3) {
        assert.deepEqual(buyer.missing, ['land_area']);
        assert.doesNotMatch(result.reply, /Jenis properti apa|belum menangkap|Apakah maksud/i);
      }
      if (index < 4) assert.equal(queries.length, 0, 'Do not invent an unrestricted land preference');
    }
    assert.equal(queries.length, 1);
    const criteria = queries[0];
    assert.equal(criteria.category, null); assert.equal(criteria.categories, undefined);
    assert.equal(criteria.min_land_area_m2, null); assert.equal(criteria.max_land_area_m2, null);
    assert.equal(criteria.sort_by, 'price_asc');
    assert.doesNotMatch(JSON.stringify(criteria), /budi|hahaha|wkwk/i);
    return { name: scenario.name, passed: true, transcript };
  } catch (error) { return { name: scenario.name, passed: false, error: error.message, transcript }; }
}
