import { hasDetailLink, renderRecommendations } from './recommendations.js';
import { PROPERTY_CATEGORY_LABELS } from './property_category.js';
import { cityRegencyPair } from './region_directory.js';
import { TRANSACTION_QUESTION, transactionValues } from './property_transaction.js';
import { discoveryVerificationNote } from './smart_search_parser.js';
import { RECOMMENDATION_BATCH_SIZE } from './recommendation_policy.js';

export const CLARIFY_PROPERTY_MESSAGE = 'Mau tahu bagian yang mana ya, harga, lokasi, fasilitas, atau biaya? Kalau ingin cari properti lain juga boleh.';
const plain = (value) => typeof value === 'string' ? value.replace(/[\r\n*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) : '';
const placeLabel = (value) => plain(value).replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase('id-ID'));

// Search qualification is driven by explicit preferences. It does not need an
// LLM to acknowledge the request or ask for the remaining criteria.
export function searchReply(context, now = Date.now()) {
  const buyer = context.buyer;
  if (!buyer?.searching) return null;
  if (buyer.dialogue?.reply) return buyer.dialogue.reply;
  const location = buyer.profile?.locations?.length ? buyer.profile.locations.map(placeLabel).join(' atau ') : plain(buyer.profile?.location);
  const area = location ? location[0].toLocaleUpperCase('id-ID') + location.slice(1) : '';
  const cityName = placeLabel(buyer.profile?.city);
  const combinedCity = buyer.city_scope ? `Kota dan Kabupaten ${placeLabel(buyer.city_scope.name)}` : '';
  const city = buyer.profile?.cities?.length > 1 ? buyer.profile.cities.map(placeLabel).join(' atau ') : combinedCity || cityName;
  const village = placeLabel(buyer.profile?.village);
  const types = buyer.profile?.categories?.map((category) => PROPERTY_CATEGORY_LABELS[category]).filter(Boolean);
  const type = types?.length ? new Intl.ListFormat('id-ID', { type: 'disjunction' }).format(types) : PROPERTY_CATEGORY_LABELS[buyer.profile?.category];
  const property = type || 'properti';
  const transactions = transactionValues(buyer.profile);
  const nonAuction = transactions.length === 2 && transactions.includes('PRIMARY') && transactions.includes('SECONDARY');
  const transactionDescription = { LELANG: `${type || 'aset'} lelang`, PRIMARY: `${property} baru dari developer`,
    SECONDARY: `${property} secondary`, SEWA: `${property} untuk disewa` };
  const description = transactions.length === 1 ? transactionDescription[transactions[0]] || property : nonAuction ? `${property} non-lelang` : property;
  const wholeCity = area && cityName && !buyer.profile?.district && area.toLowerCase() === cityName.toLowerCase();
  const number = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
  const minPrice = buyer.profile?.min_price, maxPrice = buyer.profile?.max_price;
  const budget = minPrice > 0 && maxPrice > 0 ? `, budget Rp ${number(minPrice)}–Rp ${number(maxPrice)}` :
    maxPrice > 0 ? `, budget maksimal Rp ${number(maxPrice)}` : minPrice > 0 ? `, budget minimal Rp ${number(minPrice)}` : '';
  const minLand = buyer.profile?.min_land_area_m2, maxLand = buyer.profile?.max_land_area_m2;
  const land = minLand > 0 && maxLand > 0 ? `, luas tanah ${number(minLand)}–${number(maxLand)} m²` :
    minLand > 0 ? `, luas tanah minimal ${number(minLand)} m²` : maxLand > 0 ? `, luas tanah maksimal ${number(maxLand)} m²` : '';
  const near = buyer.profile?.nearby;
  const proximity = near ? `, dekat ${plain(near.query)}${near.radius_m ? ` dalam radius ${near.radius_m >= 1000 ? `${near.radius_m / 1000} km` : `${near.radius_m} meter`}` : ''}` : '';
  const route = buyer.profile.route_landmarks?.length ? `, dengan patokan koridor ${buyer.profile.route_landmarks.map(plain).join('–')}` : '';
  const requirements = [buyer.profile.legal_requirements?.length ? buyer.profile.legal_requirements.map(plain).join(' / ') : '', buyer.profile.special_requirements || ''].filter(Boolean).join(', ');
  const details = requirements ? `. Syaratnya ${requirements}` : '';
  const complex = !!(requirements || route || buyer.profile.locations?.length || buyer.profile.cities?.length);
  const verification = discoveryVerificationNote(buyer.profile);
  const scope = (village ? ` di kelurahan ${village}${area && area.toLowerCase() !== village.toLowerCase() ? `, ${area}` : ''}${city ? `, ${city}` : ''}` :
    wholeCity ? ` di seluruh wilayah ${city}` : area ? ` di ${area}${city && !buyer.profile.region_group && city.toLowerCase() !== area.toLowerCase() ? `, ${city}` : ''}` : city ? ` di ${city}` : '') + proximity + route;
  const first = !buyer.search_turn || buyer.search_turn === 1;
  const transactionLabel = (value) => ({ LELANG: 'lelang', PRIMARY: 'primary', SECONDARY: 'secondary', SEWA: 'sewa' })[value];
  const list = new Intl.ListFormat('id-ID', { type: 'conjunction' });
  const transactionChoices = list.format(transactions.map(transactionLabel));
  const removedChoices = list.format((buyer.removed_transactions || []).map(transactionLabel));
  const acknowledgement = complex ? `Siap, saya catat ${description}${scope}${budget}${land}${details}.` : first ? `Siap, saya bantu cari ${description}${scope}${budget} ya.` :
    removedChoices ? `Oke, ${removedChoices} saya kecualikan.${transactions.length > 1 ? ` Pilihannya ${transactionChoices}.` : ''} Saya bantu cari ${description}${scope}${budget} ya.` :
    buyer.progress?.includes('transaction_type') && transactions.length > 1 ? `Oke, ${transactions.length === 4 ? 'semua jenis transaksi boleh' : 'pilihannya'}: ${transactionChoices}. Saya bantu cari ${description}${scope}${budget} ya.` :
    buyer.progress?.includes('transaction_type') ? `Oke, kita cari ${description}${scope}${budget} ya.` :
    buyer.progress?.length ? `Oke, ${type || (buyer.progress.includes('category') ? 'jenis propertinya bebas' : 'pencariannya')}${scope}${budget} ya.` : '';
  const pricePreference = buyer.progress?.includes('sort_by') && buyer.profile.sort_by === 'price_asc'
    ? ' Saya prioritaskan pilihan dengan harga paling rendah sesuai kriteria tadi.' : '';
  const alternative = buyer.backup_for ? ` Saya cari pilihan di luar aset kode ${plain(buyer.backup_for)}.` : '';
  if (buyer.stage === 'qualifying' && buyer.missing?.length) {
    if (buyer.missing.includes('nearby_radius')) return 'Radius pencarian bisa antara 1 meter sampai 20 km. Mau gunakan radius berapa dari tempat tersebut? Kriteria lainnya tetap saya simpan.';
    if (buyer.budget_error) return buyer.budget_error === 'ambiguous'
      ? 'Budget tadi dalam juta atau miliar rupiah, ya? Cukup sebutkan satuannya; angka dan kriteria sebelumnya tetap saya simpan.'
      : 'Rentang budgetnya perlu dicek lagi: nominal harus positif dan batas bawah tidak boleh melebihi batas atas. Mau pakai rentang berapa? Kriteria lainnya tetap saya simpan.';
    if (buyer.missing.includes('transaction_type')) return `${first ? `Siap, saya bantu cari ${property}${scope} ya.\n\n` : buyer.progress?.includes('location') ? `${acknowledgement}\n\n` : ''}${TRANSACTION_QUESTION}`;
    const clarification = buyer.region_clarification;
    if (clarification) {
      if (clarification.kind === 'unknown') return `Saya belum menemukan wilayah ${placeLabel(clarification.name)}. Bisa sebutkan kota/kabupaten dan provinsinya, atau cek lagi ejaannya?`;
      const labels = { province: 'Provinsi', district: 'Kecamatan', village: 'Desa/Kelurahan' };
      const choices = clarification.candidates.map((r) => [
        `${labels[r.level] ? labels[r.level] + ' ' : ''}${placeLabel(r.name)}`,
        ...(r.level === 'village' && r.district ? [`Kecamatan ${placeLabel(r.district)}`] : []),
        ...(['district', 'village'].includes(r.level) && r.city ? [placeLabel(r.city)] : []),
        ...(r.province && r.level !== 'province' ? [placeLabel(r.province)] : []),
      ].join(', '));
      const intro = clarification.kind === 'conflict'
        ? `${placeLabel(clarification.name)} belum cocok dengan wilayah ${placeLabel(clarification.scope)} yang tadi dipilih. Ada beberapa kemungkinan:`
        : `Ada beberapa wilayah bernama ${placeLabel(clarification.name)}:`;
      const sameCity = city && clarification.candidates.every((r) => placeLabel(r.city) === city);
      const question = clarification.level === 'city' ? `Maksudnya kota atau kabupaten yang mana?${cityRegencyPair(clarification.candidates) ? ' Kalau keduanya boleh juga bisa.' : ''}` :
        clarification.level === 'village' && sameCity ? `Desa/kelurahannya di kecamatan mana di ${city}?` :
        clarification.level === 'district' ? `Kecamatan ${placeLabel(clarification.name)} yang dimaksud berada di kota atau kabupaten mana? Boleh sebutkan nama daerah atau provinsinya.` :
        'Yang dimaksud berada di kota atau kabupaten mana ya? Kalau tahu kecamatannya, boleh sekalian disebutkan.';
      return `${intro}\n\n${choices.map((choice) => `• ${choice}`).join('\n')}${clarification.count > choices.length ? '\n• Wilayah lain — silakan sebutkan kota/kabupaten dan kecamatannya.' : ''}\n\n${question}`;
    }
    // Only the bundled administrative reference can infer a region's parents.
    if (buyer.missing.includes('city') && near) return `Siap, saya cari ${description} dekat ${plain(near.query)}. Tempat tersebut di kota atau kabupaten mana ya?`;
    if (buyer.missing.includes('city')) return area
      ? `Siap, saya bantu cari ${description} di ${area}. Area ${area} ini di kota atau kabupaten mana ya?`
      : `Mau cari ${description}${buyer.profile?.province ? ` di ${placeLabel(buyer.profile.province)}` : ''}, kota atau kabupaten mana ya?`;
    if (area && buyer.missing.includes('village')) return `Oke, kita cari ${description} di ${area}${city ? `, ${city}` : ''}${budget}.${alternative}\n\nDi kelurahan mana? Kalau fleksibel, seluruh kawasan ${area} juga boleh.`;
    if (buyer.land_area_error) return buyer.land_area_error === 'ambiguous'
      ? 'Luas tanah tadi maksudnya batas minimal, batas maksimal, atau luas persis?'
      : 'Batas luas tanahnya belum cocok: angkanya perlu positif dan minimalnya tidak boleh lebih besar dari maksimal. Mau pakai luas tanah minimal dan maksimal berapa?';
    const questions = {
      location: `Incar daerah mana? Kalau fleksibel, seluruh ${city} juga boleh.`,
      max_price: buyer.profile.transaction_type === 'SEWA' ? 'Budget sewanya sampai berapa?' : 'Budget-nya sampai berapa?',
      rental_period: transactions.length > 1 ? 'Untuk pilihan sewa, budget tadi per bulan, per tahun, atau periode lain?' : 'Budget sewa itu untuk per bulan, per tahun, atau periode lain?',
      category: 'Jenis properti apa yang dicari, rumah, ruko, atau yang lain? Boleh pilih beberapa, atau jawab “jenis bebas”.',
      land_area: 'Ada patokan luas tanah minimal atau maksimal? Kalau fleksibel, boleh jawab “bebas”.',
    };
    const missing = [...new Set(buyer.missing)].map((key) => questions[key]).filter(Boolean).slice(0, 2);
    if (!missing.length) return null;
    if (buyer.needs_interpretation && !buyer.progress?.length) {
      return `Saya belum menangkap bagian ${buyer.missing.includes('category') ? 'jenis propertinya' : 'luas tanahnya'}. ${missing[0]}`;
    }
    return [(acknowledgement + alternative + pricePreference).trim(), missing.join('\n')].filter(Boolean).join('\n\n');
  }
  if (context.status === 'recommendations' && context.catalog?.length && context.catalog.every(hasDetailLink)) {
    const candidates = context.catalog.filter((asset) => !['sold', 'withdrawn'].includes(asset.availability_status) &&
      !['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status)).slice(0, buyer.continuation?.notification_search ? RECOMMENDATION_BATCH_SIZE : 5);
    if (!candidates.length) return null;
    const nextBatch = buyer.continuation?.notification_search && buyer.excluded_ids?.length;
    const introduction = nextBatch ? `Siap, saya carikan pilihan lain. Kriterianya tetap ${description}${scope}${budget}${land}. Aset yang sudah saya tawarkan tidak saya ulang di daftar ini.` : complex ? `${acknowledgement}${verification ? ` ${verification}` : ''}` : buyer.resumed_after_detail ? `Baik, saya lanjutkan pencarian ${description}${scope}${budget}${land}. Kriteria sebelumnya tetap saya gunakan.` :
      minPrice > 0 && maxPrice > 0 ? `Saya cari ${description}${scope}${budget}${land}.` : '';
    const selectionQuestion = candidates.length === 1 ? 'Mau saya bantu cek detail aset ini?'
      : nextBatch ? 'Yang paling mendekati kebutuhan Bapak/Ibu nomor berapa? Kalau ada yang kurang cocok dari pilihan sebelumnya, boleh ceritakan supaya saya bisa menyaring lebih tepat.' : 'Ada yang menarik? Sebutkan nomor pilihannya, nanti saya bantu cek detailnya.';
    return renderRecommendations(`Ada ${candidates.length} pilihan ${description}${buyer.excluded_ids?.length ? ' lainnya' : ''}${scope} yang cocok:\n\n${candidates.map((asset) => `[[PROPERTY:${asset.id}]]`).join('\n')}\n\n${selectionQuestion}`, candidates, context.selection, now, introduction);
  }
  if (context.status === 'not_found') {
    if (buyer.continuation?.notification_search && buyer.excluded_ids?.length && !buyer.dialogue?.note) {
      return `Untuk kriteria ${description}${scope}${budget}${land}, saat ini belum ada pilihan lain yang belum saya tawarkan.\n\nKalau Bapak/Ibu ingin memperluas pencarian, bagian mana yang masih fleksibel: area, budget, atau luas tanah? Kriteria tetap saya pegang sampai Bapak/Ibu menentukan perubahannya.`;
    }
    const alternatives = buyer.profile?.min_land_area_m2 != null || buyer.profile?.max_land_area_m2 != null
      ? 'perluas area, sesuaikan budget, atau ubah batas luas tanah'
      : 'perluas area atau sesuaikan budget';
    const note = buyer.dialogue?.note ? `${buyer.dialogue.note}\n\n` : '';
    return `${note}Belum ketemu ${description}${buyer.excluded_ids?.length ? ' lain' : ''} yang cocok${scope}${budget}${land}${details}.${near ? ' Data tempat terdekat belum mencakup semua aset, jadi hasil ini mengikuti data yang sudah tercatat.' : ''}${verification ? ` ${verification}` : ''}\n\n${buyer.dialogue?.changed && near ? 'Mau perlebar radius dari tempat tadi? Sebutkan jarak yang masih nyaman, misalnya 2 km atau 5 km. Budget tetap sama.' : `Mau coba ${near ? 'ubah radius, ' : ''}${alternatives}?`}`;
  }
  return null;
}
