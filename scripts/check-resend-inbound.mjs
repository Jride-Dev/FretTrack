import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const handler = read('supabase/functions/receive-email/index.ts');
const verifier = read('supabase/functions/receive-email/resendInbound.ts');
const migration = read('supabase/migrations/20260904082220_resend_inbound_email_adapter.sql');
const test = read('supabase/functions/receive-email/resendInbound.test.ts');

assert.match(handler, /verifyResendWebhook/, 'the inbound handler must verify the provider signature');
assert.match(handler, /email\.received/, 'the inbound handler must only process received-email events');
assert.match(handler, /customer_inbound_webhook_events/, 'the inbound handler must claim webhook deliveries');
assert.match(handler, /customer_inbound_email_routes/, 'the inbound handler must resolve a configured shop route');
assert.match(handler, /provider_message_id/, 'the inbound handler must preserve provider identity for replay safety');
assert.match(handler, /job_id: null/, 'inbound messages must start unassigned');
assert.match(verifier, /svix-id|headers\.id/, 'verification must bind the event ID');
assert.match(verifier, /allowed replay window/, 'verification must reject stale webhook timestamps');
assert.match(migration, /customer_inbound_email_routes/, 'the migration must add service-managed inbound routes');
assert.match(migration, /customer_inbound_webhook_events/, 'the migration must add a webhook replay ledger');
assert.match(migration, /revoke all on table public\.customer_inbound_webhook_events from public, anon, authenticated/, 'browser clients must not access webhook claims');
assert.match(test, /valid Svix v1 signature/, 'signature verification must have a valid-path test');
assert.match(test, /bad or stale signatures/, 'signature verification must have replay and forgery tests');

console.log('Resend inbound adapter checks passed.');
