import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const migrationPath = 'supabase/migrations/20260728094434_job_dates_scheduling_sync.sql';

assert.ok(existsSync(join(root, migrationPath)), 'The authoritative job-date sync migration must exist.');
const migration = read(migrationPath);
const statuses = read('src/modules/jobs/JobStatusSelect.jsx');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobInfo = read('src/modules/jobs/JobInfoSection.js');
const overview = read('src/modules/jobs/components/tabs/OverviewTab.jsx');
const jobService = read('src/modules/jobs/jobService.js');
const schedulingService = read('src/modules/scheduling/schedulingService.js');
const schedulingPage = read('src/modules/scheduling/SchedulingPage.jsx');
const detailsDialog = read('src/modules/scheduling/ScheduleEventDetailsDialog.jsx');
const jobSchedule = read('src/modules/scheduling/JobScheduleSection.jsx');
const packageJson = read('package.json');

assert.match(statuses, /JOB_STATUSES\s*=\s*\[[\s\S]*"Drop Off"[\s\S]*"Checked In"/, 'Drop Off must be part of the shared job status options.');
assert.match(migration, /jobs_status_check[\s\S]*'Drop Off'[\s\S]*'Checked In'[\s\S]*'Cancelled'/, 'The database must accept Drop Off while preserving existing statuses.');

for (const formSource of [jobForm, jobInfo]) {
  assert.ok(formSource.includes('Drop-off date and time'), 'Job forms must clearly label the drop-off date/time.');
  assert.match(formSource, /type="datetime-local"[\s\S]*name="dropOffAt"[\s\S]*disabled=\{!canWrite\}/, 'Drop-off editing must remain job-write permission gated.');
}
assert.match(overview, /Drop-off date and time[\s\S]*formatShopDateTime\(draftJob\.dropOffAt, dateOptions\)/, 'Job Detail must display drop-off using shop-aware date/time formatting.');
assert.match(jobService, /dropOffAt:\s*job\.dropOffAt \|\| job\.drop_off_at \|\| ''/, 'Legacy jobs without drop_off_at must normalize safely.');
assert.match(jobService, /drop_off_at:\s*job\.dropOffAt \? new Date\(job\.dropOffAt\)\.toISOString\(\) : null/, 'Job saves must persist an optional drop-off timestamp.');
assert.match(jobService, /dropOffAt:\s*job\.dropOffAt \? new Date\(job\.dropOffAt\)\.toISOString\(\) : ''/, 'The existing create-job JSON payload must carry a timezone-safe drop-off value through the numbered-job RPC.');

assert.match(migration, /add column if not exists drop_off_at timestamptz/, 'Jobs must have an optional drop-off timestamp.');
assert.match(migration, /generated_event_kind in \('job_drop_off', 'job_due'\)/, 'Generated events must use explicit drop-off and due kinds.');
assert.match(migration, /unique index[\s\S]*\(shop_id, job_id, generated_event_kind\)[\s\S]*where generated_event_kind is not null/i, 'Generated job dates must have a database-safe uniqueness rule.');
assert.equal((migration.match(/on conflict \(shop_id, job_id, generated_event_kind\)/g) || []).length, 3, 'Drop-off, due, and due backfill paths must use the same idempotent key.');
assert.match(migration, /new\.drop_off_at is null[\s\S]*generated_event_kind = 'job_drop_off'/, 'Clearing drop-off must remove only its generated event.');
assert.match(migration, /new\.promise_date is null[\s\S]*generated_event_kind = 'job_due'/, 'Clearing due date must remove only its generated event.');
assert.match(migration, /drop_off_at[\s\S]*do update set[\s\S]*starts_at = excluded\.starts_at/, 'Changing drop-off must update its existing event.');
assert.match(migration, /promise_date[\s\S]*do update set[\s\S]*starts_at = excluded\.starts_at/, 'Changing due date must update its existing event.');
assert.ok(!/delete from public\.schedule_events\s*;\s*/i.test(migration), 'Synchronization must never broadly delete schedule events.');
assert.match(migration, /where shop_id = new\.shop_id[\s\S]*job_id = new\.id[\s\S]*generated_event_kind = 'job_drop_off'/, 'Drop-off deletion must remain shop and job scoped.');
assert.match(migration, /where shop_id = new\.shop_id[\s\S]*job_id = new\.id[\s\S]*generated_event_kind = 'job_due'/, 'Due deletion must remain shop and job scoped.');
assert.match(migration, /before delete on public\.jobs[\s\S]*delete_generated_job_schedule_events/, 'Job deletion must remove generated events through an isolated trigger.');

assert.match(schedulingService, /generatedEventKind:\s*row\.generated_event_kind \|\| ''/, 'Scheduling reads must preserve the generated source kind.');
assert.ok(schedulingPage.includes('From job dates'), 'Week cards must identify job-generated dates.');
assert.ok(detailsDialog.includes('<DetailRow label="Source" value={sourceLabel} />'), 'Event details must show the generated source.');
assert.ok(jobSchedule.includes("|| 'Manual event'"), 'Job Scheduling must distinguish generated and manual events.');
assert.ok(packageJson.includes('"check:job-dates-scheduling-sync": "node scripts/check-job-dates-scheduling-sync.mjs"'), 'The focused package check must be exposed.');

const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));
const untrackedChanges = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));
const changedFiles = [...trackedChanges, ...untrackedChanges];
assert.ok(!changedFiles.some((file) => file.startsWith('supabase/functions/')), 'Edge Functions must not change.');
assert.ok(!changedFiles.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'Landing Worker files must not change.');
assert.ok(!changedFiles.some((file) => /stripe/i.test(file)), 'Stripe code must not change.');
assert.ok(!trackedChanges.includes('Screenshots/current_jobs_update7.jpg'), 'The protected screenshot must remain untouched.');
assert.ok(
  changedFiles.filter((file) => file.startsWith('supabase/migrations/')).every((file) => file === migrationPath),
  'This feature must not change an unrelated migration.'
);

console.log('Job dates and Scheduling sync checks passed.');
