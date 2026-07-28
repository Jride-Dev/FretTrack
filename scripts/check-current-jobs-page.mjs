import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = (path) => readFileSync(join(root, path), 'utf8');

const page = source('src/modules/jobs/CurrentJobsPage.jsx');
const compactList = source('src/modules/jobs/JobList.jsx');
const app = source('src/app/App.jsx');
const styles = source('src/styles.css');

assert.ok(page.includes('<h2>Current Jobs</h2>'), 'Full Current Jobs page must exist.');
assert.ok(compactList.includes('className="panel current-jobs-summary"'), 'Compact Current Jobs must use a summary-specific container.');
assert.ok(compactList.includes('className="current-jobs-summary-list"'), 'Compact Current Jobs must use a summary-specific list.');
assert.ok(compactList.includes("'current-jobs-summary-item selected' : 'current-jobs-summary-item'"), 'Compact Current Jobs rows must use summary-specific item classes.');
assert.ok(!compactList.includes("className={job.id === selectedJobId ? 'job-row"), 'Compact Current Jobs must not use the legacy shared job-row class.');
assert.ok(app.includes("mode === 'list'"), 'Current Jobs application mode must exist.');
assert.ok(app.includes('<CurrentJobsPage') && app.includes('onSelectJob={handleSelectJob}'), 'Current Jobs mode must render the full page.');
assert.ok(compactList.includes('View all current jobs'), 'Dashboard summary must link to the full Current Jobs page.');
assert.ok(app.includes("onViewAll={() => navigateTo('list')}"), 'Dashboard link must use existing application navigation.');
assert.ok(page.includes('type="search"'), 'Current Jobs must include search.');
assert.ok(page.includes('Priority'), 'Current Jobs must include priority filtering and display.');
assert.ok(page.includes('Status'), 'Current Jobs must include status filtering.');
assert.ok(page.includes('Due within 7 days'), 'Current Jobs must support due-soon filtering.');
assert.ok(page.includes('<option value="active">Active jobs</option>'), 'Active jobs must be the default scope.');
assert.ok(page.includes("sortBy: 'priority'"), 'Priority sorting must be the default.');
for (const sortValue of ['priority', 'dateReceived', 'dueDate', 'jobNumber', 'status']) {
  assert.ok(page.includes(`value="${sortValue}"`), `Current Jobs must support ${sortValue} sorting.`);
}
assert.ok(page.includes('onClick={() => onSelectJob(job.id)}'), 'Clicking a current job must open existing Job Detail selection.');
assert.ok(page.includes('type="button"'), 'Current Jobs rows must remain keyboard-accessible buttons.');
assert.ok(page.includes("new Set(['completed', 'picked up', 'cancelled', 'archived'])"), 'Default current scope must exclude closed job statuses.');
assert.match(styles, /\.app-layout\.full-content\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'Current Jobs must use the full content width.');
assert.match(styles, /\.current-jobs-summary-item\s*\{[^}]*border-radius:\s*6px;[^}]*box-sizing:\s*border-box;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*width:\s*100%;/, 'Compact Current Jobs rows must be restrained and contained.');
const compactItemRule = styles.match(/\.current-jobs-summary-item\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(compactItemRule, /border-radius:\s*999px/, 'Compact Current Jobs rows must not use pill geometry.');
assert.match(styles, /\.current-jobs-summary\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/, 'Compact Current Jobs must not scroll horizontally.');
assert.match(styles, /\.current-jobs-page\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0[^}]*overflow:\s*hidden/, 'Current Jobs page must be contained.');
assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.current-job-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*min-width:\s*0/, 'Current Jobs must use contained cards on narrow screens.');
assert.ok(!styles.includes('.current-jobs-page .current-jobs-summary-item'), 'Full-page Current Jobs styles must not target compact summary items.');

const changed = [
  execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }),
  execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
].join('\n').split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'));
assert.ok(
  !changed.some((file) => file.startsWith('supabase/functions/') && file !== 'supabase/functions/send-email/index.ts'),
  'Current Jobs validation permits only the later usage-cap send-email integration.'
);
assert.ok(
  !changed.some((file) => file.startsWith('supabase/migrations/')
    && !file.endsWith('pro_team_assignment_foundation.sql')
    && !file.endsWith('email_photo_usage_caps_foundation.sql')
    && !file.endsWith('job_dates_scheduling_sync.sql')),
  'Current Jobs must not add unrelated migrations.'
);
assert.ok(!changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'Current Jobs must not modify landing Worker files.');
assert.ok(
  !changed.some((file) => /stripe/i.test(file)
    || (/\/billing\//i.test(file)
      && !file.endsWith('entitlementService.js')
      && !file.endsWith('usageCaps.js'))),
  'Current Jobs must not modify Stripe or unrelated billing files.'
);

console.log('Current Jobs page checks passed.');
