import { findDuplicateCustomers } from './customerDuplicateDetection';
import { getCustomerDisplayName, normalizeCustomer, normalizeEmail, normalizePhone, normalizeText } from './customerNormalize';
import { validateCustomerDraft } from './customerValidation';

export const customerImportFields = [
  'displayName',
  'firstName',
  'lastName',
  'companyName',
  'customerType',
  'email',
  'phone',
  'secondaryPhone',
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'postalCode',
  'country',
  'notes',
  'source',
  'externalRef',
  'importSource',
  'importBatchId'
];

export const customerImportAliases = {
  displayName: ['display_name', 'customer_name', 'name', 'full_name', 'customer'],
  firstName: ['first_name', 'customer_first_name', 'firstname'],
  lastName: ['last_name', 'customer_last_name', 'lastname'],
  companyName: ['company_name', 'company', 'business', 'organization'],
  customerType: ['customer_type', 'type'],
  email: ['email_address', 'e-mail', 'email'],
  phone: ['phone_number', 'mobile', 'cell', 'telephone', 'phone'],
  secondaryPhone: ['secondary_phone', 'alternate_phone', 'other_phone'],
  addressLine1: ['address_line1', 'address_1', 'street', 'address'],
  addressLine2: ['address_line2', 'address_2', 'suite', 'unit'],
  city: ['city'],
  region: ['state', 'province', 'region'],
  postalCode: ['postal_code', 'zip', 'zip_code'],
  country: ['country'],
  notes: ['note', 'notes'],
  source: ['source'],
  externalRef: ['external_ref', 'external_id', 'customer_id', 'legacy_id'],
  importSource: ['import_source'],
  importBatchId: ['import_batch_id']
};

export function mapCustomerImportRow(row = {}, options = {}) {
  const shopId = options.shopId || row.shopId || row.shop_id || '';
  const importSource = options.importSource || readAliasedValue(row, 'importSource');
  const importBatchId = options.importBatchId || readAliasedValue(row, 'importBatchId') || null;
  const customer = {};

  customerImportFields.forEach((field) => {
    const value = readAliasedValue(row, field);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      customer[field] = value;
    }
  });

  return normalizeCustomer({
    ...customer,
    shopId,
    displayName: customer.displayName || getCustomerDisplayName(customer),
    email: customer.email || '',
    emailNormalized: normalizeEmail(customer.email),
    phone: customer.phone || '',
    phoneNormalized: normalizePhone(customer.phone),
    source: customer.source || (importSource ? 'import' : ''),
    importSource,
    importBatchId
  });
}

export function prepareCustomerImportRows(rows = [], options = {}) {
  const existingCustomers = options.existingCustomers || [];
  const prepared = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const customer = mapCustomerImportRow(row, options);
    const validation = validateCustomerDraft(customer);

    if (!validation.isValid) {
      invalid.push({
        index,
        row,
        reason: validation.errors.join(' '),
        warnings: validation.warnings
      });
      return;
    }

    const preparedCustomers = prepared.map((entry) => entry.customer);
    const duplicates = findDuplicateCustomers([...existingCustomers, ...preparedCustomers], customer);
    prepared.push({
      customer,
      index,
      duplicates,
      duplicateKey: buildImportDuplicateKey(customer),
      warnings: validation.warnings
    });
  });

  return { prepared, invalid };
}

export function buildImportDuplicateKey(customer = {}) {
  const normalizedCustomer = normalizeCustomer(customer);
  return [
    normalizedCustomer.shopId,
    normalizedCustomer.emailNormalized,
    normalizedCustomer.phoneNormalized,
    normalizeText(normalizedCustomer.displayName),
    normalizeText(normalizedCustomer.companyName)
  ].join('|');
}

function readAliasedValue(row, field) {
  const keys = [field, ...(customerImportAliases[field] || [])];
  const foundKey = keys.find((key) => Object.prototype.hasOwnProperty.call(row, key));
  if (foundKey) {
    return row[foundKey];
  }

  const normalizedRowKeys = Object.keys(row).reduce((lookup, key) => {
    lookup[normalizeHeader(key)] = key;
    return lookup;
  }, {});
  const normalizedKey = keys.map(normalizeHeader).find((key) => normalizedRowKeys[key]);
  return normalizedKey ? row[normalizedRowKeys[normalizedKey]] : undefined;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
