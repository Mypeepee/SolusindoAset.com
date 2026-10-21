import snapshot from '../data/regions.json' with { type: 'json' };

// Administrative levels branch: province -> city OR regency -> district ->
// village. Inventory and assistant prose never establish administrative parents.
const levels = { 2: 'province', 4: 'city', 6: 'district', 10: 'village' };
const cityPrefix = /^(?:kabupaten(?: administrasi)?|kota(?: administrasi)?|kab\.?\s*adm\.?|kota\s*adm\.?|kab\.?)\s+/i;
const core = (value) => value.replace(cityPrefix, '');
const key = (value) => value.toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]/gu, '');
const wordKey = (value) => value.toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const records = new Map(snapshot.rows.map(([id, name]) => [id, { id, name, level: levels[id.length] }]));
const names = new Map();
const addName = (name, region) => {
  const k = key(name), list = names.get(k) || [];
  if (!list.some((r) => r.id === region.id)) list.push(region);
  names.set(k, list);
};
for (const region of records.values()) {
  addName(region.name, region);
  if (region.level === 'city') addName(core(region.name), region);
}
export const knownCityNames = [...new Set([...records.values()].filter((r) => r.level === 'city').flatMap((r) => [r.name, core(r.name)]))].sort((a, b) => b.length - a.length);
for (const [id, alias] of Object.entries({ 3171: 'Jakpus', 3172: 'Jakut', 3173: 'Jakbar', 3174: 'Jaksel', 3175: 'Jaktim' })) {
  addName(alias, records.get(id)); knownCityNames.push(alias);
}
const provinceAliases = {
  31: ['Jakarta', 'DKI Jakarta', 'DK Jakarta'], 34: ['DIY', 'DI Yogyakarta', 'Jogja', 'Yogya'],
  32: ['Jabar'], 33: ['Jateng'], 35: ['Jatim'], 52: ['NTB'], 53: ['NTT'],
  61: ['Kalbar'], 62: ['Kalteng'], 63: ['Kalsel'], 64: ['Kaltim'], 65: ['Kaltara'],
  71: ['Sulut'], 72: ['Sulteng'], 73: ['Sulsel'], 74: ['Sultra'], 76: ['Sulbar'],
};
for (const [id, aliases] of Object.entries(provinceAliases)) for (const alias of aliases) addName(alias, records.get(id));
export const regionSnapshot = { counts: snapshot.counts, revision: snapshot.revision, source: snapshot.source };

const parent = (region, length) => region && region.id.length >= length ? records.get(region.id.slice(0, length)) : null;
const sameName = (a, b) => key(core(a || '')) === key(core(b || ''));
function cityLabel(region) {
  const bare = core(region.name);
  return names.get(key(bare)).filter((r) => r.level === 'city').length === 1 ? bare : region.name;
}
export function regionDetails(region) {
  return { id: region.id, level: region.level, name: region.name,
    province: parent(region, 2)?.name || null,
    city: parent(region, 4) ? cityLabel(parent(region, 4)) : null,
    district: parent(region, 6)?.name || null,
    village: region.level === 'village' ? region.name : null };
}
const ignored = new Set('di daerah kawasan area wilayah sekitar halo pak bapak ibu bu saya ingin mau cari carikan aset properti rumah apa apakah ada adakah tolong bantu ya kah bebas investasi hunian selamat pagi siang sore malam anggaran budget luas tanah'.split(' '));

function precedingLabel(text) {
  const match = /\b(provinsi|propinsi|kota(?:\s+(?:administrasi|adm\.?))?|kabupaten(?:\s+administrasi)?|kab\.?|kecamatan|kec\.?|kelurahan|kel\.?|desa)\s*$/i.exec(text);
  if (!match) return null;
  const label = match[1].toLowerCase();
  return { level: /^pro/.test(label) ? 'province' : /^(kota|kab)/.test(label) ? 'city' : /^kec/.test(label) ? 'district' : 'village',
    family: /^kab/.test(label) ? 'kabupaten' : /^kota/.test(label) ? 'kota' : null };
}

