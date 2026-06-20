import { INSTRUMENT_CATALOG } from './instrumentCatalog.js';

const instrumentTypeOptions = [
  { value: 'Electric', label: INSTRUMENT_CATALOG.Electric.label },
  { value: 'Acoustic', label: INSTRUMENT_CATALOG.Acoustic.label },
  { value: 'Bass', label: INSTRUMENT_CATALOG.Bass.label },
  { value: 'Classical', label: INSTRUMENT_CATALOG.Classical.label },
  { value: 'Other', label: INSTRUMENT_CATALOG.Other.label }
];

const stringCountOptionsByType = {
  Electric: [5, 6, 7, 8],
  Bass: [4, 5, 6],
  Acoustic: [6, 12],
  Classical: [6],
  Other: [4, 5, 6, 7, 8, 12]
};

export const STRING_COUNT_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 12];

const stringGaugePresets = [
  {
    id: 'electric-6-super-light-9-42',
    instrumentType: 'Electric',
    stringCount: 6,
    label: 'Super Light 9-42',
    gauges: ['.009', '.011', '.016', '.024', '.032', '.042']
  },
  {
    id: 'electric-6-regular-light-10-46',
    instrumentType: 'Electric',
    stringCount: 6,
    label: 'Regular Light / Standard 10-46',
    gauges: ['.010', '.013', '.017', '.026', '.036', '.046']
  },
  {
    id: 'electric-6-xl-10-52',
    instrumentType: 'Electric',
    stringCount: 6,
    label: "XL / D'Addario 10-52",
    gauges: ['.010', '.013', '.017', '.030', '.042', '.052']
  },
  {
    id: 'electric-7-standard-light-10-56',
    instrumentType: 'Electric',
    stringCount: 7,
    label: 'Standard Light 10-56',
    gauges: ['.010', '.013', '.017', '.026', '.036', '.046', '.056']
  },
  {
    id: 'electric-7-balanced-light-10-60',
    instrumentType: 'Electric',
    stringCount: 7,
    label: 'Balanced Light 10-60',
    gauges: ['.010', '.013', '.017', '.026', '.036', '.046', '.060']
  },
  {
    id: 'electric-8-super-light-9-65',
    instrumentType: 'Electric',
    stringCount: 8,
    label: 'Super Light 9-65',
    gauges: ['.009', '.011', '.016', '.024', '.032', '.042', '.054', '.065']
  },
  {
    id: 'electric-8-balanced-light-10-80',
    instrumentType: 'Electric',
    stringCount: 8,
    label: 'Balanced Light 10-80',
    gauges: ['.010', '.0135', '.017', '.026', '.036', '.048', '.060', '.080']
  },
  {
    id: 'acoustic-6-extra-light-10-47',
    instrumentType: 'Acoustic',
    stringCount: 6,
    label: 'Extra Light 10-47',
    gauges: ['.010', '.014', '.023', '.030', '.039', '.047']
  },
  {
    id: 'acoustic-6-custom-light-11-52',
    instrumentType: 'Acoustic',
    stringCount: 6,
    label: 'Custom Light / Light 11-52',
    gauges: ['.011', '.015', '.022', '.032', '.042', '.052']
  },
  {
    id: 'acoustic-6-medium-12-53',
    instrumentType: 'Acoustic',
    stringCount: 6,
    label: 'Medium 12-53',
    gauges: ['.012', '.016', '.025', '.035', '.045', '.053']
  },
  {
    id: 'acoustic-6-heavy-13-56',
    instrumentType: 'Acoustic',
    stringCount: 6,
    label: 'Heavy 13-56',
    gauges: ['.013', '.017', '.026', '.035', '.045', '.056']
  },
  {
    id: 'bass-4-custom-light-40-95',
    instrumentType: 'Bass',
    stringCount: 4,
    label: '4-string Custom Light 40-95',
    gauges: ['.040', '.060', '.075', '.095']
  },
  {
    id: 'bass-4-standard-light-45-105',
    instrumentType: 'Bass',
    stringCount: 4,
    label: '4-string Standard / Regular Light 45-105',
    gauges: ['.045', '.065', '.085', '.105']
  },
  {
    id: 'bass-4-medium-50-110',
    instrumentType: 'Bass',
    stringCount: 4,
    label: '4-string Medium 50-110',
    gauges: ['.050', '.070', '.090', '.110']
  },
  {
    id: 'bass-5-standard-light-45-130',
    instrumentType: 'Bass',
    stringCount: 5,
    label: '5-string Standard Light 45-130',
    gauges: ['.045', '.065', '.080', '.100', '.130']
  },
  {
    id: 'bass-5-medium-heavy-50-135',
    instrumentType: 'Bass',
    stringCount: 5,
    label: '5-string Medium / Heavy 50-135',
    gauges: ['.050', '.070', '.085', '.105', '.135']
  }
];

