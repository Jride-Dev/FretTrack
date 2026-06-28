import { findDuplicateCustomers } from './customerDuplicateDetection.js';
import { mapCustomerImportRow } from './customerImportMapper.js';
import { normalizeEmail, normalizeText } from './customerNormalize.js';

export const CUSTOMER_IMPORT_TEMPLATE_PATH = '/templates/frettrack-customer-import-template.csv';
export const CUSTOMER_IMPORT_SOURCE = 'csv';

export const customerCsvImportFields = [
  {
    key: 'displayName',
    label: 'Name',
    aliases: ['name', 'customer_name', 'customer name', 'full_name', 'full name', 'customer']
  },
  {
    key: 'firstName',
    label: 'First Name',
    aliases: ['first_name', 'first name', 'firstname']
  },
  {
    key: 'lastName',
    label: 'Last Name',
    aliases: ['last_name', 'last name', 'lastname']
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
    key: 'addressLine1',
    label: 'Address',
    aliases: ['address', 'street_address', 'street address', 'address_line1', 'address 1', 'street']
  },
  {
    key: 'notes',
    label: 'Notes',
    aliases: ['notes', 'note']
  }
];

export function detectCustomerCsvMapping(headers = []) {
  const normalizedHeaders = headers.reduce((lookup, header) => {
    lookup.set(normalizeHeaderForImport(header), header);
    return lookup;
  }, new Map());

  return customerCsvImportFields.reduce((mapping, field) => {
    const keys = [field.key, field.label, ...field.aliases].map(normalizeHeaderForImport);
    mapping[field.key] = keys.map((key) => normalizedHeaders.get(key)).find(Boolean) || '';
    return mapping;
  }, {});
}

export function applyCustomerCsvMapping(row = {}, mapping = {}) {
  return customerCsvImportFields.reduce((mapped, field) => {
    const sourceHeader = mapping[field.key];
    if (sourceHeader && Object.prototype.hasOwnProperty.call(row, sourceHeader)) {
      mapped[field.key] = normalizeCell(row[sourceHeader]);
    }
    return mapped;
  }, {});
}

export function isBlankCustomerCsvRow(row = {}, headers = Object.keys(row || {})) {
  return headers.every((header) => normalizeCell(row[header]) === '');
}

export function buildCustomerImportPreview({
  rows = [],
  mapping = {},
  existingCustomers = [],
  shopId = '',
  importBatchId = generateCustomerImportBatchId()
} = {}) {
  const importedSoFar = [];
  const previewRows = [];

  rows.forEach((row, index) => {
    const headers = Object.keys(row || {});
    if (isBlankCustomerCsvRow(row, headers)) {
      return;
    }

    const mappedRow = applyCustomerCsvMapping(row, mapping);
    const customer = mapCustomerImportRow(mappedRow, {
      shopId,
      importSource: CUSTOMER_IMPORT_SOURCE,
      importBatchId
    });
    const errors = validateMappedCustomer(mappedRow, customer);
    const duplicateInFile = findDuplicateCustomers(importedSoFar, customer);
    const duplicateExisting = findDuplicateCustomers(existingCustomers, customer);
    const warnings = [];

    if (!customer.emailNormalized && !customer.phoneNormalized) {
      warnings.push('Email or phone is recommended for duplicate detection and follow-up.');
    }

    if (duplicateInFile.length) {
      warnings.push('Possible duplicate within this CSV.');
    }

    if (duplicateExisting.length) {
      warnings.push('Possible duplicate of an existing customer.');
    }

    let status = 'valid';
    if (errors.length) {
      status = 'error';
    } else if (duplicateInFile.length || duplicateExisting.length) {
      status = 'duplicate';
    } else if (warnings.length) {
      status = 'warning';
      importedSoFar.push(customer);
    } else {
      importedSoFar.push(customer);
    }

    previewRows.push({
      rowNumber: index + 2,
      status,
      row,
      mappedRow,
      customer,
      errors,
      warnings,
      duplicateInFile,
      duplicateExisting,
      importable: status === 'valid' || status === 'warning'
    });
  });

  return previewRows;
}

export function summarizeCustomerImportPreview(previewRows = []) {
  return previewRows.reduce((summary, row) => {
    summary.total += 1;
    summary[row.status] = (summary[row.status] || 0) + 1;
    if (row.importable) {
      summary.importable += 1;
    } else {
      summary.skipped += 1;
    }
    return summary;
  }, {
    total: 0,
    valid: 0,
    warning: 0,
    duplicate: 0,
    error: 0,
    importable: 0,
    skipped: 0
  });
}

export function buildCustomerImportIssueRows(previewRows = []) {
  return previewRows
    .filter((row) => !row.importable)
    .map((row) => ({
      row_number: row.rowNumber,
      name: row.customer?.displayName || row.mappedRow?.displayName || '',
      email: row.customer?.email || row.mappedRow?.email || '',
      phone: row.customer?.phone || row.mappedRow?.phone || '',
      address: row.customer?.addressLine1 || row.mappedRow?.addressLine1 || '',
      notes: row.customer?.notes || row.mappedRow?.notes || '',
      error: row.errors.join(' '),
      warnings: row.warnings.join(' '),
      original_values: JSON.stringify(row.row || {})
    }));
}

export function serializeImportRowsToCsv(rows = []) {
  const headers = ['row_number', 'name', 'email', 'phone', 'address', 'notes', 'error', 'warnings', 'original_values'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
  ];
  return `${lines.join('\n')}\n`;
}

export function generateCustomerImportBatchId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeHeaderForImport(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function validateMappedCustomer(mappedRow, customer) {
  const errors = [];
  const hasName = Boolean(
    normalizeText(mappedRow.displayName)
    || normalizeText(mappedRow.firstName)
    || normalizeText(mappedRow.lastName)
  );

  if (!hasName) {
    errors.push('Missing required customer name.');
  }

  if (mappedRow.email && !isValidEmail(mappedRow.email)) {
    errors.push('Invalid email address.');
  }

  if (!customer.shopId) {
    errors.push('Customer is missing shop_id.');
  }

  return errors;
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
