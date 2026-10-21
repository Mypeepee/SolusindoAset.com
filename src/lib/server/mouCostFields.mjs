import { hitungBiayaLelang } from '../lelangBiaya.ts';
import { formatMouAmount, terbilangDraft, MOU_UNKNOWN_AMOUNT } from './mouPaymentTerms.mjs';

/**
 * Pasal 3 uses the website's cost policy, including the execution price band,
 * province and transport packages. Every figure is an estimate based on the
 * limit; an authorized max bid is not a winning price or a second price basis.
 * @param {{limit: number, province?: string|null, landArea?: number|null, buildingArea?: number|null}} input
 */
export function mouCostFields({ limit, province = null, landArea = null, buildingArea = null }) {
  const valid = Number.isSafeInteger(limit) && limit > 0 && limit <= 1e15;
  const costs = valid ? hitungBiayaLelang({ limit, provinsi: province,
    luasTanah: landArea, luasBangunan: buildingArea }) : null;
  // A missing province cannot silently become a non-Java-East execution quote.
  const executionKnown = Boolean(costs && typeof province === 'string' && province.trim());
  const component = (block, code) => block?.komponen.find((row) => row.kode === code)?.nominal;
  const fields = {
    estimasi_bea_lelang: component(costs?.balikNama, 'bea_lelang'),
    estimasi_bphtb: component(costs?.balikNama, 'bphtb'),
    estimasi_ppn_lelang: component(costs?.balikNama, 'ppn_lelang'),
    estimasi_roya_balik_nama: component(costs?.balikNama, 'roya_balik_nama'),
    biaya_baliknama: costs?.balikNama.subtotal,
    estimasi_eksekusi_pengosongan: executionKnown ? component(costs?.eksekusi, 'pengosongan') : null,
    estimasi_transportasi: component(costs?.eksekusi, 'armada'),
    estimasi_konsumsi: component(costs?.eksekusi, 'konsumsi'),
    estimasi_advokat_eksekusi: component(costs?.eksekusi, 'fee_advokat'),
    biaya_pengosongan: executionKnown ? costs?.eksekusi.subtotal : null,
    estimasi_fee_agent: costs?.feeAgent.subtotal,
    estimasi_modal_eksekusi: executionKnown ? costs?.totalModal : null,
  };
  return {
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, formatMouAmount(value)])),
    terbilang_baliknama: terbilangDraft(costs?.balikNama.subtotal),
    terbilang_biaya_pengosongan: terbilangDraft(executionKnown ? costs?.eksekusi.subtotal : null),
    label_transportasi: costs?.eksekusi.komponen.find((row) => row.kode === 'armada')?.labelPesan || 'Transportasi & tenaga angkut',
    keterangan_tempat_perpindahan: costs?.luasTempatPerpindahan
      ? `Tentatif; kebutuhan sekitar ${costs.luasTempatPerpindahan.toLocaleString('id-ID')} m², belum termasuk total`
      : 'Tentatif; belum termasuk total',
    keterangan_estimasi_eksekusi: executionKnown
      ? `Tarif pengosongan berdasarkan harga limit dan wilayah ${costs.wilayah === 'JATIM' ? 'Jawa Timur' : 'luar Jawa Timur'}.`
      : `Tarif pengosongan dan total worst case ${MOU_UNKNOWN_AMOUNT}; harga limit dan provinsi aset harus tersedia.`,
  };
}
