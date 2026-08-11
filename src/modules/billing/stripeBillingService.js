import { hasSupabaseConfig, supabase } from '../../shared/lib/supabaseClient';

export async function createCheckoutSession({ shopId, plan, interval }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Stripe Checkout is unavailable in local fallback mode.');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { shopId, plan, interval }
  });

  if (error) {
    throw new Error(error.message || 'Unable to start Stripe Checkout.');
  }

  if (!data?.success || !data?.url) {
    throw new Error(data?.error || 'Stripe Checkout did not return a redirect URL.');
  }

  return data.url;
}

export async function createBillingPortalSession({ shopId }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Stripe Billing Portal is unavailable in local fallback mode.');
  }

  const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
    body: { shopId }
  });

  if (error) {
    throw new Error(error.message || 'Unable to open Stripe Billing Portal.');
  }

  if (!data?.success || !data?.url) {
    throw new Error(data?.error || 'Stripe Billing Portal did not return a redirect URL.');
  }

  return data.url;
}
