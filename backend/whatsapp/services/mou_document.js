import { ServiceError } from '../lib/http.js';
import { CLOSING_STATE, requestsClosingExit, requestsMouDocument } from './closing_state.js';
export { requestsMouDocument } from './closing_state.js';

export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MOU_CAPTION = 'Saya lampirkan draf MOU aset pilihan Anda. Mulai dari Pasal 3 untuk biaya pendampingan, Pasal 4 untuk tanda jadi dan jaminan lelang, Pasal 9 untuk pembatalan, lalu Pasal 11 untuk pengembalian dana jika kalah. Data yang belum lengkap ditandai di dokumen; ketentuannya bisa dibahas bersama tim sebelum disetujui.';

export function shouldSendMouDocument({ asset, conversion, history = [], text = '', selectedAssetId = null }) {
  if (!asset || conversion?.mode !== CLOSING_STATE || conversion.asset_id !== asset.id ||
      conversion.stock_status === 'sold' || conversion.outcome || requestsClosingExit(text) ||
      /\b(?:jangan|tidak|gak|nggak|belum)\b/i.test(text)) return false;
  const requested = requestsMouDocument(text);
  if (conversion.draft_document?.asset_id === asset.id && !requested) return false;
  // This is a reading copy, not the signing/handoff state. Explicit requests
  // also support bounded history after a client has already entered closing.
  const informed = selectedAssetId === asset.id || history.some((m) => m.role === 'assistant' &&
    /DETAIL ASET|ESTIMASI BIAYA PEMBELIAN LELANG/.test(m.content) &&
    (m.content.includes(`Kode ${asset.id}`) || asset.detail_url && m.content.includes(asset.detail_url)));
  return requested || informed && ['stock', 'dp', 'purchase_preparation'].includes(conversion.topic);
}

export function validatePdf(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length < 5 || file.buffer.length > MAX_PDF_BYTES ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-' || !/^Draf_MOU_Aset_[1-9]\d{0,17}\.pdf$/.test(file.filename) ||
      file.mimeType !== 'application/pdf') throw new ServiceError('INVALID_PDF_DOCUMENT', 502);
  return file;
}

export class MouDocumentClient {
  constructor(config, { fetchImpl = fetch } = {}) { Object.assign(this, { config, fetchImpl }); }
  async generate(assetId, maxBid = null, { signal } = {}) {
    if (!/^[1-9]\d{0,17}$/.test(assetId) || maxBid != null && (!Number.isSafeInteger(maxBid) || maxBid <= 0 || maxBid > 1e15)) throw new ServiceError('INVALID_MOU_REQUEST', 400);
    const response = await this.fetchImpl(this.config.url, { method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, maxBid }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]) : AbortSignal.timeout(this.config.timeoutMs) });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/pdf' ||
        response.headers.get('x-mou-asset-id') !== assetId) {
      await response.body?.cancel(); throw new ServiceError('MOU_PDF_UNAVAILABLE', 503);
    }
    const chunks = []; let length = 0;
    if (!response.body) throw new ServiceError('INVALID_PDF_DOCUMENT', 502);
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_PDF_BYTES) throw new ServiceError('PDF_TOO_LARGE', 502);
      chunks.push(chunk);
    }
    return validatePdf({ buffer: Buffer.concat(chunks), filename: `Draf_MOU_Aset_${assetId}.pdf`, mimeType: 'application/pdf', assetId });
  }
}