// Bounded whole-word spans, longest first. "Jakarta Selatan, apa adakah Pak?"
// resolves Jakarta Selatan; "Pamanukan" never becomes "Manukan".
function mentions(text, expectedLevel) {
  const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
  const result = [];
  for (let start = 0; start < words.length; start++) {
    for (let length = Math.min(8, words.length - start); length > 0; length--) {
      const first = words[start], last = words[start + length - 1];
      const raw = text.slice(first.index, last.index + last[0].length);
      if (length === 1 && (ignored.has(raw.toLowerCase()) || /^(?:provinsi|propinsi|kota|kabupaten|kab|kecamatan|kec|kelurahan|kel|desa)$/i.test(raw) && !precedingLabel(text.slice(0, first.index)))) continue;
      let candidates = names.get(key(raw));
      if (!candidates) continue;
      const label = precedingLabel(text.slice(0, first.index));
      if (label) candidates = candidates.filter((r) => r.level === label.level && (!label.family || r.name.toLowerCase().startsWith(label.family)));
      if (!candidates.length) continue;
      // A city name outranks an identically named district; when asked for a
      // village, however, "Tandes" can explicitly select Kelurahan Tandes.
      const preferred = label?.level || (candidates.some((r) => r.level === expectedLevel) ? expectedLevel :
        ['city', 'province', 'district', 'village'].find((level) => candidates.some((r) => r.level === level)));
      result.push({ raw, labelled: !!label, candidates: candidates.filter((r) => r.level === preferred), alternatives: candidates });
      start += length - 1;
      break;
    }
  }
  return result;
}

// Remember what the client named, rather than an inferred administrative parent.
export function requestedAreaMention(text) {
  const mention = mentions(text).find((m) => ['district', 'village'].includes(m.candidates[0].level));
  return mention ? { name: mention.raw, level: mention.labelled ? mention.candidates[0].level : null } : null;
}

// Implicit geography must consist of known names, not merely contain a word
// that happens to be a village ("kalo" is also an Indonesian village name).
// Explicit location cues can still introduce informal neighborhood names.
export function isKnownRegionPhrase(text) {
  if (names.has(key(text))) return true;
  const found = mentions(text);
  if (!found.length) return false;
  const withoutLabels = (value) => value.replace(/\b(?:di|daerah|kawasan|wilayah|area|sekitar|provinsi|propinsi|kota|kabupaten|kab\.?|kecamatan|kec\.?|kelurahan|kel\.?|desa)\s+/gi, '');
  return key(withoutLabels(text)) === key(found.map((mention) => withoutLabels(mention.raw)).join(' '));
}
function scopeMatches(region, scope) {
  const city = parent(region, 4), province = parent(region, 2);
  if (scope.city && (!city || !sameName(city.name, scope.city))) return false;
  if (scope.city && cityPrefix.test(scope.city) && /^(?:kota|kabupaten)/i.exec(city.name)?.[0].toLowerCase() !== (/^(?:kota|kabupaten|kab)/i.exec(scope.city)?.[0].toLowerCase().replace(/^kab$/, 'kabupaten'))) return false;
  if (scope.province && !sameName(province?.name, scope.province)) return false;
  if (scope.district && region.level === 'village' && !sameName(parent(region, 6)?.name, scope.district)) return false;
  return true;
}
const clarification = (mention, candidates, kind = 'ambiguous', scope = null) => ({
  kind, name: mention.raw, level: mention.candidates[0]?.level, count: candidates.length,
  candidates: candidates.slice(0, 5).map(regionDetails), scope,
});

// A shared name may identify a city AND a regency. Only combine that verified
// pair, never unrelated districts, different provinces, or prefix matches such
// as Bandung Barat. A bare DB city filter already matches both exact families.
export function cityRegencyPair(candidates = []) {
  if (candidates.length !== 2 || candidates.some((r) => r.level !== 'city')) return null;
  const [first, second] = candidates;
  if (!sameName(first.name, second.name) || !first.province || first.province !== second.province ||
      !candidates.some((r) => /^kota\s/i.test(r.name)) || !candidates.some((r) => /^kabupaten\s/i.test(r.name))) return null;
  return { name: core(first.name), cities: candidates.map((r) => r.name), province: first.province };
}

