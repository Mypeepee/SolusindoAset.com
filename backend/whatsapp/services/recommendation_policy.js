// Shared by the worker, Next API and dashboard. No server-only dependencies.
export const RECOMMENDATION_BATCH_SIZE = 4;
export const MAX_RECOMMENDATION_HISTORY = 64;
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
