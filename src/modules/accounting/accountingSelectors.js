import { calculateJobTotals, retailTotal, rowQuantity } from '../billing/accounting.js';

const DEFAULT_RANGE_DAYS = 30;
const MONEY_EPSILON = 0.005;

export function getDefaultAccountingDateRange(now = new Date()) {
  const end = toDateInputValue(now);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - DEFAULT_RANGE_DAYS + 1);
  return {
    start: toDateInputValue(startDate),
    end
  };
}

export function buildAccountingReport(jobs = [], options = {}) {
  const shopId = options.shopId || '';
  const currencyCode = normalizeCurrencyCode(options.currencyCode || options.shopProfile?.currencyCode || 'USD');
  const locale = options.locale || options.shopProfile?.locale || 'en-US';
  const taxLabel = options.taxLabel || options.shopProfile?.taxLabel || (currencyCode === 'GBP' ? 'VAT' : 'Sales Tax');
  const range = normalizeDateRange(options);
  const scopedJobs = jobs
    .filter((job) => !shopId || job.shopId === shopId || job.shop_id === shopId)
    .map((job) => buildJobAccountingSnapshot(job, { currencyCode, locale, taxLabel }))
    .filter((snapshot) => snapshot.currencyCode === currencyCode);

  const jobsInRange = scopedJobs.filter((snapshot) => isDateInRange(snapshot.accountingDate, range));
  const paymentEvents = scopedJobs.flatMap((snapshot) => snapshot.paymentEvents)
    .filter((event) => isDateInRange(event.date, range));
  const adjustmentEvents = scopedJobs.flatMap((snapshot) => snapshot.adjustmentEvents)
    .filter((event) => isDateInRange(event.date, range));
  const openBalances = scopedJobs.filter((snapshot) => snapshot.balanceDue > MONEY_EPSILON);

  return {
    range,
    generatedAt: new Date().toISOString(),
    shopId,
    currencyCode,
    locale,
    taxLabel,
    summary: summarizeAccounting(jobsInRange, paymentEvents, adjustmentEvents, openBalances),
    dailyCloseout: groupSnapshotsByPeriod(jobsInRange, paymentEvents, adjustmentEvents, 'day'),
    monthlyTotals: groupSnapshotsByPeriod(jobsInRange, paymentEvents, adjustmentEvents, 'month'),
    yearlyTaxSummary: groupSnapshotsByPeriod(jobsInRange, paymentEvents, adjustmentEvents, 'year'),
    paymentsByMethod: groupPaymentsByMethod(paymentEvents),
    taxCollected: groupTaxCollected(jobsInRange),
    openBalances,
    jobs: jobsInRange,
    paymentEvents,
    adjustmentEvents
  };
}

