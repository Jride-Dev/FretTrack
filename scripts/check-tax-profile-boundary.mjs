import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveJobTaxSettings } from '../src/modules/billing/jobTaxSettings.js';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260901025709_shop_tax_profile_boundary.sql');
const settings = read('src/modules/shops/ShopSettings.jsx');
const profileService = read('src/modules/shops/shopProfileService.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');

assert.match(migration, /tax_calculation_mode text not null default 'disabled'/, 'New shops must default to tax calculation disabled.');
assert.match(migration, /default_tax_profile_id uuid not null default gen_random_uuid/, 'Shop tax profiles must have a stable identity.');
assert.match(migration, /tax_profile_revision := old\.tax_profile_revision \+ 1/, 'Tax profile changes must increment a revision.');
assert.match(migration, /Default tax profile identity cannot be changed directly/, 'Stable tax profile identity must be database protected.');
assert.match(migration, /revoke insert, update, delete on public\.tax_profiles from authenticated/, 'Default tax profiles must only change through guarded shop settings.');
assert.match(migration, /calculation_mode = 'disabled'[\s\S]*?tax_rate := 0/, 'Disabled job tax must calculate zero tax server-side.');
assert.match(migration, /taxable_discount_minor := round/, 'Invoice-wide discounts must be allocated to the taxable base.');
assert.match(migration, /'taxProfileId'[\s\S]*?'taxProfileRevision'[\s\S]*?'taxRegistrationNumber'/, 'Final snapshots must preserve tax provenance.');
assert.ok(settings.includes('Disabled — calculate no tax'), 'Shop Settings must make the disabled tax state explicit.');
assert.ok(settings.includes('FretTrack does not determine registrations'), 'Shop Settings must preserve the tax responsibility disclaimer.');
assert.ok(profileService.includes('tax_calculation_mode'), 'Shop profile persistence must store the calculation mode.');
assert.ok(jobForm.includes("rateSource: 'shop'"), 'New jobs must record the shop tax profile source.');

assert.deepEqual(
  resolveJobTaxSettings({
    techDetails: { tax: { calculationMode: 'manual', rateSource: 'shop', salesTaxRate: '7.25', profileId: 'profile-1', profileRevision: 1, taxLabel: 'Sales Tax' } }
  }, {
    taxCalculationMode: 'manual', defaultTaxRate: '8.25', defaultTaxProfileId: 'profile-1', taxProfileRevision: 2, taxLabel: 'Changed Tax'
  }),
  {
    calculationMode: 'manual', rateSource: 'shop', salesTaxRate: '7.25', profileId: 'profile-1', profileRevision: 1,
    taxLabel: 'Sales Tax', taxableParts: true, taxableServices: false, currencyCode: undefined, locale: undefined, dateFormat: undefined
  },
  'A work order must retain the tax profile values it captured instead of silently drifting when Shop Settings changes.'
);

console.log('Tax profile boundary checks passed.');
