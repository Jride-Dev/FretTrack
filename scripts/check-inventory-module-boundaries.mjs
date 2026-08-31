import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const page = read('src/modules/inventory/InventoryPage.jsx');
const pageData = read('src/modules/inventory/useInventoryPageData.js');
const partController = read('src/modules/inventory/useInventoryPartController.js');
const purchasingController = read('src/modules/inventory/useInventoryPurchasingController.js');
const controllerSource = [pageData, partController, purchasingController].join('\n');
const history = read('src/modules/inventory/InventoryHistoryTab.jsx');
const labels = read('src/modules/inventory/InventoryLabelsTab.jsx');
const partEditor = read('src/modules/inventory/InventoryPartEditor.jsx');
const partsList = read('src/modules/inventory/InventoryPartsList.jsx');
const purchaseOrderEditor = read('src/modules/inventory/InventoryPurchaseOrderEditor.jsx');
const purchaseOrdersList = read('src/modules/inventory/InventoryPurchaseOrdersList.jsx');
const vendors = read('src/modules/inventory/InventoryVendorsTab.jsx');
const formattingPath = join(root, 'src/modules/inventory/inventoryFormatting.js');
const purchaseOrderCalculationsPath = join(root, 'src/modules/inventory/purchaseOrderCalculations.js');
const stockFormPath = join(root, 'src/modules/inventory/inventoryStockForm.js');
const formatting = read('src/modules/inventory/inventoryFormatting.js');
const packageJson = read('package.json');

