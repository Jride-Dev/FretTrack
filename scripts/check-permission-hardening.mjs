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

function functionBody(sql, name) {
  const pattern = new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\r?\\nend;\\r?\\n\\$\\$;`, 'i');
  const match = sql.match(pattern);
  assert.ok(match, `Missing SQL function ${name}`);
  return match[0];
}

const permissionService = read('src/modules/auth/permissionService.js');
const app = read('src/app/App.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const imagesSection = read('src/modules/jobs/ImagesSection.js');
const photoGallery = read('src/modules/photos/PhotoGallery.jsx');
const operatorDashboard = read('src/modules/operator/BetaOperatorDashboard.jsx');
const migration = read('supabase/migrations/20260611120000_premium_trial_management_phase_1.sql');
const paidLifecycleMigration = read('supabase/migrations/20260616034902_paid_access_lifecycle_phase_1.sql');

assertIncludes(permissionService, "const SHOP_WRITE_ROLES = new Set(['owner', 'admin', 'tech']);", 'Write roles must stay owner/admin/tech.');
assertIncludes(permissionService, "const SHOP_MANAGE_ROLES = new Set(['owner', 'admin']);", 'Shop settings roles must stay owner/admin.');
assertIncludes(permissionService, 'return Boolean(isOperator);', 'Operator helpers must use verified operator state only.');
assertIncludes(permissionService, 'canUseAdvancedReporting(entitlementSnapshot)', 'Advanced reporting must use entitlement checks.');

assertIncludes(app, "return canAccessOperatorDashboard({ isOperator });", 'Workspace restore must use operator helper.');
assertIncludes(app, "mode === 'operator' && canAccessOperatorDashboard({ isOperator })", 'Operator route render must use operator helper.');
assertIncludes(app, 'canUploadPhotosForRole({ role: membership?.role, entitlementSnapshot: billingAccess })', 'Photo upload permission must use permission service.');
assertIncludes(app, 'canOverwritePhotosForRole({ role: membership?.role, entitlementSnapshot: billingAccess })', 'Photo overwrite permission must use permission service.');
assertIncludes(app, '<InternalCurrentAccessPanel', 'Internal access panel should be wired into app shell.');
assertIncludes(app, 'if (!canAccessOperatorDashboard({ isOperator }))', 'Internal access panel must be operator-only.');

assertIncludes(jobDetail, 'canUploadPhotos = canWrite', 'JobDetail should accept upload permission.');
assertIncludes(jobDetail, 'canEditPhotos = canWrite', 'JobDetail should accept edit permission.');
assertIncludes(jobDetail, 'canOverwritePhotos = canWrite', 'JobDetail should accept overwrite permission.');
assertIncludes(jobDetail, 'canDeletePhotos = canWrite', 'JobDetail should accept delete permission.');
assertIncludes(jobDetail, 'if (!canUploadPhotos)', 'Photo upload handler must enforce upload permission.');
assertIncludes(jobDetail, 'if (!canDeletePhotos)', 'Photo delete handler must enforce delete permission.');
assertIncludes(jobDetail, 'if (!canEditPhotos)', 'Photo edit save must enforce edit permission.');
assertIncludes(jobDetail, 'if (!canOverwritePhotos)', 'Photo overwrite must enforce overwrite permission.');

assertIncludes(imagesSection, 'canUploadPhotos = canWrite', 'ImagesSection must accept granular upload permission.');
assertIncludes(imagesSection, 'canEditPhotos = canWrite', 'ImagesSection must accept granular edit permission.');
assertIncludes(imagesSection, 'canDeletePhotos = canWrite', 'ImagesSection must accept granular delete permission.');
assertIncludes(photoGallery, 'canToggleCustomerReport = true', 'PhotoGallery must make report toggles explicit.');
assertIncludes(photoGallery, '{canToggleCustomerReport && (', 'Customer report photo toggles must be guarded.');
assertIncludes(photoGallery, '{canDelete && (', 'Photo delete button must be guarded.');
assertIncludes(photoGallery, '{canEdit && (', 'Photo edit button must be guarded.');

assertIncludes(operatorDashboard, "onClick={() => onStartPremiumTrial(shop, days, tier)}", 'Operator UI should start scoped Shop or Pro trials.');
assertIncludes(operatorDashboard, 'End premium trial', 'Operator UI should include end premium trial control.');

for (const name of ['set_shop_premium_trial', 'extend_shop_premium_trial', 'end_shop_premium_trial']) {
  const body = functionBody(migration, name);
  assertIncludes(body, 'security definer', `${name} must be SECURITY DEFINER.`);
  assertMatches(body, /set search_path = public/i, `${name} must set a safe search_path.`);
  assertIncludes(body, 'if not private.is_operator() then', `${name} must check private.is_operator().`);
  assertMatches(migration, new RegExp(`revoke all on function public\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*? from public, anon;`, 'i'), `${name} must revoke public/anon.`);
  assertMatches(migration, new RegExp(`grant execute on function public\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*? to authenticated;`, 'i'), `${name} must grant authenticated execution only.`);
}

const legacyBetaUpdate = functionBody(migration, 'update_beta_shop_subscription');
const paidLegacyBetaUpdate = functionBody(paidLifecycleMigration, 'update_beta_shop_subscription');
assertIncludes(legacyBetaUpdate, 'if not private.is_operator() then', 'Legacy beta subscription RPC must remain operator-only.');
assertIncludes(legacyBetaUpdate, 'extend_trial_days not in (7, 14, 30)', 'Legacy beta subscription RPC must not allow arbitrary trial extension days.');
assertIncludes(paidLegacyBetaUpdate, "if resolved_tier not in ('shop', 'pro') then", 'Legacy beta subscription RPC must not bypass Shop/Pro premium trial rules.');
assertIncludes(legacyBetaUpdate, 'update public.shop_profiles', 'Legacy beta subscription RPC should keep mirror fields synchronized.');

const setTrial = functionBody(paidLifecycleMigration, 'set_shop_premium_trial');
assertIncludes(setTrial, 'if trial_days not in (7, 14, 30) then', 'Start trial must restrict days to 7/14/30.');
assertIncludes(setTrial, "if normalized_tier not in ('shop', 'pro') then", 'Start trial must restrict tier to Shop or Pro.');
assertIncludes(setTrial, "raise exception 'Shop not found.';", 'Start trial must reject missing shops.');
assertIncludes(setTrial, 'insert into public.shop_subscriptions', 'Start trial must update authoritative subscription.');
assertIncludes(setTrial, 'update public.shop_profiles', 'Start trial must update mirror profile fields.');
assertIncludes(setTrial, "subscription_status = 'trialing'", 'Start trial must mirror trialing status.');

const extendTrial = functionBody(paidLifecycleMigration, 'extend_shop_premium_trial');
assertIncludes(extendTrial, 'if extend_days not in (7, 14, 30) then', 'Extend trial must restrict days to 7/14/30.');
assertIncludes(extendTrial, "if resolved_tier not in ('shop', 'pro') then", 'Extend trial must restrict current trial tier to Shop or Pro.');
assertIncludes(extendTrial, 'greatest(coalesce(current_subscription.trial_ends_at, now()), now())', 'Extend trial must extend from max(existing end, now).');
assertIncludes(extendTrial, "raise exception 'Shop subscription not found.';", 'Extend trial must reject missing subscriptions.');
assertIncludes(extendTrial, 'update public.shop_subscriptions', 'Extend trial must update authoritative subscription.');
assertIncludes(extendTrial, 'update public.shop_profiles', 'Extend trial must update mirror profile fields.');

const endTrial = functionBody(paidLifecycleMigration, 'end_shop_premium_trial');
assertIncludes(endTrial, "status = 'expired'", 'End trial must mark lifecycle expired.');
assertIncludes(endTrial, "subscription_status = 'expired'", 'End trial must mirror expired status.');
assertIncludes(endTrial, 'resolved_tier', 'End trial must preserve a useful stored tier.');
assertIncludes(endTrial, 'grace_ends_at = null', 'End trial must clear grace end.');

const snapshot = functionBody(paidLifecycleMigration, 'get_shop_entitlement_snapshot');
assertIncludes(snapshot, 'if not private.is_shop_member(target_shop_id) and not private.is_operator() then', 'Snapshot must be shop-member or operator scoped.');
assertIncludes(snapshot, "effective_status := 'expired';", 'Expired premium trial should have expired effective status.');
assertIncludes(snapshot, "effective_tier := stored_tier;", 'Expired premium trial should preserve stored tier.');
assertIncludes(snapshot, "entitlement_plan_id := 'free';", 'Expired premium trial should use internal compatibility entitlements.');
assertIncludes(snapshot, 'if trial_expired then', 'Expired premium trial should have explicit entitlement handling.');
assertIncludes(snapshot, 'effective_entitlements := entitlement_values;', 'Expired premium trial should ignore overrides and use compatibility entitlements only.');
assertIncludes(snapshot, "can_write := effective_status not in ('read_only', 'canceled', 'cancelled', 'expired');", 'Expired premium trial must block writes.');
assertIncludes(snapshot, "stored_status in ('read_only', 'canceled', 'cancelled')", 'Explicit administrative read-only/canceled states must remain blocking states.');

console.log('Permission hardening checks passed.');
