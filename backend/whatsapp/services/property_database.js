import { ServiceError, postJson } from '../lib/http.js';
import { setTimeout as delay } from 'node:timers/promises';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const retryable = (error) => ['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE'].includes(error.code) ||
  error.code === 'UPSTREAM_HTTP_ERROR' && RETRYABLE_STATUSES.has(error.status);

// The WhatsApp process never receives DATABASE_URL or a general SQL tool.
// It can only call the server's fixed, read-only public-property projection.
export class DatabaseCatalog {
  constructor(config, { fetchImpl = fetch, sleep = delay, now = () => performance.now() } = {}) {
    Object.assign(this, { config, fetchImpl, sleep, now });
  }
  async lookup(body, signal) {
    // Only this fixed read-only API is retried. Never retry WhatsApp sends,
    // purchases, or other POST requests that might produce duplicate effects.
    const deadline = this.now() + (this.config.totalTimeoutMs ?? 65000);
    const attempts = this.config.maxAttempts ?? 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (signal?.aborted) throw new ServiceError('REQUEST_CANCELLED', 499);
      const remaining = Math.floor(deadline - this.now());
      if (remaining <= 0) throw new ServiceError('UPSTREAM_TIMEOUT', 504);
      try {
        return await postJson(this.config.url, { headers: { Authorization: `Bearer ${this.config.token}` },
          body, timeoutMs: Math.min(this.config.timeoutMs ?? 20000, remaining), fetchImpl: this.fetchImpl, signal });
      } catch (error) {
        if (!retryable(error) || attempt + 1 >= attempts) throw error;
        const backoff = 250 * 2 ** attempt;
        if (deadline - this.now() <= backoff) throw error;
        try { await this.sleep(backoff, undefined, { signal }); }
        catch { throw new ServiceError('REQUEST_CANCELLED', 499); }
      }
    }
  }
  warmup() { return this.resolve('', null); }
  async resolve(text, previousId, criteria, { signal } = {}) {
    const result = await this.lookup({ text, previousId: previousId || null, ...(criteria ? { criteria } : {}) }, signal);
    if (!result || result.source !== 'database_listing_publik' || !Array.isArray(result.candidates) || result.candidates.length > 5 ||
      !['matched', 'choose_property', 'recommendations', 'clarify_location', 'needs_property', 'not_found'].includes(result.status) ||
      (result.asset && !/^[1-9]\d{0,17}$/.test(result.asset.id))) throw new ServiceError('INVALID_PROPERTY_CONTEXT', 502);
    const selection = ['upcoming', 'needs_confirmation', 'standard'].includes(result.selection?.schedule_priority)
      ? { schedule_priority: result.selection.schedule_priority } : undefined;
    // Also enforce exclusions at the connector boundary. An older property
    // server or stale response must not re-offer a batch the client rejected.
    const excluded = new Set(criteria?.exclude_ids || []);
    const candidates = result.candidates.filter((property) => !excluded.has(String(property.id)));
    const status = result.status === 'recommendations' && !candidates.length ? 'not_found' : result.status;
    return { asset: result.asset || null, catalog: candidates, status, source: result.source, selection };
  }
}
