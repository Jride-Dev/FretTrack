import Papa from 'papaparse';

export const CUSTOMER_IMPORT_TEMPLATE_PATH = '/templates/frettrack-customer-import-template.csv';
export const CUSTOMER_IMPORT_PREVIEW_ROW_LIMIT = 100;
export const CUSTOMER_IMPORT_MAX_ROWS = 1000;

export const customerCsvPreviewFields = [
  {
    key: 'name',
    label: 'Name',
    aliases: ['name', 'customer_name', 'customer name', 'full_name', 'full name', 'display_name', 'customer']
  },
  {
    key: 'firstName',
    label: 'First Name',
    aliases: ['first_name', 'first name', 'firstname', 'customer_first_name']
  },
  {
    key: 'lastName',
    label: 'Last Name',
    aliases: ['last_name', 'last name', 'lastname', 'customer_last_name']
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'email_address', 'email address', 'e-mail']
  },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['phone', 'phone_number', 'phone number', 'mobile', 'cell', 'telephone']
  },
  {
    key: 'address',
    label: 'Address',
    aliases: ['address', 'street_address', 'street address', 'address_line1', 'address 1', 'street']
  },
  {
    key: 'notes',
    label: 'Notes',
    aliases: ['note', 'notes']
  }
];

export function parseCustomerCsvText(csvText = '') {
  const result = Papa.parse(String(csvText || ''), {
    header: true,
    skipEmptyLines: false,
    transformHeader: (header) => String(header || '').trim()
  });

  return {
    headers: (result.meta?.fields || []).filter(Boolean),
    rows: Array.isArray(result.data) ? result.data : [],
    errors: result.errors || [],
    meta: result.meta || {}
  };
}

export function normalizeCustomerCsvHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function detectCustomerCsvMapping(headers = []) {
  const normalizedHeaders = headers.reduce((lookup, header) => {
    lookup.set(normalizeCustomerCsvHeader(header), header);
    return lookup;
  }, new Map());

  return customerCsvPreviewFields.reduce((mapping, field) => {
    const acceptedHeaders = [field.key, field.label, ...field.aliases].map(normalizeCustomerCsvHeader);
    mapping[field.key] = acceptedHeaders.map((header) => normalizedHeaders.get(header)).find(Boolean) || '';
    return mapping;
  }, {});
}

export function applyCustomerCsvMapping(row = {}, mapping = {}) {
  return customerCsvPreviewFields.reduce((mapped, field) => {
    const sourceHeader = mapping[field.key];
    mapped[field.key] = sourceHeader && Object.prototype.hasOwnProperty.call(row, sourceHeader)
      ? normalizeCell(row[sourceHeader])
      : '';
    return mapped;
  }, {});
}

export function isBlankCustomerCsvRow(row = {}, headers = Object.keys(row || {})) {
  return headers.every((header) => normalizeCell(row[header]) === '');
}

export function normalizeCustomerCsvPreviewRow(mapped = {}) {
  const firstName = normalizeCell(mapped.firstName);
  const lastName = normalizeCell(mapped.lastName);
  const name = normalizeCell(mapped.name) || combineCustomerName(firstName, lastName);
  const email = normalizeCell(mapped.email);
  const phone = normalizeCell(mapped.phone);

  return {
    name,
    displayName: name,
    firstName,
    lastName,
    email,
    emailNormalized: normalizeEmail(email),
    phone,
    phoneNormalized: normalizePhone(phone),
    addressLine1: normalizeCell(mapped.address),
    notes: normalizeCell(mapped.notes)
  };
}

export function buildCustomerCsvPreview({
  csvText = '',
  existingCustomers = [],
  mapping
} = {}) {
  const parsed = parseCustomerCsvText(csvText);
  const activeMapping = mapping || detectCustomerCsvMapping(parsed.headers);

  return {
    ...parsed,
    mapping: activeMapping,
    previewRows: buildCustomerCsvPreviewRows({
      rows: parsed.rows,
      headers: parsed.headers,
      mapping: activeMapping,
      existingCustomers
    })
  };
}

