import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { ServiceError, postJson } from '../lib/http.js';
import { createModelRequester, llmHttpError } from '../services/llm_transport.js';
import { createAiController } from '../services/ai_controller.js';
import { createSandboxRouter } from '../routes/sandbox.js';
import { playgroundFailure, playgroundBackendFailure, playgroundTransportFailure, playgroundErrorMessage } from '../../../src/lib/chatbot/playground-errors.ts';
import { playgroundHistory, isPlaygroundResponse } from '../../../src/lib/chatbot/playground.ts';
import { isSameOriginRequest } from '../../../src/lib/chatbot/request-origin.ts';

const quotaBody = { error: { message: 'PRIVATE_PROVIDER_DETAIL', details: [
  { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20', project: 'PRIVATE_PROJECT' }] },
  { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '42358.2s' },
] } };
const output = { reply: 'Berapa budget Bapak/Ibu? Apakah untuk hunian atau investasi?', qualification: Object.fromEntries(
  ['purpose', 'funds', 'settlement'].map((key) => [key, { value: 'unknown', evidence: '' }])) };
const aiInput = { history: [{ role: 'user', content: 'Cari lelang rumah di Citraland' }], userText: 'Cari lelang rumah di Citraland', facts: null,
  catalog: [], qualification: {}, knowledge: { status: 'qualifying', buyer: { stage: 'qualifying' } } };
const modelReply = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] });

test('provider daily quota has a distinct code and exact retry delay without leaking diagnostics', async () => {
  const error = await llmHttpError(Response.json(quotaBody, { status: 429 }));
  assert.equal(error.code, 'AI_QUOTA_EXHAUSTED'); assert.equal(error.status, 429); assert.equal(error.retryAfter, 42359);
  assert.doesNotMatch(JSON.stringify(error), /PRIVATE_/);
  const minute = await llmHttpError(Response.json({ error: { details: [{ retryDelay: '3s' }] } }, { status: 429, headers: { 'Retry-After': '5' } }));
  assert.equal(minute.code, 'AI_RATE_LIMIT'); assert.equal(minute.retryAfter, 5);
  assert.equal((await llmHttpError(Response.json({}, { status: 403 }))).code, 'AI_AUTH_ERROR');
  assert.equal((await llmHttpError(Response.json({}, { status: 404 }))).code, 'AI_MODEL_UNAVAILABLE');
});

test('actual generation fails over once and honors primary cooldown across conversations', async () => {
  const models = [], cooldowns = new Map(); let time = 1000;
  const config = { provider: 'gemini', model: 'gemini-2.5-flash', fallbackModel: 'gemini-3.5-flash-lite', apiKey: 'test', timeoutMs: 1000 };
  const dependencies = { cooldowns, now: () => time, fetchImpl: async (url, options) => {
    const model = /models\/(.+):generateContent/.exec(url)[1]; models.push(model);
    if (model === config.model && time < 42360000) return Response.json(quotaBody, { status: 429 });
    const body = JSON.parse(options.body);
    if (model === config.fallbackModel) assert.equal(body.generationConfig.thinkingConfig, undefined);
    return modelReply();
  } };
  const first = await createAiController(config, dependencies).generate(aiInput);
  assert.equal(first.generation.mode, 'fallback'); assert.equal(first.generation.model, config.fallbackModel);
  await createAiController(config, dependencies).generate(aiInput);
  assert.deepEqual(models, [config.model, config.fallbackModel, config.fallbackModel]);
  time = 42361000;
  assert.equal((await createAiController(config, dependencies).generate(aiInput)).generation.mode, 'primary');
});

