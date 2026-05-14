import { normalizeCustomer, normalizeText } from './customerNormalize';

export function hasRecommendedContactMethod(customer = {}) {
  const normalizedCustomer = normalizeCustomer(customer);
  return Boolean(normalizedCustomer.emailNormalized || normalizedCustomer.phoneNormalized || normalizedCustomer.secondaryPhone);
}

export function validateCustomerDraft(customer = {}) {
  const normalizedCustomer = normalizeCustomer(customer);
  const errors = [];
  const warnings = [];
  const hasDisplayName = normalizeText(normalizedCustomer.displayName) && normalizeText(normalizedCustomer.displayName) !== 'unnamed customer';

  if (!normalizedCustomer.shopId) {
    errors.push('Customer is missing shop_id.');
  }

  if (!hasDisplayName) {
    errors.push('Customer needs a display name, person name, company name, contact method, or external reference.');
  }

  if (!hasRecommendedContactMethod(normalizedCustomer)) {
    warnings.push('Email or phone is recommended for duplicate detection and follow-up.');
  }

  return {
    customer: normalizedCustomer,
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function isImportableCustomerDraft(customer = {}) {
  const validation = validateCustomerDraft(customer);
  return validation.isValid;
}
