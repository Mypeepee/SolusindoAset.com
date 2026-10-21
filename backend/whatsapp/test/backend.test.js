import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { MemoryStore } from '../state/memory_store.js';
import { Catalog, assetFacts, validateAssets } from '../services/catalog.js';
import { MessageProcessor } from '../services/message_processor.js';
import { HANDOVER_MESSAGE, detectHandover, parseModelOutput, priceContext } from '../services/ai_controller.js';

const NOW = Date.parse('2026-10-08T10:00:00+07:00');
const PHONE = '6281234567890';
const ASSET = {
  id: 'AST-001', name: 'Aset pengujian', limit_price: 800000000, market_estimate: 1100000000,
  market_source: 'Pembanding pengujian', verified_at: '2026-10-08T09:00:00+07:00',
  deposit: 160000000, additional_cost_estimate: 90000000,
  registration_closes_at: '2026-10-11T10:00:00+07:00',
  deposit_due_at: '2026-10-10T10:00:00+07:00',
};

function fixture(overrides = {}) {
  let now = NOW;
  const config = {
    transport: 'cloud',
    wa: { phoneNumberId: '12345', appSecret: 'test-app-secret', verifyToken: 'test-verify-token' },
    adminToken: 'a'.repeat(32), defaultAssetId: 'AST-001', maxSessions: 100,
    maxPending: 100, maxPendingPerPhone: 20, maxDedup: 1000, sessionTtlMs: 86400000,
    ...overrides.config,
  };
  const sent = [];
  const calls = [];
  const errors = [];
  const logger = { error: (error) => errors.push(error) };
  const store = new MemoryStore(config, () => now);
  const catalog = new Catalog([ASSET]);
  const ai = overrides.ai || { generate: async (input) => {
    calls.push(input);
    return { reply: 'Mari kita evaluasi aset ini.', qualification: {} };
  } };
  const whatsapp = overrides.whatsapp || { sendText: async (to, text, replyTo) => {
    sent.push({ to, text, replyTo });
    return `outbound-${sent.length}`;
  } };
  const processor = new MessageProcessor({ config, store, catalog, ai, whatsapp, logger, now: () => now });
  const app = createApp({ config, store, processor, logger, now: () => now });
  return { config, sent, calls, errors, store, processor, app, setTime: (value) => { now = value; } };
}

function message(id, text, from = PHONE, timestamp = NOW) {
  return { id, text, from, timestamp, type: 'text' };
}

function payload(messages = [], phoneNumberId = '12345') {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: phoneNumberId },
    messages: messages.map((item) => ({ ...item, text: { body: item.text }, timestamp: String(item.timestamp / 1000) })),
  } }] }] };
}

async function serve(t, f) {
  const server = f.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await f.processor.drain();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    request: (path, options) => fetch(`${base}${path}`, options),
    post: (body, signature) => {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      return fetch(`${base}/webhook`, { method: 'POST', body: raw, headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature ?? `sha256=${createHmac('sha256', f.config.wa.appSecret).update(raw).digest('hex')}`,
      } });
    },
  };
}

test('ROI memakai basis biaya dan tidak menghitung uang jaminan dua kali', () => {
  const facts = assetFacts(ASSET, NOW);
  assert.equal(facts.calculation.gross_spread, 300000000);
  assert.equal(facts.calculation.gross_roi_percent, 37.5);
  assert.equal(facts.calculation.cost_basis, 890000000);
  assert.equal(facts.calculation.net_estimate, 210000000);
  assert.equal(facts.calculation.net_roi_percent, 23.6);
  assert.equal(facts.registration_deadline.remaining_hours, 72);
  assert.equal(facts.deposit_deadline.remaining_hours, 48);
  assert.equal(facts.registration_deadline.closed, false);
  assert.equal(assetFacts(ASSET, NOW + 72 * 3600000).registration_deadline.closed, true);
});