function cleanCatalogValue(value) {
  return String(value || '').trim();
}

function normalizeLookupValue(value) {
  return cleanCatalogValue(value).toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function getCatalogEntry(instrumentType) {
  const normalizedType = normalizeInstrumentType(instrumentType);
  if (normalizedType === 'Other') {
    return {
      ...INSTRUMENT_CATALOG.Other,
      brands: getMergedBrandCatalog()
    };
  }
  return INSTRUMENT_CATALOG[normalizedType] || INSTRUMENT_CATALOG.Electric;
}

function getMergedBrandCatalog() {
  return Object.values(INSTRUMENT_CATALOG).reduce((merged, entry) => {
    Object.entries(entry.brands || {}).forEach(([brand, models]) => {
      merged[brand] = uniqueSorted([...(merged[brand] || []), ...models]);
    });
    return merged;
  }, {});
}

function findCatalogBrand(instrumentType, brand) {
  const cleanedBrand = cleanCatalogValue(brand);
  if (!cleanedBrand) {
    return '';
  }

  const lookupBrand = normalizeLookupValue(cleanedBrand);
  const brands = getBrandsForInstrumentType(instrumentType);
  return brands.find((candidate) => normalizeLookupValue(candidate) === lookupBrand) || '';
}

function getAllKnownBrands() {
  return uniqueSorted(Object.keys(getMergedBrandCatalog()));
}

function getAllKnownModels() {
  return uniqueSorted(Object.values(getMergedBrandCatalog()).flat());
}

export function normalizeInstrumentType(instrumentType) {
  const cleanedType = cleanCatalogValue(instrumentType);
  const lookupType = normalizeLookupValue(cleanedType);

  if (!lookupType) {
    return 'Electric';
  }

  const matchedEntry = Object.entries(INSTRUMENT_CATALOG).find(([key, entry]) => {
    const labels = [key, entry.label, ...(entry.aliases || [])];
    return labels.some((label) => normalizeLookupValue(label) === lookupType);
  });

  return matchedEntry ? matchedEntry[0] : 'Electric';
}

export function normalizeBrand(brand, instrumentType = 'Electric') {
  const cleanedBrand = cleanCatalogValue(brand);
  if (!cleanedBrand) {
    return '';
  }

  return findCatalogBrand(instrumentType, cleanedBrand)
    || getAllKnownBrands().find((candidate) => normalizeLookupValue(candidate) === normalizeLookupValue(cleanedBrand))
    || cleanedBrand;
}

export function getBrandsForInstrumentType(instrumentType) {
  return uniqueSorted(Object.keys(getCatalogEntry(instrumentType).brands || {}));
}

export function getModelsForBrand(instrumentType, brand) {
  const matchedBrand = findCatalogBrand(instrumentType, brand);
  if (!matchedBrand) {
    return [];
  }

  return [...(getCatalogEntry(instrumentType).brands[matchedBrand] || [])];
}

export function isKnownBrand(instrumentType, brand) {
  return Boolean(findCatalogBrand(instrumentType, brand));
}

export function isKnownBrandForAnyInstrumentType(brand) {
  const lookupBrand = normalizeLookupValue(brand);
  return Boolean(lookupBrand && getAllKnownBrands().some((candidate) => normalizeLookupValue(candidate) === lookupBrand));
}

export function isKnownModel(instrumentType, brand, model) {
  const lookupModel = normalizeLookupValue(model);
  return Boolean(lookupModel && getModelsForBrand(instrumentType, brand).some((candidate) => normalizeLookupValue(candidate) === lookupModel));
}

export function isKnownModelForAnyBrand(model) {
  const lookupModel = normalizeLookupValue(model);
  return Boolean(lookupModel && getAllKnownModels().some((candidate) => normalizeLookupValue(candidate) === lookupModel));
}

export function shouldResetBrandForInstrumentType(instrumentType, brand) {
  return Boolean(cleanCatalogValue(brand) && isKnownBrandForAnyInstrumentType(brand) && !isKnownBrand(instrumentType, brand));
}

export function shouldResetModelForBrand(instrumentType, brand, model) {
  return Boolean(
    cleanCatalogValue(model)
    && isKnownBrand(instrumentType, brand)
    && isKnownModelForAnyBrand(model)
    && !isKnownModel(instrumentType, brand, model)
  );
}

export const instrumentCatalog = Object.fromEntries(
  Object.keys(INSTRUMENT_CATALOG).map((instrumentType) => [
    instrumentType,
    {
      brands: getBrandsForInstrumentType(instrumentType),
      models: uniqueSorted(Object.values(getCatalogEntry(instrumentType).brands || {}).flat()),
      modelsByBrand: getCatalogEntry(instrumentType).brands
    }
  ])
);

export function stringCountForInstrument(instrumentType) {
  return getDefaultStringCount(instrumentType);
}

export function getInstrumentTypeOptions() {
  return instrumentTypeOptions;
}

export function getStringCountOptions(instrumentType) {
  return stringCountOptionsByType[normalizeInstrumentType(instrumentType)] || stringCountOptionsByType.Electric;
}

export function getStringGaugePresets(instrumentType, stringCount) {
  const normalizedType = normalizeInstrumentType(instrumentType);
  const normalizedCount = normalizeStringCount(stringCount, normalizedType);
  return stringGaugePresets.filter((preset) => (
    preset.instrumentType === normalizedType && preset.stringCount === normalizedCount
  ));
}

export function getDefaultStringCount(instrumentType) {
  return normalizeInstrumentType(instrumentType) === 'Bass' ? 4 : 6;
}

export function normalizeStringCount(value, instrumentType = 'Electric') {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 24) {
    return Math.trunc(parsed);
  }

  return stringCountForInstrument(instrumentType);
}

