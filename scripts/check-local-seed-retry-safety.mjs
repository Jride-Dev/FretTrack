import assert from 'node:assert/strict';
import fs from 'node:fs';

const seed = fs.readFileSync(new URL('./seed-local-test-shops.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/quality.yml', import.meta.url), 'utf8');

assert.match(seed, /const savedJob = await ensureSeedJob\(tx, jobPayload\)/, 'Shop seeding must use the retry-safe job helper.');
assert.match(seed, /select \* from jobs where id = \$\{jobPayload\.id\}::uuid limit 1/, 'Retry lookup must detect globally colliding deterministic job IDs.');
assert.match(seed, /async function ensureSeedJob[\s\S]*reset role[\s\S]*select \* from jobs where id = \$\{jobPayload\.id\}[\s\S]*set local role authenticated/, 'Global collision lookup must deliberately step outside owner RLS and then restore the owner role.');
assert.match(seed, /collisionRecoveryId = deterministicUuid/, 'A foreign-shop deterministic job collision must use a stable recovery ID.');
assert.match(seed, /assertSeedJobOwnership\(recoveredJob, jobPayload, collisionRecoveryId\)/, 'A recovered fixture job must still match the expected shop and customer.');
assert.doesNotMatch(seed, /insert into (?:job_parts|job_services|work_logs|job_images)[\s\S]{0,300}?on conflict \(id\) do nothing/, 'Mutable fixture child repair must not silently ignore deterministic rows attached to the wrong job.');
for (const table of ['job_parts', 'job_services', 'work_logs', 'job_images']) {
  assert.match(seed, new RegExp(`insert into ${table}[\\s\\S]{0,900}?on conflict \\(id\\) do update set[\\s\\S]{0,300}?job_id = excluded\\.job_id`), `${table} retries must reconcile deterministic child ownership.`);
}
assert.match(seed, /repairSeedEventOwnership\(tx, eventRows\)/, 'Immutable audit-event fixtures must use their explicit local repair path.');
assert.match(seed, /async function repairSeedEventOwnership[\s\S]*reset role[\s\S]*where job_events\.shop_id is distinct from excluded\.shop_id[\s\S]*job_events\.job_id is distinct from excluded\.job_id/, 'Audit-event fixture repair must use local postgres authority only for mismatched ownership.');
assert.match(seed, /existingJob\.customer_id[\s\S]*jobPayload\.customer_id/, 'An existing deterministic job must be checked against its expected customer.');
assert.match(seed, /if \(existingJob\)[\s\S]*return existingJob;[\s\S]*create_job_with_number/, 'An existing seed job must be reused before the numbered-job RPC advances its sequence.');
assert.match(workflow, /npm run test:e2e:seed\s+node scripts\/seed-local-test-shops\.mjs --no-report/, 'CI must retry the seed without a reset before browser tests.');

console.log('Local test-shop seed retry safety checks passed.');
