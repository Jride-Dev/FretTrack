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

function assertNotIncludes(source, expected, message) {
  assert.ok(!source.includes(expected), message || `Expected source not to include: ${expected}`);
}

function assertMatches(source, pattern, message) {
  assert.ok(pattern.test(source), message || `Expected source to match: ${pattern}`);
}

const migrationName = readdirSync(join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('_shop_bootstrap_reliability_phase_1.sql'))
  .sort()
  .at(-1);

assert.ok(migrationName, 'Shop bootstrap reliability migration must exist.');

const migration = read(`supabase/migrations/${migrationName}`);
const app = read('src/app/App.jsx');
const membershipService = read('src/modules/shops/shopMembershipService.js');

assertIncludes(migration, 'drop function if exists public.bootstrap_current_user_as_owner(text);', 'Migration must remove the old one-argument bootstrap RPC.');
assertMatches(migration, /create or replace function public\.bootstrap_current_user_as_owner\(\s*target_shop_id text,\s*target_shop_name text default null\s*\)/i, 'Bootstrap RPC must accept shop id and shop name.');
assertIncludes(migration, 'security definer', 'Bootstrap RPC must remain SECURITY DEFINER.');
assertIncludes(migration, 'set search_path = public, auth', 'Bootstrap RPC must lock the search path.');
assertIncludes(migration, 'current_user_id uuid := auth.uid();', 'Bootstrap RPC must bind to the authenticated caller.');
assertIncludes(migration, "raise exception 'Authentication required.'", 'Bootstrap RPC must reject unauthenticated calls.');
assertIncludes(migration, "raise exception 'Confirm your email before creating a shop workspace.'", 'Bootstrap RPC must require confirmed email.');
assertIncludes(migration, 'if not private.is_operator()', 'Bootstrap RPC must preserve operator bypass logic.');
assertIncludes(migration, 'from public.beta_access_requests', 'Bootstrap RPC must preserve beta approval checks.');
assertIncludes(migration, "and status = 'approved'", 'Bootstrap RPC must require approved beta access.');
assertIncludes(migration, 'from public.shop_members', 'Bootstrap RPC must check existing shop members before claiming a shop id.');
assertIncludes(migration, 'from public.shop_profiles', 'Bootstrap RPC must check existing shop profiles before claiming a shop id.');
assertIncludes(migration, 'insert into public.shop_profiles', 'Bootstrap RPC must create the shop profile during bootstrap.');
assertIncludes(migration, 'insert into public.shop_subscriptions', 'Bootstrap RPC must ensure the default subscription exists during bootstrap.');
assertIncludes(migration, 'normalized_shop_id', 'Bootstrap subscription insert must use the normalized shop id.');
assertIncludes(migration, "'trial'", 'Bootstrap subscription insert must preserve the trial plan convention.');
assertIncludes(migration, "'trialing'", 'Bootstrap subscription insert must preserve the trialing status convention.');
assertIncludes(migration, 'on conflict (shop_id) do nothing', 'Bootstrap RPC must avoid duplicate subscription rows.');
assertIncludes(migration, 'insert into public.shop_members', 'Bootstrap RPC must still create owner membership.');
assertIncludes(migration, "'effective_member_access', true", 'Bootstrap response must mark owner access effective.');
assertIncludes(migration, "'profile', jsonb_build_object", 'Bootstrap response must include profile details.');
assertIncludes(migration, "'subscription', jsonb_build_object", 'Bootstrap response must include subscription details.');
assertIncludes(migration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from public;', 'Bootstrap RPC must revoke PUBLIC execute.');
assertIncludes(migration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from anon;', 'Bootstrap RPC must revoke anon execute.');
assertIncludes(migration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from authenticated;', 'Bootstrap RPC must revoke authenticated before granting intentionally.');
assertIncludes(migration, 'grant execute on function public.bootstrap_current_user_as_owner(text, text) to authenticated;', 'Bootstrap RPC must grant only authenticated execute.');
assertNotIncludes(migration.toLowerCase(), 'disable row level security', 'Bootstrap migration must not disable RLS.');
assertNotIncludes(migration.toLowerCase(), 'create policy', 'Bootstrap migration must not loosen RLS policies.');
assertNotIncludes(migration.toLowerCase(), 'service_role', 'Bootstrap migration must not mention service-role credentials.');

assertIncludes(membershipService, "supabase.rpc('bootstrap_current_user_as_owner'", 'Frontend bootstrap must use the server-side RPC.');
assertIncludes(membershipService, 'target_shop_id: shopId', 'Frontend bootstrap must pass the shop id.');
assertIncludes(membershipService, 'target_shop_name: shopName', 'Frontend bootstrap must pass the shop display name.');
assertNotIncludes(membershipService.toLowerCase(), 'service_role', 'Frontend membership service must not expose service-role credentials.');
assertNotIncludes(membershipService, ".from('shop_members')\n    .insert", 'Frontend must not insert bootstrap owner membership directly.');

assertIncludes(app, 'async function loadShopAccess(preferredShopId = getSelectedShop().shopId, options = {})', 'Shop access loader must support rethrow for bootstrap verification.');
assertIncludes(app, 'if (options.rethrow) {', 'Shop access loader must be able to fail bootstrap if real reload fails.');
assertIncludes(app, 'async function handleBootstrapOwner()', 'Create Shop handler must exist.');
assertMatches(app, /async function handleBootstrapOwner\(\)[\s\S]*?if \(isMembershipLoading\) \{\s*return;\s*\}/, 'Create Shop handler must block duplicate submit.');
assertIncludes(app, 'await bootstrapCurrentUserAsOwner(shopId, shopNameValue);', 'Create Shop handler must pass the shop name to the RPC.');
assertIncludes(app, 'await loadShopAccess(shopId, { rethrow: true });', 'Create Shop handler must reload real shop access after bootstrap.');
assertNotIncludes(app, 'const ownerMembership = await bootstrapCurrentUserAsOwner(shopId);', 'Create Shop handler must not use the old one-argument RPC call.');
assertNotIncludes(app, 'setMembership(ownerShop);', 'Create Shop handler must not fake final membership state.');
assertNotIncludes(app, 'setMemberships([ownerShop]);', 'Create Shop handler must not fake final memberships state.');
assertNotIncludes(app, 'setEntitlementSnapshot(getDefaultEntitlementSnapshot(ownerShop.shopId));', 'Create Shop handler must not fake final entitlement state.');
assertNotIncludes(app.toLowerCase(), 'service_role', 'App must not expose service-role credentials.');

console.log('Shop bootstrap reliability checks passed.');
