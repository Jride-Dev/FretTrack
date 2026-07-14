import { formatShopDate, formatShopDateTime } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { getJobSourceLabel } from './jobSources';
import { retailTotal, rowQuantity } from '../billing/accounting';

export function getDefaultDocumentRecipient(job = {}) {
  return String(job.email || '').trim();
}

export function isValidEmailAddress(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function buildWorkOrderEmailDraft(job, context = {}) {
  const base = buildBaseContext(job, context);
  const requestedWork = cleanText(job.reasonForVisit) || 'Requested work is listed in the shop record.';
  const serviceSummary = summarizeRows(job.services || job.labor || [], (row) => `${row.description || 'Service'} x${row.quantity || 1}`);
  const partSummary = summarizeRows(job.parts || [], (row) => `${row.sku ? `${row.sku} - ` : ''}${row.name || 'Part'} x${row.quantity || 1}`);
  const authorizationNote = cleanText(job.techDetails?.damageMap?.liabilityText);
  const pickupNote = cleanText(job.techDetails?.notes);
  const intakeSource = getJobSourceLabel(job.techDetails?.intakeType);
  const subject = `${base.shopName} work order ${base.jobNumberLabel} for ${base.customerName}`;
  const summaryLines = [
    ['Shop', base.shopContactLine],
    ['Job', base.jobNumberLabel],
    ['Customer', base.customerName],
    ['Instrument', base.instrumentLabel],
    ['Status', base.status],
    ['Intake', intakeSource],
    ['Requested Work', requestedWork],
    ['Services', serviceSummary || 'No services added yet.'],
    ['Parts', partSummary || 'No parts added yet.'],
    ['Authorization Notes', authorizationNote || 'None recorded.'],
    ['Pickup / Job Notes', pickupNote || 'None recorded.']
  ];

  const body = [
    `Hi ${base.customerGreeting},`,
    '',
    `Here is your FretTrack work order summary from ${base.shopName}.`,
    '',
    `Job Number: ${base.jobNumberLabel}`,
    `Instrument: ${base.instrumentLabel}`,
    `Status: ${base.status}`,
    `Date Received: ${base.dateReceived}`,
    '',
    `Requested Work: ${requestedWork}`,
    '',
    `Services: ${serviceSummary || 'No services added yet.'}`,
    `Parts: ${partSummary || 'No parts added yet.'}`,
    '',
    `Authorization Notes: ${authorizationNote || 'None recorded.'}`,
    `Pickup / Job Notes: ${pickupNote || 'None recorded.'}`,
    '',
    base.shopSignature
  ].join('\n');

  return {
    type: 'work_order',
    recipient: base.recipient,
    subject,
    body,
    summaryTitle: 'Included Work Order Summary',
    summaryLines
  };
}

export function buildInvoiceEmailDraft(job, context = {}) {
  const base = buildBaseContext(job, context);
  const totals = context.totals || {};
  const taxLabel = context.taxLabel || 'Sales Tax';
  const services = summarizeRows(job.services || job.labor || [], (row) => (
    `${row.description || 'Service'} x${row.quantity || 1} @ ${money(row.retail || 0, base.moneyOptions)} - ${money((Number(row.retail) || 0) * Number(row.quantity || 1), base.moneyOptions)}`
  ));
  const parts = summarizeRows(job.parts || [], (row) => {
    const amount = row.includedInService
      ? 'Included'
      : money((Number(row.retail) || 0) * Number(row.quantity || 1), base.moneyOptions);
    return `${row.sku ? `${row.sku} - ` : ''}${row.name || 'Part'} x${row.quantity || 1} @ ${money(row.retail || 0, base.moneyOptions)} - ${amount}`;
  });
  const paymentSummary = summarizeRows(job.techDetails?.payments || [], (row) => (
    `${formatShopDate(row.date, base.dateOptions)} - ${row.method || 'Payment'} - ${money(row.amount || 0, base.moneyOptions)}${row.note ? ` (${row.note})` : ''}`
  ));
  const paymentNote = cleanText(lastNonEmpty((job.techDetails?.payments || []).map((row) => row.note))) || 'No payment notes recorded.';
  const subject = `${base.shopName} invoice ${base.jobNumberLabel} for ${base.customerName}`;
  const summaryLines = [
    ['Shop', base.shopContactLine],
    ['Job', base.jobNumberLabel],
    ['Customer', base.customerName],
    ['Instrument', base.instrumentLabel],
    ['Services', services || 'No services added yet.'],
    ['Parts', parts || 'No parts added yet.'],
    ['Subtotal', money(totals.subtotal || 0, base.moneyOptions)],
    ['Discount', `-${money(totals.discountAmount || 0, base.moneyOptions)}`],
    [taxLabel, money(totals.salesTaxAmount || 0, base.moneyOptions)],
    ['Total', money(totals.totalDue || 0, base.moneyOptions)],
    ['Payments', paymentSummary || 'No payments recorded yet.'],
    ['Paid', money(totals.paidTotal || 0, base.moneyOptions)],
    ['Balance Due', money(totals.balanceDue || 0, base.moneyOptions)],
    ['Payment / Pickup Note', paymentNote]
  ];

  const body = [
    `Hi ${base.customerGreeting},`,
    '',
    `Here is your FretTrack invoice summary from ${base.shopName}.`,
    '',
    `Job Number: ${base.jobNumberLabel}`,
    `Instrument: ${base.instrumentLabel}`,
    '',
    `Services: ${services || 'No services added yet.'}`,
    `Parts: ${parts || 'No parts added yet.'}`,
    '',
    `Subtotal: ${money(totals.subtotal || 0, base.moneyOptions)}`,
    `Discount: -${money(totals.discountAmount || 0, base.moneyOptions)}`,
    `${taxLabel}: ${money(totals.salesTaxAmount || 0, base.moneyOptions)}`,
    `Total: ${money(totals.totalDue || 0, base.moneyOptions)}`,
    `Paid: ${money(totals.paidTotal || 0, base.moneyOptions)}`,
    `Balance Due: ${money(totals.balanceDue || 0, base.moneyOptions)}`,
    '',
    `Payments: ${paymentSummary || 'No payments recorded yet.'}`,
    `Payment / Pickup Note: ${paymentNote}`,
    '',
    base.shopSignature
  ].join('\n');

  return {
    type: 'invoice',
    recipient: base.recipient,
    subject,
    body,
    summaryTitle: 'Included Invoice Summary',
    summaryLines
  };
}

export function buildSelectedDocumentEmailContent(job, context = {}, options = {}) {
  const sections = [];

  if (options.includeJobSheet) {
    sections.push(buildJobSheetEmailSection(job, context));
  }

  if (options.includeCustomerReport) {
    sections.push(buildCustomerReportEmailSection(job, context));
  }

  if (sections.length === 0) {
    return { text: '', html: '' };
  }

  return {
    text: sections.map((section) => section.text).join('\n\n'),
    html: sections.map((section) => section.html).join('')
  };
}

export function buildDocumentEmailHtml(body, documentHtml = '') {
  return [
    '<div style="color:#202124;font-family:Arial,sans-serif;font-size:16px;line-height:1.5">',
    plainTextToEmailHtml(body),
    documentHtml,
    '</div>'
  ].join('');
}

function buildJobSheetEmailSection(job = {}, context = {}) {
  const base = buildBaseContext(job, context);
  const totals = context.totals || {};
  const taxLabel = context.taxLabel || 'Sales Tax';
  const techDetails = job.techDetails || {};
  const moneyOptions = base.moneyOptions;
  const services = job.services || job.labor || [];
  const parts = job.parts || [];
  const fields = [
    ['Customer', base.customerName],
    ['Phone', cleanText(job.phone) || '-'],
    ['Email', cleanText(job.email) || '-'],
    ['Job Number', base.jobNumberLabel],
    ['Instrument', base.instrumentLabel],
    ['Brand / Model', cleanText([job.guitarBrand, job.model].filter(Boolean).join(' ')) || '-'],
    ['Serial Number', cleanText(job.serial) || '-'],
    ['Color', cleanText(job.color) || '-'],
    ['Date Received', base.dateReceived],
    ['Status', base.status],
    ['Job Source', getJobSourceLabel(techDetails.intakeType)],
    ['Requested Work', cleanText(job.reasonForVisit) || '-']
  ];
  const serviceRows = services.map((row) => [
    cleanText(row.description) || 'Service',
    String(row.quantity || 1),
    money((Number(row.retail) || 0) * rowQuantity(row), moneyOptions)
  ]);
  const partRows = parts.map((row) => [
    cleanText(row.sku ? `${row.sku} - ${row.name || 'Part'}` : row.name) || 'Part',
    String(row.quantity || 1),
    money(Number(row.retail) || 0, moneyOptions),
    row.includedInService ? 'Included' : money(retailTotal(row), moneyOptions)
  ]);
  const totalFields = [
    ['Services', money(totals.servicesTotal || 0, moneyOptions)],
    ['Billable Parts', money(totals.partsTotal || 0, moneyOptions)],
    ['Subtotal', money(totals.subtotal || 0, moneyOptions)],
    ['Discount', `-${money(totals.discountAmount || 0, moneyOptions)}`],
    [taxLabel, money(totals.salesTaxAmount || 0, moneyOptions)],
    ['Total Due', money(totals.totalDue || 0, moneyOptions)],
    ['Paid', money(totals.paidTotal || 0, moneyOptions)],
    ['Balance', money(totals.balanceDue || 0, moneyOptions)]
  ];

  return buildEmailSection({
    title: 'Job Sheet',
    fields,
    tables: [
      { title: 'Services', headers: ['Service', 'Qty', 'Line Total'], rows: serviceRows },
      { title: 'Parts', headers: ['Part', 'Qty', 'Unit Price', 'Line Total'], rows: partRows }
    ],
    footerFields: totalFields
  });
}

function buildCustomerReportEmailSection(job = {}, context = {}) {
  const base = buildBaseContext(job, context);
  const techDetails = job.techDetails || {};
  const damageMap = techDetails.damageMap || {};
  const dateOptions = base.dateOptions;
  const parts = job.parts || [];
  const services = job.services || job.labor || [];
  const fields = [
    ['Customer', base.customerName],
    ['Phone', cleanText(job.phone) || '-'],
    ['Job Number', base.jobNumberLabel],
    ['Instrument', base.instrumentLabel],
    ['Brand / Model', cleanText([job.guitarBrand, job.model].filter(Boolean).join(' ')) || '-'],
    ['Serial Number', cleanText(job.serial) || '-'],
    ['Date Received', base.dateReceived]
  ];
  const damageRows = Object.entries(damageMap.views || {}).flatMap(([viewName, view]) => (
    (view?.marks || []).map((mark, index) => [
      `${formatDamageViewLabel(viewName)} #${index + 1}`,
      cleanText(mark.area) || '-',
      cleanText(mark.severity) || '-',
      cleanText(mark.note) || '-',
      cleanText(mark.recommendedRepair) || '-'
    ])
  ));
  const workRows = [
    ...services.map((row) => [cleanText(row.description) || 'Service', String(row.quantity || 1)]),
    ...(job.workLog || []).map((entry) => [
      formatShopDateTime(entry.timestamp, dateOptions) || '-',
      cleanText(entry.text) || '-'
    ])
  ];
  const partRows = parts.map((row) => [
    cleanText(row.sku ? `${row.sku} - ${row.name || 'Part'}` : row.name) || 'Part',
    String(row.quantity || 1),
    money(Number(row.retail) || 0, base.moneyOptions),
    row.includedInService ? 'Included' : money(retailTotal(row), base.moneyOptions)
  ]);
  const neckInspection = techDetails.neckInspection || {};
  const neckRows = [
    ['Relief', formatInspectionChange(neckInspection.initial?.relief, neckInspection.final?.relief, techDetails.lengthUnit)],
    ['Fret Condition', formatInspectionChange(neckInspection.initial?.fretCondition, neckInspection.final?.fretCondition)],
    ['Neck Condition', formatInspectionChange(neckInspection.initial?.neckCondition, neckInspection.final?.neckCondition)],
    ['Truss Rod', formatInspectionChange(neckInspection.initial?.trussRodStatus, neckInspection.final?.trussRodStatus)]
  ];

  return buildEmailSection({
    title: 'Customer Report',
    fields,
    tables: [
      { title: 'Documented Condition', headers: ['View', 'Area', 'Severity', 'Note', 'Recommended Repair'], rows: damageRows, emptyText: 'No damage markers were recorded.' },
      { title: 'Neck Measurements', headers: ['Measurement', 'Recorded Change'], rows: neckRows },
      { title: 'Work Performed', headers: ['Entry', 'Details'], rows: workRows, emptyText: 'No work entries were recorded.' },
      { title: 'Parts', headers: ['Part', 'Qty', 'Unit Price', 'Line Total'], rows: partRows, emptyText: 'No parts were recorded.' }
    ],
    footerFields: [
      ['Authorization', cleanText(damageMap.liabilityText) || 'Customer acknowledges documented condition and authorizes repair intake.'],
      ['Damage Acknowledgment Checked', damageMap.liabilityAcknowledged ? 'Yes' : 'No']
    ]
  });
}

function buildEmailSection({ title, fields = [], tables = [], footerFields = [] }) {
  const text = [
    `--- ${title.toUpperCase()} ---`,
    ...fields.map(([label, value]) => `${label}: ${value || '-'}`),
    ...tables.flatMap((table) => [
      '',
      `${table.title}:`,
      ...(table.rows.length
        ? table.rows.map((row) => row.join(' | '))
        : [table.emptyText || `No ${table.title.toLowerCase()} recorded.`])
    ]),
    ...footerFields.flatMap(([label, value]) => ['', `${label}: ${value || '-'}`])
  ].join('\n');

  const html = [
    '<section style="border-top:1px solid #d8dce2;margin-top:28px;padding-top:22px">',
    `<h2 style="font-size:20px;margin:0 0 14px">${escapeHtml(title)}</h2>`,
    buildEmailDetailsHtml(fields),
    ...tables.map(buildEmailTableHtml),
    buildEmailDetailsHtml(footerFields),
    '</section>'
  ].join('');

  return { text, html };
}

function buildEmailDetailsHtml(fields = []) {
  if (!fields.length) {
    return '';
  }

  return [
    '<table role="presentation" style="border-collapse:collapse;margin:0 0 16px;width:100%">',
    ...fields.map(([label, value]) => (
      `<tr><td style="color:#5f6368;font-weight:700;padding:4px 12px 4px 0;vertical-align:top;width:38%">${escapeHtml(label)}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value || '-')}</td></tr>`
    )),
    '</table>'
  ].join('');
}

function buildEmailTableHtml({ title, headers = [], rows = [], emptyText = '' }) {
  const tableRows = rows.length
    ? rows.map((row) => `<tr>${row.map((value) => `<td style="border-top:1px solid #e2e5e9;padding:7px 8px;vertical-align:top;white-space:pre-wrap">${escapeHtml(value || '-')}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length || 1}" style="border-top:1px solid #e2e5e9;color:#5f6368;padding:7px 8px">${escapeHtml(emptyText || `No ${title.toLowerCase()} recorded.`)}</td></tr>`;

  return [
    `<h3 style="font-size:16px;margin:20px 0 8px">${escapeHtml(title)}</h3>`,
    '<table role="presentation" style="border-collapse:collapse;font-size:14px;margin:0 0 16px;width:100%">',
    `<thead><tr>${headers.map((header) => `<th align="left" style="background:#f1f3f4;border-top:1px solid #d8dce2;padding:7px 8px">${escapeHtml(header)}</th>`).join('')}</tr></thead>`,
    `<tbody>${tableRows}</tbody>`,
    '</table>'
  ].join('');
}

function plainTextToEmailHtml(value = '') {
  return String(value || '')
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(paragraph)}</p>`)
    .join('');
}

function formatDamageViewLabel(viewName) {
  return {
    front: 'Front',
    back: 'Back',
    headstock: 'Headstock',
    serial_number: 'Serial Number'
  }[viewName] || 'Damage';
}

function formatInspectionChange(initial, final, unit = '') {
  const initialValue = cleanText(initial);
  const finalValue = cleanText(final);
  if (!initialValue && !finalValue) {
    return '-';
  }
  const suffix = unit && isNumericMeasurement(initialValue, finalValue) ? ` ${unit}` : '';
  return `${initialValue || '-'}${suffix} -> ${finalValue || '-'}${suffix}`;
}

function isNumericMeasurement(...values) {
  return values.filter(Boolean).every((value) => Number.isFinite(Number(value)));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBaseContext(job = {}, context = {}) {
  const shopSettings = context.shopSettings || {};
  const dateOptions = context.dateOptions || {};
  const moneyOptions = context.moneyOptions || {};
  const recipient = getDefaultDocumentRecipient(job);
  const customerName = cleanText(job.customerName) || 'Customer';
  const instrumentLabel = cleanText(context.instrumentLabel)
    || cleanText([job.guitarBrand, job.model].filter(Boolean).join(' '))
    || cleanText(job.instrumentType)
    || 'Instrument';
  const shopName = cleanText(shopSettings.shopName) || 'FretTrack';
  const shopContactLine = [
    shopName,
    cleanText(shopSettings.phone),
    cleanText(shopSettings.email)
  ].filter(Boolean).join(' | ');

  return {
    recipient,
    customerName,
    customerGreeting: customerName.split(' ')[0] || 'there',
    instrumentLabel,
    shopName,
    shopContactLine,
    shopSignature: ['Thanks,', shopName, cleanText(shopSettings.phone), cleanText(shopSettings.email)].filter(Boolean).join('\n'),
    jobNumberLabel: cleanText(job.jobNumber) || 'Unnumbered job',
    status: cleanText(job.status) || 'Checked In',
    dateReceived: formatShopDate(job.dateReceived, dateOptions) || '-',
    moneyOptions,
    dateOptions
  };
}

function summarizeRows(rows, formatter) {
  const items = (rows || [])
    .map((row) => formatter(row))
    .map((value) => cleanText(value))
    .filter(Boolean);
  return items.length ? items.join('; ') : '';
}

function lastNonEmpty(values = []) {
  return [...values].reverse().find((value) => cleanText(value)) || '';
}

function cleanText(value) {
  return String(value || '').trim();
}
