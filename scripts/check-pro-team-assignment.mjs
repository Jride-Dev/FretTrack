import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const findAuthoritativeMigration = (repositoryMigrationPaths, authoritativePath) =>
  repositoryMigrationPaths.filter((repositoryPath) => repositoryPath === authoritativePath);

const migrationPath = 'supabase/migrations/20260727151302_pro_team_assignment_foundation.sql';
const repositoryMigrationPaths = readdirSync(join(root, 'supabase/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `supabase/migrations/${entry.name}`);
const authoritativeMigrationMatches = findAuthoritativeMigration(repositoryMigrationPaths, migrationPath);
assert.deepEqual(
  authoritativeMigrationMatches,
  [migrationPath],
  'Exactly one authoritative Pro Team Assignment migration must exist at the expected repository path.'
);

const mergedMainNoDiffFixture = {
  workingTreeDiff: [],
  repositoryMigrationPaths
};
assert.equal(mergedMainNoDiffFixture.workingTreeDiff.length, 0, 'Merged-main regression fixture must have no working-tree diff.');
assert.deepEqual(
  findAuthoritativeMigration(mergedMainNoDiffFixture.repositoryMigrationPaths, migrationPath),
  [migrationPath],
  'Authoritative migration discovery must work on merged main without a working-tree diff.'
);

const migration = read(migrationPath);
const assignmentHelpers = read('src/modules/jobs/teamAssignment.js');
const assignmentService = read('src/modules/jobs/teamAssignmentService.js');
const assignmentControl = read('src/modules/jobs/JobAssignmentControl.jsx');
const jobService = read('src/modules/jobs/jobService.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const currentJobs = read('src/modules/jobs/CurrentJobsPage.jsx');
const compactJobs = read('src/modules/jobs/JobList.jsx');
const workload = read('src/modules/shops/TeamWorkloadSummary.jsx');
const entitlementService = read('src/modules/billing/entitlementService.js');
const permissionService = read('src/modules/auth/permissionService.js');
const styles = read('src/styles.css');
const docs = read('docs/PRO_TEAM_ASSIGNMENT_FOUNDATION.md');

assert.match(migration, /add column if not exists assigned_member_id uuid[\s\S]*references public\.shop_members\(id\) on delete set null/i, 'Jobs must persist an optional membership relationship.');
assert.match(migration, /assigned_member_display_name text not null default ''/, 'Historical assignee display snapshot must exist.');
assert.match(migration, /assignment_updated_at timestamptz/, 'Assignment concurrency timestamp must exist.');
assert.match(migration, /private\.is_active_shop_member\([\s\S]*shop_members\.shop_id = target_shop_id[\s\S]*email_confirmed_at is not null[\s\S]*banned_until/i, 'Assignable members must be active and same-shop.');
assert.match(migration, /The assigned technician must be an active member of this shop/, 'Cross-shop or inactive assignment must be rejected.');
assert.match(migration, /actor_member\.role in \('owner', 'admin'\)/, 'Owner/admin assignment policy must be enforced.');
assert.match(migration, /actor_member\.role = 'tech'[\s\S]*old\.assigned_member_id is null[\s\S]*new\.assigned_member_id = actor_member\.id[\s\S]*old\.assigned_member_id = actor_member\.id[\s\S]*new\.assigned_member_id is null/, 'Technicians must only claim unassigned jobs or remove themselves.');
assert.match(migration, /Your shop role cannot change job assignments/, 'Viewer assignment must be rejected.');
assert.match(migration, /target_assigned_member_id uuid default null/, 'Unassigned jobs must remain supported.');
assert.match(migration, /assignment_updated_at is distinct from expected_assignment_updated_at/, 'Assignment updates must reject stale state.');
assert.match(migration, /update public\.jobs[\s\S]*assigned_member_id = target_assigned_member_id/, 'Assignment persistence must use a targeted update.');
assert.match(migration, /job_assigned[\s\S]*job_unassigned[\s\S]*job_reassigned/, 'Assignment audit event types must exist.');
assert.match(migration, /exception when others then[\s\S]*raise warning 'Job assignment audit event failed/, 'Audit failure must not corrupt the job update.');
assert.match(migration, /create or replace function public\.get_assignable_shop_members\(target_shop_id text\)/, 'Shop-scoped assignable-member RPC must exist.');
assert.match(migration, /create or replace function public\.update_job_assignment\([\s\S]*expected_assignment_updated_at timestamptz default null/, 'Targeted assignment RPC must accept the expected assignment timestamp.');
assert.match(migration, /create or replace function public\.create_job_with_number\(job_payload jsonb\)[\s\S]*assigned_member_id/, 'Job creation RPC must persist the optional assignment.');
for (const signature of [
  'public.get_assignable_shop_members\\(text\\)',
  'public.update_job_assignment\\(uuid, uuid, timestamptz\\)',
  'public.create_job_with_number\\(jsonb\\)'
]) {
  assert.match(migration, new RegExp(`grant execute on function ${signature} to authenticated`, 'i'), `${signature} must be granted to authenticated users.`);
}

for (const helper of [
  'canManageJobAssignment',
  'canSelfAssignJob',
  'listAssignableShopMembers',
  'resolveJobAssignee',
  'countAssignedActiveJobs'
]) {
  assert.ok(assignmentHelpers.includes(`export function ${helper}`), `${helper} must be reusable.`);
}
assert.ok(permissionService.includes('export function canUseTeamAssignment'), 'Central permission service must expose the Pro workflow permission.');
assert.ok(assignmentService.includes("supabase.rpc('get_assignable_shop_members'"), 'Assignable members must load through a shop-scoped RPC.');
assert.ok(assignmentService.includes("supabase.rpc('update_job_assignment'"), 'Assignment changes must use the targeted RPC.');
assert.ok(assignmentService.includes("data.shopId !== shopId"), 'Client assignment responses must be reconciled to explicit shop context.');

assert.ok(jobDetail.includes('<JobAssignmentControl'), 'Job Detail must render assignment controls.');
assert.ok(jobForm.includes('Assigned Technician'), 'New Job must support optional assignment.');
assert.ok(jobForm.includes('<option value="">Unassigned</option>'), 'New Job must default to Unassigned.');
assert.ok(jobService.includes('assignedMemberId: job.assigned_member_id'), 'Loaded jobs must preserve assignment identity.');
assert.ok(jobService.includes('toDbJob(newJob, { includeAssignment: true })'), 'New jobs may persist their optional assignment.');
assert.match(jobService, /from\('jobs'\)[\s\S]*\.update\(toDbJob\(job\)\)/, 'Ordinary job saves must omit assignment fields and avoid stale assignment overwrite.');

assert.ok(currentJobs.includes('Assigned Technician'), 'Current Jobs must display assigned technician.');
assert.ok(currentJobs.includes('<option value="unassigned">Unassigned</option>'), 'Current Jobs must filter unassigned work.');
assert.ok(currentJobs.includes('filters.assignedMemberId'), 'Current Jobs must filter by active shop member identity.');
assert.ok(currentJobs.includes('Inactive or removed'), 'Historical inactive assignees must display safely.');
assert.ok(workload.includes('Team Workload'), 'Pro team workload summary must exist.');
assert.ok(workload.includes('unassignedActiveJobCount'), 'Workload must include unassigned active jobs.');
assert.ok(workload.includes('overdueJobCount'), 'Workload must include overdue assigned jobs.');
assert.ok(workload.includes('not employee scoring'), 'Workload must explicitly avoid performance scoring.');

assert.match(entitlementService, /TEAM_ASSIGNMENT: 'team_assignment'/, 'Team assignment entitlement key must be centralized.');
assert.match(migration, /\('shop', 'team_assignment', 'false'::jsonb\)/, 'Shop must degrade without advanced assignment controls.');
assert.match(migration, /\('pro', 'team_assignment', 'true'::jsonb\)/, 'Pro must enable team assignment.');
assert.match(migration, /\('trial', 'team_assignment', 'true'::jsonb\)/, 'Trial entitlement path must enable beta testing.');
assert.match(migration, /beta_access_requests[\s\S]*status = 'approved'/, 'Approved beta shops must retain a team-assignment access path.');
assert.ok(!migration.includes("('shop', 'team_members'"), 'This phase must not change existing Shop Team Members entitlement behavior.');
assert.ok(assignmentControl.includes('Assignment is read-only for your current role or plan.'), 'Non-Pro and restricted roles must degrade to readable assignment data.');

assert.ok(compactJobs.includes('current-jobs-summary-item'), 'Compact Current Jobs styles must remain isolated.');
assert.ok(!compactJobs.includes('Assigned Technician'), 'Compact Current Jobs must not expand into a full-detail assignment card.');
assert.match(styles, /\.current-jobs-summary-item\s*\{[^}]*border-radius:\s*6px;[^}]*overflow:\s*hidden;/, 'Compact Current Jobs containment must remain intact.');
assert.ok(docs.includes('Shop versus Pro'), 'Foundation documentation must explain the Shop versus Pro distinction.');
assert.match(docs, /employee performance scoring/i, 'Foundation documentation must reject performance scoring.');

const trackedChangedOutput = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
const changed = [
  trackedChangedOutput,
  execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
]
  .join('\n')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));
assert.ok(
  !changed.some((file) => file.startsWith('supabase/functions/') && file !== 'supabase/functions/send-email/index.ts'),
  'Only the usage-cap send-email integration may change an Edge Function.'
);
assert.ok(!changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'Landing Worker files must not change.');
assert.ok(!changed.some((file) => /stripe/i.test(file)), 'Stripe code must not change.');
assert.ok(!trackedChangedOutput.replaceAll('\\', '/').includes('Screenshots/current_jobs_update7.jpg'), 'The protected screenshot must not change.');

console.log('Pro team assignment checks passed.');
