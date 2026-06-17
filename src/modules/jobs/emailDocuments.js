import { formatShopDate } from '../../shared/utils/dateFormat';
import { money } from '../../shared/utils/money';
import { getJobSourceLabel } from './jobSources';

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
