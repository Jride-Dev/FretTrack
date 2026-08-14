import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  hasBlockingStripeSubscription,
  isTerminalStripeSubscriptionStatus
} from '../_shared/stripeSubscriptionState.ts';

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
    const adminClient = createAdminClient();
    const { data: userResult, error: userError } = await userClient.auth.getUser();
    if (userError || !userResult?.user) return json({ success: false, error: 'Sign in before managing billing.' }, 401);

    const payload = await request.json().catch(() => ({}));
    const shopId = normalizeText(payload.shopId || payload.shop_id);
    const plan = normalizePlan(payload.plan);
    const interval = normalizeInterval(payload.interval);
    if (!shopId) return json({ success: false, error: 'Missing shop.' }, 400);
    if (!plan) return json({ success: false, error: 'Choose Shop or Pro.' }, 400);

    const membership = await getBillingMembership(userClient, shopId, userResult.user.id);
    if (!membership.allowed) return json({ success: false, error: membership.error }, 403);

    const priceId = getPriceId(plan, interval);
    if (!priceId) return json({ success: false, error: `Stripe price is not configured for ${plan} ${interval}.` }, 500);

    const [{ data: profile }, { data: subscription }] = await Promise.all([
      adminClient.from('shop_profiles').select('shop_id, email').eq('shop_id', shopId).maybeSingle(),
      adminClient
        .from('shop_subscriptions')
        .select('billing_email, status, provider_status, stripe_customer_id, stripe_subscription_id')
        .eq('shop_id', shopId)
        .maybeSingle()
    ]);
    if (!profile) return json({ success: false, error: 'Shop not found.' }, 404);

    if (hasBlockingStripeSubscription({
      stripeSubscriptionId: subscription?.stripe_subscription_id,
      providerStatus: subscription?.provider_status,
      status: subscription?.status
    })) {
      return existingSubscriptionResponse();
    }

    const billingEmail = normalizeText(payload.billingEmail || payload.billing_email || subscription?.billing_email || profile.email || userResult.user.email);
    const customerId = normalizeText(subscription?.stripe_customer_id);
    if (customerId && await customerHasOpenShopSubscription(customerId, shopId)) {
      return existingSubscriptionResponse();
    }

    const appUrl = getAppUrl();
    const checkoutParameters: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: shopId,
      subscription_data: {
        metadata: { shop_id: shopId, plan_id: plan, billing_interval: interval }
      },
      metadata: { shop_id: shopId, plan_id: plan, billing_interval: interval }
    };

    if (customerId) {
      checkoutParameters.customer = customerId;
    } else if (billingEmail) {
      checkoutParameters.customer_email = billingEmail;
    }

    const session = await stripe.checkout.sessions.create(checkoutParameters);

    return json({ success: true, url: session.url });
  } catch (error) {
    console.error('create-checkout-session failed', error);
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
});

function createUserClient(request: Request) {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } }
  });
}

function createAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
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

function getPriceId(plan: string, interval: string) {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const legacyKey = `STRIPE_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  return Deno.env.get(key) || Deno.env.get(legacyKey) || '';
}

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_API_KEY') || '';
}

async function customerHasOpenShopSubscription(customerId: string, shopId: string) {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  return subscriptions.data.some((subscription) =>
    normalizeText(subscription.metadata?.shop_id) === shopId &&
    !isTerminalStripeSubscriptionStatus(subscription.status)
  );
}

function existingSubscriptionResponse() {
  return json({
    success: false,
    error: 'This shop already has a Stripe subscription. Use Manage Billing Portal to change or cancel it.'
  }, 409);
}

function getAppUrl() {
  return (Deno.env.get('FRETTRACK_APP_URL') || 'https://app.frettrack-app.com').replace(/\/+$/, '');
}

function normalizePlan(value: unknown) {
  const plan = String(value || '').toLowerCase();
  return ['shop', 'pro'].includes(plan) ? plan : '';
}

function normalizeInterval(value: unknown) {
  const interval = String(value || 'monthly').toLowerCase();
  return interval === 'yearly' ? 'yearly' : 'monthly';
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create Stripe Checkout session.';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
