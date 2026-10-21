import { normalizeText } from '../lib/security.js';
import { hasDetailLink } from './recommendations.js';
import { hitungBiayaLelang, formatPersen } from './auction_cost_policy.js';

// Website, PDFs and chatbot share this service's business cost policy.
const money = (value) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`;
// Prisma Decimal prices reach the public API as numbers and may include sen
// (e.g. 417128521.13). Preserve those cents for percentages; display and sum
// rounded rupiah amounts so every visible line reconciles with its subtotal.
const validPrice = (value) => Number.isFinite(value) && Math.round(value) > 0 && value <= 1e15;
const compactMoney = (value) => value >= 1e9 ? `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value / 1e9)} M`
  : value >= 1e6 ? `Rp ${Math.round(value / 1e6)} Jt` : money(value);
const plain = (value, max = 500) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const GARIS = '━━━━━━━━━━━━━━';

export function isPurchaseCostQuestion(text) {
  const value = normalizeText(text);
  return /\b(?:biaya(?:nya)?|break\s*down|rincian(?:nya)?|all\s*in|pajak(?:nya)?|b[ph]{2}tb|bphtb|ppn|ajb|bea\s+lelang|balik\s+nama|roya|kerohiman|fee|notaris|ppat|provisi)\b/.test(value) ||
    /\b(?:siap(?:kan)?\s+dana|nambah\s+(?:berapa|brp|piro)|(?:keluar|habis|entek)\s+(?:berapa|brp|piro)|total\s+duit)\b/.test(value) ||
    /\bmodal(?:nya)?\b|\btotal(?:nya)?\s+(?:harga|dana|pembelian|keseluruhan)\b|\b(?:harga|dana)\s+total(?:nya)?\b|\b(?:berapa|brp)\s+total(?:nya)?$|^total(?:nya)?\s*(?:berapa|brp)?$/.test(value) ||
    /\b(?:sudah|udah|sudh|sdh|belum|apakah|apa|harga|limit)\b.*\b(?:termasuk|include|mencakup|bersih)\b/.test(value);
}

// Only call with a freshly resolved catalog asset. Metadata takes precedence
// over its public route; user text, historical prices and limit_price alone
// cannot establish an auction transaction.
export function propertyTransactionType(asset) {
  const metadata = asset?.transaction_type ?? asset?.jenis_transaksi;
  if (metadata != null && metadata !== '') {
    const type = String(metadata).trim().toUpperCase();
    return ['LELANG', 'PRIMARY', 'SECONDARY', 'JUAL', 'SEWA'].includes(type) ? type : null;
  }
  try {
    const url = new URL(asset?.detail_url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const route = /^\/(Lelang|Jual|Secondary|Primary|Sewa)\//i.exec(url.pathname)?.[1];
    return route?.toUpperCase() || null;
  } catch { return null; }
}

export function auctionCostEstimate(asset) {
  if (propertyTransactionType(asset) !== 'LELANG' || !validPrice(asset?.limit_price)) return null;
  const costs = hitungBiayaLelang({ limit: asset.limit_price, provinsi: asset.address?.province,
    luasTanah: asset.specifications?.land_area_m2, luasBangunan: asset.specifications?.building_area_m2 });
  const items = (block) => block.komponen.filter((row) => !row.tentatif).map((row) => ({
    label: row.labelPesan || `${row.label}${row.persen ? ` ${formatPersen(row.persen)}` : ''}`, amount: row.nominal }));
  return { assumption: 'Estimasi eksekusi worst case; harga menang diasumsikan sama dengan harga limit.',
    limit: costs.limit, transfer: items(costs.balikNama), transfer_total: costs.balikNama.subtotal,
    execution: items(costs.eksekusi), execution_total: costs.eksekusi.subtotal, agent: costs.feeAgent.subtotal,
    total_execution: costs.totalModal,
    excludes: 'Tempat perpindahan barang serta pajak dan biaya lain di luar daftar. Uang jaminan bagian dari harga, tidak ditambahkan lagi.' };
}

function auctionReply(asset, estimate, now) {
  const location = plain(asset.address?.city || asset.location, 160) || 'lokasi yang perlu dikonfirmasi';
  const address = plain(asset.full_address || asset.address?.street || asset.location) || 'Alamat lengkap belum tercatat; perlu dikonfirmasi.';
  const area = asset.specifications?.land_area_m2;
  const land = `1 bidang tanah${Number.isFinite(area) && area > 0 ? ` dengan total luas ${new Intl.NumberFormat('id-ID').format(area)} m²` : ''}`;
  const landOnly = asset.specifications?.has_building === false || (asset.category === 'TANAH' && asset.specifications?.has_building !== true);
  const description = landOnly ? land : asset.specifications?.has_building === true || ['RUMAH', 'RUKO', 'GUDANG', 'KOS', 'TOKO', 'PABRIK'].includes(asset.category)
    ? `${land} berikut bangunan` : plain(asset.name, 160) || 'Properti';
  const date = Date.parse(asset.auction_at);
  const rows = (values) => values.map(({ label, amount }) => `• ${label} — ${money(amount)}`);
  const lines = [
    'Terima kasih atas ketertarikan Bapak/Ibu. Memeriksa seluruh biaya sejak awal adalah langkah investor yang cerdas. Harga limit merupakan harga awal lelang, belum all-in: legalitas dan pengosongan perlu diperhitungkan secara terpisah.',
    '', '*ESTIMASI BIAYA PEMBELIAN LELANG*', `_${description} di ${location}_`, `📍 ${address}`,
  ];
  if (Number.isFinite(date)) lines.push(`🗓️ Lelang: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date)}${date <= now ? ' (jadwal tercatat sudah lewat; hasil atau jadwal ulang perlu konfirmasi)' : ''}`);
  lines.push('', GARIS, '*HARGA LIMIT*', `*${money(estimate.limit)}*`,
    '_Komponen persentase di bawah dihitung dari harga menang lelang; saat ini diestimasi dari harga limit._',
    '', GARIS, '*A. BIAYA BALIK NAMA*', '_Komponen persentase mengikuti harga menang lelang._',
    ...rows(estimate.transfer), `▸ *Subtotal: ${money(estimate.transfer_total)}*`,
    '', GARIS, '*B. PENYELESAIAN PENGOSONGAN*',
    '_Biaya pengosongan selalu menggunakan estimasi eksekusi pengadilan worst case._', ...rows(estimate.execution),
    '• Tempat perpindahan barang — _tentatif_', `▸ *Estimasi worst case: ${money(estimate.execution_total)}*`,
    '', GARIS, '*C. FEE AGENT*', '_Dihitung dari harga menang lelang._',
    `• Fee Agent 5% — ${money(estimate.agent)}`, `▸ *Subtotal: ${money(estimate.agent)}*`,
    '', GARIS, '*ESTIMASI MODAL — WORST CASE*', `*${money(estimate.total_execution)}*`,
    `_Limit ${compactMoney(estimate.limit)} + balik nama ${compactMoney(estimate.transfer_total)} + eksekusi ${compactMoney(estimate.execution_total)} + fee agent ${compactMoney(estimate.agent)}_`,
    '', '_Tempat perpindahan barang bersifat tentatif dan belum masuk total._',
    '_Angka di atas estimasi, belum termasuk pajak & biaya lain di luar daftar. Tarif dan kebutuhan pengosongan perlu dikonfirmasi sesuai aset._',
    '_Nominal dibulatkan ke rupiah. Uang jaminan bagian pembayaran harga, bukan biaya tambahan. Harga menang dapat melebihi limit._');
  if (hasDetailLink(asset)) lines.push('', '🔗 Detail aset:', asset.detail_url);
  lines.push('', 'Apakah Bapak/Ibu ingin saya jelaskan kondisi aset dan cara melihatnya dari luar?');
  if (asset.is_demo) lines.unshift('*SIMULASI — bukan penawaran nyata.*', '');
  return lines.join('\n');
}

// Operator budgeting assumptions, not statutory notary/PPAT tariffs. BPHTB
// here is a conservative reserve before the region's NPOPTKP/relief is known.
export function saleCostEstimate(asset) {
  if (!['PRIMARY', 'SECONDARY', 'JUAL'].includes(propertyTransactionType(asset)) || !validPrice(asset?.asking_price)) return null;
  const price = Math.round(asset.asking_price), bphtb = Math.round(asset.asking_price * 0.05), ajb = Math.round(asset.asking_price * 0.005);
  const notary_min = Math.round(asset.asking_price * 0.005), notary_max = Math.round(asset.asking_price * 0.01);
  return { price, bphtb, ajb, notary_min, notary_max, additional_min: bphtb + ajb + notary_min,
    additional_max: bphtb + ajb + notary_max, total_min: price + bphtb + ajb + notary_min, total_max: price + bphtb + ajb + notary_max };
}

export function purchaseCostReply(asset, text, { now = Date.now() } = {}) {
  if (!isPurchaseCostQuestion(text)) return null;
  if (!asset || ['sold', 'withdrawn'].includes(asset.availability_status) || ['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status)) {
    return 'Bapak/Ibu, mohon pilih satu properti dan kirim kode atau tautannya agar jenis transaksi serta harga terbaru dapat diverifikasi sebelum saya menyusun rincian biaya.';
  }
  const type = propertyTransactionType(asset);
  if (!type) return 'Bapak/Ibu, jenis transaksi properti ini belum dapat diverifikasi dari data aset. Rincian biaya perlu menunggu konfirmasi jenis transaksi oleh agen agar perhitungannya sesuai.';
  if (type === 'LELANG') {
    const estimate = auctionCostEstimate(asset);
    return estimate ? auctionReply(asset, estimate, now)
      : 'Bapak/Ibu, properti ini tercatat sebagai lelang, tetapi harga limit yang valid belum tersedia. Mohon konfirmasi harga limit terbaru kepada agen agar rincian biaya dapat dihitung dengan tepat.';
  }
  const price = validPrice(asset.asking_price) ? `*${money(asset.asking_price)}*` : 'yang masih perlu dikonfirmasi kepada agen';
  const rentalPeriod = plain(asset.rental?.period).toLowerCase();
  const period = ({ tahunan: 'tahun', bulanan: 'bulan', harian: 'hari', mingguan: 'minggu' })[rentalPeriod] || rentalPeriod;
  if (type === 'SEWA') return `Bapak/Ibu, properti ini ditawarkan untuk sewa dengan harga ${price}${period ? ` per ${period}` : ''}. Deposit, biaya layanan, dan utilitas mengikuti ketentuan pemilik dan perlu dikonfirmasi. Biaya pengurusan jual beli tidak saya tambahkan ke estimasi sewa.\n\nMau saya jelaskan kondisi aset dan cara mengajukan survei bersama agen?`;
  const estimate = saleCostEstimate(asset);
  if (!estimate) return 'Harga jual yang valid belum tercatat. Saya perlu harga terbaru dari listing atau konfirmasi agen sebelum menghitung biaya pembelian.';
  return `Baik Bapak/Ibu, untuk harga jual *${money(estimate.price)}*, berikut estimasi cadangan biaya pembeli:\n\n• Cadangan BPHTB 5%: ${money(estimate.bphtb)}.\n• Estimasi AJB 0,5%: ${money(estimate.ajb)}.\n• Estimasi notaris 0,5%–1%: ${money(estimate.notary_min)}–${money(estimate.notary_max)}.\n\nTambahan biaya sekitar *${money(estimate.additional_min)}–${money(estimate.additional_max)}*, sehingga estimasi dana termasuk harga properti menjadi *${money(estimate.total_min)}–${money(estimate.total_max)}*.\n\nBPHTB final dihitung dari dasar pajak setelah pengurang sesuai ketentuan daerah; cadangan di atas belum memperhitungkan NPOPTKP atau keringanan. AJB/notaris mengikuti rincian penawaran; bila sudah satu paket, komponen yang sama tidak ditambahkan dua kali.${type === 'PRIMARY' ? ' Untuk primary, perlu dicek juga apakah harga developer sudah mencakup PPN dan biaya pengurusan.' : ''}${/\b(?:kpr|kredit|bank)\b/i.test(text) ? ' Biaya bank/KPR di luar estimasi ini dan mengikuti penawaran bank.' : ''}\n\nMau saya jelaskan kondisi aset dan cara mengajukan survei bersama agen?`;
}
