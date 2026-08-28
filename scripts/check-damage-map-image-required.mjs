import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function source(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function changedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  return `${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'));
}

function assertIncludes(value, expected, message) {
  assert.ok(value.includes(expected), message || `Expected source to include ${expected}`);
}

function assertMatches(value, pattern, message) {
  assert.ok(pattern.test(value), message || `Expected source to match ${pattern}`);
}

const damageMap = source('src/components/DamageMap.js');
const styles = source('src/styles.css');
const printDamageMapFigure = source('src/modules/print/PrintDamageMapFigure.jsx');
const emailDocuments = source('src/modules/jobs/emailDocuments.js');
const packageJson = source('package.json');

assertIncludes(damageMap, 'Add or select a damage map image before marking damage.', 'Damage Map empty state must explain what to do first.');
assertIncludes(damageMap, 'Damage markers need a reference image so their position can be documented accurately.', 'Damage Map empty state must explain why an image is required.');
assertIncludes(damageMap, "const DAMAGE_MAP_IMAGE_REQUIRED_MESSAGE = 'Choose a damage map image before adding damage markers.'", 'Damage Map must expose a user-friendly warning.');
assertIncludes(damageMap, 'function hasDamageMapBaseImage', 'Damage Map must centralize base-image detection.');
assertIncludes(damageMap, 'const hasBaseImage = hasDamageMapBaseImage(currentView);', 'Damage Map must check the selected view for an image/template/photo.');
assertMatches(damageMap, /function addMark[\s\S]*?if \(!hasBaseImage\) \{[\s\S]*?setImportError\(DAMAGE_MAP_IMAGE_REQUIRED_MESSAGE\);[\s\S]*?return;[\s\S]*?getBoundingClientRect/, 'Click/tap marker placement must be guarded before coordinates are calculated.');
assertMatches(damageMap, /function updateCurrentView[\s\S]*?!hasBaseImage[\s\S]*?Array\.isArray\(patch\.marks\)[\s\S]*?patch\.marks\.length > marks\.length[\s\S]*?setImportError\(DAMAGE_MAP_IMAGE_REQUIRED_MESSAGE\)/, 'Internal add/save marker path must block new marks without a base image.');
assertIncludes(damageMap, 'aria-disabled={!hasBaseImage}', 'No-image canvas must advertise a disabled marking state.');
assertIncludes(damageMap, 'disabled={!canWrite}', 'Existing write permissions must still control Damage Map editing.');
assertIncludes(damageMap, '{hasBaseImage && (', 'Marker rendering must remain tied to image-backed views.');
assertIncludes(damageMap, '{hasBaseImage && marks.length > 0 && (', 'Damage mark edit controls must remain hidden without a base image.');
assertIncludes(styles, '.damage-canvas[aria-disabled="true"]', 'No-image damage canvas must not use the active marking cursor.');
assertIncludes(printDamageMapFigure, 'A condition image was recorded, but it is not currently available for this report.', 'Customer-facing print report must avoid misleading no-image marker output.');
assertMatches(printDamageMapFigure, /imageStatus === 'loaded' && marks\.length > 0/, 'Customer-facing report marker tables must require a successfully loaded image.');
assertIncludes(emailDocuments, 'No damage map image was attached.', 'Customer-facing email document must explain missing damage map images.');
assertMatches(emailDocuments, /if \(!hasBaseImage\) \{[\s\S]*?return \[\];[\s\S]*?\}/, 'Email document damage rows must ignore marks without a base image.');
assertIncludes(packageJson, '"check:damage-map-image-required": "node scripts/check-damage-map-image-required.mjs"', 'Package script must expose the Damage Map image-required check.');

const changed = changedFiles();
assert.ok(
  !changed.some((file) => file.startsWith('supabase/migrations/')
    && !file.endsWith('_email_photo_usage_caps_foundation.sql')
    && !file.endsWith('_job_dates_scheduling_sync.sql')),
  'Only reviewed later feature migrations may change Supabase schema after Damage Map gating.'
);
assert.ok(
  !changed.some((file) => file.startsWith('supabase/functions/')
    && file !== 'supabase/functions/send-email/index.ts'),
  'Only the later usage-cap email integration may change Edge Functions.'
);
assert.ok(
  !changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')),
  'Landing Worker files must not change for Damage Map image gating.'
);

console.log('Damage Map image-required checks passed.');
