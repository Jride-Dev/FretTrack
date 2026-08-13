import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';

type SupabaseAnyClient = ReturnType<typeof createClient<any, 'public', any>>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const stripe = new Stripe(getStripeSecretKey());

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  try {
    const userClient = createUserClient(request);
    const { data: userResult, error: userError } = await userClient.auth.getUser();
    if (userError || !userResult?.user) return json({ success: false, error: 'Sign in before managing billing.' }, 401);

    const payload = await request.json().catch(() => ({}));
    const shopId = normalizeText(payload.shopId || payload.shop_id);
    if (!shopId) return json({ success: false, error: 'Missing shop.' }, 400);

    const membership = await getBillingMembership(userClient, shopId, userResult.user.id);
    if (!membership.allowed) return json({ success: false, error: membership.error }, 403);

    const adminClient = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const { data: subscription, error } = await adminClient
      .from('shop_subscriptions')
      .select('stripe_customer_id')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw error;
    if (!subscription?.stripe_customer_id) {
      return json({ success: false, error: 'No Stripe customer is connected to this shop yet.' }, 409);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getAppUrl()}/?billing=portal-return`
    });

    return json({ success: true, url: session.url });
  } catch (error) {
    console.error('create-billing-portal-session failed', error);
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
});

function createUserClient(request: Request) {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } }
  });
}

async function getBillingMembership(client: SupabaseAnyClient, shopId: string, userId: string) {
  const { data, error } = await client
    .from('shop_members')
    .select('role')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { allowed: false, error: 'Unable to verify shop access.' };
  const member = data as { role?: string } | null;
  if (!member || !['owner', 'admin'].includes(String(member.role || '').toLowerCase())) {
    return { allowed: false, error: 'Only shop owners and admins can manage billing.' };
  }
  return { allowed: true, error: '' };
}

function getAppUrl() {
  return (Deno.env.get('FRETTRACK_APP_URL') || 'https://app.frettrack-app.com').replace(/\/+$/, '');
}

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_API_KEY') || '';
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create Stripe Billing Portal session.';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
