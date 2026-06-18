import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import { logJobEventSafe } from '../jobs/jobEventsService';

function cleanText(value) {
  return String(value || '').trim();
}

function moneyNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function integerNumber(value, fallback = 0) {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeBarcodeSearch(value) {
  const search = cleanText(value);
  return search.toUpperCase().startsWith('FT-PART-')
    ? search.slice('FT-PART-'.length)
    : search;
}

function toDbPart(shopId, payload = {}) {
  return {
    shop_id: shopId,
    vendor_id: cleanText(payload.vendorId || payload.vendor_id) || null,
    sku: cleanText(payload.sku) || null,
    name: cleanText(payload.name),
    description: cleanText(payload.description) || null,
    category: cleanText(payload.category) || null,
    supplier: cleanText(payload.supplier) || null,
    vendor_sku: cleanText(payload.vendorSku || payload.vendor_sku) || null,
    barcode_code: cleanText(payload.barcodeCode || payload.barcode_code) || null,
    manufacturer: cleanText(payload.manufacturer) || null,
    part_number: cleanText(payload.partNumber || payload.part_number) || null,
    unit_cost: moneyNumber(payload.unitCost ?? payload.unit_cost),
    retail_price: moneyNumber(payload.retailPrice ?? payload.retail_price),
    quantity_on_hand: integerNumber(payload.quantityOnHand ?? payload.quantity_on_hand),
    reorder_point: integerNumber(payload.reorderPoint ?? payload.reorder_point),
    desired_stock_level: integerNumber(payload.desiredStockLevel ?? payload.desired_stock_level),
    location: cleanText(payload.location) || null,
    is_active: payload.isActive ?? payload.is_active ?? true
  };
}

function fromDbPart(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id,
    vendorId: row.vendor_id || '',
    sku: row.sku || '',
    name: row.name || '',
    description: row.description || '',
    category: row.category || '',
    supplier: row.supplier || '',
    vendorSku: row.vendor_sku || '',
    barcodeCode: row.barcode_code || '',
    barcodeLabel: row.barcode_code ? `FT-PART-${row.barcode_code}` : '',
    manufacturer: row.manufacturer || '',
    partNumber: row.part_number || '',
    unitCost: moneyNumber(row.unit_cost),
    retailPrice: moneyNumber(row.retail_price),
    quantityOnHand: integerNumber(row.quantity_on_hand),
    reorderPoint: integerNumber(row.reorder_point),
    desiredStockLevel: integerNumber(row.desired_stock_level),
    lastCost: row.last_cost === null || row.last_cost === undefined ? null : moneyNumber(row.last_cost),
    averageCost: row.average_cost === null || row.average_cost === undefined ? null : moneyNumber(row.average_cost),
    location: row.location || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDbVendor(shopId, payload = {}) {
  return {
    shop_id: shopId,
    name: cleanText(payload.name),
    contact_name: cleanText(payload.contactName || payload.contact_name) || null,
    email: cleanText(payload.email) || null,
    phone: cleanText(payload.phone) || null,
    website: cleanText(payload.website) || null,
    notes: cleanText(payload.notes) || null,
    is_active: payload.isActive ?? payload.is_active ?? true
  };
}

function fromDbVendor(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    name: row.name || '',
    contactName: row.contact_name || '',
    email: row.email || '',
    phone: row.phone || '',
    website: row.website || '',
    notes: row.notes || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromDbPurchaseOrder(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    vendorId: row.vendor_id || '',
    poNumber: row.po_number || '',
    status: row.status || 'draft',
    orderedAt: row.ordered_at || '',
    expectedAt: row.expected_at || '',
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestReceivedAt: row.latest_received_at || '',
    receiptCount: integerNumber(row.receipt_count),
    items: []
  };
}

function fromDbPurchaseOrderItem(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    partId: row.part_id || '',
    description: row.description || '',
    vendorSku: row.vendor_sku || '',
    quantityOrdered: integerNumber(row.quantity_ordered),
    quantityReceived: integerNumber(row.quantity_received),
    unitCost: moneyNumber(row.unit_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromDbPartMovement(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    partId: row.part_id || '',
    jobId: row.job_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    inventoryReceiptId: row.inventory_receipt_id || '',
    inventoryReceiptItemId: row.inventory_receipt_item_id || '',
    movementType: row.movement_type || '',
    quantity: integerNumber(row.quantity),
    unitCost: row.unit_cost === null || row.unit_cost === undefined ? null : moneyNumber(row.unit_cost),
    retailPrice: row.retail_price === null || row.retail_price === undefined ? null : moneyNumber(row.retail_price),
    note: row.note || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at
  };
}

function fromDbReceiptItem(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    inventoryReceiptId: row.inventory_receipt_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    purchaseOrderItemId: row.purchase_order_item_id || '',
    partId: row.part_id || '',
    description: row.description || '',
    vendorSku: row.vendor_sku || '',
    quantityReceived: integerNumber(row.quantity_received),
    unitCost: moneyNumber(row.unit_cost),
    createdAt: row.created_at
  };
}

function fromDbJobPart(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    jobId: row.job_id || '',
    partId: row.part_id || '',
    sku: row.sku || '',
    name: row.name || '',
    quantity: Number(row.quantity || 1),
    cost: moneyNumber(row.cost ?? row.unit_cost),
    retail: moneyNumber(row.retail ?? row.retail_price),
    createdAt: row.created_at
  };
}

function requireInventoryConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Inventory requires the live Supabase-backed FretTrack app.');
  }
}

