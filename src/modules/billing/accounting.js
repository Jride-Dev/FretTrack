export function rowQuantity(row) {
  return Number(row.quantity || 1);
}

export function retailTotal(row) {
  return (Number(row.retail) || 0) * rowQuantity(row);
}

export function sumRows(rows, key) {
  return rows.reduce((total, row) => total + ((Number(row[key]) || 0) * rowQuantity(row)), 0);
}

export function calculateJobTotals(job) {
  const parts = job.parts || [];
  const services = job.services || job.labor || [];
  const taxSettings = job.techDetails?.tax || {};
  const payments = job.techDetails?.payments || [];
  const billablePartsTotal = parts.reduce((total, row) => {
    return row.includedInService ? total : total + retailTotal(row);
  }, 0);
  const includedPartsTotal = parts.reduce((total, row) => {
    return row.includedInService ? total + retailTotal(row) : total;
  }, 0);
  const servicesTotal = sumRows(services, 'retail');
  const subtotal = billablePartsTotal + servicesTotal;
  const discountValue = Number(job.discountValue || 0);
  const discountAmount = job.discountType === 'percent'
    ? subtotal * (Math.max(0, Math.min(discountValue, 100)) / 100)
    : job.discountType === 'dollar'
      ? Math.min(Math.max(discountValue, 0), subtotal)
      : 0;
  const taxableAmount = (taxSettings.taxableParts ? billablePartsTotal : 0) + (taxSettings.taxableServices ? servicesTotal : 0);
  const salesTaxAmount = taxableAmount * ((Number(taxSettings.salesTaxRate) || 0) / 100);
  const totalDue = Math.max(subtotal - discountAmount, 0) + salesTaxAmount;
  const paidTotal = payments.reduce((total, row) => total + (Number(row.amount) || 0), 0);

  return {
    partsTotal: billablePartsTotal,
    includedPartsTotal,
    servicesTotal,
    subtotal,
    discountAmount,
    taxableAmount,
    salesTaxAmount,
    totalDue,
    paidTotal,
    balanceDue: Math.max(totalDue - paidTotal, 0)
  };
}

export function calculateJobAccounting(job) {
  const totals = calculateJobTotals(job);
  return {
    paidTotal: totals.paidTotal,
    salesTaxAmount: totals.salesTaxAmount,
    balanceDue: totals.balanceDue
  };
}
