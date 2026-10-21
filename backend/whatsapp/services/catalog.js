import { readFile } from 'node:fs/promises';
import { normalizeText } from '../lib/security.js';
import { needsAuctionCheck } from './auction_check.js';
import { auctionCostEstimate } from './property_costs.js';

const moneyFields = ['limit_price', 'market_estimate', 'deposit', 'additional_cost_estimate'];
const dateFields = ['registration_closes_at', 'deposit_due_at', 'auction_at', 'verified_at',
  'availability_verified_at', 'availability_valid_until'];
const contextFields = ['id', 'name', 'is_demo', 'origin', ...moneyFields, ...dateFields,
  'market_source', 'cost_notes', 'settlement_terms', 'legal_notes', 'location', 'official_url',
  'availability_source', 'availability_status', 'source', 'retrieved_at', 'updated_at',
  'transaction_type', 'jenis_transaksi', 'category', 'asking_price', 'price_display', 'price_label',
  'address', 'full_address', 'detail_url', 'specifications', 'nearby', 'rental', 'publication'];
const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

export function validateAssets(assets, { production = false } = {}) {
  if (!Array.isArray(assets) || assets.length > 1000) throw new Error('Katalog aset harus array, maksimal 1000 aset.');
  const ids = new Set();
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object' || !/^[A-Z0-9-]{3,40}$/.test(asset.id) ||
        typeof asset.name !== 'string' || !asset.name.trim() || ids.has(asset.id)) {
      throw new Error('Setiap aset memerlukan kode unik huruf kapital/angka dan nama.');
    }
    ids.add(asset.id);
    if (production && asset.is_demo) throw new Error('Aset simulasi tidak boleh digunakan di production.');
    for (const field of moneyFields) {
      if (asset[field] != null && (!Number.isSafeInteger(asset[field]) || asset[field] < 0 || asset[field] > 1e15)) {
        throw new Error(`Nilai ${field} aset ${asset.id} tidak valid.`);
      }
    }
    if (!(asset.limit_price > 0)) throw new Error(`Harga limit ${asset.id} wajib positif.`);
    if (asset.market_estimate != null && (!(asset.market_estimate > 0) || !asset.market_source || !asset.verified_at)) {
      throw new Error(`Estimasi pasar ${asset.id} wajib memiliki sumber dan waktu verifikasi.`);
    }
    for (const field of dateFields) {
      if (asset[field] != null && (typeof asset[field] !== 'string' ||
          !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(asset[field]) || !Number.isFinite(Date.parse(asset[field])))) {
        throw new Error(`Tanggal ${field} aset ${asset.id} harus ISO 8601 dengan zona waktu.`);
      }
    }
    for (const field of ['market_source', 'cost_notes', 'settlement_terms', 'legal_notes', 'location', 'availability_source']) {
      if (asset[field] != null && (typeof asset[field] !== 'string' || asset[field].length > 2000)) {
        throw new Error(`Teks ${field} aset ${asset.id} tidak valid.`);
      }
    }
    if (asset.origin != null && !['bank', 'state', 'private', 'unknown'].includes(asset.origin)) {
      throw new Error(`Asal aset ${asset.id} tidak valid.`);
    }
    if (asset.availability_status != null && !['available', 'scheduled', 'sold', 'withdrawn', 'unknown'].includes(asset.availability_status)) {
      throw new Error(`Status ketersediaan ${asset.id} tidak valid.`);
    }
    if (asset.availability_status && asset.availability_status !== 'unknown' &&
        (!asset.availability_source?.trim() || !asset.availability_verified_at || !asset.availability_valid_until ||
        Date.parse(asset.availability_valid_until) <= Date.parse(asset.availability_verified_at))) {
      throw new Error(`Status aset ${asset.id} memerlukan sumber, waktu verifikasi, dan batas validitas.`);
    }
    if (asset.official_url != null) {
      const url = new URL(asset.official_url);
      if (url.protocol !== 'https:' || url.username || url.password ||
          (!['lelang.go.id', 'www.lelang.go.id'].includes(url.hostname) &&
          !url.hostname.endsWith('.kemenkeu.go.id'))) {
        throw new Error(`official_url ${asset.id} harus tautan HTTPS lelang.go.id atau Kemenkeu.`);
      }
    }
  }
  return assets;
}

