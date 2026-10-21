import { createHash } from 'node:crypto';
import { ServiceError, postJson } from '../lib/http.js';

const sharedCooldowns = new Map();
const failoverCodes = new Set(['AI_QUOTA_EXHAUSTED', 'AI_RATE_LIMIT', 'AI_UNAVAILABLE', 'AI_MODEL_UNAVAILABLE', 'UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE']);
const seconds = (value) => Number.isFinite(value) && value > 0 ? Math.min(86400, Math.max(1, Math.ceil(value))) : null;

export async function llmHttpError(response, now = Date.now()) {
  // Inspect provider diagnostics only to classify the failure. Never return
  // provider messages, quota project identifiers, keys, or raw error bodies.
  const data = await response.json().catch(() => null);
  const details = Array.isArray(data?.error?.details) ? data.error.details : [];
  const violations = details.flatMap((item) => Array.isArray(item.violations) ? item.violations : []);
  const daily = violations.some((item) => /perday|daily/i.test(item.quotaId || '')) || data?.error?.code === 'insufficient_quota';
  const delay = details.find((item) => typeof item.retryDelay === 'string')?.retryDelay;
  const header = response.headers?.get('retry-after');
  const retry = seconds(header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : header ? (Date.parse(header) - now) / 1000 : NaN)
    || seconds(typeof delay === 'string' && /^\d+(?:\.\d+)?s$/.test(delay) ? Number(delay.slice(0, -1)) : NaN);
  const code = response.status === 429 ? daily ? 'AI_QUOTA_EXHAUSTED' : 'AI_RATE_LIMIT'
    : [401, 403].includes(response.status) ? 'AI_AUTH_ERROR'
      : response.status === 404 ? 'AI_MODEL_UNAVAILABLE' : response.status >= 500 ? 'AI_UNAVAILABLE' : 'AI_REQUEST_REJECTED';
  const error = new ServiceError(code, response.status === 429 ? 429 : 503);
  if (response.status === 429 || response.status >= 500) error.retryAfter = retry || (daily ? 3600 : 30);
  return error;
}

export function createModelRequester(config, { fetchImpl = fetch, now = Date.now,
  cooldowns = fetchImpl === fetch ? sharedCooldowns : new Map() } = {}) {
  const credentialId = createHash('sha256').update(config.apiKey).digest('hex');
  const models = [...new Set([config.model, config.fallbackModel].filter(Boolean))];
  return async (buildRequest, { signal } = {}) => {
    for (const [key, item] of cooldowns) if (item.until <= now()) cooldowns.delete(key);
    let lastError;
    for (const model of models) {
      if (signal?.aborted) throw new ServiceError('REQUEST_CANCELLED', 499);
      const key = `${config.provider}:${credentialId}:${model}`, cooling = cooldowns.get(key);
      if (cooling) {
        lastError = new ServiceError(cooling.code, cooling.status);
        lastError.retryAfter = Math.max(1, Math.ceil((cooling.until - now()) / 1000));
        continue;
      }
      try {
        const { url, ...request } = buildRequest(model);
        const data = await postJson(url, { ...request, timeoutMs: config.timeoutMs, signal, fetchImpl,
          mapError: (response) => llmHttpError(response, now()) });
        return { data, generation: { mode: model === config.model ? 'primary' : 'fallback', model } };
      } catch (error) {
        if (!failoverCodes.has(error.code)) throw error;
        lastError = error;
        const delay = error.retryAfter || (error.code === 'AI_MODEL_UNAVAILABLE' ? 3600 : 10);
        cooldowns.set(key, { code: error.code, status: error.status, until: now() + delay * 1000 });
      }
    }
    throw lastError || new ServiceError('AI_UNAVAILABLE', 503);
  };
}

// Shared structured-output transport for answering and understanding. Both
// paths use the same provider validation, cancellation and quota cooldowns.
export function createStructuredRequester(config, dependencies = {}) {
  const requestModel = createModelRequester(config, dependencies);
  return async ({ instructions, history, schema, name, signal, maxTokens = 2500 }) => {
    const { data, generation } = await requestModel((model) => config.provider === 'openai' ? {
      url: 'https://api.openai.com/v1/responses', headers: { Authorization: `Bearer ${config.apiKey}` },
      body: { model, instructions, input: history, store: false, max_output_tokens: maxTokens,
        text: { format: { type: 'json_schema', name, strict: true, schema } } },
    } : {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': config.apiKey },
      body: { systemInstruction: { parts: [{ text: instructions }] },
        contents: history.map(({ role, content }) => ({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] })),
        generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', responseJsonSchema: schema,
          ...(/^gemini-2\.5-/.test(model) ? { thinkingConfig: { thinkingBudget: 512 } } : {}) } },
    }, { signal });
    let text;
    if (config.provider === 'openai') {
      if (data.status !== 'completed') throw new ServiceError('INCOMPLETE_AI_OUTPUT', 502);
      text = (data.output || []).filter((item) => item.type === 'message').flatMap((item) => item.content || [])
        .filter((item) => item.type === 'output_text').map((item) => item.text).join('');
    } else {
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new ServiceError('INCOMPLETE_AI_OUTPUT', 502);
      text = (candidate.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('');
    }
    return { text, generation };
  };
}
