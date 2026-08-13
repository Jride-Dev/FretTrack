import { readFileSync } from 'node:fs';

const env = parseEnv(readFileSync('.env.local', 'utf8'));
const supabaseUrl = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(supabaseUrl)) {
  throw new Error('Local test startup refused: .env.local must point to local Supabase.');
}

try {
  const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
    signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  throw new Error(
    'Local test backend is offline. Start Docker Desktop and run `supabase start` before starting the test server.',
    { cause: error }
  );
}

console.log('Local Supabase Auth is healthy.');

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')];
      })
  );
}
