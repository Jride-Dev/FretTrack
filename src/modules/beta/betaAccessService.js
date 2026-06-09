import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function getOrCreateBetaAccessRequest() {
  if (!hasSupabaseConfig || !supabase) {
    return { status: 'approved' };
  }

  const { data, error } = await supabase.rpc('get_or_create_beta_access_request');
  if (error) {
    throw error;
  }

  const request = normalizeBetaAccessRequest(data);
  notifyOperatorAboutPendingBetaAccess(request);
  return request;
}

export function normalizeBetaAccessRequest(request = {}) {
  return {
    id: request.id || '',
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
    operatorNotifiedAt: request.operator_notified_at || request.operatorNotifiedAt || '',
    updatedAt: request.updated_at || request.updatedAt || ''
  };
}

async function notifyOperatorAboutPendingBetaAccess(request) {
  if (!hasSupabaseConfig || !supabase || request.status !== 'pending' || request.operatorNotifiedAt) {
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('notify-beta-access-request', {
      body: { requestId: request.id || null }
    });

    if (error || data?.ok === false) {
      console.warn('Beta access operator notification did not complete.', error || data?.error || 'Unknown notification error.');
    }
  } catch (error) {
    console.warn('Beta access operator notification failed.', error);
  }
}