test('angka hilang tidak dianggap nol, dan margin negatif tidak disembunyikan', () => {
  const facts = assetFacts({ ...ASSET, market_estimate: null, additional_cost_estimate: null }, NOW);
  assert.equal(facts.calculation.net_estimate, null);
  assert.equal(facts.calculation.gross_roi_percent, null);
  assert.match(priceContext(facts, false), /belum terverifikasi/);
  assert.equal(assetFacts({ ...ASSET, market_estimate: 700000000 }, NOW).calculation.gross_spread, -100000000);
});

test('katalog menolak tanggal ambigu, simulasi production dan estimasi tanpa sumber', () => {
  assert.throws(() => validateAssets([{ ...ASSET, deposit_due_at: '2026-10-11' }]));
  assert.throws(() => validateAssets([{ ...ASSET, is_demo: true }], { production: true }));
  assert.throws(() => validateAssets([{ ...ASSET, market_source: null }]));
  assert.throws(() => validateAssets([{ ...ASSET, official_url: 'https://lelang.go.id.evil.example/lot' }]));
  assert.deepEqual(validateAssets([]), []);
});

test('pemilihan beberapa kode aset meminta klarifikasi', () => {
  const catalog = new Catalog([ASSET, { ...ASSET, id: 'AST-002' }]);
  assert.equal(catalog.select('AST-001 dan AST-002', 'AST-001'), null);
  assert.equal(catalog.select('Berapa AST-002?', 'AST-001').id, 'AST-002');
});

test('pemicu handover tahan variasi kapitalisasi, spasi dan tanda baca', () => {
  for (const text of ['MINTA REKENING!', 'mau\ntransfer', 'Ketemu, agen', 'lokasi   kantor?', 'survei-lokasi', 'survey lokasi']) {
    assert.ok(detectHandover(text), text);
  }
  assert.equal(detectHandover('lokasi kantoran'), null);
});

test('pesan duplikat hanya memanggil AI dan WhatsApp sekali', async () => {
  const f = fixture();
  const input = message('id-1', 'Berapa harga AST-001?');
  assert.equal(f.processor.acceptBatch([input, input]), 1);
  assert.equal(f.processor.acceptBatch([input]), 0);
  await f.processor.drain();
  assert.equal(f.calls.length, 1);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].text, 'Mari kita evaluasi aset ini.');
});

test('template ketersediaan tidak mendapat sisipan ROI atau pertanyaan dana otomatis', async () => {
  const f = fixture();
  f.processor.acceptBatch([message('template', 'Halo Jason Christopher Liendo 👋\nSaya tertarik dengan properti lelang berikut, apakah masih tersedia?\n🔨 Rumah\n📍 Candi, Sidoarjo\n💰 Harga Rp800.000.000\n🔖 Kode: AST-001')]);
  await f.processor.drain();
  assert.equal(f.calls[0].facts.id, 'AST-001');
  assert.equal(f.calls[0].facts.availability.confirmed_available, false);
  assert.equal(f.sent[0].text, 'Mari kita evaluasi aset ini.');
});

test('kode template tak dikenal atau ambigu tidak meminjam fakta aset sebelumnya', async () => {
  for (const code of ['169312', 'AST-001\nKode: AST-002']) {
    const f = fixture();
    f.processor.acceptBatch([message('template', `Saya tertarik dengan properti lelang berikut, apakah masih tersedia?\nKode: ${code}`)]);
    await f.processor.drain();
    assert.equal(f.calls[0].facts, null);
    assert.equal(f.store.get(PHONE).asset_id, null);
  }
});

test('semua kata pemicu mematikan bot sebelum LLM dan mengirim notifikasi tepat sekali', async () => {
  for (const trigger of ['minta rekening', 'mau transfer', 'ketemu agen', 'lokasi kantor', 'survei lokasi']) {
    const f = fixture();
    f.processor.acceptBatch([message('trigger', trigger)]);
    assert.equal(f.store.get(PHONE).is_bot_active, false);
    await f.processor.drain();
    f.processor.acceptBatch([message('followup', 'Halo, jawab lagi dong')]);
    await f.processor.drain();
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.sent.map((item) => item.text), [HANDOVER_MESSAGE]);
    assert.equal(f.store.get(PHONE).history.at(-1).content, 'Halo, jawab lagi dong');
  }
});

