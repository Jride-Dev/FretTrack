import { inventoryUnitsForPurchaseQuantity } from './purchaseUnits.js';

export function remainingForPurchaseOrderItem(item) {
  return Math.max(Number(item?.quantityOrdered || 0) - Number(item?.quantityReceived || 0), 0);
}

export function purchaseOrderTotals(order) {
  const items = order?.items || [];
  const totals = items.reduce((summary, item) => {
    const ordered = Number(item.quantityOrdered || 0);
    const received = Number(item.quantityReceived || 0);
    const cost = Number(item.unitCost || 0);
    summary.lineCount += 1;
    summary.ordered += ordered;
    summary.received += received;
    summary.remaining += Math.max(ordered - received, 0);
    summary.inventoryOrdered += inventoryUnitsForPurchaseQuantity(ordered, item.unitsPerPurchaseUnit) || 0;
    summary.inventoryReceived += inventoryUnitsForPurchaseQuantity(received, item.unitsPerPurchaseUnit) || 0;
    summary.inventoryRemaining += inventoryUnitsForPurchaseQuantity(Math.max(ordered - received, 0), item.unitsPerPurchaseUnit) || 0;
    summary.itemSubtotal += ordered * cost;
    summary.receivedSubtotalFallback += received * cost;
    return summary;
  }, {
    lineCount: 0,
    ordered: 0,
    received: 0,
    remaining: 0,
    inventoryOrdered: 0,
    inventoryReceived: 0,
    inventoryRemaining: 0,
    itemSubtotal: 0,
    receivedSubtotalFallback: 0
  });
  const shippingCost = Number(order?.shippingCost || 0);
  const receivedSubtotal = Number(order?.receivedSubtotal || totals.receivedSubtotalFallback || 0);
  const allocatedShipping = Number(order?.allocatedShipping || 0);
  const landedReceivedTotal = Number(order?.landedReceivedTotal || receivedSubtotal + allocatedShipping || 0);
  return {
    ...totals,
    estimatedCost: totals.itemSubtotal,
    shippingCost,
    estimatedTotal: totals.itemSubtotal + shippingCost,
    receivedSubtotal,
    allocatedShipping,
    landedReceivedTotal
  };
}
