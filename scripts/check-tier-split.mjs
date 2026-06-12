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

for (const key of ['photo_editor', 'advanced_reporting', 'team_members']) {
  assertIncludes(entitlementService, `${key}: false`, `${key} must default to false.`);
  assertMatches(migration, new RegExp(`\\('free', '${key}', 'false'::jsonb\\)`, 'i'), `${key} must be false for Free.`);
  assertMatches(migration, new RegExp(`\\('pro', '${key}', 'true'::jsonb\\)`, 'i'), `${key} must be true for Pro.`);
}

for (const key of ['customer_portal', 'sms_messages', 'api_access', 'custom_branding', 'advanced_inventory_workflows', 'multi_location']) {
  assertMatches(migration, new RegExp(`\\('pro', '${key}', 'false'::jsonb\\)`, 'i'), `${key} must remain false for Pro Phase 1.`);
}

assertIncludes(entitlementService, "PHOTO_EDITOR: 'photo_editor'", 'Photo editor entitlement key must be centralized.');
assertIncludes(entitlementService, "TEAM_MEMBERS: 'team_members'", 'Team members entitlement key must be centralized.');
assertIncludes(entitlementService, 'canUsePhotoEditor(snapshot)', 'Photo editor helper must exist.');
assertIncludes(entitlementService, 'canManageTeamMembers(snapshot)', 'Team member helper must exist.');

assertIncludes(permissionService, 'canAccessShopAsMember', 'Effective membership helper must exist.');
assertIncludes(permissionService, 'canUsePhotoEditor({ role, entitlementSnapshot }', 'Photo editor permission helper must exist.');
assertIncludes(permissionService, 'hasPhotoEditorEntitlement(entitlementSnapshot)', 'Photo editing must require entitlement.');
assertIncludes(permissionService, 'hasTeamMembersEntitlement(entitlementSnapshot)', 'Team member management must require entitlement.');
assertIncludes(app, 'const canEditShopSettings = canManageShop && canWrite;', 'Shop settings edits must respect read-only lifecycle while billing remains viewable.');
assertIncludes(app, 'canManageShop={canEditShopSettings}', 'Shop settings should receive write-aware manage permission.');

assertIncludes(membershipService, "supabase.rpc('get_current_user_shop_memberships')", 'Membership loading must use effective-access RPC.');
assertIncludes(app, 'effectiveMemberAccess === false', 'App must detect locked memberships.');
assertIncludes(app, 'Shop Access Locked', 'Locked staff accounts must get a clear screen.');
assertIncludes(app, 'canManageTeamMembersForRole', 'App must derive team management permission centrally.');

assertIncludes(jobDetail, "message: 'Photo Editor is available on Pro.'", 'Photo editor launch must be guarded.');
assertIncludes(photoGallery, 'Photo Editor - Available on Pro', 'Photo gallery must show Pro lock state.');
assertIncludes(shopMembersPanel, 'Team Members - Available on Pro', 'Team member settings must show Pro lock state.');
assertIncludes(shopMembersPanel, 'canManageTeamMembers', 'Team member controls must use Pro gate.');

assertIncludes(migration, 'create or replace function private.shop_has_entitlement', 'Backend entitlement helper must exist.');
assertIncludes(migration, "role = 'owner'", 'Owner access must remain valid on Free.');
assertIncludes(migration, "or private.shop_has_entitlement(target_shop_id, 'team_members')", 'Staff access must require team_members.');
assertIncludes(migration, 'create or replace function private.can_access_job', 'Legacy child-record access helper must be replaced.');
assertIncludes(migration, 'and private.is_shop_member(jobs.shop_id)', 'Child-record access must use effective membership.');
assertIncludes(migration, 'private.shop_lifecycle_allows_write(shop_id)', 'Admin write policies must respect lifecycle write blocking.');
assertIncludes(migration, 'private.shop_lifecycle_allows_write((storage.foldername(name))[1])', 'Shop asset writes must respect lifecycle write blocking.');
assertIncludes(migration, 'drop policy if exists "parts_delete_admin"', 'Inventory admin deletes must be re-hardened.');
assertIncludes(migration, "raise exception 'Team member management is available on Pro.'", 'RPCs must reject Free team management.');
assertIncludes(migration, 'create or replace function public.get_current_user_shop_memberships()', 'Effective membership RPC must exist.');
assertIncludes(migration, "'canUsePhotoEditor'", 'Snapshot must expose photo editor access.');
assertIncludes(migration, "'canManageTeamMembers'", 'Snapshot must expose team member access.');
assertIncludes(migration, "if trial_expired then\n    effective_entitlements := entitlement_values;", 'Expired trials must ignore overrides and use Free entitlements.');
assertIncludes(migration, "effective_status := 'expired';\n    effective_tier := 'free';\n    entitlement_plan_id := 'free';", 'Expired Pro trials must resolve to Free.');

for (const [name, source] of [
  ['send-email', sendEmailFunction],
  ['send-sms', sendSmsFunction]
]) {
  assertIncludes(source, 'canUseShopWriteRole', `${name} must validate effective write-role access.`);
  assertIncludes(source, "return await shopHasTeamMembers(supabase, shopId);", `${name} must require team_members for staff roles.`);
  assertIncludes(source, "const planId = trialExpired ? 'free'", `${name} must resolve expired trials to Free.`);
  assertIncludes(source, 'if (trialExpired) {', `${name} must ignore overrides on expired trials.`);
  assertIncludes(source, "return !['read_only', 'canceled', 'cancelled'].includes(status);", `${name} must block explicit read-only/canceled lifecycle.`);
}

console.log('Free vs Pro tier split checks passed.');
