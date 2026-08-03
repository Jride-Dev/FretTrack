import assert from 'node:assert/strict';
import { assertSafeDevelopmentSupabase } from '../vite.config.js';

assert.doesNotThrow(() => {
  assertSafeDevelopmentSupabase('development', {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321'
  });
});

assert.throws(
  () => {
    assertSafeDevelopmentSupabase('development', {
      VITE_SUPABASE_URL: 'https://production-project.supabase.co'
    });
  },
  /Development startup refused a remote Supabase URL/
);

assert.doesNotThrow(() => {
  assertSafeDevelopmentSupabase('development', {
    VITE_SUPABASE_URL: 'https://intentional-test-project.supabase.co',
    VITE_ALLOW_REMOTE_DEV: 'true'
  });
});

assert.doesNotThrow(() => {
  assertSafeDevelopmentSupabase('production', {
    VITE_SUPABASE_URL: 'https://production-project.supabase.co'
  });
});

console.log('Local development Supabase isolation checks passed.');
