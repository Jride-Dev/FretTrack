const debugEntries = [];
const listeners = new Set();
const MAX_ENTRIES = 120;

function getTimestamp() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

export function isLegacyDebugEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  const search = String(window.location?.search || '');
  return /(?:\?|&)debug=legacy(?:&|$)/.test(search);
}

export function getLegacyDebugEntries() {
  return debugEntries.slice();
}

export function subscribeLegacyDebug(listener) {
  listeners.add(listener);
  listener(getLegacyDebugEntries());
  return () => listeners.delete(listener);
}

export function logLegacyDebug(message, detail = '') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: getTimestamp(),
    message: String(message || ''),
    detail: detail instanceof Error ? getErrorMessage(detail) : String(detail || '')
  };

  debugEntries.push(entry);
  while (debugEntries.length > MAX_ENTRIES) {
    debugEntries.shift();
  }

  if (isLegacyDebugEnabled()) {
    console.info('[legacy]', entry.message, entry.detail);
  }

  listeners.forEach((listener) => listener(getLegacyDebugEntries()));
}

export function logLegacyFeatureSnapshot() {
  if (typeof window === 'undefined') {
    return;
  }

  const cryptoObject = window.crypto || {};
  const features = {
    userAgent: window.navigator?.userAgent || 'unknown',
    promiseFinally: Boolean(window.Promise?.prototype?.finally),
    urlSearchParams: Boolean(window.URLSearchParams),
    textEncoder: Boolean(window.TextEncoder),
    textDecoder: Boolean(window.TextDecoder),
    cryptoSubtle: Boolean(cryptoObject.subtle),
    cryptoGetRandomValues: Boolean(cryptoObject.getRandomValues),
    abortController: Boolean(window.AbortController),
    fetch: Boolean(window.fetch),
    headers: Boolean(window.Headers),
    request: Boolean(window.Request),
    response: Boolean(window.Response)
  };

  logLegacyDebug('user agent', features.userAgent);
  logLegacyDebug('auth runtime feature check', JSON.stringify(features));
}

export function getErrorMessage(error, fallback = 'Unknown error') {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || fallback);
  }

  return error ? String(error) : fallback;
}
