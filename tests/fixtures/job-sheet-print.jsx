import React from 'react';
import { createRoot } from 'react-dom/client';
import PrintJobSheet from '../../src/modules/print/PrintJobSheet.jsx';

const draftJob = {
  id: 'job-sheet-amplifier-fixture',
  jobNumber: 'AMP-QA-0300',
  customerName: 'Jordan Lee',
  phone: '(310) 555-0167',
  email: 'jordan@example.test',
  instrumentType: 'Amplifier',
  guitarBrand: 'Fender',
  model: 'Deluxe Reverb',
  serial: 'DR-1965-QA',
  color: 'Blackface',
  dateReceived: '2026-08-27',
  status: 'Ready for Pickup',
  reasonForVisit: 'Intermittent output, hum, and power-tube inspection.',
  techDetails: {
    instrumentType: 'Amplifier',
    intakeType: 'walk_in',
    amplifier: {
      amplifierType: 'Combo',
      technology: 'Tube',
      diagnosis: 'Worn power tubes and oxidized input jack contacts.',
      repairPerformed: 'Replaced matched power-tube pair, cleaned contacts, and set bias.',
      partsReplaced: 'Matched 6V6 pair',
      benchTestNotes: 'Stable output at idle and under signal for 45 minutes.',
      finalTestStatus: 'Passed'
    },
    tax: { currencyCode: 'USD', locale: 'en-US', dateFormat: 'MM/DD/YYYY' }
  }
};

const services = [
  { id: 'service-1', description: 'Amplifier diagnosis and bench service', quantity: 1, retail: 125 },
  { id: 'service-2', description: 'Power-tube replacement and bias', quantity: 1, retail: 85 }
];

const parts = [
  { id: 'part-1', sku: '6V6-MP', name: 'Matched 6V6 power-tube pair', quantity: 1, retail: 64.5 },
  { id: 'part-2', sku: 'CLN-01', name: 'Contact cleaner', quantity: 1, retail: 6, includedInService: true }
];

const totals = {
  servicesTotal: 210,
  partsTotal: 64.5,
  includedPartsTotal: 6,
  subtotal: 274.5,
  discountAmount: 20,
  salesTaxAmount: 6.13,
  totalDue: 260.63,
  paidTotal: 100,
  balanceDue: 160.63
};

const shopSettings = {
  shopName: 'FretTrack Quality Assurance Shop',
  logoUrl: '/frettrack-wordmark.jpg',
  address: '123 Test Bench Way\nTorrance, CA 90501',
  phone: '(310) 555-0100',
  email: 'service@example.test',
  currencyCode: 'USD',
  locale: 'en-US',
  dateFormat: 'MM/DD/YYYY',
  taxLabel: 'Sales Tax'
};

createRoot(document.getElementById('root')).render(
  <PrintJobSheet
    draftJob={draftJob}
    formatInstrumentLabel={() => 'Tube Combo Amplifier'}
    normalizeInstrumentType={(value) => value}
    parts={parts}
    services={services}
    shopSettings={shopSettings}
    totals={totals}
  />
);