test('handover ketika LLM berjalan membuang jawaban AI yang terlambat', async () => {
  let release;
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const f = fixture({ ai: { generate: () => {
    entered();
    return new Promise((resolve) => { release = resolve; });
  } } });
  f.processor.acceptBatch([message('first', 'Kode AST-001, berapa harganya?')]);
  await started;
  f.processor.acceptBatch([message('trigger', 'mau transfer')]);
  release({ reply: 'Jawaban AI lama', qualification: {} });
  await f.processor.drain();
  assert.deepEqual(f.sent.map((item) => item.text), [HANDOVER_MESSAGE]);
});

test('antrean per nomor menjaga urutan serta konteks percakapan', async () => {
  const f = fixture();
  f.processor.acceptBatch([message('first', 'Kode AST-001, berapa harganya?'), message('second', 'Untuk investasi')]);
  await f.processor.drain();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].history.map((item) => item.role), ['user', 'assistant', 'user']);
  assert.deepEqual(f.sent.map((item) => item.replyTo), ['first', 'second']);
});

test('CS menerima prospek hot berdasarkan tujuan, jaminan dan pelunasan self-report', async () => {
  const f = fixture({ ai: { generate: async () => ({ reply: 'Siap', qualification: {
    purpose: { value: 'investment', evidence: 'untuk investasi' },
    funds: { value: 'ready', evidence: 'jaminan siap' },
    settlement: { value: 'ready', evidence: 'pelunasan siap' },
  } }) } });
  f.processor.acceptBatch([message('hot', 'AST-001 untuk investasi, jaminan siap, pelunasan siap')]);
  await f.processor.drain();
  assert.equal(f.store.get(PHONE).lead_status, 'hot');
  assert.equal(f.store.get(PHONE).is_bot_active, false);
  assert.equal(f.sent[0].text, HANDOVER_MESSAGE);
});

test('klasifikasi AI tanpa kutipan pengguna dibuang', () => {
  const output = { reply: 'Apa pertimbangan utama Bapak/Ibu?', qualification: {
    purpose: { value: 'investment', evidence: 'investasi' },
    funds: { value: 'ready', evidence: 'siap tunai' },
    settlement: { value: 'unknown', evidence: '' },
  } };
  assert.deepEqual(parseModelOutput(JSON.stringify(output), 'ingin investasi').qualification, { purpose: output.qualification.purpose });
  assert.throws(() => parseModelOutput('not-json', 'halo'));
});

test('pause bertahan melewati TTL dan notifikasi gagal tidak mengaktifkan bot', async () => {
  const f = fixture({ whatsapp: { sendText: async () => { throw new Error('sensitive upstream text'); } } });
  f.processor.acceptBatch([message('pause', 'survei lokasi')]);
  await f.processor.drain();
  assert.equal(f.store.get(PHONE).handover.notice, 'failed');
  assert.equal(JSON.stringify(f.errors).includes('sensitive'), false);
  f.setTime(NOW + 2 * 86400000);
  f.store.cleanup();
  assert.equal(f.store.get(PHONE).is_bot_active, false);
  assert.deepEqual(f.store.get(PHONE).history, []);
});

test('kegagalan AI memberikan fallback tanpa menyimpan jawaban gagal', async () => {
  const f = fixture({ ai: { generate: async () => { throw new Error('secret'); } } });
  f.processor.acceptBatch([message('fail', 'Kode AST-001')]);
  await f.processor.drain();
  assert.match(f.sent[0].text, /hubungkan CS/);
  assert.equal(JSON.stringify(f.errors).includes('secret'), false);
});

