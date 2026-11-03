// Shared by the worker, Next API and dashboard. No server-only dependencies.
export const RECOMMENDATION_BATCH_SIZE = 4;
export const MAX_RECOMMENDATION_HISTORY = 64;
export const RECOMMENDATION_ORDER_VERSION = '2026-10-22-newest-listings-v1';

export function listingCreatedAt(value) {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

// Import/update timestamps and hot-deal labels cannot make an older listing
// outrank a newly added match. BigInt preserves ordering for long listing IDs.
export function compareNewestListings(a, b) {
  const first = listingCreatedAt(a.tanggal_dibuat), second = listingCreatedAt(b.tanggal_dibuat);
  if (first !== second) return first == null ? 1 : second == null ? -1 : second - first;
  const id = value => /^[1-9]\d{0,17}$/.test(String(value)) ? BigInt(value) : 0n;
  const left = id(a.id_property), right = id(b.id_property);
  return left === right ? 0 : left > right ? -1 : 1;
}
export const SEARCH_CRITERIA_FIELDS = ['location', 'locations', 'cities', 'route_landmarks', 'certificate_types', 'legal_requirements', 'special_requirements', 'city', 'province', 'district', 'village', 'region_group', 'nearby',
  'category', 'categories', 'transaction_type', 'transaction_types', 'rental_period', 'min_price', 'max_price',
  'purpose', 'sort_by', 'min_land_area_m2', 'max_land_area_m2'];

export function offeredPropertyIds(...groups) {
  return [...new Set(groups.flat().filter(id => typeof id === 'string' && /^[1-9]\d{0,17}$/.test(id)))].slice(-MAX_RECOMMENDATION_HISTORY);
}

// This is an authenticated server snapshot, never extracted from a generated
// message. The property API independently validates every search before SQL.
export function validRecommendationSearch(profile) {
  return !!profile && typeof profile === 'object' && !Array.isArray(profile) &&
    Object.keys(profile).every(key => SEARCH_CRITERIA_FIELDS.includes(key)) &&
    typeof profile.location === 'string' && !!profile.location.trim() && profile.location.length <= 100 &&
    typeof profile.city === 'string' && !!profile.city.trim() && profile.city.length <= 100 &&
    Number.isSafeInteger(profile.max_price) && profile.max_price > 0 &&
    !!(profile.transaction_type || profile.transaction_types?.length) && JSON.stringify(profile).length <= 12000;
}

export function savedRecommendationSearch(profile, ids, lastSequence, agentId) {
  if (!validRecommendationSearch(profile)) return null;
  return { profile: structuredClone(profile), searchStarted: true, searchTurns: 1,
    backupAccepted: false, cityFromBuyer: true, villageAnswered: true, landAreaAnswered: true,
    categoryAnswered: true, excludedTransactions: [], regionClarification: null, cityScope: null,
    landClarification: null, requestedArea: null, nearbyError: false, landAreaError: null,
    notification_search: true, batch_size: RECOMMENDATION_BATCH_SIZE,
    ...(/^AG\d{1,18}$/.test(agentId || '') ? { sender_agent_id: agentId } : {}),
    offered_ids: offeredPropertyIds(ids), last_sequence: lastSequence };
}
