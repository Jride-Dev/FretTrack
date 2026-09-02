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
  .filter((file) => file.endsWith('_self_service_shop_onboarding.sql'))
  .sort()
  .at(-1);

assert.ok(migrationName, 'Shop bootstrap reliability migration must exist.');

const migration = read(`supabase/migrations/${migrationName}`);
const app = read('src/app/App.jsx');
const appBootstrap = read('src/app/AppBootstrap.jsx');
const bootstrapController = read('src/app/useSessionShopBootstrap.js');
const membershipService = read('src/modules/shops/shopMembershipService.js');
const authGate = read('src/modules/auth/AuthGate.jsx');
const readme = read('README.md');
const accountAccessDocs = read('docs/ACCOUNT_ACCESS_APPROVAL.md');
const landingWorker = read('cloudflare/frettrack-coming-soon/src/index.js');
const publicSupport = read('cloudflare/frettrack-coming-soon/public/support.html');
const publicFaq = read('cloudflare/frettrack-coming-soon/public/docs/faq.html');
const publicShopAccounts = read('cloudflare/frettrack-coming-soon/public/docs/shops-and-accounts.html');

assertMatches(migration, /create or replace function public\.bootstrap_current_user_as_owner\(\s*target_shop_id text,\s*target_shop_name text default null\s*\)/i, 'Bootstrap RPC must accept shop id and shop name.');
assertIncludes(migration, 'security definer', 'Bootstrap RPC must remain SECURITY DEFINER.');
assertIncludes(migration, "set search_path = ''", 'Bootstrap RPC must use an empty search path.');
assertIncludes(migration, 'current_user_id uuid := auth.uid();', 'Bootstrap RPC must bind to the authenticated caller.');
assertIncludes(migration, "raise exception 'Authentication required.'", 'Bootstrap RPC must reject unauthenticated calls.');
assertIncludes(migration, "raise exception 'Confirm your email before creating a shop workspace.'", 'Bootstrap RPC must require confirmed email.');
assertNotIncludes(migration, 'beta_access_requests', 'Self-service bootstrap must not require beta approval.');
assertIncludes(migration, 'pg_catalog.pg_advisory_xact_lock', 'Bootstrap RPC must serialize concurrent trial creation per account.');
assertIncludes(migration, "and role = 'owner'", 'Bootstrap RPC must prevent repeated trial workspace creation by one owner account.');
assertIncludes(migration, 'from public.shop_members', 'Bootstrap RPC must check existing shop members before claiming a shop id.');
assertIncludes(migration, 'from public.shop_profiles', 'Bootstrap RPC must check existing shop profiles before claiming a shop id.');
assertIncludes(migration, 'insert into public.shop_profiles', 'Bootstrap RPC must create the shop profile during bootstrap.');
assertIncludes(migration, 'insert into public.shop_subscriptions', 'Bootstrap RPC must ensure the default subscription exists during bootstrap.');
assertIncludes(migration, 'normalized_shop_id', 'Bootstrap subscription insert must use the normalized shop id.');
assertIncludes(migration, "'pro'", 'Bootstrap subscription insert must grant the standard Pro trial.');
assertIncludes(migration, "interval '14 days'", 'Bootstrap subscription insert must use the standard 14-day trial.');
assertIncludes(migration, "'trialing'", 'Bootstrap subscription insert must preserve the trialing status convention.');
assertIncludes(migration, 'on conflict (shop_id) do nothing', 'Bootstrap RPC must avoid duplicate subscription rows.');
assertIncludes(migration, 'insert into public.shop_members', 'Bootstrap RPC must still create owner membership.');
assertIncludes(migration, "'effective_member_access', true", 'Bootstrap response must mark owner access effective.');
assertIncludes(migration, "'profile', jsonb_build_object", 'Bootstrap response must include profile details.');
assertIncludes(migration, "'subscription', jsonb_build_object", 'Bootstrap response must include subscription details.');
assertIncludes(migration, 'revoke all on function public.bootstrap_current_user_as_owner(text, text) from public, anon, authenticated;', 'Bootstrap RPC must revoke default execute before granting intentionally.');
assertIncludes(migration, 'grant execute on function public.bootstrap_current_user_as_owner(text, text) to authenticated;', 'Bootstrap RPC must grant only authenticated execute.');
assertNotIncludes(migration.toLowerCase(), 'disable row level security', 'Bootstrap migration must not disable RLS.');
assertNotIncludes(migration.toLowerCase(), 'create policy', 'Bootstrap migration must not loosen RLS policies.');
assertNotIncludes(migration.toLowerCase(), 'service_role', 'Bootstrap migration must not mention service-role credentials.');

assertIncludes(membershipService, "supabase.rpc('bootstrap_current_user_as_owner'", 'Frontend bootstrap must use the server-side RPC.');
assertIncludes(membershipService, 'target_shop_id: shopId', 'Frontend bootstrap must pass the shop id.');
assertIncludes(membershipService, 'target_shop_name: shopName', 'Frontend bootstrap must pass the shop display name.');
assertNotIncludes(membershipService.toLowerCase(), 'service_role', 'Frontend membership service must not expose service-role credentials.');
assertNotIncludes(membershipService, ".from('shop_members')\n    .insert", 'Frontend must not insert bootstrap owner membership directly.');

