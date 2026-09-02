import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCheckoutIdempotencyKey,
  hasBlockingStripeSubscription,
  hasOpenCustomerSubscriptionAcrossPages,
  isStripeIdempotencyConflict,
  isTerminalStripeSubscriptionStatus,
} from '../_shared/stripeSubscriptionState.ts';
import { getStripeBillingLaunchAccess } from '../_shared/stripeBillingLaunch.ts';

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
    if (!shopId) return json({ success: false, error: 'Missing shop.' }, 400);

    const membership = await getBillingMembership(userClient, shopId, userResult.user.id);
    if (!membership.allowed) return json({ success: false, error: membership.error }, 403);

    const launchAccess = getStripeBillingLaunchAccess(
      shopId,
      Deno.env.get('STRIPE_BILLING_ENABLED'),
      Deno.env.get('STRIPE_BILLING_PILOT_SHOP_IDS'),
    );
    if (normalizeText(payload.action).toLowerCase() === 'status') {
      return json({
        success: true,
        billingEnabled: launchAccess.allowed,
        code: launchAccess.code,
        message: launchAccess.message,
        pilotRestricted: launchAccess.pilotRestricted,
      });
    }
    if (!launchAccess.allowed) {
      return json({ success: false, code: launchAccess.code, error: launchAccess.message }, 503);
    }

    const plan = normalizePlan(payload.plan);
    const interval = normalizeInterval(payload.interval);
    if (!plan) return json({ success: false, error: 'Choose Shop or Pro.' }, 400);

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
    if (customerId && await customerHasOpenSubscription(customerId)) {
      return existingSubscriptionResponse();
    }

    const appUrl = getAppUrl();
    const checkoutParameters: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      custom_text: {
        submit: {
          message: 'FretTrack subscriptions are sold for business use by Jeffrey Russell d/b/a Torrance Guitar Repair. Cancel anytime through the Billing Portal; cancellation takes effect at the end of the paid period. The first annual subscription purchase has a 14-day refund window.'
        }
      },
      client_reference_id: shopId,
      subscription_data: {
        metadata: { shop_id: shopId, plan_id: plan, billing_interval: interval }
      },
      metadata: { shop_id: shopId, plan_id: plan, billing_interval: interval }
    };

    if (isEnabled(Deno.env.get('STRIPE_REQUIRE_TERMS_ACCEPTANCE'))) {
      checkoutParameters.consent_collection = { terms_of_service: 'required' };
    }

    if (customerId) {
      checkoutParameters.customer = customerId;
      checkoutParameters.customer_update = { address: 'auto', name: 'auto' };
    } else if (billingEmail) {
      checkoutParameters.customer_email = billingEmail;
    }

    const idempotencyKey = await getCheckoutIdempotencyKey(
      shopId,
      isTerminalStripeSubscriptionStatus(subscription?.provider_status || subscription?.status)
        ? subscription?.stripe_subscription_id
        : '',
    );
    const session = await stripe.checkout.sessions.create(checkoutParameters, { idempotencyKey });

    return json({ success: true, url: session.url });
  } catch (error) {
    console.error('create-checkout-session failed', error);
    if (isStripeIdempotencyConflict(error)) {
      return json({
        success: false,
        error: 'Another checkout is already in progress for this shop. Finish or reopen that checkout before choosing a different plan.'
      }, 409);
    }
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

async function customerHasOpenSubscription(customerId: string) {
  return hasOpenCustomerSubscriptionAcrossPages(
    (startingAfter) => stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    })
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

function isEnabled(value: unknown) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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
