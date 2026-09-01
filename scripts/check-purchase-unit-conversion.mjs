import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inventoryUnitsForPurchaseQuantity,
  purchaseConversionSummary,
  purchaseUnitCostBreakdown,
  validUnitsPerPurchaseUnit
} from '../src/modules/inventory/purchaseUnits.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migrationPath = 'supabase/migrations/20260730145549_purchase_unit_conversion.sql';
const migration = read(migrationPath);
const service = [
  read('src/modules/inventory/inventoryService.js'),
  read('src/modules/inventory/inventoryServiceNormalization.js'),
  read('src/modules/inventory/inventoryServicePurchasing.js')
].join('\n');
const partEditor = read('src/modules/inventory/InventoryPartEditor.jsx');
const purchaseOrderEditor = read('src/modules/inventory/InventoryPurchaseOrderEditor.jsx');
const reportsPage = read('src/modules/reports/AdvancedReportsPage.jsx');
const packageJson = JSON.parse(read('package.json'));

assert.equal(inventoryUnitsForPurchaseQuantity(2, 5), 10, 'Two five-packs must convert to ten inventory units.');
assert.equal(
  purchaseConversionSummary(2, 'pack', 5),
  '2 Packs × 5 Each = 10 inventory units',
  'The purchase-order conversion summary must be explicit.'
);
assert.deepEqual(
  purchaseUnitCostBreakdown(1, 2, 7.71),
  { inventoryQuantity: 2, inventoryUnitCost: 3.855, lineTotal: 7.71 },
  'One $7.71 two-pack must cost $3.855 per inventory each without doubling the PO line.'
);
for (const invalid of [0, -1, 1.5, Number.NaN, 'not-a-number']) {
  assert.equal(validUnitsPerPurchaseUnit(invalid), false, `Invalid conversion ${String(invalid)} must be rejected.`);
}

assert.ok(fs.existsSync(path.join(root, migrationPath)), 'The focused purchase-unit migration must exist.');
for (const table of ['public.parts', 'public.purchase_order_items', 'public.inventory_receipt_items']) {
  assert.match(migration, new RegExp(`alter table ${table.replace('.', '\\.')}[\\s\\S]*?purchase_unit`, 'i'), `${table} must store a purchase-unit snapshot.`);
  assert.match(migration, new RegExp(`alter table ${table.replace('.', '\\.')}[\\s\\S]*?units_per_purchase_unit`, 'i'), `${table} must store a conversion snapshot.`);
}
assert.match(migration, /inventory_quantity_received integer/i, 'Receipts must snapshot converted inventory quantity.');
assert.match(migration, /set inventory_quantity_received = quantity_received/i, 'Historical receipts must retain one-to-one behavior.');
assert.match(migration, /default 'each'/i, 'Existing rows must default to Each.');
assert.match(migration, /default 1/i, 'Existing rows must default to conversion 1.');
assert.match(migration, /check \(units_per_purchase_unit between 1 and 999999\)/i, 'Database conversion factors must be positive whole integers.');

assert.match(migration, /safe_inventory_quantity := \(safe_purchase_quantity::bigint \* target_item\.units_per_purchase_unit::bigint\)::integer/i, 'PO receiving must use the PO-line conversion snapshot.');
assert.match(migration, /quantity_on_hand = coalesce\(quantity_on_hand, 0\) \+ safe_inventory_quantity/i, 'PO receiving must add converted inventory units to stock.');
assert.match(migration, /'receive',\s*safe_inventory_quantity/i, 'Inventory movement audit rows must use inventory units.');
assert.match(migration, /quantity_received = quantity_received \+ safe_purchase_quantity/i, 'PO progress must remain in purchase units.');
assert.match(migration, /inventory_quantity_received,\s*unit_cost,\s*base_unit_cost/i, 'Receipt rows must persist the converted quantity and cost snapshots.');
assert.match(migration, /not private\.can_write_shop\(target_order\.shop_id\)/i, 'Existing shop-scoped write permission enforcement must remain.');
assert.match(migration, /grant execute on function public\.receive_purchase_order_items\(uuid, jsonb, text\) to authenticated/i, 'Authenticated receiving grant must remain explicit.');

assert.match(service, /purchase_unit: normalizePurchaseUnit/i, 'Part and PO persistence must map purchase units.');
assert.match(service, /units_per_purchase_unit:/i, 'Part and PO persistence must map conversion factors.');
assert.match(partEditor, /Purchase Unit/i, 'Inventory must expose purchase-unit configuration.');
assert.match(partEditor, /Units per Purchase Unit/i, 'Inventory must expose conversion configuration.');
assert.match(purchaseOrderEditor, /Purchase units ordered/i, 'PO details must distinguish purchase quantities.');
assert.match(purchaseOrderEditor, /Inventory units ordered/i, 'PO details must show converted inventory quantities.');
assert.match(purchaseOrderEditor, /Receive purchase quantity/i, 'Partial receiving must be entered in purchase units.');
assert.match(purchaseOrderEditor, /How many \{purchaseUnitLabel\(item\.purchaseUnit, 2\)\}\?/, 'The PO editor must ask for package count, not item count.');
assert.match(purchaseOrderEditor, /Price for one whole \{purchaseUnitLabel\(item\.purchaseUnit\)\}/, 'The PO editor must ask for the whole-package vendor price.');
assert.match(purchaseOrderEditor, /Vendor charge:/, 'The PO editor must preview the actual vendor line charge.');
assert.match(reportsPage, /Purchase Qty/i, 'Reports must distinguish purchase quantities.');
assert.match(reportsPage, /Inventory Qty/i, 'Reports must show converted inventory quantities.');

assert.equal(
  packageJson.scripts['check:purchase-unit-conversion'],
  'node scripts/check-purchase-unit-conversion.mjs',
  'The focused package validation command must be registered.'
);

assert.ok(fs.existsSync(path.join(root, migrationPath)), 'The reviewed purchase-unit migration must remain tracked in the repository.');

console.log('Purchase-unit conversion regression checks passed.');