export async function loadCatalog(config) {
  const assets = validateAssets(JSON.parse(await readFile(config.assetsFile, 'utf8')), config);
  if (config.defaultAssetId && !assets.some((asset) => asset.id === config.defaultAssetId)) {
    throw new Error('DEFAULT_ASSET_ID tidak ditemukan dalam katalog.');
  }
  return new Catalog(assets);
}

export class Catalog {
  constructor(assets = []) { this.assets = assets; }
  get(id) { return this.assets.find((asset) => asset.id === id) || null; }
  select(text, previousId) {
    const normalized = ` ${normalizeText(text)} `;
    const matches = this.assets.filter((asset) => normalized.includes(` ${normalizeText(asset.id)} `));
    // Penyebutan beberapa aset harus diklarifikasi, bukan digabungkan angkanya.
    return matches.length === 1 ? matches[0] : matches.length > 1 ? null : this.get(previousId);
  }
  list() { return this.assets.filter((asset) => !['sold', 'withdrawn'].includes(asset.availability_status)).map(({ id, name }) => ({ id, name })); }
}

// The database floor count is a template default, not a verified specification.
// Also strip it from older API responses and operator catalogs without mutation.
export function withoutFloorCount(asset) {
  if (!asset?.specifications) return asset;
  return { ...asset, specifications: Object.fromEntries(Object.entries(asset.specifications)
    .filter(([key]) => !['floors', 'jumlah_lantai'].includes(key))) };
}

export function assetFacts(asset, now = Date.now()) {
  if (!asset) return null;
  asset = withoutFloorCount(asset);
  const grossSpread = asset.market_estimate == null || !(asset.limit_price > 0) ? null : asset.market_estimate - asset.limit_price;
  const costBasis = asset.additional_cost_estimate == null || !(asset.limit_price > 0) ? null : asset.limit_price + asset.additional_cost_estimate;
  const netEstimate = costBasis == null || grossSpread == null ? null : asset.market_estimate - costBasis;
  const deadline = (iso) => iso == null ? null : {
    at: iso,
    local: new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short',
    }).format(new Date(iso)) + ' WIB',
    remaining_hours: Math.max(0, Math.floor((Date.parse(iso) - now) / 3600000)),
    closed: Date.parse(iso) <= now,
  };
  const verifiedAvailability = !!asset.availability_source && !!asset.availability_verified_at &&
    Date.parse(asset.availability_verified_at) <= now && Date.parse(asset.availability_valid_until) > now;
  const available = verifiedAvailability && ['available', 'scheduled'].includes(asset.availability_status) &&
    (!asset.auction_at || Date.parse(asset.auction_at) > now);
  return {
    ...Object.fromEntries(contextFields.filter((key) => asset[key] !== undefined).map((key) => [key, asset[key]])),
    auction_check_required: needsAuctionCheck(asset, now),
    purchase_cost_estimate: auctionCostEstimate(asset),
    availability: {
      status: verifiedAvailability ? asset.availability_status || 'unknown' : 'unknown',
      confirmed_available: available && !asset.is_demo,
      ready_for_auction: available && !asset.is_demo && Date.parse(asset.auction_at) > now &&
        (!asset.registration_closes_at || Date.parse(asset.registration_closes_at) > now),
      source: asset.availability_source || null,
      verified_at: asset.availability_verified_at || null,
      valid_until: asset.availability_valid_until || null,
    },
    calculation: {
      assumption: 'Skenario menang tepat di harga limit; harga akhir dapat lebih tinggi.',
      limit_display: asset.limit_price > 0 ? rupiah(asset.limit_price) : null,
      market_display: asset.market_estimate == null ? null : rupiah(asset.market_estimate),
      gross_spread: grossSpread,
      gross_spread_display: grossSpread == null ? null : rupiah(grossSpread),
      gross_roi_percent: grossSpread == null ? null : Number((grossSpread / asset.limit_price * 100).toFixed(2)),
      additional_cost_estimate: asset.additional_cost_estimate ?? null,
      cost_basis: costBasis,
      net_estimate: netEstimate,
      net_roi_percent: netEstimate == null ? null : Number((netEstimate / costBasis * 100).toFixed(2)),
      note: 'Uang jaminan adalah bagian pembayaran harga lelang, bukan biaya tambahan. ROI bukan annualized dan bukan jaminan keuntungan.',
    },
    registration_deadline: deadline(asset.registration_closes_at),
    deposit_deadline: deadline(asset.deposit_due_at),
  };
}
