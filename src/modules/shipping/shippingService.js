import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';

export const SHIPMENT_DIRECTIONS = ['inbound', 'outbound', 'customer_return'];
export const SHIPMENT_FULFILLMENT_METHODS = ['pickup', 'ship'];
export const SHIPMENT_STATUSES = [
  'not_ready',
  'ready_to_ship',
  'label_needed',
  'shipped',
  'delivered',
  'returned',
  'problem',
  'void'
];

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

function normalizeOption(value, allowedValues, fallback) {
  const normalized = cleanText(value).toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function toDbShipment(shopId, payload = {}) {
  return {
    shop_id: shopId,
    job_id: payload.jobId || payload.job_id,
    customer_id: payload.customerId || payload.customer_id || null,
    direction: normalizeOption(payload.direction, SHIPMENT_DIRECTIONS, 'outbound'),
    fulfillment_method: normalizeOption(payload.fulfillmentMethod || payload.fulfillment_method, SHIPMENT_FULFILLMENT_METHODS, 'pickup'),
    status: normalizeOption(payload.status, SHIPMENT_STATUSES, 'not_ready'),
    carrier: nullableText(payload.carrier),
    service_level: nullableText(payload.serviceLevel || payload.service_level),
    tracking_number: nullableText(payload.trackingNumber || payload.tracking_number),
    tracking_url: nullableText(payload.trackingUrl || payload.tracking_url),
    ship_to_name: nullableText(payload.shipToName || payload.ship_to_name),
    ship_to_address_line1: nullableText(payload.shipToAddressLine1 || payload.ship_to_address_line1),
    ship_to_address_line2: nullableText(payload.shipToAddressLine2 || payload.ship_to_address_line2),
    ship_to_city: nullableText(payload.shipToCity || payload.ship_to_city),
    ship_to_state: nullableText(payload.shipToState || payload.ship_to_state),
    ship_to_postal_code: nullableText(payload.shipToPostalCode || payload.ship_to_postal_code),
    ship_to_country: nullableText(payload.shipToCountry || payload.ship_to_country) || 'US',
    shipping_cost: nullableMoney(payload.shippingCost ?? payload.shipping_cost),
    shipping_charge: nullableMoney(payload.shippingCharge ?? payload.shipping_charge),
    notes: nullableText(payload.notes),
    shipped_at: payload.shippedAt || payload.shipped_at || null,
    delivered_at: payload.deliveredAt || payload.delivered_at || null
  };
}

function toDbShipmentPatch(payload = {}) {
  const patch = {};

  if ('customerId' in payload || 'customer_id' in payload) patch.customer_id = payload.customerId || payload.customer_id || null;
  if ('direction' in payload) patch.direction = normalizeOption(payload.direction, SHIPMENT_DIRECTIONS, 'outbound');
  if ('fulfillmentMethod' in payload || 'fulfillment_method' in payload) patch.fulfillment_method = normalizeOption(payload.fulfillmentMethod || payload.fulfillment_method, SHIPMENT_FULFILLMENT_METHODS, 'pickup');
  if ('status' in payload) patch.status = normalizeOption(payload.status, SHIPMENT_STATUSES, 'not_ready');
  if ('carrier' in payload) patch.carrier = nullableText(payload.carrier);
  if ('serviceLevel' in payload || 'service_level' in payload) patch.service_level = nullableText(payload.serviceLevel || payload.service_level);
  if ('trackingNumber' in payload || 'tracking_number' in payload) patch.tracking_number = nullableText(payload.trackingNumber || payload.tracking_number);
  if ('trackingUrl' in payload || 'tracking_url' in payload) patch.tracking_url = nullableText(payload.trackingUrl || payload.tracking_url);
  if ('shipToName' in payload || 'ship_to_name' in payload) patch.ship_to_name = nullableText(payload.shipToName || payload.ship_to_name);
  if ('shipToAddressLine1' in payload || 'ship_to_address_line1' in payload) patch.ship_to_address_line1 = nullableText(payload.shipToAddressLine1 || payload.ship_to_address_line1);
  if ('shipToAddressLine2' in payload || 'ship_to_address_line2' in payload) patch.ship_to_address_line2 = nullableText(payload.shipToAddressLine2 || payload.ship_to_address_line2);
  if ('shipToCity' in payload || 'ship_to_city' in payload) patch.ship_to_city = nullableText(payload.shipToCity || payload.ship_to_city);
  if ('shipToState' in payload || 'ship_to_state' in payload) patch.ship_to_state = nullableText(payload.shipToState || payload.ship_to_state);
  if ('shipToPostalCode' in payload || 'ship_to_postal_code' in payload) patch.ship_to_postal_code = nullableText(payload.shipToPostalCode || payload.ship_to_postal_code);
  if ('shipToCountry' in payload || 'ship_to_country' in payload) patch.ship_to_country = nullableText(payload.shipToCountry || payload.ship_to_country) || 'US';
  if ('shippingCost' in payload || 'shipping_cost' in payload) patch.shipping_cost = nullableMoney(payload.shippingCost ?? payload.shipping_cost);
  if ('shippingCharge' in payload || 'shipping_charge' in payload) patch.shipping_charge = nullableMoney(payload.shippingCharge ?? payload.shipping_charge);
  if ('notes' in payload) patch.notes = nullableText(payload.notes);
  if ('shippedAt' in payload || 'shipped_at' in payload) patch.shipped_at = payload.shippedAt || payload.shipped_at || null;
  if ('deliveredAt' in payload || 'delivered_at' in payload) patch.delivered_at = payload.deliveredAt || payload.delivered_at || null;

  return patch;
}

function fromDbShipment(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id,
    jobId: row.job_id,
    customerId: row.customer_id || '',
    direction: row.direction || 'outbound',
    fulfillmentMethod: row.fulfillment_method || 'pickup',
    status: row.status || 'not_ready',
    carrier: row.carrier || '',
    serviceLevel: row.service_level || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    shipToName: row.ship_to_name || '',
    shipToAddressLine1: row.ship_to_address_line1 || '',
    shipToAddressLine2: row.ship_to_address_line2 || '',
    shipToCity: row.ship_to_city || '',
    shipToState: row.ship_to_state || '',
    shipToPostalCode: row.ship_to_postal_code || '',
    shipToCountry: row.ship_to_country || 'US',
    shippingCost: row.shipping_cost === null || row.shipping_cost === undefined ? null : Number(row.shipping_cost),
    shippingCharge: row.shipping_charge === null || row.shipping_charge === undefined ? null : Number(row.shipping_charge),
    notes: row.notes || '',
    shippedAt: row.shipped_at || '',
    deliveredAt: row.delivered_at || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
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

export async function createJobShipment(payload = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();

  const shipmentPayload = toDbShipment(shopId, payload);
  if (!shipmentPayload.job_id) {
    throw new Error('A job is required before creating a shipment.');
  }

  const { data, error } = await supabase
    .from('job_shipments')
    .insert(shipmentPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromDbShipment(data);
}

export async function updateJobShipment(shipmentId, patch = {}, shopId = getCurrentShopId()) {
  requireShippingConfigured();
  if (!shipmentId) {
    throw new Error('A shipment id is required before updating a shipment.');
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

export async function voidJobShipment(shipmentId, shopId = getCurrentShopId()) {
  return updateJobShipment(shipmentId, { status: 'void' }, shopId);
}
