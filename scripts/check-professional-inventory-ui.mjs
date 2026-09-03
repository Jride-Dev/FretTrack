import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('src/app/App.jsx');
const inventoryPage = read('src/modules/inventory/InventoryPage.jsx');
const parts = read('src/modules/inventory/InventoryPartsList.jsx');
const styles = read('src/styles/professional-ui.css');
const docs = read('docs/PROFESSIONAL_WORKSPACE_UI.md');
const publicDocs = read('cloudflare/frettrack-coming-soon/public/docs/inventory-and-parts.html');

assert.match(inventoryPage, /<WorkspacePageHeader/, 'Inventory must use the shared professional page heading.');
assert.match(inventoryPage, /<InventoryTabs/, 'Inventory must retain its tabbed module navigation.');
assert.match(inventoryPage, /canWrite && activeTab === 'parts'/, 'Add Part must retain its write gate.');
assert.match(parts, /Search name, manufacturer UPC/, 'Inventory search must retain the established product identity fields.');
assert.match(parts, /onClick=\{\(\) => onSelectPart\(part\)\}/, 'Inventory row selection must retain its existing handler.');
assert.match(app, /\['list', 'customers', 'inventory',/, 'Inventory must use the full-width workspace instead of retaining the intake sidebar.');
assert.match(styles, /\.inventory-page > \.workspace-page-header/, 'Professional inventory styling must include the page heading boundary.');
assert.match(styles, /\.inventory-page > \.inventory-tabs/, 'Professional inventory styling must include restrained tabs.');
assert.match(styles, /\.inventory-page \.inventory-table-wrap/, 'Professional inventory tables must use contained scrolling panels.');
assert.match(docs, /## Inventory/, 'Professional workspace documentation must describe the inventory surface.');
assert.match(publicDocs, /workspace hierarchy/, 'Public inventory guidance must describe the current workspace hierarchy.');
assert.match(publicDocs, /inventory-bench-dark\.png/, 'Public inventory guidance must include the sanitized workspace capture.');
assert.doesNotMatch(inventoryPage, /\bsupabase\b|\.from\s*\(/i, 'Inventory presentation must not introduce direct database access.');

console.log('Professional Inventory UI checks passed.');
