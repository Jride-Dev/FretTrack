import { hasSupabaseConfig, supabase, supabaseInitError } from '../../shared/lib/supabaseClient';
import { getErrorMessage, logLegacyDebug } from '../../shared/legacy/legacyDebug';

export async function getCurrentSession() {
  if (!hasSupabaseConfig || !supabase) {
    if (supabaseInitError) {
      logLegacyDebug('session check skipped', getErrorMessage(supabaseInitError));
    }
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session || null;
  } catch (error) {
    logLegacyDebug('session check failure', getErrorMessage(error));
    throw error;
  }
}

export async function getCurrentUser() {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  return data.user || null;
}

export function onAuthSessionChange(callback) {
  if (!hasSupabaseConfig || !supabase) {
    return () => {};
  }

  try {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(session || null, event);
    });

    return () => data.subscription.unsubscribe();
  } catch (error) {
    logLegacyDebug('auth state subscription failure', getErrorMessage(error));
    throw error;
  }
}

export async function signInWithPassword({ email, password }) {
  assertSupabaseClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    return data.session || null;
  } catch (error) {
    logLegacyDebug('login request failure', getErrorMessage(error));
    throw error;
  }
}

export async function signUpWithPassword({ email, password }) {
  assertSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin
    }
  });
  if (error) {
    throw error;
  }

  return {
    session: data.session || null,
    user: data.user || null,
    mayAlreadyExist:
      Array.isArray(data.user?.identities) && data.user.identities.length === 0
  };
}

export async function resendSignupConfirmation(email) {
  assertSupabaseClient();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });
  if (error) {
    throw error;
  }
}

export async function sendPasswordResetEmail(email) {
  assertSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  if (error) {
    throw error;
  }
}

export async function updateCurrentUserPassword(password) {
  assertSupabaseClient();

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }

  return data.user || null;
}

export async function changeCurrentUserPassword({ email, currentPassword, nextPassword }) {
  if (!email) {
    throw new Error('Unable to confirm account email.');
  }

  await signInWithPassword({ email, password: currentPassword });
  return updateCurrentUserPassword(nextPassword);
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

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseInitError
      ? `Supabase client failed to start: ${getErrorMessage(supabaseInitError)}`
      : 'Supabase client is not available in this browser.');
  }
}
