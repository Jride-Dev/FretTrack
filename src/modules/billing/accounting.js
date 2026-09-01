export function rowQuantity(row) {
  return Number(row.quantity || 1);
}

export function retailTotal(row) {
  return (Number(row.retail) || 0) * rowQuantity(row);
}

export function sumRows(rows, key) {
  return rows.reduce((total, row) => total + ((Number(row[key]) || 0) * rowQuantity(row)), 0);
}

export function signedPaymentAmount(payment = {}) {
  const amount = Number(payment.amount) || 0;
  const type = String(payment.type || payment.eventType || '').trim().toLowerCase();
  if (type === 'refund' || type === 'void') {
    return -Math.abs(amount);
  }
  return amount;
}

export function calculateJobTotals(job, resolvedTaxSettings = null) {
  const parts = job.parts || [];
  const services = job.services || job.labor || [];
  const taxSettings = resolvedTaxSettings || job.techDetails?.tax || {};
  const payments = job.techDetails?.payments || [];
  const paidTotal = payments.reduce((total, row) => total + signedPaymentAmount(row), 0);
  const finalizedSnapshot = job.invoiceFinalizedAt && job.invoiceSnapshot?.version
    ? job.invoiceSnapshot
    : null;
  if (finalizedSnapshot) {
    const fromMinor = (value) => Number(value || 0) / 100;
    const totalDue = fromMinor(finalizedSnapshot.totalMinor);
    return {
      partsTotal: fromMinor(finalizedSnapshot.partsMinor),
      includedPartsTotal: fromMinor(finalizedSnapshot.includedPartsMinor),
      servicesTotal: fromMinor(finalizedSnapshot.servicesMinor),
      subtotal: fromMinor(finalizedSnapshot.subtotalMinor),
      discountAmount: fromMinor(finalizedSnapshot.discountMinor),
      taxableAmount: fromMinor(finalizedSnapshot.taxableMinor),
      salesTaxAmount: fromMinor(finalizedSnapshot.taxMinor),
      totalDue,
      paidTotal,
      balanceDue: roundCurrency(Math.max(totalDue - paidTotal, 0))
    };
  }
  const billablePartsTotal = parts.reduce((total, row) => {
    return row.includedInService ? total : total + roundCurrency(retailTotal(row));
  }, 0);
  const includedPartsTotal = parts.reduce((total, row) => {
    return row.includedInService ? total + roundCurrency(retailTotal(row)) : total;
  }, 0);
  const servicesTotal = services.reduce((total, row) => total + roundCurrency((Number(row.retail) || 0) * rowQuantity(row)), 0);
  const subtotal = roundCurrency(billablePartsTotal + servicesTotal);
  const discountValue = Number(job.discountValue || 0);
  const rawDiscountAmount = job.discountType === 'percent'
    ? subtotal * (Math.max(0, Math.min(discountValue, 100)) / 100)
    : job.discountType === 'dollar'
      ? Math.min(Math.max(discountValue, 0), subtotal)
      : 0;
  const discountAmount = roundCurrency(rawDiscountAmount);
  const taxCalculationMode = taxSettings.calculationMode
    || (Number(taxSettings.salesTaxRate) > 0 ? 'manual' : 'disabled');
  const taxableBeforeDiscount = taxCalculationMode === 'manual'
    ? (taxSettings.taxableParts ? billablePartsTotal : 0) + (taxSettings.taxableServices ? servicesTotal : 0)
    : 0;
  const taxableDiscountAmount = subtotal > 0
    ? roundCurrency(discountAmount * (taxableBeforeDiscount / subtotal))
    : 0;
  const taxableAmount = Math.max(taxableBeforeDiscount - taxableDiscountAmount, 0);
  const salesTaxRate = taxCalculationMode === 'manual' ? Number(taxSettings.salesTaxRate) || 0 : 0;
  const salesTaxAmount = roundCurrency(taxableAmount * (salesTaxRate / 100));
  const totalDue = roundCurrency(Math.max(subtotal - discountAmount, 0) + salesTaxAmount);
  return {
    partsTotal: billablePartsTotal,
    includedPartsTotal,
    servicesTotal,
    subtotal,
    discountAmount,
    taxableBeforeDiscount,
    taxableDiscountAmount,
    taxableAmount,
    salesTaxAmount,
    totalDue,
    paidTotal,
    balanceDue: roundCurrency(Math.max(totalDue - paidTotal, 0))
  };
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateJobAccounting(job, resolvedTaxSettings = null) {
  const totals = calculateJobTotals(job, resolvedTaxSettings);
  return {
    paidTotal: totals.paidTotal,
    salesTaxAmount: totals.salesTaxAmount,
    balanceDue: totals.balanceDue
  };
}
