import { getCurrentShopId } from '../shops/shopConfig';
import { normalizePurchaseUnit, validUnitsPerPurchaseUnit } from './purchaseUnits';

export { normalizePurchaseUnit, validUnitsPerPurchaseUnit };

export function cleanText(value) {
  return String(value || '').trim();
}

export function moneyNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function integerNumber(value, fallback = 0) {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function normalizeBarcodeSearch(value) {
  const search = cleanText(value);
  return search.toUpperCase().startsWith('FT-PART-')
    ? search.slice('FT-PART-'.length)
    : search;
}

export function toDbPart(shopId, payload = {}) {
  const specialOrder = payload.specialOrder ?? payload.special_order ?? false;
  const unitsPerPurchaseUnit = Number(payload.unitsPerPurchaseUnit ?? payload.units_per_purchase_unit ?? 1);
  if (!validUnitsPerPurchaseUnit(unitsPerPurchaseUnit)) {
    throw new Error('Units per purchase unit must be a whole number of at least 1.');
  }
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
    purchase_unit: normalizePurchaseUnit(payload.purchaseUnit || payload.purchase_unit),
    units_per_purchase_unit: unitsPerPurchaseUnit,
    unit_cost: moneyNumber(payload.unitCost ?? payload.unit_cost),
    retail_price: moneyNumber(payload.retailPrice ?? payload.retail_price),
    quantity_on_hand: integerNumber(payload.quantityOnHand ?? payload.quantity_on_hand),
    reorder_point: integerNumber(payload.reorderPoint ?? payload.reorder_point),
    desired_stock_level: specialOrder ? 0 : integerNumber(payload.desiredStockLevel ?? payload.desired_stock_level),
    location: cleanText(payload.location) || null,
    special_order: Boolean(specialOrder),
    is_active: payload.isActive ?? payload.is_active ?? true
  };
}

export function fromDbPart(row = {}) {
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
    purchaseUnit: normalizePurchaseUnit(row.purchase_unit),
    unitsPerPurchaseUnit: integerNumber(row.units_per_purchase_unit, 1),
    unitCost: moneyNumber(row.unit_cost),
    retailPrice: moneyNumber(row.retail_price),
    quantityOnHand: integerNumber(row.quantity_on_hand),
    reorderPoint: integerNumber(row.reorder_point),
    desiredStockLevel: integerNumber(row.desired_stock_level),
    specialOrder: row.special_order === true,
    imagePath: row.image_path || '',
    imageMimeType: row.image_mime_type || '',
    imageWidth: row.image_width == null ? null : integerNumber(row.image_width),
    imageHeight: row.image_height == null ? null : integerNumber(row.image_height),
    lastCost: row.last_cost === null || row.last_cost === undefined ? null : moneyNumber(row.last_cost),
    averageCost: row.average_cost === null || row.average_cost === undefined ? null : moneyNumber(row.average_cost),
    location: row.location || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toDbVendor(shopId, payload = {}) {
  return {
    shop_id: shopId,
    name: cleanText(payload.name),
    contact_name: cleanText(payload.contactName || payload.contact_name) || null,
    email: cleanText(payload.email) || null,
    phone: cleanText(payload.phone) || null,
    website: cleanText(payload.website) || null,
    address_line1: cleanText(payload.addressLine1 || payload.address_line1) || null,
    address_line2: cleanText(payload.addressLine2 || payload.address_line2) || null,
    city: cleanText(payload.city) || null,
    state: cleanText(payload.state) || null,
    postal_code: cleanText(payload.postalCode || payload.postal_code) || null,
    country: cleanText(payload.country) || 'US',
    online_only: payload.onlineOnly ?? payload.online_only ?? false,
    notes: cleanText(payload.notes) || null,
    is_active: payload.isActive ?? payload.is_active ?? true
  };
}

export function fromDbVendor(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    name: row.name || '',
    contactName: row.contact_name || '',
    email: row.email || '',
    phone: row.phone || '',
    website: row.website || '',
    addressLine1: row.address_line1 || '',
    addressLine2: row.address_line2 || '',
    city: row.city || '',
    state: row.state || '',
    postalCode: row.postal_code || '',
    country: row.country || 'US',
    onlineOnly: row.online_only === true,
    notes: row.notes || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromDbPurchaseOrder(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    vendorId: row.vendor_id || '',
    poNumber: row.po_number || '',
    status: row.status || 'draft',
    orderedAt: row.ordered_at || '',
    expectedAt: row.expected_at || '',
    notes: row.notes || '',
    shippingCost: moneyNumber(row.shipping_cost),
    addShippingToCost: row.add_shipping_to_cost === true,
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestReceivedAt: row.latest_received_at || '',
    receiptCount: integerNumber(row.receipt_count),
    receivedSubtotal: moneyNumber(row.received_subtotal),
    allocatedShipping: moneyNumber(row.allocated_shipping),
    landedReceivedTotal: moneyNumber(row.landed_received_total),
    items: []
  };
}

export function fromDbPurchaseOrderItem(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    partId: row.part_id || '',
    jobId: row.job_id || '',
    jobQuantity: integerNumber(row.job_quantity),
    jobPartId: row.job_part_id || '',
    specialistRequestKey: row.specialist_request_key || '',
    description: row.description || '',
    vendorSku: row.vendor_sku || '',
    quantityOrdered: integerNumber(row.quantity_ordered),
    quantityReceived: integerNumber(row.quantity_received),
    purchaseUnit: normalizePurchaseUnit(row.purchase_unit),
    unitsPerPurchaseUnit: integerNumber(row.units_per_purchase_unit, 1),
    unitCost: moneyNumber(row.unit_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromDbPartMovement(row = {}) {
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

export function fromDbReceiptItem(row = {}) {
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
    purchaseUnit: normalizePurchaseUnit(row.purchase_unit),
    unitsPerPurchaseUnit: integerNumber(row.units_per_purchase_unit, 1),
    inventoryQuantityReceived: integerNumber(row.inventory_quantity_received ?? row.quantity_received),
    unitCost: moneyNumber(row.unit_cost),
    baseUnitCost: row.base_unit_cost === null || row.base_unit_cost === undefined ? moneyNumber(row.unit_cost) : moneyNumber(row.base_unit_cost),
    shippingAllocated: moneyNumber(row.shipping_allocated),
    landedUnitCost: row.landed_unit_cost === null || row.landed_unit_cost === undefined ? moneyNumber(row.unit_cost) : moneyNumber(row.landed_unit_cost),
    createdAt: row.created_at
  };
}

export function fromDbJobPart(row = {}) {
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
