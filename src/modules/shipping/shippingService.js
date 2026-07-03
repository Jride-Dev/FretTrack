import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';

export const SHIPMENT_DIRECTIONS = [
  'vendor_inbound',
  'customer_inbound',
  'customer_outbound',
  'vendor_return',
  'inventory_outbound',
  'internal_transfer'
];

export const SHIPMENT_FULFILLMENT_METHODS = ['pickup', 'ship'];

export const SHIPMENT_STATUSES = [
  'pending_arrival',
  'arrived',
  'checked_in',
  'triage',
  'at_bench',
  'ready_to_pack',
  'packed',
  'ready_to_ship',
  'in_transit',
  'delivered',
  'delayed',
  'exception',
  'returned',
  'cancelled'
];

export const SHIPPING_ITEM_TYPES = ['instrument', 'part', 'accessory', 'package', 'other'];

export const SHIPPING_ITEM_DISPOSITIONS = [
  'stock',
  'specific_job',
  'tech_bench',
  'hold_quarantine',
  'return_to_vendor',
  'customer_return',
  'outbound_package',
  'internal_transfer'
];

const STATUS_COMPATIBILITY = {
  not_ready: 'pending_arrival',
  label_needed: 'ready_to_pack',
  shipped: 'in_transit',
  problem: 'exception',
  void: 'cancelled'
};

const DIRECTION_COMPATIBILITY = {
  inbound: 'customer_inbound',
  outbound: 'customer_outbound',
  customer_return: 'customer_outbound'
};

function requireShippingConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Shipping requires Supabase configuration.');
  }
}

function cleanText(value) {
  return String(value || '').trim();
}

function nullableText(value) {
  return cleanText(value) || null;
}