// Resolve an answer within the lower-level choices already offered. A bare
// "Malang" can match both cities nationally but only one parent of Pakis.
export function resolvePendingRegionChoice(text, { pending = null, city = null, province = null, district = null } = {}) {
  if (!['district', 'village', 'area'].includes(pending?.level) || !Array.isArray(pending.candidates) || !pending.candidates.length) return null;
  if (/[?？]|\b(?:belum|bingung|mungkin|barangkali|bukan|jangan|tidak|nggak|ngga|gak|ga)\b/i.test(text)) return null;
  const length = pending.level === 'district' ? 6 : 10;
  const found = mentions(text);
  // A different child name is a new location, not a choice of the old one.
  if (found.some((m) => m.candidates[0]?.level === pending.level && !sameName(m.raw, pending.name))) return null;
  const ancestors = found.flatMap((mention) => {
    // Repeating the pending child does not select a same-named district as
    // its parent ("Banyu Urip di Surabaya"). Labels can still name that parent.
    if (!mention.labelled && sameName(mention.raw, pending.name)) return [];
    const candidates = (mention.labelled ? mention.candidates : names.get(key(mention.raw)) || [])
      .filter((region) => region.id.length < length);
    return candidates.length ? [{ ...mention, candidates }] : [];
  });
  if (!ancestors.length) return null;
  const matchesLevel = (region) => region && (region.level === pending.level || pending.level === 'area' && ['district', 'village'].includes(region.level));
  let choices = pending.candidates.map((candidate) => records.get(candidate.id))
    .filter((region) => matchesLevel(region) && key(region.name) === key(pending.name));
  // Clarifications display at most five entries. A parent can also select a
  // valid unshown entry, within the same original administrative scope.
  if (pending.count > pending.candidates.length) {
    const expanded = (names.get(key(pending.name)) || []).filter((region) => matchesLevel(region) &&
      (pending.kind === 'conflict' || scopeMatches(region, { city, province, district })));
    if (expanded.length >= choices.length) choices = expanded;
  }
  if (!choices.length) return null;
  const matched = choices.filter((child) => ancestors.every((mention) => mention.candidates.some((ancestor) => child.id.startsWith(ancestor.id))));
  // A district already covers its same-named village; a parent answer can
  // select that district without another ambiguity within the same hierarchy.
  const compatible = pending.level === 'area' ? matched.filter((child) =>
    !matched.some((ancestor) => ancestor.id !== child.id && child.id.startsWith(ancestor.id))) : matched;
  const output = { city: null, province: null, district: null, village: null, area: null, clarification: null,
    matched_city: found.find((m) => m.candidates[0]?.level === 'city')?.raw || null };
  if (!compatible.length) {
    return { ...output, clarification: { ...pending, kind: 'conflict', scope: ancestors.map((m) => m.raw).join(', ') } };
  }
  const commonParent = (size) => {
    const first = parent(compatible[0], size);
    return first && compatible.every((region) => parent(region, size)?.id === first.id) ? first : null;
  };
  const provinceParent = commonParent(2), cityParent = commonParent(4), districtParent = commonParent(6);
  const labelledCity = found.some((m) => m.candidates[0]?.level === 'city' && (m.labelled || cityPrefix.test(m.raw)));
  output.province = provinceParent?.name || null;
  output.city = cityParent ? labelledCity ? cityParent.name : cityLabel(cityParent) : null;
  output.district = districtParent?.name || null;
  output.area = output.district;
  if (compatible.length === 1) {
    if (compatible[0].level === 'village') output.village = compatible[0].name;
    return output;
  }
  return { ...output, clarification: { ...pending, kind: 'ambiguous', count: compatible.length,
    candidates: compatible.slice(0, 5).map(regionDetails), scope: output.city } };
}

