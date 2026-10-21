import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { closingDp, CANCELLATION_TERMS_SUMMARY } from '../../../backend/whatsapp/services/closing_state.js';
import { mouPaymentFields, formatMouAmount as formatted, terbilangDraft,
  MOU_COMMISSION_PERCENT, MOU_REFUND_DAYS, MOU_DRAFT_WATERMARK } from './mouPaymentTerms.mjs';
import { mouCostFields } from './mouCostFields.mjs';
export { terbilangDraft } from './mouPaymentTerms.mjs';

// Resolve as a server filesystem path. A static new URL("...docx", import.meta.url)
// could make the web bundler emit this private company template as a public asset.
const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), '../../app/dashboard/surat/components/templates/MOU_Template_persentase_final.docx');
const UNKNOWN = '[DIKONFIRMASI TIM]';
const amount = (n) => Number.isSafeInteger(n) && n > 0 && n <= 1e15 ? n : null;

/** @param {Record<string, any>} asset @param {{maxBid?: number|null}} options */
export function mouDraftFields(asset, { maxBid = null } = {}) {
  if (!asset || !/^[1-9]\d{0,17}$/.test(asset.id) || asset.transaction_type !== 'LELANG' ||
      !asset.full_address || asset.publication?.status !== 'TERSEDIA') throw new Error('MOU_ASSET_UNAVAILABLE');
  if (maxBid != null && amount(maxBid) == null) throw new Error('INVALID_MAX_BID');
  // Search budget is never copied into an authorized maximum bid. No client
  // identities, signatures, agreement numbers or payment instructions are invented.
  return {
    id_transaksi: `DRAF-ASET-${asset.id}`, hari: '[BELUM DITENTUKAN]', tanggal: '[BELUM DITENTUKAN]',
    nama_klien: '[NAMA KLIEN BELUM DILENGKAPI]', nik_klien: '[NIK BELUM DILENGKAPI]', alamat_klien: '[ALAMAT KLIEN BELUM DILENGKAPI]',
    alamat_lengkap: asset.full_address, legalitas: asset.specifications?.certificate_type || UNKNOWN,
    nomor_legalitas: UNKNOWN, luas_tanah: Number.isFinite(asset.specifications?.land_area_m2) && asset.specifications.land_area_m2 > 0
      ? asset.specifications.land_area_m2.toLocaleString('id-ID') : UNKNOWN,
    kantor_lelang: 'KPKNL [KANTOR DIKONFIRMASI TIM]', alamat_kantor_lelang: '[KANTOR DAN ALAMAT KPKNL DIKONFIRMASI TIM]',
    harga_limit: formatted(asset.limit_price), terbilang_harga_limit: terbilangDraft(asset.limit_price),
    maksimum_bidding: maxBid == null ? '[BELUM DITENTUKAN KLIEN]' : formatted(maxBid),
    terbilang_maksimum_bidding: maxBid == null ? '[BELUM DITENTUKAN KLIEN]' : terbilangDraft(maxBid),
    maksimum_bidding_display: maxBid == null ? '[BELUM DITENTUKAN KLIEN]'
      : `Rp ${formatted(maxBid)} (${terbilangDraft(maxBid)})`,
    ...mouPaymentFields(asset.limit_price), uang_jaminan: formatted(asset.deposit), terbilang_uang_jaminan: terbilangDraft(asset.deposit),
    ...mouCostFields({ limit: asset.limit_price, province: asset.address?.province,
      landArea: asset.specifications?.land_area_m2, buildingArea: asset.specifications?.building_area_m2 }),
  };
}

/** @param {Record<string, any>} asset @param {{maxBid?: number|null, templatePath?: string}} options */
export async function fillMouDraft(asset, options = {}) {
  const fields = mouDraftFields(asset, options), zip = new PizZip(await readFile(options.templatePath || TEMPLATE));
  let xml = zip.file('word/document.xml').asText();
  if (!xml.includes('KPKNL SURABAYA') || !xml.includes('{{uang_tanda_jadi}}') ||
      !xml.includes('{{ketentuan_baliknama}}') || !xml.includes('{{biaya_pengosongan}}')) throw new Error('MOU_TEMPLATE_CHANGED');
  xml = xml.replace('KPKNL SURABAYA', '{{kantor_lelang}}');
  let replacedOffice = false;
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const plain = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!plain.includes('KPKNL Surabaya, Jl. Indrapura')) return paragraph;
    replacedOffice = true;
    let first = true;
    return paragraph.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, (_, start, end) => {
      const text = first ? '{{alamat_kantor_lelang}}' : ''; first = false;
      return `${start}${text}${end}`;
    });
  });
  if (!replacedOffice) throw new Error('MOU_TEMPLATE_CHANGED');
  // Keep each fee/identity table row together so an amount and its terbilang
  // cannot be separated across pages by longer draft placeholders.
  xml = xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
    if (row.includes('<w:cantSplit')) return row;
    const fixed = row.replace(/<w:trPr\s*\/>/, '<w:trPr></w:trPr>');
    return /<w:trPr(?:\s[^>]*)?>/.test(fixed)
      ? fixed.replace(/(<w:trPr(?:\s[^>]*)?>)/, '$1<w:cantSplit/>')
      : fixed.replace(/^(<w:tr(?:\s[^>]*)?>)/, '$1<w:trPr><w:cantSplit/></w:trPr>');
  });
  zip.file('word/document.xml', xml);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true,
    delimiters: { start: '{{', end: '}}' }, nullGetter: () => UNKNOWN });
  doc.render(fields);
  return { fields, docx: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) };
}

