export const SUPPORTED_DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

export function getDefaultDateFormatForLocale(locale = 'en-US') {
  const normalizedLocale = String(locale || '').toLowerCase();
  return normalizedLocale === 'en-gb' || normalizedLocale.startsWith('en-gb-')
    ? 'DD/MM/YYYY'
    : 'MM/DD/YYYY';
}

export function normalizeDateFormat(format = '', locale = 'en-US') {
  return SUPPORTED_DATE_FORMATS.includes(format) ? format : getDefaultDateFormatForLocale(locale);
}

export function formatShopDate(value, options = {}) {
  const date = parseDisplayDate(value);
  if (!date) return '';

  const format = normalizeDateFormat(options.dateFormat, options.locale);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }

  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }

  return `${month}/${day}/${year}`;
}

export function formatShopDateTime(value, options = {}) {
  const date = parseDisplayDate(value);
  if (!date) return '';

  const formattedDate = formatShopDate(date, options);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formattedDate} ${hours}:${minutes}`;
}

export function toIsoDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function parseDisplayDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value);
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
