import { formatLength, normalizeLengthUnit, normalizeMeasurementSystem } from '../../shared/utils/measurements.js';
import { formatMoney, getSupportedCurrency } from '../../shared/utils/money.js';

export const SHOP_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' }
];

const COUNTRY_DEFAULTS = {
  US: {
    countryCode: 'US',
    measurementSystem: 'imperial',
    lengthUnit: 'in',
    currencyCode: 'USD',
    locale: 'en-US',
    taxLabel: 'Sales Tax'
  },
  GB: {
    countryCode: 'GB',
    measurementSystem: 'metric',
    lengthUnit: 'mm',
    currencyCode: 'GBP',
    locale: 'en-GB',
    taxLabel: 'VAT'
  },
  CA: {
    countryCode: 'CA',
    measurementSystem: 'metric',
    lengthUnit: 'mm',
    currencyCode: 'CAD',
    locale: 'en-CA',
    taxLabel: 'GST'
  }
};

export function normalizeCountryCode(value = '', profile = {}) {
  const code = String(value || '').trim().toUpperCase();
  if (COUNTRY_DEFAULTS[code]) {
    return code;
  }
  const currencyCode = String(profile.currencyCode || profile.currency_code || '').toUpperCase();
  const locale = String(profile.locale || '').toLowerCase();
  if (currencyCode === 'GBP' || locale.startsWith('en-gb')) {
    return 'GB';
  }
  if (currencyCode === 'CAD' || locale.startsWith('en-ca')) {
    return 'CA';
  }
  return 'US';
}

export function getCountryLocalizationDefaults(countryCode = 'US') {
  return { ...COUNTRY_DEFAULTS[normalizeCountryCode(countryCode)] };
}

export function normalizeDefaultTaxRate(value) {
  if (value === '' || value == null) {
    return '';
  }
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('Default tax rate must be between 0 and 100.');
  }
  return String(rate);
}

export function resolveShopLocalization(shopProfile = {}) {
  const countryCode = normalizeCountryCode(shopProfile.countryCode || shopProfile.country_code, shopProfile);
  const defaults = getCountryLocalizationDefaults(countryCode);
  const currency = getSupportedCurrency(shopProfile.currencyCode || shopProfile.currency_code || defaults.currencyCode);
  const measurementSystem = normalizeMeasurementSystem(
    shopProfile.measurementSystem || shopProfile.measurement_system,
    defaults.measurementSystem
  );
  const lengthUnit = normalizeLengthUnit(
    shopProfile.lengthUnit || shopProfile.length_unit,
    measurementSystem === 'metric' ? 'mm' : defaults.lengthUnit
  );
  const defaultTaxRate = normalizeDefaultTaxRate(
    shopProfile.defaultTaxRate
      ?? shopProfile.default_tax_rate
      ?? shopProfile.salesTaxRate
      ?? shopProfile.sales_tax_rate
      ?? ''
  );

  return {
    shopId: shopProfile.shopId || shopProfile.shop_id || '',
    countryCode,
    measurementSystem,
    lengthUnit,
    currencyCode: currency.code,
    locale: String(shopProfile.locale || currency.locale || defaults.locale),
    taxLabel: String(shopProfile.taxLabel || shopProfile.tax_label || defaults.taxLabel).trim() || defaults.taxLabel,
    defaultTaxRate
  };
}

export function normalizeShopLocalizationSettings(shopProfile = {}) {
  const localization = resolveShopLocalization(shopProfile);
  return {
    ...shopProfile,
    countryCode: localization.countryCode,
    measurementSystem: localization.measurementSystem,
    lengthUnit: localization.lengthUnit,
    currencyCode: localization.currencyCode,
    locale: localization.locale,
    taxLabel: localization.taxLabel,
    defaultTaxRate: localization.defaultTaxRate,
    salesTaxRate: localization.defaultTaxRate
  };
}

export function applyCountryLocalizationDefaults(shopProfile = {}, countryCode = 'US') {
  const defaults = getCountryLocalizationDefaults(countryCode);
  const defaultTaxRate = shopProfile.defaultTaxRate ?? shopProfile.salesTaxRate ?? '';
  return {
    ...shopProfile,
    ...defaults,
    defaultTaxRate,
    salesTaxRate: defaultTaxRate
  };
}

export function getShopCurrencyCode(shopProfile) {
  return resolveShopLocalization(shopProfile).currencyCode;
}

export function getShopTaxLabel(shopProfile) {
  return resolveShopLocalization(shopProfile).taxLabel;
}

export function getShopDefaultTaxRate(shopProfile) {
  return resolveShopLocalization(shopProfile).defaultTaxRate;
}

export function getShopMeasurementPreference(shopProfile) {
  const localization = resolveShopLocalization(shopProfile);
  return {
    measurementSystem: localization.measurementSystem,
    lengthUnit: localization.lengthUnit
  };
}

export function formatShopCurrency(value, shopProfile) {
  const localization = resolveShopLocalization(shopProfile);
  return formatMoney(value, {
    currency: localization.currencyCode,
    locale: localization.locale
  });
}

export function formatActionMeasurement(value, shopProfile) {
  const localization = resolveShopLocalization(shopProfile);
  return formatLength(value, localization.lengthUnit);
}
