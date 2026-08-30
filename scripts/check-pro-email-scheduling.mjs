import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const includes = (source, expected, message) => assert.ok(source.includes(expected), message);

const migration = read('supabase/migrations/20260815095604_pro_email_scheduling_foundation.sql');
const hardeningMigration = read('supabase/migrations/20260816004706_harden_email_provider_consistency.sql');
const terminalStateMigration = read('supabase/migrations/20260816032817_guard_email_provider_terminal_state.sql');
const requestHelpers = read('supabase/functions/send-email/requestHelpers.ts');
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
const providerReconciliation = read('supabase/functions/send-email/providerReconciliation.ts');
const providerReconciliationTest = read('supabase/functions/send-email/providerReconciliation.test.ts');
includes(edge, "action === 'cancel_scheduled'", 'Email function must expose scheduled-email cancellation.');
includes(edge, "{ scheduled_at: scheduledAt }", 'Resend request must receive the scheduled delivery timestamp.');
includes(edge, "template_key: message.templateKey || ''", 'Scheduled history must snapshot the selected template.');
includes(edge, "'Idempotency-Key': `frettrack-email/${operationMessage.request_id}`", 'Provider requests must reuse the durable message request ID.');
includes(edge, "shopHasEntitlement(createServiceClient(), access.shopId, 'scheduled_email')", 'The server must enforce the Pro entitlement.');
includes(edge, 'access.emailOptIn', 'Scheduled email must require customer email opt-in.');
includes(edge, "fetch(`https://api.resend.com/emails/${encodeURIComponent(cancelingMessage.provider_message_id)}/cancel`", 'Cancellation must target the stored provider message.');
includes(edge, ".eq('job_id', jobId)", 'Cancellation must remain scoped to the requested job.');
const initialAccessCheck = edge.indexOf('const access = await resolveEmailProviderAccess(request, jobId');
const quotaReservation = edge.indexOf('const quota = await prepareEmailRecipientQuota(');
const finalAccessCheck = edge.indexOf('const finalAccess = await resolveEmailProviderAccess(request, jobId');
const providerRequest = edge.indexOf("response = await fetch('https://api.resend.com/emails'");
assert.ok(initialAccessCheck >= 0 && initialAccessCheck < quotaReservation, 'Write access must be checked before quota reservation.');
assert.ok(quotaReservation < finalAccessCheck && finalAccessCheck < providerRequest, 'Write access and scheduling entitlement must be refreshed after quota reservation and immediately before the provider request.');
assert.match(edge, /if \(finalAccess\.error && !quotaSettled\) \{[\s\S]*?releaseEmailRecipientQuota\(access\.shopId, quotaRequestId\)[\s\S]*?return finalAccess\.error;/, 'A failed final access check must release unsettled quota before returning.');
includes(edge, 'expectedShopId: access.shopId', 'The final access check must reject a work order that moved to another shop.');
includes(edge, 'claimEmailOperation({', 'Message history must be claimed before the provider request.');
assert.ok(edge.indexOf('claimEmailOperation({') < providerRequest, 'A durable history row must exist before Resend is called.');
includes(edge, "code: 'EMAIL_HISTORY_RECONCILIATION_REQUIRED'", 'Post-acceptance history failures must be explicit and retryable.');
includes(edge, "code: 'EMAIL_PROVIDER_CONFIRMATION_PENDING'", 'Ambiguous provider transport outcomes must preserve the same retry operation.');
includes(edge, "action === 'reconcile_scheduled'", 'Elapsed scheduled messages must expose provider reconciliation.');
includes(edge, "method: 'GET'", 'Provider reconciliation must retrieve authoritative Resend state.');
includes(edge, "status: 'canceling'", 'Cancellation intent must be durable before the provider call.');
includes(edge, 'buildProviderReconciliationPatch({', 'Provider reconciliation must use the tested terminal-state mapper.');
includes(edge, ".rpc('reconcile_customer_email_provider_state'", 'Provider reconciliation must use the atomic database transition.');
includes(requestHelpers, 'MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000', 'Scheduled email must still enforce the minimum lead time.');
includes(requestHelpers, 'MAX_SCHEDULE_LEAD_MS = 30 * 24 * 60 * 60 * 1000', 'The provider 30-day schedule limit must be enforced.');
includes(providerReconciliation, "new Set(['canceled', 'cancel_accepted'])", 'Provider terminal cancellation events must finalize Message History.');
assert.ok(providerReconciliation.indexOf('sentEvents.has(normalizedEvent)') < providerReconciliation.indexOf('canceledEvents.has(normalizedEvent)'), 'Sent provider events must retain precedence over cancellation finalization.');
includes(providerReconciliationTest, "for (const lastEvent of ['canceled', 'cancel_accepted'])", 'Executable coverage must include each supported terminal cancellation event.');
includes(providerReconciliationTest, "lastEvent: 'delivered'", 'Executable coverage must prove an already-sent message is never marked canceled.');

for (const column of ['request_id uuid', 'quota_request_id uuid', 'operation_key text', 'processing_started_at timestamptz', 'cancel_requested_at timestamptz', 'provider_last_event text']) {
  includes(hardeningMigration, column, `Hardening migration must add ${column}.`);
}
includes(hardeningMigration, "status in ('pending', 'sent', 'failed', 'scheduled', 'canceling', 'canceled')", 'Message states must represent provider and cancellation uncertainty.');
includes(hardeningMigration, 'customer_messages_email_request_id_uidx', 'History request IDs must be unique.');
includes(hardeningMigration, 'customer_messages_scheduled_operation_uidx', 'Concurrent identical schedules must be unique.');
includes(hardeningMigration, 'and request_id is null', 'Authenticated writers must not forge provider operation IDs.');
includes(terminalStateMigration, "stored_message.status = 'sent'", 'A recorded delivery must be irreversible during reconciliation.');
includes(terminalStateMigration, 'p_provider_event_at < stored_message.provider_event_at', 'Older provider observations must not replace newer state.');
includes(terminalStateMigration, 'for update', 'Provider reconciliation must serialize concurrent transitions on the message row.');
includes(terminalStateMigration, 'to service_role', 'Only the service role may invoke provider reconciliation.');

const panel = read('src/modules/messaging/MessagesPanel.js');
includes(panel, 'Schedule Email', 'Messages panel must expose scheduled email.');
includes(panel, 'type="datetime-local"', 'Messages panel must collect delivery date and time.');
includes(panel, "action: 'cancel_scheduled'", 'Messages panel must support cancellation.');
includes(panel, 'Recipient, subject, and message are saved as a snapshot.', 'UI must explain scheduling snapshots.');
includes(panel, 'Email opt-in is required before scheduling', 'UI must enforce email consent.');
includes(panel, 'Scheduled with provider', 'History must describe provider-owned scheduled state accurately.');
includes(panel, 'scheduleOperationRef', 'The scheduling UI must reuse one request ID across an indeterminate retry.');
includes(panel, 'Provider confirmation pending', 'History must expose an indeterminate provider operation honestly.');
includes(panel, 'Cancellation pending confirmation', 'History must expose an indeterminate cancellation honestly.');
includes(panel, 'RECONCILIATION_RETRY_MS = 30_000', 'Unresolved provider states must be polled until they become terminal.');

const styles = ['src/styles/foundations.css', 'src/styles/workspace.css', 'src/styles.css'].map(read).join('\n');
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
includes(rlsTest, 'a late cancellation cannot replace an already-recorded delivery', 'pgTAP must cover late cancellation ordering.');

const proBrowserTest = read('tests/e2e/authenticated/pro-email-scheduling.spec.js');
includes(proBrowserTest, "selectOption('drop_off_scheduled')", 'Playwright must cover the Pro scheduling surface and drop-off template.');
includes(proBrowserTest, 'expect(requests[1].request_id).toBe(requests[0].request_id)', 'Playwright must prove an indeterminate retry reuses the same provider operation ID.');
const shopBrowserTest = read('tests/e2e/shop-authenticated/pro-email-scheduling-gate.spec.js');
includes(shopBrowserTest, 'Upgrade to Pro to schedule customer email.', 'Playwright must cover the Shop-plan scheduling gate.');

const packageJson = read('package.json');
includes(packageJson, '"check:pro-email-scheduling": "node scripts/check-pro-email-scheduling.mjs"', 'Package script must expose the focused validation.');

const documentation = read('docs/PRO_EMAIL_SCHEDULING.md');
includes(documentation, 'Provider schedule elapsed', 'Documentation must distinguish provider scheduling from confirmed delivery.');
includes(documentation, 'Long-horizon service follow-up is handled by the separately gated Automated Service Reminders workflow', 'Documentation must keep long-horizon reminders outside this transactional slice.');
includes(documentation, 'does not restore quota', 'Documentation must state cancellation quota behavior.');
includes(documentation, 'rechecks current write access, email opt-in, and scheduled-email entitlement', 'Documentation must describe the final provider authorization check.');
includes(documentation, 'durable pending Message History row', 'Documentation must describe pre-provider history durability.');
includes(documentation, 'reconciles elapsed schedules', 'Documentation must describe provider-state reconciliation.');

console.log('Pro email scheduling checks passed.');
