# Stripe Self-Serve Billing

Date: 2026-08-11

FretTrack's paid launch uses Stripe Checkout, Stripe Billing Portal, and a signed Stripe webhook.

## Source-Controlled Functions

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-billing-portal-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

Checkout and Portal functions require a signed-in Supabase user and verify that user's exact owner/admin membership for the requested shop before creating a Stripe session.

The webhook uses Stripe signature verification against the raw request body and records processed event IDs in `public.stripe_webhook_events` before returning success for duplicate deliveries.

## Checkout Security Boundary

Creating or opening a Checkout Session does not change the shop's FretTrack plan, subscription status, entitlements, or connected Stripe customer ID. Existing Stripe customers are reused when already connected. For a shop without a connected customer, Stripe creates the customer as part of confirming subscription Checkout.

An abandoned, canceled, expired, or failed Checkout Session therefore leaves the existing beta or paid access state unchanged. FretTrack persists Stripe customer/subscription identifiers and changes plan access only after a signature-verified Stripe webhook reports the subscription state. The success-page redirect is not treated as proof of payment.

## Required Supabase Secrets

Set these in the production Supabase project:

The functions accept both FretTrack's newer names and the existing live names already used by the deployed minimal webhook:

```powershell
supabase secrets set STRIPE_API_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_SHOP_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_SHOP_YEARLY=price_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_...
supabase secrets set FRETTRACK_APP_URL=https://app.frettrack-app.com
```

Never commit real Stripe secrets or price IDs.

Compatibility aliases:

- `STRIPE_SECRET_KEY` may be used instead of `STRIPE_API_KEY`.
- `STRIPE_WEBHOOK_SECRET` may be used instead of `STRIPE_WEBHOOK_SIGNING_SECRET`.
- `STRIPE_SHOP_MONTHLY_PRICE_ID`, `STRIPE_SHOP_YEARLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, and `STRIPE_PRO_YEARLY_PRICE_ID` may be used instead of the `STRIPE_PRICE_*` names.

## Edge Function Deployment

Checkout and Portal must retain Supabase JWT verification. Stripe cannot provide a Supabase JWT when delivering a webhook, so only the webhook is deployed with gateway JWT verification disabled; its Stripe signature verification is the authentication boundary.

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy create-billing-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Do not use `--no-verify-jwt` for the Checkout or Portal functions.

## Webhook Events to Enable

At minimum:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Subscription Mapping

Stripe events update `public.shop_subscriptions`:

- `plan_id`
- `status`
- `trial_ends_at`
- `current_period_starts_at`
- `current_period_ends_at`
- `grace_ends_at`
- `billing_email`
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_price_id`
- `billing_interval`
- `cancel_at_period_end`
- `canceled_at`
- `provider_status`

The existing entitlement snapshot remains the app authority. Stripe updates the subscription row; FretTrack's existing permission and entitlement layer decides what the shop can do.

Price IDs are opaque Stripe identifiers. FretTrack maps plans by exact comparison with the configured Shop and Pro Price ID secrets, and snapshots `monthly` or `yearly` from the Stripe subscription metadata/recurring price. It never guesses a plan or interval from characters inside a Price ID.

Failed webhook processing remains retryable. A later Stripe delivery reprocesses a failed event ID and replaces its failed audit record; only successfully processed or intentionally ignored event IDs short-circuit as duplicates.

## Launch Smoke Test

Use Stripe test mode first, then live mode with a real low-risk purchase.

1. Owner/admin opens Billing.
2. Tech/viewer cannot manage billing.
3. Owner/admin starts Shop Monthly Checkout.
4. Cancel or abandon Checkout and verify the existing plan, status, entitlements, and Stripe identifiers remain unchanged.
5. Start Checkout again, complete it, and return to FretTrack.
6. `checkout.session.completed` and `customer.subscription.created` are recorded in `stripe_webhook_events`.
7. `shop_subscriptions` shows `plan_id = shop`, Stripe customer/subscription IDs, period dates, and active/trialing status.
8. Billing Portal opens for the connected shop.
9. Upgrade to Pro and verify Pro entitlements only after webhook delivery.
10. Cancel at period end and verify `cancel_at_period_end`.
11. Simulate failed payment and verify `past_due`.
12. Simulate payment recovery and verify `active`.
13. Cancel/delete subscription and verify FretTrack becomes read-only or canceled according to current policy.
