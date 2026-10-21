import { validPhone } from '../lib/security.js';
import { SEARCH_CRITERIA_FIELDS as CLIENT_CRITERIA_FIELDS } from './recommendation_policy.js';

export const CHATBOT_AGENT_ID = 'AG108';
export { CLIENT_CRITERIA_FIELDS };

// The phone comes from authenticated transport metadata, never from chat text.
// Explicit "jenis bebas" / "luas bebas" remain null rather than invented facts.
export function clientCapture({ buyer, identity, phone, now = Date.now() }) {
  if (!validPhone(phone)) return null;
  const funnel = qualifiedClientFunnel({ buyer, identity, now });
  return funnel ? { phone, ...funnel } : null;
}

export function qualifiedClientFunnel({ buyer, identity, now = Date.now() }) {
  if (!buyer?.searching || buyer.stage !== 'recommendations' || buyer.missing?.length ||
    !buyer.profile?.city || !(buyer.profile.max_price > 0)) return null;
  const criteria = Object.fromEntries(CLIENT_CRITERIA_FIELDS.filter((key) => buyer.profile[key] !== undefined).map((key) => [key, buyer.profile[key]]));
  return { name: identity?.name || null, criteria, captured_at: now };
}

export function validClientCapture(input) {
  return !!input && typeof input === 'object' && !Array.isArray(input) &&
    Object.keys(input).every((key) => ['phone', 'name', 'criteria', 'captured_at'].includes(key)) &&
    validPhone(input.phone) && (input.name === null || typeof input.name === 'string' && !!input.name.trim() && input.name.length <= 100 && !/[\x00-\x1f]/.test(input.name)) &&
    Number.isSafeInteger(input.captured_at) && input.captured_at > 0 &&
    !!input.criteria && typeof input.criteria === 'object' && !Array.isArray(input.criteria) &&
    Object.keys(input.criteria).every((key) => CLIENT_CRITERIA_FIELDS.includes(key));
}
