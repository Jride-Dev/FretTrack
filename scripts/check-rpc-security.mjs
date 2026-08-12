import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message || `Expected source to include: ${expected}`);
}

function assertMatches(source, pattern, message) {
  assert.ok(pattern.test(source), message || `Expected source to match ${pattern}`);
}

const securityMigration = read('supabase/migrations/20260616063922_security_definer_rpc_hardening_phase_1.sql');
const paidLifecycleMigration = read('supabase/migrations/20260616034902_paid_access_lifecycle_phase_1.sql');
const allMigrations = readdirSync(join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => read(`supabase/migrations/${file}`))
  .join('\n');
const inventoryService = read('src/modules/inventory/inventoryService.js');
const transactionService = read('src/services/transactionService.js');
const betaService = read('src/modules/beta/betaAccessService.js');
const operatorService = read('src/modules/operator/operatorService.js');
const membershipService = read('src/modules/shops/shopMembershipService.js');
const landingWorker = read('cloudflare/frettrack-coming-soon/src/index.js');
const sendEmailFunction = read('supabase/functions/send-email/index.ts');
const sendSmsFunction = read('supabase/functions/send-sms/index.ts');
const usageCapsMigration = read('supabase/migrations/20260727231401_email_photo_usage_caps_foundation.sql');
const bootstrapMigration = read('supabase/migrations/20260629132442_shop_bootstrap_reliability_phase_1.sql');
const systemStatusMigration = read('supabase/migrations/20260730080400_system_notices_and_uptime.sql');
const purchaseUnitMigration = read('supabase/migrations/20260730145549_purchase_unit_conversion.sql');

const flaggedFunctions = [
  ['submit_beta_access_request', 'text, text, text, text', ['anon', 'authenticated']],
  ['add_inventory_part_to_job', 'uuid, uuid, integer', ['authenticated']],
  ['create_transaction_event', 'jsonb', ['authenticated']],
  ['end_shop_premium_trial', 'text', ['authenticated']],
  ['extend_shop_premium_trial', 'text, integer', ['authenticated']],
  ['get_beta_access_requests', '', ['authenticated']],
  ['get_beta_operator_dashboard', '', ['authenticated']],
  ['get_current_user_shop_memberships', '', ['authenticated']],
  ['get_or_create_beta_access_request', '', ['authenticated']],
  ['is_current_operator', '', ['authenticated']],
  ['set_shop_premium_trial', 'text, integer, text', ['authenticated']],
  ['update_beta_access_request', 'uuid, text, text', ['authenticated']],
  ['update_beta_shop_subscription', 'text, text, integer, boolean', ['authenticated']],
  ['update_inventory_job_part_quantity', 'uuid, integer', ['authenticated']]
];

for (const [name, signature, grants] of flaggedFunctions) {
  const fn = signature ? `public.${name}(${signature})` : `public.${name}()`;
  assertIncludes(securityMigration, `revoke all on function ${fn} from public;`, `${name} must revoke PUBLIC execute.`);
  assertIncludes(securityMigration, `revoke all on function ${fn} from anon;`, `${name} must revoke anon before final grants.`);
  assertIncludes(securityMigration, `revoke all on function ${fn} from authenticated;`, `${name} must revoke authenticated before final grants.`);
  assertIncludes(securityMigration, `grant execute on function ${fn} to ${grants.join(', ')};`, `${name} must grant only approved caller roles.`);
}

for (const [signature, grants] of [
  ['reserve_shop_usage(text, uuid, text, bigint, bigint, text, text)', 'authenticated, service_role'],
  ['settle_shop_usage_reservation(text, uuid)', 'authenticated, service_role'],
  ['release_shop_usage_reservation(text, uuid)', 'authenticated, service_role'],
  ['release_photo_storage_object(text, text, text)', 'authenticated'],
  ['get_shop_usage_snapshot(text)', 'authenticated']
]) {
  assertIncludes(usageCapsMigration, `revoke all on function public.${signature} from public, anon, authenticated, service_role;`, `${signature} must revoke default execution.`);
  assertIncludes(usageCapsMigration, `grant execute on function public.${signature} to ${grants};`, `${signature} must grant only intended roles.`);
}
assertMatches(usageCapsMigration, /security definer[\s\S]*set search_path = ''/, 'Usage SECURITY DEFINER functions must lock search_path.');

