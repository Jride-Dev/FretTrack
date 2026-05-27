import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function getOrCreateBetaAccessRequest() {
  if (!hasSupabaseConfig || !supabase) {
    return { status: 'approved' };
  }

  const { data, error } = await supabase.rpc('get_or_create_beta_access_request');
  if (error) {
    throw error;
  }

  return normalizeBetaAccessRequest(data);
}

export function normalizeBetaAccessRequest(request = {}) {
  return {
    userId: request.user_id || request.userId || '',
    email: request.email || '',
    status: request.status || 'pending',
    requestedAt: request.requested_at || request.requestedAt || '',
    reviewedAt: request.reviewed_at || request.reviewedAt || '',
    reviewedBy: request.reviewed_by || request.reviewedBy || '',
    reviewedByEmail: request.reviewed_by_email || request.reviewedByEmail || '',
    notes: request.notes || '',
    lastSignInAt: request.last_sign_in_at || request.lastSignInAt || '',
    emailConfirmedAt: request.email_confirmed_at || request.emailConfirmedAt || '',
    updatedAt: request.updated_at || request.updatedAt || ''
  };
}
