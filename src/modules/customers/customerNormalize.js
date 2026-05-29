import { normalizeCustomerTypeValue } from './customerTypes';

export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeEmail(value) {
  return normalizeText(value);
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function combineCustomerName(firstName = '', lastName = '') {
  return [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

export function splitCustomerName(customerName = '') {
  const parts = String(customerName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] || '',
      lastName: ''
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

export function getCustomerDisplayName(customer = {}) {
  const name = String(customer.displayName || customer.display_name || customer.customerName || customer.customer_name || '').trim();
  if (name) return name;

  const personName = combineCustomerName(
    customer.firstName || customer.first_name || customer.customerFirstName || customer.customer_first_name,
    customer.lastName || customer.last_name || customer.customerLastName || customer.customer_last_name
  );
  if (personName) return personName;

  const companyName = String(customer.companyName || customer.company_name || '').trim();
  if (companyName) return companyName;

  return String(customer.email || customer.phone || customer.externalRef || customer.external_ref || 'Unnamed Customer').trim();
}

export function normalizeCustomerType(value) {
  return normalizeCustomerTypeValue(value);
}

export function normalizeCustomer(customer = {}) {
  const hasEmailField = Object.prototype.hasOwnProperty.call(customer, 'email');
  const hasPhoneField = Object.prototype.hasOwnProperty.call(customer, 'phone');
  const activeValue = customer.isActive ?? customer.is_active ?? true;
  const isActive = typeof activeValue === 'string'
    ? !['false', 'inactive', '0'].includes(activeValue.trim().toLowerCase())
    : Boolean(activeValue);
  const splitName = splitCustomerName(customer.displayName || customer.display_name || customer.customerName || customer.customer_name || '');
  const firstName = customer.firstName || customer.first_name || customer.customerFirstName || customer.customer_first_name || splitName.firstName;
  const lastName = customer.lastName || customer.last_name || customer.customerLastName || customer.customer_last_name || splitName.lastName;
  const email = String(customer.email || '').trim();
  const phone = String(customer.phone || '').trim();
  const displayName = getCustomerDisplayName({
    ...customer,
    firstName,
    lastName,
    email,
    phone
  });

  return {
    id: customer.id || customer.customerId || customer.customer_id || crypto.randomUUID(),
    shopId: customer.shopId || customer.shop_id || '',
    displayName,
    firstName,
    lastName,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerName: displayName,
    companyName: customer.companyName || customer.company_name || '',
    customerType: normalizeCustomerType(customer.customerType || customer.customer_type),
    isActive,
    taxId: customer.taxId || customer.tax_id || '',
    email,
    emailNormalized: hasEmailField ? normalizeEmail(email) : customer.emailNormalized || customer.email_normalized || normalizeEmail(email),
    phone,
    phoneNormalized: hasPhoneField ? normalizePhone(phone) : customer.phoneNormalized || customer.phone_normalized || normalizePhone(phone),
    secondaryPhone: customer.secondaryPhone || customer.secondary_phone || '',
    addressLine1: customer.addressLine1 || customer.address_line1 || customer.address || '',
    addressLine2: customer.addressLine2 || customer.address_line2 || '',
    city: customer.city || '',
    region: customer.region || '',
    postalCode: customer.postalCode || customer.postal_code || '',
    country: customer.country || '',
    notes: customer.notes || '',
    source: customer.source || '',
    externalRef: customer.externalRef || customer.external_ref || '',
    importSource: customer.importSource || customer.import_source || '',
    importBatchId: customer.importBatchId || customer.import_batch_id || null,
    createdAt: customer.createdAt || customer.created_at || new Date().toISOString(),
    updatedAt: customer.updatedAt || customer.updated_at || new Date().toISOString(),
    jobs: customer.jobs || []
  };
}
