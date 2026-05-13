import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function getCurrentSession() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session || null;
}

export function onAuthSessionChange(callback) {
  if (!hasSupabaseConfig || !supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null);
  });

  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  return data.session || null;
}

export async function signUpWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }

  return data.session || null;
}

export async function signOut() {
  if (!hasSupabaseConfig || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
