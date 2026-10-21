import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notificationFollowupFixture } from './lib/notification-followup-fixture.js';

const f = await notificationFollowupFixture();
try {
  for (const text of ['yang nomor 3', 'ada yang lain?', 'nomor 3', 'ada yang lain?']) await f.send(text);
  const content = '# Simulasi lanjutan rekomendasi otomatis\n\nDijalankan melalui worker dan MessageProcessor produksi. Seluruh nama aset, harga, nomor, dan URL adalah fixture; transport WhatsApp dan database diganti mock. Tidak ada pesan dikirim ke klien nyata.\n\nKriteria CRM: Tanah lelang di Surabaya, budget maksimal Rp 1 miliar, luas tanah minimal 100 m².\n\n' +
    f.transcript.map(turn => `## ${turn.speaker}\n\n${turn.text}`).join('\n\n') + '\n';
  const destination = resolve(process.argv[2] || 'docs/simulasi-rekomendasi-otomatis.md');
  writeFileSync(destination, content);
  console.log(JSON.stringify({ transcript: destination, offers: 4, turns: f.transcript.length, property_queries: f.queries.length, errors: f.errors.length, real_messages_sent: 0 }));
  if (f.errors.length) process.exitCode = 1;
} finally { await f.close(); }
