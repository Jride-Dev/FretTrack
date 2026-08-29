import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function source(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(value, expected, message) {
  assert.ok(value.includes(expected), message || `Expected source to include ${expected}`);
}

function assertNotMatches(value, pattern, message) {
  assert.ok(!pattern.test(value), message || `Expected source not to match ${pattern}`);
}

function listFiles(relativeDir) {
  const absoluteDir = join(root, relativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).replace(`${root}\\`, '').replaceAll('\\', '/'));
}

function changedFiles() {
  const output = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  return `${output}\n${untracked}`.split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/'));
}

const jobForm = source('src/modules/jobs/JobForm.jsx');
const jobInfo = source('src/modules/jobs/JobInfoSection.js');
const jobService = source('src/modules/jobs/jobService.js');
const customerForm = source('src/modules/customers/CustomerForm.jsx');
const customerNormalize = source('src/modules/customers/customerNormalize.js');
const neckOptions = source('src/modules/jobs/neckInspectionOptions.js');
const neckSection = source('src/modules/jobs/NeckInspectionSection.js');
const privacyNote = source('docs/CUSTOMER_DATA_PRIVACY_NOTE.md');
const betaChecklist = source('docs/RELEASE_VALIDATION_CHECKLIST.md');
const docsReadme = source('docs/README.md');

for (const [label, value] of [
  ['new job intake', jobForm],
  ['job detail customer section', jobInfo],
  ['customer form', customerForm]
]) {
  assertIncludes(value, 'Postal Code / ZIP', `${label} must use the international postal-code label.`);
  assertNotMatches(value, />\s*(Zip Code|ZIP Code)\s*</, `${label} must not leave the old visible ZIP label.`);
}

assertIncludes(jobForm, 'inputMode="text"', 'New job postal code must allow alphanumeric entry.');
assertIncludes(jobInfo, 'inputMode="text"', 'Job detail postal code must allow alphanumeric entry.');
assertIncludes(customerForm, 'inputMode="text"', 'Customer postal code must allow alphanumeric entry.');
assertIncludes(jobForm, 'autoCapitalize="characters"', 'New job postal code should be friendly to UK postcode entry.');
assertIncludes(jobInfo, 'autoCapitalize="characters"', 'Job detail postal code should be friendly to UK postcode entry.');
assertIncludes(customerForm, 'autoCapitalize="characters"', 'Customer postal code should be friendly to UK postcode entry.');
assertNotMatches(jobForm + jobInfo + customerForm, /inputMode="numeric"[^>]*name="postalCode"|name="postalCode"[^>]*inputMode="numeric"/, 'Postal code inputs must not request numeric-only keyboards.');
assertNotMatches(jobForm + jobInfo + customerForm + jobService + customerNormalize, /postalCode[\s\S]{0,160}replace\(\s*\/\\D\/g/, 'Postal code handling must not strip non-digits.');
assertIncludes(jobService, "postalCode: String(postalCode || '').trim()", 'Job normalization must store trimmed postal-code values.');
assertIncludes(customerNormalize, "const postalCode = String(customer.postalCode || customer.postal_code || '').trim();", 'Customer normalization must store trimmed postal-code values.');

assertIncludes(neckOptions, "'Hump / rise at body joint'", 'Neck condition options must include the hump/rise wording.');
assertIncludes(neckSection, 'NECK_CONDITION_OPTIONS.map', 'Neck condition UI must render shared options.');
assertIncludes(neckOptions, "'Twist'", 'Twist must remain available.');

assertIncludes(privacyNote, '# Customer Data & Privacy Note for Beta Shops', 'Privacy note must exist with the requested title.');
assertIncludes(privacyNote, 'FretTrack is repair-shop workflow and recordkeeping software.', 'Privacy note must explain FretTrack purpose.');
assertIncludes(privacyNote, 'customer, instrument, job, photo, and repair data', 'Privacy note must cover entered data types.');
assertIncludes(privacyNote, 'shop-scoped and role-based', 'Privacy note must explain access model.');
assertIncludes(privacyNote, 'not intended for unnecessary sensitive personal information', 'Privacy note must avoid encouraging sensitive data entry.');
assertIncludes(privacyNote, 'remains responsible', 'Privacy note must preserve shop responsibility.');
assertIncludes(privacyNote, 'does not sell shop workflow or customer repair data', 'Privacy note must state the no-sale position.');
assertIncludes(privacyNote, 'https://frettrack-app.com/privacy', 'Privacy note must reference Privacy Policy.');
assertIncludes(privacyNote, 'https://frettrack-app.com/terms', 'Privacy note must reference Terms.');
assertNotMatches(privacyNote, /GDPR compliant|certified|certification/i, 'Privacy note must not claim GDPR compliance or formal certification.');
assertIncludes(betaChecklist, 'Customer Data & Privacy Note for Beta Shops', 'Beta checklist must reference the privacy note.');
assertIncludes(docsReadme, 'Customer Data & Privacy Note for Beta Shops', 'Docs index must reference the privacy note.');

const changed = changedFiles();
const forbiddenPaths = [
  'cloudflare/frettrack-coming-soon/src/index.js',
  'scripts/check-landing-worker.mjs',
  'images/Website/',
  'cloudflare/frettrack-coming-soon/public/community/',
  '.gitignore'
];

for (const forbiddenPath of forbiddenPaths) {
  assert.ok(!changed.some((file) => file === forbiddenPath || file.startsWith(forbiddenPath)), `${forbiddenPath} must not change in this branch.`);
}

assert.ok(!changed.some((file) => file.startsWith('supabase/functions/')), 'Edge Function files must not change in this branch.');
assert.ok(!changed.some((file) => file.startsWith('supabase/migrations/')), 'No Supabase migration must be added or changed in this branch.');

const migrationFiles = listFiles('supabase/migrations');
assert.ok(migrationFiles.length > 0, 'Expected existing Supabase migration history to be present for the no-new-migration check.');

console.log('Beta UK/privacy polish checks passed.');