assert.match(page, /import InventoryHistoryTab from ['"]\.\/InventoryHistoryTab\.jsx['"]/, 'Inventory must use the History tab boundary.');
assert.match(page, /import InventoryLabelsTab from ['"]\.\/InventoryLabelsTab\.jsx['"]/, 'Inventory must use the Labels tab boundary.');
assert.match(page, /import InventoryPartsList from ['"]\.\/InventoryPartsList\.jsx['"]/, 'Inventory must use the Parts list boundary.');
assert.match(page, /import InventoryPartEditor from ['"]\.\/InventoryPartEditor\.jsx['"]/, 'Inventory must use the Part editor boundary.');
assert.match(page, /import InventoryPurchaseOrdersList from ['"]\.\/InventoryPurchaseOrdersList\.jsx['"]/, 'Inventory must use the Purchase Orders list boundary.');
assert.match(page, /import InventoryPurchaseOrderEditor from ['"]\.\/InventoryPurchaseOrderEditor\.jsx['"]/, 'Inventory must use the Purchase Order editor boundary.');
assert.match(page, /import InventoryVendorsTab from ['"]\.\/InventoryVendorsTab\.jsx['"]/, 'Inventory must use the Vendors tab boundary.');
assert.match(page, /useInventoryPageData/, 'Inventory data loading must use its focused controller hook.');
assert.match(page, /useInventoryPartController/, 'Part and stock mutations must use their focused controller hook.');
assert.match(page, /useInventoryPurchasingController/, 'Vendor and purchase-order mutations must use their focused controller hook.');
assert.match(page, /<InventoryHistoryTab[\s\S]*?partPurchaseHistory=\{partPurchaseHistory\}[\s\S]*?partMovements=\{partMovements\}/, 'History data must remain connected.');
assert.match(page, /<InventoryLabelsTab[\s\S]*?onPrintLabels=\{printBarcodeLabels\}/, 'Barcode printing must retain the established handler.');
assert.match(page, /<InventoryPartsList[\s\S]*?onSearch=\{handleSearch\}[\s\S]*?onSelectPart=\{selectPart\}[\s\S]*?onToggleLabelPart=\{toggleLabelPart\}/, 'Parts search, selection, and label handlers must remain connected.');
assert.match(page, /<InventoryPartEditor[\s\S]*?onSavePart=\{savePart\}[\s\S]*?onReceive=\{handleReceive\}[\s\S]*?onAdjust=\{handleAdjust\}/, 'Part editor mutations must remain connected to the established controller handlers.');
assert.match(page, /<InventoryPurchaseOrdersList[\s\S]*?onStatusFilterChange=\{setPoStatusFilter\}[\s\S]*?onSelectPurchaseOrder=\{selectPurchaseOrder\}/, 'PO filtering and selection must remain connected to the established handlers.');
assert.match(page, /<InventoryPurchaseOrderEditor[\s\S]*?onSavePurchaseOrder=\{savePurchaseOrder\}[\s\S]*?onStatusChange=\{handlePurchaseOrderStatus\}[\s\S]*?onReceive=\{handlePurchaseReceive\}/, 'PO mutations must remain connected to the established controller handlers.');
assert.match(purchasingController, /preparePurchaseOrderReceiptItems\([\s\S]*?selectedPurchaseOrder,[\s\S]*?purchaseReceiveQuantities,[\s\S]*?purchaseReceiveCosts/, 'PO receipt submission must use the executable receipt-validation boundary.');
assert.match(partController, /function refreshPartsAfterStockMutation\([\s\S]*?withAuthoritativeStockFields\(current, authoritativePart\)/, 'Stock mutations must synchronize the selected editor from authoritative inventory state.');
assert.match(partController, /const updatedPart = await receivePart\([\s\S]*?refreshPartsAfterStockMutation\(updatedPart\)/, 'Direct receiving must synchronize the selected part form.');
assert.match(partController, /const updatedPart = await adjustPart\([\s\S]*?refreshPartsAfterStockMutation\(updatedPart\)/, 'Stock adjustments must synchronize the selected part form.');
assert.match(purchasingController, /receivePurchaseOrderItems\([\s\S]*?refreshPartsAfterStockMutation\(\)/, 'Purchase-order receiving must synchronize any selected part form.');
assert.doesNotMatch(controllerSource, /\bremainingForItem\(/, 'PO receipt validation must not call the removed local helper.');
assert.match(page, /<InventoryVendorsTab[\s\S]*?onSelectVendor=\{loadVendorIntoForm\}[\s\S]*?onSaveVendor=\{saveVendor\}/, 'Vendor selection and saving must retain the established handlers.');
assert.doesNotMatch(page, /function renderHistoryTab|function renderLabelsTab|function renderVendorsTab/, 'Extracted tabs must not remain duplicated in InventoryPage.');
assert.ok(page.split(/\r?\n/).length < 400, 'InventoryPage must remain a focused composition surface instead of regaining controller mutations.');

for (const source of [history, labels, partEditor, partsList, purchaseOrderEditor, purchaseOrdersList, vendors]) {
  assert.doesNotMatch(source, /inventoryService|supabase/i, 'Display tabs must not load or mutate inventory data directly.');
}

for (const snapshotField of ['Purchase Qty', 'Inventory Qty', 'Purchase Unit Cost', 'Landed Inventory Unit Cost']) {
  assert.match(history, new RegExp(snapshotField), `History must retain ${snapshotField}.`);
}
assert.match(history, /purchaseUnitLabel\(row\.purchaseUnit, row\.quantityReceived\)/, 'History must render the stored purchase-unit snapshot.');
assert.match(history, /row\.inventoryQuantityReceived/, 'History must render the stored converted inventory quantity.');
assert.match(labels, /Labels use stable barcode identity only/, 'Label identity guidance must remain visible.');
assert.match(labels, /<BarcodeLabelSheet parts=\{selectedLabelParts\} labelPreset=\{labelPreset\}/, 'Labels must retain the existing print sheet.');
assert.match(partsList, /Low stock only/, 'Parts list must retain the low-stock filter.');
assert.match(partsList, /onClick=\{\(\) => onSelectPart\(part\)\}/, 'Parts list rows must retain part selection.');
assert.match(partsList, /onToggleLabelPart\(part\.id, event\.target\.checked\)/, 'Parts list must retain individual barcode-label selection.');
assert.match(partsList, /part\.quantityOnHand <= part\.reorderPoint/, 'Parts list must retain low-stock status behavior.');
assert.match(partsList, /\{children\}/, 'Parts list boundary must preserve the existing editor alongside the table.');
assert.match(partEditor, /disabled=\{!canWrite\}/, 'Part editor fields must remain disabled without write access.');
assert.match(partEditor, /\{selectedPart && canWrite && \(/, 'Stock mutation controls must remain hidden without write access.');
assert.match(partEditor, /onSubmit=\{onSavePart\}/, 'Part saves must use the parent controller handler.');
assert.match(partEditor, /onSubmit=\{onReceive\}/, 'Direct receiving must use the parent controller handler.');
assert.match(partEditor, /onSubmit=\{onAdjust\}/, 'Stock adjustments must use the parent controller handler.');
assert.match(partEditor, /isDirty \|\| saveStatus === 'saving' \|\| saveStatus === 'error'/, 'The existing dirty-state badge must remain visible.');
assert.match(purchaseOrdersList, /Purchase Remaining/, 'PO list must retain purchase-unit remaining quantities.');
assert.match(purchaseOrdersList, /totals\.inventoryReceived} \/ \{totals\.inventoryOrdered/, 'PO list must retain converted inventory-unit totals.');
assert.match(purchaseOrdersList, /onClick=\{\(\) => onSelectPurchaseOrder\(order\)\}/, 'PO rows must retain detail selection.');
assert.match(purchaseOrdersList, /\{children\}/, 'PO list boundary must preserve the creation and receiving editor alongside the table.');
assert.match(purchaseOrderEditor, /onSubmit=\{onSavePurchaseOrder\}/, 'PO creation must use the parent controller handler.');
assert.match(purchaseOrderEditor, /onSubmit=\{onReceive\}/, 'PO receiving must use the parent controller handler.');
assert.match(purchaseOrderEditor, /onStatusChange\('cancelled'\)/, 'PO cancellation must use the parent controller handler.');
assert.match(purchaseOrderEditor, /disabled=\{!canWrite \|\| remaining <= 0 \|\| selectedPurchaseOrder\.status === 'cancelled'\}/, 'PO receiving fields must retain permission and status restrictions.');
assert.match(purchaseOrderEditor, /purchaseConversionSummary\(purchaseReceiveQuantities\[item\.id\]/, 'PO receiving must retain its converted inventory-unit preview.');
assert.match(vendors, /<form onSubmit=\{onSaveVendor\}>/, 'Vendor saves must remain connected to the parent controller.');
assert.match(vendors, /onClick=\{\(\) => onSelectVendor\(vendor\)\}/, 'Vendor selection must remain connected to the parent controller.');
assert.match(vendors, /disabled=\{!canWrite\}/, 'Vendor editing must remain disabled without write access.');
assert.match(vendors, /\{canWrite && <div className="mode-actions">/, 'Vendor save actions must remain hidden without write access.');
for (const field of ['Online Only', 'Postal Code', 'Country']) {
  assert.match(vendors, new RegExp(field), `Vendor editing must retain ${field}.`);
}

const { formatInventoryStatus, formatInventoryDate, formatInventoryDateTime, getInventoryBarcodeLabel } = await import(pathToFileURL(formattingPath));
assert.equal(formatInventoryStatus('partially_received'), 'Partially Received', 'Inventory statuses must retain readable formatting.');
assert.equal(formatInventoryStatus(''), 'Draft', 'Blank inventory statuses must retain the Draft fallback.');
assert.equal(formatInventoryDate(''), '-', 'Blank inventory dates must retain the empty fallback.');
assert.equal(formatInventoryDate('not-a-date'), 'not-a-date', 'Invalid stored dates must remain visible instead of throwing.');
assert.equal(formatInventoryDateTime('not-a-date'), 'not-a-date', 'Invalid stored date-times must remain visible instead of throwing.');
assert.equal(getInventoryBarcodeLabel({ barcodeCode: '123' }), 'FT-PART-123', 'Part barcode labels must retain their stable prefix.');
assert.equal(getInventoryBarcodeLabel({}), '-', 'Parts without barcode identity must retain the empty fallback.');
assert.match(formatting, /Number\.isNaN\(date\.getTime\(\)\)/, 'Shared formatting must guard invalid dates.');

const { preparePurchaseOrderReceiptItems, purchaseOrderTotals, remainingForPurchaseOrderItem } = await import(pathToFileURL(purchaseOrderCalculationsPath));
const { withAuthoritativeStockFields } = await import(pathToFileURL(stockFormPath));
assert.deepEqual(
  withAuthoritativeStockFields(
    { name: 'Keep this edit', quantityOnHand: '3', unitCost: '2.50', retailPrice: '9.99' },
    { quantityOnHand: 15, unitCost: 3.25 }
  ),
  { name: 'Keep this edit', quantityOnHand: '15', unitCost: '3.25', retailPrice: '9.99' },
  'Authoritative receiving must refresh stock and cost without discarding unrelated editor changes.'
);
const snapshotOrder = {
  shippingCost: 2,
  items: [{ quantityOrdered: 2, quantityReceived: 1, unitsPerPurchaseUnit: 12, unitCost: 10 }]
};
assert.equal(remainingForPurchaseOrderItem(snapshotOrder.items[0]), 1, 'PO remaining quantity must stay in purchase units.');
assert.deepEqual(
  purchaseOrderTotals(snapshotOrder),
  {
    lineCount: 1,
    ordered: 2,
    received: 1,
    remaining: 1,
    inventoryOrdered: 24,
    inventoryReceived: 12,
    inventoryRemaining: 12,
    itemSubtotal: 20,
    receivedSubtotalFallback: 10,
    estimatedCost: 20,
    shippingCost: 2,
    estimatedTotal: 22,
    receivedSubtotal: 10,
    allocatedShipping: 0,
    landedReceivedTotal: 10
  },
  'PO summaries must use each line\'s stored conversion snapshot.'
);
const validReceipt = preparePurchaseOrderReceiptItems(
  { items: [{ id: 'line-1', quantityOrdered: 2, quantityReceived: 0, unitsPerPurchaseUnit: 12, unitCost: 10 }] },
  { 'line-1': '1' },
  { 'line-1': '10' }
);
assert.equal(validReceipt.invalidReceipt, undefined, 'A valid pack receipt must pass receipt validation.');
assert.deepEqual(validReceipt.receiptItems, [{ purchaseOrderItemId: 'line-1', quantityReceived: '1', unitCost: '10' }], 'A valid pack receipt must retain its PO-line input.');
const excessiveReceipt = preparePurchaseOrderReceiptItems(
  { items: [{ id: 'line-1', quantityOrdered: 2, quantityReceived: 1, unitsPerPurchaseUnit: 12, unitCost: 10 }] },
  { 'line-1': '2' },
  { 'line-1': '10' }
);
assert.ok(excessiveReceipt.invalidReceipt, 'A receipt exceeding the remaining purchase quantity must be rejected.');
assert.match(packageJson, /"check:inventory-module-boundaries": "node scripts\/check-inventory-module-boundaries\.mjs"/, 'The focused Inventory boundary check must be exposed.');

console.log('Inventory module boundary checks passed.');
