import { hasSupabaseConfig, supabase } from '../shared/lib/supabaseClient';
import { getCurrentShopId } from '../modules/shops/shopConfig';
import { getDefaultCurrency } from '../shared/utils/money';

const COMMERCE_NOT_CONFIGURED = 'Supabase is not configured for commerce events.';

export async function createTransactionEvent(payload = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return { data: null, error: new Error(COMMERCE_NOT_CONFIGURED) };
  }

  const { data, error } = await supabase.rpc('create_transaction_event', {
    transaction_payload: normalizeTransactionPayload(payload)
  });

  return { data, error };
}

export async function getTransactionHistory(filters = {}) {
  if (!hasSupabaseConfig || !supabase) {
    return { data: [], error: new Error(COMMERCE_NOT_CONFIGURED) };
  }

  let query = supabase
    .from('transaction_events')
    .select('*')
    .order('created_at', { ascending: false });

  query = query.eq('shop_id', filters.shopId || getCurrentShopId());

  if (filters.locationId) {
    query = query.eq('location_id', filters.locationId);
  }

  if (filters.sourceType) {
    query = query.eq('source_type', filters.sourceType);
  }

  if (filters.sourceId) {
    query = query.eq('source_id', filters.sourceId);
  }

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function reverseTransaction(transaction, options = {}) {
  const original = transaction || {};
  const metadata = {
    ...(options.metadata || {}),
    reversal: true,
    reversedTransactionNumber: original.transaction_number ?? original.transactionNumber ?? null,
    reason: options.reason || ''
  };

  return createTransactionEvent({
    shopId: options.shopId || original.shop_id || original.shopId,
    locationId: options.locationId || original.location_id || original.locationId,
    eventType: options.eventType || 'reversal',
    sourceType: options.sourceType || original.source_type || original.sourceType || 'transaction',
    sourceId: options.sourceId || original.source_id || original.sourceId || original.id,
    customerId: options.customerId || original.customer_id || original.customerId,
    employeeId: options.employeeId || original.employee_id || original.employeeId,
    currencyCode: options.currencyCode || original.currency_code || original.currencyCode || getDefaultCurrency(),
    subtotalMinor: -Number(original.subtotal_minor ?? original.subtotalMinor ?? 0),
    taxMinor: -Number(original.tax_minor ?? original.taxMinor ?? 0),
    totalMinor: -Number(original.total_minor ?? original.totalMinor ?? 0),
    reversedTransactionId: original.id,
    createdBy: options.createdBy,
    metadata
  });
}

function normalizeTransactionPayload(payload) {
  return {
    shop_id: payload.shop_id || payload.shopId || getCurrentShopId(),
    location_id: payload.location_id || payload.locationId || null,
    event_type: payload.event_type || payload.eventType || 'generic',
    source_type: payload.source_type || payload.sourceType || 'manual',
    source_id: payload.source_id || payload.sourceId || null,
    customer_id: payload.customer_id || payload.customerId || null,
    employee_id: payload.employee_id || payload.employeeId || null,
    currency_code: payload.currency_code || payload.currencyCode || getDefaultCurrency(),
    subtotal_minor: Number(payload.subtotal_minor ?? payload.subtotalMinor ?? 0),
    tax_minor: Number(payload.tax_minor ?? payload.taxMinor ?? 0),
    total_minor: Number(payload.total_minor ?? payload.totalMinor ?? 0),
    metadata: payload.metadata || {},
    reversed_transaction_id: payload.reversed_transaction_id || payload.reversedTransactionId || null,
    created_by: payload.created_by || payload.createdBy || null
  };
}
