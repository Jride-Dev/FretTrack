import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveJobTaxSettings } from '../src/modules/billing/jobTaxSettings.js';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260901025709_shop_tax_profile_boundary.sql');
const settings = read('src/modules/shops/ShopSettings.jsx');
const profileService = read('src/modules/shops/shopProfileService.js');
const jobForm = read('src/modules/jobs/JobForm.jsx');
const localSeed = read('scripts/seed-local-test-shops.mjs');
const billingActions = read('src/modules/jobs/useJobDetailBillingActions.js');

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
assert.ok(settings.includes("required={settings.taxCalculationMode === 'manual'}"), 'Disabled tax must not require a jurisdiction during shop onboarding.');
assert.ok(profileService.includes('tax_calculation_mode'), 'Shop profile persistence must store the calculation mode.');
assert.ok(jobForm.includes("rateSource: 'shop'"), 'New jobs must record the shop tax profile source.');
assert.match(localSeed, /tax_calculation_mode[\s\S]*?'manual'/, 'Tax-enabled local fixtures must explicitly opt into manual calculation.');
assert.match(billingActions, /saveDraftNow\(withTaxSnapshot\(draftJob, taxSettings\)\)/, 'Estimate and invoice finalization must persist the resolved tax snapshot first.');

assert.deepEqual(
  resolveJobTaxSettings({
    techDetails: { tax: { calculationMode: 'manual', rateSource: 'shop', salesTaxRate: '7.25', profileId: 'profile-1', profileRevision: 1, taxLabel: 'Sales Tax' } }
  }, {
    taxCalculationMode: 'manual', defaultTaxRate: '8.25', defaultTaxProfileId: 'profile-1', taxProfileRevision: 2, taxLabel: 'Changed Tax'
  }),
  {
    calculationMode: 'manual', rateSource: 'shop', salesTaxRate: '7.25', profileId: 'profile-1', profileRevision: 1,
    taxLabel: 'Sales Tax', state: '', taxRegistrationNumber: '', taxableParts: true, taxableServices: false,
    currencyCode: undefined, locale: undefined, dateFormat: undefined, measurementSystem: undefined, lengthUnit: undefined
  },
  'A work order must retain the tax profile values it captured instead of silently drifting when Shop Settings changes.'
);

assert.deepEqual(
  resolveJobTaxSettings({ techDetails: { tax: {} } }, {
    taxCalculationMode: 'manual', defaultTaxRate: '20', defaultTaxProfileId: 'profile-uk', taxProfileRevision: 3,
    taxState: 'United Kingdom', taxLabel: 'VAT', taxRegistrationNumber: 'GB-TEST', taxablePartsDefault: true,
    taxableServicesDefault: true, currencyCode: 'GBP', locale: 'en-GB', dateFormat: 'DD/MM/YYYY',
    measurementSystem: 'metric', lengthUnit: 'mm'
  }),
  {
    calculationMode: 'manual', profileId: 'profile-uk', profileRevision: 3, rateSource: 'shop', state: 'United Kingdom',
    salesTaxRate: '20', taxRegistrationNumber: 'GB-TEST', taxableParts: true, taxableServices: true,
    currencyCode: 'GBP', locale: 'en-GB', dateFormat: 'DD/MM/YYYY', taxLabel: 'VAT', measurementSystem: 'metric', lengthUnit: 'mm'
  },
  'A legacy work order without embedded tax settings must inherit the shop profile until that resolved snapshot is saved.'
);

console.log('Tax profile boundary checks passed.');
