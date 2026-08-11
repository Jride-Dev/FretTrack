import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(getStripeSecretKey());
const cryptoProvider = Stripe.createSubtleCryptoProvider();
type SupabaseAnyClient = ReturnType<typeof createClient<any, 'public', any>>;

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature || '',
      getStripeWebhookSecret(),
      undefined,
      cryptoProvider
    );
  } catch (error) {
    return new Response(getErrorMessage(error), { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

  const existing = await supabase
    .from('stripe_webhook_events')
    .select('stripe_event_id, status')
    .eq('stripe_event_id', event.id)
    .maybeSingle();
  if (existing.data && existing.data.status !== 'failed') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    const result = await handleStripeEvent(supabase as SupabaseAnyClient, event);
    await recordEvent(supabase, event, result);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('stripe-webhook failed', error);
    await recordEvent(supabase as SupabaseAnyClient, event, { status: 'failed', errorMessage: getErrorMessage(error) });
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), { status: 500 });
  }
});

async function handleStripeEvent(supabase: SupabaseAnyClient, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return syncCheckoutSession(supabase, event.data.object as Stripe.Checkout.Session);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(supabase, event.data.object as Stripe.Subscription);
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded':
      return syncInvoicePaymentState(supabase, event.data.object as Stripe.Invoice);
    default:
      return { status: 'ignored', shopId: '', customerId: '', subscriptionId: '' };
  }
}

async function syncCheckoutSession(supabase: SupabaseAnyClient, session: Stripe.Checkout.Session) {
  const shopId = normalizeText(session.metadata?.shop_id || session.client_reference_id);
  if (!shopId) throw new Error('Checkout session missing shop id.');
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || '';
  if (!subscriptionId) throw new Error('Checkout session missing subscription id.');
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncSubscription(supabase, subscription, shopId);
}

async function syncInvoicePaymentState(supabase: SupabaseAnyClient, invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof invoiceWithSubscription.subscription === 'string'
    ? invoiceWithSubscription.subscription
    : invoiceWithSubscription.subscription?.id || '';
  if (!subscriptionId) return { status: 'ignored', shopId: '', customerId: getCustomerId(invoice.customer), subscriptionId: '' };
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncSubscription(supabase, subscription);
}

async function syncSubscription(
  supabase: SupabaseAnyClient,
  subscription: Stripe.Subscription,
  fallbackShopId = ''
) {
  const customerId = getCustomerId(subscription.customer);
  const shopId = normalizeText(subscription.metadata?.shop_id || fallbackShopId) || await findShopIdByCustomer(supabase, customerId);
  if (!shopId) throw new Error(`Unable to map Stripe subscription ${subscription.id} to a shop.`);

  const item = subscription.items.data[0];
  const priceId = item?.price?.id || '';
  const planId = normalizePlan(subscription.metadata?.plan_id) || planFromPriceId(priceId);
  if (!planId) throw new Error(`Stripe subscription ${subscription.id} uses an unrecognized FretTrack price.`);
  const billingInterval = normalizeBillingInterval(subscription.metadata?.billing_interval || item?.price?.recurring?.interval);
  if (!billingInterval) throw new Error(`Stripe subscription ${subscription.id} is missing a supported billing interval.`);
  const status = normalizeStripeStatus(subscription.status);
  const billingEmail = await getCustomerEmail(customerId);

  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const updates = {
    shop_id: shopId,
    plan_id: planId,
    status,
    trial_ends_at: timestampToIso(subscription.trial_end),
    current_period_starts_at: timestampToIso(subscriptionWithPeriod.current_period_start),
    current_period_ends_at: timestampToIso(subscriptionWithPeriod.current_period_end),
    grace_ends_at: status === 'past_due' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
    billing_email: billingEmail,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    billing_interval: billingInterval,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: timestampToIso(subscription.canceled_at),
    provider_status: subscription.status,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('shop_subscriptions').upsert(updates, { onConflict: 'shop_id' });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from('shop_profiles')
    .update({
      subscription_tier: planId,
      subscription_status: status,
      trial_ends_at: updates.trial_ends_at,
      updated_at: new Date().toISOString()
    })
    .eq('shop_id', shopId);
  if (profileError) throw profileError;

  return { status: 'processed', shopId, customerId, subscriptionId: subscription.id };
}

async function findShopIdByCustomer(supabase: SupabaseAnyClient, customerId: string) {
  if (!customerId) return '';
  const { data } = await supabase
    .from('shop_subscriptions')
    .select('shop_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data as { shop_id?: string } | null)?.shop_id || '';
}

async function getCustomerEmail(customerId: string) {
  if (!customerId) return '';
  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return '';
  return customer.email || '';
}

async function recordEvent(supabase: SupabaseAnyClient, event: Stripe.Event, result: Record<string, string>) {
  const { error } = await supabase.from('stripe_webhook_events').upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    shop_id: result.shopId || null,
    stripe_customer_id: result.customerId || null,
    stripe_subscription_id: result.subscriptionId || null,
    status: result.status || 'processed',
    error_message: result.errorMessage || ''
  }, { onConflict: 'stripe_event_id' });
  if (error) throw error;
}

function normalizeStripeStatus(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return 'active';
  if (value === 'trialing') return 'trialing';
  if (value === 'past_due' || value === 'unpaid') return 'past_due';
  if (value === 'incomplete' || value === 'incomplete_expired') return 'incomplete';
  if (value === 'canceled' || value === 'cancelled') return 'canceled';
  if (value === 'paused') return 'read_only';
  return 'read_only';
}

function normalizePlan(plan: string) {
  const value = String(plan || '').toLowerCase();
  return value === 'shop' || value === 'pro' ? value : '';
}

function planFromPriceId(priceId: string) {
  const value = String(priceId || '').trim();
  if (!value) return '';
  if (['monthly', 'yearly'].some((interval) => getConfiguredPriceId('pro', interval) === value)) return 'pro';
  if (['monthly', 'yearly'].some((interval) => getConfiguredPriceId('shop', interval) === value)) return 'shop';
  return '';
}

function getConfiguredPriceId(plan: string, interval: string) {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const legacyKey = `STRIPE_${plan.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  return Deno.env.get(key) || Deno.env.get(legacyKey) || '';
}

function normalizeBillingInterval(interval: unknown) {
  const value = String(interval || '').toLowerCase();
  if (value === 'month' || value === 'monthly') return 'monthly';
  if (value === 'year' || value === 'yearly') return 'yearly';
  return '';
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return '';
  return typeof customer === 'string' ? customer : customer.id || '';
}

function timestampToIso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Stripe webhook processing failed.';
}

function getStripeSecretKey() {
  return Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_API_KEY') || '';
}

function getStripeWebhookSecret() {
  return Deno.env.get('STRIPE_WEBHOOK_SECRET') || Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '';
}
