import assert from 'node:assert/strict';
import { addressedIntroductionSamples } from './addressed-introduction-samples.js';
import { scopeFixture } from './property-scope-dialogues.js';

export async function simulateAddressedIntroductions() {
  const results = [];
  for (const sample of addressedIntroductionSamples()) {
    const f = scopeFixture({ classifyPropertyScope() { assert.fail('A greeting must not need AI classification'); },
      interpretBuyer() { assert.fail('Known search criteria must not need AI interpretation'); } });
    try {
      assert.deepEqual(await f.send(sample.text), [`Salam kenal, ${sample.label}. Ada yang bisa saya bantu?`]);
      assert.equal(f.session().client_identity.name, sample.name);
      assert.equal(f.session().client_identity.salutation, sample.salutation);
      assert.equal(f.reads.length, 0); assert.equal(f.calls.length, 0);
      assert.equal(f.session().buyer_state, null);
      assert.deepEqual(await f.send('Pak tolong kirim invoice pekerjaan kemarin'), []);
      assert.equal(f.reads.length, 0); assert.equal(f.calls.length, 0);
      assert.ok((await f.send('Tolong carikan rumah di Surabaya')).length);
      assert.ok(f.sent.at(-1).includes(sample.label));
      assert.equal(f.session().client_identity.name, sample.name);
      assert.equal(f.session().buyer_state.profile.city, 'Surabaya');
      assert.equal(f.session().is_bot_active, true);
      results.push({ text: sample.text, passed: true, transcript: f.transcripts });
    } catch (error) { results.push({ text: sample.text, passed: false, error: error.message, transcript: f.transcripts }); }
  }
  return results;
}
