export const MEASUREMENT_SYSTEMS = ['imperial', 'metric'];
export const LENGTH_UNITS = ['in', 'mm'];

export function getDefaultMeasurementPreferences(settings = {}) {
  const currencyCode = String(settings.currencyCode || '').toUpperCase();
  const locale = String(settings.locale || '').toLowerCase();
  const metric = currencyCode === 'GBP' || locale === 'en-gb' || locale.startsWith('en-gb-');
  return {
    measurementSystem: metric ? 'metric' : 'imperial',
    lengthUnit: metric ? 'mm' : 'in'
  };
}

export function normalizeMeasurementSystem(value = '', fallback = 'imperial') {
  return value === 'metric' || value === 'imperial' ? value : fallback;
}

export function normalizeLengthUnit(value = '', fallback = 'in') {
  return value === 'mm' || value === 'in' ? value : fallback;
}

export function convertInchesToMm(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number * 25.4 : null;
}

export function convertMmToInches(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number / 25.4 : null;
}

export function parseLengthInput(input, unit = 'in') {
  const cleanUnit = normalizeLengthUnit(unit);
  const text = String(input ?? '').trim();
  if (!text) {
    return { value: '', unit: cleanUnit };
  }

  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\s*(mm|in|"))?$/i);
  if (!match) {
    return { value: text, unit: cleanUnit };
  }

  const parsedUnit = match[2] === '"' ? 'in' : normalizeLengthUnit(String(match[2] || cleanUnit).toLowerCase(), cleanUnit);
  return {
    value: match[1],
    unit: parsedUnit
  };
}

export function formatLength(value, unit = 'in') {
  if (value === '' || value == null) {
    return '';
  }

  const cleanUnit = normalizeLengthUnit(unit);
  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (/\b(mm|in)\b|"$/.test(text.toLowerCase())) {
    return text;
  }

  return `${text} ${cleanUnit}`;
}

export function getLengthUnitLabel(unit = 'in') {
  return normalizeLengthUnit(unit) === 'mm' ? 'mm' : 'in';
}
