export const CLIENT_CHECK_ERRORS = ['CLIENT_AUTH_FAILED', 'CLIENT_DATABASE_UNAVAILABLE', 'INVALID_CLIENT_CHECK', 'UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE'];

export function validClientCheck(value) {
  if (!value || value.id_agent !== 'AG108' || !Number.isSafeInteger(value.checked_at) || value.checked_at <= 0) return false;
  if (value.status === 'failed') return CLIENT_CHECK_ERRORS.includes(value.error);
  return value.status === 'passed' && value.checks?.write === true && value.checks?.read === true &&
    value.checks?.update === true && value.checks?.deduplication === true && value.checks?.cleanup === true;
}
