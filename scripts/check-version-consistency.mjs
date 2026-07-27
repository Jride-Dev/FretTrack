import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const expectedVersion = '0.2.9-beta.3';
const source = (path) => readFileSync(join(root, path), 'utf8');
const packageJson = JSON.parse(source('package.json'));
const packageLock = JSON.parse(source('package-lock.json'));
const app = source('src/app/App.jsx');
const changelog = source('CHANGELOG.md');
const releaseNotes = source('docs/RELEASE_NOTES.md');
const readme = source('README.md');

assert.equal(packageJson.version, expectedVersion);
assert.equal(packageLock.version, expectedVersion);
assert.equal(packageLock.packages[''].version, expectedVersion);
assert.ok(app.includes(`const APP_VERSION = '${expectedVersion}';`), 'In-app visible version must match package metadata.');
assert.ok(changelog.includes(`Current version: \`${expectedVersion}\``), 'Changelog current-version marker must match.');
assert.ok(changelog.includes(`## v${expectedVersion} - Current Beta Candidate`), 'Current changelog heading must match.');
assert.ok(releaseNotes.includes(`## GitHub Release Summary: v${expectedVersion}`), 'Release-note heading must match.');
assert.ok(readme.includes(`Current version: \`${expectedVersion}\``), 'README current-version marker must match.');

for (const [label, value] of [
  ['package.json', source('package.json')],
  ['package-lock.json', source('package-lock.json')],
  ['App.jsx', app],
  ['CHANGELOG current header', changelog.slice(0, changelog.indexOf('## v0.2.8'))],
  ['RELEASE_NOTES current header', releaseNotes.slice(0, releaseNotes.indexOf('## Role And Permission Audit'))],
  ['README current header', readme.slice(0, 600)]
]) {
  assert.ok(!value.includes('0.2.9-beta.0'), `${label} still contains the superseded authoritative current version.`);
}

console.log('Version consistency checks passed.');
