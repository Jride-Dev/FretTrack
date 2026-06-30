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
  '4 x 6 thermal shipping label',
  '2.25 x 1.25 parts/bin label',
  'Letter / plain paper'
].forEach((snippet) => {
  assert.ok(shopSettings.includes(snippet) || shopProfileService.includes(snippet), `Shop settings/profile wiring must include: ${snippet}`);
});

assert.ok(inventoryPage.includes('Special Order Part'), 'Inventory UI must expose the Special Order Part checkbox.');
assert.ok(inventoryPage.includes('Special order parts are not treated as stocked items.'), 'Special-order helper text must explain stocked behavior.');
assert.ok(inventoryPage.includes('Part Image'), 'Inventory UI must expose part image upload.');
assert.ok(inventoryPage.includes('300x300 px or smaller'), 'Part image UI must show the 300x300 hard limit.');
assert.ok(inventoryPage.includes('Search name, UPC, barcode, vendor UPC, category, or vendor'), 'Inventory search placeholder must use UPC/vendor wording.');
assert.ok(inventoryPage.includes('<th>UPC</th>'), 'Parts table must show UPC instead of SKU.');
assert.ok(inventoryPage.includes('Vendor Text'), 'Legacy supplier text field must be presented as vendor wording.');
assert.ok(inventoryPage.includes('Vendor UPC'), 'Vendor SKU field must be presented as Vendor UPC.');
assert.doesNotMatch(inventoryPage, />Supplier</, 'Inventory UI must not show Supplier as a visible label.');
assert.doesNotMatch(inventoryPage, />SKU</, 'Inventory UI must not show SKU as a visible table/form label.');
assert.doesNotMatch(inventoryPage, /Vendor SKU|vendor SKU|No vendor SKU/, 'Inventory UI must not show Vendor SKU wording.');

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
