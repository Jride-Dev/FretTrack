import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateJobTotals } from '../src/modules/billing/accounting.js';

test('finalized work orders render the stored server snapshot with live payment balance', () => {
  const totals = calculateJobTotals({
    invoiceFinalizedAt: '2026-08-31T00:00:00.000Z',
    invoiceSnapshot: {
      version: 1,
      partsMinor: 2000,
      includedPartsMinor: 300,
      servicesMinor: 3000,
      subtotalMinor: 5000,
      discountMinor: 500,
      taxableMinor: 5000,
      taxMinor: 500,
      totalMinor: 5000
    },
    parts: [{ quantity: 1, retail: 999 }],
    services: [],
    techDetails: {
      payments: [
        { amount: 20, type: 'payment' },
        { amount: 5, type: 'refund' }
      ]
    }
  });

  assert.deepEqual(totals, {
    partsTotal: 20,
    includedPartsTotal: 3,
    servicesTotal: 30,
    subtotal: 50,
    discountAmount: 5,
    taxableAmount: 50,
    salesTaxAmount: 5,
    totalDue: 50,
    paidTotal: 15,
    balanceDue: 35
  });
});
