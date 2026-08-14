import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const readinessDoc = 'docs/PAID_LAUNCH_READINESS_30_DAY.md';

assert.ok(exists(readinessDoc), 'Paid-launch readiness document must exist.');

const readiness = read(readinessDoc);

for (const required of [
  'Current Verdict',
  'Backup and Restore Readiness',
  'Restore Drill',
  'Stripe and Billing Gap Audit',
  'Exact 30-Day Launch Checklist',
  'Go / No-Go Gates',
  'FretTrack Daily Supabase Backup',
  'backups/hosted-supabase-20260811-182456',
  'Task Scheduler result `0`',
  'Storage object binaries are intentionally copied separately',
  'Stripe-powered self-serve billing',
  'create-checkout-session',
  'create-billing-portal-session',
  'stripe-webhook',
  'STRIPE_API_KEY',
  'STRIPE_WEBHOOK_SIGNING_SECRET',
  'STRIPE_PRICE_SHOP_MONTHLY',
  'Stripe secrets or live price IDs are missing',
  'leaked-password protection',
]) {
  assert.ok(
    readiness.includes(required),
    `Paid-launch readiness document must mention "${required}".`,
  );
}

const stripeDoc = read('docs/STRIPE_SELF_SERVE_BILLING.md');
for (const required of [
  'Stripe Self-Serve Billing',
  'create-checkout-session',
  'create-billing-portal-session',
  'stripe-webhook',
  'checkout.session.completed',
  'customer.subscription.updated',
  'invoice.payment_failed',
  'shop_subscriptions',
  'stripe_webhook_events',
  'Checkout Security Boundary',
  'signature-verified Stripe webhook',
  'stripe-webhook --no-verify-jwt',
  'Do not use `--no-verify-jwt` for the Checkout or Portal functions.',
]) {
  assert.ok(stripeDoc.includes(required), `Stripe billing docs must mention "${required}".`);
}

