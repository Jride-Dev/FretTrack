import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient.js';

export async function createPublicEstimateLink(jobId, revision, expiresAt = null) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Customer estimate links require the secured FretTrack database.');
  }

  const { data, error } = await supabase.rpc('create_public_estimate_link', {
    p_job_id: jobId,
    p_expected_revision: Number(revision),
    p_expires_at: expiresAt
  });
  if (error) {
    throw new Error(error.message || 'The customer estimate link could not be created.');
  }

  const token = data?.token;
  if (!token) {
    throw new Error('The customer estimate link was not returned.');
  }

  return {
    ...data,
    url: `${window.location.origin}/?estimate=${encodeURIComponent(token)}`
  };
}

export async function loadPublicEstimate(token) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('This estimate link requires the secured FretTrack database.');
  }

  const { data, error } = await supabase.rpc('get_public_estimate', { p_token: token });
  if (error) {
    throw new Error(error.message || 'This estimate link could not be opened.');
  }
  return data || { ok: false, error: 'This estimate link is invalid or expired.' };
}

export async function respondToPublicEstimate(token, decision, note = '') {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Estimate approval requires the secured FretTrack database.');
  }

  const { data, error } = await supabase.rpc('respond_to_public_estimate', {
    p_token: token,
    p_decision: decision,
    p_note: note || null
  });
  if (error) {
    throw new Error(error.message || 'The estimate response could not be recorded.');
  }
  return data || { ok: false, error: 'The estimate response was not returned.' };
}
