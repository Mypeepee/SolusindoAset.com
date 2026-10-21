export class ServiceError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// Jangan masukkan response upstream, header Authorization, atau isi chat ke log.
export async function postJson(url, { headers, body, timeoutMs, fetchImpl = fetch, signal, mapError }) {
  let response;
  let data;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    if (!response.ok) throw mapError ? await mapError(response) : new ServiceError('UPSTREAM_HTTP_ERROR', response.status);
    data = await response.json();
  } catch (error) {
    if (signal?.aborted) throw new ServiceError('REQUEST_CANCELLED', 499);
    if (error instanceof ServiceError) throw error;
    if (error.name === 'TimeoutError') throw new ServiceError('UPSTREAM_TIMEOUT', 504);
    throw new ServiceError('UPSTREAM_UNAVAILABLE', 502);
  }
  return data;
}

export function logFailure(logger, event, error) {
  logger.error({ event, code: error.code || 'INTERNAL_ERROR', status: error.status || 500 });
}
