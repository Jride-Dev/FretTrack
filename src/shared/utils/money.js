const ENV = import.meta.env || {};
const DEFAULT_CURRENCY = ENV.VITE_DEFAULT_CURRENCY || 'USD';
const DEFAULT_LOCALE = ENV.VITE_DEFAULT_LOCALE || undefined;

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar', symbol: '$', locale: 'en-US', taxLabel: 'Sales Tax' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: '\u00a3', locale: 'en-GB', taxLabel: 'VAT' }
];

export function getDefaultCurrency() {
  return DEFAULT_CURRENCY;
}

export function getSupportedCurrency(currencyCode = DEFAULT_CURRENCY) {
  const code = String(currencyCode || DEFAULT_CURRENCY).toUpperCase();
  return SUPPORTED_CURRENCIES.find((currency) => currency.code === code) || SUPPORTED_CURRENCIES[0];
}

export function getDefaultLocaleForCurrency(currencyCode = DEFAULT_CURRENCY) {
  return getSupportedCurrency(currencyCode).locale;
}

export function getCurrencyMinorUnit(currencyCode = DEFAULT_CURRENCY) {
  const code = String(currencyCode || DEFAULT_CURRENCY).toUpperCase();
  try {
    const parts = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: code
    }).resolvedOptions();

    return parts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function toMinorUnits(value, currencyCode = DEFAULT_CURRENCY) {
  const number = Number(value) || 0;
  const minorUnit = getCurrencyMinorUnit(currencyCode);
  return Math.round(number * (10 ** minorUnit));
}

export function fromMinorUnits(value, currencyCode = DEFAULT_CURRENCY) {
  const number = Number(value) || 0;
  const minorUnit = getCurrencyMinorUnit(currencyCode);
  return number / (10 ** minorUnit);
}

export function formatMoney(value, options = {}) {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    valueIsMinor = false
  } = options;

  const currencyCode = String(currency || DEFAULT_CURRENCY).toUpperCase();
  const number = valueIsMinor ? fromMinorUnits(value, currencyCode) : Number(value) || 0;

  try {
    return number.toLocaleString(locale, {
      style: 'currency',
      currency: currencyCode
    });
  } catch {
    return `${currencyCode} ${number.toFixed(getCurrencyMinorUnit(currencyCode))}`;
  }
}

export function formatMinorMoney(value, options = {}) {
  return formatMoney(value, { ...options, valueIsMinor: true });
}

export function money(value, options = {}) {
  return formatMoney(value, options);
}
