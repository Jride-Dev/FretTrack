import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FRETTRACK_LEGAL_SELLER,
  FRETTRACK_PLANS,
  FRETTRACK_STANDARD_TRIAL_DAYS,
  FRETTRACK_SUBSCRIPTION_POLICY
} from '../src/modules/billing/commercialTerms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checkout = read('supabase/functions/create-checkout-session/index.ts');
const migration = read('supabase/migrations/20260826054954_standard_pro_trial_launch_terms.sql');
const billingPage = read('src/modules/billing/BillingPage.jsx');
const subscriptionSettings = read('src/modules/shops/SubscriptionSettingsSection.jsx');
const landing = read('cloudflare/frettrack-coming-soon/src/index.js');
const terms = read('cloudflare/frettrack-coming-soon/public/terms.html');
const privacy = read('cloudflare/frettrack-coming-soon/public/privacy.html');
const publicBilling = read('cloudflare/frettrack-coming-soon/public/docs/billing-and-subscriptions.html');
const pricingDocs = read('docs/PRICING_AND_TIERS.md');
const stripeDocs = read('docs/STRIPE_SELF_SERVE_BILLING.md');

assert.equal(FRETTRACK_LEGAL_SELLER, 'Jeffrey Russell d/b/a Torrance Guitar Repair');
assert.equal(FRETTRACK_STANDARD_TRIAL_DAYS, 14);
assert.deepEqual(
  [FRETTRACK_PLANS.shop.monthlyCents, FRETTRACK_PLANS.shop.yearlyCents, FRETTRACK_PLANS.pro.monthlyCents, FRETTRACK_PLANS.pro.yearlyCents],
  [2_999, 29_999, 3_999, 39_999]
);
assert.equal(FRETTRACK_SUBSCRIPTION_POLICY.trialAutoConverts, false);
assert.equal(FRETTRACK_SUBSCRIPTION_POLICY.firstAnnualPurchaseRefundDays, 14);
assert.equal(FRETTRACK_SUBSCRIPTION_POLICY.annualRenewalNoticeDays, 30);

for (const [name, source] of Object.entries({ landing, terms, privacy, publicBilling })) {
  assert.match(source, /Jeffrey Russell/iu, `${name} must identify the legal seller.`);
  assert.doesNotMatch(source, /FretTrack Systems/iu, `${name} must not represent FretTrack Systems as a legal entity.`);
}

for (const source of [landing, terms, publicBilling, pricingDocs]) {
  assert.match(source, /\$29\.99/u);
  assert.match(source, /\$299\.99/u);
  assert.match(source, /\$39\.99/u);
  assert.match(source, /\$399\.99/u);
}

assert.match(terms, /does not automatically convert/iu);
assert.match(terms, /end of the current paid billing period/iu);
assert.match(terms, /first annual subscription purchase/iu);
assert.match(terms, /30 days before/iu);
assert.match(terms, /business use/iu);
assert.match(terms, /Shop yearly saves \$59\.89/iu);
assert.match(terms, /Pro yearly saves \$79\.89/iu);
assert.match(privacy, /billing address/iu);
assert.match(privacy, /tax identification/iu);

assert.match(checkout, /billing_address_collection:\s*'required'/u);
assert.match(checkout, /tax_id_collection:\s*\{\s*enabled:\s*true/u);
assert.match(checkout, /consent_collection\s*=\s*\{\s*terms_of_service:\s*'required'/u);
assert.match(checkout, /STRIPE_REQUIRE_TERMS_ACCEPTANCE/u);
assert.match(checkout, /business use/iu);
assert.match(checkout, /customer_update/u);

assert.match(migration, /'pro'/u);
assert.match(migration, /interval '14 days'/u);
assert.doesNotMatch(migration, /interval '30 days'/u);
assert.match(migration, /create or replace function public\.create_trial_subscription_for_shop_profile/u);
assert.match(migration, /revoke all on function public\.create_trial_subscription_for_shop_profile/u);
assert.match(migration, /revoke all on function public\.bootstrap_current_user_as_owner/u);
assert.match(migration, /grant execute on function public\.bootstrap_current_user_as_owner/u);

assert.match(billingPage, /FRETTRACK_PLANS/u);
assert.match(billingPage, /first annual subscription purchase/iu);
assert.match(subscriptionSettings, /Open Billing from the main navigation/iu);
assert.match(stripeDocs, /Upcoming renewal events/u);
assert.match(stripeDocs, /30 days/u);

console.log('Commercial launch terms check passed.');
