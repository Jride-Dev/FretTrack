import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/modules/jobs/jobService.js'), 'utf8');

const helper = source.match(/async function syncReplaceableJobChildren[\s\S]*?\n}/)?.[0] || '';
assert.match(helper, /\.upsert\(rows, \{ onConflict: 'id' \}\)/, 'Billing children must be written before stale rows are removed.');
assert.match(helper, /if \(saveError\)[\s\S]*?throw new Error/, 'A child save error must reject the job save.');
assert.match(helper, /\.delete\(\)\.eq\('job_id', jobId\)/, 'Successful child writes must be followed by stale-row cleanup.');
assert.match(helper, /if \(cleanupError\)[\s\S]*?throw new Error/, 'A child cleanup error must reject the job save.');

assert.match(source, /syncReplaceableJobChildren\('job_parts', job\.id, partRows, 'Billing parts'\)/, 'Part persistence must use the guarded child sync.');
assert.match(source, /syncReplaceableJobChildren\('job_services', job\.id, serviceRows, 'Billing services'\)/, 'Service persistence must use the guarded child sync.');

console.log('Billing save integrity checks passed.');