/** @param {Record<string, any>} asset @param {{maxBid?: number|null, templatePath?: string, convertDocx?: (docx: Buffer) => Promise<Buffer>}} options */
export async function renderMouDraft(asset, { maxBid = null, convertDocx, templatePath } = {}) {
  if (typeof convertDocx !== 'function') throw new Error('MOU_CONVERTER_UNAVAILABLE');
  const { fields, docx } = await fillMouDraft(asset, { maxBid, templatePath });
  const source = await PDFDocument.load(await convertDocx(docx));
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cover = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const line = (text, size = 11, strong = false) => {
    const face = strong ? bold : font;
    // Greedy wrapping with font metrics keeps long public addresses on-page.
    const tokens = String(text).replace(/[^\x20-\x7e\u00a0-\u00ff]/g, ' ').split(/\s+/);
    let current = '';
    for (const token of tokens) {
      const next = current ? `${current} ${token}` : token;
      if (current && face.widthOfTextAtSize(next, size) > 485) {
        cover.drawText(current, { x: 55, y, size, font: face }); y -= size + 6; current = token;
      } else current = next;
    }
    if (current) { cover.drawText(current, { x: 55, y, size, font: face }); y -= size + 9; }
  };
  line('SOLUSINDO PREMIER', 18, true);
  line('DRAF MOU UNTUK DIPELAJARI', 16, true);
  line('Belum ditandatangani. Bukan instruksi pembayaran.', 11, true); y -= 12;
  line(`Kode aset: ${asset.id}`, 12, true);
  line(`Alamat: ${asset.full_address}`);
  line(`Harga limit: Rp ${fields.harga_limit}`);
  line(`Uang jaminan lelang: Rp ${fields.uang_jaminan}, disetor melalui VA resmi kepesertaan atas nama Anda.`);
  const auction = Date.parse(asset.auction_at);
  if (Number.isFinite(auction)) line(`Jadwal tercatat: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(auction)}; status dan jadwal resmi dikonfirmasi tim.`);
  line(`Luas tanah: ${fields.luas_tanah} m². Legalitas tercatat: ${fields.legalitas}.`);
  line(`Batas bidding: ${maxBid == null ? 'belum ditentukan klien' : `Rp ${fields.maksimum_bidding}`}.`); y -= 10;
  const dp = closingDp(asset.limit_price);
  line(`Uang tanda jadi (DP): ${dp == null ? 'dikonfirmasi tim' : `Rp ${formatted(dp)}`}, disetor kepada pihak perusahaan sesuai Pasal 4 dan 5. Pembayaran ini terpisah dari jaminan lelang.`);
  line('Status tayang website belum membuktikan stok atau jadwal lelang masih berlaku. Kepastian aset dan ketentuan pembayaran dikonfirmasi tim sebelum pembayaran.');
  line(`Komisi pendampingan: ${MOU_COMMISSION_PERCENT}% dari harga menang lelang. Biaya pengurusan balik nama: ${fields.ketentuan_baliknama}. Nominal akhirnya dihitung setelah harga menang diketahui.`);
  line(`Jika kalah lelang, uang tanda jadi ${dp == null ? 'sesuai nominal pada Pasal 4' : `Rp ${formatted(dp)}`} dikembalikan 100% tanpa potongan ke rekening atas nama Anda maksimal ${MOU_REFUND_DAYS} hari sejak pengumuman hasil lelang. Jaminan lelang dikembalikan melalui mekanisme penyelenggara.`);
  line(CANCELLATION_TERMS_SUMMARY);
  line('Identitas klien, nomor sertifikat, kantor KPKNL, biaya tambahan dan tanggal penandatanganan yang belum diketahui ditandai untuk dilengkapi.');
  line('Silakan pelajari halaman berikut, lalu sampaikan bagian yang ingin dibahas. Pengiriman draf ini belum merupakan persetujuan atau pemberian kuasa.');
  const pages = await pdf.copyPages(source, source.getPageIndices());
  for (const page of pages) pdf.addPage(page);
  for (const [index, page] of pdf.getPages().entries()) {
    const angle = 35 * Math.PI / 180, size = 30;
    const width = bold.widthOfTextAtSize(MOU_DRAFT_WATERMARK, size), height = bold.heightAtSize(size, { descender: false });
    page.drawText(MOU_DRAFT_WATERMARK, {
      x: page.getWidth() / 2 - width / 2 * Math.cos(angle) + height / 2 * Math.sin(angle),
      y: page.getHeight() / 2 - width / 2 * Math.sin(angle) - height / 2 * Math.cos(angle),
      font: bold, size, color: rgb(0.6, 0.2, 0.15), opacity: 0.16, rotate: degrees(35) });
    page.drawText(`DRAF ASET ${asset.id} | BELUM DITANDATANGANI | ${index + 1}/${pdf.getPageCount()}`, {
      x: 55, y: 18, size: 8, font, color: rgb(0.5, 0.2, 0.15) });
  }
  pdf.setTitle(`Draf MOU Aset ${asset.id}`); pdf.setAuthor('Solusindo Premier');
  return { buffer: Buffer.from(await pdf.save()), filename: `Draf_MOU_Aset_${asset.id}.pdf`, assetId: asset.id, mimeType: 'application/pdf' };
}
