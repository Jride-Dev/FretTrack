import assert from 'node:assert/strict';
import { getDisplayedAuthError } from '../src/modules/auth/authErrorMessage.js';

assert.equal(
  getDisplayedAuthError(new TypeError('Failed to fetch'), { usesLocalBackend: true }),
  'Local test backend is offline. Start Docker Desktop and local Supabase, then try again.'
);
assert.equal(
  getDisplayedAuthError(new TypeError('Failed to fetch'), { usesLocalBackend: false }),
  'Failed to fetch',
  'Production network errors must not mention local Docker tooling.'
);
assert.equal(
  getDisplayedAuthError(new Error('Invalid login credentials'), { usesLocalBackend: true }),
  'Invalid login credentials',
  'Normal authentication errors must remain intact.'
);

console.log('Local auth offline-message checks passed.');
