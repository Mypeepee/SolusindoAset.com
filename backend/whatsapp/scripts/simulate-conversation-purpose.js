import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { LEGAL_CONVERSATION, PROPERTY_OPENING, purposeFixture } from './lib/conversation-purpose-dialogues.js';
import { NON_BUYER_HANDOVER_MESSAGE } from '../services/conversation_purpose.js';

const output = resolve(process.argv.find(value => value.startsWith('--output='))?.slice(9) || join(tmpdir(), 'kosku-conversation-purpose-simulation'));
const reports = [];
for (const phase of ['Kontak baru', 'Setelah pembuka dari website', 'Sesi pencarian lama']) {
  const f = purposeFixture({ config: phase === 'Sesi pencarian lama' ? { requirePropertyInquiry: false } : {} });
  if (phase === 'Setelah pembuka dari website') await f.send(PROPERTY_OPENING);
  if (phase === 'Sesi pencarian lama') await f.send('Cari rumah lelang di Surabaya');
  const baseline = { transcript: f.transcript.length, sent: f.sent.length, reads: f.reads.length, ai: f.generated.length, captures: f.captures.length };
  for (const text of LEGAL_CONVERSATION) await f.send(text);
  assert.deepEqual(f.sent.slice(baseline.sent).map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.reads.length, baseline.reads); assert.equal(f.generated.length, baseline.ai); assert.equal(f.captures.length, baseline.captures);
  assert.equal(f.session().is_bot_active, false); assert.equal(f.session().pending_reply, null); assert.deepEqual(f.errors, []);
  reports.push({ name: phase, transcript: f.transcript.slice(baseline.transcript), automatic_replies: 1,
    catalog_reads: 0, lead_writes: 0, bot_active: false });
}
for (const text of ['Saya sudah membeli rumah ini, mau mengurus serah terima', 'Pak tolong kirim invoice pekerjaan kemarin', 'Bisa bicara langsung dengan Pak Jason?']) {
  const f = purposeFixture(); await f.send(text); await f.send('425 juta');
  assert.deepEqual(f.sent.map(item => item.text), [NON_BUYER_HANDOVER_MESSAGE]);
  assert.equal(f.reads.length, 0); assert.equal(f.captures.length, 0);
  reports.push({ name: text, transcript: f.transcript, automatic_replies: 1, catalog_reads: 0, lead_writes: 0, bot_active: false });
}
for (const text of ['Saya advokat, carikan rumah lelang di Surabaya', 'Saya mewakili klien kami mencari rumah di Surabaya', 'Saya sudah beli rumah, sekarang cari ruko baru di Surabaya']) {
  const f = purposeFixture(); await f.send(PROPERTY_OPENING); const before = f.transcript.length;
  const { replies } = await f.send(text);
  assert.ok(replies.length); assert.equal(f.session().is_bot_active, true);
  assert.ok(!replies.includes(NON_BUYER_HANDOVER_MESSAGE)); assert.deepEqual(f.errors, []);
  reports.push({ name: text, transcript: f.transcript.slice(before), bot_active: true });
}
await mkdir(output, { recursive: true });
const lines = ['# Simulasi tujuan percakapan WhatsApp', '',
  'Chat ARN diputar ulang melalui MessageProcessor. Katalog, penyimpanan klien, dan transport WhatsApp memakai fixture sintetis; tidak ada panggilan AI eksternal, database nyata, atau WhatsApp nyata.', ''];
for (const report of reports) {
  lines.push(`## ${report.name}`, '');
  for (const turn of report.transcript) {
    lines.push(`**Pengirim:** ${turn.user}`, '');
    for (const reply of turn.replies) lines.push(`**Bot:** ${reply}`, '');
    if (!turn.replies.length) lines.push('*Bot diam; percakapan sudah dialihkan ke Jason.*', '');
  }
  if (!report.bot_active) lines.push('Validasi: satu pemberitahuan, bot dijeda, tidak mencari katalog dan tidak menyimpan lead dari percakapan ini.', '');
}
await writeFile(join(output, 'transkrip.md'), lines.join('\n'));
await writeFile(join(output, 'hasil.json'), JSON.stringify({ real_whatsapp_sent: false, external_ai_called: false, real_database: false, passed: reports.length, scenarios: reports }, null, 2));
console.log(JSON.stringify({ passed: reports.length, real_whatsapp_sent: false, external_ai_called: false, real_database: false, output }));
