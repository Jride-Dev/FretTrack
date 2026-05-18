export function buildAccountingCsv(report, options = {}) {
  const includeInternalCost = Boolean(options.includeInternalCost);
  const rows = [
    ['FretTrack accounting summary'],
    ['Range', report.range.start || '', report.range.end || ''],
    ['Generated At', report.generatedAt],
    [],
    ['Summary'],
    ['Metric', 'Amount'],
    ['Job Totals', moneyCell(report.summary.jobTotals)],
    ['Paid Total', moneyCell(report.summary.paidTotal)],
    ['Parts Revenue', moneyCell(report.summary.partsRevenue)],
    ['Labor Revenue', moneyCell(report.summary.laborRevenue)],
    ['Discounts', moneyCell(report.summary.discounts)],
    ['Refunds / Voids', moneyCell(report.summary.refundsAndVoids)],
    ['Tax Collected', moneyCell(report.summary.taxCollected)],
    ['Outstanding Balance', moneyCell(report.summary.outstandingBalance)],
    [],
    ['Payments By Method'],
    ['Method', 'Count', 'Amount'],
    ...report.paymentsByMethod.map((row) => [row.method, row.count, moneyCell(row.amount)]),
    [],
    ['Tax Collected'],
    ['Jurisdiction', 'Tax Rate %', 'Taxable Subtotal', 'Non-Taxable Subtotal', 'Tax Amount'],
    ...report.taxCollected.map((row) => [
      row.jurisdiction,
      row.taxRatePercent,
      moneyCell(row.taxableSubtotal),
      moneyCell(row.nonTaxableSubtotal),
      moneyCell(row.taxAmount)
    ]),
    [],
    ['Open Balances'],
    ['Job #', 'Customer', 'Status', 'Total Due', 'Paid', 'Balance'],
    ...report.openBalances.map((row) => [
      row.jobNumber,
      row.customerName,
      row.status,
      moneyCell(row.totalDue),
      moneyCell(row.paidTotal),
      moneyCell(row.balanceDue)
    ]),
    [],
    ['Job Detail'],
    buildJobHeader(includeInternalCost),
    ...report.jobs.map((row) => buildJobRow(row, includeInternalCost))
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
    'Balance'
  ];
  if (includeInternalCost) {
    header.splice(5, 0, 'Internal Parts Cost');
  }
  return header;
}

function buildJobRow(row, includeInternalCost) {
  const cells = [
    row.jobNumber,
    row.customerName,
    row.accountingDate,
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
    moneyCell(row.balanceDue)
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
