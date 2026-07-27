import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

const {
  applyCountryLocalizationDefaults,
  formatActionMeasurement,
  formatShopCurrency,
  normalizeShopLocalizationSettings,
  resolveShopLocalization
} = await import('../src/modules/shops/shopLocalization.js');

function source(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function changedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  return `${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'));
}

const ukShop = {
  shopId: 'uk-shop',
  countryCode: 'GB',
  measurementSystem: 'metric',
  lengthUnit: 'mm',
  currencyCode: 'GBP',
  locale: 'en-GB',
  taxLabel: 'VAT',
  defaultTaxRate: 20
};
const usShop = {
  shopId: 'us-shop',
  countryCode: 'US',
  measurementSystem: 'imperial',
  lengthUnit: 'in',
  currencyCode: 'USD',
  locale: 'en-US',
  taxLabel: 'Sales Tax',
  defaultTaxRate: 8.25
};

assert.deepEqual(resolveShopLocalization(ukShop), { ...ukShop, defaultTaxRate: '20' });
assert.deepEqual(resolveShopLocalization(usShop), { ...usShop, defaultTaxRate: '8.25' });

const ukOutput = [
  formatShopCurrency(1234.5, ukShop),
  formatActionMeasurement(1.5, ukShop),
  resolveShopLocalization(ukShop).taxLabel
].join(' | ');
const usOutput = [
  formatShopCurrency(1234.5, usShop),
  formatActionMeasurement(1.5, usShop),
  resolveShopLocalization(usShop).taxLabel
].join(' | ');

assert.match(ukOutput, /£/);
assert.match(ukOutput, /\bmm\b/);
assert.match(ukOutput, /\bVAT\b/);
assert.doesNotMatch(ukOutput, /Sales Tax|\bin\b/);
assert.match(usOutput, /\$/);
assert.match(usOutput, /\bin\b/);
assert.match(usOutput, /Sales Tax/);
assert.doesNotMatch(usOutput, /£|\bVAT\b|\bmm\b/);

const normalizedUk = normalizeShopLocalizationSettings({ ...ukShop, shopName: 'UK Fixture Shop' });
const normalizedUs = normalizeShopLocalizationSettings({ ...usShop, shopName: 'US Fixture Shop' });
assert.equal(normalizedUk.defaultTaxRate, '20', 'UK custom default tax rate must survive shop normalization.');
assert.equal(normalizedUk.salesTaxRate, '20', 'The existing persisted sales_tax_rate field must receive the normalized default.');
assert.equal(normalizedUs.defaultTaxRate, '8.25', 'US custom default tax rate must survive shop normalization.');
assert.equal(normalizedUk.shopId, 'uk-shop');
assert.equal(normalizedUs.shopId, 'us-shop');

const ukSuggested = applyCountryLocalizationDefaults({ shopId: 'new-uk-shop', defaultTaxRate: '' }, 'GB');
assert.equal(ukSuggested.currencyCode, 'GBP');
assert.equal(ukSuggested.measurementSystem, 'metric');
assert.equal(ukSuggested.lengthUnit, 'mm');
assert.equal(ukSuggested.taxLabel, 'VAT');
assert.equal(ukSuggested.defaultTaxRate, '', 'FretTrack must not invent a UK VAT rate.');

const manualUkOverrides = resolveShopLocalization({
  countryCode: 'GB',
  currencyCode: 'USD',
  locale: 'en-US',
  measurementSystem: 'imperial',
  lengthUnit: 'in',
  taxLabel: 'Custom Tax',
  defaultTaxRate: 4
});
assert.equal(manualUkOverrides.currencyCode, 'USD');
assert.equal(manualUkOverrides.measurementSystem, 'imperial');
assert.equal(manualUkOverrides.taxLabel, 'Custom Tax');
assert.equal(manualUkOverrides.defaultTaxRate, '4');

const localizationSource = source('src/modules/shops/shopLocalization.js');
const profileSource = source('src/modules/shops/shopProfileService.js');
const settingsSource = source('src/modules/shops/ShopSettings.jsx');
const jobFormSource = source('src/modules/jobs/JobForm.jsx');
const emailSource = source('src/modules/jobs/emailDocuments.js');
assert.match(localizationSource, /export function formatShopCurrency[\s\S]*?formatMoney\(/, 'Shop currency formatting must use the shared money formatter.');
assert.ok(profileSource.includes('country_code: settings.countryCode'), 'Country must persist through shop_profiles.');
assert.ok(profileSource.includes('sales_tax_rate: Number(settings.defaultTaxRate'), 'Default tax rate must persist through the existing shop tax-rate column.');
assert.ok(profileSource.includes('normalizeShopLocalizationSettings(mergedSettings)'), 'Shop persistence must consume the tested localization normalization path.');
assert.ok(settingsSource.includes('applyCountryLocalizationDefaults'), 'Country suggestions must be an explicit Shop Settings action.');
assert.ok(settingsSource.includes('Choose Cancel to change only the country and preserve your current localization choices.'), 'Country changes must explain how manual overrides are preserved.');
assert.ok(jobFormSource.includes('shopProfile?.defaultTaxRate ?? shopProfile?.salesTaxRate'), 'New jobs must inherit the current shop default tax rate.');
assert.ok(emailSource.includes('resolveScopedShopEmailSettings(job, context.shopSettings)'), 'Generated documents must resolve the job shop context.');
assert.ok(emailSource.includes('currencyCode: cleanText(shopSettings.currencyCode'), 'Generated documents must carry scoped shop currency.');
assert.ok(emailSource.includes('taxLabel: cleanText(shopSettings.taxLabel'), 'Generated documents must carry the scoped shop tax label.');

const changed = changedFiles();
assert.ok(
  !changed.some((file) => file.startsWith('supabase/functions/') && file !== 'supabase/functions/send-email/index.ts'),
  'Localization validation permits only the later usage-cap send-email integration.'
);
assert.ok(!changed.some((file) => file.startsWith('cloudflare/frettrack-coming-soon/')), 'Localization must not modify landing Worker files.');
assert.ok(
  !changed.some((file) => /stripe/i.test(file)
    || (/\/billing\//i.test(file)
      && !file.endsWith('entitlementService.js')
      && !file.endsWith('usageCaps.js'))),
  'Localization must not modify Stripe or unrelated billing files.'
);

console.log('Shop localization checks passed.');
