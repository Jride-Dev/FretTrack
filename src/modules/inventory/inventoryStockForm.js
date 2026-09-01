export function withAuthoritativeStockFields(partForm, part) {
  if (!part) {
    return partForm;
  }

  const nextForm = {
    ...partForm,
    quantityOnHand: String(part.quantityOnHand ?? 0),
    unitCost: String(part.unitCost ?? '')
  };
  if (part.purchaseUnitCost !== null && part.purchaseUnitCost !== undefined) {
    nextForm.purchaseUnitCost = String(part.purchaseUnitCost);
  }
  return nextForm;
}
