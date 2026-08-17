import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';
import { listParts } from '../inventory/inventoryService.js';

function fromDbKeyState(row = {}) {
  return {
    id: row.id,
    jobId: row.job_id,
    keyIndex: row.key_index,
    midiNote: row.midi_note,
    keyLabel: row.note_name,
    noteName: row.note_name,
    conditionStatus: row.health_state === 'good' ? 'pass' : row.health_state === 'not_tested' ? 'not_tested' : 'fault',
    healthState: row.health_state,
    damageStatus: row.status,
    faultCode: row.fault_code || '',
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
    keyDamageId: row.key_damage_id || '',
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

function fromDbFaultCode(row = {}) {
  return {
    code: row.code,
    label: row.label,
    category: row.category,
    damageStatus: row.damage_status,
    overlayTone: row.overlay_tone,
    partKeywords: row.part_keywords || [],
    defaultGroupSize: row.default_group_size,
    isActive: row.is_active
  };
}

function fromDbCompatibility(row = {}) {
  return {
    id: row.id,
    partId: row.part_id,
    faultCode: row.fault_code,
    partScope: row.part_scope,
    groupSize: Number(row.group_size || 1),
    keyColor: row.key_color || '',
    noteName: row.note_name || '',
    manufacturer: row.manufacturer || '',
    modelPattern: row.model_pattern || '',
    startKeyIndex: row.start_key_index,
    endKeyIndex: row.end_key_index
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
    const { data, error } = await supabase.from('key_damage_map').select('*').in('job_id', chunk).order('key_index');
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
  const [keyStates, partRequests, inventoryParts, profileResult, faultResult, compatibilityResult] = await Promise.all([
    listKeyboardKeyStates(jobId),
    listKeyboardPartRequests(jobId),
    listParts(shopId, { activeOnly: true }),
    supabase.from('keyboard_profiles').select('*').eq('job_id', jobId).maybeSingle(),
    supabase.from('fault_codes').select('*').eq('is_active', true).order('label'),
    supabase.from('keyboard_part_compatibility').select('*')
  ]);
  if (profileResult.error) throw profileResult.error;
  if (faultResult.error) throw faultResult.error;
  if (compatibilityResult.error) throw compatibilityResult.error;
  return {
    keyStates,
    partRequests,
    inventoryParts,
    profile: profileResult.data ? {
      jobId: profileResult.data.job_id,
      keyCount: Number(profileResult.data.key_count),
      actionType: profileResult.data.action_type,
      sensorType: profileResult.data.sensor_type,
      lowestMidiNote: Number(profileResult.data.lowest_midi_note)
    } : null,
    faultCodes: (faultResult.data || []).map(fromDbFaultCode),
    compatibilities: (compatibilityResult.data || []).map(fromDbCompatibility)
  };
}

export async function saveKeyboardKeyState(jobId, state, expectedUpdatedAt = '') {
  requireConfigured();
  const payload = {
    job_id: jobId,
    key_index: Number(state.keyIndex),
    midi_note: Number(state.midiNote),
    note_name: state.noteName || state.keyLabel,
    health_state: state.conditionStatus === 'pass' ? 'good' : state.conditionStatus === 'not_tested' ? 'not_tested' : 'defective',
    status: state.conditionStatus === 'pass' ? 'clean' : state.damageStatus,
    fault_code: state.conditionStatus === 'fault' ? state.faultCode : null,
    severity: state.severity || 'moderate',
    velocity_min: state.velocityMin === '' || state.velocityMin == null ? null : Number(state.velocityMin),
    velocity_max: state.velocityMax === '' || state.velocityMax == null ? null : Number(state.velocityMax),
    notes: String(state.notes || '').trim()
  };
  if (!state.id) {
    const { data, error } = await supabase.from('key_damage_map').insert(payload).select().single();
    if (error?.code === '23505') throw new Error('This key was changed in another session. Reload the keyboard diagnostics before saving.');
    if (error) throw error;
    if (!data?.id) throw new Error('The keyboard finding save could not be confirmed. Reload the keyboard diagnostics before retrying.');
    return fromDbKeyState(data);
  }
  if (!expectedUpdatedAt) throw new Error('This key finding has no save version. Reload it before saving.');
  const { data, error } = await supabase
    .from('key_damage_map')
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
    .from('key_damage_map')
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
    key_damage_id: request.keyDamageId || null,
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
