import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationsDir = join(root, 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir)
  .find((name) => name.endsWith('_shipping_custody_foundation_phase_1.sql'));
const migrationPath = migrationFile ? join(migrationsDir, migrationFile) : '';
const servicePath = join(root, 'src/modules/shipping/shippingService.js');
const dashboardPath = join(root, 'src/modules/shipping/ShippingDashboard.jsx');
const appPath = join(root, 'src/app/App.jsx');
const shopConfigPath = join(root, 'src/modules/shops/shopConfig.js');
const packagePath = join(root, 'package.json');

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

assert.ok(migrationFile, 'Shipping / custody foundation migration must exist.');
assert.equal(existsSync(servicePath), true, 'Shipping service module must exist.');
assert.equal(existsSync(dashboardPath), true, 'Shipping dashboard UI must exist.');

const migration = read(migrationPath);
const service = read(servicePath);
const dashboard = read(dashboardPath);
const app = read(appPath);
const shopConfig = read(shopConfigPath);
const packageJson = read(packagePath);

[
  'alter table public.job_shipments',
  'add column if not exists vendor_id uuid references public.vendors',
  'add column if not exists purchase_order_id uuid references public.purchase_orders',
  'add column if not exists label_reference text',
  'add column if not exists label_url text',
  'add column if not exists assigned_location text',
  'add column if not exists assigned_category text',
  'create table if not exists public.shipping_items',
  'create table if not exists public.custody_events',
  'alter table public.shipping_items enable row level security',
  'alter table public.custody_events enable row level security',
  'grant select, insert, update on public.shipping_items to authenticated',
  'grant select, insert on public.custody_events to authenticated'
].forEach((snippet) => {
  assert.ok(migration.includes(snippet), `Migration must include: ${snippet}`);
});

[
  'vendor_inbound',
  'customer_inbound',
  'customer_outbound',
  'vendor_return',
  'inventory_outbound',
  'internal_transfer',
  'pending_arrival',
  'arrived',
  'checked_in',
  'triage',
  'at_bench',
  'ready_to_pack',
  'packed',
  'ready_to_ship',
  'in_transit',
  'delivered',
  'delayed',
  'exception',
  'returned',
  'cancelled',
  'stock',
  'specific_job',
  'tech_bench',
  'hold_quarantine',
  'return_to_vendor'
].forEach((value) => {
  assert.ok(migration.includes(`'${value}'`) || service.includes(`'${value}'`), `Shipping/custody value must be represented: ${value}`);
});

assert.match(migration, /private\.is_shop_member\(shop_id\)/i, 'Read policies must use strict shop membership.');
assert.match(migration, /private\.can_write_shop\(shop_id\)/i, 'Write policies must use shop write access.');
assert.doesNotMatch(migration, /for delete/i, 'Phase 1 should not add hard-delete policies.');
assert.match(migration, /where id = new\.job_id\s+and shop_id = new\.shop_id/i, 'Job links must be shop-scoped.');
assert.match(migration, /where id = new\.customer_id\s+and shop_id = new\.shop_id/i, 'Customer links must be shop-scoped.');
assert.match(migration, /where id = new\.vendor_id\s+and shop_id = new\.shop_id/i, 'Vendor links must be shop-scoped.');
assert.match(migration, /where id = new\.purchase_order_id\s+and shop_id = new\.shop_id/i, 'PO links must be shop-scoped.');

[
  'shipment_created',
  'item_received',
  'location_assigned',
  'category_assigned',
  'assigned_to_user',
  'status_changed',
  'packed',
  'shipped',
  'delivered',
  'exception_recorded'
].forEach((eventType) => {
  assert.ok(migration.includes(`'${eventType}'`), `Custody event type must exist: ${eventType}`);
});

assert.match(migration, /assigned_location := nullif\(btrim\(new\.assigned_location\), ''\)/, 'Assigned location should trim only and preserve inner spaces.');
assert.match(migration, /assigned_category := nullif\(btrim\(new\.assigned_category\), ''\)/, 'Assigned category should trim only and preserve inner spaces.');
assert.doesNotMatch(migration, /regexp_replace\(new\.assigned_location|replace\(new\.assigned_location|slug/i, 'Location/category values must not be slugified or split.');
assert.ok(shopConfig.includes('normalizePresetArray'), 'Shipping must reuse the existing shop preset normalization path.');
assert.ok(dashboard.includes('inventoryLocationPresets'), 'Dashboard must reuse Inventory Location presets.');
assert.ok(dashboard.includes('inventoryCategoryPresets'), 'Dashboard must reuse Inventory Category presets.');

[
  'Black Bag',
  'Plastic Bin',
  'White top drawer',
  'Guitar Parts'
].forEach((sample) => {
  assert.equal(sample.trim(), sample, `Sample preset must remain a normal multi-word display value: ${sample}`);
  assert.match(sample, /\s/, `Sample preset should prove spaces are accepted: ${sample}`);
});

[
  'Shipping / Receiving / Chain of Custody',
  'Tracking Number',
  'Receiving Destination',
  'Pending Arrival',
  'Arrived / Needs Check-In',
  'Ready to Ship',
  'In Transit',
  'Exceptions'
].forEach((label) => {
  assert.ok(dashboard.includes(label), `Shipping dashboard label must exist: ${label}`);
});

assert.ok(app.includes('ShippingDashboard'), 'App must import the Shipping dashboard.');
assert.ok(app.includes("navigateTo('shipping')"), 'App navigation must include Shipping.');
assert.ok(app.includes("mode === 'shipping'"), 'App must render Shipping mode.');

assert.ok(service.includes('listShippingDashboardRecords'), 'Shipping service must list dashboard records.');
assert.ok(service.includes('createShippingRecord'), 'Shipping service must create manual records.');
assert.ok(service.includes('updateShippingRecord'), 'Shipping service must update manual status/metadata.');
assert.ok(service.includes('addCustodyNote'), 'Shipping service must support manual custody notes.');
assert.doesNotMatch(service, /\bfetch\s*\(/, 'Shipping service must not call external carrier APIs.');
assert.doesNotMatch(service, /service_role|SERVICE_ROLE|SUPABASE_SERVICE_ROLE/i, 'Shipping service must not use service-role secrets.');

const shippingFiles = listFiles(join(root, 'src/modules/shipping')).map(read).join('\n');
const forbiddenCarrierPatterns = [
  /\bshipstation\b/i,
  /\bshippo\b/i,
  /\beasypost\b/i,
  /\bpirate\s*ship\b/i,
  /\bcarrier\s*api\s*key\b/i,
  /\bups_api\b/i,
  /\bfedex_api\b/i,
  /\busps_api\b/i
];

for (const pattern of forbiddenCarrierPatterns) {
  assert.doesNotMatch(packageJson, pattern, `Package metadata must not add carrier SDK/API dependency: ${pattern}`);
  assert.doesNotMatch(shippingFiles, pattern, `Shipping source must not add carrier SDK/API wiring: ${pattern}`);
}

console.log('Shipping / custody foundation checks passed.');
