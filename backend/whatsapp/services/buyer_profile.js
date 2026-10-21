// Preferences are derived only from the client's messages, never AI guesses or
// listing prices. They are search filters, not proof of funds / hot-lead evidence.
import { extractLandArea, isLandAreaQuestion } from './land_area.js';
import { resolveRegion, resolveCityChoice, resolvePendingRegionChoice, requestedAreaMention, isKnownRegionPhrase, knownCityNames as cityNames } from './region_directory.js';
import { categoryPreference, anyPropertyCategory, isCategoryQuestion } from './property_category.js';
import { normalizeBuyerLanguage, normalizeBuyerQuantities, correctedQuantityText, assistantQuestions, isBudgetQuestion, acceptsAnyLocation, positiveGeographyText, geographicScopeText, maskLandPreferences, unrestrictedPreferenceAnswer, priceOrderPreference } from './buyer_language.js';
import { buyerTurn } from './buyer_turn.js';
import { hasLocationReference, isLocationReferenceAnswer, requestsAlternatives, geographyWithoutReferences } from './conversation_references.js';
import { transactionPreference, transactionValues, transactionGeographyText, isTransactionQuestion, isRentalPeriodQuestion, rentalPeriod, rentalPeriodAnswer } from './property_transaction.js';
import { propertyOnlyConversation } from './client_identity.js';
import { searchScopeTurn, regionGroupLabel } from './search_scope.js';
import { searchRecovery, uncertainLocation } from './search_recovery.js';
import { parseBudgetAmounts, budgetUnitAnswer } from './budget_amounts.js';
import { localDiscovery, discoveryOnlyText, applyDiscovery } from './smart_search_parser.js';

