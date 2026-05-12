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
