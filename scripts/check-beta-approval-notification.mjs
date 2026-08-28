import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edgeFunction = readFileSync('supabase/functions/notify-beta-approval/index.ts', 'utf8');
const deliveryHelper = readFileSync('supabase/functions/notify-beta-approval/delivery.ts', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260828005958_beta_approval_notification_idempotency.sql',
  'utf8'
);

assert.match(edgeFunction, /begin_beta_approval_notification/, 'Approval email must claim a durable delivery before provider contact.');
assert.match(edgeFunction, /finalize_beta_approval_notification/, 'Provider acceptance must finalize the durable delivery.');
assert.match(edgeFunction, /fail_beta_approval_notification/, 'Confirmed provider rejection must release the delivery safely.');
assert.match(edgeFunction, /'Idempotency-Key': idempotencyKey/, 'Resend must receive the durable delivery key.');
assert.doesNotMatch(
  edgeFunction,
  /update\(\{ approved_notified_at:/,
  'The Edge Function must not use the old non-atomic timestamp update path.'
);
assert.match(edgeFunction, /providerAccepted: true/, 'Post-acceptance finalization failure must be reported honestly.');
assert.match(deliveryHelper, /400, 401, 403, 404, 422/, 'Only explicit provider rejection statuses may open a new attempt.');

assert.match(migration, /private\.beta_approval_notification_deliveries/, 'Delivery state must remain outside the exposed public schema.');
assert.match(migration, /state in \('sending', 'sent', 'failed', 'indeterminate'\)/, 'Delivery states must distinguish unresolved provider acceptance.');
assert.match(migration, /interval '23 hours'/, 'Automatic retries must stop before Resend idempotency expires.');
assert.match(migration, /idempotency_key = p_idempotency_key[\s\S]*state = 'sending'/, 'Finalization must target the current unresolved provider operation.');

for (const signature of [
  'begin_beta_approval_notification(uuid, text, text, text, text)',
  'finalize_beta_approval_notification(uuid, text, text)',
  'fail_beta_approval_notification(uuid, text, text)'
]) {
  assert.ok(
    migration.includes(`revoke all on function public.${signature}\n  from public, anon, authenticated, service_role;`),
    `${signature} must revoke default execution.`
  );
  assert.ok(
    migration.includes(`grant execute on function public.${signature}\n  to service_role;`),
    `${signature} must remain service-role only.`
  );
}

console.log('Beta approval notification idempotency checks passed.');
