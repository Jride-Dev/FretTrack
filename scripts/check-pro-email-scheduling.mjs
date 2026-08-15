import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const includes = (source, expected, message) => assert.ok(source.includes(expected), message);

const migration = read('supabase/migrations/20260815095604_pro_email_scheduling_foundation.sql');
for (const plan of ['free', 'solo', 'shop', 'pro', 'enterprise', 'trial']) {
  includes(migration, `('${plan}', 'scheduled_email'`, `Migration must seed scheduled_email for ${plan}.`);
}
includes(migration, "('pro', 'scheduled_email', 'true'::jsonb)", 'Pro must receive scheduled_email.');
includes(migration, "('shop', 'scheduled_email', 'false'::jsonb)", 'Shop must not receive scheduled_email.');
includes(migration, 'add column if not exists scheduled_at timestamptz', 'Message history must snapshot scheduled time.');
includes(migration, 'add column if not exists canceled_at timestamptz', 'Message history must snapshot cancellation time.');
includes(migration, "status in ('sent', 'failed', 'scheduled', 'canceled')", 'Message states must include scheduled and canceled.');
includes(migration, "where status = 'scheduled'", 'Pending scheduled messages need a focused partial index.');
includes(migration, "status in ('sent', 'failed')", 'Authenticated message policies must reject forged provider states.');
assert.ok(!/pg_cron|cron\.schedule|net\.http_post/i.test(migration), 'Provider-managed scheduling must not add a duplicate cron dispatcher.');

const edge = read('supabase/functions/send-email/index.ts');
includes(edge, "action === 'cancel_scheduled'", 'Email function must expose scheduled-email cancellation.');
includes(edge, "{ scheduled_at: scheduledAt }", 'Resend request must receive the scheduled delivery timestamp.');
includes(edge, "template_key: message.templateKey || ''", 'Scheduled history must snapshot the selected template.');
includes(edge, "'Idempotency-Key': `frettrack-email/${quotaRequestId}`", 'Provider requests must carry an idempotency key.');
includes(edge, "shopHasEntitlement(createServiceClient(), access.shopId, 'scheduled_email')", 'The server must enforce the Pro entitlement.');
includes(edge, 'access.emailOptIn', 'Scheduled email must require customer email opt-in.');
includes(edge, 'MAX_SCHEDULE_LEAD_MS = 30 * 24 * 60 * 60 * 1000', 'The provider 30-day schedule limit must be enforced.');
includes(edge, "fetch(`https://api.resend.com/emails/${encodeURIComponent(message.provider_message_id)}/cancel`", 'Cancellation must target the stored provider message.');
includes(edge, ".eq('job_id', jobId)", 'Cancellation must remain scoped to the requested job.');
assert.ok(edge.indexOf('resolveJobWriteAccess(request, jobId)') < edge.indexOf("fetch('https://api.resend.com/emails'"), 'Write access must be checked before provider scheduling.');

const panel = read('src/modules/messaging/MessagesPanel.js');
includes(panel, 'Schedule Email', 'Messages panel must expose scheduled email.');
includes(panel, 'type="datetime-local"', 'Messages panel must collect delivery date and time.');
includes(panel, "action: 'cancel_scheduled'", 'Messages panel must support cancellation.');
includes(panel, 'Recipient, subject, and message are saved as a snapshot.', 'UI must explain scheduling snapshots.');
includes(panel, 'Email opt-in is required before scheduling', 'UI must enforce email consent.');
includes(panel, 'Scheduled with provider', 'History must describe provider-owned scheduled state accurately.');

const styles = read('src/styles.css');
assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.message-scheduling \{[\s\S]*grid-template-columns: 1fr;/, 'Small-screen scheduling controls must stack in one column.');

const templates = read('src/modules/messaging/messageTemplates.js');
includes(templates, 'drop_off_scheduled', 'Drop Off Scheduled template must exist.');
includes(templates, 'Your appointment is scheduled for {{appointment_datetime}}.', 'Drop-off template must include the scheduled appointment wording.');

const entitlements = read('src/modules/billing/entitlementService.js');
includes(entitlements, "SCHEDULED_EMAIL: 'scheduled_email'", 'Client entitlement model must define scheduled_email.');
includes(entitlements, 'canScheduleEmail: canWrite && Boolean(entitlements.email_messages) && Boolean(entitlements.scheduled_email)', 'Client access must combine write, email, and scheduling access.');

const rlsTest = read('supabase/tests/database/scheduled_email_foundation_rls.test.sql');
includes(rlsTest, 'authenticated clients cannot forge provider scheduling state', 'pgTAP must cover forged scheduled records.');
includes(rlsTest, 'Shop owner cannot read another shop scheduled messages', 'pgTAP must cover shop isolation.');
includes(rlsTest, 'historical message state remains unchanged', 'pgTAP must cover historical message stability.');

const proBrowserTest = read('tests/e2e/authenticated/pro-email-scheduling.spec.js');
includes(proBrowserTest, "selectOption('drop_off_scheduled')", 'Playwright must cover the Pro scheduling surface and drop-off template.');
const shopBrowserTest = read('tests/e2e/shop-authenticated/pro-email-scheduling-gate.spec.js');
includes(shopBrowserTest, 'Upgrade to Pro to schedule customer email.', 'Playwright must cover the Shop-plan scheduling gate.');

const packageJson = read('package.json');
includes(packageJson, '"check:pro-email-scheduling": "node scripts/check-pro-email-scheduling.mjs"', 'Package script must expose the focused validation.');

const documentation = read('docs/PRO_EMAIL_SCHEDULING.md');
includes(documentation, 'Provider schedule elapsed', 'Documentation must distinguish provider scheduling from confirmed delivery.');
includes(documentation, 'six-/twelve-month customer service reminders', 'Documentation must keep long-horizon reminders outside this transactional slice.');
includes(documentation, 'does not restore quota', 'Documentation must state cancellation quota behavior.');

console.log('Pro email scheduling checks passed.');
