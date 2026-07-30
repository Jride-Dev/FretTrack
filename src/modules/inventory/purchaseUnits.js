export const PURCHASE_UNIT_OPTIONS = [
  { value: 'each', label: 'Each' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
  { value: 'bag', label: 'Bag' },
  { value: 'case', label: 'Case' },
  { value: 'set', label: 'Set' },
  { value: 'roll', label: 'Roll' },
  { value: 'bottle', label: 'Bottle' }
];

const PURCHASE_UNIT_LABELS = new Map(PURCHASE_UNIT_OPTIONS.map((option) => [option.value, option.label]));

export function normalizePurchaseUnit(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PURCHASE_UNIT_LABELS.has(normalized) ? normalized : 'each';
}

export function validUnitsPerPurchaseUnit(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 999999;
}

export function inventoryUnitsForPurchaseQuantity(quantity, unitsPerPurchaseUnit) {
  const purchaseQuantity = Number(quantity);
  const conversion = Number(unitsPerPurchaseUnit);
  if (!Number.isInteger(purchaseQuantity) || purchaseQuantity < 0 || !validUnitsPerPurchaseUnit(conversion)) {
    return null;
  }
  return purchaseQuantity * conversion;
}

export function purchaseUnitLabel(unit, quantity = 1) {
  const label = PURCHASE_UNIT_LABELS.get(normalizePurchaseUnit(unit)) || 'Each';
  return Number(quantity) === 1 || label === 'Each' ? label : `${label}s`;
}

export function purchaseConversionSummary(quantity, purchaseUnit, unitsPerPurchaseUnit) {
  const inventoryQuantity = inventoryUnitsForPurchaseQuantity(quantity, unitsPerPurchaseUnit);
  if (inventoryQuantity === null) {
    return '';
  }
  return `${quantity} ${purchaseUnitLabel(purchaseUnit, quantity)} × ${unitsPerPurchaseUnit} Each = ${inventoryQuantity} inventory units`;
}
