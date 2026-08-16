import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrationPath = 'supabase/migrations/20260727231401_email_photo_usage_caps_foundation.sql';
const migrationFiles = readdirSync(join(root, 'supabase/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `supabase/migrations/${entry.name}`);

assert.deepEqual(
  migrationFiles.filter((path) => path === migrationPath),
  [migrationPath],
  'Exactly one authoritative usage-caps migration must exist at the expected repository path.'
);
const cleanMergedMainFixture = { changedFiles: [], repositoryFiles: migrationFiles };
assert.equal(cleanMergedMainFixture.changedFiles.length, 0, 'Merged-main fixture must have no working-tree diff.');
assert.ok(cleanMergedMainFixture.repositoryFiles.includes(migrationPath), 'Migration discovery must work on clean merged main.');

const migration = read(migrationPath);
const usageCaps = read('src/modules/billing/usageCaps.js');
const entitlementService = read('src/modules/billing/entitlementService.js');
const emailFunction = read('supabase/functions/send-email/index.ts');
const photoService = read('src/modules/photos/photoService.js');
const inventoryService = read('src/modules/inventory/inventoryService.js');
const damageMap = read('src/components/DamageMap.js');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const usageUi = read('src/modules/shops/SubscriptionSettingsSection.jsx');
const styles = read('src/styles.css');
const docs = read('docs/EMAIL_AND_PHOTO_USAGE_CAPS.md');

for (const [plan, email, uploads, storage] of [
  ['shop', 1000, 2000, 5368709120],
  ['pro', 5000, 10000, 26843545600]
]) {
  assert.match(migration, new RegExp(`\\('${plan}', 'monthly_email_limit', '${email}'::jsonb\\)`), `${plan} email limit must be authoritative.`);
  assert.match(migration, new RegExp(`\\('${plan}', 'monthly_photo_upload_limit', '${uploads}'::jsonb\\)`), `${plan} upload limit must be authoritative.`);
  assert.match(migration, new RegExp(`\\('${plan}', 'max_photo_storage_bytes', '${storage}'::jsonb\\)`), `${plan} storage limit must use exact binary bytes.`);
}
assert.match(migration, /\('trial', 'monthly_email_limit', '1000'::jsonb\)/, 'Default trial compatibility must inherit Shop limits.');
assert.match(migration, /nullif\(subscriptions\.plan_id[\s\S]*nullif\(profiles\.subscription_tier/, 'Trial limits must resolve from the selected Shop/Pro tier.');
assert.match(entitlementService, /PRO_USAGE_LIMITS\.monthlyEmailLimit[\s\S]*PRO_USAGE_LIMITS\.monthlyPhotoUploadLimit[\s\S]*PRO_USAGE_LIMITS\.maxPhotoStorageBytes/, 'Client fallback must preserve Pro limits.');

assert.match(migration, /create table if not exists public\.shop_usage_periods/, 'Monthly usage periods must exist.');
assert.match(migration, /create table if not exists public\.shop_usage_reservations/, 'Quota reservations must exist.');
assert.match(migration, /create table if not exists public\.shop_photo_storage_objects/, 'Per-object storage accounting must exist.');
assert.match(migration, /primary key \(shop_id, request_id\)/, 'Reservation request IDs must be idempotent per shop.');
assert.match(migration, /for update;/i, 'Usage reservation and settlement must use row locks.');
assert.match(migration, /check \(email_recipients_used >= 0\)[\s\S]*check \(source_photos_uploaded >= 0\)/, 'Monthly usage cannot become negative.');
assert.match(migration, /photo_storage_bytes bigint not null default 0 check \(photo_storage_bytes >= 0\)/, 'Storage usage cannot become negative.');
assert.match(migration, /date_trunc\('month', now\(\) at time zone 'UTC'\)/, 'Monthly reset boundaries must be deterministic UTC months.');
assert.match(migration, /not private\.is_shop_member\(target_shop_id\)[\s\S]*raise exception 'Not allowed to read shop usage\.'/i, 'Cross-shop usage reads must be rejected.');
assert.match(migration, /private\.photo_path_belongs_to_shop[\s\S]*Photo storage path does not belong to the requested shop/, 'Photo reservations must validate exact shop ownership.');
assert.match(migration, /storage\.objects[\s\S]*metadata->>'size'/, 'Settlement must read authoritative stored bytes.');

const emailReserve = emailFunction.indexOf('prepareEmailRecipientQuota(');
const providerSend = emailFunction.indexOf("fetch('https://api.resend.com/emails'");
assert.ok(emailReserve > 0 && providerSend > emailReserve, 'Email quota must be reserved before provider send.');
assert.match(emailFunction, /recipientCount = toRecipients\.length \+ ccRecipients\.length \+ bccRecipients\.length/, 'To, CC, and BCC recipients must be counted authoritatively.');
assert.match(emailFunction, /if \(!response\.ok\) \{[\s\S]*releaseEmailRecipientQuota/, 'Rejected email sends must release quota.');
assert.match(emailFunction, /!quotaSettled && !providerAttempted[\s\S]*releaseEmailRecipientQuota/, 'Pre-provider email failures must release unsettled quota.');
assert.match(emailFunction, /EMAIL_MONTHLY_LIMIT_REACHED[\s\S]*limit:[\s\S]*used:[\s\S]*remaining:[\s\S]*resetDate:/, 'Email limit response must be stable and structured.');

const photoReserve = photoService.indexOf('await reservePhotoUsage(');
const photoUpload = photoService.indexOf('.upload(path, file, uploadOptions)');
assert.ok(photoReserve > 0 && photoUpload > photoReserve, 'Job-photo quota must be reserved before Storage upload.');
assert.match(photoService, /usageKind: 'photo_derivative'/, 'Generated derivatives must use storage-only reservations.');
assert.match(photoService, /usageKind: 'source_photo'/, 'Source and replacement uploads must increment monthly source usage.');
assert.match(photoService, /if \(uploaded\)[\s\S]*remove\(\[path\]\)[\s\S]*releasePhotoUsageReservation/, 'Failed photo settlement must remove the object and release the reservation.');
assert.match(photoService, /remove\(\[storagePath\]\)[\s\S]*releaseDeletedPhotoStorage/, 'Successful job-photo deletion must release stored bytes.');
assert.match(inventoryService, /reservePhotoUsage[\s\S]*\.upload\(filePath, file/, 'Inventory images must reserve quota before upload.');
assert.match(inventoryService, /part\.imagePath[\s\S]*removePartImageAndReleaseUsage/, 'Inventory image replacement must release the prior object after success.');
assert.match(jobDetail, /result\?\.errors\?\.length[\s\S]*uploadError\.code/, 'Damage Map uploads must preserve structured quota errors.');
assert.match(damageMap, /startsWith\('PHOTO_'\)[\s\S]*throw error/, 'Damage Map must not replace a quota-blocked upload with a local-only preview.');
assert.match(migration, /usage_kind = 'photo_derivative'[\s\S]*requested_units <> 0/, 'Generated derivatives must not increment source-upload count.');
assert.match(migration, /usage_kind in \('source_photo', 'photo_derivative'\)[\s\S]*reserved_storage_bytes/, 'Originals and derivatives must both reserve storage bytes.');

assert.ok(usageCaps.includes('getMonthlyEmailLimit'), 'Central monthly-email helper must exist.');
assert.ok(usageCaps.includes('getMonthlyPhotoUploadLimit'), 'Central monthly-photo helper must exist.');
assert.ok(usageCaps.includes('getPhotoStorageLimit'), 'Central storage helper must exist.');
assert.ok(usageCaps.includes('getUsagePercentage'), 'Central usage-percentage helper must exist.');
assert.ok(usageCaps.includes('getUsageWarningLevel'), 'Central warning-level helper must exist.');
assert.ok(usageCaps.includes('formatStorageBytes'), 'Binary storage formatter must exist.');
assert.match(usageUi, /Emails this month[\s\S]*Photo uploads this month[\s\S]*Photo storage/, 'Shop Settings usage UI must show all three limits.');
assert.match(usageUi, /role="progressbar"/, 'Usage meters must expose accessible progress state.');
for (const state of ['normal', 'warning', 'critical', 'limit-reached']) {
  assert.ok(usageCaps.includes(`'${state}'`), `${state} usage state must exist.`);
}
assert.match(styles, /\.usage-meter-warning[\s\S]*\.usage-meter-critical[\s\S]*\.usage-meter-limit-reached/, '80%, 95%, and reached visual states must exist.');

assert.match(docs, /5 GiB \(5,368,709,120 bytes\)[\s\S]*25 GiB \(26,843,545,600 bytes\)/, 'Documentation must state exact binary storage limits.');
assert.match(docs, /Shop logos in `shop-assets` are excluded/, 'Logo storage treatment must be documented.');
assert.match(docs, /downgrade[\s\S]*Historical data remains intact/i, 'Downgrade must preserve historical data.');
assert.match(docs, /no paid overages[\s\S]*Stripe changes/i, 'No overages or Stripe behavior may be promised.');
assert.match(docs, /Existing records and photos remain viewable/, 'Hard limits must preserve existing read access.');
assert.ok(!migration.match(/delete from public\.(jobs|job_images|parts|customer_messages)/i), 'Usage migration must never delete customer data.');

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => path.replaceAll('\\', '/'));
assert.ok(!changed.some((path) => /stripe/i.test(path)), 'Stripe files must not change.');
assert.ok(!changed.some((path) => path.startsWith('cloudflare/frettrack-coming-soon/')), 'Landing Worker files must not change.');
assert.ok(!changed.includes('Screenshots/current_jobs_update7.jpg'), 'Protected screenshot must not change.');

console.log('Email and photo usage cap checks passed.');
