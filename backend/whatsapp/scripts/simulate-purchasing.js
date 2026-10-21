// Run: npm run simulate:purchasing (from backend/whatsapp).
// Uses the actual DOCX/PDF renderer and message processor; all transport and
// stock verdicts are mocks. No customer data, uploads, transfers or outbound WA.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { renderMouDraft } from '../../../src/lib/server/chatbotMouDraft.mjs';
import { docxToPdf } from '../../../src/lib/server/docxToPdf.ts';
import { purchaseRuntime } from './lib/purchase-intake-dialogues.js';
import { PACARKEMBANG_ASSETS } from './lib/purchase-interest-dialogues.js';

const document = await renderMouDraft(PACARKEMBANG_ASSETS[3], {
  convertDocx: buffer => docxToPdf(buffer, 'simulate-purchasing'),
});
const pdf = '/private/tmp/Simulasi_Interest_Purchasing_MOU_121037.pdf';
await writeFile(pdf, document.buffer, { mode: 0o600 });
const scenarios = [
  { name: 'Aset terkonfirmasi: minat → PDF → berkas siap → pendamping', verdict: 'available',
    messages: ['oke saya tertarik', 'KTP dan cover buku tabungan sudah siap, saya mau lanjut'] },
  { name: 'Stok menunggu: minat → PDF → pertanyaan MOU → pendamping persiapan',
    messages: ['oke pak saya serius', 'boleh pak', 'MOU ini mengatur apa saja?', 'KTP dan cover buku tabungan sudah siap, saya mau lanjut'] },
  { name: 'Cover tabungan belum ada: bantu persiapan tanpa menganggap lengkap',
    messages: ['saya tertarik', 'KTP sudah siap tapi cover buku tabungan belum', 'boleh'] },
  { name: 'Pertanyaan refund: jawab keberatan → kembali ke persiapan pembelian',
    messages: ['wow saya tertarik pak', 'kalau kalah uang tanda jadi balik tidak?', 'dokumennya sudah siap pak'] },
  { name: 'Klien mengaku membayar: pemeriksaan tim, tanpa klaim dana diterima',
    messages: ['saya serius', 'saya sudah bayar tanda jadi'] },
];
const results = [];
for (const scenario of scenarios) {
  const f = purchaseRuntime({ buffer: document.buffer, verdict: scenario.verdict });
  try {
    await f.prepare(); const start = f.transcript.length;
    for (const text of scenario.messages) await f.send(text);
    const s = f.session();
    assert.deepEqual(f.errors, []);
    assert.equal(s.conversion.phase, 'purchasing_handoff'); assert.equal(s.is_bot_active, false);
    assert.equal(s.lead_status, 'hot'); assert.equal(s.conversion.asset_id, '121037');
    assert.equal(s.conversion.purchase_intake.documents_verified, false);
    assert.equal(s.conversion.purchase_intake.payment_verified, false);
    assert.equal(f.sent.filter(r => r.type === 'pdf').length, 1);
    assert.equal(f.catalog.calls.filter(r => r.criteria).length, 1);
    results.push({ name: scenario.name, passed: true, transcript: f.transcript.slice(start),
      final: { asset: s.asset_id, phase: s.conversion.phase, lead_status: s.lead_status,
        stock: s.conversion.stock_status, bot_active: s.is_bot_active, ...s.conversion.purchase_intake } });
  } finally { f.close(); }
}
const report = '/private/tmp/kosku-interest-to-purchasing.json';
await writeFile(report, JSON.stringify({ scope: 'Local simulation with a real PDF, mocked WhatsApp and stock, no actual sale/payment.',
  pdf, pages: (await PDFDocument.load(document.buffer)).getPageCount(), scenarios: results }, null, 2), { mode: 0o600 });
const transcript = fileURLToPath(new URL('../docs/simulasi-interest-ke-purchasing.md', import.meta.url));
await writeFile(transcript, [
  '# Simulasi interest ke purchasing', '',
  'Simulasi lokal menjalankan MessageProcessor, state machine, dan generator PDF dari template MOU yang disetujui. Katalog, hasil stok, dan WhatsApp tiruan. Tidak ada pengiriman pesan nyata, KTP asli, pembayaran, atau transaksi. LLM tidak dipanggil; respons canonical menjadi acuan saat provider gagal maupun tidak aktif.', '',
  'Aset contoh kode 121037, Pacarkembang, Tambaksari, Surabaya. Limit Rp350 juta; tanda jadi Rp20 juta; jaminan lelang Rp100 juta. Tanggal lelang sudah lewat. Hanya skenario pertama memakai konfirmasi tersedia dari operator tiruan. Tanda jadi terpisah dari uang jaminan lelang.', '',
  `[PDF yang benar-benar dihasilkan](${pdf}) · [Laporan JSON](${report})`, '',
  ...results.flatMap(result => [
    `## ${result.name}`, '',
    ...result.transcript.flatMap(turn => [`**Klien:** ${turn.client}`, '', ...turn.replies.flatMap(reply => reply.type === 'pdf'
      ? [`**Lampiran:** ${reply.filename} (${reply.bytes} byte)`, '', reply.caption, '']
      : [`**Bot:** ${reply.text}`, ''])]),
    `Hasil: aset ${result.final.asset}; lead ${result.final.lead_status}; fase ${result.final.phase}; stok ${result.final.stock}. Bot dijeda untuk pendamping. Berkas dan pembayaran belum dinyatakan terverifikasi.`, '',
  ]),
  '## Tindak lanjut operasional', '',
  'Minat memulai persiapan, bukan menandatangani perjanjian atau membuktikan pembayaran. Saat klien siap, sesi masuk antrean percakapan yang ditangani tim; tidak ada pesan terpisah yang dikirim ke agen. Tim memeriksa KTP/cover, melengkapi MOU, mengonfirmasi stok dan instruksi pembayaran. Lampiran masuk tidak diunduh atau dibaca LLM. Tanda jadi dibayar setelah kepastian aset dan persetujuan MOU; jaminan lelang mengikuti VA resmi kepesertaan, terpisah dari rekening perusahaan.', '',
].join('\n'));
console.log(JSON.stringify({ passed: results.length, total: scenarios.length, pdf, transcript, report }));
