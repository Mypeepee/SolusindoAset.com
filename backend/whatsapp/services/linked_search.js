import { buyerContext, extractBudget, explicitAsset } from './buyer_profile.js';
import { categoryPreference } from './property_category.js';
import { PROPERTY_CATEGORY_LABELS } from './property_category.js';
import { extractLandArea } from './land_area.js';
import { resolveRegion } from './region_directory.js';
import { requestsAlternatives } from './conversation_references.js';
import { isRecommendationList } from './property_selection.js';
import { recommendationIds } from './recommendations.js';
import { applyDiscovery } from './smart_search_parser.js';
import { searchReply } from './search_reply.js';

const clean = value => typeof value === 'string' ? value.replace(/[\x00-\x1f*_~`]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const money = value => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const agrees = text => /^(?:(?:oh|iya|ya|yap|yup|yes|yeah|betul|benar|bener|oke|ok|okay|baik|boleh|silakan|silahkan|cocok|sesuai|pas|lanjut|gas|siap|sip|nggih|iyo|monggo|itu|sudah|begitu)(?:\s+(?:pak|bu|kak|mas|mbak|ko|koko|ya|dong|saja|aja))?[\s,.!👍✅]*)+$/iu.test(text.trim());
const declines = text => /^(?:(?:oh|iya|ya)\s+)?(?:bukan|tidak|nggak|enggak|gak|ga|belum|no|ora)(?:\s+(?:betul|benar|sesuai|cocok))?(?:\s+(?:pak|bu|kak|ya))*[.!\s]*$/i.test(text.trim());
const information = text => /[?？]|\b(?:mou|pdf|ktp|dokumen|berkas|dp|bayar|transfer|jaminan|survei|survey|viewing|kondisi|alamat lengkap|foto|gambar|jadwal|kapan)\b/i.test(text) ||
  /\b(?:serius|tertarik|ambil|beli)\b/i.test(text) && !/\b(?:cari|mencari|jenis|tipe)\b/i.test(text);

export const LINKED_SEARCH_CONFIRMATION = 'Apakah kriteria ini sudah betul? Jika iya, saya carikan aset yang cocok.';
export const LINKED_SEARCH_CORRECTION = 'Bagian mana yang ingin diubah: daerah, jenis properti, budget total, atau luas tanah?';

export function inferredSearch(asset, totalBudget, minBudget = null) {
  const rawCity = clean(asset.address?.city);
  const cityRegion = rawCity ? resolveRegion(rawCity, { expectedLevel: 'city' }) : null;
  const city = cityRegion && !cityRegion.clarification ? rawCity : null;
  const province = cityRegion?.province || clean(asset.address?.province) || null;
  const districtRegion = city && asset.address?.district ? resolveRegion(clean(asset.address.district), { city, expectedLevel: 'district' }) : null;
  const district = districtRegion && !districtRegion.clarification ? districtRegion.district : null;
  const villageRegion = city && asset.address?.village ? resolveRegion(clean(asset.address.village), { city, district, expectedLevel: 'village' }) : null;
  const village = villageRegion && !villageRegion.clarification ? villageRegion.village : null;
  const profile = { location: village || district || city, city, province, district, village,
    transaction_type: asset.transaction_type || 'LELANG', category: PROPERTY_CATEGORY_LABELS[asset.category] ? asset.category : null,
    min_price: null, max_price: totalBudget, min_total_budget: minBudget, max_total_budget: totalBudget,
    purpose: null, min_land_area_m2: null, max_land_area_m2: null };
  return { phase: 'confirming', source_asset_id: asset.id, profile, min_total_budget: minBudget,
    excluded_ids: [asset.id], prompt: LINKED_SEARCH_CONFIRMATION };
}

export function inferredSearchSummary(search) {
  const p = search.profile;
  const types = p.categories?.length ? p.categories.map(type => PROPERTY_CATEGORY_LABELS[type]).join(' atau ') : PROPERTY_CATEGORY_LABELS[p.category] || 'properti';
  const place = [p.village ? `Kelurahan ${clean(p.village)}` : null, p.district ? `Kecamatan ${clean(p.district)}` : null, clean(p.city)].filter(Boolean).join(', ');
  const budget = search.min_total_budget ? `${money(search.min_total_budget)}–${money(p.max_total_budget)}` : `maksimal ${money(p.max_total_budget)}`;
  const land = [p.min_land_area_m2 != null ? `luas tanah minimal ${p.min_land_area_m2.toLocaleString('id-ID')} m²` : '',
    p.max_land_area_m2 != null ? `luas tanah maksimal ${p.max_land_area_m2.toLocaleString('id-ID')} m²` : ''].filter(Boolean).join(' dan ');
  return `Dari properti yang Anda kirim, saya tangkap Anda mencari ${types}${place ? ` di ${place}` : ''}, dengan budget total ${budget}, termasuk biaya pembelian${land ? `, dan ${land}` : ''}.${!p.village ? ' Kelurahan belum tercantum pada listing; Anda bisa menyebutkannya jika ingin mempersempit daerah pencarian.' : ''}\n\n${LINKED_SEARCH_CONFIRMATION}`;
}

export function pendingLinkedSearch({ history = [], consultation } = {}) {
  const search = consultation?.linked_search;
  return search?.phase === 'confirming' && history.findLast(item => item.role === 'assistant')?.content.trim().endsWith(search.prompt);
}

export function isLinkedSearchTurn(text, input = {}) {
  const search = input.consultation?.linked_search;
  if (!search || !text?.trim() || explicitAsset(text) || information(text)) return false;
  return pendingLinkedSearch(input) || search.phase === 'active' &&
    (!!categoryPreference(text) || !!extractLandArea(text) || !!extractBudget(text) ||
      !!resolveRegion(text, { city: search.profile.city }) || requestsAlternatives(text));
}

function continuationFor(search, sequence) {
  const base = buyerContext([], '', null, { seed: search.profile });
  return { ...base.continuation, profile: structuredClone(search.profile), searchStarted: true,
    cityFromBuyer: !!search.profile.city, villageAnswered: true, categoryAnswered: !!(search.profile.category || search.profile.categories?.length),
    landAreaAnswered: true, last_sequence: sequence };
}

// Called only for criteria inferred from a chosen listing and a user budget.
// Listing area/price never become a buyer minimum or a bidding authorization.
export async function resolveLinkedSearch({ text, history = [], consultation, catalog, ai, now, signal }) {
  const source = consultation?.linked_search;
  if (!source || !isLinkedSearchTurn(text, { history, consultation })) return null;
  let search = structuredClone(source);
  const context = (buyer, reply, result = {}) => ({ asset: null, catalog: [], status: buyer.searching ? buyer.stage === 'recommendations' ? 'not_found' : 'qualifying' : 'search_confirmation',
    source: 'linked_property_criteria', ...result, buyer,
    linked_search: { reply, consultation: { ...consultation, total_budget: search.profile.max_total_budget,
      min_total_budget: search.min_total_budget, linked_search: search, last_offer: search.phase === 'confirming' ? 'search_confirmation' : null } } });
  const prior = continuationFor(search, history.at(-1)?.seq);
  const confirm = agrees(text);
  if (pendingLinkedSearch({ history, consultation }) && declines(text)) {
    search.prompt = LINKED_SEARCH_CORRECTION;
    const buyer = buyerContext([], '', null, { continuation: prior });
    buyer.searching = false; buyer.stage = 'consultation';
    return context(buyer, LINKED_SEARCH_CORRECTION);
  }
  let normalized = text.replace(/\bminim\b/gi, 'minimal').replace(/\bluasan(?:nya)?\b/gi, 'luas tanah')
    .replace(/\b(?:ganti|ubah)\s+(?:ke|jadi|menjadi)\s+(rumah|apartemen|ruko|gudang|tanah|kos|toko|pabrik|hotel|vila|villa)(?=\s*(?:saja\b|aja\b|di\b|,|$))/gi, 'ganti jenis properti ke $1');
  if (!confirm && !categoryPreference(text) && !extractLandArea(text) && !extractBudget(text) &&
      !/\b(?:di|daerah|kawasan|kelurahan|kecamatan|kota|kabupaten|cari|mencari)\b/i.test(text) &&
      resolveRegion(text, { city: search.profile.city })) normalized = `Cari alternatif properti di ${text}`;
  let buyer = buyerContext([], confirm || requestsAlternatives(text) ? 'Cari alternatif properti' : normalized,
    null, { continuation: prior, forceSearch: true });
  let corrected = !!buyer.progress?.length;
  if (!confirm && !corrected && !requestsAlternatives(text) && typeof ai?.parseSearch === 'function') {
    try {
      const parsed = await ai.parseSearch({ text, history: history.slice(-4), buyer, signal });
      if (signal?.aborted) throw signal.reason;
      if (parsed?.patch && Object.keys(parsed.patch).length) {
        applyDiscovery(buyer.profile, parsed.patch);
        if (buyer.profile.max_total_budget != null && parsed.patch.max_price != null) {
          buyer.profile.max_total_budget = parsed.patch.max_price;
          buyer.profile.min_total_budget = parsed.patch.min_price || null;
          buyer.profile.min_price = null;
        }
        const next = { ...buyer.continuation, profile: buyer.profile };
        if (parsed.patch.categories?.length) next.categoryAnswered = true;
        if (parsed.patch.min_land_area_m2 != null || parsed.patch.max_land_area_m2 != null) next.landAreaAnswered = true;
        buyer = buyerContext([], 'Cari alternatif properti', null, { continuation: next, forceSearch: true });
        corrected = true;
      }
    } catch (error) { if (signal?.aborted) throw error; }
  }
  if (!confirm && !corrected && !requestsAlternatives(text) && !buyer.land_area_error && !buyer.budget_error && !buyer.region_clarification) {
    search.prompt = LINKED_SEARCH_CORRECTION;
    buyer.searching = false; buyer.stage = 'consultation';
    return context(buyer, LINKED_SEARCH_CORRECTION);
  }
  search.phase = 'active'; search.profile = structuredClone(buyer.profile);
  const budget = extractBudget(text);
  if (budget?.max_price) search.min_total_budget = budget.min_price || null;
  if (requestsAlternatives(text)) {
    search.excluded_ids = [...new Set([...search.excluded_ids, ...history.filter(item => item.role === 'assistant' && isRecommendationList(item.content)).flatMap(item => recommendationIds(item.content))])].slice(-64);
  }
  if (buyer.stage === 'qualifying') return context(buyer, searchReply({ buyer, status: 'qualifying' }, now));
  const criteria = { ...buyer.profile, exclude_ids: search.excluded_ids };
  const result = catalog.resolve ? await catalog.resolve('Cari alternatif properti', null, criteria, signal ? { signal } : {})
    : { asset: null, catalog: [], status: 'not_found', source: 'operator_catalog' };
  if (result.status === 'clarify_location') {
    buyer.stage = 'qualifying'; buyer.missing = ['city'];
  }
  const searchResult = result.status === 'needs_property' ? { ...result, status: 'not_found' } : result;
  return context(buyer, searchReply({ ...searchResult, buyer }, now), searchResult);
}