function nullableMoney(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function integerNumber(value, fallback = 1) {
  const numberValue = Number.parseInt(value, 10);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeOption(value, allowedValues, fallback, compatibility = {}) {
  const normalized = cleanText(value).toLowerCase();
  const compatible = compatibility[normalized] || normalized;
  return allowedValues.includes(compatible) ? compatible : fallback;
}

function toDbShipment(shopId, payload = {}) {
  return {
    shop_id: shopId,
    job_id: payload.jobId || payload.job_id || null,
    customer_id: payload.customerId || payload.customer_id || null,
    vendor_id: payload.vendorId || payload.vendor_id || null,
    purchase_order_id: payload.purchaseOrderId || payload.purchase_order_id || null,
    shipping_reference: nullableText(payload.shippingReference || payload.shipping_reference),
    direction: normalizeOption(payload.direction, SHIPMENT_DIRECTIONS, 'customer_outbound', DIRECTION_COMPATIBILITY),
    fulfillment_method: normalizeOption(payload.fulfillmentMethod || payload.fulfillment_method, SHIPMENT_FULFILLMENT_METHODS, 'ship'),
    status: normalizeOption(payload.status, SHIPMENT_STATUSES, 'pending_arrival', STATUS_COMPATIBILITY),
    carrier: nullableText(payload.carrier),
    service_level: nullableText(payload.serviceLevel || payload.service_level),
    tracking_number: nullableText(payload.trackingNumber || payload.tracking_number),
    tracking_url: nullableText(payload.trackingUrl || payload.tracking_url),
    label_reference: nullableText(payload.labelReference || payload.label_reference),
    label_url: nullableText(payload.labelUrl || payload.label_url),
    declared_value: nullableMoney(payload.declaredValue ?? payload.declared_value),
    insurance_required: Boolean(payload.insuranceRequired ?? payload.insurance_required),
    signature_required: Boolean(payload.signatureRequired ?? payload.signature_required),
    ship_to_name: nullableText(payload.shipToName || payload.ship_to_name),
    ship_to_address_line1: nullableText(payload.shipToAddressLine1 || payload.ship_to_address_line1),
    ship_to_address_line2: nullableText(payload.shipToAddressLine2 || payload.ship_to_address_line2),
    ship_to_city: nullableText(payload.shipToCity || payload.ship_to_city),
    ship_to_state: nullableText(payload.shipToState || payload.ship_to_state),
    ship_to_postal_code: nullableText(payload.shipToPostalCode || payload.ship_to_postal_code),
    ship_to_country: nullableText(payload.shipToCountry || payload.ship_to_country) || 'US',
    shipping_cost: nullableMoney(payload.shippingCost ?? payload.shipping_cost),
    shipping_charge: nullableMoney(payload.shippingCharge ?? payload.shipping_charge),
    packing_notes: nullableText(payload.packingNotes || payload.packing_notes),
    condition_notes: nullableText(payload.conditionNotes || payload.condition_notes),
    received_condition: nullableText(payload.receivedCondition || payload.received_condition),
    assigned_location: nullableText(payload.assignedLocation || payload.assigned_location),
    assigned_category: nullableText(payload.assignedCategory || payload.assigned_category),
    assigned_to_user_id: payload.assignedToUserId || payload.assigned_to_user_id || null,
    customer_notified: Boolean(payload.customerNotified ?? payload.customer_notified),
    notes: nullableText(payload.notes),
    shipped_at: payload.shippedAt || payload.shipped_at || null,
    delivered_at: payload.deliveredAt || payload.delivered_at || null
  };
}

function toDbShipmentPatch(payload = {}) {
  const patch = {};

  if ('jobId' in payload || 'job_id' in payload) patch.job_id = payload.jobId || payload.job_id || null;
  if ('customerId' in payload || 'customer_id' in payload) patch.customer_id = payload.customerId || payload.customer_id || null;
  if ('vendorId' in payload || 'vendor_id' in payload) patch.vendor_id = payload.vendorId || payload.vendor_id || null;
  if ('purchaseOrderId' in payload || 'purchase_order_id' in payload) patch.purchase_order_id = payload.purchaseOrderId || payload.purchase_order_id || null;
  if ('shippingReference' in payload || 'shipping_reference' in payload) patch.shipping_reference = nullableText(payload.shippingReference || payload.shipping_reference);
  if ('direction' in payload) patch.direction = normalizeOption(payload.direction, SHIPMENT_DIRECTIONS, 'customer_outbound', DIRECTION_COMPATIBILITY);
  if ('fulfillmentMethod' in payload || 'fulfillment_method' in payload) patch.fulfillment_method = normalizeOption(payload.fulfillmentMethod || payload.fulfillment_method, SHIPMENT_FULFILLMENT_METHODS, 'ship');
  if ('status' in payload) patch.status = normalizeOption(payload.status, SHIPMENT_STATUSES, 'pending_arrival', STATUS_COMPATIBILITY);
  if ('carrier' in payload) patch.carrier = nullableText(payload.carrier);
  if ('serviceLevel' in payload || 'service_level' in payload) patch.service_level = nullableText(payload.serviceLevel || payload.service_level);
  if ('trackingNumber' in payload || 'tracking_number' in payload) patch.tracking_number = nullableText(payload.trackingNumber || payload.tracking_number);
  if ('trackingUrl' in payload || 'tracking_url' in payload) patch.tracking_url = nullableText(payload.trackingUrl || payload.tracking_url);
  if ('labelReference' in payload || 'label_reference' in payload) patch.label_reference = nullableText(payload.labelReference || payload.label_reference);
  if ('labelUrl' in payload || 'label_url' in payload) patch.label_url = nullableText(payload.labelUrl || payload.label_url);
  if ('declaredValue' in payload || 'declared_value' in payload) patch.declared_value = nullableMoney(payload.declaredValue ?? payload.declared_value);
  if ('insuranceRequired' in payload || 'insurance_required' in payload) patch.insurance_required = Boolean(payload.insuranceRequired ?? payload.insurance_required);
  if ('signatureRequired' in payload || 'signature_required' in payload) patch.signature_required = Boolean(payload.signatureRequired ?? payload.signature_required);
  if ('shipToName' in payload || 'ship_to_name' in payload) patch.ship_to_name = nullableText(payload.shipToName || payload.ship_to_name);
  if ('shipToAddressLine1' in payload || 'ship_to_address_line1' in payload) patch.ship_to_address_line1 = nullableText(payload.shipToAddressLine1 || payload.ship_to_address_line1);
  if ('shipToAddressLine2' in payload || 'ship_to_address_line2' in payload) patch.ship_to_address_line2 = nullableText(payload.shipToAddressLine2 || payload.ship_to_address_line2);
  if ('shipToCity' in payload || 'ship_to_city' in payload) patch.ship_to_city = nullableText(payload.shipToCity || payload.ship_to_city);
  if ('shipToState' in payload || 'ship_to_state' in payload) patch.ship_to_state = nullableText(payload.shipToState || payload.ship_to_state);
  if ('shipToPostalCode' in payload || 'ship_to_postal_code' in payload) patch.ship_to_postal_code = nullableText(payload.shipToPostalCode || payload.ship_to_postal_code);
  if ('shipToCountry' in payload || 'ship_to_country' in payload) patch.ship_to_country = nullableText(payload.shipToCountry || payload.ship_to_country) || 'US';
  if ('shippingCost' in payload || 'shipping_cost' in payload) patch.shipping_cost = nullableMoney(payload.shippingCost ?? payload.shipping_cost);
  if ('shippingCharge' in payload || 'shipping_charge' in payload) patch.shipping_charge = nullableMoney(payload.shippingCharge ?? payload.shipping_charge);
  if ('packingNotes' in payload || 'packing_notes' in payload) patch.packing_notes = nullableText(payload.packingNotes || payload.packing_notes);
  if ('conditionNotes' in payload || 'condition_notes' in payload) patch.condition_notes = nullableText(payload.conditionNotes || payload.condition_notes);
  if ('receivedCondition' in payload || 'received_condition' in payload) patch.received_condition = nullableText(payload.receivedCondition || payload.received_condition);
  if ('assignedLocation' in payload || 'assigned_location' in payload) patch.assigned_location = nullableText(payload.assignedLocation || payload.assigned_location);
  if ('assignedCategory' in payload || 'assigned_category' in payload) patch.assigned_category = nullableText(payload.assignedCategory || payload.assigned_category);
  if ('assignedToUserId' in payload || 'assigned_to_user_id' in payload) patch.assigned_to_user_id = payload.assignedToUserId || payload.assigned_to_user_id || null;
  if ('customerNotified' in payload || 'customer_notified' in payload) patch.customer_notified = Boolean(payload.customerNotified ?? payload.customer_notified);
  if ('notes' in payload) patch.notes = nullableText(payload.notes);
  if ('shippedAt' in payload || 'shipped_at' in payload) patch.shipped_at = payload.shippedAt || payload.shipped_at || null;
  if ('deliveredAt' in payload || 'delivered_at' in payload) patch.delivered_at = payload.deliveredAt || payload.delivered_at || null;

  return patch;
}

function toDbShippingItem(shopId, shipmentId, payload = {}) {
  return {
    shop_id: shopId,
    shipment_id: shipmentId,
    job_id: payload.jobId || payload.job_id || null,
    customer_id: payload.customerId || payload.customer_id || null,
    vendor_id: payload.vendorId || payload.vendor_id || null,
    purchase_order_id: payload.purchaseOrderId || payload.purchase_order_id || null,
    purchase_order_item_id: payload.purchaseOrderItemId || payload.purchase_order_item_id || null,
    part_id: payload.partId || payload.part_id || null,
    item_type: normalizeOption(payload.itemType || payload.item_type, SHIPPING_ITEM_TYPES, 'instrument'),
    description: cleanText(payload.description),
    quantity: Math.max(integerNumber(payload.quantity, 1), 1),
    disposition: normalizeOption(payload.disposition, SHIPPING_ITEM_DISPOSITIONS, 'hold_quarantine'),
    assigned_location: nullableText(payload.assignedLocation || payload.assigned_location),
    assigned_category: nullableText(payload.assignedCategory || payload.assigned_category),
    assigned_to_user_id: payload.assignedToUserId || payload.assigned_to_user_id || null,
    received_condition: nullableText(payload.receivedCondition || payload.received_condition),
    condition_notes: nullableText(payload.conditionNotes || payload.condition_notes)
  };
}

function fromDbShipment(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id,
    jobId: row.job_id || '',
    customerId: row.customer_id || '',
    vendorId: row.vendor_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    shippingReference: row.shipping_reference || '',
    direction: DIRECTION_COMPATIBILITY[row.direction] || row.direction || 'customer_outbound',
    fulfillmentMethod: row.fulfillment_method || 'ship',
    status: STATUS_COMPATIBILITY[row.status] || row.status || 'pending_arrival',
    carrier: row.carrier || '',
    serviceLevel: row.service_level || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    labelReference: row.label_reference || '',
    labelUrl: row.label_url || '',
    declaredValue: row.declared_value === null || row.declared_value === undefined ? null : Number(row.declared_value),
    insuranceRequired: row.insurance_required === true,
    signatureRequired: row.signature_required === true,
    shipToName: row.ship_to_name || '',
    shipToAddressLine1: row.ship_to_address_line1 || '',
    shipToAddressLine2: row.ship_to_address_line2 || '',
    shipToCity: row.ship_to_city || '',
    shipToState: row.ship_to_state || '',
    shipToPostalCode: row.ship_to_postal_code || '',
    shipToCountry: row.ship_to_country || 'US',
    shippingCost: row.shipping_cost === null || row.shipping_cost === undefined ? null : Number(row.shipping_cost),
    shippingCharge: row.shipping_charge === null || row.shipping_charge === undefined ? null : Number(row.shipping_charge),
    packingNotes: row.packing_notes || '',
    conditionNotes: row.condition_notes || '',
    receivedCondition: row.received_condition || '',
    assignedLocation: row.assigned_location || '',
    assignedCategory: row.assigned_category || '',
    assignedToUserId: row.assigned_to_user_id || '',
    customerNotified: row.customer_notified === true,
    notes: row.notes || '',
    shippedAt: row.shipped_at || '',
    deliveredAt: row.delivered_at || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    items: [],
    custodyEvents: []
  };
}

function fromDbShippingItem(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    shipmentId: row.shipment_id || '',
    jobId: row.job_id || '',
    customerId: row.customer_id || '',
    vendorId: row.vendor_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    purchaseOrderItemId: row.purchase_order_item_id || '',
    partId: row.part_id || '',
    itemType: row.item_type || 'instrument',
    description: row.description || '',
    quantity: integerNumber(row.quantity, 1),
    disposition: row.disposition || 'hold_quarantine',
    assignedLocation: row.assigned_location || '',
    assignedCategory: row.assigned_category || '',
    assignedToUserId: row.assigned_to_user_id || '',
    receivedCondition: row.received_condition || '',
    conditionNotes: row.condition_notes || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function fromDbCustodyEvent(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id || '',
    shipmentId: row.shipment_id || '',
    shippingItemId: row.shipping_item_id || '',
    jobId: row.job_id || '',
    customerId: row.customer_id || '',
    vendorId: row.vendor_id || '',
    purchaseOrderId: row.purchase_order_id || '',
    eventType: row.event_type || '',
    eventLabel: row.event_label || '',
    eventStatus: row.event_status || '',
    eventNote: row.event_note || '',
    fromLocation: row.from_location || '',
    toLocation: row.to_location || '',
    fromCategory: row.from_category || '',
    toCategory: row.to_category || '',
    assignedToUserId: row.assigned_to_user_id || '',
    occurredAt: row.occurred_at || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    eventData: row.event_data || {}
  };
}

export async function listShippingRecords(shopId = getCurrentShopId(), filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('job_shipments')
    .select('*')
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(filters.limit || 200);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.direction) {
    query = query.eq('direction', filters.direction);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const shipments = (data || []).map(fromDbShipment);
  const shipmentIds = shipments.map((shipment) => shipment.id);
  if (!shipmentIds.length) {
    return shipments;
  }

  const [itemsResult, eventsResult] = await Promise.all([
    supabase
      .from('shipping_items')
      .select('*')
      .in('shipment_id', shipmentIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('custody_events')
      .select('*')
      .in('shipment_id', shipmentIds)
      .order('created_at', { ascending: false })
      .limit(500)
  ]);

  if (itemsResult.error) {
    throw itemsResult.error;
  }
  if (eventsResult.error) {
    throw eventsResult.error;
  }

  const itemsByShipment = new Map();
  for (const item of (itemsResult.data || []).map(fromDbShippingItem)) {
    const rows = itemsByShipment.get(item.shipmentId) || [];
    rows.push(item);
    itemsByShipment.set(item.shipmentId, rows);
  }

  const eventsByShipment = new Map();
  for (const event of (eventsResult.data || []).map(fromDbCustodyEvent)) {
    const rows = eventsByShipment.get(event.shipmentId) || [];
    rows.push(event);
    eventsByShipment.set(event.shipmentId, rows);
  }

  return shipments.map((shipment) => ({
    ...shipment,
    items: itemsByShipment.get(shipment.id) || [],
    custodyEvents: eventsByShipment.get(shipment.id) || []
  }));
}

export async function listShippingDashboardRecords(shopId = getCurrentShopId()) {
  return listShippingRecords(shopId, { limit: 250 });
}

export async function listJobShipments(jobId, shopId = getCurrentShopId()) {
  if (!hasSupabaseConfig || !supabase || !jobId) {
    return [];
  }

  const { data, error } = await supabase
    .from('job_shipments')
    .select('*')
    .eq('shop_id', shopId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(fromDbShipment);
}

export async function createShippingRecord(payload = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();

  const shipmentPayload = toDbShipment(shopId, payload);
  const { data, error } = await supabase
    .from('job_shipments')
    .insert(shipmentPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const shipment = fromDbShipment(data);
  const itemPayloads = Array.isArray(payload.items) ? payload.items : [];
  if (itemPayloads.length) {
    const savedItems = [];
    for (const itemPayload of itemPayloads) {
      savedItems.push(await createShippingItem(shipment.id, itemPayload, shopId));
    }
    shipment.items = savedItems;
  }

  return shipment;
}

export async function createJobShipment(payload = {}, shopId = getCurrentShopId()) {
  if (!payload.jobId && !payload.job_id) {
    throw new Error('A job is required before creating a job shipment.');
  }

  return createShippingRecord({
    ...payload,
    direction: payload.direction || 'customer_outbound'
  }, shopId);
}

export async function updateShippingRecord(shipmentId, patch = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();
  if (!shipmentId) {
    throw new Error('A shipping record id is required before updating shipping.');
  }

  const { data, error } = await supabase
    .from('job_shipments')
    .update(toDbShipmentPatch(patch))
    .eq('shop_id', shopId)
    .eq('id', shipmentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromDbShipment(data);
}

export async function updateJobShipment(shipmentId, patch = {}, shopId = getCurrentShopId()) {
  return updateShippingRecord(shipmentId, patch, shopId);
}

export async function voidJobShipment(shipmentId, shopId = getCurrentShopId()) {
  return updateShippingRecord(shipmentId, { status: 'cancelled' }, shopId);
}

export async function createShippingItem(shipmentId, payload = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();
  if (!shipmentId) {
    throw new Error('A shipping record is required before adding an item.');
  }

  const itemPayload = toDbShippingItem(shopId, shipmentId, payload);
  if (!itemPayload.description) {
    throw new Error('Shipping item description is required.');
  }

  const { data, error } = await supabase
    .from('shipping_items')
    .insert(itemPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromDbShippingItem(data);
}

export async function updateShippingItem(itemId, patch = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();
  if (!itemId) {
    throw new Error('A shipping item id is required before updating the item.');
  }

  const payload = {};
  if ('jobId' in patch || 'job_id' in patch) payload.job_id = patch.jobId || patch.job_id || null;
  if ('customerId' in patch || 'customer_id' in patch) payload.customer_id = patch.customerId || patch.customer_id || null;
  if ('vendorId' in patch || 'vendor_id' in patch) payload.vendor_id = patch.vendorId || patch.vendor_id || null;
  if ('purchaseOrderId' in patch || 'purchase_order_id' in patch) payload.purchase_order_id = patch.purchaseOrderId || patch.purchase_order_id || null;
  if ('purchaseOrderItemId' in patch || 'purchase_order_item_id' in patch) payload.purchase_order_item_id = patch.purchaseOrderItemId || patch.purchase_order_item_id || null;
  if ('partId' in patch || 'part_id' in patch) payload.part_id = patch.partId || patch.part_id || null;
  if ('itemType' in patch || 'item_type' in patch) payload.item_type = normalizeOption(patch.itemType || patch.item_type, SHIPPING_ITEM_TYPES, 'instrument');
  if ('description' in patch) payload.description = cleanText(patch.description);
  if ('quantity' in patch) payload.quantity = Math.max(integerNumber(patch.quantity, 1), 1);
  if ('disposition' in patch) payload.disposition = normalizeOption(patch.disposition, SHIPPING_ITEM_DISPOSITIONS, 'hold_quarantine');
  if ('assignedLocation' in patch || 'assigned_location' in patch) payload.assigned_location = nullableText(patch.assignedLocation || patch.assigned_location);
  if ('assignedCategory' in patch || 'assigned_category' in patch) payload.assigned_category = nullableText(patch.assignedCategory || patch.assigned_category);
  if ('assignedToUserId' in patch || 'assigned_to_user_id' in patch) payload.assigned_to_user_id = patch.assignedToUserId || patch.assigned_to_user_id || null;
  if ('receivedCondition' in patch || 'received_condition' in patch) payload.received_condition = nullableText(patch.receivedCondition || patch.received_condition);
  if ('conditionNotes' in patch || 'condition_notes' in patch) payload.condition_notes = nullableText(patch.conditionNotes || patch.condition_notes);

  const { data, error } = await supabase
    .from('shipping_items')
    .update(payload)
    .eq('shop_id', shopId)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromDbShippingItem(data);
}

export async function listCustodyEvents({ shopId = getCurrentShopId(), shipmentId = '', limit = 100 } = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return [];
  }

  let query = supabase
    .from('custody_events')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (shipmentId) {
    query = query.eq('shipment_id', shipmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(fromDbCustodyEvent);
}

export async function addCustodyNote(shipmentId, note, shopId = getCurrentShopId()) {
  requireShippingConfigured();
  const cleanNote = cleanText(note);
  if (!shipmentId || !cleanNote) {
    throw new Error('Choose a shipping record and enter a custody note.');
  }

  const { data: shipment, error: shipmentError } = await supabase
    .from('job_shipments')
    .select('*')
    .eq('shop_id', shopId)
    .eq('id', shipmentId)
    .single();

  if (shipmentError) {
    throw shipmentError;
  }

  const { data, error } = await supabase
    .from('custody_events')
    .insert({
      shop_id: shopId,
      shipment_id: shipmentId,
      job_id: shipment.job_id,
      customer_id: shipment.customer_id,
      vendor_id: shipment.vendor_id,
      purchase_order_id: shipment.purchase_order_id,
      event_type: 'note',
      event_label: 'Custody note',
      event_status: shipment.status,
      event_note: cleanNote
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromDbCustodyEvent(data);
}
