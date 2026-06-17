import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logLegacyDebug } from '../legacy/legacyDebug';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let createdSupabaseClient = null;
let supabaseClientError = null;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

if (hasSupabaseConfig) {
  try {
    createdSupabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: 'implicit'
      }
    });
    logLegacyDebug('Supabase client created');
  } catch (error) {
    supabaseClientError = error;
    console.error('Supabase client creation failed.', error);
    logLegacyDebug('Supabase client creation failed', getErrorMessage(error));
  }
} else {
  logLegacyDebug('Supabase client skipped', 'Missing frontend Supabase config.');
}

export const supabase = createdSupabaseClient;
export const supabaseInitError = supabaseClientError;

export async function checkSupabaseJobsConnection() {
  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, status: 'not-configured', error: null };
  }

  const { error } = await supabase.from('jobs').select('id').limit(1);
  if (error) {
    return { ok: false, status: 'error', error };
  }

  return { ok: true, status: 'connected', error: null };
}
