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

test('open work orders allocate invoice discounts proportionally across taxable charges', () => {
  const totals = calculateJobTotals({
    parts: [{ quantity: 1, retail: 100 }],
    services: [{ quantity: 1, retail: 100 }],
    discountType: 'dollar',
    discountValue: 20,
    techDetails: { payments: [] }
  }, {
    calculationMode: 'manual',
    taxableParts: true,
    taxableServices: false,
    salesTaxRate: 8.25
  });

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discountAmount, 20);
  assert.equal(totals.taxableBeforeDiscount, 100);
  assert.equal(totals.taxableDiscountAmount, 10);
  assert.equal(totals.taxableAmount, 90);
  assert.equal(totals.salesTaxAmount, 7.43);
  assert.equal(totals.totalDue, 187.43);
});

test('disabled tax mode ignores stale rates and taxable flags', () => {
  const totals = calculateJobTotals({
    parts: [{ quantity: 1, retail: 100 }],
    services: [],
    techDetails: { payments: [] }
  }, {
    calculationMode: 'disabled',
    taxableParts: true,
    taxableServices: true,
    salesTaxRate: 99
  });

  assert.equal(totals.taxableAmount, 0);
  assert.equal(totals.salesTaxAmount, 0);
  assert.equal(totals.totalDue, 100);
});
