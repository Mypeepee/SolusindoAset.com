// Local preview only: original DOCX + user's sample property, no DB/LLM/WhatsApp.
// Run from the repository root: node --experimental-strip-types scripts/preview-chatbot-mou.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { renderMouDraft } from '../src/lib/server/chatbotMouDraft.mjs';
import { docxToPdf } from '../src/lib/server/docxToPdf.ts';
import { PACARKEMBANG_ASSETS } from '../backend/whatsapp/scripts/lib/purchase-interest-dialogues.js';

const example100m = process.argv.includes('--example=100juta');
const exampleSemarang = process.argv.includes('--example=semarang');
const pacarkembang = { ...PACARKEMBANG_ASSETS[3], address: { ...PACARKEMBANG_ASSETS[3].address, province: 'Jawa Timur' } };
const assetFile = process.argv.find((arg) => arg.startsWith('--asset-file='))?.slice('--asset-file='.length);
const asset = assetFile ? JSON.parse(await readFile(assetFile, 'utf8')) : exampleSemarang ? { id: '121790', transaction_type: 'LELANG', category: 'GUDANG',
  full_address: 'Jl. Kedungmundu Raya No. 173, Kelurahan Sendangguwo, Kecamatan Tembalang, Kota Semarang, Provinsi Jawa Tengah',
  address: { province: 'Jawa Tengah', city: 'Kota Semarang', district: 'Tembalang', village: 'Sendangguwo' },
  // Public listing checked 20 October 2026; this snapshot does not verify auction availability.
  limit_price: 3043000000, deposit: 610000000, auction_at: '2026-06-18T00:00:00+07:00',
  specifications: { land_area_m2: 306, certificate_type: 'SHM' }, publication: { status: 'TERSEDIA' },
  detail_url: 'https://solusindoaset.com/Lelang/gudang-kedungmundu-raya-173-sendangguwo-tembalang-kota-semarang-124941-121790',
} : example100m ? { ...pacarkembang, id: '900100',
  full_address: '[ALAMAT OBJEK LELANG - CONTOH SIMULASI]', limit_price: 100000000, deposit: 10000000,
  auction_at: null, specifications: { certificate_type: '[DIKONFIRMASI TIM]' } } : pacarkembang;
const result = await renderMouDraft(asset, { convertDocx: (buffer) => docxToPdf(buffer, 'preview-chatbot-mou') });
const path = join(tmpdir(), result.filename);
await writeFile(path, result.buffer, { mode: 0o600 });
console.log(JSON.stringify({ path, bytes: result.buffer.length, pages: (await PDFDocument.load(result.buffer)).getPageCount(),
  scope: assetFile ? 'Snapshot of public listing data; no stock verification, transaction, or outbound message.'
    : 'Public-property example fixture; no stock verification, transaction, or outbound message.' }));
