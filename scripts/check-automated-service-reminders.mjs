import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeServiceReminderTemplate,
  renderServiceReminderTemplate
} from '../src/modules/messaging/serviceReminderTemplates.js';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const includes = (source, expected, message) => assert.ok(source.includes(expected), message);

const migration = read('supabase/migrations/20260822035953_pro_automated_service_reminders.sql');
const edge = read('supabase/functions/send-service-reminders/index.ts');
const settings = read('src/modules/shops/ServiceReminderSettings.jsx');
const service = read('src/modules/messaging/serviceReminderService.js');
const styles = read('src/styles.css');
const customerForm = read('src/modules/customers/CustomerForm.jsx');
const customerService = read('src/modules/customers/customerService.js');
const router = read('src/app/WorkspaceRouter.jsx');
const documentation = read('docs/PRO_AUTOMATED_SERVICE_REMINDERS.md');

for (const plan of ['free', 'solo', 'shop', 'pro', 'enterprise', 'trial']) {
  includes(migration, `('${plan}', 'automated_service_reminders'`, `Migration must seed automated_service_reminders for ${plan}.`);
}
includes(migration, "('pro', 'automated_service_reminders', 'true'::jsonb)", 'Pro must include automated reminders.');
includes(migration, "('shop', 'automated_service_reminders', 'false'::jsonb)", 'Shop must not include automated reminders.');
includes(migration, 'service_reminder_opt_in boolean not null default false', 'Customers need separate affirmative reminder consent.');
includes(migration, 'service_reminder_consent_at timestamptz', 'Reminder consent needs a timestamp.');
includes(migration, 'service_completed_at timestamptz', 'Reminder timing needs an authoritative completion timestamp.');
includes(migration, 'create table public.service_reminder_queue', 'Long-horizon reminders need a durable database queue.');
includes(migration, "status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'canceled'))", 'Queue state must represent leases, retries, delivery, and cancellation.');
includes(migration, 'for update skip locked', 'Concurrent nightly workers must not claim the same reminder.');
includes(migration, 'recipient_snapshot', 'Delivery claims must snapshot the opted-in recipient.');
includes(migration, 'subject_snapshot', 'Delivery claims must snapshot the subject.');
includes(migration, 'body_snapshot', 'Delivery claims must snapshot the body.');
includes(migration, "private.shop_has_entitlement(queue_row.shop_id, 'automated_service_reminders')", 'The final database check must enforce current entitlement.');
includes(migration, 'processing_token = target_claim_token', 'Finalization must be conditional on the active claim token.');
includes(migration, "grant execute on function public.claim_due_service_reminders(uuid, integer) to service_role", 'Only the service role may claim reminders.');
assert.ok(!migration.includes('grant execute on function public.claim_due_service_reminders(uuid, integer) to authenticated'), 'Authenticated clients must not claim reminder deliveries.');
includes(migration, "cron.schedule('frettrack-service-reminders-nightly'", 'The migration must register one named nightly job.');
includes(migration, "frettrack_function_key", 'Cron must load its shared function key from Vault.');
assert.ok(!/RESEND_API_KEY\s*[:=]\s*['"][^'"]+/i.test(migration), 'Provider secrets must not be stored in the migration.');

includes(edge, "request.headers.get('x-frettrack-key')", 'The nightly Edge Function must authenticate the Cron request.');
includes(edge, ".rpc('claim_due_service_reminders'", 'The Edge Function must claim durable queue rows.');
includes(edge, ".rpc('validate_service_reminder_claim'", 'The Edge Function must recheck consent and entitlement immediately before delivery.');
includes(edge, "'Idempotency-Key': `frettrack-service-reminder/${requestId}`", 'Provider retries must reuse the durable delivery key.');
includes(edge, "template_key: 'automated_service_reminder'", 'Automated mail must appear in Message History.');
includes(edge, "target_usage_kind: 'email_recipients'", 'Automated reminders must consume the existing email quota.');
includes(edge, 'safeFinalizeQueue', 'A failed finalization must not abort the remaining nightly batch.');

includes(settings, 'Automated Service Reminders', 'Shop Settings must expose the Pro reminder configuration.');
includes(settings, 'Resend’s 30-day scheduling limit does not apply', 'The UI must explain database-backed long-horizon scheduling.');
includes(settings, 'service-reminder-email-preview', 'Reminder settings must lead with a customer-readable email preview.');
includes(settings, 'Edit subject and message', 'Raw template editing must be kept behind an explicit editor control.');
includes(settings, 'service-reminder-field-chip', 'Template fields must use human-readable insertion controls.');
assert.ok(!settings.includes('Template fields:'), 'Reminder settings must not dump raw template syntax below the form.');
includes(settings, "'{{booking_url}}': rule.bookingUrl", 'The preview must use the configured booking URL without a fake fallback.');
assert.ok(!settings.includes("rule.bookingUrl || 'https://yourshop.example/book'"), 'An empty booking URL must not become a usable-looking sample link.');
includes(settings, 'Booking link is blank.', 'The preview must clearly warn when a used booking field has no configured value.');
includes(service, 'normalizeServiceReminderTemplate(row.body_template', 'Existing literal newline escapes must be normalized when loaded.');
includes(service, 'body_template: normalizeServiceReminderTemplate', 'Saved templates must persist real line breaks.');
includes(styles, '.service-reminder-template-builder', 'Reminder template builder needs focused presentation styles.');
includes(styles, 'white-space: pre-wrap', 'The customer preview must preserve readable paragraph breaks.');
includes(customerForm, 'Customer consents to automated service reminder emails', 'Customer profiles must record explicit reminder consent.');
includes(customerService, 'hasReminderConsent', 'Removing the customer email must also clear persisted reminder consent.');
includes(router, 'serviceRemindersEnabled={Boolean(billingAccess?.entitlements?.automated_service_reminders)}', 'Customer reminder controls must use the Pro entitlement gate.');

includes(documentation, 'does not use Resend scheduling', 'Documentation must distinguish nightly dispatch from provider scheduling.');
includes(documentation, 'separate affirmative consent', 'Documentation must describe the consent boundary.');
includes(documentation, 'No remote migration, function deployment, Vault secret, or Cron change', 'Documentation must preserve the approval boundary.');

assert.equal(
  normalizeServiceReminderTemplate('Hi {{customer_first_name}}\\n\\nReady when you are.'),
  'Hi {{customer_first_name}}\n\nReady when you are.',
  'Legacy literal newline escapes must become real paragraphs.'
);
assert.equal(
  renderServiceReminderTemplate('Hi {{customer_first_name}}, your {{service_name}} is due.', {
    '{{customer_first_name}}': 'Jordan',
    '{{service_name}}': 'setup'
  }),
  'Hi Jordan, your setup is due.',
  'The preview renderer must replace personalization fields without exposing raw tokens.'
);
assert.equal(
  renderServiceReminderTemplate('Book here: {{booking_url}}', { '{{booking_url}}': '' }),
  'Book here: ',
  'An unconfigured booking URL must render exactly as the sender receives it.'
);

console.log('Automated service reminder checks passed.');
