export const EMPTY_PART_FORM = {
  vendorId: '',
  sku: '',
  name: '',
  description: '',
  category: '',
  supplier: '',
  vendorSku: '',
  barcodeCode: '',
  manufacturer: '',
  partNumber: '',
  purchaseUnit: 'each',
  unitsPerPurchaseUnit: '1',
  unitCost: '',
  retailPrice: '',
  quantityOnHand: '0',
  reorderPoint: '0',
  desiredStockLevel: '0',
  location: '',
  specialOrder: false,
  isActive: true
};

export const EMPTY_VENDOR_FORM = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  onlineOnly: false,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  notes: '',
  isActive: true
};

export const EMPTY_PURCHASE_ORDER_ITEM = {
  partId: '',
  description: '',
  vendorSku: '',
  quantityOrdered: '1',
  purchaseUnit: 'each',
  unitsPerPurchaseUnit: '1',
  unitCost: ''
};

export const EMPTY_PURCHASE_ORDER_FORM = {
  vendorId: '',
  status: 'draft',
  orderedAt: '',
  expectedAt: '',
  shippingCost: '',
  addShippingToCost: false,
  notes: '',
  items: [{ ...EMPTY_PURCHASE_ORDER_ITEM }]
};

export const PURCHASE_ORDER_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];
export const PURCHASE_ORDER_FILTER_OPTIONS = ['all', ...PURCHASE_ORDER_STATUSES];

export function mergeInventoryPresetOptions(...optionSources) {
  const seen = new Set();
  const options = [];
  for (const source of optionSources) {
    const values = Array.isArray(source) ? source : [source];
    for (const value of values) {
      const label = String(value || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push(label);
    }
  }
  return options.sort((left, right) => left.localeCompare(right));
}
