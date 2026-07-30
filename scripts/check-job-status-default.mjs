import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migrationPath = 'supabase/migrations/20260730165555_job_status_default_consistency.sql';
const migration = read(migrationPath);
const statusMigration = read('supabase/migrations/20260728094434_job_dates_scheduling_sync.sql');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobService = read('src/modules/jobs/jobService.js');
const statusSelect = read('src/modules/jobs/JobStatusSelect.jsx');
const packageJson = JSON.parse(read('package.json'));

assert.match(
  migration,
  /alter table public\.jobs\s+alter column status set default 'Checked In';/i,
  'The jobs status default must match the app canonical status.'
);
assert.doesNotMatch(migration, /\bupdate\s+public\.jobs\b/i, 'The hotfix must not rewrite existing jobs.');
assert.doesNotMatch(migration, /drop constraint|add constraint/i, 'The hotfix must not replace status validation.');
assert.match(statusMigration, /'Checked In'/, 'The current jobs status constraint must allow Checked In.');
assert.match(jobForm, /status:\s*'Checked In'/, 'New Job must use Checked In.');
assert.match(jobService, /status:\s*job\.status\s*\|\|\s*'Checked In'/, 'Job persistence must use Checked In.');
assert.match(statusSelect, /["']Checked In["']/, 'The job status selector must expose Checked In.');
assert.equal(
  packageJson.scripts['check:job-status-default'],
  'node scripts/check-job-status-default.mjs',
  'The focused validation command must be registered.'
);

const forbiddenRoots = [
  'supabase/functions/',
  'cloudflare/frettrack-coming-soon/',
  'src/modules/billing/',
  'src/modules/auth/',
  'src/modules/scheduling/'
];
const statusLines = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const changedPaths = statusLines.map((line) => line.slice(3).replaceAll('\\', '/'));
assert.ok(
  changedPaths.every((file) => !forbiddenRoots.some((rootPath) => file.startsWith(rootPath))),
  'The focused hotfix must not include forbidden modules.'
);
const changedMigrations = changedPaths.filter((file) => file.startsWith('supabase/migrations/'));
const trackedMigration = execFileSync('git', ['ls-files', '--', migrationPath], { cwd: root, encoding: 'utf8' })
  .trim()
  .replaceAll('\\', '/');
assert.ok(
  trackedMigration === migrationPath || changedMigrations.includes(migrationPath),
  'The exact hotfix migration must be tracked or present as the current uncommitted migration.'
);
assert.ok(
  changedMigrations.every((file) => file === migrationPath),
  'No migration other than the focused status-default migration may change.'
);

console.log('Job status default regression checks passed.');
