import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const manager = read('src/modules/customers/CustomerManager.jsx');
const lookup = read('src/modules/customers/CustomerLookup.jsx');
const detail = read('src/modules/customers/CustomerDetail.jsx');
const app = read('src/app/App.jsx');
const router = read('src/app/WorkspaceRouter.jsx');
const styles = read('src/styles/professional-ui.css');
const docs = read('docs/PROFESSIONAL_WORKSPACE_UI.md');
const publicDocs = read('cloudflare/frettrack-coming-soon/public/docs/customers.html');

assert.match(manager, /<WorkspacePageHeader/, 'Customers must use the shared professional page heading.');
assert.match(manager, /title="Find a customer"/, 'Customers must keep search and filters in a named section.');
assert.match(manager, /canPreviewCustomerImport &&/, 'CSV preview must retain its permission gate.');
assert.match(manager, /canWrite && <button[^>]*>Add Customer/, 'Customer creation must retain its write gate.');
assert.match(lookup, /title="Customer directory"/, 'Customer results must expose a named directory section.');
assert.match(lookup, /aria-pressed=\{selected\}/, 'Customer selection must retain its accessible selected state.');
for (const heading of ['Account overview', 'Contact & account', 'Job history', 'Payments', 'Notes']) {
  assert.ok(detail.includes(`title="${heading}"`), `Customer profile must include the ${heading} section.`);
}
assert.match(detail, /canWrite && onEditCustomer/, 'Customer profile editing must retain its write gate.');
assert.match(detail, /canWrite && onCreateJob/, 'Create Job must retain its write gate.');
assert.match(app, /app-layout[\s\S]*full-content/, 'Customers must use the full-width workspace instead of retaining the intake sidebar.');
assert.match(router, /canWrite=\{access\.canEditCustomers\}/, 'Customers must keep the centralized customer permission boundary.');
assert.match(router, /canPreviewCustomerImport=\{access\.canPreviewCustomerImport\}/, 'CSV preview must keep the centralized permission boundary.');
assert.match(styles, /\.customer-directory-controls/, 'Professional customer search controls must have a restrained panel treatment.');
assert.match(styles, /\.customer-module-layout/, 'Professional customer directory and profile layout must be responsive.');
assert.match(styles, /\.customer-card-button\.selected/, 'Selected customer state must remain visible.');
assert.match(styles, /\.customer-card\s*\{[\s\S]*?white-space: normal;/, 'Customer cards must allow long identity and contact values to wrap.');
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.customer-card-context/, 'Customer cards must include a mobile layout.');
assert.match(docs, /## Customers/, 'Professional workspace documentation must describe the customer surface.');
assert.match(publicDocs, /directory and profile workspace/, 'Public customer guidance must describe the current customer workspace.');
assert.doesNotMatch(manager, /\bsupabase\b|\.from\s*\(/i, 'Customer presentation must not introduce direct database access.');
assert.doesNotMatch(detail, /\bsupabase\b|\.from\s*\(/i, 'Customer profile presentation must not introduce direct database access.');

console.log('Professional Customers UI checks passed.');