const checkoutFunction = read('supabase/functions/create-checkout-session/index.ts');
assert.ok(checkoutFunction.includes("stripe.checkout.sessions.create"), 'Checkout function must create Stripe Checkout sessions.');
assert.ok(checkoutFunction.includes("['owner', 'admin']"), 'Checkout function must restrict billing management to owner/admin roles.');
assert.ok(checkoutFunction.includes(".eq('user_id', userId)"), 'Checkout function must verify the authenticated user\'s exact shop membership.');
assert.ok(!checkoutFunction.includes(".eq('status', 'active')"), 'Checkout function must use the actual shop_members schema.');
assert.ok(checkoutFunction.includes('getPriceId(plan, interval)'), 'Checkout function must use configured Stripe price IDs.');
assert.ok(checkoutFunction.includes('Deno.env.get(key)'), 'Checkout function must read Stripe price IDs from Supabase secrets.');
assert.ok(checkoutFunction.includes('STRIPE_API_KEY'), 'Checkout function must support the existing Stripe API key secret name.');
assert.ok(checkoutFunction.includes('client_reference_id: shopId'), 'Checkout function must bind Checkout sessions to a shop id.');
assert.ok(checkoutFunction.includes('customer_email'), 'Checkout must let Stripe create a customer only as part of confirmed subscription Checkout.');
assert.ok(!checkoutFunction.includes('stripe.customers.create'), 'Checkout creation must not create a detached Stripe customer before payment confirmation.');
assert.ok(
  !/from\(['"]shop_subscriptions['"]\)\s*\.upsert/s.test(checkoutFunction),
  'Checkout creation must not mutate subscription state before a signed Stripe webhook confirms the subscription.',
);

const portalFunction = read('supabase/functions/create-billing-portal-session/index.ts');
assert.ok(portalFunction.includes('stripe.billingPortal.sessions.create'), 'Portal function must create Stripe Billing Portal sessions.');
assert.ok(portalFunction.includes("['owner', 'admin']"), 'Portal function must restrict billing management to owner/admin roles.');
assert.ok(portalFunction.includes(".eq('user_id', userId)"), 'Portal function must verify the authenticated user\'s exact shop membership.');
assert.ok(!portalFunction.includes(".eq('status', 'active')"), 'Portal function must use the actual shop_members schema.');

const webhookFunction = read('supabase/functions/stripe-webhook/index.ts');
assert.ok(webhookFunction.includes('constructEventAsync'), 'Stripe webhook must verify signatures from the raw body.');
assert.ok(webhookFunction.includes('STRIPE_WEBHOOK_SIGNING_SECRET'), 'Stripe webhook must support the existing webhook signing secret name.');
assert.ok(webhookFunction.includes('stripe_webhook_events'), 'Stripe webhook must record processed event ids.');
assert.ok(webhookFunction.includes('checkout.session.completed'), 'Stripe webhook must process completed Checkout sessions.');
assert.ok(webhookFunction.includes('customer.subscription.updated'), 'Stripe webhook must process subscription updates.');
assert.ok(webhookFunction.includes('invoice.payment_failed'), 'Stripe webhook must process failed payments.');
assert.ok(webhookFunction.includes('invoice.paid'), 'Stripe webhook must process successful invoice payment recovery.');
assert.ok(webhookFunction.includes('shop_subscriptions'), 'Stripe webhook must update shop subscription state.');
assert.ok(webhookFunction.includes('getConfiguredPriceId'), 'Webhook plan mapping must compare exact configured Stripe price IDs.');
assert.ok(!webhookFunction.includes("value.includes('pro')"), 'Webhook must not infer a plan from opaque Stripe price ID text.');
assert.ok(webhookFunction.includes('normalizeBillingInterval'), 'Webhook must persist the Stripe subscription billing interval.');
assert.ok(webhookFunction.includes("existing.data.status !== 'failed'"), 'Failed webhook events must remain retryable.');
assert.ok(webhookFunction.includes("onConflict: 'stripe_event_id'"), 'Webhook event retries must update the existing idempotency record.');
assert.ok(
  /from\(['"]shop_subscriptions['"]\)\.upsert/s.test(webhookFunction),
  'The signed Stripe webhook must remain the subscription-state write boundary.',
);

const webhookLifecycle = read('supabase/functions/stripe-webhook/lifecycle.ts');
assert.ok(
  webhookLifecycle.includes('parent?.subscription_details?.subscription'),
  'Invoice events must resolve subscriptions from the current Stripe parent schema.',
);
assert.ok(
  /\|\|\s*getStripeId\(value\.subscription\)/.test(webhookLifecycle),
  'Invoice events must retain compatibility with legacy Stripe subscription references.',
);
const webhookLifecycleTest = read('supabase/functions/stripe-webhook/lifecycle.test.ts');
assert.ok(/subscription:\s*["']sub_current["']/.test(webhookLifecycleTest), 'Stripe lifecycle tests must cover the current invoice parent schema.');
assert.ok(/subscription:\s*["']sub_legacy["']/.test(webhookLifecycleTest), 'Stripe lifecycle tests must cover the legacy invoice schema.');
assert.ok(/\[\s*["']past_due["'],\s*["']past_due["']\s*\]/.test(webhookLifecycleTest), 'Stripe lifecycle tests must cover failed-payment access state.');
assert.ok(/\[\s*["']canceled["'],\s*["']canceled["']\s*\]/.test(webhookLifecycleTest), 'Stripe lifecycle tests must cover cancellation state.');

const billingPage = read('src/modules/billing/BillingPage.jsx');
assert.ok(billingPage.includes('Start Shop Monthly'), 'Billing page must expose Shop Checkout.');
assert.ok(billingPage.includes('Start Pro Monthly'), 'Billing page must expose Pro Checkout.');
assert.ok(billingPage.includes('Manage Billing Portal'), 'Billing page must expose the Stripe Billing Portal.');
assert.ok(!billingPage.includes('Plan changes are handled by FretTrack support during beta.'), 'Billing page must not keep the manual beta billing placeholder.');

const migration = read('supabase/migrations/20260811200225_stripe_self_serve_billing_readiness.sql');
for (const required of [
  'stripe_webhook_events',
  'stripe_price_id',
  'billing_interval',
  'cancel_at_period_end',
  'current_period_starts_at',
  'past_due',
  'stripe_customer_id',
  'stripe_subscription_id',
]) {
  assert.ok(migration.includes(required), `Stripe readiness migration must include "${required}".`);
}
assert.ok(!migration.includes("lower(subscription_row.stripe_price_id) like '%year%'"), 'Migration must not infer billing interval from opaque Stripe price IDs.');
assert.ok(!migration.includes("and status = 'active';"), 'Entitlement usage counts must use the actual shop_members schema.');
assert.ok(migration.includes('from public, anon, authenticated'), 'Webhook event table must revoke default authenticated mutations before granting operator read access.');
assert.ok(migration.includes('if trial_expired then\n    effective_entitlements := entitlement_values;'), 'Expired trials must continue ignoring entitlement overrides.');
assert.ok(migration.includes("'profileStatus', coalesce(profile_row.subscription_status, 'active')"), 'Existing entitlement snapshot compatibility fields must remain present.');

const triggerHardeningMigration = read('supabase/migrations/20260812025459_harden_set_updated_at_search_path.sql');
assert.ok(
  triggerHardeningMigration.includes("set search_path = ''") &&
    triggerHardeningMigration.includes('pg_catalog.now()'),
  'The shared updated_at trigger must use an empty search path and a schema-qualified timestamp function.',
);
assert.ok(
  triggerHardeningMigration.includes(
    'revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;',
  ),
  'The shared trigger-only function must not retain direct client execution grants.',
);

const functionEnvExample = read('supabase/functions/.env.example');
for (const required of [
  'STRIPE_SECRET_KEY=',
  'STRIPE_API_KEY=',
  'STRIPE_WEBHOOK_SECRET=',
  'STRIPE_WEBHOOK_SIGNING_SECRET=',
  'STRIPE_PRICE_SHOP_MONTHLY=',
  'STRIPE_PRICE_SHOP_YEARLY=',
  'STRIPE_PRICE_PRO_MONTHLY=',
  'STRIPE_PRICE_PRO_YEARLY=',
  'FRETTRACK_APP_URL=',
]) {
  assert.ok(functionEnvExample.includes(required), `Function env example must include "${required}".`);
}

const databaseBackups = read('docs/DATABASE_BACKUPS.md');
assert.ok(
  databaseBackups.includes('Storage bucket binaries are copied') ||
    databaseBackups.includes('Supabase Storage bucket files'),
  'Database backup docs must distinguish Storage object backup from database metadata.',
);
assert.ok(
  databaseBackups.includes('-SkipDockerVolumeBackup') &&
    databaseBackups.includes('three consecutive successful unattended runs'),
  'Database backup docs must explain the scheduled backup mode and the remaining reliability evidence gate.',
);
const localRestore = read('scripts/refresh-local-db-from-hosted-backup.ps1');
assert.ok(
  localRestore.includes('Restore-StorageBuckets') &&
    localRestore.includes("'x-upsert' = 'true'") &&
    localRestore.includes('_frettrack_storage_restore_snapshot') &&
    localRestore.includes('_frettrack_storage_buckets_restore_snapshot') &&
    localRestore.includes('file_size_limit = null') &&
    localRestore.includes('supabase_storage_FretTrack') &&
    localRestore.includes('SERVICE_ROLE_KEY'),
  'Local restore drill must restore hosted Storage binaries and preserve the local Storage volume first.',
);
assert.ok(
  localRestore.includes('Assert-CompleteSnapshot') &&
    localRestore.includes("'FAILED.txt'") &&
    localRestore.includes("'manifest.json'") &&
    localRestore.includes('Get-Sha256Hex') &&
    localRestore.includes('storage-buckets/bucket-list.txt'),
  'Local restore must reject failed or incomplete snapshots and verify the manifest before destructive work.',
);
assert.ok(
  !localRestore.includes('version = source.version'),
  'Local Storage restore must retain the environment-specific object version created by the local Storage API.',
);

const deploymentNotes = read('docs/DEPLOYMENT_NOTES.md');
assert.ok(
  deploymentNotes.includes('npm run deploy:app:production'),
  'Deployment notes must reference the guarded production deploy wrapper.',
);

const subscriptionFoundation = read('docs/SUBSCRIPTION_FOUNDATION.md');
assert.ok(
  subscriptionFoundation.includes('2026-08-11 paid-launch readiness update') &&
    subscriptionFoundation.includes('signature-verified Stripe webhook'),
  'Subscription docs must distinguish the implemented Stripe path from pending production rollout.',
);

const securityChecklist = read('docs/SECURITY_REVIEW_CHECKLIST.md');
assert.ok(
  securityChecklist.includes('Paid Launch Gate'),
  'Security checklist must include a paid-launch gate.',
);

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts?.['check:paid-launch-readiness'],
  'node scripts/check-paid-launch-readiness.mjs',
  'package.json must expose check:paid-launch-readiness.',
);

console.log('Paid-launch readiness documentation check passed.');