test('all model quotas stop network retries until provider cooldown and preserve actionable error', async () => {
  let calls = 0;
  const request = createModelRequester({ provider: 'gemini', model: 'primary', fallbackModel: 'backup', apiKey: 'test', timeoutMs: 1000 }, {
    now: () => 1000, fetchImpl: async () => { calls++; return Response.json(quotaBody, { status: 429 }); },
  });
  const build = (model) => ({ url: `https://example.test/${model}`, headers: {}, body: {} });
  await assert.rejects(request(build), { code: 'AI_QUOTA_EXHAUSTED', retryAfter: 42359 });
  await assert.rejects(request(build), { code: 'AI_QUOTA_EXHAUSTED', retryAfter: 42359 });
  assert.equal(calls, 2);
});

test('credentials errors do not retry another model; cancelled requests do not poison cooldown', async () => {
  let calls = 0;
  const config = { provider: 'gemini', model: 'primary', fallbackModel: 'backup', apiKey: 'test', timeoutMs: 1000 };
  const request = createModelRequester(config, { fetchImpl: async () => { calls++; return Response.json({}, { status: 403 }); } });
  await assert.rejects(request(() => ({ url: 'https://example.test', body: {} })), { code: 'AI_AUTH_ERROR' }); assert.equal(calls, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(request(() => ({ url: 'https://example.test', body: {} }), { signal: controller.signal }), { code: 'REQUEST_CANCELLED' }); assert.equal(calls, 1);
  const active = new AbortController();
  const cancelled = postJson('https://example.test', { timeoutMs: 1000, signal: active.signal,
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) });
  active.abort(); await assert.rejects(cancelled, { code: 'REQUEST_CANCELLED' });
});

