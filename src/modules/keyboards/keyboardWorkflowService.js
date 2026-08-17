import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';
import { listParts } from '../inventory/inventoryService.js';

function fromDbKeyState(row = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    midiNote: row.midi_note,
    keyLabel: row.key_label,
    conditionStatus: row.condition_status,
    faultCode: row.fault_code || '',
    faultCategory: row.fault_category || '',
    severity: row.severity || 'moderate',
    velocityMin: row.velocity_min,
    velocityMax: row.velocity_max,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromDbPartRequest(row = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    keyStateId: row.key_state_id || '',
    inventoryPartId: row.inventory_part_id || '',
    jobPartId: row.job_part_id || '',
    requestedPart: row.requested_part || '',
    quantity: Number(row.quantity || 1),
    requestStatus: row.request_status || 'requested',
    notes: row.notes || '',
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
    cost: Number(row.cost ?? row.unit_cost ?? 0),
    retail: Number(row.retail ?? row.retail_price ?? 0),
    createdAt: row.created_at
  };
}

function requireConfigured() {
  if (!hasSupabaseConfig || !supabase) throw new Error('Keyboard diagnostics require the live Supabase-backed FretTrack app.');
}

export async function listKeyboardKeyStates(jobIds) {
  if (!hasSupabaseConfig || !supabase) return [];
  const ids = (Array.isArray(jobIds) ? jobIds : [jobIds]).filter(Boolean);
  if (!ids.length) return [];
  const chunks = [];
  for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
  const pages = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await supabase.from('keyboard_key_states').select('*').in('job_id', chunk).order('midi_note');
    if (error) throw error;
    return data || [];
  }));
  return pages.flat().map(fromDbKeyState);
}

export async function listKeyboardPartRequests(jobId) {
  if (!hasSupabaseConfig || !supabase || !jobId) return [];
  const { data, error } = await supabase.from('keyboard_part_requests').select('*').eq('job_id', jobId).order('created_at');
  if (error) throw error;
  return (data || []).map(fromDbPartRequest);
}

export async function loadKeyboardWorkflow(jobId, shopId) {
  const [keyStates, partRequests, inventoryParts] = await Promise.all([
    listKeyboardKeyStates(jobId),
    listKeyboardPartRequests(jobId),
    listParts(shopId, { activeOnly: true })
  ]);
  return { keyStates, partRequests, inventoryParts };
}

export async function saveKeyboardKeyState(jobId, state, expectedUpdatedAt = '') {
  requireConfigured();
  const payload = {
    job_id: jobId,
    midi_note: Number(state.midiNote),
    key_label: state.keyLabel,
    condition_status: state.conditionStatus,
    fault_code: state.conditionStatus === 'fault' ? state.faultCode : '',
    fault_category: state.conditionStatus === 'fault' ? state.faultCategory : '',
    severity: state.severity || 'moderate',
    velocity_min: state.velocityMin === '' || state.velocityMin == null ? null : Number(state.velocityMin),
    velocity_max: state.velocityMax === '' || state.velocityMax == null ? null : Number(state.velocityMax),
    notes: String(state.notes || '').trim()
  };
  if (!state.id) {
    const { data, error } = await supabase.from('keyboard_key_states').insert(payload).select().single();
    if (error?.code === '23505') throw new Error('This key was changed in another session. Reload the keyboard diagnostics before saving.');
    if (error) throw error;
    return fromDbKeyState(data);
  }
  if (!expectedUpdatedAt) throw new Error('This key finding has no save version. Reload it before saving.');
  const { data, error } = await supabase
    .from('keyboard_key_states')
    .update(payload)
    .eq('id', state.id)
    .eq('job_id', jobId)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This key was changed in another session. Reload the keyboard diagnostics before saving.');
  return fromDbKeyState(data);
}

export async function deleteKeyboardKeyState(state) {
  requireConfigured();
  const { data, error } = await supabase
    .from('keyboard_key_states')
    .delete()
    .eq('id', state.id)
    .eq('updated_at', state.updatedAt)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This key was changed in another session. Reload before removing it.');
}

export async function createKeyboardPartRequest(jobId, request) {
  requireConfigured();
  const { data, error } = await supabase.from('keyboard_part_requests').insert({
    job_id: jobId,
    key_state_id: request.keyStateId || null,
    inventory_part_id: request.inventoryPartId || null,
    requested_part: String(request.requestedPart || '').trim(),
    quantity: Math.max(Number(request.quantity || 1), 1),
    request_status: request.requestStatus || 'requested',
    notes: String(request.notes || '').trim()
  }).select().single();
  if (error) throw error;
  return fromDbPartRequest(data);
}

export async function updateKeyboardPartRequest(request, patch) {
  requireConfigured();
  const { data, error } = await supabase.from('keyboard_part_requests').update({
    request_status: patch.requestStatus ?? request.requestStatus,
    notes: patch.notes ?? request.notes
  }).eq('id', request.id).eq('updated_at', request.updatedAt).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This parts request was changed in another session. Reload before saving.');
  return fromDbPartRequest(data);
}

export async function fulfillKeyboardPartRequest(request) {
  requireConfigured();
  const { data, error } = await supabase.rpc('fulfill_keyboard_part_request', { p_request_id: request.id });
  if (error) throw error;
  return {
    jobPart: fromDbJobPart(Array.isArray(data) ? data[0] : data),
    partRequests: await listKeyboardPartRequests(request.jobId)
  };
}
