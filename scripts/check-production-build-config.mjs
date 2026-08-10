import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const expectedSupabaseUrl = 'https://sbydcnwrmojbczuvnmsa.supabase.co';

assert.ok(existsSync(distDir), 'Production build output is missing. Run npm run build first.');

const textFileExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml'
]);

const forbiddenPatterns = [
  {
    pattern: /http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):54321/i,
    label: 'local Supabase URL'
  },
  {
    pattern: /supabase-demo/i,
    label: 'Supabase demo key issuer'
  },
  {
    pattern: /VITE_FRETTRACK_SHOP_ID:`test1-shop`|VITE_FRETTRACK_SHOP_ID:"test1-shop"/,
    label: 'local test shop id'
  },
  {
    pattern: /VITE_FRETTRACK_SHOP_NAME:`test1 shop`|VITE_FRETTRACK_SHOP_NAME:"test1 shop"/i,
    label: 'local test shop name'
  }
];

const scannedFiles = [];
const violations = [];
let hasExpectedSupabaseUrl = false;
let hasPublishableKey = false;
let hasFunctionKey = false;
let hasBlankFunctionKey = false;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!textFileExtensions.has(path.extname(entry).toLowerCase())) {
      continue;
    }

    scannedFiles.push(fullPath);
    const content = readFileSync(fullPath, 'utf8');
    if (content.includes(expectedSupabaseUrl)) {
      hasExpectedSupabaseUrl = true;
    }
    if (content.includes('sb_publishable_')) {
      hasPublishableKey = true;
    }
    if (/VITE_FRETTRACK_FUNCTION_KEY:`[^`]+`|VITE_FRETTRACK_FUNCTION_KEY:"[^"]+"/.test(content)) {
      hasFunctionKey = true;
    }
    if (/VITE_FRETTRACK_FUNCTION_KEY:``|VITE_FRETTRACK_FUNCTION_KEY:""/.test(content)) {
      hasBlankFunctionKey = true;
    }
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(content)) {
        violations.push(`${forbidden.label} found in ${path.relative(repoRoot, fullPath)}`);
      }
    }
  }
}

walk(distDir);

assert.ok(scannedFiles.length > 0, 'No text assets were scanned in dist.');
assert.deepEqual(violations, [], `Production build contains unsafe local/test config:\n${violations.join('\n')}`);
assert.ok(
  hasExpectedSupabaseUrl,
  `Production build must contain the production Supabase URL: ${expectedSupabaseUrl}`
);
assert.ok(
  hasPublishableKey,
  'Production build must contain a Supabase publishable key, not a local demo anon key.'
);
assert.equal(
  hasBlankFunctionKey,
  false,
  'Production build must not contain a blank FretTrack Edge Function key.'
);
assert.ok(
  hasFunctionKey,
  'Production build must contain the FretTrack Edge Function key so customer email/SMS calls are authorized.'
);

console.log('Production build config checks passed.');