export function buildJobAccountingSnapshot(job = {}, options = {}) {
  const totals = calculateJobTotals(job);
  const parts = job.parts || [];
  const services = job.services || job.labor || [];
  const taxSettings = job.techDetails?.tax || {};
  const payments = job.techDetails?.payments || [];
  const accountingDate = job.completedAt || job.pickedUpAt || job.jobDate || job.dateReceived || job.createdAt || job.updatedAt || '';
  const taxRatePercent = Number(taxSettings.salesTaxRate) || 0;
  const taxJurisdiction = taxSettings.jurisdiction || taxSettings.state || '';
  const currencyCode = normalizeCurrencyCode(taxSettings.currencyCode || options.currencyCode || 'USD');
  const locale = taxSettings.locale || options.locale || 'en-US';
  const taxLabel = taxSettings.taxLabel || options.taxLabel || (currencyCode === 'GBP' ? 'VAT' : 'Sales Tax');
  const partLines = parts.map((part) => {
    const quantity = rowQuantity(part);
    const retailAmount = part.includedInService ? 0 : retailTotal(part);
    return {
      id: part.id,
      category: 'part',
      description: part.name || 'Part',
      quantity,
      retailAmount,
      internalCost: (Number(part.cost) || 0) * quantity,
      taxable: taxSettings.taxableParts !== false && !part.includedInService,
      includedInService: Boolean(part.includedInService)
    };
  });
  const laborLines = services.map((service) => {
    const quantity = rowQuantity(service);
    return {
      id: service.id,
      category: 'labor',
      description: service.description || service.name || 'Labor',
      quantity,
      retailAmount: (Number(service.retail) || 0) * quantity,
      internalCost: (Number(service.cost) || 0) * quantity,
      taxable: Boolean(taxSettings.taxableServices)
    };
  });
  const feeLines = normalizeFeeLines(job);
  const discountLine = totals.discountAmount > 0 ? [{
    id: `${job.id || 'job'}:discount`,
    category: 'discount',
    description: formatDiscountDescription(job),
    quantity: 1,
    retailAmount: -totals.discountAmount,
    internalCost: 0,
    taxable: false
  }] : [];
  const lineItems = [...laborLines, ...partLines, ...feeLines, ...discountLine];
  const taxableSubtotal = totals.taxableAmount;
  const nonTaxableSubtotal = Math.max(totals.subtotal - taxableSubtotal, 0);
  const paymentEvents = payments.map((payment) => normalizePaymentEvent(payment, job));
  const adjustmentEvents = [
    ...discountLine.map((line) => ({
      id: line.id,
      jobId: job.id,
      jobNumber: job.jobNumber || job.job_number || '',
      date: accountingDate,
      type: 'discount',
      amount: Math.abs(line.retailAmount),
      note: line.description
    })),
    ...paymentEvents
      .filter((event) => event.type !== 'payment')
      .map((event) => ({
        id: event.id,
        jobId: event.jobId,
        jobNumber: event.jobNumber,
        date: event.date,
        type: event.type,
        amount: Math.abs(event.amount),
        note: event.note
      }))
  ];

  return {
    jobId: job.id,
    jobNumber: job.jobNumber || job.job_number || '',
    customerName: job.customerName || job.customer_name || '',
    shopId: job.shopId || job.shop_id || '',
    currencyCode,
    locale,
    taxLabel,
    status: job.status || '',
    accountingDate,
    partsRevenue: totals.partsTotal,
    partsInternalCost: partLines.reduce((total, line) => total + line.internalCost, 0),
    laborRevenue: totals.servicesTotal,
    feeRevenue: feeLines.reduce((total, line) => total + line.retailAmount, 0),
    discounts: totals.discountAmount,
    subtotal: totals.subtotal,
    taxableSubtotal,
    nonTaxableSubtotal,
    taxAmount: totals.salesTaxAmount,
    totalDue: totals.totalDue,
    paidTotal: totals.paidTotal,
    balanceDue: totals.balanceDue,
    taxSnapshot: {
      tax_rate_percent: taxRatePercent,
      tax_jurisdiction: taxJurisdiction,
      tax_label: taxLabel,
      tax_registration_number: taxSettings.taxRegistrationNumber || '',
      currency_code: currencyCode,
      locale,
      taxable_subtotal: taxableSubtotal,
      non_taxable_subtotal: nonTaxableSubtotal,
      tax_amount: totals.salesTaxAmount
    },
    lineItems,
    paymentEvents,
    adjustmentEvents
  };
}

export function summarizeAccounting(jobs, paymentEvents, adjustmentEvents, openBalances) {
  return {
    jobCount: jobs.length,
    jobTotals: sumBy(jobs, 'totalDue'),
    paidTotal: sumBy(paymentEvents, 'amount'),
    partsRevenue: sumBy(jobs, 'partsRevenue'),
    laborRevenue: sumBy(jobs, 'laborRevenue'),
    feeRevenue: sumBy(jobs, 'feeRevenue'),
    discounts: sumBy(jobs, 'discounts'),
    refundsAndVoids: sumBy(adjustmentEvents.filter((event) => event.type === 'refund' || event.type === 'void'), 'amount'),
    taxCollected: sumBy(jobs, 'taxAmount'),
    taxableSubtotal: sumBy(jobs, 'taxableSubtotal'),
    nonTaxableSubtotal: sumBy(jobs, 'nonTaxableSubtotal'),
    outstandingBalance: sumBy(openBalances, 'balanceDue')
  };
}

