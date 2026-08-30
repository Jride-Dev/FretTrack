import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { getCurrentShopId } from '../shops/shopConfig';
import {
  fromDbPart,
  fromDbPartMovement,
  fromDbReceiptItem,
  fromDbVendor,
  fromDbJobPart
} from './inventoryServiceNormalization.js';

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
    const baseTotalCost = item.quantityReceived * item.baseUnitCost;
    const totalLandedCost = baseTotalCost + item.shippingAllocated;
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
      baseTotalCost,
      totalCost: totalLandedCost,
      totalLandedCost
    };
  });
}
