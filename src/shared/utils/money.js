const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'USD';
const DEFAULT_LOCALE = import.meta.env.VITE_DEFAULT_LOCALE || undefined;

export function getDefaultCurrency() {
  return DEFAULT_CURRENCY;
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
