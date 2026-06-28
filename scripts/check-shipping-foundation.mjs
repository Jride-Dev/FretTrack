import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationPath = join(root, 'supabase/migrations/20260628102238_shipping_foundation_phase_1.sql');
const servicePath = join(root, 'src/modules/shipping/shippingService.js');
const permissionServicePath = join(root, 'src/modules/auth/permissionService.js');
const appPath = join(root, 'src/app/App.jsx');

function read(path) {
  return readFileSync(path, 'utf8');
}

function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

assert.equal(existsSync(migrationPath), true, 'Shipping foundation migration must exist.');
assert.equal(existsSync(servicePath), true, 'Shipping service module must exist.');

const migration = read(migrationPath);
const service = read(servicePath);
const permissionService = read(permissionServicePath);
const app = read(appPath);

assert.match(migration, /create table if not exists public\.job_shipments/i, 'Migration must create public.job_shipments.');
assert.match(migration, /alter table public\.job_shipments enable row level security/i, 'job_shipments must enable RLS.');

[
  'id uuid primary key default gen_random_uuid()',
  'shop_id text not null references public.shop_profiles(shop_id)',
  'job_id uuid not null references public.jobs(id)',
  'customer_id uuid references public.customers(id)',
  'direction text not null default',
  'fulfillment_method text not null default',
  'status text not null default',
  'carrier text',
  'service_level text',
  'tracking_number text',
  'tracking_url text',
  'ship_to_name text',
  'ship_to_address_line1 text',
  'ship_to_address_line2 text',
  'ship_to_city text',
  'ship_to_state text',
  'ship_to_postal_code text',
  "ship_to_country text default 'US'",
  'shipping_cost numeric(10, 2)',
  'shipping_charge numeric(10, 2)',
  'notes text',
  'shipped_at timestamptz',
  'delivered_at timestamptz',
  'created_by uuid references auth.users(id)',
  'created_at timestamptz not null default now()',
  'updated_at timestamptz not null default now()'
].forEach((snippet) => {
  assert.ok(migration.includes(snippet), `Migration must include field definition: ${snippet}`);
});

[
  'job_shipments_direction_check',
  'job_shipments_fulfillment_method_check',
  'job_shipments_status_check',
  'job_shipments_shipping_cost_nonnegative',
  'job_shipments_shipping_charge_nonnegative'
].forEach((constraintName) => {
  assert.ok(migration.includes(constraintName), `Migration must include constraint ${constraintName}.`);
});

[
  "'inbound', 'outbound', 'customer_return'",
  "'pickup', 'ship'",
  "'not_ready', 'ready_to_ship', 'label_needed', 'shipped', 'delivered', 'returned', 'problem', 'void'",
  'shipping_cost is null or shipping_cost >= 0',
  'shipping_charge is null or shipping_charge >= 0'
].forEach((snippet) => {
  assert.ok(migration.includes(snippet), `Migration must include enum/cost validation: ${snippet}`);
});

[
  'job_shipments_shop_id_idx',
  'job_shipments_job_id_idx',
  'job_shipments_customer_id_idx',
  'job_shipments_status_idx',
  'job_shipments_tracking_number_idx',
  'job_shipments_shipped_at_idx',
  'job_shipments_delivered_at_idx'
].forEach((indexName) => {
  assert.ok(migration.includes(indexName), `Migration must include index ${indexName}.`);
});

assert.match(migration, /create or replace function public\.ensure_job_shipment_scope/i, 'Migration must validate job/customer shop scope.');
assert.match(migration, /where id = new\.job_id\s+and shop_id = new\.shop_id/i, 'Shipment job must be validated against shipment shop.');
assert.match(migration, /where id = new\.customer_id\s+and shop_id = new\.shop_id/i, 'Shipment customer must be validated against shipment shop.');
assert.match(migration, /execute function public\.set_updated_at\(\)/i, 'Migration must use the shared updated_at trigger helper.');
assert.match(migration, /private\.is_shop_member\(shop_id\)/i, 'Read policy must use shop membership.');
assert.match(migration, /private\.can_write_shop\(shop_id\)/i, 'Write policies must use shop write access.');
assert.doesNotMatch(migration, /for delete/i, 'Phase 1 should not add hard-delete policies for shipments.');
assert.match(migration, /grant select, insert, update on public\.job_shipments to authenticated/i, 'Authenticated users need explicit Data API grants under RLS.');
assert.doesNotMatch(migration, /grant .*delete/i, 'Phase 1 should not grant delete on job_shipments.');

assert.ok(service.includes("from('job_shipments')"), 'Shipping service must query job_shipments.');
assert.ok(service.includes('listJobShipments'), 'Shipping service must export listJobShipments.');
assert.ok(service.includes('createJobShipment'), 'Shipping service must export createJobShipment.');
assert.ok(service.includes('updateJobShipment'), 'Shipping service must export updateJobShipment.');
assert.ok(service.includes('voidJobShipment'), 'Shipping service must export voidJobShipment.');
assert.ok(service.includes(".eq('shop_id', shopId)"), 'Shipping service operations must scope by active shop.');
assert.doesNotMatch(service, /service_role|SERVICE_ROLE|SUPABASE_SERVICE_ROLE/i, 'Shipping service must not use service-role secrets.');
assert.doesNotMatch(service, /stripe/i, 'Shipping service must not call Stripe.');
assert.doesNotMatch(service, /shippo|easypost|usps|fedex|ups|dhl/i, 'Shipping service must not call carrier APIs.');
assert.doesNotMatch(service, /\bfetch\s*\(/, 'Shipping service must not make external carrier/network calls.');

assert.ok(permissionService.includes('canManageShipments'), 'Permission service must expose canManageShipments.');
assert.ok(permissionService.includes('canVoidShipments'), 'Permission service must expose canVoidShipments.');
assert.match(permissionService, /canManageShipments[\s\S]*canWriteShop/, 'Shipment management should use normal shop write access.');
assert.match(permissionService, /canVoidShipments[\s\S]*SHOP_MANAGE_ROLES/, 'Shipment voiding should be owner/admin scoped.');
assert.match(permissionService, /canVoidShipments[\s\S]*isReadOnlyStatus/, 'Shipment voiding must honor read-only lifecycle state.');

const shippingFiles = listFiles(join(root, 'src/modules/shipping'));
const uiFiles = shippingFiles.filter((filePath) => /\.(jsx|tsx)$/.test(filePath));
assert.deepEqual(uiFiles, [], 'Shipping foundation phase must not add shipping UI components.');
assert.doesNotMatch(app, /ShippingPage|jobShipping|shippingService/i, 'App.jsx must not wire shipping UI/routes in this phase.');

console.log('Shipping foundation checks passed.');
