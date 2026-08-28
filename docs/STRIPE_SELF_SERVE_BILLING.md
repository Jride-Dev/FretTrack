# Stripe Self-Serve Billing

Date: 2026-08-11

FretTrack's paid launch uses Stripe Checkout, Stripe Billing Portal, and a signed Stripe webhook.

FretTrack is sold for business use by Jeffrey Russell d/b/a Torrance Guitar Repair. The approved USD catalog is:

- Shop monthly: $29.99
- Shop yearly: $299.99 (saves $59.89 compared with twelve monthly payments)
- Pro monthly: $39.99
- Pro yearly: $399.99 (saves $79.89 compared with twelve monthly payments)

The standard 14-day Pro trial is an application-managed evaluation without a card and does not automatically convert. Checkout starts a paid billing period immediately only after an owner/admin deliberately selects a paid plan.

## Source-Controlled Functions

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-billing-portal-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

Checkout and Portal functions require a signed-in Supabase user and verify that user's exact owner/admin membership for the requested shop before creating a Stripe session.

The webhook uses Stripe signature verification against the raw request body and atomically claims each event ID in `public.stripe_webhook_events` before event processing begins. A terminal replay returns `duplicate=true` without entering the handler. A nonterminal claim returns a non-2xx retry response so Stripe does not mistake unfinished work for successful delivery. Failed attempts remain retryable, abandoned processing leases can be reclaimed after five minutes, and token guards prevent a stale attempt from finalizing or releasing a newer retry. Because Stripe does not guarantee event delivery order, each state-changing delivery also claims a shop-scoped synchronization generation, reloads the current subscription from Stripe, and applies subscription plus mirrored profile access state in one guarded database transaction. A late-finishing older handler cannot overwrite the newest in-flight sync.

## Checkout Security Boundary

Creating or opening a Checkout Session does not change the shop's FretTrack plan, subscription status, entitlements, or connected Stripe customer ID. Existing Stripe customers are reused when already connected. For a shop without a connected customer, Stripe creates the customer as part of confirming subscription Checkout.

An abandoned, canceled, expired, or failed Checkout Session therefore leaves the existing trial or paid access state unchanged. FretTrack persists Stripe customer/subscription identifiers and changes plan access only after a signature-verified Stripe webhook reports the subscription state. The success-page redirect is not treated as proof of payment.

Checkout creation also uses one deterministic idempotency key per shop and subscription generation. Simultaneous tabs requesting the same Checkout either replay the single Stripe Session or receive a safe in-progress conflict; a different plan request is rejected instead of opening a second subscription path. A terminal subscription ID starts a new generation so a genuinely canceled subscriber can later purchase again.

Checkout always collects a billing address and enables business tax-ID collection. Automatic tax remains disabled until FretTrack has the applicable tax registrations and an accountant-confirmed product tax treatment. Checkout displays the business-use, period-end cancellation, and first-annual-purchase refund summary beside the subscribe button.

Before setting `STRIPE_REQUIRE_TERMS_ACCEPTANCE=true`, configure the live and sandbox Stripe account Public details with `https://frettrack-app.com/terms` and `https://frettrack-app.com/privacy`. When enabled, Checkout requires affirmative acceptance of those Terms. The environment switch prevents a missing Stripe Dashboard URL from breaking Checkout during local development.

For an existing Stripe customer, FretTrack checks every page of that customer's subscriptions before creating Checkout. An open subscription linked to the shop therefore blocks another Checkout even when it appears beyond Stripe's first 100 records.

## Launch Switch and Enrollment Access

New Checkout sessions are protected by a server-authoritative Edge Function gate that defaults closed. The Billing page requests the authenticated gate status so its subscription buttons match the server, but browser state is never the authority. Existing subscribers retain Billing Portal access even when new enrollment is closed.

Migration `20260824020500_stripe_service_role_grants.sql` supplies the narrow table privileges required by the Checkout, Billing Portal, and webhook Edge Functions. A service-role JWT bypasses RLS, but PostgreSQL still requires explicit table privileges; do not replace these grants with broad schema-wide access.

Set both hosted secrets deliberately:

```powershell
supabase secrets set STRIPE_BILLING_ENABLED=false
supabase secrets set STRIPE_BILLING_PILOT_SHOP_IDS=
supabase secrets set STRIPE_REQUIRE_TERMS_ACCEPTANCE=true
```

