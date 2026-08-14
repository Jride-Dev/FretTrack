import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getInvoiceSubscriptionId,
  normalizeBillingInterval,
  normalizePlan,
  normalizeStripeStatus,
  toProfileSubscriptionStatus
} from './lifecycle.ts';
import { shouldApplyStripeSubscriptionEvent } from '../_shared/stripeSubscriptionState.ts';

const stripe = new Stripe(getStripeSecretKey());
const cryptoProvider = Stripe.createSubtleCryptoProvider();
type SupabaseAnyClient = ReturnType<typeof createClient<any, 'public', any>>;
type StripeEventResult = {
  status: string;
  shopId?: string;
  customerId?: string;
  subscriptionId?: string;
  errorMessage?: string;
};
type StripeSyncContext = {
  generation: number;
  eventId: string;
};

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
      return syncCheckoutSession(supabase, event, event.data.object as Stripe.Checkout.Session);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscriptionEvent(supabase, event, event.data.object as Stripe.Subscription);
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded':
    case 'invoice.paid':
      return syncInvoicePaymentState(supabase, event, event.data.object as Stripe.Invoice);
    default:
      return { status: 'ignored', shopId: '', customerId: '', subscriptionId: '' };
  }
}

async function syncCheckoutSession(
  supabase: SupabaseAnyClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const shopId = normalizeText(session.metadata?.shop_id || session.client_reference_id);
  if (!shopId) throw new Error('Checkout session missing shop id.');
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || '';
  if (!subscriptionId) throw new Error('Checkout session missing subscription id.');
  return syncCurrentStripeSubscription(supabase, event, subscriptionId, shopId);
}

async function syncInvoicePaymentState(
  supabase: SupabaseAnyClient,
  event: Stripe.Event,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return { status: 'ignored', shopId: '', customerId: getCustomerId(invoice.customer), subscriptionId: '' };
  const customerId = getCustomerId(invoice.customer);
  const shopId = await findShopIdByCustomer(supabase, customerId);
  return syncCurrentStripeSubscription(supabase, event, subscriptionId, shopId);
}

async function syncSubscriptionEvent(
  supabase: SupabaseAnyClient,
  event: Stripe.Event,
  deliveredSubscription: Stripe.Subscription,
) {
  const customerId = getCustomerId(deliveredSubscription.customer);
  const shopId = normalizeText(deliveredSubscription.metadata?.shop_id) ||
    await findShopIdByCustomer(supabase, customerId);
  return syncCurrentStripeSubscription(supabase, event, deliveredSubscription.id, shopId);
}

async function syncCurrentStripeSubscription(
  supabase: SupabaseAnyClient,
  event: Stripe.Event,
  subscriptionId: string,
  fallbackShopId = '',
) {
  let shopId = normalizeText(fallbackShopId);
  const subscriptionForMapping = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = getCustomerId(subscriptionForMapping.customer);
  if (!shopId) {
    shopId = normalizeText(subscriptionForMapping.metadata?.shop_id) ||
      await findShopIdByCustomer(supabase, customerId);
  }
  if (!shopId) throw new Error(`Unable to map Stripe subscription ${subscriptionId} to a shop.`);

  const { data: storedSubscription, error: storedSubscriptionError } = await supabase
    .from('shop_subscriptions')
    .select('stripe_subscription_id, provider_status, status')
    .eq('shop_id', shopId)
    .maybeSingle();
  if (storedSubscriptionError) throw storedSubscriptionError;
  if (!shouldApplyStripeSubscriptionEvent({
    storedSubscriptionId: storedSubscription?.stripe_subscription_id,
    storedProviderStatus: storedSubscription?.provider_status,
    storedStatus: storedSubscription?.status,
    incomingSubscriptionId: subscriptionForMapping.id,
    incomingProviderStatus: subscriptionForMapping.status,
  })) {
    return {
      status: 'ignored',
      shopId,
      customerId,
      subscriptionId: subscriptionForMapping.id,
      errorMessage: 'Superseded subscription event ignored before synchronization.'
    };
  }

  const generation = await beginSubscriptionSync(supabase, shopId, event);
  const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncSubscription(supabase, currentSubscription, shopId, {
    generation,
    eventId: event.id,
  });
}

async function syncSubscription(
  supabase: SupabaseAnyClient,
  subscription: Stripe.Subscription,
  fallbackShopId: string,
  syncContext: StripeSyncContext,
) {
  const customerId = getCustomerId(subscription.customer);
  const shopId = normalizeText(subscription.metadata?.shop_id || fallbackShopId) || await findShopIdByCustomer(supabase, customerId);
  if (!shopId) throw new Error(`Unable to map Stripe subscription ${subscription.id} to a shop.`);

  const item = subscription.items.data[0];
  const priceId = item?.price?.id || '';
  const planId = planFromPriceId(priceId) || normalizePlan(subscription.metadata?.plan_id);
  if (!planId) throw new Error(`Stripe subscription ${subscription.id} uses an unrecognized FretTrack price.`);
  const billingInterval = normalizeBillingInterval(item?.price?.recurring?.interval) ||
    normalizeBillingInterval(subscription.metadata?.billing_interval);
  if (!billingInterval) throw new Error(`Stripe subscription ${subscription.id} is missing a supported billing interval.`);
  const status = normalizeStripeStatus(subscription.status);
  const billingEmail = await getCustomerEmail(customerId);

  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const trialEndsAt = timestampToIso(subscription.trial_end);
  const { data: applied, error } = await supabase.rpc('apply_stripe_subscription_state', {
    p_shop_id: shopId,
    p_sync_generation: syncContext.generation,
    p_stripe_event_id: syncContext.eventId,
    p_plan_id: planId,
    p_status: status,
    p_trial_ends_at: trialEndsAt,
    p_current_period_starts_at: timestampToIso(subscriptionWithPeriod.current_period_start),
    p_current_period_ends_at: timestampToIso(subscriptionWithPeriod.current_period_end),
    p_grace_ends_at: status === 'past_due' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
    p_billing_email: billingEmail,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: priceId,
    p_billing_interval: billingInterval,
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    p_canceled_at: timestampToIso(subscription.canceled_at),
    p_provider_status: subscription.status,
    p_profile_subscription_status: toProfileSubscriptionStatus(status),
  });
  if (error) throw error;
  if (applied !== true) {
    return {
      status: 'ignored',
      shopId,
      customerId,
      subscriptionId: subscription.id,
      errorMessage: 'Stale or superseded subscription event ignored.'
    };
  }

  return { status: 'processed', shopId, customerId, subscriptionId: subscription.id };
}

async function beginSubscriptionSync(
  supabase: SupabaseAnyClient,
  shopId: string,
  event: Stripe.Event,
) {
  const { data, error } = await supabase.rpc('begin_stripe_subscription_sync', {
    p_shop_id: shopId,
    p_stripe_event_id: event.id,
    p_stripe_event_created_at: timestampToIso(event.created),
  });
  if (error) throw error;
  const generation = Number(data);
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Stripe subscription sync did not return a valid generation.');
  }
  return generation;
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

async function recordEvent(supabase: SupabaseAnyClient, event: Stripe.Event, result: StripeEventResult) {
  const { error } = await supabase.from('stripe_webhook_events').upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_event_created_at: timestampToIso(event.created),
    livemode: event.livemode,
    shop_id: result.shopId || null,
    stripe_customer_id: result.customerId || null,
    stripe_subscription_id: result.subscriptionId || null,
    status: result.status || 'processed',
    error_message: result.errorMessage || ''
  }, { onConflict: 'stripe_event_id' });
  if (error) throw error;
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