export async function listParts(shopId = getCurrentShopId(), filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('parts')
    .select('*')
    .eq('shop_id', shopId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (filters.activeOnly) {
    query = query.eq('is_active', true);
  }

  const search = cleanText(filters.search);
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    const barcodeSearch = normalizeBarcodeSearch(search);
    const escapedBarcode = barcodeSearch.replace(/[%_]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,category.ilike.%${escaped}%,supplier.ilike.%${escaped}%,vendor_sku.ilike.%${escaped}%,barcode_code.ilike.%${escapedBarcode}%,manufacturer.ilike.%${escaped}%,part_number.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const parts = (data || []).map(fromDbPart);
  return filters.lowStockOnly
    ? parts.filter((part) => part.quantityOnHand <= part.reorderPoint)
    : parts;
}

export async function getPart(partId) {
  requireInventoryConfigured();
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('id', partId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? fromDbPart(data) : null;
}

export async function createPart(shopId = getCurrentShopId(), payload = {}) {
  requireInventoryConfigured();
  const partPayload = toDbPart(shopId, payload);
  if (!partPayload.name) {
    throw new Error('Part name is required.');
  }

  const { data, error } = await supabase
    .from('parts')
    .insert(partPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const createdPart = fromDbPart(data);
  // TODO: Add shop-level audit events when FretTrack has a non-job event table.
  return createdPart;
}

export async function updatePart(partId, payload = {}) {
  requireInventoryConfigured();
  const existingPart = await getPart(partId);
  if (!existingPart) {
    throw new Error('Part not found.');
  }

  const { data, error } = await supabase
    .from('parts')
    .update(toDbPart(existingPart.shopId, { ...existingPart, ...payload }))
    .eq('id', partId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbPart(data);
}

export async function deactivatePart(partId) {
  return updatePart(partId, { isActive: false });
}

export async function listVendors(shopId = getCurrentShopId(), filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('vendors')
    .select('*')
    .eq('shop_id', shopId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (filters.activeOnly) {
    query = query.eq('is_active', true);
  }

  const search = cleanText(filters.search);
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,contact_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).map(fromDbVendor);
}

export async function createVendor(shopId = getCurrentShopId(), payload = {}) {
  requireInventoryConfigured();
  const vendorPayload = toDbVendor(shopId, payload);
  if (!vendorPayload.name) {
    throw new Error('Vendor name is required.');
  }

  const { data, error } = await supabase
    .from('vendors')
    .insert(vendorPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbVendor(data);
}

export async function updateVendor(vendorId, payload = {}) {
  requireInventoryConfigured();
  const shopId = payload.shopId || payload.shop_id || getCurrentShopId();
  const vendorPayload = toDbVendor(shopId, payload);
  if (!vendorPayload.name) {
    throw new Error('Vendor name is required.');
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(vendorPayload)
    .eq('id', vendorId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbVendor(data);
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

  return mappedOrders.map((order) => ({
    ...order,
    latestReceivedAt: receiptsByOrderId.get(order.id)?.[0]?.received_at || '',
    receiptCount: receiptsByOrderId.get(order.id)?.length || 0,
    items: itemsByOrderId.get(order.id) || []
  }));
}

export async function createPurchaseOrder(shopId = getCurrentShopId(), payload = {}) {
  requireInventoryConfigured();
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    throw new Error('Add at least one purchase order item.');
  }

  const orderPayload = {
    shop_id: shopId,
    vendor_id: cleanText(payload.vendorId || payload.vendor_id) || null,
    status: cleanText(payload.status) || 'draft',
    ordered_at: cleanText(payload.orderedAt || payload.ordered_at) || null,
    expected_at: cleanText(payload.expectedAt || payload.expected_at) || null,
    notes: cleanText(payload.notes) || null
  };

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert(orderPayload)
    .select()
    .single();

  if (orderError) {
    throw orderError;
  }

  const itemPayloads = items.map((item) => {
    const matchedPart = item.part || {};
    return {
      shop_id: shopId,
      purchase_order_id: order.id,
      part_id: cleanText(item.partId || item.part_id) || null,
      description: cleanText(item.description) || matchedPart.name || 'Inventory item',
      vendor_sku: cleanText(item.vendorSku || item.vendor_sku) || matchedPart.vendorSku || null,
      quantity_ordered: Math.max(integerNumber(item.quantityOrdered ?? item.quantity_ordered, 1), 1),
      quantity_received: Math.max(integerNumber(item.quantityReceived ?? item.quantity_received, 0), 0),
      unit_cost: moneyNumber(item.unitCost ?? item.unit_cost)
    };
  });

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemPayloads);

  if (itemsError) {
    throw itemsError;
  }

  return fromDbPurchaseOrder(order);
}

export async function updatePurchaseOrderStatus(purchaseOrderId, status) {
  requireInventoryConfigured();
  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: cleanText(status) || 'draft' })
    .eq('id', purchaseOrderId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return fromDbPurchaseOrder(data);
}

async function createPartMovement(part, movementType, quantity, { unitCost, retailPrice, note, jobId = null } = {}) {
  requireInventoryConfigured();
  const { error } = await supabase
    .from('part_movements')
    .insert({
      shop_id: part.shopId,
      part_id: part.id,
      job_id: jobId,
      movement_type: movementType,
      quantity,
      unit_cost: unitCost ?? part.unitCost,
      retail_price: retailPrice ?? part.retailPrice,
      note: cleanText(note) || null
    });

  if (error) {
    throw error;
  }
}

export async function receivePart(partId, quantity, cost, note = '') {
  const receivedQuantity = integerNumber(quantity, 0);
  if (receivedQuantity < 1) {
    throw new Error('Receive quantity must be at least 1.');
  }
  const unitCost = cleanText(cost) === '' ? null : moneyNumber(cost);
  requireInventoryConfigured();
  const { data, error } = await supabase.rpc('receive_inventory_part', {
    p_part_id: partId,
    p_quantity: receivedQuantity,
    p_unit_cost: unitCost,
    p_note: cleanText(note)
  });

  if (error) {
    throw error;
  }
  return fromDbPart(Array.isArray(data) ? data[0] : data);
}

export async function receivePurchaseOrderItems(purchaseOrderId, items = [], note = '') {
  requireInventoryConfigured();
  const receiptItems = items
    .map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId || item.purchase_order_item_id || item.id,
      quantityReceived: integerNumber(item.quantityReceived ?? item.quantity_received ?? item.quantity, 0),
      unitCost: moneyNumber(item.unitCost ?? item.unit_cost)
    }))
    .filter((item) => item.purchaseOrderItemId && item.quantityReceived > 0);

  if (!receiptItems.length) {
    throw new Error('Enter a received quantity for at least one purchase order item.');
  }

  const { data, error } = await supabase.rpc('receive_purchase_order_items', {
    p_purchase_order_id: purchaseOrderId,
    p_items: receiptItems,
    p_note: cleanText(note)
  });

  if (error) {
    throw error;
  }
  return data;
}

export async function fixMissingPartBarcodeCode(part) {
  if (!part?.id) {
    throw new Error('Select a part first.');
  }
  return updatePart(part.id, { ...part, barcodeCode: '' });
}

export async function adjustPart(partId, quantityDelta, note = '') {
  const part = await getPart(partId);
  if (!part) {
    throw new Error('Part not found.');
  }
  const delta = integerNumber(quantityDelta, 0);
  const updatedPart = await updatePart(partId, {
    quantityOnHand: part.quantityOnHand + delta
  });
  await createPartMovement(updatedPart, 'adjust', delta, { note });
  return updatedPart;
}

export async function addPartToJob(jobId, partId, quantity = 1) {
  requireInventoryConfigured();
  const part = await getPart(partId);
  if (!part) {
    throw new Error('Part not found.');
  }
  const requestedQuantity = Math.max(integerNumber(quantity, 1), 1);
  const { data, error } = await supabase.rpc('add_inventory_part_to_job', {
    p_job_id: jobId,
    p_part_id: partId,
    p_quantity: requestedQuantity
  });

  if (error) {
    throw error;
  }

  const jobPart = fromDbJobPart(Array.isArray(data) ? data[0] : data);
  logJobEventSafe({
    shopId: jobPart.shopId || part.shopId,
    jobId,
    eventType: 'part_added_to_job',
    eventLabel: 'Inventory part added',
    eventNote: `${part.name} x${requestedQuantity}`,
    eventData: {
      partId,
      jobPartId: jobPart.id,
      sku: part.sku,
      quantity: requestedQuantity,
      retailPrice: part.retailPrice
    }
  });
  return jobPart;
}

export async function updateInventoryJobPartQuantity(jobPartId, quantity) {
  requireInventoryConfigured();
  const requestedQuantity = Math.max(integerNumber(quantity, 1), 1);
  const { data, error } = await supabase.rpc('update_inventory_job_part_quantity', {
    p_job_part_id: jobPartId,
    p_quantity: requestedQuantity
  });

  if (error) {
    throw error;
  }

  const jobPart = fromDbJobPart(Array.isArray(data) ? data[0] : data);
  logJobEventSafe({
    shopId: jobPart.shopId,
    jobId: jobPart.jobId,
    eventType: 'part_quantity_changed',
    eventLabel: 'Part quantity changed',
    eventNote: `${jobPart.name} x${jobPart.quantity}`,
    eventData: {
      jobPartId: jobPart.id,
      partId: jobPart.partId,
      sku: jobPart.sku,
      quantity: jobPart.quantity
    }
  });
  return jobPart;
}

export async function addManualPartToJob(jobId, payload = {}) {
  requireInventoryConfigured();
  const quantity = Math.max(Number(payload.quantity || 1), 0);
  const retail = moneyNumber(payload.retail ?? payload.retailPrice);
  const cost = moneyNumber(payload.cost ?? payload.unitCost);
  const { data, error } = await supabase
    .from('job_parts')
    .insert({
      id: payload.id || crypto.randomUUID(),
      shop_id: payload.shopId || getCurrentShopId(),
      job_id: jobId,
      part_id: null,
      name: cleanText(payload.name),
      sku: cleanText(payload.sku) || null,
      quantity,
      cost,
      retail,
      unit_cost: cost,
      retail_price: retail,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const jobPart = fromDbJobPart(data);
  logJobEventSafe({
    shopId: jobPart.shopId,
    jobId,
    eventType: 'part_added_to_job',
    eventLabel: 'Manual part added',
    eventNote: `${jobPart.name} x${jobPart.quantity}`,
    eventData: {
      jobPartId: jobPart.id,
      sku: jobPart.sku,
      quantity: jobPart.quantity,
      retailPrice: jobPart.retail
    }
  });
  return jobPart;
}

export async function removeJobPart(jobPartId) {
  requireInventoryConfigured();
  const { data: existingPart, error: existingError } = await supabase
    .from('job_parts')
    .select('*')
    .eq('id', jobPartId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }
  if (!existingPart) {
    return null;
  }

  const { error } = await supabase
    .from('job_parts')
    .delete()
    .eq('id', jobPartId);

  if (error) {
    throw error;
  }

  const jobPart = fromDbJobPart(existingPart);
  if (jobPart.partId) {
    const part = await getPart(jobPart.partId);
    if (part) {
      const restoredQuantity = Math.max(Number(jobPart.quantity || 0), 0);
      await updatePart(part.id, {
        quantityOnHand: part.quantityOnHand + restoredQuantity
      });
      await createPartMovement(part, 'return', restoredQuantity, {
        jobId: jobPart.jobId,
        unitCost: jobPart.cost,
        retailPrice: jobPart.retail,
        note: 'Removed from job'
      });
    }
  }

  logJobEventSafe({
    shopId: jobPart.shopId,
    jobId: jobPart.jobId,
    eventType: 'part_removed_from_job',
    eventLabel: 'Part removed',
    eventNote: `${jobPart.name} x${jobPart.quantity}`,
    eventData: {
      jobPartId,
      partId: jobPart.partId,
      sku: jobPart.sku,
      quantity: jobPart.quantity
    }
  });
  return jobPart;
}

export async function listJobParts(jobId) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('job_parts')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return (data || []).map(fromDbJobPart);
}

export async function listPartMovements(partId) {
  if (!hasSupabaseConfig || !supabase || !partId) {
    return [];
  }

  const { data, error } = await supabase
    .from('part_movements')
    .select('*')
    .eq('part_id', partId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    throw error;
  }
  return (data || []).map(fromDbPartMovement);
}

export async function listPartPurchaseHistory(partId) {
  if (!hasSupabaseConfig || !supabase || !partId) {
    return [];
  }

  return listPurchaseHistory({ partId });
}

export async function listPurchaseHistory({ shopId = getCurrentShopId(), partId = null } = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let receiptItemsQuery = supabase
    .from('inventory_receipt_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(75);

  if (partId) {
    receiptItemsQuery = receiptItemsQuery.eq('part_id', partId);
  } else {
    receiptItemsQuery = receiptItemsQuery.eq('shop_id', shopId);
  }

  const { data: receiptItems, error: receiptItemsError } = await receiptItemsQuery;

  if (receiptItemsError) {
    throw receiptItemsError;
  }

  const mappedItems = (receiptItems || []).map(fromDbReceiptItem);
  const receiptIds = [...new Set(mappedItems.map((item) => item.inventoryReceiptId).filter(Boolean))];
  const orderIds = [...new Set(mappedItems.map((item) => item.purchaseOrderId).filter(Boolean))];
  const partIds = [...new Set(mappedItems.map((item) => item.partId).filter(Boolean))];

  const receiptsById = new Map();
  if (receiptIds.length) {
    const { data: receipts, error: receiptsError } = await supabase
      .from('inventory_receipts')
      .select('*')
      .in('id', receiptIds);

    if (receiptsError) {
      throw receiptsError;
    }
    for (const receipt of receipts || []) {
      receiptsById.set(receipt.id, receipt);
    }
  }

  const ordersById = new Map();
  if (orderIds.length) {
    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('*')
      .in('id', orderIds);

    if (ordersError) {
      throw ordersError;
    }
    for (const order of orders || []) {
      ordersById.set(order.id, order);
    }
  }

  const partsById = new Map();
  const vendorIds = new Set();
  if (partIds.length) {
    const { data: parts, error: partsError } = await supabase
      .from('parts')
      .select('*')
      .in('id', partIds);

    if (partsError) {
      throw partsError;
    }
    for (const part of (parts || []).map(fromDbPart)) {
      partsById.set(part.id, part);
      if (part.vendorId) {
        vendorIds.add(part.vendorId);
      }
    }
  }

  for (const receipt of receiptsById.values()) {
    if (receipt.vendor_id) {
      vendorIds.add(receipt.vendor_id);
    }
  }
  for (const order of ordersById.values()) {
    if (order.vendor_id) {
      vendorIds.add(order.vendor_id);
    }
  }

  const vendorsById = new Map();
  if (vendorIds.size) {
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('*')
      .in('id', [...vendorIds]);

    if (vendorsError) {
      throw vendorsError;
    }
    for (const vendor of (vendors || []).map(fromDbVendor)) {
      vendorsById.set(vendor.id, vendor);
    }
  }

  return mappedItems.map((item) => {
    const receipt = receiptsById.get(item.inventoryReceiptId) || {};
    const order = ordersById.get(item.purchaseOrderId) || {};
    const part = partsById.get(item.partId) || {};
    const vendorId = receipt.vendor_id || order.vendor_id || part.vendorId || '';
    const totalCost = item.quantityReceived * item.unitCost;
    return {
      ...item,
      partName: part.name || item.description || '',
      partSku: part.sku || '',
      vendorName: vendorsById.get(vendorId)?.name || '',
      receiptNumber: receipt.receipt_number || '',
      receivedAt: receipt.received_at || item.createdAt,
      receiptNotes: receipt.notes || '',
      receivedBy: receipt.received_by || '',
      poNumber: order.po_number || '',
      totalCost
    };
  });
}
