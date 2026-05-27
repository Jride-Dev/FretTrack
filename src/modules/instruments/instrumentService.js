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

export const STRING_COUNT_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 12];

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

  if (normalizedCount >= 7) {
    return { treble: 'High E', bass: 'Low B' };
  }

  return { treble: 'High E', bass: 'Low E' };
}
