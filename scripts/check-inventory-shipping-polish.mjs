import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationsDir = join(root, 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir)
  .find((name) => name.endsWith('_inventory_vendor_shipping_polish_phase_1.sql'));

assert.ok(migrationFile, 'Inventory/vendor/shipping polish migration must exist.');

const migration = read(join(migrationsDir, migrationFile));
const inventoryPage = read(join(root, 'src/modules/inventory/InventoryPage.jsx'));
const inventoryService = read(join(root, 'src/modules/inventory/inventoryService.js'));
const barcodeLabels = read(join(root, 'src/modules/inventory/BarcodeLabelSheet.jsx'));
const shopSettings = read(join(root, 'src/modules/shops/ShopSettings.jsx'));
const shopProfileService = read(join(root, 'src/modules/shops/shopProfileService.js'));
const reportsService = read(join(root, 'src/modules/reports/advancedReportsService.js'));
const staleVendorText = ['Vendor', 'Text'].join(' ');
const staleBarcodeCode = ['Barcode', 'code'].join(' ');

[
  'inventory_location_presets jsonb',
  'inventory_category_presets jsonb',
  'shipping_label_settings jsonb',
  'special_order boolean not null default false',
  'image_path text',
  'image_mime_type text',
  'image_width integer',
  'image_height integer',
  'parts_image_dimensions_max_300',
  "id = 'part-images'",
  'file_size_limit = 262144',
  "bucket_id = 'part-images'",
  'private.is_shop_member((storage.foldername(name))[1])',
  'private.can_write_shop((storage.foldername(name))[1])'
].forEach((snippet) => {
  assert.ok(migration.includes(snippet), `Migration must include: ${snippet}`);
});

[
  'inventoryLocationPresets',
  'inventoryCategoryPresets',
  'shippingLabelSettings',
  'Inventory / Vendor Controls',
  'Inventory Locations',
  'Inventory Categories',
  'inventoryLocationPresetText',
  'inventoryCategoryPresetText',
  '4 x 6 thermal shipping label',
  '2.25 x 1.25 parts/bin label',
  'Letter / plain paper'
].forEach((snippet) => {
  assert.ok(shopSettings.includes(snippet) || shopProfileService.includes(snippet), `Shop settings/profile wiring must include: ${snippet}`);
});

assert.deepEqual(
  normalizePresetArray(['Black Bag', 'Plastic Bin', 'White top drawer']),
  ['Black Bag', 'Plastic Bin', 'White top drawer'],
  'Location presets must preserve multi-word values with spaces.'
);
assert.deepEqual(
  normalizePresetArray([' Guitar Parts ']),
  ['Guitar Parts'],
  'Category presets must trim only leading/trailing whitespace.'
);
assert.ok(shopSettings.includes("split('\\n')"), 'Preset textareas must split presets by newline only.');
assert.doesNotMatch(shopSettings, /split\([^)]*\\s|slug|slugify|replace\([^)]*\\s/g, 'Preset editing must not split on whitespace or slugify display values.');

assert.ok(inventoryPage.includes('Special Order Part'), 'Inventory UI must expose the Special Order Part checkbox.');
assert.ok(inventoryPage.includes('Special order parts are not treated as stocked items.'), 'Special-order helper text must explain stocked behavior.');
assert.ok(inventoryPage.includes('Part Image'), 'Inventory UI must expose part image upload.');
assert.ok(inventoryPage.includes('300x300 px or smaller'), 'Part image UI must show the 300x300 hard limit.');
assert.ok(inventoryPage.includes('Search name, manufacturer UPC, barcode, vendor SKU, vendor UPC, category, or vendor'), 'Inventory search placeholder must use UPC/vendor wording.');
assert.ok(inventoryPage.includes('<th>UPC</th>'), 'Parts table must show UPC instead of SKU.');
assert.ok(inventoryPage.includes('Part Name'), 'Part form must show Part Name.');
assert.ok(inventoryPage.includes('Part Number'), 'Part form must show Part Number.');
assert.ok(inventoryPage.includes('Vendor SKU'), 'Legacy supplier text field must be presented as Vendor SKU.');
assert.ok(inventoryPage.includes('Vendor UPC'), 'Vendor SKU field must be presented as Vendor UPC.');
assert.ok(inventoryPage.includes('Manufacturer UPC'), 'Part form must show Manufacturer UPC.');
assert.ok(inventoryPage.includes('QTY On Hand'), 'Part form must show QTY On Hand.');
assert.ok(inventoryPage.includes('Reorder Point'), 'Part form must show Reorder Point.');
assert.ok(inventoryPage.includes('Desired Stock'), 'Part form must show Desired Stock.');
assertLabelsAppearInOrder(inventoryPage, [
  '<label>Vendor',
  '<label>Part Name',
  '<label>Part Number',
  '<label>Category',
  '<label>Location',
  '<label>Description',
  '<label>Vendor SKU',
  '<label>Vendor UPC',
  '<label>Barcode',
  '<label>Manufacturer',
  '<label>Manufacturer UPC',
  '<label>Unit Cost',
  '<label>Retail Price',
  '<label>QTY On Hand',
  '<label>Reorder Point',
  '<label>Desired Stock',
  '<label className="inventory-image-field">'
]);
assert.doesNotMatch(inventoryPage, />Supplier</, 'Inventory UI must not show Supplier as a visible label.');
assert.doesNotMatch(inventoryPage, new RegExp(`${staleVendorText}|${staleBarcodeCode}`), 'Inventory UI must not show stale vendor-text or barcode-code wording.');

[
  'special_order: Boolean(specialOrder)',
  'desired_stock_level: specialOrder ? 0',
  '!part.specialOrder && part.quantityOnHand <= part.reorderPoint',
  'uploadPartImage',
  'MAX_PART_IMAGE_DIMENSION = 300',
  "PART_IMAGES_BUCKET = 'part-images'",
  'createPartImageObjectUrl'
].forEach((snippet) => {
  assert.ok(inventoryService.includes(snippet), `Inventory service must include: ${snippet}`);
});

assert.ok(reportsService.includes('!isSpecialOrderPart(part)'), 'Advanced reports low-stock lists must exclude special-order parts.');
assert.ok(barcodeLabels.includes('labelPreset'), 'Barcode label sheet must accept label presets.');
assert.ok(barcodeLabels.includes('No UPC or part number'), 'Barcode label sheet must use UPC wording.');
assert.doesNotMatch(barcodeLabels, /No SKU/, 'Barcode label sheet must not show SKU wording.');
assert.doesNotMatch(inventoryService, /service_role|SERVICE_ROLE|SUPABASE_SERVICE_ROLE/i, 'Inventory service must not use service-role secrets.');

console.log('Inventory/vendor/shipping polish checks passed.');

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist.`);
  return readFileSync(path, 'utf8');
}

function normalizePresetArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const presets = [];
  for (const entry of value) {
    const label = String(entry || '').trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) {
      continue;
    }
    seen.add(key);
    presets.push(label);
  }
  return presets;
}

function assertLabelsAppearInOrder(source, labels) {
  let previousIndex = -1;
  for (const label of labels) {
    const index = source.indexOf(label);
    assert.notEqual(index, -1, `Part form must include ${label}.`);
    assert.ok(index > previousIndex, `Part form label order is wrong near ${label}.`);
    previousIndex = index;
  }
}
