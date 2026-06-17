export const instrumentCatalog = {
  Electric: {
    brands: [
      'Alvarez',
      'Breedlove',
      'Charvel',
      'Cordoba',
      'Danelectro',
      "D'Angelico",
      'Eastman',
      'Epiphone',
      'ESP',
      'Fender',
      'G&L',
      'Gibson',
      'Godin',
      'Gretsch',
      'Guild',
      'Harley Benton',
      'Ibanez',
      'Jackson',
      'LTD',
      'Martin',
      'PRS',
      'Reverend',
      'Schecter',
      'Seagull',
      'Squier',
      'Takamine',
      'Taylor',
      'Washburn',
      'Yamaha'
    ],
    models: [
      'AZ',
      'Concert',
      'Custom 24',
      'Dreadnought',
      'ES-335',
      'Explorer',
      'Flying V',
      'Grand Auditorium',
      'Jaguar',
      'Jazzmaster',
      'Les Paul',
      'Mustang',
      'OM',
      'Pacifica',
      'Baritone',
      'Baritone Guitar',
      'RG',
      'Revstar',
      'S',
      'SE',
      'SG',
      'Stratocaster',
      'Streamliner',
      'Telecaster'
    ]
  },
  Acoustic: {
    brands: [
      'Alvarez',
      'Breedlove',
      'Cordoba',
      "D'Angelico",
      'Eastman',
      'Epiphone',
      'Gibson',
      'Godin',
      'Guild',
      'Ibanez',
      'Martin',
      'Ovation',
      'Seagull',
      'Takamine',
      'Taylor',
      'Washburn',
      'Yamaha'
    ],
    models: [
      '000',
      'Auditorium',
      'Concert',
      'Dreadnought',
      'Grand Auditorium',
      'Grand Concert',
      'Jumbo',
      'OM',
      'Parlor',
      'Travel'
    ]
  },
  Bass: {
    brands: [
      'Charvel',
      'Cort',
      'Dingwall',
      'Epiphone',
      'ESP',
      'Fender',
      'G&L',
      'Gibson',
      'Hofner',
      'Ibanez',
      'Jackson',
      'Lakland',
      'LTD',
      'Music Man',
      'Peavey',
      'Reverend',
      'Rickenbacker',
      'Sandberg',
      'Schecter',
      'Spector',
      'Squier',
      'Sterling',
      'Warwick',
      'Yamaha'
    ],
    models: [
      '4001',
      '4003',
      'BB',
      'Bongo',
      'BTB',
      'Combustion',
      'Corvette',
      'D-Roc',
      'EB Bass',
      'Euro',
      'Jazz Bass',
      'Mustang Bass',
      'NS',
      'Precision Bass',
      'SR',
      'Sterling',
      'StingRay',
      'Streamer',
      'Thunderbird',
      'TRBX',
      'Violin Bass'
    ]
  }
};

const instrumentTypeOptions = [
  { value: 'Acoustic', label: 'Acoustic' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Bass', label: 'Bass' }
];

const stringCountOptionsByType = {
  Electric: [5, 6, 7, 8],
  Bass: [4, 5, 6],
  Acoustic: [6, 12]
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

export function normalizeInstrumentType(instrumentType) {
  if (instrumentType === 'Bass') {
    return 'Bass';
  }
  if (instrumentType === 'Acoustic') {
    return 'Acoustic';
  }
  return 'Electric';
}

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
