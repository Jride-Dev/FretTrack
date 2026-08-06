const NETWORK_ERROR_PATTERN = /failed to fetch|fetch failed|networkerror|network request failed/i;

export function getDisplayedAuthError(error, {
  fallback = 'Authentication failed.',
  usesLocalBackend = false
} = {}) {
  const message = error instanceof Error && error.message
    ? error.message
    : String(error || fallback);

  if (usesLocalBackend && NETWORK_ERROR_PATTERN.test(message)) {
    return 'Local test backend is offline. Start Docker Desktop and local Supabase, then try again.';
  }

  return message || fallback;
}
