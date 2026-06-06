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

function toDbPart(shopId, payload = {}) {
  return {
    shop_id: shopId,
    sku: cleanText(payload.sku) || null,
    name: cleanText(payload.name),
    description: cleanText(payload.description) || null,
    category: cleanText(payload.category) || null,
    supplier: cleanText(payload.supplier) || null,
    manufacturer: cleanText(payload.manufacturer) || null,
    part_number: cleanText(payload.partNumber || payload.part_number) || null,
    unit_cost: moneyNumber(payload.unitCost ?? payload.unit_cost),
    retail_price: moneyNumber(payload.retailPrice ?? payload.retail_price),
    quantity_on_hand: integerNumber(payload.quantityOnHand ?? payload.quantity_on_hand),
    reorder_point: integerNumber(payload.reorderPoint ?? payload.reorder_point),
    location: cleanText(payload.location) || null,
    is_active: payload.isActive ?? payload.is_active ?? true
  };
}

function fromDbPart(row = {}) {
  return {
    id: row.id,
    shopId: row.shop_id,
    sku: row.sku || '',
    name: row.name || '',
    description: row.description || '',
    category: row.category || '',
    supplier: row.supplier || '',
    manufacturer: row.manufacturer || '',
    partNumber: row.part_number || '',
    unitCost: moneyNumber(row.unit_cost),
    retailPrice: moneyNumber(row.retail_price),
    quantityOnHand: integerNumber(row.quantity_on_hand),
    reorderPoint: integerNumber(row.reorder_point),
    location: row.location || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,category.ilike.%${escaped}%,supplier.ilike.%${escaped}%`);
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
  const part = await getPart(partId);
  if (!part) {
    throw new Error('Part not found.');
  }
  const receivedQuantity = Math.max(integerNumber(quantity, 0), 1);
  const nextQuantity = part.quantityOnHand + receivedQuantity;
  const unitCost = moneyNumber(cost ?? part.unitCost);

  const updatedPart = await updatePart(partId, {
    quantityOnHand: nextQuantity,
    unitCost
  });
  await createPartMovement(updatedPart, 'receive', receivedQuantity, { unitCost, note });
  return updatedPart;
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
