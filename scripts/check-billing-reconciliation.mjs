import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20260904055235_billing_reconciliation_operator_queue.sql');
const service = read('src/modules/operator/operatorService.js');
const dashboard = read('src/modules/operator/BetaOperatorDashboard.jsx');

assert.match(migration, /create or replace function public\.get_billing_reconciliation_queue\(\)/i, 'the reconciliation RPC must exist');
assert.match(migration, /if not private\.is_operator\(\)/i, 'the reconciliation RPC must enforce operator access');
assert.match(migration, /security definer\s+set search_path = ''/i, 'the reconciliation RPC must lock its search path');
assert.match(migration, /missing_customer_id/i, 'the queue must detect missing Stripe customer IDs');
assert.match(migration, /provider_status_mismatch/i, 'the queue must detect provider status mismatches');
assert.match(migration, /revoke all on function public\.get_billing_reconciliation_queue\(\) from public, anon/i, 'anonymous execution must be revoked');
assert.match(service, /supabase\.rpc\('get_billing_reconciliation_queue'\)/, 'the operator service must load reconciliation data');
assert.match(service, /normalizeBillingReconciliationRow/, 'reconciliation rows must be normalized at the service boundary');
assert.match(dashboard, /BillingReconciliationTable/, 'the operator dashboard must render the reconciliation queue');
assert.match(dashboard, /Read-only diagnostic data for support/, 'the UI must make the support-only boundary explicit');

console.log('Billing reconciliation checks passed.');