export function resizeStringGauges(gauges = [], stringCount = 6) {
  const normalizedCount = normalizeStringCount(stringCount);
  const nextGauges = [...(Array.isArray(gauges) ? gauges : [])].slice(0, normalizedCount);
  while (nextGauges.length < normalizedCount) {
    nextGauges.push('');
  }
  return nextGauges;
}

export function getInstrumentStringCount(job = {}) {
  return normalizeStringCount(
    job.techDetails?.stringCount || job.stringCount || job.techDetails?.stringGauges?.length,
    job.instrumentType || job.techDetails?.instrumentType
  );
}

export function formatInstrumentLabel(job = {}) {
  const instrumentType = normalizeInstrumentType(job.instrumentType || job.techDetails?.instrumentType);
  const stringCount = getInstrumentStringCount(job);
  return `${instrumentType} (${stringCount}-string)`;
}

export function getGaugeSlotLabel(index, stringCount, instrumentType = 'Electric') {
  const normalizedCount = normalizeStringCount(stringCount, instrumentType);
  const outerLabels = getOuterStringLabels(instrumentType, normalizedCount);

  if (index === 0) {
    return outerLabels.treble;
  }
  if (index === normalizedCount - 1) {
    return outerLabels.bass;
  }
  return String(index + 1);
}

export function getOuterStringLabels(instrumentType = 'Electric', stringCount = stringCountForInstrument(instrumentType)) {
  const normalizedType = normalizeInstrumentType(instrumentType);
  const normalizedCount = normalizeStringCount(stringCount, normalizedType);

  if (normalizedType === 'Bass') {
    if (normalizedCount >= 6) {
      return { treble: 'High C', bass: 'Low B' };
    }
    if (normalizedCount >= 5) {
      return { treble: 'High G', bass: 'Low B' };
    }
    return { treble: 'High G', bass: 'Low E' };
  }

  if (normalizedType === 'Acoustic') {
    return { treble: 'High E', bass: 'Low E' };
  }

  if (normalizedCount >= 8) {
    return { treble: 'High E', bass: 'Low F#' };
  }

  if (normalizedCount >= 7) {
    return { treble: 'High E', bass: 'Low B' };
  }

  return { treble: 'High E', bass: 'Low E' };
}
