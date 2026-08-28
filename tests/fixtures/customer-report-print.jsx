import React from 'react';
import { createRoot } from 'react-dom/client';
import PrintDamageReport from '../../src/modules/print/PrintDamageReport.jsx';

const draftJob = {
  id: 'print-fixture-job',
  jobNumber: 'QA-0300',
  customerName: 'Morgan Rivera',
  phone: '(310) 555-0199',
  email: 'morgan@example.test',
  instrumentType: 'Electric',
  guitarBrand: 'Fender',
  model: 'American Professional II Stratocaster',
  serial: 'US23030001',
  dateReceived: '2026-08-27',
  reasonForVisit: 'Full setup, intermittent output, and documented finish condition before service.',
  workLog: [
    { id: 'log-1', timestamp: '2026-08-27T17:30:00Z', text: 'Cleaned controls and confirmed intermittent output at the jack.' },
    { id: 'log-2', timestamp: '2026-08-28T18:10:00Z', text: 'Completed setup, intonation, and final play test.' }
  ],
  techDetails: {
    instrumentType: 'Electric',
    neckInspection: {
      initial: {
        relief: '0.014', nutHighE: '0.022', nutLowE: '0.026', actionHighE12th: '0.078', actionLowE12th: '0.090',
        fretCondition: 'Light wear', neckCondition: 'Slight forward bow', trussRodStatus: 'Functional'
      },
      final: {
        relief: '0.010', nutHighE: '0.018', nutLowE: '0.022', actionHighE12th: '0.062', actionLowE12th: '0.072',
        fretCondition: 'Dressed and polished', neckCondition: 'Adjusted', trussRodStatus: 'Functional'
      }
    },
    damageMap: {
      liabilityAcknowledged: true,
      liabilityText: 'Customer reviewed the numbered condition notes before service and authorized the listed work.',
      views: {
        front: {
          imageUrl: '/instruments/elec_Front.png',
          marks: [
            { id: 'mark-1', x: 25, y: 36, area: 'Body', severity: 'Cosmetic', note: 'Small finish chip at lower bout.', recommendedRepair: 'Document only.' },
            { id: 'mark-2', x: 52, y: 57, area: 'Controls', severity: 'Structural', note: 'Output jack hardware loose.', recommendedRepair: 'Secure jack and inspect wiring.' },
            { id: 'mark-3', x: 78, y: 24, area: 'Neck', severity: 'Critical', note: 'Impact mark near headstock transition.', recommendedRepair: 'Inspect under magnification before adjustment.' }
          ]
        },
        back: { marks: [] },
        headstock: { marks: [] },
        serial_number: { marks: [] }
      }
    }
  }
};

const parts = [
  { id: 'part-1', sku: 'JACK-11', name: 'Switchcraft output jack', quantity: 1, retail: 12.5 },
  { id: 'part-2', sku: 'STR-1046', name: '10-46 string set', quantity: 1, retail: 9.99 }
];

const services = [
  { id: 'service-1', description: 'Full electric guitar setup and intonation', quantity: 1 },
  { id: 'service-2', description: 'Output jack inspection and replacement', quantity: 1 }
];

const shopSettings = {
  shopName: 'FretTrack Quality Assurance Shop',
  logoUrl: '/frettrack-wordmark.jpg',
  address: '123 Test Bench Way, Torrance, CA 90501',
  phone: '(310) 555-0100',
  email: 'service@example.test',
  currencyCode: 'USD',
  locale: 'en-US',
  dateFormat: 'MM/DD/YYYY'
};

createRoot(document.getElementById('root')).render(
  <PrintDamageReport
    draftJob={draftJob}
    formatInstrumentLabel={() => '6-string Electric Guitar'}
    formatMeasurementDelta={(initial, final, unit) => `${initial || '-'} to ${final || '-'} ${unit}`}
    lengthUnit="in"
    normalizeInstrumentType={(value) => value}
    outerStringLabels={{ treble: 'High E', bass: 'Low E' }}
    parts={parts}
    services={services}
    shopSettings={shopSettings}
    workOrderImages={[]}
  />
);