export function buildCustomerCsvPreviewRows({
  rows = [],
  headers = [],
  mapping = {},
  existingCustomers = []
} = {}) {
  const fileIdentityKeys = new Map();
  const existingIdentityKeys = buildExistingIdentityLookup(existingCustomers);
  const previewRows = [];

  rows.forEach((row, index) => {
    const rowHeaders = headers.length ? headers : Object.keys(row || {});
    if (isBlankCustomerCsvRow(row, rowHeaders)) {
      return;
    }

    const mapped = applyCustomerCsvMapping(row, mapping);
    const normalized = normalizeCustomerCsvPreviewRow(mapped);
    const errors = validateCustomerCsvPreviewRow(mapped, normalized);
    const warnings = [];
    const identityKeys = buildCustomerCsvIdentityKeys(normalized);
    const duplicateInFile = identityKeys
      .map((key) => fileIdentityKeys.get(key))
      .filter(Boolean);
    const duplicateExisting = identityKeys
      .map((key) => existingIdentityKeys.get(key))
      .filter(Boolean);

    if (!normalized.emailNormalized && !normalized.phoneNormalized) {
      warnings.push('Email or phone is recommended for duplicate detection and follow-up.');
    }

    if (duplicateInFile.length) {
      warnings.push('Possible duplicate within this CSV.');
    }

    if (duplicateExisting.length) {
      warnings.push('Possible duplicate of an existing customer.');
    }

    const status = getPreviewStatus({ errors, warnings, duplicateInFile, duplicateExisting });
    if (status !== 'error' && status !== 'duplicate') {
      identityKeys.forEach((key) => fileIdentityKeys.set(key, index + 2));
    }

    previewRows.push({
      rowNumber: index + 2,
      original: row,
      mapped,
      normalized,
      status,
      errors,
      warnings
    });
  });

  return previewRows;
}

export function summarizeCustomerCsvPreview(previewRows = []) {
  return previewRows.reduce((summary, row) => {
    summary.total += 1;
    summary[row.status] = (summary[row.status] || 0) + 1;
    if (row.status === 'valid' || row.status === 'warning') {
      summary.importable += 1;
    } else {
      summary.skipped += 1;
    }
    return summary;
  }, {
    total: 0,
    valid: 0,
    warning: 0,
    error: 0,
    duplicate: 0,
    skipped: 0,
    importable: 0
  });
}

export function buildCustomerCsvIssueRows(previewRows = []) {
  return previewRows
    .filter((row) => row.status === 'error' || row.status === 'duplicate' || row.status === 'skipped')
    .map((row) => ({
      row_number: row.rowNumber,
      status: row.status,
      name: row.normalized?.name || row.mapped?.name || '',
      email: row.normalized?.email || row.mapped?.email || '',
      phone: row.normalized?.phone || row.mapped?.phone || '',
      address: row.normalized?.addressLine1 || row.mapped?.address || '',
      notes: row.normalized?.notes || row.mapped?.notes || '',
      errors: row.errors.join(' '),
      warnings: row.warnings.join(' '),
      original_values: JSON.stringify(row.original || {})
    }));
}

export function serializeCustomerCsvIssueRows(rows = []) {
  const headers = [
    'row_number',
    'status',
    'name',
    'email',
    'phone',
    'address',
    'notes',
    'errors',
    'warnings',
    'original_values'
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
  ];
  return `${lines.join('\n')}\n`;
}

export function buildCustomerCsvIssueCsv(previewRows = []) {
  return serializeCustomerCsvIssueRows(buildCustomerCsvIssueRows(previewRows));
}

export function validateCustomerCsvPreviewRow(mapped = {}, normalized = normalizeCustomerCsvPreviewRow(mapped)) {
  const errors = [];
  const hasName = Boolean(normalizeText(mapped.name) || normalizeText(mapped.firstName) || normalizeText(mapped.lastName));

  if (!hasName) {
    errors.push('Missing required customer name.');
  }

  if (normalized.email && !isValidEmail(normalized.email)) {
    errors.push('Invalid email address.');
  }

  return errors;
}

export function buildCustomerCsvIdentityKeys(customer = {}) {
  const name = normalizeText(customer.name || customer.displayName);
  const email = normalizeEmail(customer.email);
  const phone = normalizePhone(customer.phone);
  const keys = [];

  if (email) keys.push(`email:${email}`);
  if (phone) keys.push(`phone:${phone}`);
  if (name && email) keys.push(`name-email:${name}|${email}`);
  if (name && phone) keys.push(`name-phone:${name}|${phone}`);
  if (name && !email && !phone) keys.push(`name:${name}`);

  return Array.from(new Set(keys));
}

function buildExistingIdentityLookup(existingCustomers = []) {
  return existingCustomers.reduce((lookup, customer, index) => {
    const identityKeys = buildCustomerCsvIdentityKeys({
      name: customer.displayName || customer.name || customer.customerName,
      email: customer.email,
      phone: customer.phone
    });
    identityKeys.forEach((key) => lookup.set(key, customer.id || customer.displayName || `existing-${index}`));
    return lookup;
  }, new Map());
}

function getPreviewStatus({ errors = [], warnings = [], duplicateInFile = [], duplicateExisting = [] } = {}) {
  if (errors.length) return 'error';
  if (duplicateInFile.length || duplicateExisting.length) return 'duplicate';
  if (warnings.length) return 'warning';
  return 'valid';
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return normalizeText(value);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

function combineCustomerName(firstName = '', lastName = '') {
  return [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

function normalizeCell(value) {
  return String(value ?? '').trim();
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
