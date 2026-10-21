// Real local integration check. No WhatsApp messages or permanent CRM writes.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'), false);
const { PrismaClient } = require('@prisma/client');
const { encode } = require('next-auth/jwt');
const db = new PrismaClient();
const origin = new URL(process.env.CHATBOT_CHECK_ORIGIN || 'http://127.0.0.1:3000').origin;

async function main() {
  const health = await fetch('http://127.0.0.1:3100/health', { signal: AbortSignal.timeout(5000) });
  assert.equal(health.status, 200);
  const healthData = await health.json();
  assert.equal(healthData.ok, true);
  const owner = await db.agent.findFirst({
    where: { jabatan: 'OWNER', status_keanggotaan: 'AKTIF', pengguna: { peran: 'AGENT', status_akun: 'AKTIF' } },
    select: { id_agent: true, id_pengguna: true },
  });
  assert.ok(owner, 'An active Owner is required.');
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 300,
    token: { id: owner.id_pengguna, sub: owner.id_pengguna, agentId: owner.id_agent,
      jabatan: 'OWNER', peran: 'AGENT', role: 'AGENT', _refreshedAt: 0 } });
  const headers = { cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`,
    origin, 'Content-Type': 'application/json' };
  const request = async (pathname, body) => {
    const response = await fetch(origin + pathname, { method: body ? 'POST' : 'GET', headers,
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(115000) });
    const data = await response.json();
    assert.equal(response.status, 200, `${pathname}: ${data.error || response.status}`);
    return data;
  };
  const session = await request('/api/auth/session');
  assert.equal(session.user.id, owner.id_pengguna);
  await request('/api/dashboard/chatbot/whatsapp');
  // Invalid input checks pairing permissions without requesting a real code.
  const pairing = await fetch(origin + '/api/dashboard/chatbot/whatsapp', {
    method: 'POST', headers, body: JSON.stringify({ action: 'pairing_code', phone: 'invalid' }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(pairing.status, 400, 'Owner pairing requests must reach phone validation, including behind the tunnel.');
  assert.equal((await pairing.json()).error, 'INVALID_PHONE');
  if (process.argv.includes('--pairing-only')) {
    const view = await request('/api/dashboard/chatbot/whatsapp?view=pairing');
    console.log(JSON.stringify({ check: 'live_pairing_permissions', passed: true, origin,
      owner_session: true, pairing_permissions: true, qr_available: !!view.qr,
      operator_whatsapp_connected: healthData.whatsapp_connected, real_whatsapp_messages_sent: 0 }));
    return;
  }
  const context = await request('/api/dashboard/chatbot/playground');
  assert.ok(context.property?.id, 'Playground must read a real public listing.');
  const conversationId = randomUUID();
  const text = `Kode ${context.property.id}, berapa harga dan luas tanahnya?`;
  const first = await request('/api/dashboard/chatbot/playground', {
    conversationId, requestId: randomUUID(), history: [{ role: 'user', content: text }],
  });
  assert.ok(typeof first.reply === 'string' && first.reply.length > 20, 'Expected a property reply.');
  const question = 'Apa saja yang perlu saya perhatikan sebelum ikut lelang properti tersebut?';
  const second = await request('/api/dashboard/chatbot/playground', {
    conversationId, requestId: randomUUID(), previousId: context.property.id,
    history: [{ role: 'user', content: text }, { role: 'assistant', content: first.reply }, { role: 'user', content: question }],
  });
  assert.ok(typeof second.reply === 'string' && second.reply.length > 20, 'Expected a consultation reply.');
  console.log(JSON.stringify({ check: 'live_dashboard_chatbot', passed: true, backend_healthy: true,
    owner_session: true, pairing_permissions: true, real_property: true, property_reply: true, consultation_reply: true,
    generation: second.generation || null, operator_whatsapp_connected: healthData.whatsapp_connected,
    real_whatsapp_messages_sent: 0 }));
}
main().catch((error) => {
  console.error(JSON.stringify({ check: 'live_dashboard_chatbot', passed: false, error: error.message }));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
