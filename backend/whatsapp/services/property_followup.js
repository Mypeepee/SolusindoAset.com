import { AUCTION_COST_QUESTION } from './auction_check.js';
import { AUCTION_BUDGET_QUESTION, AUCTION_BUDGET_RANGE_QUESTION, AUCTION_BUDGET_RANGE_CLARIFICATION, AUCTION_BUDGET_FIT_CLARIFICATION } from './budget_response.js';
import { LINKED_SEARCH_CONFIRMATION, LINKED_SEARCH_CORRECTION } from './linked_search.js';

// Persist a known server question, never the full WhatsApp transcript. A newer
// delivered answer clears it, so "Ya" cannot revive an older MOU/budget offer.
const questions = {
  costs: AUCTION_COST_QUESTION,
  budget: AUCTION_BUDGET_QUESTION,
  budget_clarification: AUCTION_BUDGET_FIT_CLARIFICATION,
  budget_range: AUCTION_BUDGET_RANGE_QUESTION,
  budget_range_clarification: AUCTION_BUDGET_RANGE_CLARIFICATION,
  search_confirmation: LINKED_SEARCH_CONFIRMATION,
  search_correction: LINKED_SEARCH_CORRECTION,
};

export function deliveredPropertyQuestion(text, assetId, at) {
  const kind = assetId && Object.keys(questions).find(key => text.trim().endsWith(questions[key]));
  return assetId ? { kind: kind || null, asset_id: assetId, at } : null;
}

export function restorePropertyQuestion(saved, assetId) {
  if (!saved || !assetId || saved.asset_id !== assetId) return null;
  if (saved.kind === null) return { role: 'assistant', content: '[Balasan terakhir tidak meminta konfirmasi.]' };
  return Object.hasOwn(questions, saved.kind)
    ? { role: 'assistant', content: questions[saved.kind] } : null;
}