// Local national directory; no network dependency during a conversation.
const cityPrefix = /^(?:kota(?:\s+(?:administrasi|adm\.?))?|kabupaten(?:\s+administrasi)?|kab\.?(?:\s+adm\.?)?)\s+/i;
const cityKey = (value) => value?.replace(cityPrefix, '').trim().toLowerCase();
const cityFamily = (value) => /^(?:kota|kab(?:upaten)?\.?)\b/i.exec(value || '')?.[0].toLowerCase().replace(/^kab\.?$/, 'kabupaten');
const changedCity = (before, after) => before && (cityKey(before) !== cityKey(after) || cityFamily(before) && cityFamily(after) && cityFamily(before) !== cityFamily(after));
const cities = new Set(cityNames.map(cityKey));
const areaPrefix = /^(?:(?:di|daerah|kawasan|wilayah|area|sekitar|lokasi(?:nya)?|kecamatan|kec\.?|kelurahan|kel\.?)\s+)+/i;
const resetsLocation = (text) => /\b(?:mulai|ulang(?:i)?|reset)\s+(?:lagi\s+)?pencarian\b|\bpencarian\s+baru\b|\b(?:ganti|pindah|ubah)\s+(?:ke\s+)?(?:kota|kabupaten)\b/i.test(text);
const NUMBER = '(\\d+(?:[.,]\\d+)*)';
const UNIT = '(miliar|milyar|juta|jt|ribu|rb|m)';
const budgetIntent = /\b(budget|bujet|anggaran|plafon|dana|harga|minimal|minimum|maksimal|maksimum|max|mentok|batas harga|di bawah|dibawah|rentang harga|kisaran harga)\b/i;
export const hasLocationInterest = (text) => /\b(?:tertarik|berminat|minat|mau|ingin)\s+(?:(?:mencari|cari|aset|properti|rumah|ruko|gudang|tanah|apartemen|toko|pabrik|kos|kost|hotel|vila|villa)\s+)*(?:di|daerah|kawasan|area|kota|kabupaten|kecamatan)\s+[\p{L}]/iu.test(text);
export const hasSearchIntent = (text) => /\b(cari(?:kan)?|mencari|butuh|alternatif|pilihan lain|ada(?:kah)?\s+(?:aset|properti|rumah|tanah|ruko|kos|kost|gudang|apartemen|toko|pabrik|hotel|vila|villa))\b/i.test(text) || hasLocationInterest(text) || requestsAlternatives(text);
export function explicitAsset(text, preceding) {
  const plain = normalizeBuyerLanguage(text).replace(/\*/g, '');
  return /(?:\b(?:kode|id|aset|properti)\s*[:#-]?\s*|#)(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b/i.test(plain) ||
    (/^\s*[1-9]\d{0,17}\s*$/.test(plain) && !isLandAreaQuestion(preceding?.content) && !isBudgetQuestion(preceding?.content)) ||
    /\/(?:Lelang|Jual|Sewa|Secondary|Primary|properti)\//i.test(plain);
}
export const BACKUP_AREA_QUESTION = 'Sembari menunggu konfirmasi status aset ini, di daerah mana Bapak/Ibu ingin mencari properti agar saya bisa menyiapkan opsi cadangan yang sesuai?';
export const declinesBackupSearch = (text) => /\b(?:tidak|nggak|enggak|gak|ga|belum)\s+(?:perlu|mau|usah)|\b(?:fokus|tunggu|hanya|cuma)\b.{0,35}\b(?:aset|properti|rumah|yang ini|kabar)|\b(?:aset|properti|rumah) ini saja\b/i.test(text);

function backupAreaAnswer(text, preceding) {
  if (preceding?.role !== 'assistant' || !preceding.content.includes(BACKUP_AREA_QUESTION) || declinesBackupSearch(text) || /[?？]/.test(text)) return null;
  const location = locationIn(text);
  if (location) return location;
  if (hasSearchIntent(text)) return null;
  const plain = text.trim().split(/\b(?:budget|bujet|anggaran|maksimal|mentok|untuk)\b/i)[0]
    .replace(/[.,\s]+$/, '').replace(/\s+(?:saja|aja|ya|dong)[.!]?$/i, '').replace(/[.!]+$/, '');
  return /^[\p{L}\s.-]{2,80}$/u.test(plain) && !/\b(?:harga|berapa|luas|alamat|status|jadwal|kapan|cek|aset|ini|itu|budget|anggaran|investasi|hunian|dihuni|tinggal|tidak|belum|terima|kasih|halo|oke|siap|terserah|bebas)\b/i.test(plain) ? cleanLocation(plain) : null;
}

// Indonesian courtesy particles are conversational context, not address terms.
// Strip only trailing whole words so names such as Pakuwon remain intact.
function cleanLocation(value) {
  return value.split(/[,;]\s*(?:apa(?:kah)?|ada(?:kah)?|bisa(?:kah)?|boleh(?:kah)?)\b|\s+\b(?:apa(?:kah)?\s+(?:ada(?:kah)?|tersedia)|ada(?:kah)?\s+(?:pak|bu|bapak|ibu)|apa adakah)\b/i)[0]
    .replace(/^(?:\s*(?:bukan|ralat|koreksi)\s*[,;:]\s*)+/i, '').replace(/^[,;:\s]+/, '')
    .replace(/^(?:(?:pokoknya|intinya|yang penting|yang saya maksud|maksud saya|maksudnya|lebih tepatnya|ralat|koreksi|asal(?:kan)?|tetap|masih|cukup|cuma|hanya|tapi|tetapi|melainkan)\s+)+/i, '')
    .replace(/[?!.,\s-]+$/, '').replace(/(?:^|\s)(?:(?:kah|ya|yah|dong|deh|lah|sih|saja|aja|dulu|pak|bapak|bu|ibu|kak|mas|mbak)\s*)+$/i, '')
    .replace(/[?!.,\s-]+$/, '').replace(/\s+/g, ' ').trim();
}
const cleanArea = (value) => cleanLocation(value).replace(areaPrefix, '').trim();

export function extractBudget(text, { allowImplicit = false, implicitUnit = null, defaultUnit = null } = {}) {
  if (/\b(?:per|tiap|setiap)\s*(?:m\s*[²2]|meter|hektar|ha)(?![\p{L}\p{N}])/iu.test(text)) return null;
  let clean = correctedQuantityText(maskLandPreferences(normalizeBuyerQuantities(text))).replace(/\*/g, '')
    .replace(/\d[\d.,]*\s*m\s*[²2]/gi, ' ');
  const financialLabel = /\b(?:budget|bujet|anggaran|harga|dana|plafon)\b/i.exec(clean);
  if (financialLabel) clean = clean.slice(financialLabel.index);
  if (!financialLabel && !/\b(?:juta|jt|miliar|milyar|ribu|rb|rp)\b/i.test(clean) && /\b(?:kamar|lantai|jarak|meter|hektar|ha)\b/i.test(clean)) return null;
  const implicit = allowImplicit && !/[?？]|\b(?:luas|lt|lb|meter|jarak|kamar|lantai)\b|m[²2]/i.test(clean);
  if (!implicit && !budgetIntent.test(clean) && !(hasSearchIntent(clean) && /\b(?:rp|juta|jt|miliar|milyar)\b/i.test(clean)) &&
      !(/^\s*(?:rp\.?\s*)?\d/.test(clean) && new RegExp(`${NUMBER}\\s*${UNIT}\\b`, 'i').test(clean))) return null;
  return parseBudgetAmounts(clean, { implicitUnit, defaultUnit });
}

function locationIn(text) {
  const normalized = geographyWithoutReferences(text).replace(/\*/g, '').replace(/[\n\r]+/g, ' ');
  const monetaryAmount = new RegExp(`(?:\\b${NUMBER}\\s*${UNIT}\\b|\\brp\\.?\\s*${NUMBER})`, 'i');
  const locationPart = (value) => {
    const candidate = cleanLocation(value);
    if (/^(?:angka|nominal|kisaran|rentang)\b/i.test(candidate) ||
        /^(?:mana|situ|sana|sini|tersebut|itu|ini|tadi|sebelumnya|sama|atas|bawah|database|website|rekening|perusahaan)\b/i.test(candidate)) return null;
    const money = monetaryAmount.exec(candidate);
    // Keep a real place before an unlabelled amount ("Manukan Kulon 350 juta").
    // The amount and its modifiers are not part of a neighborhood's name.
    const place = cleanLocation(money ? candidate.slice(0, money.index)
      .replace(/(?:^|\s)(?:(?:di\s+)?(?:angka|kisaran|rentang|nominal)|sekitar|senilai|sebesar)\s*$/i, '') : candidate);
    return /\p{L}/u.test(place) && !/^(?:luas(?:nya)?|lt|lb|tanahnya|lahannya)\b/i.test(place) ? place : null;
  };
  // Keep the child before its parent in "Banyu Urip di Surabaya". Starting
  // at the last "di" would discard the village during a location correction.
  const complete = locationPart(normalized.split(/\b(?:dengan|budget|bujet|anggaran|harga|dana|plafon|mentok|minimal|minimum|maksimal|maksimum|untuk|tujuan|luas|lt|lb)\b/i)[0]);
  if (complete && /\bdi\b/i.test(complete) && isKnownRegionPhrase(complete)) return complete;
  // "Di" also introduces amounts ("di angka 350 juta"). Inspect each cue
  // without consuming its tail so a real location later in the same message
  // can still be found after a financial phrase is rejected.
  const cues = /\b(?:di|daerah|kawasan|wilayah|area|sekitar|lokasi(?:nya)?|pindah ke|ganti ke)\s+(?=([\p{L}\p{N} ,.-]{2,100}))/giu;
  for (const match of normalized.matchAll(cues)) {
    const location = locationPart(match[1].split(/\b(?:dengan|budget|bujet|anggaran|harga|dana|plafon|mentok|minimal|minimum|maksimal|maksimum|untuk|tujuan|senilai|di bawah|dibawah|luas|lt|lb)\b/i)[0]);
    if (location) return location.slice(0, 100);
  }
  if (!hasSearchIntent(text)) return null;
  const location = locationPart(normalized.split(/\b(?:dengan|budget|bujet|anggaran|harga|untuk|minimal|maksimal|luas|lt|lb)\b/i)[0]
    .replace(/\b(?:bisa|boleh|bantu|tolong|mohon|saya|mau|ingin|pengen|pingin|tertarik|berminat|minat|cari(?:kan)?|mencari|butuh|ada(?:kah)?|apa(?:kah)?|punya|sedang|masih|tetap|yang|selain|dengan|dan|atau|sama|maupun|juga|pilih|alternatif|pilihan|lain(?:nya)?|cadangan|opsi|aset|properti|property|rumah|tanah|ruko|kos|kost|gudang|apartemen|toko|pabrik|hotel|vila|villa|lelang|sewa|jual|dijual|di|daerah|kawasan|wilayah|area|sih|dong|nih|ya|saja|aja|pak|bapak|bu|ibu|kak|mas|mbak)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim());
  // Search verbs also occur in type answers ("rumah kalau ada tanah gapapa").
  // Leftover prose is not evidence of a move. Implicit administrative names
  // must be verified. Keep the shorthand "cari rumah Citraland" only when
  // its unmodified trailing phrase follows a direct search command; deleting
  // words from a conditional type answer cannot manufacture that evidence.
  if (!location || location.length > 100) return null;
  // Some ordinary adjectives/particles are also village names. A search for
  // a "rumah bagus" needs an actual location cue before it can mean Desa Bagus.
  if (/^(?:bagus|baru|kalo|kalau|murah|nyaman|cocok|strategis|terjangkau|bekas)$/i.test(location)) return null;
  if (isKnownRegionPhrase(location)) return location;
  const direct = /^(?:(?:saya|tolong|bantu|mohon|pak|bu)\s+)*(?:cari(?:kan)?|mencari|butuh)\s+(?:(?:aset|properti|property|rumah|tanah|ruko|kos|kost|gudang|apartemen|toko|pabrik|hotel|vila|villa|lelang|sewa|primary|secondary)\s+)+(.+)$/i.exec(
    normalized.split(/\b(?:dengan|budget|bujet|anggaran|harga|untuk|minimal|maksimal|luas|lt|lb)\b/i)[0].trim());
  return direct && cleanLocation(direct[1]).toLowerCase() === location.toLowerCase() &&
    !/\b(?:kalau|kalo|jika|bila|yang|ada|boleh|gapapa|masalah|murah|bagus|nyaman|cocok|strategis|terjangkau|baru|bekas|renovasi|huni)\b/i.test(location) ? location : null;
}

function geographicPreference(text, { expectCity, expectArea, backup } = {}) {
  const clean = geographyWithoutReferences(text).replace(/\*/g, '').trim();
  if (uncertainLocation(clean) && !locationIn(clean)) return { area: null, city: null, broad: false };
  if (/^(?:(?:tetap|masih|iya|ya|ok|oke|okay|sip|siap|baik|lanjut|betul|benar|saja|aja|pak|bapak|bu|ibu|kak|koko|ko)|[\s,.!?])*$/i.test(clean)) return { area: null, city: null, broad: false };
  const answer = cleanLocation(clean.split(/\b(?:budget|bujet|anggaran|harga|dana|plafon|minimal|minimum|maksimal|maksimum|mentok|untuk|tujuan|luas|lt|lb)\b/i)[0]
    .replace(new RegExp(`\\b${NUMBER}\\s*${UNIT}\\b`, 'gi'), ''));
  const plainAnswer = !/[?？]/.test(clean) && /^[\p{L}\s.,-]{2,100}$/u.test(answer) &&
    !/\b(?:belum|tidak|nggak|ngga|enggak|gak|ga|tahu|investasi|hunian|juta|miliar|berapa|keduanya|terima|kasih|maksudnya|gimana|oke|siap|budget(?:nya)?|bujet(?:nya)?|anggaran(?:nya)?|dana(?:nya)?|luas(?:nya)?|jenis(?:nya)?|tipe(?:nya)?)\b/i.test(answer) ? answer : null;
  const broad = acceptsAnyLocation(clean);
  let candidate = locationIn(clean) || (backup ? backupAreaAnswer(clean, backup) : null) || ((expectCity || expectArea) && !hasSearchIntent(clean) ? plainAnswer : null);
  if (!candidate) return { area: null, city: null, broad: !!expectArea && broad };
  candidate = cleanLocation(candidate.replace(/^(?:di\s+)+/i, '').replace(/\b(?:mana\s*(?:saja|aja|pun)|dimana\s*(?:saja|aja|pun)|seluruh|semua|terserah|bebas|fleksibel)\b/gi, '').trim());
  // "Di daerah Kecamatan Tandes" is an area answer, not a name containing
  // conversational labels. Preserve administrative labels until classification
  // so Kecamatan Batu is not misread as Kota Batu from the city directory.
  candidate = candidate.replace(/^(?:(?:daerah|kawasan|wilayah|area|sekitar|lokasi(?:nya)?)\s+)+/i, '').trim();
  if (broad) candidate = candidate.replace(/\b(?:di mana|dimana|mana)\s*$/i, '').trim();
  if (broad && /^(?:(?:di|mana|dimana|se-?kota|se-?kabupaten|kota|kabupaten|kecamatan(?:nya)?|kelurahan(?:nya)?|desa(?:nya)?|lokasi(?:nya)?|area|wilayah|pak|bu|boleh|aja|saja)\s*)*$/i.test(candidate)) return { area: null, city: null, broad: true };
  if (!candidate) return { area: null, city: null, broad: !!expectArea && broad };
  // Explicit administrative labels and exact names from the city directory
  // identify a city. An unlabelled neighborhood never supplies its own city.
  const labelled = /\b(?:kota(?:\s+administrasi)?|kabupaten|kab\.?)\s+([\p{L}\s.-]+)/iu.exec(candidate);
  if (labelled) {
    const city = cleanLocation(labelled[1].split(/\b(?:di|daerah|kawasan|area|kecamatan|kelurahan)\b/i)[0]);
    const before = cleanArea(candidate.slice(0, labelled.index).replace(/(?:,|\bdi)\s*$/i, ''));
    const tailArea = /\b(?:daerah|kawasan|area|kecamatan|kelurahan)\s+(.+)/iu.exec(labelled[1]);
    const prefix = labelled[0].slice(0, -labelled[1].length);
    return { city: prefix + city, area: before || cleanArea(tailArea?.[1] || '') || null, broad };
  }
  if (!/^(?:kecamatan|kec\.?|kelurahan|kel\.?)\s+/i.test(candidate)) {
    if (cities.has(cityKey(candidate))) return { area: null, city: candidate, broad };
  }
  const parts = candidate.split(/\s*,\s*|\s+di\s+/i);
  if (parts.length === 2 && cities.has(cityKey(parts[1]))) return { area: cleanArea(parts[0]), city: cleanLocation(parts[1]), broad };
  const suffix = cityNames.find((name) => candidate.toLowerCase().endsWith(' ' + name.toLowerCase()) && cleanArea(candidate.slice(0, -name.length)));
  if (suffix) return { area: cleanArea(candidate.slice(0, -suffix.length)), city: candidate.slice(-suffix.length), broad };
  // An answer to a city question still needs a known name; free prose cannot
  // establish an administrative city merely because a question was asked.
  return { area: cleanArea(candidate) || null, city: null, broad };
}

function purposeIn(text, preceding) {
  const investment = /\b((?:di)?investasi(?:kan)?|flipping|disewakan)\b/i.test(text);
  const live = /\b(dihuni|hunian|huni sendiri|tinggal sendiri|tempat tinggal|ditinggali|ditempati|tempati sendiri)\b|^\s*(?:untuk\s+)?tinggal(?:\s+sendiri)?[.!]?\s*$/i.test(text);
  if (investment && live) return 'both';
  if (investment || live) return investment ? 'investment' : 'live';
  // "Keduanya" is meaningful only in reply to the purpose question. Never
  // turn an answer about two cities/assets into a purchase preference.
  const purposeQuestion = preceding?.role === 'assistant' && /\?/.test(preceding.content) &&
    /\b(hunian|dihuni|tinggal|tempat tinggal)\b/i.test(preceding.content) && /\b(investasi|flipping|disewakan)\b/i.test(preceding.content);
  return purposeQuestion && /\b(keduanya|dua[\s-]*duanya|dua[\s-]*dua(?:nya)?|dua2(?:nya)?|dua tujuan|keduaduanya)\b/i.test(text) ? 'both' : null;
}

export function buyerContext(history, text, previousId, { seed = {}, forceSearch = false, allowBackupPrompt = false, continuation = null } = {}) {
  ({ history, text } = propertyOnlyConversation(history, text));
  const rememberedProfile = continuation?.searchStarted ? continuation.profile : Object.fromEntries(Object.entries(continuation?.profile || {}).filter(([, value]) => value != null));
  const profile = { location: null, city: null, province: null, district: null, village: null, category: null, transaction_type: null, min_price: null, max_price: null, purpose: null, min_land_area_m2: null, max_land_area_m2: null, ...seed, ...rememberedProfile };
  let searchStarted = forceSearch, currentUpdate = false, backupAccepted = false, cityFromBuyer = false;
  let searchTurns = 0;
  let villageAnswered = !!seed.village, landAreaAnswered = false, landAreaError = null, budgetError = null, budgetClarification = null;
  let categoryAnswered = !!seed.category || !!seed.categories?.length;
  let excludedTransactions = [];
  let regionClarification = null;
  let cityScope = null;
  let requestedArea = continuation?.requestedArea || null;
  let landClarification = null, dialogue = null, progress = [], expectedFields = [], resolvedShortAnswer = false, nearbyError = false, removedTransactions = [];
  if (continuation) {
    searchStarted ||= continuation.searchStarted; searchTurns = continuation.searchTurns;
    backupAccepted = continuation.backupAccepted; cityFromBuyer = continuation.cityFromBuyer;
    villageAnswered = continuation.villageAnswered; landAreaAnswered = continuation.landAreaAnswered; landAreaError = continuation.landAreaError;
    categoryAnswered = continuation.categoryAnswered || !continuation.searchStarted && !!(seed.category || seed.categories?.length); excludedTransactions = continuation.excludedTransactions;
    regionClarification = continuation.regionClarification; cityScope = continuation.cityScope;
    landClarification = continuation.landClarification; nearbyError = continuation.nearbyError;
    budgetError = continuation.budgetError || null;
    budgetClarification = continuation.budgetClarification || null;
  }
  const conversation = history.at(-1)?.role === 'user' && history.at(-1).content === text ? history : [...history, { role: 'user', content: text }];
  const userTurns = conversation.map((item, index) => ({ ...item, index })).filter((item) => item.role === 'user');
  const messages = continuation?.last_sequence != null
    ? userTurns.filter((item) => item.seq > continuation.last_sequence || item.seq == null && item.index === conversation.length - 1)
    : userTurns.slice(continuation ? -1 : -12);
  for (const { content: rawContent, index } of messages) {
    const preceding = conversation[index - 1];
    const discovery = localDiscovery(rawContent, { city: profile.city });
    const discoveryGeography = !!(discovery.locations?.length || discovery.cities?.length || discovery.route_landmarks?.length);
    const recovery = searchStarted ? searchRecovery(rawContent, preceding?.content, profile) : null;
    if (recovery) {
      searchTurns += 1;
      if (recovery.changed) { villageAnswered = true; regionClarification = null; requestedArea = null; }
      if (index === conversation.length - 1) {
        dialogue = { kind: 'recovery', ...recovery }; currentUpdate = !!recovery.changed;
        if (recovery.changed) progress.push('location');
      }
      continue;
    }
    const questions = preceding?.role === 'assistant' ? assistantQuestions(preceding.content) : [];
    const periodExpected = isRentalPeriodQuestion(preceding?.content);
    const categoryQuestion = preceding?.role === 'assistant' && isCategoryQuestion(preceding.content);
    const landQuestionIndex = questions.findIndex((part) => isLandAreaQuestion(part));
    const turn = buyerTurn(rawContent, { preceding: preceding?.role === 'assistant' ? preceding.content : '', landClarification,
      categoryExpected: categoryQuestion, landExpected: landQuestionIndex >= 0 });
    if (index === conversation.length - 1) {
      dialogue = turn.kind ? turn : null;
      expectedFields = [...(categoryQuestion ? ['category'] : []), ...(landQuestionIndex >= 0 ? ['land_area'] : [])];
    }
    if (turn.kind === 'explain' && !turn.content) continue;
    const scopeTurn = searchScopeTurn(turn.content, { city: profile.city, nearby: profile.nearby, landExpected: landQuestionIndex >= 0 });
    const content = discoveryOnlyText(scopeTurn.text);
    const confirmsArea = !!profile.location && /\b(?:intinya|pokoknya|tetap|fokus)\b/i.test(content) &&
      content.toLowerCase().includes(profile.location.toLowerCase()) && !uncertainLocation(content);
    const before = { ...profile };
    const transaction = transactionPreference(content, { previous: transactionValues(profile), excluded: excludedTransactions,
      expected: isTransactionQuestion(questions[0]) });
    const geographicContent = transaction ? transactionGeographyText(content) : content;
    const locationReference = hasLocationReference(content);
    const placeContent = discoveryGeography ? '' : geographyWithoutReferences(geographicContent);
    // A template's price/location do not establish the buyer's search budget.
    if (explicitAsset(content, preceding)) continue;
    const search = hasSearchIntent(content) || !!transaction || !!scopeTurn.region || scopeTurn.nearbyChanged || discoveryGeography; searchStarted ||= search;
    if (searchStarted) searchTurns += 1;
    const anyCategory = anyPropertyCategory(content, categoryQuestion && isCategoryQuestion(questions[0]));
    const preference = anyCategory ? null : categoryPreference(content, { expected: categoryQuestion, previous: profile.categories || (profile.category ? [profile.category] : []) });
    const categories = preference?.values || [];
    const category = categories.length === 1 ? categories[0] : null;
    const hasCategory = categories.length > 0;
    const knownAreaAnswer = !hasCategory && !anyCategory && !(transactionValues(profile).includes('SEWA') && rentalPeriod(content, { expected: periodExpected })) && !uncertainLocation(content) &&
      isKnownRegionPhrase(cleanArea(content)) ? cleanArea(content) : null;
    // A bare "bebas" answers the first outstanding question. When category
    // and land size are both asked, it must not silently clear both filters.
    const landArea = extractLandArea(content, { allowImplicit: landQuestionIndex === 0 || hasCategory && landQuestionIndex >= 0,
      expected: landQuestionIndex >= 0 && (!isBudgetQuestion(questions[0]) || hasCategory) });
    const selectedTransactions = transaction?.values || transactionValues(profile);
    const purchaseBudget = selectedTransactions.length > 0 && selectedTransactions.every((type) => type !== 'SEWA');
    let budget = landArea && !/\b(?:budget|bujet|anggaran|harga|rp|juta|jt|miliar|milyar)\b|\bdi\s*bawah\s*\d/i.test(content) ? null : extractBudget(content, {
      allowImplicit: searchStarted && (profile.max_price == null || isBudgetQuestion(preceding?.content)),
      implicitUnit: purchaseBudget ? 'juta' : null,
    });
    const confirmedUnit = budgetError === 'ambiguous' && budgetClarification && isBudgetQuestion(preceding?.content) ? budgetUnitAnswer(content) : null;
    if (!budget && confirmedUnit) budget = extractBudget(budgetClarification, { allowImplicit: true, defaultUnit: confirmedUnit });
    let validBudget = budget && !budget.error ? { ...budget } : null;
    if (validBudget && profile.min_price > 0 && (profile.max_price == null || /\b(?:maksimal|maksimum|maks|max|mentok|di\s*bawah)\b/i.test(content)) && validBudget.min_price == null) validBudget.min_price = profile.min_price;
    if (validBudget && validBudget.min_price > 0 && validBudget.max_price == null && profile.max_price > 0) validBudget.max_price = profile.max_price;
    if (budget) {
      budgetError = budget.error || (validBudget.min_price != null && validBudget.max_price != null && validBudget.min_price > validBudget.max_price ? 'invalid' : null);
      budgetClarification = budgetError === 'ambiguous' ? confirmedUnit ? budgetClarification : content : null;
    }
    if (budgetError) validBudget = null;
    const villageQuestion = questions.some((part) => /\bkelurahan\b(?:(?!\b(?:kecamatan|kota|kabupaten)\b)[^?]){0,80}\b(?:mana|apa|tertentu|pilihan)\b/i.test(part));
    const villageMatch = /\b(?:kelurahan|kel\.?|desa)\s+([\p{L}\p{N} .-]+?)(?=\s+\b(?:di|kecamatan|kec\.?|kota|kabupaten|budget|bujet|anggaran|harga|luas|lt|lb|minimal|maksimal|untuk)\b|[,;\n]|$)/iu.exec(placeContent);
    const villageName = villageMatch && !uncertainLocation(villageMatch[1]) ? cleanArea(villageMatch[1].split(/\b(?:di|kecamatan|kec|kota|kabupaten|budget|bujet|anggaran|harga|luas|lt|lb|minimal|maksimal|untuk)\b/i)[0]) : null;
    const mentionedArea = locationIn(geographicContent) || (villageQuestion ? cleanArea(geographicContent.split(/\b(?:dengan|budget|bujet|anggaran|harga|luas|lt|lb)\b/i)[0]) : '');
    const regionKey = (v) => cleanArea(v || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const repeatsDistrict = villageQuestion && !villageName && !!profile.district && regionKey(mentionedArea) === regionKey(profile.district);
    const anyVillage = repeatsDistrict || /\b(?:kelurahan|desa)(?:nya)?\s+(?:bebas|terserah|mana\s*(?:saja|aja|pun)|fleksibel)\b/i.test(content) || villageQuestion && !anyCategory && acceptsAnyLocation(content);
    const villageAnswer = !scopeTurn.nearbyChanged && !uncertainLocation(content) && !transaction && !locationReference && !anyVillage && !hasCategory && !anyCategory && villageQuestion && !villageName && !landArea && !budget && !hasSearchIntent(content) && /^[\p{L}\s.-]+[.!]?$/u.test(content.trim()) &&
      !/\b(?:investasi|hunian|dihuni|tidak|belum|terima|kasih|keduanya|maksudnya|kecamatan|kec|kota|kabupaten|kab|provinsi)\b/i.test(content) ? cleanArea(content) : null;
    const areaQuestion = questions.some((part) => /\b(?:daerah|area|kawasan|kecamatan)\b[^?]{0,100}\b(?:mana|apa)\b/i.test(part));
    const cityQuestion = questions.some((part) => /\b(?:kota|kabupaten)\b[^?]{0,100}\b(?:apa|mana)\b/i.test(part));
    const backupQuestion = allowBackupPrompt && preceding?.role === 'assistant' && preceding.content.includes(BACKUP_AREA_QUESTION);
    // Location extraction only sees the residual geographic text. A search
    // verb in a type/size answer cannot turn "luasnya 100" into a new area.
    const geographyText = positiveGeographyText(geographicScopeText(villageMatch ? placeContent.slice(0, villageMatch.index) + placeContent.slice(villageMatch.index + villageMatch[0].length) : placeContent,
      { landExpected: landQuestionIndex >= 0 }));
    const geographyWords = ` ${geographyText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
    const cityWords = cityKey(profile.city)?.replace(/[^\p{L}\p{N}]+/gu, ' ');
    const geographicCue = /\b(?:di|daerah|kota|kabupaten|kecamatan|kelurahan|desa|ganti ke|pindah ke)\b/i.test(geographyText) ||
      (areaQuestion || cityQuestion) && cityWords && geographyWords.includes(` ${cityWords} `);
    const geographicAnswerAlreadyHandled = discoveryGeography || transaction && !geographicCue && !locationIn(geographyText) || villageAnswer || repeatsDistrict || ((hasCategory || anyCategory) && !hasSearchIntent(content) && !geographicCue) || (anyVillage && !hasSearchIntent(content) && ((villageQuestion && !/\b(?:kota|kabupaten)\b/i.test(content)) || !/\b(?:di|daerah|kota|kabupaten|kecamatan)\b/i.test(geographyText))) ||
      (landArea && !hasSearchIntent(content) && !geographicCue);
    let geography = geographicAnswerAlreadyHandled
      ? { area: null, city: null, broad: false }
      : geographicPreference(geographyText, { expectCity: cityQuestion, expectArea: areaQuestion && !cityQuestion && !villageQuestion, backup: backupQuestion ? preceding : null });
    const restart = resetsLocation(content);
    const referenceText = villageAnswer ? `Kelurahan ${villageAnswer}` : villageName && !anyVillage ? content : knownAreaAnswer ||
      (!geographicAnswerAlreadyHandled ? locationIn(geographyText) || ((cityQuestion || areaQuestion) && (geography.city || geography.area) ? cleanLocation(geographyText.split(/\b(?:budget|bujet|anggaran|harga|untuk|luas|lt|lb)\b/i)[0]) : '') : '');
    const pendingChoice = restart ? null : resolvePendingRegionChoice(geographyText, {
      pending: regionClarification, city: profile.city, province: profile.province, district: profile.district,
    });
    const cityChoice = pendingChoice ? null : resolveCityChoice(geographicScopeText(geographicContent, { landExpected: landQuestionIndex >= 0 }), {
      pending: restart ? null : regionClarification, scope: restart ? null : cityScope, city: restart ? null : profile.city,
    });
    let region = pendingChoice || cityChoice || (referenceText ? resolveRegion(referenceText, { city: restart ? null : profile.city, province: restart ? null : profile.province,
      district: (villageQuestion || villageName || knownAreaAnswer) && !search && !restart ? profile.district : null, expectedLevel: (villageQuestion || villageName) && !search ? 'village' : null }) : null);
    const areaEvidence = referenceText ? requestedAreaMention(referenceText) : null;
    const cityOnlyArea = !geography.area || region?.matched_city && cleanArea(geography.area).toLowerCase().startsWith(cleanArea(region.matched_city).toLowerCase());
    const correctsParent = !restart && requestedArea && !areaEvidence && cityOnlyArea && !geography.broad &&
      region?.city && !region.clarification && !region.district && !region.village &&
      /\b(?:bukan|bukannya|ralat|koreksi|maksud(?:nya)?)\b/i.test(rawContent) && !/[?？]/.test(rawContent);
    if (correctsParent) {
      const label = { district: 'Kecamatan ', village: 'Kelurahan ' }[requestedArea.level] || '';
      const scoped = resolveRegion(`${label}${requestedArea.name}`, { city: region.city, province: region.province });
      region = { ...region, ...scoped, city: scoped?.city || region.city, province: scoped?.province || region.province,
        area: scoped?.area || requestedArea.name };
    }
    if (pendingChoice) geography = { city: pendingChoice.city, area: pendingChoice.area, broad: false };
    if (cityChoice) geography = { city: cityChoice.city, area: cityChoice.area,
      broad: !!cityChoice.city_scope || !!cityChoice.whole_city || geography.broad };
    // A clarification answer supplies the missing parent for the pending name.
    // Budget/purpose answers alone never discard an unresolved ambiguity.
    if (!restart && region && !region.clarification && regionClarification && !region.village && (
      regionClarification.level === 'district' && !region.district && (region.city || region.province) ||
      regionClarification.level === 'village' && (region.city || region.district))) {
      const label = { city: '', district: 'Kecamatan ', village: 'Kelurahan ', province: 'Provinsi ' }[regionClarification.level] || '';
      const scoped = resolveRegion(`${label}${regionClarification.name}`, { city: region.city || profile.city, province: region.province || profile.province, district: region.district || profile.district });
      if (scoped) region = { ...region, ...scoped, city: scoped.city || region.city, province: scoped.province || region.province };
    }
    if (restart) { regionClarification = null; cityScope = null; }
    if (!region && geography.city) {
      regionClarification = { kind: 'unknown', level: 'city', name: geography.city, count: 0, candidates: [] };
      geography = { ...geography, city: null, area: null };
    }
    if (region) {
      if (region.city_scope) cityScope = region.city_scope;
      else if (region.city || region.province || region.clarification) cityScope = null;
      // When a recognized city begins the entire legacy "area", the rest is
      // conversational prose, not a second location. Genuine area+city phrases
      // retain their separate area; recognized districts/villages override it.
      const oldArea = cleanArea(geography.area || '').toLowerCase();
      const matchedCity = cleanArea(region.matched_city || '').toLowerCase();
      const cityLeadingArea = matchedCity && (oldArea === matchedCity || oldArea.startsWith(matchedCity + ' ') || oldArea.startsWith(matchedCity + ','));
      if (region.clarification) {
        regionClarification = region.clarification;
        // Never accept the legacy parser's speculative city for an ambiguous
        // administrative name. The directory is the authority for this path.
        geography = { ...geography, city: region.city, area: region.area || (cityLeadingArea ? null : geography.area) };
      } else {
        if (region.city || region.district || region.village || region.province) regionClarification = null;
        geography = { ...geography, city: region.city || geography.city, area: region.area || ((region.province && !region.city) || cityLeadingArea ? null : geography.area),
          broad: !!region.city_scope || !!region.whole_city || geography.broad };
      }
    }
    // Repeating the confirmed city answers the pending area question: "pokoknya
    // di Gresik" means any district in Gresik. Never infer this from a first
    // city-only search, a question, or a narrower district/village preference.
    const repeatsCity = areaQuestion && !villageQuestion && !cityQuestion && profile.city && geography.city &&
      cityKey(profile.city) === cityKey(geography.city) && !changedCity(profile.city, geography.city) && !region?.district && !region?.village && !region?.clarification && !/[?？]/.test(content);
    if (repeatsCity) geography = { ...geography, area: null, broad: true };
    const location = geography.area || (villageName && !anyVillage && (!profile.location || search && !villageQuestion) ? villageName : null);
    if (restart || geography.broad && !region?.district || changedCity(before.city, geography.city) && !correctsParent && !areaEvidence) requestedArea = null;
    if (areaEvidence) requestedArea = areaEvidence;
    else if (location && !region?.district && !region?.village && !correctsParent && !geography.broad) requestedArea = { name: location, level: null };
    const purpose = purposeIn(content, preceding);
    const priceOrder = priceOrderPreference(content);
    const confirmsLocation = locationReference && !restart && !regionClarification && !location && !geography.city &&
      (search || budget || isLocationReferenceAnswer(content));
    // Search wording is also used in answers ("saya tertarik di daerah Tandes").
    // Keep a client-confirmed city across refinements; clear geographic scope
    // only on an explicit restart or a different city supplied by the client.
    if (restart) { profile.city = null; profile.province = null; profile.district = null; profile.location = null; profile.village = null; delete profile.region_group; delete profile.nearby; delete profile.locations; delete profile.cities; delete profile.route_landmarks; nearbyError = false; villageAnswered = false; cityFromBuyer = false; }
    if (region?.province && !region.city && !region.clarification) {
      profile.city = null; profile.location = null; profile.district = null; profile.village = null; delete profile.region_group; villageAnswered = false;
    }
    if (allowBackupPrompt && preceding?.role === 'assistant' && preceding.content.includes(BACKUP_AREA_QUESTION) &&
        !declinesBackupSearch(content) && ((!/[?？]/.test(content) && (location || geography.city || budget || purpose)) || confirmsLocation)) {
      backupAccepted = true; searchStarted = true;
    }
    // "Di area tersebut" accepts the scope already discussed, including the
    // verified location of the selected listing. It is not a new place name.
    if (confirmsLocation && profile.city && profile.location) {
      cityFromBuyer = true;
      villageAnswered = true;
    }
    if (geography.city) {
      if (!discoveryGeography && profile.cities?.length > 1) { delete profile.cities; profile.location = profile.locations?.join(' / ') || null; }
      if (changedCity(profile.city, geography.city)) { profile.location = null; profile.district = null; profile.village = null; delete profile.region_group; delete profile.locations; delete profile.cities; delete profile.route_landmarks; villageAnswered = false; }
      profile.city = geography.city;
      cityFromBuyer = true;
      if (search && !location && !cityQuestion && !villageName) { profile.location = null; profile.district = null; profile.village = null; villageAnswered = false; }
    }
    if (validBudget) Object.assign(profile, validBudget);
    if (location) {
      if (!discoveryGeography) { delete profile.locations; delete profile.route_landmarks; }
      if (before.location?.toLowerCase() !== location.toLowerCase()) delete profile.region_group;
      if (profile.location?.toLowerCase() !== location.toLowerCase()) { profile.district = null; profile.village = null; villageAnswered = false; }
      // A city seeded from a selected listing is not the client's confirmation
      // for a new unscoped area. The generic backup invitation stays conservative.
      if (!geography.city && !cityFromBuyer && (backupQuestion || (search && !areaQuestion))) profile.city = null;
      profile.location = location;
    }
    if (region?.province) profile.province = region.province;
    if (region?.district && !region.clarification) profile.district = region.district;
    if (geography.broad && profile.city) {
      delete profile.region_group;
      delete profile.locations; delete profile.route_landmarks;
      // "Seluruh Kecamatan Waru" relaxes villages within Waru, not districts
      // across Sidoarjo. Informal areas likewise keep their confirmed parent.
      const scopedArea = !repeatsCity && (region?.district || location);
      if (!scopedArea || cityKey(scopedArea) === cityKey(profile.city)) { profile.location = profile.city; profile.district = null; }
      else profile.location = scopedArea;
      profile.village = null; villageAnswered = true;
    }
    if (anyVillage) { profile.village = null; villageAnswered = true; }
    else if (region?.village && !region.clarification || villageName || villageAnswer) { profile.village = region?.village || villageName || villageAnswer; villageAnswered = !region?.clarification; profile.location ||= profile.village; }
    if (scopeTurn.region) {
      profile.city = 'Surabaya'; profile.location = regionGroupLabel(scopeTurn.region); profile.region_group = scopeTurn.region;
      profile.province = 'Jawa Timur'; profile.district = null; profile.village = null;
      cityFromBuyer = true; villageAnswered = true; regionClarification = null; cityScope = null;
      requestedArea = null;
    }
    if (profile.region_group) { profile.location = regionGroupLabel(profile.region_group); villageAnswered = true; }
    if (scopeTurn.nearbyChanged) {
      if (scopeTurn.nearby) profile.nearby = scopeTurn.nearby;
      else delete profile.nearby;
      nearbyError = scopeTurn.radiusError;
      if (scopeTurn.nearby && uncertainLocation(rawContent)) {
        profile.village = null;
        // An informal umbrella such as Kebayoran is not an exact district.
        // The client's actual landmark supplies the location in the known city.
        if (!profile.district && !profile.region_group) profile.location = profile.city;
        regionClarification = null;
      }
    } else if (scopeTurn.radiusError) nearbyError = true;
    if (before.region_group && !profile.region_group && profile.location && profile.city && !regionClarification) villageAnswered = true;
    // Naming a landmark already answers "where". Ask for its city only when
    // that parent is genuinely unknown; don't demand its district or village.
    if (profile.nearby && profile.city && !regionClarification) {
      profile.location ||= profile.city; villageAnswered = true;
    }
    if (landArea) {
      const merged = { ...profile, ...landArea };
      landAreaError = landArea.error || (merged.min_land_area_m2 != null && merged.max_land_area_m2 != null && merged.min_land_area_m2 > merged.max_land_area_m2 ? 'invalid' : null);
      landAreaAnswered = !landAreaError;
      landClarification = landAreaError === 'ambiguous' ? content : null;
      if (!landAreaError) Object.assign(profile, landArea);
    }
    if (purpose) profile.purpose = purpose;
    if (priceOrder !== undefined) {
      if (priceOrder) profile.sort_by = priceOrder;
      else delete profile.sort_by;
    }
    if (transaction) {
      const wasRental = transactionValues(profile).includes('SEWA');
      const nowRental = transaction.values.includes('SEWA');
      profile.transaction_type = transaction.values.length === 1 ? transaction.values[0] : null;
      if (transaction.values.length > 1) profile.transaction_types = transaction.values;
      else delete profile.transaction_types;
      excludedTransactions = transaction.excluded;
      // Purchase capital and a periodic rent budget are not interchangeable.
      // Removing rental from a mixed search keeps the purchase budget already
      // supplied for its remaining purchase options.
      const hadPurchase = transactionValues(before).some((type) => type !== 'SEWA');
      const removingRentalFromMixed = wasRental && hadPurchase && !nowRental;
      if (!removingRentalFromMixed && (wasRental !== nowRental || nowRental && transaction.values.length === 1 && hadPurchase) && transactionValues(before).length) {
        profile.min_price = validBudget?.min_price ?? null; profile.max_price = validBudget?.max_price ?? null;
        delete profile.rental_period;
      }
      if (!nowRental) delete profile.rental_period;
      if (index === conversation.length - 1) removedTransactions = transactionValues(before).filter((type) => !transaction.values.includes(type));
    }
    const period = transactionValues(profile).includes('SEWA') ? rentalPeriod(content, { expected: periodExpected }) : null;
    if (period) {
      if (profile.rental_period && profile.rental_period !== period && !budget) { profile.min_price = null; profile.max_price = null; }
      profile.rental_period = period;
    }
    if (preference || anyCategory) {
      profile.category = category;
      if (categories.length > 1) profile.categories = categories;
      else delete profile.categories;
      categoryAnswered = anyCategory || preference.answered;
    }
    applyDiscovery(profile, discovery);
    if (discoveryGeography) {
      regionClarification = null; cityScope = null; requestedArea = null; nearbyError = false;
      villageAnswered = true; cityFromBuyer ||= !!profile.city || !!profile.cities?.length;
    }
    if (index === conversation.length - 1) {
      currentUpdate = !!(Object.keys(discovery).length || confirmsArea || scopeTurn.region || scopeTurn.nearbyChanged || transaction || budget || location || geography.city || geography.broad || purpose || villageName || villageAnswer || anyVillage || landArea || region || preference || anyCategory || confirmsLocation || priceOrder !== undefined);
      progress = [...(transaction ? ['transaction_type'] : []), ...(preference || anyCategory ? ['category'] : []), ...(landArea && !landAreaError ? ['land_area'] : []), ...(validBudget ? ['max_price'] : []), ...(period ? ['rental_period'] : []), ...(priceOrder !== undefined ? ['sort_by'] : [])];
      if (['city', 'location', 'district', 'village'].some((key) => before[key] !== profile[key])) progress.push('location');
      if (scopeTurn.nearbyChanged) progress.push('nearby');
      if (confirmsArea) progress.push('location');
      if (discoveryGeography) progress.push('location');
      // A short answer already resolved against the first question must not
      // be reinterpreted by the model as a choice for another pending field.
      const periodOnly = period && rentalPeriodAnswer(content);
      resolvedShortAnswer = !!confirmedUnit || !!periodOnly || !!transaction?.only_transaction || progress.length > 0 && (unrestrictedPreferenceAnswer(content) ||
        progress.includes('location') && acceptsAnyLocation(content) && !/\b(?:jenis|tipe|kategori|luas|ukuran|tanah|rumah|ruko)\b/i.test(content));
    }
  }
  // A follow-up is still part of the search even when its wording isn't
  // recognized. Keep the known criteria; don't search the raw answer as an address.
  const searching = !explicitAsset(text, conversation.at(-2)) && (!previousId || !declinesBackupSearch(text) || progress.includes('transaction_type')) && (hasSearchIntent(text) || progress.includes('transaction_type') || (searchStarted && (!previousId || ((forceSearch || backupAccepted) && currentUpdate))));
  const needsRentalPeriod = transactionValues(profile).includes('SEWA') && !profile.rental_period && (profile.transaction_type === 'SEWA' || profile.max_price != null);
  const missing = [...(regionClarification ? ['region'] : []), ...(nearbyError ? ['nearby_radius'] : []), ...(budgetError ? ['budget_error'] : []), ...(!transactionValues(profile).length ? ['transaction_type'] : []), 'city', 'location', 'max_price', ...(needsRentalPeriod ? ['rental_period'] : []), ...(!categoryAnswered ? ['category'] : []), ...(!landAreaAnswered ? ['land_area'] : [])]
    .filter((key) => key === 'city' && profile.cities?.length ? false : ['region', 'nearby_radius', 'budget_error', 'transaction_type', 'rental_period', 'land_area', 'village', 'category'].includes(key) || profile[key] == null);
  if (dialogue?.reply) missing.push('clarification');
  return { profile, searching, missing, backupAccepted, removed_transactions: removedTransactions, search_turn: searchTurns, city_scope: cityScope, region_clarification: regionClarification, land_area_error: landAreaError, budget_error: budgetError,
    continuation: { profile, searchStarted, searchTurns, backupAccepted, cityFromBuyer, villageAnswered, landAreaAnswered, landAreaError, budgetError, budgetClarification, categoryAnswered, excludedTransactions, regionClarification, cityScope, requestedArea, landClarification, nearbyError, last_sequence: history.at(-1)?.seq ?? continuation?.last_sequence,
      ...(continuation?.notification_search ? { notification_search: true, batch_size: continuation.batch_size, offered_ids: continuation.offered_ids || [], sender_agent_id: continuation.sender_agent_id } : {}) },
    dialogue, progress, needs_interpretation: !dialogue && !landAreaError && !resolvedShortAnswer && expectedFields.some((field) => missing.includes(field) && !progress.includes(field)),
    stage: searching ? missing.length ? 'qualifying' : 'recommendations' : 'consultation' };
}