test('batch melebihi kapasitas ditolak sebelum state atau dedup berubah', () => {
  const f = fixture({ config: { maxPending: 1 } });
  assert.throws(() => f.processor.acceptBatch([message('one', 'Halo'), message('two', 'Halo')]), { code: 'QUEUE_FULL' });
  assert.equal(f.store.sessions.size, 0);
  assert.equal(f.store.seen.size, 0);
});

test('pesan di luar jendela layanan tidak dibalas dengan pesan bebas', async () => {
  const f = fixture();
  f.processor.acceptBatch([message('old', 'Halo', PHONE, NOW - 25 * 3600000)]);
  await f.processor.drain();
  assert.equal(f.calls.length, 0);
  assert.equal(f.sent.length, 0);
});

test('verifikasi GET dan signature POST berlaku sebelum pemrosesan', async (t) => {
  const f = fixture();
  const { request, post } = await serve(t, f);
  assert.equal((await request('/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=77')).status, 403);
  const challenge = await request('/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=77');
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), '77');
  assert.equal((await post(payload([message('one', 'Halo')]), 'sha256=' + '0'.repeat(64))).status, 403);
  assert.equal((await post('invalid-json')).status, 400);
  assert.equal(f.calls.length, 0);
});

test('webhook di-ACK sebelum LLM selesai dan menelusuri seluruh entry/change/message', async (t) => {
  let release;
  const deferred = new Promise((resolve) => { release = resolve; });
  const f = fixture({ ai: { generate: async () => { await deferred; return { reply: 'Halo', qualification: {} }; } } });
  const { post } = await serve(t, f);
  t.after(() => release());
  const batch = payload([message('one', 'Kode AST-001')]);
  batch.entry.push(...payload([message('two', 'Kode AST-001', '6281234567891')]).entry);
  batch.entry[0].changes.push(...payload([message('three', 'Kode AST-001', '6281234567892')]).entry[0].changes);
  try {
    const ack = await post(batch);
    assert.equal(ack.status, 200);
    assert.equal(f.sent.length, 0);
    assert.equal(f.processor.pending, 3);
  } finally { release(); }
  await f.processor.drain();
  assert.equal(f.sent.length, 3);
});

test('status webhook dan event nomor bisnis lain diabaikan', async (t) => {
  const f = fixture();
  const { post } = await serve(t, f);
  const statuses = payload();
  statuses.entry[0].changes[0].value.statuses = [{ id: 'outbound', status: 'delivered' }];
  assert.equal((await post(statuses)).status, 200);
  assert.equal((await post(payload([message('one', 'Halo')], 'another-business'))).status, 200);
  await f.processor.drain();
  assert.equal(f.calls.length, 0);
  assert.equal(f.store.sessions.size, 0);
});

test('endpoint CS memerlukan token, mendukung balasan manual dan resume eksplisit', async (t) => {
  const f = fixture();
  const { request, post } = await serve(t, f);
  await post(payload([message('handover', 'ketemu agen')]));
  await f.processor.drain();
  assert.equal((await request('/admin/leads')).status, 401);
  const headers = { Authorization: `Bearer ${f.config.adminToken}`, 'Content-Type': 'application/json' };
  const leads = await (await request('/admin/leads', { headers })).json();
  assert.equal(leads.items[0].phone, PHONE);
  assert.equal((await request(`/admin/conversations/${PHONE}/messages`, {
    method: 'POST', headers, body: JSON.stringify({ text: 'Saya Senior Agent yang mendampingi.' }),
  })).status, 202);
  assert.equal(f.sent.length, 2);
  assert.equal((await request(`/admin/conversations/${PHONE}/bot`, {
    method: 'PATCH', headers, body: JSON.stringify({ is_bot_active: true }),
  })).status, 200);
  await post(payload([message('after-resume', 'Kode AST-001')]));
  await f.processor.drain();
  assert.equal(f.calls.length, 1);
});
