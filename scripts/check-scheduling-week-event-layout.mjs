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

const schedulingPage = source('src/modules/scheduling/SchedulingPage.jsx');
const detailsDialog = source('src/modules/scheduling/ScheduleEventDetailsDialog.jsx');
const styles = source('src/styles.css');
const packageJson = source('package.json');

for (const constraint of ['min-width: 0', 'max-width: 100%', 'overflow: hidden', 'box-sizing: border-box']) {
  assertIncludes(styles, constraint, `Scheduling CSS must include ${constraint}.`);
}
assertMatches(styles, /\.schedule-card\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?min-width:\s*0[\s\S]*?overflow:\s*hidden[\s\S]*?width:\s*100%/, 'Week cards must remain inside their day column.');
assertIncludes(styles, '-webkit-line-clamp: 2', 'Long event titles must be clamped.');
assertIncludes(styles, 'text-overflow: ellipsis', 'Compact secondary event content must truncate.');
assertIncludes(schedulingPage, 'className={`schedule-card ${scheduleEvent.status}`}', 'All schedule event types, including shop blocks, must use the contained card.');
assertIncludes(schedulingPage, 'onClick={() => setSelectedEvent(scheduleEvent)}', 'Event cards must open the details dialog.');
assertMatches(schedulingPage, /<button[\s\S]*?className=\{`schedule-card/, 'Event cards must use a keyboard-accessible native button.');
assertIncludes(detailsDialog, 'role="dialog"', 'Event details must use an accessible dialog.');
assertIncludes(detailsDialog, 'aria-labelledby="schedule-event-details-title"', 'Event details must have an accessible title.');
assertIncludes(detailsDialog, "keyEvent.key === 'Escape'", 'Escape must dismiss the event details dialog.');
assertIncludes(detailsDialog, "const isShopBlock = event.eventType === 'shop_block';", 'Shop blocks must use the same details dialog with shop-block-specific fields.');
assertIncludes(detailsDialog, "!isShopBlock && <DetailRow label=\"Linked job\"", 'Shop blocks must not display misleading linked-job fields.');
assertIncludes(detailsDialog, 'canWrite && <button type="button" onClick={onEdit}', 'Edit must remain permission gated.');
assertIncludes(detailsDialog, 'canComplete && <button type="button" className="primary-action" onClick={onComplete}', 'Complete must remain permission gated.');
assertIncludes(detailsDialog, 'canReopen && <button type="button" onClick={onReopen}', 'Reopen must remain permission gated.');
assertIncludes(styles, 'max-height: min(90vh, 760px)', 'The details dialog must fit within the viewport.');
const smallScreenBreakpointStart = styles.indexOf('@media (max-width: 560px)');
const smallScreenBreakpointEnd = styles.indexOf('@media print', smallScreenBreakpointStart);
assert.ok(smallScreenBreakpointStart >= 0 && smallScreenBreakpointEnd > smallScreenBreakpointStart, 'Scheduling styles must keep the existing small-screen breakpoint.');
const smallScreenStyles = styles.slice(smallScreenBreakpointStart, smallScreenBreakpointEnd);
assertMatches(
  smallScreenStyles,
  /\.schedule-event-modal-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*\}/,
  'Small-screen dialog actions must stack in one contained column.'
);
assertMatches(
  smallScreenStyles,
  /\.schedule-event-modal-actions button\s*\{[^}]*box-sizing:\s*border-box;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*\}/,
  'Small-screen dialog action buttons must stretch without horizontal overflow.'
);
assertIncludes(packageJson, '"check:scheduling-week-event-layout": "node scripts/check-scheduling-week-event-layout.mjs"', 'Package script must expose the Scheduling layout check.');

const changed = changedFiles();
assert.ok(
  !changed.some((file) => file.startsWith('supabase/functions/') && file !== 'supabase/functions/send-email/index.ts'),
  'Only the later usage-cap send-email integration may change an Edge Function.'
);
assert.ok(
  !changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')),
  'Landing Worker files must not change for Scheduling layout polish.'
);
assert.ok(
  !changed.some((file) => file.startsWith('src/modules/billing/')
    && !file.endsWith('entitlementService.js')
    && !file.endsWith('usageCaps.js')),
  'Unrelated billing files must not change for Scheduling layout polish.'
);
const unrelatedMigrations = changed.filter((file) => (
  file.startsWith('supabase/migrations/')
  && !file.endsWith('_add_shop_country_localization.sql')
  && !file.endsWith('_pro_team_assignment_foundation.sql')
  && !file.endsWith('_email_photo_usage_caps_foundation.sql')
));
assert.equal(unrelatedMigrations.length, 0, 'Scheduling layout changes must not add unrelated Supabase migrations.');

console.log('Scheduling week-view event layout checks passed.');
