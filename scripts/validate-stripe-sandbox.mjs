import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import postgres from 'postgres';
import { resolveCommand } from './resolve-command.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fixturePassword = 'FretTrackTest123!';
const pilotShop = { id: 'test1-shop', email: 'test1.owner@frettrack.local' };
const nonPilotShop = { id: 'test2-shop', email: 'test2.owner@frettrack.local' };
const spawnedProcesses = [];
let temporaryDirectory = '';
let stripeCustomerId = '';
let stripeSubscriptionId = '';
let stripeApiKey = '';
let sql;

try {
  const supabase = loadLocalSupabaseStatus();
  assertLocalUrl(supabase.API_URL, 'Supabase API');
  assertLocalUrl(supabase.DB_URL, 'Supabase database');

  stripeApiKey = await loadStripeSandboxKey();
  const stripeAccount = await stripeRequest('GET', '/v1/account');
  console.log(`Stripe sandbox account: ${stripeAccount.id}`);
  const prices = await discoverFretTrackPrices(stripeApiKey);
  validatePrice(prices.shop.monthly, 2_999, 'month', 'Shop monthly');
  validatePrice(prices.shop.yearly, 29_999, 'year', 'Shop yearly');
  validatePrice(prices.pro.monthly, 3_999, 'month', 'Pro monthly');
  validatePrice(prices.pro.yearly, 39_999, 'year', 'Pro yearly');

  const webhookSecretPromise = startStripeListener(supabase, stripeApiKey);
  const webhookSecret = await webhookSecretPromise;
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'frettrack-stripe-sandbox-'));
  const envPath = path.join(temporaryDirectory, 'functions.env');
  await fs.writeFile(envPath, buildFunctionsEnv({ stripeApiKey, webhookSecret, prices }), { encoding: 'utf8', mode: 0o600 });
  await startLocalFunctions(envPath);

  sql = postgres(supabase.DB_URL, { max: 1, connect_timeout: 10, idle_timeout: 5 });
  await resetPilotBillingState();

  const pilotToken = await signIn(supabase, pilotShop.email);
  const nonPilotToken = await signIn(supabase, nonPilotShop.email);

  const pilotStatus = await invokeFunction(supabase, 'create-checkout-session', pilotToken, {
    shopId: pilotShop.id,
    action: 'status'
  });
  assert.equal(pilotStatus.response.status, 200);
  assert.equal(pilotStatus.body.billingEnabled, true);
  assert.equal(pilotStatus.body.pilotRestricted, true);

  const nonPilotStatus = await invokeFunction(supabase, 'create-checkout-session', nonPilotToken, {
    shopId: nonPilotShop.id,
    action: 'status'
  });
  assert.equal(nonPilotStatus.response.status, 200);
  assert.equal(nonPilotStatus.body.billingEnabled, false);
  assert.equal(nonPilotStatus.body.code, 'STRIPE_BILLING_PILOT_ONLY');

  const checkout = await invokeFunction(supabase, 'create-checkout-session', pilotToken, {
    shopId: pilotShop.id,
    plan: 'pro',
    interval: 'yearly'
  });
  assert.equal(checkout.response.status, 200, checkout.body.error || 'Pro yearly Checkout failed.');
  assert.equal(checkout.body.success, true);
  assert.match(String(checkout.body.url || ''), /^https:\/\/checkout\.stripe\.com\//);
  console.log('PASS: pilot-only launch status and Pro yearly Checkout session');

  const customer = await stripeRequest('POST', '/v1/customers', {
    email: pilotShop.email,
    name: 'FretTrack Stripe Sandbox Validation',
    'metadata[shop_id]': pilotShop.id,
    'metadata[purpose]': 'frettrack_sandbox_validation'
  });
  stripeCustomerId = customer.id;
  const paymentMethod = await stripeRequest('POST', '/v1/payment_methods/pm_card_visa/attach', { customer: stripeCustomerId });
  await stripeRequest('POST', `/v1/customers/${stripeCustomerId}`, {
    'invoice_settings[default_payment_method]': paymentMethod.id
  });

  const subscription = await stripeRequest('POST', '/v1/subscriptions', {
    customer: stripeCustomerId,
    'items[0][price]': prices.shop.yearly.id,
    default_payment_method: paymentMethod.id,
    payment_behavior: 'error_if_incomplete',
    'metadata[shop_id]': pilotShop.id,
    'metadata[plan_id]': 'shop',
    'metadata[billing_interval]': 'yearly'
  });
  stripeSubscriptionId = subscription.id;

  await waitForSubscriptionState((row) =>
    row.stripe_subscription_id === stripeSubscriptionId &&
    row.plan_id === 'shop' &&
    row.billing_interval === 'yearly' &&
    ['active', 'trialing'].includes(row.provider_status)
  );
  console.log('PASS: signed webhook activated the annual Shop subscription locally');

  const portal = await invokeFunction(supabase, 'create-billing-portal-session', pilotToken, { shopId: pilotShop.id });
  assert.equal(portal.response.status, 200, portal.body.error || 'Billing Portal session failed.');
  assert.equal(portal.body.success, true);
  assert.match(String(portal.body.url || ''), /^https:\/\/billing\.stripe\.com\//);
  console.log('PASS: connected owner can open the Stripe Billing Portal');

  const subscriptionItemId = subscription.items?.data?.[0]?.id;
  assert.ok(subscriptionItemId, 'Stripe subscription did not include an item ID.');
  await stripeRequest('POST', `/v1/subscriptions/${stripeSubscriptionId}`, {
    'items[0][id]': subscriptionItemId,
    'items[0][price]': prices.pro.yearly.id,
    proration_behavior: 'none',
    'metadata[shop_id]': pilotShop.id,
    'metadata[plan_id]': 'pro',
    'metadata[billing_interval]': 'yearly'
  });
  await waitForSubscriptionState((row) => row.plan_id === 'pro' && row.billing_interval === 'yearly');
  console.log('PASS: annual Shop-to-Pro change synchronized through the webhook');

  await stripeRequest('POST', `/v1/subscriptions/${stripeSubscriptionId}`, { cancel_at_period_end: 'true' });
  await waitForSubscriptionState((row) => row.cancel_at_period_end === true && row.provider_status === 'active');
  console.log('PASS: period-end cancellation synchronized without prematurely removing access');

  await stripeRequest('DELETE', `/v1/subscriptions/${stripeSubscriptionId}`);
  await waitForSubscriptionState((row) => row.provider_status === 'canceled' && row.status === 'canceled');
  const [profile] = await sql`
    select subscription_status
    from shop_profiles
    where shop_id = ${pilotShop.id}
  `;
  assert.ok(['canceled', 'cancelled', 'read_only'].includes(String(profile?.subscription_status || '').toLowerCase()));

  await validateSignedEventReplay(supabase, webhookSecret);
  console.log('PASS: signed duplicate and older-event replays were idempotent');

  const [eventSummary] = await sql`
    select
      count(*)::integer as event_count,
      count(*) filter (where status = 'failed')::integer as failed_count,
      count(*) filter (where livemode)::integer as live_count
    from stripe_webhook_events
    where stripe_subscription_id = ${stripeSubscriptionId}
  `;
  assert.ok(eventSummary.event_count >= 3, 'Expected subscription lifecycle webhook events were not recorded.');
  assert.equal(eventSummary.failed_count, 0, 'At least one Stripe webhook failed.');
  assert.equal(eventSummary.live_count, 0, 'Sandbox validation unexpectedly received a live-mode event.');
  console.log('PASS: cancellation removed access and all recorded lifecycle events were sandbox-only');
  console.log('Stripe sandbox validation passed. Production billing remains unchanged.');
} catch (error) {
  console.error(`Stripe sandbox validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (stripeSubscriptionId && stripeApiKey) {
    await stripeRequest('DELETE', `/v1/subscriptions/${stripeSubscriptionId}`).catch(() => {});
  }
  if (stripeCustomerId && stripeApiKey) {
    await stripeRequest('DELETE', `/v1/customers/${stripeCustomerId}`).catch(() => {});
  }
  if (sql) await sql.end({ timeout: 5 }).catch(() => {});
  for (const child of spawnedProcesses.reverse()) stopProcess(child);
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
}

function loadLocalSupabaseStatus() {
  const result = spawnSync(resolveCommand('supabase'), ['status', '-o', 'json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) throw new Error('Local Supabase is not running.');
  return JSON.parse(result.stdout);
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), `${label} must be local.`);
}

async function loadStripeSandboxKey() {
  const environmentKey = String(process.env.STRIPE_SANDBOX_API_KEY || '').trim();
  if (environmentKey) {
    assert.ok(environmentKey.startsWith('sk_test_'), 'STRIPE_SANDBOX_API_KEY must be a Stripe sandbox secret key.');
    return environmentKey;
  }
  const configPath = path.join(process.env.USERPROFILE || os.homedir(), '.config', 'stripe', 'config.toml');
  const config = await fs.readFile(configPath, 'utf8');
  const profileName = String(process.env.STRIPE_CLI_PROFILE || 'frettrack-sandbox').trim();
  const profileKey = readStripeConfigProfileValue(config, profileName, 'test_mode_api_key');
  if (profileKey) {
    assert.ok(profileKey.startsWith('sk_test_'), `Stripe CLI profile ${profileName} does not contain a sandbox secret key.`);
    return profileKey;
  }
  const match = config.match(/^test_mode_api_key\s*=\s*["']([^"']+)["']/m);
  assert.ok(match?.[1]?.startsWith('sk_test_'), 'Stripe sandbox API key was not found. Set STRIPE_SANDBOX_API_KEY or create the frettrack-sandbox Stripe CLI profile.');
  return match[1];
}

function readStripeConfigProfileValue(config, profileName, keyName) {
  let currentProfile = '';
  for (const line of config.split(/\r?\n/)) {
    const section = line.match(/^\s*\[\s*(?:"([^"]+)"|'([^']+)'|([^\]]+))\s*\]\s*$/);
    if (section) {
      currentProfile = String(section[1] || section[2] || section[3] || '').trim();
      continue;
    }
    if (currentProfile !== profileName) continue;
    const value = line.match(new RegExp(`^\\s*${keyName}\\s*=\\s*["']([^"']+)["']\\s*$`));
    if (value) return value[1].trim();
  }
  return '';
}

async function discoverFretTrackPrices(apiKey) {
  const response = await fetch('https://api.stripe.com/v1/prices?active=true&type=recurring&limit=100&expand[]=data.product', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Unable to list Stripe sandbox prices.');

  const result = { shop: {}, pro: {} };
  for (const price of body.data || []) {
    const productName = String(price.product?.name || '').toLowerCase();
    const isFretTrackProduct = productName.includes('frettrack');
    const plan = isFretTrackProduct && productName.includes('pro')
      ? 'pro'
      : isFretTrackProduct && productName.includes('shop')
        ? 'shop'
        : '';
    const interval = price.recurring?.interval === 'year' ? 'yearly' : price.recurring?.interval === 'month' ? 'monthly' : '';
    if (plan && interval) result[plan][interval] = price;
  }
  for (const plan of ['shop', 'pro']) {
    for (const interval of ['monthly', 'yearly']) {
      assert.ok(result[plan][interval]?.id, `Missing active FretTrack ${plan} ${interval} sandbox price.`);
      assert.equal(result[plan][interval].currency, 'usd', `FretTrack ${plan} ${interval} is not USD.`);
    }
  }
  return result;
}

function validatePrice(price, expectedAmount, expectedInterval, label) {
  assert.equal(price.unit_amount, expectedAmount, `${label} sandbox price is not the approved amount.`);
  assert.equal(price.recurring?.interval, expectedInterval, `${label} uses the wrong recurring interval.`);
}

function startStripeListener(supabase, apiKey) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveCommand('stripe'), [
      'listen',
      '--forward-to', `${getFunctionsUrl(supabase)}/stripe-webhook`,
      '--events', 'checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_succeeded,invoice.payment_failed'
    ], {
      cwd: repoRoot,
      env: { ...process.env, STRIPE_API_KEY: apiKey },
      windowsHide: true
    });
    spawnedProcesses.push(child);
    let settled = false;
    let output = '';
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for the Stripe webhook listener.')), 30_000);
    const consume = (chunk) => {
      output += String(chunk);
      const match = output.match(/whsec_[A-Za-z0-9]+/);
      if (match) finish(null, match[0]);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.once('exit', (code) => {
      if (!settled) finish(new Error(`Stripe webhook listener exited before it was ready (${code}).`));
    });
    function finish(error, secret) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(secret);
    }
  });
}

function buildFunctionsEnv({ stripeApiKey: key, webhookSecret, prices }) {
  return [
    `STRIPE_API_KEY=${key}`,
    `STRIPE_WEBHOOK_SIGNING_SECRET=${webhookSecret}`,
    `STRIPE_PRICE_SHOP_MONTHLY=${prices.shop.monthly.id}`,
    `STRIPE_PRICE_SHOP_YEARLY=${prices.shop.yearly.id}`,
    `STRIPE_PRICE_PRO_MONTHLY=${prices.pro.monthly.id}`,
    `STRIPE_PRICE_PRO_YEARLY=${prices.pro.yearly.id}`,
    'FRETTRACK_APP_URL=http://127.0.0.1:5173',
    'STRIPE_BILLING_ENABLED=true',
    `STRIPE_BILLING_PILOT_SHOP_IDS=${pilotShop.id}`,
    ''
  ].join('\n');
}

async function startLocalFunctions(envPath) {
  const child = spawn(resolveCommand('supabase'), ['functions', 'serve', '--env-file', envPath, '--no-verify-jwt'], {
    cwd: repoRoot,
    windowsHide: true
  });
  spawnedProcesses.push(child);
  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  await waitUntil(async () => {
    if (child.exitCode !== null) throw new Error(`Local Edge Functions exited before startup: ${sanitizeProcessOutput(output)}`);
    return /Serving functions|edge runtime/i.test(output);
  }, 30_000, 'Timed out starting local Edge Functions.');
}

async function resetPilotBillingState() {
  await sql`
    update shop_subscriptions
    set stripe_customer_id = null,
        stripe_subscription_id = null,
        stripe_price_id = null,
        provider_status = null,
        cancel_at_period_end = false,
        canceled_at = null
    where shop_id = ${pilotShop.id}
  `;
}

async function signIn(supabase, email) {
  const response = await fetch(`${supabase.API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: supabase.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: fixturePassword })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Local sign-in failed for ${email}.`);
  return body.access_token;
}

async function invokeFunction(supabase, functionName, token, payload) {
  const response = await fetch(`${getFunctionsUrl(supabase)}/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabase.ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function stripeRequest(method, endpoint, parameters = {}) {
  const hasBody = !['DELETE', 'GET', 'HEAD'].includes(method);
  const response = await fetch(`https://api.stripe.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeApiKey}`,
      ...(hasBody ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    ...(hasBody ? { body: new URLSearchParams(parameters) } : {})
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `Stripe ${method} ${endpoint} failed.`);
  return body;
}

async function validateSignedEventReplay(supabase, webhookSecret) {
  const [sourceEventRow] = await sql`
    select stripe_event_id
    from stripe_webhook_events
    where stripe_subscription_id = ${stripeSubscriptionId}
      and event_type = 'customer.subscription.updated'
      and status = 'processed'
    order by stripe_event_created_at asc
    limit 1
  `;
  assert.ok(sourceEventRow?.stripe_event_id, 'No processed subscription update event was available for replay.');

  const sourceEvent = await stripeRequest('GET', `/v1/events/${sourceEventRow.stripe_event_id}`);
  const duplicate = await postSignedWebhook(supabase, webhookSecret, sourceEvent);
  assert.equal(duplicate.response.status, 200, 'Signed duplicate event replay failed.');
  assert.equal(duplicate.body.duplicate, true, 'Signed duplicate event was not recognized as a replay.');

  const [beforeReplay] = await sql`
    select plan_id, status, provider_status, billing_interval, stripe_subscription_id,
           cancel_at_period_end, canceled_at
    from shop_subscriptions
    where shop_id = ${pilotShop.id}
  `;
  const olderEvent = {
    ...sourceEvent,
    id: `evt_frettrack_${randomUUID().replaceAll('-', '')}`,
    created: 1
  };
  const olderReplay = await postSignedWebhook(supabase, webhookSecret, olderEvent);
  assert.equal(olderReplay.response.status, 200, 'Signed older-event replay failed.');
  await waitUntil(async () => {
    const [row] = await sql`
      select status
      from stripe_webhook_events
      where stripe_event_id = ${olderEvent.id}
    `;
    return row?.status === 'ignored';
  }, 15_000, 'Older signed Stripe event was not recorded as ignored.');

  const [afterReplay] = await sql`
    select plan_id, status, provider_status, billing_interval, stripe_subscription_id,
           cancel_at_period_end, canceled_at
    from shop_subscriptions
    where shop_id = ${pilotShop.id}
  `;
  assert.deepEqual(afterReplay, beforeReplay, 'Older signed Stripe event changed current subscription state.');
}

async function postSignedWebhook(supabase, webhookSecret, event) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  const response = await fetch(`${getFunctionsUrl(supabase)}/stripe-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`
    },
    body: payload
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function getFunctionsUrl(supabase) {
  const configured = String(supabase.FUNCTIONS_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  return `${String(supabase.API_URL || '').replace(/\/+$/, '')}/functions/v1`;
}

async function waitForSubscriptionState(predicate) {
  return waitUntil(async () => {
    const [row] = await sql`
      select plan_id, status, provider_status, billing_interval, stripe_subscription_id, cancel_at_period_end
      from shop_subscriptions
      where shop_id = ${pilotShop.id}
    `;
    return predicate(row || {}) ? row : false;
  }, 45_000, 'Timed out waiting for Stripe webhook state in local Supabase.');
}

async function waitUntil(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(message);
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
}

function sanitizeProcessOutput(output) {
  return String(output || '')
    .replace(/sk_(?:test|live)_[A-Za-z0-9]+/g, '[redacted Stripe key]')
    .replace(/whsec_[A-Za-z0-9]+/g, '[redacted webhook secret]')
    .trim()
    .slice(-500);
}
