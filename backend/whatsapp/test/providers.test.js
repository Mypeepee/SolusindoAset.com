import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../services/ai_controller.js';
import { createWhatsAppClient } from '../services/whatsapp.js';
import { loadConfig } from '../config.js';

const output = { reply: 'Apa pertimbangan utama Bapak/Ibu dalam memilih properti ini?', qualification: Object.fromEntries(
  ['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }]),
) };
const input = { history: [{ role: 'user', content: 'Halo' }], facts: null, catalog: [], qualification: {}, userText: 'Halo' };

test('OpenAI memakai Responses API, schema, riwayat dan store:false', async () => {
  let request;
  const ai = createAiController({ provider: 'openai', model: 'configured-model', apiKey: 'test-key', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
    },
  });
  const legacy = { id: '121820', transaction_type: 'LELANG', specifications: { floors: 1, land_area_m2: 101 } };
  assert.equal((await ai.generate({ ...input, facts: legacy, catalog: [legacy] })).reply, output.reply);
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.store, false);
  assert.equal(request.body.text.format.strict, true);
  assert.deepEqual(request.body.input, input.history);
  assert.match(request.body.instructions, /Solusindo Aset/);
  assert.match(request.body.instructions, /uang jaminan/);
  const context = JSON.parse(request.body.instructions.split('KONTEKS_BACKEND:\n').at(-1));
  assert.equal(context.asset.specifications.floors, undefined);
  assert.equal(context.available_assets[0].specifications.floors, undefined);
  assert.equal(context.asset.transaction_type, 'LELANG');
  assert.equal(context.asset.specifications.land_area_m2, 101);
  assert.equal(legacy.specifications.floors, 1);
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('Gemini memakai role model, systemInstruction dan API key di header', async () => {
  let request;
  const ai = createAiController({ provider: 'gemini', model: 'configured-model', apiKey: 'test-key', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
        { text: 'internal thinking', thought: true }, { text: JSON.stringify(output) },
      ] } }] });
    },
  });
  assert.equal((await ai.generate({ ...input, history: [...input.history, { role: 'assistant', content: 'Halo' }, ...input.history] })).reply, output.reply);
  assert.equal(request.body.contents[1].role, 'model');
  assert.equal(request.body.generationConfig.responseMimeType, 'application/json');
  assert.match(request.body.systemInstruction.parts[0].text, /KONTEKS_BACKEND/);
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  assert.equal(request.url.includes('key='), false);
});

test('persona Jason dan konteks template diteruskan ke model tanpa menganggapnya fakta', async () => {
  let instructions;
  const ai = createAiController({ provider: 'gemini', model: 'test-model', apiKey: 'test-key', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      instructions = JSON.parse(options.body).systemInstruction.parts[0].text;
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] });
    },
  });
  const userText = 'Halo Jason Christopher Liendo 👋 Saya tertarik dengan properti lelang berikut, apakah masih tersedia? 📍 Candi, Sidoarjo 💰 Rp110.000.000 🔖 Kode: 169312';
  await ai.generate({ ...input, userText, history: [{ role: 'user', content: userText }] });
  assert.match(instructions, /mewakili Jason Christopher/);
  assert.match(instructions, /KONSULTATIF DAN RESPONSIF/);
  assert.match(instructions, /Jangan otomatis mengakhiri jawaban dengan pertanyaan/);
  const context = JSON.parse(instructions.split('KONTEKS_BACKEND:\n').at(-1));
  assert.equal(context.lead_inquiry.code, '169312');
  assert.equal(context.lead_inquiry.verified, false);
  assert.equal(context.asset, null);
});

test('Gemini 2.5 reserves output space for complete recommendation JSON without applying its thinking settings to other models', async () => {
  for (const model of ['gemini-2.5-flash', 'gemini-3-flash']) {
    let config;
    const ai = createAiController({ provider: 'gemini', model, apiKey: 'test', timeoutMs: 1000 }, {
      fetchImpl: async (url, options) => {
        config = JSON.parse(options.body).generationConfig;
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] });
      },
    });
    await ai.generate(input);
    assert.equal(config.maxOutputTokens, 2500);
    assert.deepEqual(config.thinkingConfig, model === 'gemini-2.5-flash' ? { thinkingBudget: 512 } : undefined);
  }
});

test('penolakan atau output terpotong tidak dikirim ke calon pembeli', async () => {
  for (const [provider, response] of [
    ['openai', { status: 'incomplete', output: [] }],
    ['gemini', { candidates: [{ finishReason: 'SAFETY' }] }],
  ]) {
    const ai = createAiController({ provider, model: 'test-model', apiKey: 'key', timeoutMs: 1000 }, {
      fetchImpl: async () => Response.json(response),
    });
    await assert.rejects(ai.generate(input), { code: 'INCOMPLETE_AI_OUTPUT' });
  }
});

test('WhatsApp mengirim teks ke nomor tujuan dan memakai message context', async () => {
  let request;
  const client = createWhatsAppClient({ apiVersion: 'v99.0', phoneNumberId: '12345', accessToken: 'test-token', timeoutMs: 1000 }, {
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body), options };
      return Response.json({ messages: [{ id: 'wamid.outbound' }] });
    },
  });
  assert.equal(await client.sendText('6281234567890', 'Halo', 'wamid.inbound'), 'wamid.outbound');
  assert.equal(request.url, 'https://graph.facebook.com/v99.0/12345/messages');
  assert.equal(request.body.messaging_product, 'whatsapp');
  assert.equal(request.body.text.preview_url, false);
  assert.equal(request.body.context.message_id, 'wamid.inbound');
  await assert.rejects(client.sendText('invalid', 'Halo'), { code: 'INVALID_OUTBOUND_MESSAGE' });
});

test('kegagalan kirim tidak di-retry otomatis sehingga tidak menggandakan pesan', async () => {
  let calls = 0;
  const client = createWhatsAppClient({ apiVersion: 'v99.0', phoneNumberId: '12345', accessToken: 'token', timeoutMs: 1000 }, {
    fetchImpl: async () => { calls += 1; return Response.json({ secret: 'hidden' }, { status: 429 }); },
  });
  await assert.rejects(client.sendText('6281234567890', 'Halo'), { code: 'UPSTREAM_HTTP_ERROR', status: 429 });
  assert.equal(calls, 1);
});

test('konfigurasi gagal cepat ketika secret atau model belum diisi', () => {
  assert.throws(() => loadConfig({}), /ADMIN_API_TOKEN/);
  assert.throws(() => loadConfig({ WA_TRANSPORT: 'cloud' }), /WA_API_VERSION/);
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'invalid' }), /LLM_PROVIDER/);
  assert.throws(() => loadConfig({
    WA_API_VERSION: 'v99.0', WA_PHONE_NUMBER_ID: '12345', ADMIN_API_TOKEN: 'short',
  }), /minimal 32/);
});