For a controlled pilot, set `STRIPE_BILLING_ENABLED=true` and set `STRIPE_BILLING_PILOT_SHOP_IDS` to the exact comma-separated shop IDs allowed to open Checkout. An empty pilot list with billing enabled opens Checkout to every eligible owner/admin. Production has used that open-enrollment configuration since the stable `v0.2.9` release on 2026-08-27. Closing the switch blocks only new Checkout creation; it does not block existing customers from opening Stripe's Billing Portal.

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
supabase secrets set STRIPE_BILLING_ENABLED=false
supabase secrets set STRIPE_BILLING_PILOT_SHOP_IDS=
```

Never commit real Stripe secrets or price IDs.

Compatibility aliases:

- `STRIPE_SECRET_KEY` may be used instead of `STRIPE_API_KEY`.
- `STRIPE_WEBHOOK_SECRET` may be used instead of `STRIPE_WEBHOOK_SIGNING_SECRET`.
- `STRIPE_SHOP_MONTHLY_PRICE_ID`, `STRIPE_SHOP_YEARLY_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, and `STRIPE_PRO_YEARLY_PRICE_ID` may be used instead of the `STRIPE_PRICE_*` names.

## Local Sandbox Workflow

Use two Stripe sandbox products—FretTrack Shop and FretTrack Pro—with monthly and yearly recurring prices under each product. This produces the four distinct sandbox Price IDs expected by FretTrack.

Keep sandbox values in ignored `supabase/functions/.env.stripe-sandbox`; never replace hosted Supabase secrets for local testing. Start the local stack and listener in separate terminals:

```powershell
supabase start
supabase functions serve --env-file .\supabase\functions\.env.stripe-sandbox --no-verify-jwt
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
npm run dev -- --host 127.0.0.1
```

The listener prints its own `whsec_...` secret. Save that exact value as `STRIPE_WEBHOOK_SIGNING_SECRET` before starting Functions. If the environment file changes, restart `supabase functions serve`; the running Edge Runtime does not reload secret values from the file. A healthy signed delivery returns HTTP `200`. Repeated `400` responses on every event indicate signature verification failed before subscription processing.

The sandbox environment must set `STRIPE_BILLING_ENABLED=true` and restrict `STRIPE_BILLING_PILOT_SHOP_IDS` to the disposable local fixture shop. The production switch remains closed throughout local validation.

The validator asserts all four approved sandbox amounts and recurring intervals before it creates any Checkout session. Set `STRIPE_SANDBOX_API_KEY` to the secret key for the exact sandbox being validated, or store it in the dedicated `frettrack-sandbox` Stripe CLI profile. Stripe Dashboard/CLI OAuth context selection does not expose a server-side `sk_test_` key to Edge Functions, and an older CLI TOML profile may belong to a different sandbox.

```powershell
$env:STRIPE_SANDBOX_API_KEY = 'sk_test_...'
$env:STRIPE_ALLOW_EVENT_REPLAY = 'true'
npm run test:stripe-sandbox
```

For an interactive local profile instead, run `stripe login --interactive --new-session --project-name frettrack-sandbox` in a normal terminal and paste the sandbox secret key only when Stripe CLI prompts for it. The validator prefers that profile automatically; `STRIPE_CLI_PROFILE` can select another named profile when needed.

Keep that value in the local shell or an approved secret manager only. Do not paste it into documentation, commit it, or replace the hosted live `STRIPE_API_KEY`. If the explicit environment variable is absent, the validator retains the legacy Stripe CLI TOML fallback for existing development profiles.

With local Supabase and the Stripe CLI running, `npm run test:stripe-sandbox` discovers the FretTrack prices belonging to that key and performs the repeatable pilot lifecycle: gate denial outside the allowlist, annual Checkout creation, signed webhook activation, Billing Portal creation, annual Shop-to-Pro change, period-end cancellation, final cancellation, signed duplicate and older-event replay, and sandbox-only event verification. It prints the sandbox account ID before creating test data and passes the same key to the Stripe listener, preventing API calls and webhook listening from silently targeting different sandboxes. Command discovery supports Windows and Unix-like systems and reports a controlled missing-CLI error. The validator creates no report containing secrets and cleans up the temporary Stripe customer and subscription.

## Edge Function Deployment

Checkout and Portal must retain Supabase JWT verification. Stripe cannot provide a Supabase JWT when delivering a webhook, so only the webhook is deployed with gateway JWT verification disabled; its Stripe signature verification is the authentication boundary.

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy create-billing-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Do not use `--no-verify-jwt` for the Checkout or Portal functions.

## Production Rollout Evidence

As of 2026-08-27:

