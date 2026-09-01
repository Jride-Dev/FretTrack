import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260831224227_shop_tax_profile_boundary.sql');
const settings = read('src/modules/shops/ShopSettings.jsx');
const profileService = read('src/modules/shops/shopProfileService.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');

assert.match(migration, /tax_calculation_mode text not null default 'disabled'/, 'New shops must default to tax calculation disabled.');
assert.match(migration, /default_tax_profile_id uuid not null default gen_random_uuid/, 'Shop tax profiles must have a stable identity.');
assert.match(migration, /tax_profile_revision := old\.tax_profile_revision \+ 1/, 'Tax profile changes must increment a revision.');
assert.match(migration, /calculation_mode = 'disabled'[\s\S]*?tax_rate := 0/, 'Disabled job tax must calculate zero tax server-side.');
assert.match(migration, /'taxProfileId'[\s\S]*?'taxProfileRevision'[\s\S]*?'taxRegistrationNumber'/, 'Final snapshots must preserve tax provenance.');
assert.ok(settings.includes('Disabled — calculate no tax'), 'Shop Settings must make the disabled tax state explicit.');
assert.ok(settings.includes('FretTrack does not determine registrations'), 'Shop Settings must preserve the tax responsibility disclaimer.');
assert.ok(profileService.includes('tax_calculation_mode'), 'Shop profile persistence must store the calculation mode.');
assert.ok(jobForm.includes("rateSource: 'shop'"), 'New jobs must record the shop tax profile source.');

console.log('Tax profile boundary checks passed.');
