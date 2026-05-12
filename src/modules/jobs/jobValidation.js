export function validateJobForSave(job) {
  const errors = [];

  if (!String(job.customerName || '').trim()) {
    errors.push('Customer name is required.');
  }

  if (!String(job.instrumentType || '').trim()) {
    errors.push('Instrument type is required.');
  }

  if (!String(job.status || '').trim()) {
    errors.push('Status is required.');
  }

  if (!allowsNegativePrices(job)) {
    const hasNegativePart = (job.parts || []).some(hasNegativePrice);
    const hasNegativeService = (job.services || job.labor || []).some(hasNegativePrice);
    if (hasNegativePart || hasNegativeService) {
      errors.push('Parts and services cannot save negative cost or retail prices unless negative prices are explicitly allowed.');
    }
  }

  if (errors.length) {
    throw new Error(errors.join(' '));
  }
}

function allowsNegativePrices(job) {
  return Boolean(job.allowNegativePrices || job.techDetails?.allowNegativePrices);
}

function hasNegativePrice(row) {
  return Number(row.cost || 0) < 0 || Number(row.retail || 0) < 0;
}
