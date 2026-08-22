import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const includes = (source, expected, message) => assert.ok(source.includes(expected), message);

const migration = read('supabase/migrations/20260822041624_pro_loyalty_program.sql');
const entitlements = read('src/modules/billing/entitlementService.js');
const settings = read('src/modules/shops/LoyaltyProgramSettings.jsx');
const customerCard = read('src/modules/loyalty/CustomerLoyaltyCard.jsx');
const service = read('src/modules/loyalty/loyaltyService.js');
const router = read('src/app/WorkspaceRouter.jsx');
const documentation = read('docs/PRO_LOYALTY_PROGRAM.md');

for (const plan of ['free', 'solo', 'shop', 'pro', 'enterprise', 'trial']) {
  includes(migration, `('${plan}', 'loyalty_program'`, `Migration must seed loyalty_program for ${plan}.`);
}
includes(migration, "('pro', 'loyalty_program', 'true'::jsonb)", 'Pro must include the Loyalty Program.');
includes(migration, "('shop', 'loyalty_program', 'false'::jsonb)", 'Shop must not include the Loyalty Program.');
includes(entitlements, "LOYALTY_PROGRAM: 'loyalty_program'", 'The client entitlement catalog must include loyalty.');
includes(router, 'loyaltyProgramEnabled={Boolean(billingAccess?.entitlements?.loyalty_program)}', 'Customer loyalty UI must use the Pro entitlement gate.');

includes(migration, 'program_started_at timestamptz', 'The program must have a non-retroactive start boundary.');
includes(migration, 'target_job.created_at >= target_rule.program_started_at', 'Old work orders must not become surprise loyalty awards.');
includes(migration, "target_job.status in ('Completed', 'Picked Up')", 'Only completed work orders may earn stamps.');
includes(migration, 'calculated_paid + 0.005 >= calculated_total', 'Only fully paid work orders may earn stamps.');
includes(migration, 'calculated_total > 0.005', 'Zero-dollar work orders must not earn stamps.');
includes(migration, 'unique (source_job_id)', 'One work order must have at most one award row.');
includes(migration, 'unique (shop_id, idempotency_key)', 'Redemption retries must be idempotent per shop.');
includes(migration, 'reversed_at = coalesce(reversed_at, now())', 'Refunded, reopened, or otherwise ineligible work must reverse its stamp.');
includes(migration, 'Work order customer or shop changed after loyalty qualification.', 'An earned award must never move between customer balances.');
includes(migration, 'for update;', 'Redemption must lock the customer before checking and spending points.');
includes(migration, 'earned - redeemed < target_rule.reward_threshold', 'Redemption must reject overspending.');
includes(migration, "private.shop_has_entitlement(target_customer.shop_id, 'loyalty_program')", 'Database RPCs must enforce the Pro entitlement.');
assert.ok(!migration.includes('grant insert on public.loyalty_redemptions to authenticated'), 'Clients must redeem through the guarded RPC, not direct inserts.');

includes(settings, 'completed and fully paid', 'Shop Settings must explain the earning rule.');
includes(settings, 'does not silently change an invoice', 'Shop Settings must preserve explicit invoice accounting.');
includes(customerCard, 'does not alter an invoice', 'Redemption confirmation must warn that the invoice remains explicit.');
includes(service, "supabase.rpc('redeem_customer_loyalty_reward'", 'The client must use the guarded redemption RPC.');

includes(documentation, 'does not create store credit', 'Documentation must keep loyalty outside the accounting ledger.');
includes(documentation, 'work orders opened after the program starts', 'Documentation must describe the non-retroactive boundary.');
includes(documentation, 'No remote migration or app deployment', 'Documentation must preserve the deployment approval boundary.');

console.log('Loyalty Program checks passed.');
