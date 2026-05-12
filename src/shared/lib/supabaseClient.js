import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey)
  : null;

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
