export function withAuthoritativeStockFields(partForm, part) {
  if (!part) {
    return partForm;
  }

  return {
    ...partForm,
    quantityOnHand: String(part.quantityOnHand ?? 0),
    unitCost: String(part.unitCost ?? '')
  };
}
