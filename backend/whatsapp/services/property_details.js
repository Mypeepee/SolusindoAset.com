import { hasDetailLink } from './recommendations.js';
import { PROPERTY_CATEGORY_LABELS } from './property_category.js';
import { propertyTransactionType } from './property_costs.js';

const plain = (value, max = 120) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f*_~`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const positive = (value) => Number.isFinite(value) && value > 0;
const number = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const money = (value) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`;

export function requestsPropertyDetails(text) {
  if (!/\b(?:detail(?:nya)?|spesifikasi(?:nya)?|info(?:rmasi)?\s+lengkap|jelaskan\s+(?:aset|properti|unit))\b/i.test(text)) return false;
  // Only a generic request for the selected asset bypasses semantic handling.
  // E.g. "detail rumah tangga artis" must still reach the scope classifier.
  const remainder = text.toLowerCase().replace(/https?:\/\/\S+|\bkode\s*[:#-]?\s*\d+\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(?:halo|baik|boleh|bisa|tolong|mohon|saya|mau|ingin|tahu|mengetahui|minta|lihat|lihatkan|tampilkan|jelaskan|detail(?:nya)?|spesifikasi(?:nya)?|info(?:rmasi)?|lengkap|lebih|lagi|dulu|aset(?:nya)?|properti(?:nya)?|property|unit(?:nya)?|rumah(?:nya)?|yang|yg|ini|itu|tersebut|dipilih|sebelumnya|terhadap|tentang|mengenai|untuk|pak|bapak|bu|ibu|ya|dong|apa|apakah|ada)\b/g, ' ');
  return !remainder.trim();
}

// Only freshly resolved public catalog fields are rendered. A recommendation
// in chat identifies the asset; its old price/date/specifications are not facts.
export function propertyDetailsReply(asset, { now = Date.now(), includeIntroduction = true, includeSchedule = true, includeCta = true } = {}) {
  if (!asset || ['sold', 'withdrawn'].includes(asset.availability_status) || ['TERJUAL', 'TARIK_LISTING'].includes(asset.publication?.status)) return null;
  const type = propertyTransactionType(asset), auction = type === 'LELANG', rental = type === 'SEWA';
  const typeLabel = { LELANG: 'Lelang', PRIMARY: 'Primary', SECONDARY: 'Secondary', SEWA: 'Sewa', JUAL: 'Jual beli' }[type] || 'Perlu konfirmasi';
  const price = auction ? asset.limit_price : asset.asking_price;
  const priceLabel = auction ? 'Harga limit' : rental ? 'Harga sewa' : 'Harga penawaran';
  const specs = asset.specifications || {}, lines = [
    ...(includeIntroduction ? ['Baik Bapak/Ibu, berikut detail aset yang Bapak/Ibu pilih berdasarkan data listing terbaru.', ''] : []),
    `*DETAIL ASET — Kode ${plain(asset.id, 40)}*`,
    `📍 ${plain(asset.full_address || asset.address?.street || asset.location, 900) || 'Alamat lengkap belum tercatat; perlu konfirmasi.'}`,
    `• Jenis transaksi: ${typeLabel}`,
  ];
  if (PROPERTY_CATEGORY_LABELS[asset.category]) lines.push(`• Jenis properti: ${PROPERTY_CATEGORY_LABELS[asset.category]}`);
  lines.push('', `*${priceLabel}: ${positive(price) ? money(price) : 'belum tercatat; perlu konfirmasi'}*`);
  if (auction) {
    lines.push('_Harga limit adalah harga awal penawaran lelang, belum termasuk biaya pembelian. Harga menang dapat lebih tinggi._');
    if (positive(asset.deposit)) lines.push(`• Uang jaminan: ${money(asset.deposit)}`, '_Jaminan diperhitungkan sebagai bagian pembayaran harga lelang jika Bapak/Ibu menang, bukan biaya tambahan._');
  }
  lines.push('', '*SPESIFIKASI*',
    `• Luas tanah: ${positive(specs.land_area_m2) ? `${number(specs.land_area_m2)} m²` : 'belum tercatat'}`,
    `• Luas bangunan: ${positive(specs.building_area_m2) ? `${number(specs.building_area_m2)} m²` : 'belum tercatat'}`);
  for (const [label, value] of [['Kamar tidur', specs.bedrooms], ['Kamar mandi', specs.bathrooms]]) {
    if (Number.isFinite(value) && value >= 0) lines.push(`• ${label}: ${number(value)}`);
  }
  for (const [label, value] of [['Legalitas tercatat', specs.certificate_type], ['Sumber air', specs.water_source], ['Hadap bangunan', specs.facing], ['Kondisi interior', specs.interior]]) {
    if (plain(value)) lines.push(`• ${label}: ${plain(value)}`);
  }
  if (positive(specs.electricity_watts)) lines.push(`• Daya listrik: ${number(specs.electricity_watts)} watt`);
  if (auction && includeSchedule) {
    const date = Date.parse(asset.auction_at), expired = Number.isFinite(date) && date <= now;
    lines.push('', '*JADWAL DAN STATUS*', Number.isFinite(date)
      ? `• Lelang tercatat: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date)} WIB${expired ? ' (sudah lewat)' : ''}.`
      : '• Jadwal lelang belum tercatat; perlu konfirmasi.');
    if (asset.publication?.status === 'TERSEDIA') lines.push('• Status tayang: Tersedia di website.');
    lines.push(expired
      ? '_Jadwal tercatat sudah lewat. Hasil lelang maupun jadwal lelang ulang perlu dikonfirmasi tim; status tayang belum memastikan lelang masih terbuka._'
      : '_Ketersediaan aktual dan jadwal resmi perlu dikonfirmasi kepada tim._');
  }
  if (hasDetailLink(asset)) lines.push('', '🔗 Detail aset:', asset.detail_url);
  if (includeCta) lines.push('', 'Apakah Bapak/Ibu ingin mengetahui rincian biaya pembelian atau kondisi aset lebih lanjut?');
  return lines.join('\n');
}