export function resolveCityChoice(text, { pending = null, scope = null, city = null } = {}) {
  const found = mentions(text);
  const cityMentions = found.filter((m) => m.candidates[0].level === 'city');
  const mentioned = cityMentions[0]?.raw;
  // Explicit names outrank the pending question. Never apply "keduanya" from
  // a previous Mojokerto choice to a new, unrelated location.
  const base = mentioned || (pending?.level === 'city' ? pending.name : scope?.name || city);
  if (!base) return null;
  const candidates = (names.get(key(core(base))) || []).filter((r) => r.level === 'city').map(regionDetails);
  const pair = cityRegencyPair(candidates);
  if (!pair || cityMentions.some((m) => !sameName(m.raw, pair.name))) return null;
  const provinceMentions = found.filter((m) => m.candidates[0].level === 'province');
  if (provinceMentions.some((m) => !m.candidates.some((r) => r.name === pair.province))) return null;
  const pendingPair = pending?.level === 'city' && cityRegencyPair(pending.candidates);
  const choosing = !!pendingPair || !!scope;
  // Questions/uncertainty are not consent to widen an area. Negative choices
  // still go through the ordinary correction parser below.
  const inventoryRequest = /\b(?:cari(?:kan)?|mencari|butuh|apa(?:kah)? ada|ada(?:kah)?\s+(?:aset|properti|rumah|pabrik|ruko|tanah|gudang|apartemen)|tersedia)\b/i.test(text);
  const uncertain = /[?？]/.test(text) && !inventoryRequest || /\b(?:belum (?:tahu|yakin|mau|boleh|pilih|memilih)|tidak tahu|bingung|bedanya|perbedaan)\b/i.test(text);
  const negative = /\b(?:bukan|jangan|tidak|nggak|enggak|gak|ga|belum)\s+(?:(?:mau|boleh|pilih|di)\s+)*(?:keduanya|dua[ -]?duanya|kota(?:nya)?|kab(?:upaten)?(?:nya)?|semua|bebas)\b/i.test(text);
  const bothWords = /\b(?:keduanya|dua[ -]?duanya|dua2nya|dua wilayah|dua daerah)\b/i.test(text);
  const bothFamilies = /\bkota(?:nya)?\b/i.test(text) && /\bkab(?:upaten)?(?:nya)?\b/i.test(text);
  const accepting = /\b(?:boleh|bebas|terserah|maupun|dan|sekalian|sekaligus|keduanya|semua|seluruh|mana saja|mana aja|dua[ -]?duanya)\b|\b(?:tidak|nggak|gak|ga)\s+masalah\b/i.test(text);
  const shortAny = choosing && /\b(?:bebas|terserah|semua|keduanya|dua[ -]?duanya|dua2nya|mana\s*(?:saja|aja))\b/i.test(text) &&
    /^(?:(?:bebas|terserah|semua|keduanya|dua[ -]?duanya|dua2nya|mana\s*(?:saja|aja)|boleh|saja|aja|pak|bapak|bu|ibu|ya)|[\s,.!])*$/i.test(text.trim());
  const repeatCombined = scope && cityMentions.length && cityMentions.every((m) => !m.labelled && !cityPrefix.test(m.raw)) && sameName(scope.name, pair.name);
  const anyNamedArea = cityMentions.length && cityMentions.every((m) => !m.labelled && !cityPrefix.test(m.raw)) &&
    /\b(?:seluruh|semua|bebas|terserah|mana\s*(?:saja|aja))\b/i.test(text);
  const both = !uncertain && !negative && (bothWords && (choosing || mentioned) || bothFamilies && accepting || shortAny || repeatCombined || anyNamedArea);
  if (both) {
    // A named lower-level region in the same sentence narrows the choice.
    if (found.some((m) => ['district', 'village'].includes(m.candidates[0].level))) return null;
    return { city: pair.name, province: pair.province, district: null, village: null, area: pair.name,
      clarification: null, matched_city: mentioned || pair.name, city_scope: pair };
  }
  // "Kotanya saja" resolves the current pair even without repeating its name.
  if (!choosing || uncertain || mentioned || negative && /\b(?:kota(?:nya)?\s+(?:dan|maupun|atau)\s+kab(?:upaten)?(?:nya)?|kab(?:upaten)?(?:nya)?\s+(?:dan|maupun|atau)\s+kota(?:nya)?)\b/i.test(text)) return null;
  const positive = text.replace(/\b(?:bukan|jangan|tidak|nggak|gak|ga)\s+(?:(?:mau|di)\s+)?(?:kota|kab(?:upaten)?)(?:nya)?\b/gi, ' ');
  const wantsCity = /\bkota(?:nya)?\b/i.test(positive), wantsRegency = /\bkab(?:upaten)?(?:nya)?\b/i.test(positive);
  if (wantsCity === wantsRegency) return null;
  const selected = pair.cities.find((name) => wantsCity ? /^kota\s/i.test(name) : /^kabupaten\s/i.test(name));
  const result = resolveRegion(selected);
  return scope ? { ...result, area: result.city, whole_city: true } : result;
}

