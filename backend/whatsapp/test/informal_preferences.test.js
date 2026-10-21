import test from 'node:test';
import assert from 'node:assert/strict';
import { informalPreferenceScenarios, runInformalPreferenceScenario } from '../scripts/lib/informal-preferences.js';

test('reported conversation and 150 everyday variants retain identity, budget, area and independent optional preferences', async () => {
  for (const scenario of informalPreferenceScenarios()) {
    const result = await runInformalPreferenceScenario(scenario);
    assert.equal(result.passed, true, `${result.name}: ${result.error}`);
  }
});