- migration `20260814041144_stripe_billing_concurrency_guards.sql` is recorded in the linked production migration history;
- `stripe-webhook` version 23 is active with gateway JWT verification disabled only for Stripe delivery;
- `create-checkout-session` version 13 is active with gateway JWT verification retained;
- an authenticated-anon probe receives HTTP 401 from both the synchronization cursor table and `begin_stripe_subscription_sync`;
- a webhook request without `stripe-signature` reaches the function and fails closed with HTTP 400;
- `npm run check:stripe-edge-functions` passes all 13 executable lifecycle/concurrency/launch-gate tests;
- `npm run test:stripe-sandbox` passes annual Checkout, signed subscription activation, Billing Portal, Shop-to-Pro, period-end cancellation, final cancellation, and signed duplicate/out-of-order replay against local Supabase; and
- the stable production launch has `STRIPE_BILLING_ENABLED=true`, required Terms acceptance enabled, and an empty pilot allowlist, opening Checkout to eligible owners/admins without altering the hosted live API key.

## Webhook Events to Enable

At minimum:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Customer Billing Emails and Annual Renewal Notice

In Stripe Dashboard, open **Settings → Billing → Subscriptions and emails**. Enable **Send emails about upcoming renewals**, route subscription-management links to the Stripe-hosted Customer Portal, and set **Prevent failed payments → Upcoming renewal events** to **30 days**. Stripe uses that interval for the renewal email and the `invoice.upcoming` event. Keep successful-payment receipts and failed-payment emails enabled as well.

This Dashboard configuration is required before opening annual subscriptions broadly. Sandbox email delivery is limited by Stripe to verified-domain or team-member addresses, so validate the setting with an eligible sandbox address and confirm the message in Stripe's customer email log.

## Commercial Policy

- Subscriptions are for business use.
- Cancel anytime through the Billing Portal; cancellation takes effect at the end of the paid period and does not remove access early.
- The first annual subscription purchase may be refunded within 14 calendar days.
- Monthly payments and annual renewals are otherwise non-refundable except for duplicate charges, confirmed billing errors, or when required by law.
- Prices exclude applicable taxes unless Checkout states otherwise.

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

Checkout refuses to create another subscription while the shop already has a non-terminal Stripe subscription. Existing subscribers use the Billing Portal for plan changes, payment details, and cancellation. Webhook events from a different, superseded subscription ID are recorded as ignored and cannot overwrite the shop's current subscription state. Migration `20260814041144_stripe_billing_concurrency_guards.sql` adds the service-role-only sync cursor and atomic subscription/profile application functions; clients receive no access to those write boundaries.

For Portal plan changes, the exact configured Stripe Price ID and its recurring interval are authoritative. Checkout metadata remains a compatibility fallback only, because Stripe does not rewrite custom subscription metadata when a customer switches prices in the Portal.

Detailed provider states remain authoritative in `shop_subscriptions`. The older `shop_profiles.subscription_status` mirror uses its compatible coarse states: failed-payment grace access mirrors as active, while incomplete or read-only access mirrors as expired.

The existing entitlement snapshot remains the app authority. Stripe updates the subscription row; FretTrack's existing permission and entitlement layer decides what the shop can do.

Price IDs are opaque Stripe identifiers. FretTrack maps plans by exact comparison with the configured Shop and Pro Price ID secrets, and snapshots `monthly` or `yearly` from the Stripe subscription metadata/recurring price. It never guesses a plan or interval from characters inside a Price ID.

Current Stripe subscription payloads expose billing-period start/end on the subscription item. FretTrack snapshots those item-level timestamps for renewal display and retains the legacy top-level fields as a compatibility fallback.

Failed webhook processing remains retryable. A later Stripe delivery reprocesses a failed event ID and replaces its failed audit record; only successfully processed or intentionally ignored event IDs short-circuit as duplicates.

## Launch Smoke Test

Use Stripe test mode first, then live mode with a real low-risk purchase.

1. Owner/admin opens Billing.
2. Tech/viewer cannot manage billing.
3. Owner/admin starts Shop Monthly Checkout.
4. Cancel or abandon Checkout and verify the existing plan, status, entitlements, and Stripe identifiers remain unchanged.
5. Start Checkout simultaneously in two tabs and verify only one Stripe Session exists; the other request may replay it or return a safe conflict, but must not create another Session.
6. Start Checkout again, complete it, and return to FretTrack.
7. `checkout.session.completed` and `customer.subscription.created` are recorded in `stripe_webhook_events`.
8. `shop_subscriptions` shows `plan_id = shop`, Stripe customer/subscription IDs, period dates, and active/trialing status.
9. Billing Portal opens for the connected shop.
10. Upgrade to Pro and verify Pro entitlements only after webhook delivery.
11. Replay an older subscription event and verify it reloads current Stripe state or is superseded, never downgrading the newer plan/access state.
12. Cancel at period end and verify `cancel_at_period_end`.
13. Simulate failed payment and verify `past_due`.
14. Simulate payment recovery and verify `active`.
15. Cancel/delete subscription and verify FretTrack becomes read-only or canceled according to current policy.
