# Paid Launch Readiness

Originally opened: 2026-08-11

Current stable-release update: 2026-08-28

This file began as a 30-day launch plan. Its recovery, billing, legal-copy, and validation work is now incorporated into FretTrack 0.3.0. It is retained as the operational paid-launch record, not as an unfinished prerelease schedule.

## Current verdict

The Shop and Pro billing foundation is implemented and sandbox-validated. Checkout and Billing Portal are authenticated, the webhook verifies Stripe signatures, subscription state is server-owned, event claims are atomic and retryable, and annual lifecycle validation covers duplicates and out-of-order events.

The approved catalog is Shop at $29.99 monthly or $299.99 yearly and Pro at $39.99 monthly or $399.99 yearly. New approved workspaces receive a non-converting 14-day Pro trial.

Production enrollment must remain controlled until the first live subscription completes the live smoke checks below. This is an operational rollout safeguard, not beta product branding.

## Completed foundation

- Guarded Cloudflare production builds and exact post-deploy asset verification.
- Repository-to-hosted migration drift checks and data-integrity checks.
- Hosted database and Storage backups with failure markers, completion manifests, checksums, and safe restore selection.
- Completed hosted-to-local restore drill with database and Storage verification.
- Three consecutive unattended backup runs recorded.
- Authenticated Checkout and Billing Portal functions.
- Signature-verified Stripe webhook with atomic claims, processing leases, ordered subscription synchronization, duplicate handling, and failed-finalization recovery.
- Server-authoritative launch switch and exact pilot allowlist support.
- Shop/Pro monthly and annual Stripe catalog validation.
- Cross-platform annual sandbox validator covering Checkout, Portal, plan change, cancellation, payment lifecycle, replay, older events, and cleanup.
- Public Terms, Privacy, Support, pricing, trial, annual savings, cancellation, and refund language.

## Current commercial configuration

- Seller: Jeffrey Russell d/b/a Torrance Guitar Repair.
- Shop: $29.99 monthly / $299.99 yearly.
- Pro: $39.99 monthly / $399.99 yearly.
- Trial: 14 days of Pro, no card, no automatic conversion.
- Billing periods renew until canceled through Stripe Billing Portal.
- Cancellation has no fee and normally takes effect at the end of the current paid period.
- Automatic tax remains disabled until applicable registrations and obligations are confirmed.

## Required hosted configuration

The hosted Supabase project must contain the intended environment's values for:

- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`
- `STRIPE_PRICE_SHOP_MONTHLY`
- `STRIPE_PRICE_SHOP_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `FRETTRACK_APP_URL=https://app.frettrack-app.com`
- `STRIPE_BILLING_ENABLED`
- `STRIPE_BILLING_PILOT_SHOP_IDS`

Do not print, commit, screenshot, or casually replace those values during verification. A sandbox secret must never be used in live mode, and a live secret must never be used by the sandbox validator.

## First live subscription smoke check

For the first real subscription:

1. Start from the intended approved owner account and shop.
2. Confirm the Billing page reports launch access and the expected plan/interval prices.
3. Complete Checkout once and verify the return URL.
4. Confirm the signed webhook event ledger finalized successfully.
5. Confirm the shop subscription, plan, interval, paid period, and entitlements match Stripe.
6. Open Billing Portal and confirm the customer can manage the subscription.
7. Confirm no duplicate history or duplicate downstream side effect occurred.
8. Confirm the customer received the expected Stripe receipt/invoice email.
9. Record only non-secret evidence in [Deployment Notes](DEPLOYMENT_NOTES.md).

Do not manufacture a cancellation or failed payment on a customer's real subscription solely to prove code already covered by the sandbox matrix. Use the sandbox for destructive lifecycle cases and monitor the live event ledger for real events.

## Ongoing release checks

- Run `npm run check:migrations` and the production build guard before every deployment.
- Keep Checkout/Portal JWT verification enabled; deploy only the Stripe webhook without JWT because its Stripe signature is the external authentication boundary.
- Confirm all Edge Functions perform server-side shop/member checks.
- Confirm frontend bundles contain no service-role key, Stripe secret, webhook secret, or provider credential.
- Re-run the isolated sandbox validator after billing code, Stripe catalog, webhook, portal, or lifecycle changes.
- Verify backup and restore readiness before database migrations.
- Keep public pricing, Terms, Privacy, Support, release notes, and in-app Billing copy aligned.

Exact deployment commands and the current hosted baseline are maintained in [Deployment Notes](DEPLOYMENT_NOTES.md). The technical state model is documented in [Subscription Foundation](SUBSCRIPTION_FOUNDATION.md).
