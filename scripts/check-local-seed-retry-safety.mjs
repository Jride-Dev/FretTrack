import assert from 'node:assert/strict';
import fs from 'node:fs';

const seed = fs.readFileSync(new URL('./seed-local-test-shops.mjs', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/quality.yml', import.meta.url), 'utf8');

assert.match(seed, /const savedJob = await ensureSeedJob\(tx, jobPayload\)/, 'Shop seeding must use the retry-safe job helper.');
assert.match(seed, /where id = \$\{jobPayload\.id\}::uuid\s+and shop_id = \$\{jobPayload\.shop_id\}/, 'The retry lookup must use the deterministic job id within the current shop.');
assert.match(seed, /existingJob\.customer_id[\s\S]*jobPayload\.customer_id/, 'An existing deterministic job must be checked against its expected customer.');
assert.match(seed, /if \(existingJob\)[\s\S]*return existingJob;[\s\S]*create_job_with_number/, 'An existing seed job must be reused before the numbered-job RPC advances its sequence.');
assert.match(workflow, /npm run test:e2e:seed\s+node scripts\/seed-local-test-shops\.mjs --no-report/, 'CI must retry the seed without a reset before browser tests.');

console.log('Local test-shop seed retry safety checks passed.');