/** @param {string} text @param {{city?: string|null, province?: string|null, district?: string|null, expectedLevel?: string|null}} [scope] */
export function resolveRegion(text, { city = null, province = null, district = null, expectedLevel = null } = {}) {
  const found = mentions(text, expectedLevel);
  if (!found.length) return null;
  const output = { city: null, province: null, district: null, village: null, area: null, clarification: null, matched_city: null };
  const cityMention = found.find((m) => m.candidates[0].level === 'city');
  const provinceMention = found.find((m) => m.candidates[0].level === 'province');
  if (provinceMention) {
    const r = provinceMention.candidates[0];
    output.province = r.name;
    province = r.name;
    // A newly named province may intentionally replace the previous city.
    if (city && !(names.get(key(core(city))) || []).some((r) => scopeMatches(r, { province }))) city = null;
  }
  if (cityMention) {
    output.matched_city = cityMention.raw;
    let candidates = cityMention.candidates.filter((r) => scopeMatches(r, { province: provinceMention ? province : null }));
    for (const lower of found.filter((m) => ['district', 'village'].includes(m.candidates[0].level))) {
      const compatible = candidates.filter((r) => lower.alternatives.some((child) => child.id.startsWith(r.id)));
      if (compatible.length) candidates = compatible;
    }
    if (candidates.length !== 1) {
      output.clarification = clarification(cityMention, candidates.length ? candidates : cityMention.candidates);
      return output;
    }
    const r = candidates[0];
    output.city = cityMention.labelled ? r.name : cityPrefix.test(cityMention.raw) ? cityMention.raw : cityLabel(r);
    // Preserve the buyer's spelling when it is an unambiguous bare city.
    if (!cityMention.labelled && sameName(output.city, cityMention.raw) && !cityPrefix.test(output.city)) output.city = cityMention.raw;
    output.province = parent(r, 2).name;
    city = output.city; province = output.province; district = null;
  }
  // Resolve unlabelled children within the confirmed parent before choosing
  // their level. Pakis/Banyu Urip can be a village here and a district elsewhere.
  const scopedMentions = found.map((mention) => {
    if (mention.labelled || !['district', 'village'].includes(mention.candidates[0].level) || !city && !province && !district) return mention;
    const candidates = mention.alternatives.filter((r) => scopeMatches(r, { city, province, district }));
    const preferred = mention.alternatives.some((r) => r.level === expectedLevel) ? expectedLevel :
      ['district', 'village'].find((level) => candidates.some((r) => r.level === level));
    const selected = candidates.filter((r) => r.level === preferred);
    return selected.length ? { ...mention, candidates: selected } : mention;
  });
  if (!city && !province && !district && !expectedLevel) {
    for (const mention of scopedMentions.filter((m) => !m.labelled && ['district', 'village'].includes(m.candidates[0].level))) {
      const candidates = mention.alternatives.filter((r) => ['district', 'village'].includes(r.level));
      if (new Set(candidates.map((r) => r.level)).size > 1 && new Set(candidates.map((r) => wordKey(r.name))).size > 1 &&
          new Set(candidates.map((r) => r.id.slice(0, 4))).size > 1) {
        output.clarification = { ...clarification(mention, candidates), level: 'area' };
        return output;
      }
    }
  }
  for (const level of ['district', 'village']) {
    for (const mention of scopedMentions.filter((m) => m.candidates[0].level === level)) {
      // A one-word village may also be an informal neighborhood elsewhere
      // (e.g. Manukan). Require a city or an explicit village label first.
      if (level === 'village' && !city && !mention.labelled && !/\s/.test(mention.raw)) continue;
      const candidates = mention.candidates.filter((r) => scopeMatches(r, { city, province, district: level === 'village' ? district : null }));
      if (!candidates.length && level === 'village' && !mention.labelled && expectedLevel !== 'village') continue;
      if (candidates.length !== 1) {
        const scope = level === 'village' && district ? `Kecamatan ${district}${city ? `, ${city}` : ''}` : city;
        output.clarification = clarification(mention, candidates.length ? candidates : mention.candidates, candidates.length ? 'ambiguous' : 'conflict', scope);
        return output;
      }
      const r = candidates[0], details = regionDetails(r);
      const ambiguousParent = city && (names.get(key(core(city))) || []).filter((r) => r.level === 'city').length > 1 && !cityPrefix.test(city);
      output.city ||= ambiguousParent ? details.city : city || details.city;
      output.province ||= details.province;
      output.district = level === 'district' ? mention.raw : details.district;
      output.area = output.district;
      if (level === 'village') output.village = mention.raw;
      city = output.city; province = output.province; district = output.district;
    }
  }
  return output;
}