assertIncludes(app, 'useSessionShopBootstrap({', 'App must delegate session and shop bootstrap coordination to its focused controller.');
assertIncludes(appBootstrap, "new URLSearchParams(window.location.search).get('signup') === '1'", 'The top-level unauthenticated gate must honor the public signup query.');
assertIncludes(appBootstrap, '<AuthGate initialMode={initialAuthMode}', 'The top-level unauthenticated gate must open account creation for signup links.');
assertIncludes(bootstrapController, 'async function loadShopAccess(preferredShopId = getSelectedShop().shopId, options = {})', 'Shop access loader must support rethrow for bootstrap verification.');
assertIncludes(bootstrapController, 'if (options.rethrow) {', 'Shop access loader must be able to fail bootstrap if real reload fails.');
assertIncludes(bootstrapController, 'async function handleBootstrapOwner()', 'Create Shop handler must exist.');
assertMatches(bootstrapController, /async function handleBootstrapOwner\(\)[\s\S]*?if \(isMembershipLoading\) \{\s*return;\s*\}/, 'Create Shop handler must block duplicate submit.');
assertIncludes(bootstrapController, 'await bootstrapCurrentUserAsOwner(shopId, shopNameValue);', 'Create Shop handler must pass the shop name to the RPC.');
assertIncludes(bootstrapController, 'await loadShopAccess(shopId, { rethrow: true });', 'Create Shop handler must reload real shop access after bootstrap.');
assertIncludes(bootstrapController, "setShopProfileLoadError(getErrorMessage(error, 'The shop profile could not be loaded.'));", 'Profile reload failures must remain available to a dedicated recovery screen.');
assertIncludes(bootstrapController, 'Your workspace was created, but its profile could not be loaded.', 'Post-create reload failures must not be reported as failed workspace creation.');
assertIncludes(app, 'Retry Workspace Load', 'A committed workspace with a failed profile reload must offer a dedicated retry action.');
assertIncludes(app, 'loadShopAccess(membership.shopId)', 'Workspace recovery must reload authoritative access without invoking shop creation again.');
assertNotIncludes(bootstrapController, 'getOrCreateBetaAccessRequest', 'Session bootstrap must not create a beta approval request.');
assertNotIncludes(bootstrapController, 'must approve your account access', 'Shop creation must not retain the beta approval blocker.');
assertNotIncludes(bootstrapController, 'const ownerMembership = await bootstrapCurrentUserAsOwner(shopId);', 'Create Shop handler must not use the old one-argument RPC call.');
assertNotIncludes(bootstrapController, 'setMembership(ownerShop);', 'Create Shop handler must not fake final membership state.');
assertNotIncludes(bootstrapController, 'setMemberships([ownerShop]);', 'Create Shop handler must not fake final memberships state.');
assertNotIncludes(bootstrapController, 'setEntitlementSnapshot(getDefaultEntitlementSnapshot(ownerShop.shopId));', 'Create Shop handler must not fake final entitlement state.');
assertNotIncludes(app.toLowerCase(), 'service_role', 'App must not expose service-role credentials.');
assertNotIncludes(bootstrapController.toLowerCase(), 'service_role', 'Bootstrap controller must not expose service-role credentials.');

assertIncludes(authGate, 'Create your account, confirm your email, and start a free 14-day Pro trial.', 'Sign-up must explain confirmation and the standard trial.');
assertIncludes(readme, 'https://app.frettrack-app.com/?signup=1', 'README access CTA must open self-service sign-up.');
assertNotIncludes(readme, 'Request FretTrack Access', 'README must not advertise the retired application flow.');
assertNotIncludes(readme, 'New approved workspaces', 'README must not imply manual workspace approval.');
assertIncludes(accountAccessDocs, 'No manual account approval is required.', 'Account docs must identify self-service registration as current.');
assertNotIncludes(accountAccessDocs, 'An operator approves or rejects the request', 'Account docs must not describe legacy approval as the current flow.');
assertNotIncludes(accountAccessDocs, 'approved access or operator status', 'Account docs must not retain the old bootstrap approval condition.');
assertIncludes(landingWorker, 'href="${APP_URL}/?signup=1">Start Free 14-Day Trial', 'Landing CTA must open self-service sign-up.');
assertNotIncludes(landingWorker, 'id="application-modal"', 'Landing page must not render the retired access application modal.');
assertIncludes(landingWorker, "env.LEGACY_ACCESS_APPLICATION_ENABLED !== 'true'", 'Legacy application submissions must fail closed unless explicitly enabled.');
assertIncludes(publicSupport, 'Retry Workspace Load', 'Public support must explain safe recovery after a committed workspace profile reload fails.');
for (const [label, publicCopy] of [
  ['support', publicSupport],
  ['FAQ', publicFaq],
  ['shop/account guide', publicShopAccounts]
]) {
  assertNotIncludes(publicCopy, 'email address approved for FretTrack access', `${label} copy must not imply manual email approval.`);
  assertNotIncludes(publicCopy, 'How do I request FretTrack access?', `${label} copy must describe account creation, not an access request.`);
}

console.log('Shop bootstrap reliability checks passed.');
