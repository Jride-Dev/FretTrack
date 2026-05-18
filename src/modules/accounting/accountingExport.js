import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat.js';

export function buildAccountingCsv(report, options = {}) {
  const includeInternalCost = Boolean(options.includeInternalCost);
  const dateOptions = { dateFormat: report.dateFormat, locale: report.locale };
  const rows = [
    ['FretTrack accounting summary'],
    ['Range', formatShopDate(report.range.start, dateOptions), formatShopDate(report.range.end, dateOptions)],
    ['Range ISO', report.range.start || '', report.range.end || ''],
    ['Generated At', formatShopDateTime(report.generatedAt, dateOptions)],
    ['Generated At ISO', report.generatedAt],
    ['Currency Code', report.currencyCode],
    ['Tax Label', report.taxLabel],
    [],
    ['Summary'],
    ['Metric', 'Currency Code', 'Amount'],
    ['Job Totals', report.currencyCode, moneyCell(report.summary.jobTotals)],
    ['Paid Total', report.currencyCode, moneyCell(report.summary.paidTotal)],
    ['Parts Revenue', report.currencyCode, moneyCell(report.summary.partsRevenue)],
    ['Labor Revenue', report.currencyCode, moneyCell(report.summary.laborRevenue)],
    ['Discounts', report.currencyCode, moneyCell(report.summary.discounts)],
    ['Refunds / Voids', report.currencyCode, moneyCell(report.summary.refundsAndVoids)],
    [`${report.taxLabel} Collected`, report.currencyCode, moneyCell(report.summary.taxCollected)],
    ['Outstanding Balance', report.currencyCode, moneyCell(report.summary.outstandingBalance)],
    [],
    ['Payments By Method'],
    ['Method', 'Count', 'Currency Code', 'Amount'],
    ...report.paymentsByMethod.map((row) => [row.method, row.count, report.currencyCode, moneyCell(row.amount)]),
    [],
    [`${report.taxLabel} Collected`],
    ['Jurisdiction', 'Tax Label', 'Tax Rate %', 'Currency Code', 'Taxable Subtotal', 'Non-Taxable Subtotal', 'Tax Amount'],
    ...report.taxCollected.map((row) => [
      row.jurisdiction,
      report.taxLabel,
      row.taxRatePercent,
      report.currencyCode,
      moneyCell(row.taxableSubtotal),
      moneyCell(row.nonTaxableSubtotal),
      moneyCell(row.taxAmount)
    ]),
    [],
    ['Open Balances'],
    ['Job #', 'Customer', 'Status', 'Currency Code', 'Total Due', 'Paid', 'Balance'],
    ...report.openBalances.map((row) => [
      row.jobNumber,
      row.customerName,
      row.status,
      row.currencyCode,
      moneyCell(row.totalDue),
      moneyCell(row.paidTotal),
      moneyCell(row.balanceDue)
    ]),
    [],
    ['Job Detail'],
    buildJobHeader(includeInternalCost),
    ...report.jobs.map((row) => buildJobRow(row, includeInternalCost, dateOptions))
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function downloadAccountingCsv(report, options = {}) {
  const csv = buildAccountingCsv(report, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename || buildFilename(report);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildJobHeader(includeInternalCost) {
  const header = [
    'Job #',
    'Customer',
    'Accounting Date',
    'Accounting Date ISO',
    'Currency Code',
    'Parts Revenue',
    'Labor Revenue',
    'Discounts',
    'Taxable Subtotal',
    'Non-Taxable Subtotal',
    'Tax Rate %',
    'Tax Jurisdiction',
    'Tax Amount',
    'Total Due',
    'Paid',
    'Balance',
    'Initial Relief',
    'Initial Unit',
    'Final Relief',
    'Final Unit',
    'Initial Action 12th',
    'Final Action 12th'
  ];
  if (includeInternalCost) {
    header.splice(5, 0, 'Internal Parts Cost');
  }
  return header;
}

function buildJobRow(row, includeInternalCost, dateOptions) {
  const cells = [
    row.jobNumber,
    row.customerName,
    formatShopDate(row.accountingDate, dateOptions),
    row.accountingDate,
    row.currencyCode,
    moneyCell(row.partsRevenue),
    moneyCell(row.laborRevenue),
    moneyCell(row.discounts),
    moneyCell(row.taxableSubtotal),
    moneyCell(row.nonTaxableSubtotal),
    row.taxSnapshot.tax_rate_percent,
    row.taxSnapshot.tax_jurisdiction,
    moneyCell(row.taxAmount),
    moneyCell(row.totalDue),
    moneyCell(row.paidTotal),
    moneyCell(row.balanceDue),
    row.measurementSummary?.initial?.relief || '',
    row.measurementSummary?.initial?.unit || '',
    row.measurementSummary?.final?.relief || '',
    row.measurementSummary?.final?.unit || '',
    [row.measurementSummary?.initial?.actionHighE12th, row.measurementSummary?.initial?.actionLowE12th].filter(Boolean).join(' / '),
    [row.measurementSummary?.final?.actionHighE12th, row.measurementSummary?.final?.actionLowE12th].filter(Boolean).join(' / ')
  ];
  if (includeInternalCost) {
    cells.splice(5, 0, moneyCell(row.partsInternalCost));
  }
  return cells;
}

function buildFilename(report) {
  const start = report.range.start || 'start';
  const end = report.range.end || 'end';
  return `frettrack-accounting-${start}-to-${end}.csv`;
}

function moneyCell(value) {
  return (Number(value) || 0).toFixed(2);
}

function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
