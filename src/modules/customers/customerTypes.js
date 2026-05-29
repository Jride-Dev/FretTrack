export const customerTypes = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'vendor', label: 'Vendor' }
];

export const customerStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const customerSources = [
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'phone', label: 'Phone' },
  { value: 'referral', label: 'Referral' },
  { value: 'import', label: 'Import' },
  { value: 'work_order', label: 'Work Order' }
];

export function getCustomerTypeLabel(customerType = '') {
  const normalized = String(customerType || '').toLowerCase();
  return customerTypes.find((type) => type.value === normalized)?.label ||
    (normalized === 'company' ? 'Business' : 'Individual');
}

export function normalizeCustomerTypeValue(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'company') {
    return 'business';
  }

  if (customerTypes.some((type) => type.value === normalized)) {
    return normalized;
  }

  return 'individual';
}
