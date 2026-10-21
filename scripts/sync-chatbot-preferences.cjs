// Idempotent backfill for existing AG108 chatbot clients. No messages are sent.
require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const { PrismaClient } = require('@prisma/client');
const { syncClientPreferences } = require('../src/lib/chatbot/client-preferences.ts');
const { isBuyerCriteria } = require('../src/lib/chatbot/property-knowledge.ts');
const prisma = new PrismaClient();
(async () => {
  const clients = await prisma.klien.findMany({ where: { id_agent: 'AG108', chatbot_terakhir_pada: { not: null }, chatbot_preferensi_meta: { equals: require('@prisma/client').Prisma.DbNull } }, select: { id_klien: true } });
  let synced = 0, skipped = 0;
  for (const { id_klien } of clients) await prisma.$transaction(async (tx) => {
    const row = await tx.klien.findUniqueOrThrow({ where: { id_klien } });
    if (!isBuyerCriteria(row.chatbot_kriteria)) { skipped++; return; }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chatbot-klien:AG108:${row.chatbot_nomor_whatsapp}`}))`;
    await syncClientPreferences(tx, id_klien, row.chatbot_kriteria, row.chatbot_preferensi_meta);
    synced++;
  }, { timeout: 15000 });
  console.log(JSON.stringify({ synced, skipped }));
})().catch((error) => { console.error(JSON.stringify({ code: error.code || error.name })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
