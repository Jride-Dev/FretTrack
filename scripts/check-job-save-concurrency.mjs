import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mutations = readFileSync(join(root, 'src/modules/jobs/jobServiceMutations.js'), 'utf8');
const detail = readFileSync(join(root, 'src/modules/jobs/JobDetail.jsx'), 'utf8');
const updateJobSource = mutations.slice(
  mutations.indexOf('export async function updateJob'),
  mutations.indexOf('export async function setJobAccountingVoid')
);
const guardedBranchStart = updateJobSource.indexOf('if (expectedUpdatedAt)');
const guardedParentUpdate = updateJobSource.indexOf('await updateSupabaseJob(job, { expectedUpdatedAt })', guardedBranchStart);
const guardedCustomerSync = updateJobSource.indexOf('await ensureCustomerForJob(job)', guardedBranchStart);

assert.ok(guardedBranchStart >= 0, 'Existing work-order saves must retain a version-guarded branch.');
assert.ok(guardedParentUpdate >= 0, 'Versioned saves must atomically compare the loaded work-order version.');
assert.ok(guardedCustomerSync > guardedParentUpdate, 'Customer synchronization must not run until the guarded parent update succeeds.');
assert.match(
  updateJobSource,
  /savedCustomer\.id !== job\.customerId[\s\S]*?linkCustomerToVersionedJob\(job, savedCustomer\.id\)/,
  'A newly created customer must use the narrowly scoped versioned link path.'
);
assert.match(
  mutations,
  /function linkCustomerToVersionedJob[\s\S]*?\.update\(\{ customer_id: customerId \}\)[\s\S]*?\.eq\('updated_at', job\.updatedAt\)[\s\S]*?createJobSaveConflictError/,
  'Customer linking must update only customer_id and reject a work order changed after the parent save.'
);
assert.match(
  mutations,
  /if \(error\.code === JOB_SAVE_CONFLICT_CODE\) \{\s*throw error;/,
  'A stale work-order save must surface the recognizable conflict instead of reporting success.'
);
assert.match(
  detail,
  /if \(!jobToSave\.updatedAt\)[\s\S]*?onUpdate\(jobToSave, \{ expectedUpdatedAt: jobToSave\.updatedAt \}\)/,
  'The shared work-order surface must submit the version loaded by the editing session.'
);

console.log('Job save concurrency checks passed.');
