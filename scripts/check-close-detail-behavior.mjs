import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');

function functionSource(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `Expected to find ${signature}.`);
  const end = source.indexOf('\n  }', start);
  assert.ok(end > start, `Expected ${signature} to have a function body.`);
  return source.slice(start, end + 4);
}

const app = read('src/app/App.jsx');
const workspaceNavigation = read('src/app/useWorkspaceNavigation.js');
const workspaceRouter = read('src/app/WorkspaceRouter.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const jobDetailFormatting = read('src/modules/jobs/jobDetailFormatting.js');
const printActions = read('src/modules/jobs/PrintActions.js');
const packageJson = read('package.json');

const selectHandler = functionSource(workspaceNavigation, "function selectJob(jobId, detailMode = 'detail', { skipDirtyGuard = false } = {})");
const appCloseHandler = functionSource(workspaceNavigation, 'function closeJobDetail()');
const detailCloseHandler = functionSource(jobDetail, 'function closeDetail()');
const finishHandler = functionSource(jobDetail, 'async function finishJob()');

assert.match(printActions, /onClick=\{closeDetail\}>Close Detail<\/button>/, 'The visible Job Detail control must invoke its close handler.');
assert.match(detailCloseHandler, /if \(!confirmIfDirty\(\)\) \{\s*return;/, 'Close Detail must retain the existing dirty-state confirmation.');
assert.match(detailCloseHandler, /onDirtyChange\?\.\(false\);[\s\S]*onClose\(\);/, 'The dirty-aware Job Detail handler must delegate to the parent close callback.');

assert.match(workspaceNavigation, /const jobDetailReturnModeRef = useRef\('new'\);/, 'Workspace navigation must remember the page that opened Job Detail.');
assert.match(selectHandler, /if \(!\['detail', 'guitar-detail', 'amplifier-detail', 'keyboard-detail'\]\.includes\(mode\)\) \{\s*jobDetailReturnModeRef\.current = mode;/, 'Opening any repair detail must capture the underlying page without overwriting it during detail-to-detail selection.');
assert.match(appCloseHandler, /setMode\(jobDetailReturnModeRef\.current \|\| 'new'\);/, 'Closing Job Detail must return to the captured page.');
assert.doesNotMatch(appCloseHandler, /setSelectedJobId|showNewJob|updateJob|saveCurrentJob|status|Picked Up/, 'Closing Job Detail must not clear selection, create a new-job transition, save, or change completion state.');
assert.match(app, /closeJobDetail,[\s\S]*?resetWorkspaceNavigation/, 'App must use the extracted workspace close callback.');
assert.match(app, /onCloseJobDetail: closeJobDetail/, 'App must pass the corrected parent close callback across the workspace boundary.');
assert.match(workspaceRouter, /onClose=\{actions\.onCloseJobDetail\}/, 'Job Detail must receive the corrected parent close callback.');
assert.doesNotMatch(app, /onClose=\{\(\) => showNewJob\(null, \{ skipDirtyGuard: true \}\)\}/, 'The broken forced New Job callback must be removed.');

assert.match(finishHandler, /buildPickedUpJob\(draftJob, new Date\(\)\.toISOString\(\)\)/, 'Job completion must remain isolated in the Finish / Picked Up handler.');
assert.match(jobDetailFormatting, /function buildPickedUpJob\(currentJob, timestamp\)[\s\S]*?status: 'Picked Up'[\s\S]*?pickedUpAt: timestamp/, 'The picked-up helper must preserve the established job completion fields.');
assert.doesNotMatch(detailCloseHandler, /finishJob|Picked Up|status:/, 'The detail close handler must not complete the job.');
assert.match(packageJson, /"check:close-detail-behavior": "node scripts\/check-close-detail-behavior\.mjs"/, 'The focused close-detail check must be exposed.');

const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
const changed = [
  trackedChanges,
  execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
]
  .join('\n')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));

const keyboardRepairScope = new Set([
  'src/modules/auth/permissionService.js',
  'src/modules/billing/entitlementService.js',
  'supabase/migrations/20260817003514_pro_keyboard_repair_foundation.sql',
  'supabase/tests/database/keyboard_repair_rls.test.sql'
]);
const unrelatedChanged = changed.filter((file) => !keyboardRepairScope.has(file) && !file.startsWith('src/modules/keyboards/'));

assert.ok(!unrelatedChanged.some((file) => file.startsWith('supabase/')), 'Close Detail must not change unrelated Supabase files.');
assert.ok(!unrelatedChanged.some((file) => file.startsWith('src/modules/billing/')), 'Close Detail must not change unrelated billing files.');
assert.ok(!unrelatedChanged.some((file) => /stripe/i.test(file)), 'Close Detail must not change Stripe files.');
assert.ok(!unrelatedChanged.some((file) => file.startsWith('src/modules/auth/')), 'Close Detail must not change unrelated authentication or permission files.');
assert.ok(!unrelatedChanged.some((file) => file.startsWith('cloudflare/')), 'Close Detail must not change production Worker configuration.');
assert.ok(!unrelatedChanged.some((file) => file.includes('preloadRecovery') || file.includes('stale-chunk')), 'Close Detail must not change stale-chunk recovery.');
assert.ok(!trackedChanges.replaceAll('\\', '/').includes('Screenshots/current_jobs_update7.jpg'), 'The protected screenshot must remain untouched.');

console.log('Close Detail behavior checks passed.');
