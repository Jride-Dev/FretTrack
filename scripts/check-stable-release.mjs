import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = (path) => readFileSync(join(root, path), 'utf8');
const expectedVersion = '0.3.0';

const packageJson = JSON.parse(source('package.json'));
const packageLock = JSON.parse(source('package-lock.json'));
const app = source('src/app/App.jsx');
const landingWorker = source('cloudflare/frettrack-coming-soon/src/index.js');
const publicFiles = [
  'cloudflare/frettrack-coming-soon/public/docs.html',
  'cloudflare/frettrack-coming-soon/public/privacy.html',
  'cloudflare/frettrack-coming-soon/public/support.html',
  'cloudflare/frettrack-coming-soon/public/terms.html',
  'cloudflare/frettrack-coming-soon/public/docs/release-notes.html',
  'cloudflare/frettrack-coming-soon/public/docs/faq.html',
  'cloudflare/frettrack-coming-soon/public/docs/getting-started.html',
  'cloudflare/frettrack-coming-soon/public/docs/shops-and-accounts.html',
  'cloudflare/frettrack-coming-soon/public/docs/troubleshooting.html'
];

assert.equal(packageJson.version, expectedVersion, 'package.json must carry the stable version.');
assert.equal(packageLock.version, expectedVersion, 'package-lock.json must carry the stable version.');
assert.equal(packageLock.packages[''].version, expectedVersion, 'The lockfile root package must carry the stable version.');
assert.match(app, new RegExp(`const APP_VERSION = '${expectedVersion.replaceAll('.', '\\.')}'`));

const landingPageStart = landingWorker.indexOf('function landingPage()');
const landingPageEnd = landingWorker.lastIndexOf('}', landingWorker.indexOf('export default')) + 1;
assert.ok(landingPageStart >= 0 && landingPageEnd > landingPageStart, 'Unable to isolate the landing-page source.');
const landingPage = landingWorker.slice(landingPageStart, landingPageEnd);

const customerFacingSources = [
  ['landing page', landingPage],
  ...publicFiles.map((path) => [path, source(path)]),
  ['account gate', source('src/modules/auth/AuthGate.jsx')],
  ['operator dashboard UI', source('src/modules/operator/BetaOperatorDashboard.jsx')],
  ['approval email', source('supabase/functions/notify-beta-approval/index.ts')]
];
const publicReleaseSources = [
  ['landing page', landingPage],
  ...publicFiles.map((path) => [path, source(path)]),
  ['account gate', source('src/modules/auth/AuthGate.jsx')],
  ['operator dashboard UI', source('src/modules/operator/BetaOperatorDashboard.jsx')]
];

const retiredCustomerPhrases = [
  /Request Beta Access/i,
  /Beta Tester Checklist/i,
  /Beta Operator Dashboard/i,
  /FretTrack beta login/i,
  /FretTrack beta access/i,
  /Welcome to the FretTrack beta/i,
  /invite-only beta/i,
  /paid beta period/i,
  /approved beta (?:account|email|access)/i
];

for (const [label, text] of customerFacingSources) {
  for (const pattern of retiredCustomerPhrases) {
    assert.doesNotMatch(text, pattern, `${label} still exposes retired customer wording: ${pattern}`);
  }
  assert.doesNotMatch(text, /0\.3\.0-(?:alpha|beta|rc)/i, `${label} must expose stable 0.3.0 wording.`);
}

for (const [label, text] of publicReleaseSources) {
  assert.doesNotMatch(text, /\bbeta\b|\btesters?\b|workflow testing|testing checklist/i, `${label} still exposes retired pre-release messaging.`);
}

assert.match(landingPage, /Request Access/);
assert.match(landingPage, /Release Notes/);
assert.doesNotMatch(landingPage, /testing-checklist|workflow-testing|beta-tester/i);
assert.match(landingWorker, /\['\/testing-checklist', '\/docs\/release-notes\.html'\]/);
assert.match(landingWorker, /\['\/docs\/workflow-testing', '\/docs\/release-notes\.html'\]/);
assert.match(source('cloudflare/frettrack-coming-soon/public/docs.html'), /Current release: v0\.3\.0/);
assert.match(source('supabase/functions/notify-beta-approval/index.ts'), /Your FretTrack access is approved/);

console.log('Stable release checks passed.');