function groupSnapshotsByPeriod(jobs, paymentEvents, adjustmentEvents, period) {
  const groups = new Map();

  jobs.forEach((job) => {
    const key = getPeriodKey(job.accountingDate, period);
    const row = ensurePeriodRow(groups, key);
    row.jobCount += 1;
    row.jobTotals += job.totalDue;
    row.partsRevenue += job.partsRevenue;
    row.laborRevenue += job.laborRevenue;
    row.discounts += job.discounts;
    row.taxCollected += job.taxAmount;
  });

  paymentEvents.forEach((payment) => {
    const key = getPeriodKey(payment.date, period);
    const row = ensurePeriodRow(groups, key);
    row.paidTotal += payment.amount;
  });

  adjustmentEvents.forEach((event) => {
    const key = getPeriodKey(event.date, period);
    const row = ensurePeriodRow(groups, key);
    if (event.type === 'refund' || event.type === 'void') {
      row.refundsAndVoids += event.amount;
    }
  });

  return Array.from(groups.values()).sort((a, b) => a.period.localeCompare(b.period));
}

function groupPaymentsByMethod(paymentEvents) {
  const groups = new Map();
  paymentEvents.forEach((event) => {
    const method = event.method || 'Other';
    const current = groups.get(method) || { method, count: 0, amount: 0 };
    current.count += 1;
    current.amount += event.amount;
    groups.set(method, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount);
}

function groupTaxCollected(jobs) {
  const groups = new Map();
  jobs.forEach((job) => {
    const key = job.taxSnapshot.tax_jurisdiction || 'Unspecified';
    const current = groups.get(key) || {
      jurisdiction: key,
      taxRatePercent: job.taxSnapshot.tax_rate_percent,
      taxableSubtotal: 0,
      nonTaxableSubtotal: 0,
      taxAmount: 0
    };
    current.taxableSubtotal += job.taxableSubtotal;
    current.nonTaxableSubtotal += job.nonTaxableSubtotal;
    current.taxAmount += job.taxAmount;
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));
}

function normalizePaymentEvent(payment, job) {
  const amount = Number(payment.amount) || 0;
  const explicitType = String(payment.type || payment.eventType || '').toLowerCase();
  const type = explicitType || (amount < 0 ? 'refund' : 'payment');
  return {
    id: payment.id || `${job.id || 'job'}:${payment.date || 'payment'}:${payment.method || 'Other'}:${amount}`,
    jobId: job.id,
    jobNumber: job.jobNumber || job.job_number || '',
    customerName: job.customerName || job.customer_name || '',
    date: payment.date || job.updatedAt || job.dateReceived || '',
    method: payment.method || 'Other',
    amount,
    type,
    note: payment.note || ''
  };
}

function normalizeFeeLines(job) {
  const fees = job.fees || job.techDetails?.fees || [];
  return Array.isArray(fees) ? fees.map((fee) => ({
    id: fee.id,
    category: 'fee',
    description: fee.description || fee.name || 'Fee',
    quantity: rowQuantity(fee),
    retailAmount: (Number(fee.retail ?? fee.amount) || 0) * rowQuantity(fee),
    internalCost: 0,
    taxable: Boolean(fee.taxable)
  })) : [];
}

function formatDiscountDescription(job) {
  if (job.discountType === 'percent') {
    return `Discount (${Number(job.discountValue) || 0}%)`;
  }
  if (job.discountType === 'dollar') {
    return 'Discount';
  }
  return 'Discount';
}

function ensurePeriodRow(groups, period) {
  const key = period || 'Unspecified';
  if (!groups.has(key)) {
    groups.set(key, {
      period: key,
      jobCount: 0,
      jobTotals: 0,
      paidTotal: 0,
      partsRevenue: 0,
      laborRevenue: 0,
      discounts: 0,
      refundsAndVoids: 0,
      taxCollected: 0
    });
  }
  return groups.get(key);
}

function getPeriodKey(value, period) {
  const date = parseDate(value);
  if (!date) return 'Unspecified';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (period === 'year') return String(year);
  if (period === 'month') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function normalizeDateRange(options) {
  return {
    start: options.startDate || options.start || '',
    end: options.endDate || options.end || ''
  };
}

function isDateInRange(value, range) {
  const date = parseDate(value);
  if (!date) return false;
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  if (start && date < start) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (date > endOfDay) return false;
  }
  return true;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function sumBy(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function normalizeCurrencyCode(currencyCode) {
  const code = String(currencyCode || 'USD').toUpperCase();
  return code === 'GBP' ? 'GBP' : 'USD';
}