async function sandbox(t, ai, options = {}) {
  const token = 'x'.repeat(40), app = express();
  const catalog = { async resolve() { return { asset: null, catalog: [], status: 'needs_property', source: 'test' }; } };
  app.use('/sandbox', createSandboxRouter({ config: { adminToken: token }, catalog, ai, ...options }));
  app.use((error, req, res, next) => { if (error.retryAfter) res.set('Retry-After', String(error.retryAfter)); res.status(error.status || 500).json({ error: error.code, retry_after_seconds: error.retryAfter }); });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/sandbox`, headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return {
    post: (id = randomUUID(), agent = 'AG1', signal) => fetch(`${base}/${agent}/messages`, { method: 'POST', headers, signal,
      body: JSON.stringify({ requestId: id, history: [{ role: 'user', content: 'Kode 123, jelaskan aksesnya' }] }) }),
    cancel: (id, agent = 'AG1', auth = true) => fetch(`${base}/${agent}/messages/${id}`, { method: 'DELETE', headers: auth ? headers : {} }),
  };
}

test('cancel/reset releases the exact request and cannot cancel another agent or later request', async (t) => {
  const started = [], signals = []; let resolveFirst;
  const f = await sandbox(t, { async generate({ signal }) { started.push(true); signals.push(signal); if (started.length === 1) return new Promise((resolve) => { resolveFirst = resolve; }); return { reply: output.reply, qualification: {} }; } });
  const id = randomUUID(), first = f.post(id);
  while (!started.length) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await f.post()).status, 409);
  assert.equal((await f.cancel(id, 'AG2')).status, 204); assert.equal(signals[0].aborted, false);
  assert.equal((await f.cancel(id, 'AG1', false)).status, 401); assert.equal(signals[0].aborted, false);
  assert.equal((await f.cancel(id)).status, 204); assert.equal(signals[0].aborted, true);
  assert.equal((await first).status, 499); assert.equal((await f.post()).status, 200);
  resolveFirst({ reply: 'Late reply', qualification: {} });
  assert.equal((await f.post()).status, 200);
});

test('cancel arriving before a delayed POST prevents provider execution', async (t) => {
  let calls = 0; const f = await sandbox(t, { async generate() { calls++; return { reply: output.reply, qualification: {} }; } });
  const id = randomUUID(); assert.equal((await f.cancel(id)).status, 204);
  assert.equal((await f.post(id)).status, 499); assert.equal(calls, 0);
  assert.equal((await f.post()).status, 200); assert.equal(calls, 1);
});

test('deadline releases a stuck provider so the next message can run', async (t) => {
  let calls = 0, firstSignal;
  const f = await sandbox(t, { async generate({ signal }) { calls++; if (calls === 1) { firstSignal = signal; return new Promise(() => {}); } return { reply: output.reply, qualification: {} }; } }, { timeoutMs: 40 });
  const first = await f.post(); assert.equal(first.status, 504); assert.equal((await first.json()).error, 'SANDBOX_TIMEOUT'); assert.equal(firstSignal.aborted, true);
  assert.equal((await f.post()).status, 200);
});

test('browser disconnection aborts provider work and frees the per-agent lock', async (t) => {
  let started, stopped, calls = 0;
  const ready = new Promise((resolve) => { started = resolve; });
  const aborted = new Promise((resolve) => { stopped = resolve; });
  const f = await sandbox(t, { async generate({ signal }) {
    calls++;
    if (calls > 1) return { reply: output.reply, qualification: {} };
    signal.addEventListener('abort', stopped, { once: true }); started(); return new Promise(() => {});
  } });
  const controller = new AbortController(), response = f.post(randomUUID(), 'AG1', controller.signal);
  await ready; controller.abort(); await assert.rejects(response, { name: 'AbortError' });
  await aborted; assert.equal((await f.post()).status, 200);
});

test('provider failure releases busy state; session limit includes a real retry window and resets', async (t) => {
  let calls = 0, time = 1000;
  const f = await sandbox(t, { async generate() { calls++; if (calls === 1) throw new ServiceError('AI_UNAVAILABLE', 503); return { reply: output.reply, qualification: {} }; } }, { now: () => time });
  assert.equal((await f.post()).status, 503);
  for (let i = 1; i < 30; i++) assert.equal((await f.post()).status, 200);
  const limited = await f.post(); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '300');
  assert.equal((await limited.json()).error, 'SANDBOX_RATE_LIMIT'); assert.equal(calls, 30);
  time += 300001; assert.equal((await f.post()).status, 200);
});

test('public error mapping distinguishes quota, session limits and busy requests and strips private errors', () => {
  for (const code of ['AI_QUOTA_EXHAUSTED', 'AI_RATE_LIMIT', 'SANDBOX_RATE_LIMIT', 'SANDBOX_BUSY']) {
    const result = playgroundFailure(code === 'SANDBOX_BUSY' ? 409 : 429, { error: code, retry_after_seconds: 42, secret: 'PRIVATE' });
    assert.equal(result.error, code); assert.equal(result.retry_after_seconds, 42); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
    assert.notEqual(playgroundErrorMessage(code), 'Tunggu sebentar sebelum mengirim pesan berikutnya.');
  }
  assert.equal(playgroundFailure(429, { error: 'UPSTREAM_HTTP_ERROR' }).error, 'AI_RATE_LIMIT');
  assert.equal(playgroundFailure(500, { error: 'PRIVATE_PROVIDER_DETAIL' }).error, 'SERVICE_UNAVAILABLE');
});

test('Playground distinguishes a stopped backend, backend tokens and backend route errors from browser login', () => {
  const networkError = new TypeError('PRIVATE_URL', { cause: Object.assign(new Error('PRIVATE_TOKEN'), { code: 'ECONNREFUSED' }) });
  const disconnected = playgroundTransportFailure(networkError);
  assert.deepEqual(disconnected, { error: 'CHATBOT_BACKEND_UNREACHABLE', status: 503 });
  assert.match(playgroundErrorMessage(disconnected.error), /backend tetap berjalan/);
  assert.doesNotMatch(JSON.stringify(disconnected), /PRIVATE/);
  assert.equal(playgroundTransportFailure(networkError, true).status, 499);
  assert.equal(playgroundTransportFailure(new DOMException('Timeout', 'TimeoutError')).status, 504);
  for (const status of [401, 403]) {
    const failed = playgroundBackendFailure(status, { error: 'UNAUTHENTICATED', token: 'PRIVATE' });
    assert.deepEqual(failed, { error: 'CHATBOT_BACKEND_AUTH_ERROR', status: 503 });
    assert.match(playgroundErrorMessage(failed.error), /token akses/);
  }
  assert.equal(playgroundFailure(401, { error: 'UNAUTHENTICATED' }).error, 'UNAUTHENTICATED');
  assert.equal(playgroundBackendFailure(404, null).error, 'CHATBOT_BACKEND_ENDPOINT_MISSING');
  assert.equal(playgroundBackendFailure(405, null).error, 'CHATBOT_BACKEND_ENDPOINT_MISSING');
  for (const error of ['NOT_CONFIGURED', 'INVALID_PROPERTY_CONTEXT', 'PROPERTY_LOOKUP_UNAVAILABLE', 'CHATBOT_BACKEND_INVALID_RESPONSE']) {
    assert.equal(playgroundFailure(503, { error }).error, error);
    assert.notEqual(playgroundErrorMessage(error), playgroundErrorMessage('SERVICE_UNAVAILABLE'));
  }
  assert.equal(playgroundBackendFailure(429, { error: 'AI_QUOTA_EXHAUSTED' }, '42').retry_after_seconds, 42);
});

test('long conversations retain complete bounded user-first context and malformed success responses are rejected', () => {
  const messages = Array.from({ length: 41 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: `message ${index} ${'a'.repeat(1800)}` }));
  const history = playgroundHistory(messages);
  assert.equal(history[0].role, 'user'); assert.equal(history.at(-1).role, 'user');
  assert.ok(history.length <= 20); assert.ok(history.reduce((n, m) => n + m.content.length, 0) <= 24000);
  assert.equal(isPlaygroundResponse({ reply: '', asset: null, knowledge: { status: 'ok', source: 'test' } }), false);
  assert.equal(isPlaygroundResponse({ reply: 'Hello', asset: {}, knowledge: { status: 'ok', source: 'test' } }), false);
  assert.equal(isPlaygroundResponse({ reply: 'Hello', asset: null, knowledge: { status: 'ok', source: 'test' }, generation: { mode: 'fallback' } }), true);
  const silent = { reply: null, suppressed: true, asset: null, knowledge: { status: 'waiting_for_property', source: 'interaction_policy' },
    session: { asset_id: null, is_bot_active: true, idle_timeout_ms: 45 * 60000 } };
  assert.equal(isPlaygroundResponse(silent), true);
  assert.equal(isPlaygroundResponse({ ...silent, suppressed: false }), false);
  assert.equal(isPlaygroundResponse({ ...silent, reply: 'Unexpected response' }), false);
  assert.equal(isPlaygroundResponse({ ...silent, session: { ...silent.session, idle_timeout_ms: 0 } }), false);
});

test('origin validation accepts the real loopback Host while rejecting foreign origins and forged forwarded-host', () => {
  const request = (origin, host = '127.0.0.1:3000', extra = {}) => ({ nextUrl: new URL('http://localhost:3000/api/dashboard/chatbot/playground'),
    headers: new Headers({ ...(origin ? { origin } : {}), host, ...extra }) });
  assert.equal(isSameOriginRequest(request('http://127.0.0.1:3000')), true);
  assert.equal(isSameOriginRequest(request('http://localhost:3000', 'localhost:3000')), true);
  assert.equal(isSameOriginRequest(request('https://example.invalid', '127.0.0.1:3000', { 'x-forwarded-host': 'example.invalid' })), false);
  assert.equal(isSameOriginRequest(request('http://127.0.0.1:3001')), false);
  assert.equal(isSameOriginRequest(request('https://127.0.0.1:3000')), false);
  assert.equal(isSameOriginRequest(request('http://127.0.0.1:3000', '127.0.0.1:3000', { 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isSameOriginRequest(request(null)), false);
  assert.equal(isSameOriginRequest(request('null')), false);
  assert.equal(isSameOriginRequest(request('http://user@127.0.0.1:3000')), false);
});
