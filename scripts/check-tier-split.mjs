import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message || `Expected source to include: ${expected}`);
}

function assertMatches(source, pattern, message) {
  assert.ok(pattern.test(source), message || `Expected source to match: ${pattern}`);
}

const entitlementService = read('src/modules/billing/entitlementService.js');
const permissionService = read('src/modules/auth/permissionService.js');
const app = read('src/app/App.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const photoGallery = read('src/modules/photos/PhotoGallery.jsx');
const shopMembersPanel = read('src/modules/shops/ShopMembersPanel.jsx');
const membershipService = read('src/modules/shops/shopMembershipService.js');
const sendEmailFunction = read('supabase/functions/send-email/index.ts');
const sendSmsFunction = read('supabase/functions/send-sms/index.ts');
const migration = read('supabase/migrations/20260611133000_free_pro_tier_split_phase_1.sql');
const bootstrapMigration = read('supabase/migrations/20260612043000_verified_shop_bootstrap_rpc.sql');
const shopTierMigration = read('supabase/migrations/20260612233321_shop_tier_foundation_phase_1.sql');
const paidLifecycleMigration = read('supabase/migrations/20260616034902_paid_access_lifecycle_phase_1.sql');
const liveDemoPolishMigration = read('supabase/migrations/20260629155417_live_demo_bug_polish_phase_1.sql');
const tierMigrations = `${migration}\n${shopTierMigration}\n${paidLifecycleMigration}\n${liveDemoPolishMigration}`;

assertIncludes(entitlementService, "SHOP: 'shop'", 'Shop tier key must be centralized.');
assertIncludes(
  entitlementService,
  'CURRENT_SUBSCRIPTION_TIER_ORDER',
  'Current tier ladder must be explicit.'
);
assertIncludes(
  entitlementService,
  'SUBSCRIPTION_TIERS.SHOP',
  'Shop tier must be included in current entitlement groups.'
);
assertIncludes(entitlementService, "ENTERPRISE: 'enterprise'", 'Enterprise compatibility key must remain normalized.');
assertIncludes(entitlementService, "[SUBSCRIPTION_TIERS.ENTERPRISE]: 'Enterprise'", 'Enterprise compatibility label must remain safe.');
assertMatches(entitlementService, /\[SUBSCRIPTION_TIERS\.SOLO\]: \{\r?\n\s+\.\.\.defaultEntitlements/, 'Legacy Solo must fall back to Free-equivalent frontend defaults.');
assertIncludes(entitlementService, "[SUBSCRIPTION_TIERS.SOLO]: 'Legacy trial'", 'Legacy Solo must not be marketed as Free.');
assertMatches(entitlementService, /\[SUBSCRIPTION_TIERS\.SHOP\]: \{\r?\n\s+max_users: 1/, 'Shop must remain a single-user core workflow tier in frontend defaults.');
assertMatches(entitlementService, /\[SUBSCRIPTION_TIERS\.PRO\]: \{\r?\n\s+photo_editor: true,\r?\n\s+advanced_reporting: true,\r?\n\s+team_members: true/, 'Pro must unlock Photo Editor, Advanced Reporting, and Team Members in frontend defaults.');

for (const key of ['photo_editor', 'advanced_reporting', 'team_members']) {
  assertIncludes(entitlementService, `${key}: false`, `${key} must default to false.`);
  assertMatches(tierMigrations, new RegExp(`\\('free', '${key}', 'false'::jsonb\\)`, 'i'), `${key} must be false for Free.`);
  assertMatches(tierMigrations, new RegExp(`\\('pro', '${key}', 'true'::jsonb\\)`, 'i'), `${key} must be true for Pro.`);
}

assertMatches(liveDemoPolishMigration, /\('shop', 'photo_editor', 'false'::jsonb\)/i, 'Photo Editor must be false for Shop in current entitlements.');
assertMatches(liveDemoPolishMigration, /\('shop', 'team_members', 'false'::jsonb\)/i, 'Team Members must be false for Shop in current entitlements.');
assertMatches(liveDemoPolishMigration, /\('shop', 'advanced_reporting', 'false'::jsonb\)/i, 'Advanced Reporting must remain false for Shop.');
assertMatches(liveDemoPolishMigration, /\('shop', 'max_users', '1'::jsonb\)/i, 'Shop must not advertise multiple users.');
assertMatches(shopTierMigration, /\('solo', 'photo_editor', 'false'::jsonb\)/i, 'Legacy Solo must not unlock Photo Editor.');
assertMatches(shopTierMigration, /\('solo', 'team_members', 'false'::jsonb\)/i, 'Legacy Solo must not unlock Team Members.');
assertMatches(shopTierMigration, /\('solo', 'advanced_reporting', 'false'::jsonb\)/i, 'Legacy Solo must not unlock Advanced Reporting.');
assertMatches(shopTierMigration, /subscription_tier in \('free', 'solo', 'shop', 'pro', 'enterprise'\)/i, 'Shop profile tier constraint must allow Shop.');
assertIncludes(shopTierMigration, "stored_tier in ('free', 'solo', 'shop', 'pro', 'enterprise', 'trial')", 'Entitlement helper must resolve Shop.');
assertIncludes(shopTierMigration, "effective_tier not in ('free', 'solo', 'shop', 'pro', 'enterprise')", 'Snapshot effective tier allow-list must include Shop.');
assertIncludes(shopTierMigration, "entitlement_plan_id not in ('free', 'solo', 'shop', 'pro', 'enterprise', 'trial')", 'Snapshot entitlement plan allow-list must include Shop.');
assert.ok(!/\('enterprise',\s*'[^']+'/i.test(shopTierMigration), 'Shop tier migration must not seed new Enterprise entitlements.');
assertIncludes(paidLifecycleMigration, "when trial_expired then 'free'", 'Expired trials must use internal free compatibility entitlements.');
assertMatches(paidLifecycleMigration, /effective_status := 'expired';\r?\n\s+effective_tier := stored_tier;\r?\n\s+entitlement_plan_id := 'free';/, 'Expired trials must preserve stored tier while using internal compatibility entitlements.');
assertIncludes(paidLifecycleMigration, "can_write := effective_status not in ('read_only', 'canceled', 'cancelled', 'expired');", 'Expired trials must block writes.');
assertIncludes(paidLifecycleMigration, "if normalized_tier not in ('shop', 'pro') then", 'Operator trial start must allow Shop or Pro only.');
assertIncludes(paidLifecycleMigration, "if resolved_tier not in ('shop', 'pro') then", 'Operator trial extension must allow existing Shop or Pro trials only.');
assertIncludes(paidLifecycleMigration, "status = 'expired'", 'Ending a trial must create an expired lifecycle.');

for (const key of ['customer_portal', 'sms_messages', 'api_access', 'custom_branding', 'advanced_inventory_workflows', 'multi_location']) {
  assertMatches(tierMigrations, new RegExp(`\\('pro', '${key}', 'false'::jsonb\\)`, 'i'), `${key} must remain false for Pro Phase 1.`);
  assertMatches(shopTierMigration, new RegExp(`\\('shop', '${key}', 'false'::jsonb\\)`, 'i'), `${key} must remain false for Shop Phase 1.`);
}

assertIncludes(entitlementService, "PHOTO_EDITOR: 'photo_editor'", 'Photo editor entitlement key must be centralized.');
assertIncludes(entitlementService, "TEAM_MEMBERS: 'team_members'", 'Team members entitlement key must be centralized.');
assertIncludes(entitlementService, 'canUsePhotoEditor(snapshot)', 'Photo editor helper must exist.');
assertIncludes(entitlementService, 'canManageTeamMembers(snapshot)', 'Team member helper must exist.');

assertIncludes(permissionService, 'canAccessShopAsMember', 'Effective membership helper must exist.');
assertIncludes(permissionService, 'canUsePhotoEditor({ role, entitlementSnapshot }', 'Photo editor permission helper must exist.');
assertIncludes(permissionService, 'hasPhotoEditorEntitlement(entitlementSnapshot)', 'Photo editing must require entitlement.');
assertIncludes(permissionService, 'return canUploadPhotos({ role, entitlementSnapshot }) && hasPhotoEditorEntitlement(entitlementSnapshot);', 'Photo editor must require writable photo access and entitlement.');
assertIncludes(permissionService, 'hasTeamMembersEntitlement(entitlementSnapshot)', 'Team member management must require entitlement.');
assertIncludes(permissionService, 'return canWriteShop({ role, entitlementSnapshot })', 'Team member management must require writable shop access.');
assertIncludes(app, 'const canEditShopSettings = canManageShop && canWrite;', 'Shop settings edits must respect read-only lifecycle while billing remains viewable.');
assertIncludes(app, 'canManageShop={canEditShopSettings}', 'Shop settings should receive write-aware manage permission.');

assertIncludes(membershipService, "supabase.rpc('get_current_user_shop_memberships')", 'Membership loading must use effective-access RPC.');
assertIncludes(membershipService, "supabase.rpc('bootstrap_current_user_as_owner'", 'Shop bootstrap must use server-side RPC.');
assertIncludes(app, 'effectiveMemberAccess === false', 'App must detect locked memberships.');
assertIncludes(app, 'Shop Access Locked', 'Locked staff accounts must get a clear screen.');
assertIncludes(app, 'canManageTeamMembersForRole', 'App must derive team management permission centrally.');

assertIncludes(jobDetail, "message: 'Photo Editor is available in Pro.'", 'Photo editor launch must be guarded with Pro wording.');
assertIncludes(photoGallery, 'Photo Editor - Available in Pro', 'Photo gallery must show Pro lock state.');
assertIncludes(shopMembersPanel, 'Team Members - Available in Pro', 'Team member settings must show Pro lock state.');
assertIncludes(shopMembersPanel, 'canManageTeamMembers', 'Team member controls must use the entitlement gate.');

assertIncludes(migration, 'create or replace function private.shop_has_entitlement', 'Backend entitlement helper must exist.');
assertIncludes(migration, "role = 'owner'", 'Owner access must remain valid on Free.');
assertIncludes(migration, "or private.shop_has_entitlement(target_shop_id, 'team_members')", 'Staff access must require team_members.');
assertIncludes(migration, 'create or replace function private.can_access_job', 'Legacy child-record access helper must be replaced.');
assertIncludes(migration, 'and private.is_shop_member(jobs.shop_id)', 'Child-record access must use effective membership.');
assertIncludes(migration, 'private.shop_lifecycle_allows_write(shop_id)', 'Admin write policies must respect lifecycle write blocking.');
assertIncludes(migration, 'private.shop_lifecycle_allows_write((storage.foldername(name))[1])', 'Shop asset writes must respect lifecycle write blocking.');
assertIncludes(migration, 'drop policy if exists "parts_delete_admin"', 'Inventory admin deletes must be re-hardened.');
assertIncludes(liveDemoPolishMigration, "raise exception 'Team member management is available in Pro.'", 'RPCs must reject non-Pro team management with current Pro wording.');
assertIncludes(migration, 'create or replace function public.get_current_user_shop_memberships()', 'Effective membership RPC must exist.');
assertIncludes(bootstrapMigration, 'create or replace function public.bootstrap_current_user_as_owner(target_shop_id text)', 'Shop bootstrap RPC must exist.');
assertIncludes(bootstrapMigration, "raise exception 'Confirm your email before creating a shop workspace.'", 'Shop bootstrap must require confirmed email.');
assertIncludes(bootstrapMigration, "and status = 'approved'", 'Shop bootstrap must require approved beta access.');
assertIncludes(migration, "'canUsePhotoEditor'", 'Snapshot must expose photo editor access.');
assertIncludes(migration, "'canManageTeamMembers'", 'Snapshot must expose team member access.');
assertMatches(tierMigrations, /if trial_expired then\r?\n\s+effective_entitlements := entitlement_values;/, 'Expired trials must ignore overrides and use compatibility entitlements.');
assertMatches(paidLifecycleMigration, /effective_status := 'expired';\r?\n\s+effective_tier := stored_tier;\r?\n\s+entitlement_plan_id := 'free';/, 'Expired trials must preserve stored tier without premium access.');

for (const [name, source] of [
  ['send-email', sendEmailFunction],
  ['send-sms', sendSmsFunction]
]) {
  assertIncludes(source, 'canUseShopWriteRole', `${name} must validate effective write-role access.`);
  assertIncludes(source, "return await shopHasTeamMembers(supabase, shopId);", `${name} must require team_members for staff roles.`);
  assertIncludes(source, "const planId = trialExpired ? 'free'", `${name} must resolve expired trials to internal compatibility entitlements.`);
  assertIncludes(source, 'if (trialExpired) {', `${name} must ignore overrides on expired trials.`);
  assertMatches(source, /if \(trialExpired\) \{\r?\n\s+return false;/, `${name} must block expired trial writes.`);
  assertIncludes(source, "return !['read_only', 'canceled', 'cancelled'].includes(status);", `${name} must block explicit read-only/canceled lifecycle.`);
}

for (const [name, source] of [
  ['README.md', read('README.md')],
  ['ROADMAP.md', read('ROADMAP.md')],
  ['docs/PRICING_AND_TIERS.md', read('docs/PRICING_AND_TIERS.md')],
  ['docs/SUBSCRIPTION_FOUNDATION.md', read('docs/SUBSCRIPTION_FOUNDATION.md')],
  ['docs/TRIAL_READINESS.md', read('docs/TRIAL_READINESS.md')]
]) {
  assert.ok(!/Free \/ Shop \/ Pro|permanent public Free|Free shops|Free remains operational|writable Free-tier/i.test(source), `${name} must not market Free as a public plan.`);
}

console.log('Trial, Shop, and Pro tier split checks passed.');
