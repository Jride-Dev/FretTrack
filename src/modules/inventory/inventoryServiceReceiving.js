import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';
import { logJobEventSafe } from '../jobs/jobEventsService';
import { getCurrentShopId } from '../shops/shopConfig';
import {
  cleanText,
  moneyNumber,
  integerNumber,
  fromDbPart,
  fromDbJobPart
} from './inventoryServiceNormalization.js';
import {
  getPart as getPartFromModule,
  updatePart as updatePartFromModule
} from './inventoryServiceCatalog.js';

function requireInventoryConfigured() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Inventory requires the live Supabase-backed FretTrack app.');
  }
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
  return updatePartFromModule(part.id, { ...part, barcodeCode: '' });
}

export async function adjustPart(partId, quantityDelta, note = '') {
  const part = await getPartFromModule(partId);
  if (!part) {
    throw new Error('Part not found.');
  }
  const delta = integerNumber(quantityDelta, 0);
  const updatedPart = await updatePartFromModule(partId, {
    quantityOnHand: part.quantityOnHand + delta
  });
  await createPartMovement(updatedPart, 'adjust', delta, { note });
  return updatedPart;
}

export async function addPartToJob(jobId, partId, quantity = 1) {
  requireInventoryConfigured();
  const part = await getPartFromModule(partId);
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
    const part = await getPartFromModule(jobPart.partId);
    if (part) {
      const restoredQuantity = Math.max(Number(jobPart.quantity || 0), 0);
      await updatePartFromModule(part.id, {
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
