import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import { cleanText, moneyNumber, integerNumber, normalizePurchaseUnit, fromDbPurchaseOrder, fromDbPurchaseOrderItem, fromDbReceiptItem, fromDbJobPart } from './inventoryServiceNormalization.js';

function requireInventoryConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Inventory requires the live Supabase-backed FretTrack app.');
  }
}

export async function listPurchaseOrders(shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  const { data: orders, error: ordersError } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw ordersError;
  }

  const mappedOrders = (orders || []).map(fromDbPurchaseOrder);
  const orderIds = mappedOrders.map((order) => order.id);
  if (!orderIds.length) {
    return mappedOrders;
  }

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .in('purchase_order_id', orderIds)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const { data: receipts, error: receiptsError } = await supabase
    .from('inventory_receipts')
    .select('*')
    .in('purchase_order_id', orderIds)
    .order('received_at', { ascending: false });

  if (receiptsError) {
    throw receiptsError;
  }

  const { data: receiptItems, error: receiptItemsError } = await supabase
    .from('inventory_receipt_items')
    .select('*')
    .in('purchase_order_id', orderIds);

  if (receiptItemsError) {
    throw receiptItemsError;
  }

  const itemsByOrderId = new Map();
  for (const item of (items || []).map(fromDbPurchaseOrderItem)) {
    const rows = itemsByOrderId.get(item.purchaseOrderId) || [];
    rows.push(item);
    itemsByOrderId.set(item.purchaseOrderId, rows);
  }

  const receiptsByOrderId = new Map();
  for (const receipt of receipts || []) {
    const rows = receiptsByOrderId.get(receipt.purchase_order_id) || [];
    rows.push(receipt);
    receiptsByOrderId.set(receipt.purchase_order_id, rows);
  }

  const receiptTotalsByOrderId = new Map();
  for (const item of (receiptItems || []).map(fromDbReceiptItem)) {
    const totals = receiptTotalsByOrderId.get(item.purchaseOrderId) || {
      receivedSubtotal: 0,
      allocatedShipping: 0,
      landedReceivedTotal: 0
    };
    const baseTotal = item.quantityReceived * item.baseUnitCost;
    totals.receivedSubtotal += baseTotal;
    totals.allocatedShipping += item.shippingAllocated;
    totals.landedReceivedTotal += baseTotal + item.shippingAllocated;
    receiptTotalsByOrderId.set(item.purchaseOrderId, totals);
  }

  return mappedOrders.map((order) => {
    const receiptTotals = receiptTotalsByOrderId.get(order.id) || {};
    return {
      ...order,
      latestReceivedAt: receiptsByOrderId.get(order.id)?.[0]?.received_at || '',
      receiptCount: receiptsByOrderId.get(order.id)?.length || 0,
      receivedSubtotal: moneyNumber(receiptTotals.receivedSubtotal),
      allocatedShipping: moneyNumber(receiptTotals.allocatedShipping),
      landedReceivedTotal: moneyNumber(receiptTotals.landedReceivedTotal),
      items: itemsByOrderId.get(order.id) || []
    };
  });
}

export async function listJobPurchaseOrders(jobId) {
  if (!hasSupabaseConfig || !supabase || !jobId) {
    return [];
  }

  const { data: items, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (itemsError) {
    throw itemsError;
  }

  const mappedItems = (items || []).map(fromDbPurchaseOrderItem);
  const orderIds = [...new Set(mappedItems.map((item) => item.purchaseOrderId).filter(Boolean))];
  if (!orderIds.length) {
    return [];
  }

  const { data: orders, error: ordersError } = await supabase
    .from('purchase_orders')
    .select('*')
    .in('id', orderIds)
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw ordersError;
  }

  return (orders || []).map((row) => ({
    ...fromDbPurchaseOrder(row),
    items: mappedItems.filter((item) => item.purchaseOrderId === row.id)
  }));
}

export async function createSpecialistPurchaseOrder(jobId, payload = {}) {
  requireInventoryConfigured();
  const requestKey = cleanText(payload.requestKey || payload.request_key);
  if (!requestKey) {
    throw new Error('A purchase request key is required.');
  }

  const { data, error } = await supabase.rpc('create_specialist_purchase_order', {
    p_job_id: jobId,
    p_request_key: requestKey,
    p_vendor_id: cleanText(payload.vendorId || payload.vendor_id) || null,
    p_part_id: cleanText(payload.partId || payload.part_id) || null,
    p_keyboard_part_request_id: cleanText(payload.keyboardPartRequestId || payload.keyboard_part_request_id) || null,
    p_description: cleanText(payload.description),
    p_vendor_sku: cleanText(payload.vendorSku || payload.vendor_sku),
    p_quantity_ordered: Math.max(integerNumber(payload.quantityOrdered ?? payload.quantity_ordered, 1), 1),
    p_job_quantity: Math.max(integerNumber(payload.jobQuantity ?? payload.job_quantity, 1), 1),
    p_purchase_unit: normalizePurchaseUnit(payload.purchaseUnit || payload.purchase_unit),
    p_units_per_purchase_unit: Number(payload.unitsPerPurchaseUnit ?? payload.units_per_purchase_unit ?? 1),
    p_unit_cost: moneyNumber(payload.unitCost ?? payload.unit_cost),
    p_retail_price: moneyNumber(payload.retailPrice ?? payload.retail_price),
    p_expected_at: cleanText(payload.expectedAt || payload.expected_at) || null,
    p_notes: cleanText(payload.notes)
  });

  if (error) {
    throw error;
  }

  const purchaseOrder = fromDbPurchaseOrder(data?.purchaseOrder || data?.purchase_order || {});
  const item = fromDbPurchaseOrderItem(data?.item || {});
  return {
    purchaseOrder: { ...purchaseOrder, items: item.id ? [item] : [] },
    item,
    replayed: data?.replayed === true
  };
}

export async function fulfillSpecialistPurchaseOrderItem(purchaseOrderItemId) {
  requireInventoryConfigured();
  const { data, error } = await supabase.rpc('fulfill_specialist_purchase_order_item', {
    p_purchase_order_item_id: purchaseOrderItemId
  });

  if (error) {
    throw error;
  }
  return fromDbJobPart(Array.isArray(data) ? data[0] : data);
}
