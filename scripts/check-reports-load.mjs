import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const reportsPage = read('src/modules/reports/AdvancedReportsPage.jsx');

assert.ok(
  reportsPage.includes('formatDateTime('),
  'AdvancedReportsPage should still exercise report date/time formatting.'
);

assert.ok(
  /function\s+formatDateTime\s*\(/.test(reportsPage) || /import\s+\{[^}]*formatDateTime/.test(reportsPage),
  'AdvancedReportsPage references formatDateTime but does not define or import it.'
);

assert.ok(
  reportsPage.includes("return formatShopDateTime(value, dateOptions) || '—';"),
  'Reports date/time helper should show an em dash for missing or invalid values.'
);

console.log('Reports load checks passed.');