assertMatches(bootstrapMigration, /security definer\s+set search_path = public, auth/i, 'Shop bootstrap must use a pinned search path.');
assertIncludes(bootstrapMigration, 'if current_user_id is null then', 'Shop bootstrap must require authentication.');
assertIncludes(bootstrapMigration, 'if current_email_confirmed_at is null then', 'Shop bootstrap must require a confirmed email.');
assertIncludes(bootstrapMigration, 'and not exists (', 'Shop bootstrap must require approved beta access for non-operators.');
assertIncludes(bootstrapMigration, 'from public.beta_access_requests', 'Shop bootstrap must check the authoritative beta request table.');
assertIncludes(bootstrapMigration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from public;', 'Shop bootstrap must revoke PUBLIC execution.');
assertIncludes(bootstrapMigration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from anon;', 'Shop bootstrap must reject anonymous execution.');
assertIncludes(bootstrapMigration, 'grant execute on function public.bootstrap_current_user_as_owner(text, text) to authenticated;', 'Shop bootstrap must be callable only by signed-in users after internal checks.');

assertMatches(systemStatusMigration, /security definer\s+set search_path = public, pg_catalog/i, 'Public system status must use a pinned search path.');
for (const field of ['status', 'publicNoticeTitle', 'publicNoticeMessage', 'noticeType', 'statusChangedAt', 'lastUpdatedAt', 'incidentState']) {
  assertIncludes(systemStatusMigration, `'${field}'`, `Public system status must keep the explicit ${field} response field.`);
}
assertIncludes(systemStatusMigration, 'grant execute on function public.get_public_system_status() to anon, authenticated;', 'Only the fixed public status projection may remain anonymously callable.');
assertIncludes(systemStatusMigration, 'if not private.is_operator() then', 'System status updates must enforce the operator guard internally.');
assertIncludes(systemStatusMigration, 'revoke all on function public.update_system_status(text, text, text, text) from public, anon, authenticated;', 'System status updates must revoke default execution before granting access.');
assertIncludes(systemStatusMigration, 'grant execute on function public.update_system_status(text, text, text, text) to authenticated;', 'System status updates must require a signed-in caller before the operator guard.');

for (const signature of [
  'receive_inventory_part(uuid, integer, numeric, text)',
  'receive_purchase_order_items(uuid, jsonb, text)'
]) {
  assertIncludes(purchaseUnitMigration, `revoke all on function public.${signature} from public;`, `${signature} must revoke PUBLIC execution.`);
  assertIncludes(purchaseUnitMigration, `revoke all on function public.${signature} from anon;`, `${signature} must reject anonymous execution.`);
  assertIncludes(purchaseUnitMigration, `grant execute on function public.${signature} to authenticated;`, `${signature} must be limited to signed-in callers after internal checks.`);
}
assertMatches(purchaseUnitMigration, /create or replace function public\.receive_inventory_part[\s\S]*?if auth\.uid\(\) is null then[\s\S]*?not private\.can_write_shop\(target_part\.shop_id\)/i, 'Direct inventory receiving must enforce authentication and shop write permission.');
assertMatches(purchaseUnitMigration, /create or replace function public\.receive_purchase_order_items[\s\S]*?if auth\.uid\(\) is null then[\s\S]*?not private\.can_write_shop\(target_order\.shop_id\)/i, 'Purchase-order receiving must enforce authentication and shop write permission.');

for (const name of [
  'get_beta_access_requests',
  'get_beta_operator_dashboard',
  'update_beta_access_request',
  'update_beta_shop_subscription',
  'set_shop_premium_trial',
  'extend_shop_premium_trial',
  'end_shop_premium_trial'
]) {
  const pattern = new RegExp(`create or replace function public\\.${name}[\\s\\S]*?if not private\\.is_operator\\(\\) then`, 'i');
  assertMatches(allMigrations, pattern, `${name} must contain an internal operator guard.`);
}

for (const name of [
  'submit_beta_access_request',
  'add_inventory_part_to_job',
  'update_inventory_job_part_quantity',
  'create_transaction_event'
]) {
  assertMatches(securityMigration, new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?set search_path = public, private`, 'i'), `${name} must be redefined with a locked search path.`);
}

assertIncludes(securityMigration, 'grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;', 'Public beta intake remains intentionally callable by anon.');
assertIncludes(landingWorker, '/rest/v1/rpc/submit_beta_access_request', 'Landing Worker must remain the intended public beta intake caller.');
assertIncludes(landingWorker, 'authorization: `Bearer ${supabaseAnonKey}`', 'Public intake still uses anon-key Worker path until server credential migration.');

assertIncludes(betaService, "supabase.rpc('get_or_create_beta_access_request')", 'Beta status lookup must use authenticated user RPC.');
assertIncludes(membershipService, "supabase.rpc('get_current_user_shop_memberships')", 'Membership lookup must use authenticated membership RPC.');
assertIncludes(operatorService, "supabase.rpc('is_current_operator')", 'Operator status must use the operator RPC.');
assertIncludes(operatorService, "supabase.rpc('get_beta_operator_dashboard')", 'Operator dashboard must call the guarded dashboard RPC.');

assertIncludes(inventoryService, "supabase.rpc('add_inventory_part_to_job'", 'Inventory job-part add must use the guarded RPC.');
assertIncludes(inventoryService, "supabase.rpc('update_inventory_job_part_quantity'", 'Inventory quantity edit must use the guarded RPC.');
assertIncludes(securityMigration, 'if auth.uid() is null then', 'Mutating RPCs must require an authenticated session.');
assertIncludes(securityMigration, 'if safe_quantity < 1 or safe_quantity > 9999 then', 'Inventory RPCs must bound quantity.');
assertIncludes(securityMigration, 'not private.can_write_job(p_job_id)', 'Inventory add must enforce job write permission.');
assertIncludes(securityMigration, 'not private.can_write_job(target_job_part.job_id) or not private.can_write_shop(target_job_part.shop_id)', 'Inventory quantity edit must enforce job and shop lifecycle write permission.');
assertIncludes(securityMigration, 'and shop_id = target_job.shop_id', 'Inventory add must scope selected parts to the job shop.');
assertIncludes(securityMigration, 'quantity_delta := safe_quantity - coalesce(target_job_part.quantity, 0)::integer;', 'Inventory quantity edit must compute balanced movement delta.');

assertIncludes(transactionService, "supabase.rpc('create_transaction_event'", 'Transaction creation currently uses authenticated RPC path.');
assertIncludes(securityMigration, "jsonb_typeof(transaction_payload) <> 'object'", 'Transaction payload must be a JSON object.');
assertIncludes(securityMigration, "assigned_shop_id := nullif(transaction_payload->>'shop_id', '');", 'Transaction shop id must be explicit.');
assertIncludes(securityMigration, 'if not private.can_write_shop(assigned_shop_id) then', 'Transaction creation must enforce shop write/lifecycle permission.');
assertIncludes(securityMigration, 'Customer does not belong to this shop.', 'Transaction customer references must be shop scoped.');
assertIncludes(securityMigration, 'Employee does not belong to this shop.', 'Transaction employee references must be shop scoped.');
assertIncludes(securityMigration, 'Reversed transaction does not belong to this shop.', 'Transaction reversal references must be shop scoped.');
assertIncludes(securityMigration, 'auth.uid()::text', 'Transaction created_by must come from the authenticated caller.');

for (const source of [sendEmailFunction, sendSmsFunction]) {
  assertMatches(source, /if \(trialExpired\) \{\r?\n\s+return false;/, 'Email/SMS send helpers must block expired-trial writes.');
}

console.log('SECURITY DEFINER RPC checks passed.');
